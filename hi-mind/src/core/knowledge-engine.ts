/**
 * HiMind Knowledge Engine - Core AI-Powered Knowledge Discovery System
 * 
 * This is the heart of HiMind - it handles:
 * 1. Processing raw content from Slack/GitHub into knowledge points
 * 2. Discovering topic clusters from embedding similarities
 * 3. Routing questions to relevant sources or experts
 * 
 * Key Principle: Never generate answers, always route to SOURCES or EXPERTS
 */

import { getSupabaseClient } from "@/lib/database";
import { createServiceClient } from "@/utils/supabase/service";
import OpenAI from 'openai';

export interface KnowledgeSource {
  platform: 'slack' | 'github';
  sourceType: 'slack_message' | 'slack_thread' | 'github_pr' | 'github_issue' | 'github_comment';
  externalId: string;
  externalUrl?: string;
  title?: string;
  content: string;
  authorExternalId: string;
  platformCreatedAt: string;
}

export interface ProcessedKnowledge {
  sourceId: string;
  summary: string;
  keywords: string[];
  embedding: number[];
  qualityScore: number;
  relevanceScore: number;
}

export interface KnowledgeMatch {
  knowledgePointId: string;
  summary: string;
  similarityScore: number;
  sourceUrl: string;
  sourceTitle?: string;
  authorName?: string;
  platform: string;
}

export interface ExpertMatch {
  personId: string;
  displayName: string;
  expertiseScore: number;
  contributionCount: number;
  lastContributionAt: string;
}

export interface QueryResult {
  query: string;
  knowledgeMatches: KnowledgeMatch[];
  suggestedExperts: ExpertMatch[];
  topicMatches: string[];
}

export class KnowledgeEngine {
  private supabase: any;
  private openai: OpenAI;

  constructor() {
    // Always use service client to avoid cookies dependency
    try {
      this.supabase = createServiceClient();
      console.log('🔧 [KNOWLEDGE ENGINE] Using service client (no cookies)');
    } catch (error) {
      console.error('❌ [KNOWLEDGE ENGINE] Service client failed:', error);
      throw new Error('Service role key required for Knowledge Engine. Please set SUPABASE_SERVICE_ROLE_KEY environment variable.');
    }

    // Initialize OpenAI client
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key required for Knowledge Engine. Please set OPENAI_API_KEY environment variable.');
    }
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Process raw content from platforms into knowledge points
   */
  async ingestKnowledgeSource(source: KnowledgeSource, organizationId: string): Promise<string> {
    console.log(`🧠 [KNOWLEDGE ENGINE] Ingesting ${source.platform}:${source.sourceType} - ${source.externalId}`);

    // 1. Try to resolve author first to get person_id
    let authorPersonId: string | null = null;
    if (source.authorExternalId && source.platform) {
      authorPersonId = await this.getOrCreateAuthorPerson(source, organizationId);
    }

    // 2. Store the raw knowledge source
    const { data: knowledgeSource, error: sourceError } = await this.supabase
      .from('knowledge_sources')
      .upsert({
        organization_id: organizationId,
        platform: source.platform,
        source_type: source.sourceType,
        external_id: source.externalId,
        external_url: source.externalUrl,
        title: source.title,
        content: source.content,
        author_external_id: source.authorExternalId,
        author_person_id: authorPersonId,
        platform_created_at: source.platformCreatedAt
      }, { 
        onConflict: 'organization_id,platform,external_id'
      })
      .select()
      .single();

    if (sourceError) {
      console.error('Failed to store knowledge source:', sourceError);
      throw sourceError;
    }

    // 2. Process content with AI to extract knowledge
    const processed = await this.processContentWithAI(source.content, source.title);

    // 3. Store the processed knowledge point
    const { data: knowledgePoint, error: pointError } = await this.supabase
      .from('knowledge_points')
      .upsert({
        source_id: knowledgeSource.id,
        summary: processed.summary,
        keywords: processed.keywords,
        embedding: processed.embedding,
        quality_score: processed.qualityScore,
        relevance_score: processed.relevanceScore
      }, {
        onConflict: 'source_id'
      })
      .select()
      .single();

    if (pointError) {
      console.error('Failed to store knowledge point:', pointError);
      throw pointError;
    }

    // 4. Update topic clusters and expert scores asynchronously
    this.updateTopicClustersAsync(organizationId, knowledgePoint.id, processed.embedding);
    this.updateExpertiseScoresAsync(organizationId, source.authorExternalId, knowledgePoint.id);

    console.log(`✅ [KNOWLEDGE ENGINE] Processed knowledge point: ${knowledgePoint.id}`);
    return knowledgePoint.id;
  }

  /**
   * Get or create person for author, using email-based matching
   */
  private async getOrCreateAuthorPerson(source: KnowledgeSource, organizationId: string): Promise<string | null> {
    if (!source.authorExternalId || !source.platform) {
      return null;
    }

    try {
      console.log(`🔍 [KNOWLEDGE ENGINE] Resolving author for ${source.platform}:${source.authorExternalId}`);

      // Check if we already have this external identity linked
      const { data: existingIdentity } = await this.supabase
        .from('external_identities')
        .select('person_id, people(*)')
        .eq('platform', source.platform)
        .eq('external_id', source.authorExternalId)
        .single();

      if (existingIdentity) {
        console.log(`✅ [KNOWLEDGE ENGINE] Author already linked to person: ${existingIdentity.people?.display_name}`);
        return existingIdentity.person_id;
      }

      // Fetch user email from platform
      let userEmail: string | null = null;
      let displayName: string | null = null;
      let username: string | null = null;

      if (source.platform === 'slack') {
        const slackInfo = await this.fetchSlackUserInfo(source.authorExternalId);
        userEmail = slackInfo?.email || null;
        displayName = slackInfo?.displayName || null;
        username = slackInfo?.username || null;
      } else if (source.platform === 'github') {
        const githubInfo = await this.fetchGithubUserInfo(source.authorExternalId);
        userEmail = githubInfo?.email || null;
        displayName = githubInfo?.displayName || null;
        username = githubInfo?.username || null;
      }

      if (!userEmail) {
        console.log(`⚠️ [KNOWLEDGE ENGINE] No email found for ${source.platform}:${source.authorExternalId}. Creating person without email for manual linking later.`);
        
        // Try to find existing person by fuzzy name matching before creating new one
        if (displayName) {
          const peopleService = new (await import('@/lib/database')).PeopleService(this.supabase);
          
          // Check for existing person with similar name
          const existingPerson = await this.findPersonByFuzzyNameMatch(displayName, organizationId);
          
          if (existingPerson) {
            console.log(`🔗 [KNOWLEDGE ENGINE] Found existing person by name match: "${displayName}" → "${existingPerson.display_name}"`);
            
            // Create external identity link to existing person
            await peopleService.createExternalIdentity(
              existingPerson.id,
              source.platform as 'slack' | 'github',
              source.authorExternalId,
              username || undefined
            );
            
            console.log(`✅ [KNOWLEDGE ENGINE] Linked ${source.platform} identity to existing person (fuzzy name match)`);
            return existingPerson.id;
          } else {
            // Create new person since no match found
            const { data: newPerson } = await peopleService.createPerson(
              organizationId, 
              displayName,
              undefined // no email
            );
            
            if (newPerson) {
              console.log(`👤 [KNOWLEDGE ENGINE] Created new person: ${newPerson.display_name}`);
              
              // Create external identity link
              await peopleService.createExternalIdentity(
                newPerson.id,
                source.platform as 'slack' | 'github',
                source.authorExternalId,
                username || undefined
              );
              
              console.log(`🔗 [KNOWLEDGE ENGINE] Linked ${source.platform} identity to new person`);
              return newPerson.id;
            }
          }
        }
        
        return null;
      }

      // Try to find existing person by email
      const peopleService = new (await import('@/lib/database')).PeopleService(this.supabase);
      const { data: existingPerson } = await peopleService.getPersonByEmail(userEmail, organizationId);

      let personId: string;

      if (existingPerson) {
        // Link to existing person
        personId = existingPerson.id;
        console.log(`🔗 [KNOWLEDGE ENGINE] Linking ${source.platform} identity to existing person: ${existingPerson.display_name} (${userEmail})`);
      } else {
        // Create new person
        const { data: newPerson } = await peopleService.createPerson(
          organizationId, 
          displayName || username || `${source.platform} User`,
          userEmail
        );
        
        if (!newPerson) {
          console.error(`❌ [KNOWLEDGE ENGINE] Failed to create person for ${userEmail}`);
          return null;
        }

        personId = newPerson.id;
        console.log(`👤 [KNOWLEDGE ENGINE] Created new person: ${newPerson.display_name} (${userEmail})`);
      }

      // Create external identity link
      await peopleService.createExternalIdentity(
        personId,
        source.platform as 'slack' | 'github',
        source.authorExternalId,
        username || undefined
      );

      console.log(`✅ [KNOWLEDGE ENGINE] Successfully linked ${source.platform}:${source.authorExternalId} to person`);
      return personId;

    } catch (error) {
      console.error(`❌ [KNOWLEDGE ENGINE] Failed to resolve author by email:`, error);
      // Don't throw - continue processing even if author resolution fails
      return null;
    }
  }

  /**
   * Fetch Slack user information including email
   */
  private async fetchSlackUserInfo(userId: string): Promise<{ email?: string; displayName?: string; username?: string } | null> {
    try {
      // We need access to Slack WebClient - let's use the config to create one
      const { getSlackConfig } = await import('@/integrations/slack/config');
      const { WebClient } = await import('@slack/web-api');
      
      const config = getSlackConfig();
      const client = new WebClient(config.botToken);

      const result = await client.users.info({ user: userId });
      
      if (result.ok && result.user) {
        return {
          email: result.user.profile?.email,
          displayName: result.user.profile?.display_name || result.user.profile?.real_name,
          username: result.user.name
        };
      }
    } catch (error) {
      console.error(`❌ [KNOWLEDGE ENGINE] Failed to fetch Slack user info for ${userId}:`, error);
    }
    return null;
  }

  /**
   * Fetch GitHub user information including email
   */
  private async fetchGithubUserInfo(userId: string): Promise<{ email?: string; displayName?: string; username?: string } | null> {
    try {
      console.log(`🔍 [KNOWLEDGE ENGINE] Fetching GitHub user info for: ${userId}`);
      
      const { Octokit } = await import('@octokit/rest');
      
      if (!process.env.GITHUB_TOKEN) {
        console.log(`⚠️ [KNOWLEDGE ENGINE] GITHUB_TOKEN not set, cannot fetch user info`);
        return null;
      }
      
      const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
      });

      const result = await octokit.rest.users.getByUsername({ username: userId });
      
      if (result.data) {
        return {
          email: result.data.email, // May be null if private
          displayName: result.data.name,
          username: result.data.login
        };
      }
    } catch (error) {
      console.error(`❌ [KNOWLEDGE ENGINE] Failed to fetch GitHub user info for ${userId}:`, error);
    }
    return null;
  }

  /**
   * Find existing person by fuzzy name matching to prevent duplicates
   */
  private async findPersonByFuzzyNameMatch(targetName: string, organizationId: string): Promise<any | null> {
    try {
      // Get all people in the organization
      const { data: people } = await this.supabase
        .from('people')
        .select('*')
        .eq('organization_id', organizationId);

      if (!people || people.length === 0) {
        return null;
      }

      const normalizedTarget = this.normalizeName(targetName);
      
      // Find exact normalized match first
      const exactMatch = people.find(person => 
        this.normalizeName(person.display_name) === normalizedTarget
      );

      if (exactMatch) {
        return exactMatch;
      }

      // Find fuzzy matches with similarity scoring
      const fuzzyMatches = people.map(person => ({
        person,
        similarity: this.calculateNameSimilarity(normalizedTarget, this.normalizeName(person.display_name))
      }))
      .filter(match => match.similarity > 0.8) // High threshold for confidence
      .sort((a, b) => b.similarity - a.similarity);

      return fuzzyMatches.length > 0 ? fuzzyMatches[0].person : null;

    } catch (error) {
      console.error(`❌ [KNOWLEDGE ENGINE] Fuzzy name matching failed:`, error);
      return null;
    }
  }

  /**
   * Normalize name for comparison
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' '); // Normalize spaces
  }

  /**
   * Calculate similarity between two normalized names
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    // Simple Levenshtein distance-based similarity
    const maxLength = Math.max(name1.length, name2.length);
    if (maxLength === 0) return 1; // Both empty
    
    const distance = this.levenshteinDistance(name1, name2);
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Search for knowledge points and experts based on a query
   */
  async searchKnowledge(query: string, organizationId: string): Promise<QueryResult> {
    console.log(`🔍 [KNOWLEDGE ENGINE] Searching: "${query}"`);

    // 1. Generate embedding for the query
    const queryEmbedding = await this.generateEmbedding(query);

    // 2. Log the search query
    await this.logSearchQuery(query, queryEmbedding, organizationId);

    // 3. Find similar knowledge points (get more candidates for LLM ranking)
    const { data: rawKnowledgeMatches } = await this.supabase
      .rpc('find_similar_knowledge', {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        org_id: organizationId,
        similarity_threshold: 0.1,
        result_limit: 50  // Get many candidates for LLM to choose from
      });

    // 4. Use LLM to intelligently rank and select top 3 most relevant results
    const rankedKnowledgeMatches = await this.rankResultsWithLLM(query, rawKnowledgeMatches || []);

    // 5. Find relevant topics and their experts
    const topicMatches = await this.findRelevantTopics(queryEmbedding, organizationId);
    const suggestedExperts = await this.findTopicExperts(topicMatches, 5);

    const result: QueryResult = {
      query,
      knowledgeMatches: rankedKnowledgeMatches,
      suggestedExperts,
      topicMatches: topicMatches.map(t => t.name)
    };

    console.log(`📊 [KNOWLEDGE ENGINE] Found ${rawKnowledgeMatches?.length || 0} initial matches, LLM selected ${rankedKnowledgeMatches.length} top results, ${result.suggestedExperts.length} expert suggestions`);
    return result;
  }

  /**
   * Use LLM to intelligently rank and select the most relevant results
   */
  private async rankResultsWithLLM(query: string, candidates: any[]): Promise<KnowledgeMatch[]> {
    if (!candidates || candidates.length === 0) {
      return [];
    }

    // If we have 3 or fewer candidates, return them all
    if (candidates.length <= 3) {
      return candidates;
    }

    try {
      console.log(`🤖 [KNOWLEDGE ENGINE] LLM ranking ${candidates.length} candidates for query: "${query}"`);

      // Prepare the prompt for LLM ranking
      const candidatesText = candidates.map((match, index) => 
        `${index + 1}. "${match.summary}" (Platform: ${match.platform}, Similarity: ${Math.round(match.similarity_score * 100)}%)`
      ).join('\n');

      const prompt = `You are an intelligent search result ranker. Given a user's question and a list of potentially relevant results, select and rank the TOP 3 most relevant results that best answer the question.

User Question: "${query}"

Available Results:
${candidatesText}

Instructions:
1. Analyze each result's relevance to the user's specific question
2. Consider context, specificity, and usefulness
3. Select ONLY the 3 most relevant results
4. Rank them from most relevant (1) to least relevant (3)
5. Respond with ONLY the numbers (1-${candidates.length}) of your selected results, separated by commas
6. Example response format: "3,7,1" (meaning results 3, 7, and 1 in that order)

Your selection (numbers only):`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0.1, // Low temperature for consistent ranking
      });

      const selection = response.choices[0]?.message?.content?.trim();
      if (!selection) {
        console.log(`⚠️ [KNOWLEDGE ENGINE] LLM ranking failed, falling back to similarity order`);
        return candidates.slice(0, 3);
      }

      // Parse the LLM's selection
      const selectedIndices = selection.split(',')
        .map(num => parseInt(num.trim()) - 1) // Convert to 0-based indices
        .filter(index => index >= 0 && index < candidates.length);

      // If we got valid selections, use them; otherwise fallback
      if (selectedIndices.length >= 1) {
        const rankedResults = selectedIndices
          .slice(0, 3) // Take max 3
          .map(index => candidates[index]);
        
        console.log(`✅ [KNOWLEDGE ENGINE] LLM selected ${rankedResults.length} results: [${selectedIndices.map(i => i + 1).join(', ')}]`);
        return rankedResults;
      } else {
        console.log(`⚠️ [KNOWLEDGE ENGINE] Invalid LLM selection "${selection}", falling back to similarity order`);
        return candidates.slice(0, 3);
      }

    } catch (error) {
      console.error(`❌ [KNOWLEDGE ENGINE] LLM ranking error:`, error);
      // Fallback to simple similarity-based ranking
      return candidates.slice(0, 3);
    }
  }

  /**
   * Discover new topics from knowledge point clusters using "centers of mass" approach
   */
  async discoverTopicClusters(organizationId: string, options: {
    minClusterSize?: number;
    maxClusters?: number;
    similarityThreshold?: number;
  } = {}): Promise<{
    topics: any[];
    stats: {
      totalKnowledgePoints: number;
      clustersFound: number;
      newTopics: number;
      updatedTopics: number;
    };
  }> {
    console.log(`🎯 [KNOWLEDGE ENGINE] Discovering topic clusters for org: ${organizationId}`);

    const {
      minClusterSize = 3,
      maxClusters = 20,
      similarityThreshold = 0.7
    } = options;

    // Get all knowledge points with their embeddings and metadata
    const { data: knowledgePoints } = await this.supabase
      .from('knowledge_points')
      .select(`
        id,
        embedding,
        summary,
        keywords,
        knowledge_sources!inner(
          organization_id,
          platform,
          source_type,
          external_url,
          content,
          people(display_name)
        )
      `)
      .eq('knowledge_sources.organization_id', organizationId);

    if (!knowledgePoints || knowledgePoints.length < minClusterSize) {
      console.log(`⚠️ [KNOWLEDGE ENGINE] Not enough knowledge points for clustering (${knowledgePoints?.length || 0} < ${minClusterSize})`);
      return {
        topics: [],
        stats: {
          totalKnowledgePoints: knowledgePoints?.length || 0,
          clustersFound: 0,
          newTopics: 0,
          updatedTopics: 0
        }
      };
    }

    console.log(`📊 [KNOWLEDGE ENGINE] Clustering ${knowledgePoints.length} knowledge points...`);
    console.log(`🔍 [KNOWLEDGE ENGINE] Sample knowledge point structure:`, {
      id: knowledgePoints[0]?.id,
      hasEmbedding: !!knowledgePoints[0]?.embedding,
      embeddingType: typeof knowledgePoints[0]?.embedding,
      embeddingLength: typeof knowledgePoints[0]?.embedding === 'string' ? knowledgePoints[0]?.embedding?.length : 'N/A',
      knowledgeSourcesType: typeof knowledgePoints[0]?.knowledge_sources,
      knowledgeSourcesPlatform: knowledgePoints[0]?.knowledge_sources?.platform
    });

    // Perform K-means clustering on embeddings to find topic centers
    let clusters = [];
    try {
      console.log(`🎯 [KNOWLEDGE ENGINE] About to call performEmbeddingClustering...`);
      clusters = await this.performEmbeddingClustering(knowledgePoints, {
        minClusterSize,
        maxClusters,
        similarityThreshold
      });
      console.log(`✅ [KNOWLEDGE ENGINE] performEmbeddingClustering completed successfully`);
    } catch (error) {
      console.error(`❌ [KNOWLEDGE ENGINE] performEmbeddingClustering failed:`, error);
      return {
        topics: [],
        stats: {
          totalKnowledgePoints: knowledgePoints.length,
          clustersFound: 0,
          newTopics: 0,
          updatedTopics: 0
        }
      };
    }

    console.log(`🔍 [KNOWLEDGE ENGINE] Found ${clusters.length} clusters`);

    // Create/update discovered topics with LLM-generated names
    const results = {
      newTopics: 0,
      updatedTopics: 0,
      topics: []
    };

    for (const cluster of clusters) {
      const topicResult = await this.createOrUpdateTopicFromCluster(organizationId, cluster);
      if (topicResult) {
        results.topics.push(topicResult);
        if (topicResult.isNew) {
          results.newTopics++;
        } else {
          results.updatedTopics++;
        }
      }
    }

    console.log(`✨ [KNOWLEDGE ENGINE] Topic discovery complete: ${results.newTopics} new, ${results.updatedTopics} updated`);

    return {
      topics: results.topics,
      stats: {
        totalKnowledgePoints: knowledgePoints.length,
        clustersFound: clusters.length,
        newTopics: results.newTopics,
        updatedTopics: results.updatedTopics
      }
    };
  }

  // =========================
  // Private Helper Methods  
  // =========================

  /**
   * Perform K-means clustering on knowledge point embeddings
   */
  private async performEmbeddingClustering(knowledgePoints: any[], options: {
    minClusterSize: number;
    maxClusters: number;
    similarityThreshold: number;
  }): Promise<any[]> {
    console.log(`🚀 [KNOWLEDGE ENGINE] Starting performEmbeddingClustering with ${knowledgePoints.length} knowledge points`);
    const { minClusterSize, maxClusters } = options;

    // Convert embeddings to arrays of numbers
    const embeddings = knowledgePoints.map(kp => {
      try {
        let embedding;
        if (typeof kp.embedding === 'string') {
          // Handle string embeddings - they should already be JSON arrays
          embedding = JSON.parse(kp.embedding);
        } else if (Array.isArray(kp.embedding)) {
          embedding = kp.embedding;
        } else {
          console.log(`⚠️ [KNOWLEDGE ENGINE] Unknown embedding format for ${kp.id}:`, typeof kp.embedding);
          return [];
        }
        
        if (Array.isArray(embedding) && embedding.length === 1536) {
          return embedding;
        } else {
          console.log(`⚠️ [KNOWLEDGE ENGINE] Invalid embedding dimensions for ${kp.id}: ${embedding?.length}`);
          return [];
        }
      } catch (error) {
        console.error(`❌ [KNOWLEDGE ENGINE] Failed to parse embedding for ${kp.id}:`, error);
        return [];
      }
    }).filter(emb => emb.length > 0);

    if (embeddings.length === 0) {
      console.log('⚠️ [KNOWLEDGE ENGINE] No valid embeddings found');
      return [];
    }
    
    console.log(`✅ [KNOWLEDGE ENGINE] Successfully parsed ${embeddings.length} valid embeddings`);

    // Determine optimal number of clusters with content-aware logic
    const optimalK = this.determineOptimalClusters(embeddings.length, maxClusters, knowledgePoints);
    
    console.log(`🎯 [KNOWLEDGE ENGINE] Using ${optimalK} clusters for ${embeddings.length} points`);

    // Perform K-means clustering
    const clusters = this.kMeansClustering(embeddings, optimalK);
    
    console.log(`🎯 [KNOWLEDGE ENGINE] Raw clusters from K-means:`, clusters.map(c => c.length));

    // Map back to knowledge points and filter by minimum size
    const clustersWithPoints = clusters.map((clusterIndices, clusterIndex) => {
      console.log(`🔍 [KNOWLEDGE ENGINE] Cluster ${clusterIndex}: ${clusterIndices.length} indices: [${clusterIndices.slice(0, 5).join(', ')}...]`);
      
      const points = clusterIndices.map(index => {
        if (index >= 0 && index < knowledgePoints.length) {
          return knowledgePoints[index];
        } else {
          console.log(`⚠️ [KNOWLEDGE ENGINE] Invalid index ${index} for ${knowledgePoints.length} knowledge points`);
          return null;
        }
      }).filter(Boolean);
      
      console.log(`📊 [KNOWLEDGE ENGINE] Cluster ${clusterIndex}: ${clusterIndices.length} indices → ${points.length} valid points`);
      
      if (points.length < minClusterSize) {
        console.log(`❌ [KNOWLEDGE ENGINE] Cluster ${clusterIndex} filtered out: ${points.length} < ${minClusterSize}`);
        return null;
      }

      // Calculate cluster centroid
      const validEmbeddings = clusterIndices
        .filter(i => i >= 0 && i < embeddings.length)
        .map(i => embeddings[i]);
      const centroid = this.calculateCentroid(validEmbeddings);

      console.log(`✅ [KNOWLEDGE ENGINE] Cluster ${clusterIndex}: keeping ${points.length} points`);

      return {
        id: `cluster_${clusterIndex}`,
        points,
        centroid,
        size: points.length
      };
    }).filter(Boolean);

    console.log(`📊 [KNOWLEDGE ENGINE] Filtered to ${clustersWithPoints.length} clusters with min size ${minClusterSize}`);

    return clustersWithPoints;
  }

  /**
   * Determine optimal number of clusters based on data size and content diversity
   */
  private determineOptimalClusters(dataSize: number, maxClusters: number, knowledgePoints?: any[]): number {
    // More aggressive clustering for better granularity
    let baseK = 2;
    
    if (dataSize >= 10) baseK = 3;
    if (dataSize >= 25) baseK = 4;
    if (dataSize >= 50) baseK = 6;
    if (dataSize >= 100) baseK = 8;
    if (dataSize >= 150) baseK = 12;
    
    // Platform diversity bonus - if we have multiple platforms, increase clusters
    if (knowledgePoints) {
      const platforms = new Set(knowledgePoints.map(kp => kp.knowledge_sources?.platform));
      const sourceTypes = new Set(knowledgePoints.map(kp => kp.knowledge_sources?.source_type));
      
      if (platforms.size > 1) baseK += 2; // Multi-platform bonus
      if (sourceTypes.size > 2) baseK += 1; // Source type diversity bonus
      
      console.log(`🎯 [KNOWLEDGE ENGINE] Platform diversity: ${platforms.size} platforms, ${sourceTypes.size} source types`);
    }
    
    // Cap at maxClusters but be more aggressive
    return Math.min(baseK, maxClusters);
  }

  /**
   * Improved K-means clustering with better initialization
   */
  private kMeansClustering(embeddings: number[][], k: number, maxIterations = 100): number[][] {
    const dimensions = embeddings[0].length;
    const numPoints = embeddings.length;

    // Use K-means++ initialization for better initial centroids
    let centroids = this.initializeCentroidsKMeansPlusPlus(embeddings, k);

    let assignments = new Array(numPoints);
    let converged = false;
    let iteration = 0;

    while (!converged && iteration < maxIterations) {
      // Assign points to nearest centroid
      const newAssignments = embeddings.map((point, pointIndex) => {
        let minDistance = Infinity;
        let assignedCluster = 0;

        for (let clusterIndex = 0; clusterIndex < k; clusterIndex++) {
          // Use cosine distance for high-dimensional embeddings
          const similarity = this.cosineSimilarity(point, centroids[clusterIndex]);
          const distance = 1 - similarity; // Convert similarity to distance
          if (distance < minDistance) {
            minDistance = distance;
            assignedCluster = clusterIndex;
          }
        }

        return assignedCluster;
      });

      // Check for convergence
      converged = assignments.every((assignment, index) => assignment === newAssignments[index]);
      assignments = newAssignments;

      // Update centroids
      if (!converged) {
        centroids = Array(k).fill(null).map((_, clusterIndex) => {
          const clusterPoints = embeddings.filter((_, pointIndex) => assignments[pointIndex] === clusterIndex);
          
          if (clusterPoints.length === 0) {
            // Random centroid if cluster is empty
            return Array(dimensions).fill(0).map(() => Math.random() * 2 - 1);
          }

          return this.calculateCentroid(clusterPoints);
        });
      }

      iteration++;
    }

    // Group point indices by cluster
    const clusters: number[][] = Array(k).fill(null).map(() => []);
    assignments.forEach((clusterIndex, pointIndex) => {
      clusters[clusterIndex].push(pointIndex);
    });

    const filteredClusters = clusters.filter(cluster => cluster.length > 0);
    console.log(`🎯 [KNOWLEDGE ENGINE] K-means complete: ${clusters.length} raw clusters → ${filteredClusters.length} non-empty clusters`);
    return filteredClusters;
  }

  /**
   * Calculate centroid of a set of vectors
   */
  private calculateCentroid(vectors: number[][]): number[] {
    if (vectors.length === 0) return [];
    
    const dimensions = vectors[0].length;
    const centroid = new Array(dimensions).fill(0);

    for (const vector of vectors) {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += vector[i];
      }
    }

    for (let i = 0; i < dimensions; i++) {
      centroid[i] /= vectors.length;
    }

    return centroid;
  }

  /**
   * Calculate Euclidean distance between two vectors
   */
  private euclideanDistance(vec1: number[], vec2: number[]): number {
    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      sum += Math.pow(vec1[i] - vec2[i], 2);
    }
    return Math.sqrt(sum);
  }

  /**
   * K-means++ initialization for better initial centroids
   */
  private initializeCentroidsKMeansPlusPlus(embeddings: number[][], k: number): number[][] {
    const centroids: number[][] = [];
    const numPoints = embeddings.length;

    // Choose first centroid randomly
    const firstIndex = Math.floor(Math.random() * numPoints);
    centroids.push([...embeddings[firstIndex]]);

    // Choose remaining centroids with probability proportional to squared distance
    for (let i = 1; i < k; i++) {
      const distances = embeddings.map(point => {
        // Find distance to nearest existing centroid using cosine distance
        let minDistance = Infinity;
        for (const centroid of centroids) {
          const similarity = this.cosineSimilarity(point, centroid);
          const distance = 1 - similarity; // Convert similarity to distance
          if (distance < minDistance) {
            minDistance = distance;
          }
        }
        return minDistance * minDistance; // Squared distance
      });

      // Calculate cumulative probabilities
      const totalDistance = distances.reduce((sum, d) => sum + d, 0);
      const probabilities = distances.map(d => d / totalDistance);
      
      // Choose next centroid based on weighted probability
      const random = Math.random();
      let cumulativeProb = 0;
      let chosenIndex = 0;
      
      for (let j = 0; j < probabilities.length; j++) {
        cumulativeProb += probabilities[j];
        if (random <= cumulativeProb) {
          chosenIndex = j;
          break;
        }
      }

      centroids.push([...embeddings[chosenIndex]]);
    }

    console.log(`🎯 [KNOWLEDGE ENGINE] Initialized ${k} centroids using K-means++`);
    return centroids;
  }

  /**
   * Create or update topic from cluster using LLM-generated names
   */
  private async createOrUpdateTopicFromCluster(organizationId: string, cluster: any): Promise<any | null> {
    try {
      // Generate intelligent topic name using LLM
      const topicName = await this.generateTopicNameFromCluster(cluster);
      
      if (!topicName) {
        console.log('⚠️ [KNOWLEDGE ENGINE] Failed to generate topic name for cluster');
        return null;
      }

      // Check if topic already exists (fuzzy matching)
      const existingTopic = await this.findSimilarTopic(topicName, organizationId);
      
      let topic;
      let isNew = false;

      if (existingTopic) {
        // Update existing topic
        const { data: updatedTopic } = await this.supabase
          .from('discovered_topics')
          .update({
            cluster_centroid: `[${cluster.centroid.join(',')}]`,
            knowledge_point_count: cluster.size,
            last_updated: new Date().toISOString()
          })
          .eq('id', existingTopic.id)
          .select()
          .single();
        
        topic = updatedTopic;
        console.log(`📝 [KNOWLEDGE ENGINE] Updated existing topic: ${topicName}`);
      } else {
        // Create new topic
        const { data: newTopic } = await this.supabase
          .from('discovered_topics')
          .insert({
            organization_id: organizationId,
            name: topicName,
            cluster_centroid: `[${cluster.centroid.join(',')}]`,
            knowledge_point_count: cluster.size,
            confidence_score: this.calculateTopicConfidence(cluster),
            discovered_at: new Date().toISOString(),
            last_updated: new Date().toISOString()
          })
          .select()
          .single();

        topic = newTopic;
        isNew = true;
        console.log(`✨ [KNOWLEDGE ENGINE] Created new topic: ${topicName}`);
      }

      if (!topic) {
        console.error('❌ [KNOWLEDGE ENGINE] Failed to create/update topic');
        return null;
      }

      // Link knowledge points to topic
      await this.linkKnowledgePointsToTopic(topic.id, cluster.points.map((p: any) => p.id));

      return {
        ...topic,
        isNew,
        knowledgePointIds: cluster.points.map((p: any) => p.id)
      };

    } catch (error) {
      console.error('❌ [KNOWLEDGE ENGINE] Failed to create/update topic from cluster:', error);
      return null;
    }
  }

  /**
   * Generate meaningful topic name using LLM analysis of cluster content
   */
  private async generateTopicNameFromCluster(cluster: any): Promise<string | null> {
    try {
      // Prepare sample content from cluster points
      const sampleContent = cluster.points
        .slice(0, 10) // Limit to prevent token overflow
        .map((point: any, index: number) => {
          const source = point.knowledge_sources;
          const author = source.people?.display_name || 'Unknown';
          const platform = source.platform || 'unknown';
          
          return `${index + 1}. [${platform}] "${point.summary}" - by ${author}`;
        })
        .join('\n');

      const prompt = `You are an expert at analyzing technical content and identifying topics. Given the following knowledge points that have been clustered together, generate a concise, descriptive topic name.

Knowledge Points:
${sampleContent}

Instructions:
1. Analyze the common themes, technologies, and concepts across these knowledge points
2. Generate a topic name that is:
   - Concise (2-5 words)
   - Descriptive and specific
   - Professional and clear
   - Captures the main theme that unites these knowledge points
3. Avoid generic terms like "Discussion" or "General"
4. Focus on the actual subject matter (technologies, features, processes, etc.)

Topic Name:`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 20,
        temperature: 0.3, // Low temperature for consistent naming
      });

      const topicName = response.choices[0]?.message?.content?.trim();
      
      if (topicName && topicName.length > 0) {
        console.log(`🎯 [KNOWLEDGE ENGINE] Generated topic name: "${topicName}" for cluster of ${cluster.size} points`);
        return topicName;
      }

    } catch (error) {
      console.error('❌ [KNOWLEDGE ENGINE] LLM topic naming failed:', error);
    }

    // Fallback to simple naming based on most common keywords
    return this.generateFallbackTopicName(cluster);
  }

  /**
   * Fallback topic naming based on keyword analysis
   */
  private generateFallbackTopicName(cluster: any): string {
    const allKeywords = cluster.points
      .flatMap((point: any) => point.keywords || [])
      .filter((keyword: string) => keyword && keyword.length > 2);

    if (allKeywords.length === 0) {
      return `Topic ${cluster.id}`;
    }

    // Count keyword frequency
    const keywordCounts = allKeywords.reduce((acc: Record<string, number>, keyword: string) => {
      acc[keyword] = (acc[keyword] || 0) + 1;
      return acc;
    }, {});

    // Get most common keywords
    const topKeywords = Object.entries(keywordCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 2)
      .map(([keyword]) => keyword);

    return topKeywords.join(' & ') || `Topic ${cluster.id}`;
  }

  /**
   * Calculate confidence score for a topic based on cluster properties
   */
  private calculateTopicConfidence(cluster: any): number {
    // Higher confidence for larger, more cohesive clusters
    const sizeScore = Math.min(cluster.size / 10, 1); // Normalize size
    
    // Could add more sophisticated metrics here:
    // - Intra-cluster similarity
    // - Platform diversity
    // - Temporal consistency
    
    return Math.round(sizeScore * 100) / 100;
  }

  /**
   * Find existing topic with similar name
   */
  private async findSimilarTopic(topicName: string, organizationId: string): Promise<any | null> {
    const { data: topics } = await this.supabase
      .from('discovered_topics')
      .select('*')
      .eq('organization_id', organizationId);

    if (!topics || topics.length === 0) {
      return null;
    }

    // Simple fuzzy matching on topic names
    const normalizedTarget = topicName.toLowerCase().trim();
    
    for (const topic of topics) {
      const normalizedExisting = topic.name.toLowerCase().trim();
      const similarity = this.calculateNameSimilarity(normalizedTarget, normalizedExisting);
      
      if (similarity > 0.8) { // High threshold for topic merging
        return topic;
      }
    }

    return null;
  }

  /**
   * Link knowledge points to discovered topic
   */
  private async linkKnowledgePointsToTopic(topicId: string, knowledgePointIds: string[]): Promise<void> {
    // Remove existing links for these knowledge points
    await this.supabase
      .from('knowledge_topic_memberships')
      .delete()
      .in('knowledge_point_id', knowledgePointIds);

    // Create new links
    const memberships = knowledgePointIds.map(kpId => ({
      topic_id: topicId,
      knowledge_point_id: kpId,
      confidence_score: 0.8 // Default confidence, could be made more sophisticated
    }));

    if (memberships.length > 0) {
      await this.supabase
        .from('knowledge_topic_memberships')
        .insert(memberships);
    }
  }

  private async processContentWithAI(content: string, title?: string): Promise<ProcessedKnowledge> {
    // Combine title and content
    const fullText = title ? `${title}\n\n${content}` : content;

    // Generate embedding
    const embedding = await this.generateEmbedding(fullText);

    // Extract summary and keywords using simple AI processing
    const summary = await this.generateSummary(fullText);
    const keywords = await this.extractKeywords(fullText);
    
    // Calculate quality metrics
    const qualityScore = this.calculateQualityScore(fullText, keywords);
    const relevanceScore = this.calculateRelevanceScore(fullText);

    return {
      sourceId: '', // Will be set by caller
      summary,
      keywords,
      embedding,
      qualityScore,
      relevanceScore
    };
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000), // Limit input size
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      // Return a zero vector as fallback
      return new Array(1536).fill(0);
    }
  }

  private async generateSummary(text: string): Promise<string> {
    // For MVP, use simple extractive summary (first meaningful sentence)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    if (sentences.length === 0) return text.substring(0, 100);
    
    // Return first substantial sentence, limited to 200 chars
    const firstSentence = sentences[0].trim();
    return firstSentence.length > 200 ? firstSentence.substring(0, 197) + '...' : firstSentence;
  }

  private async extractKeywords(text: string): Promise<string[]> {
    // Simple keyword extraction for MVP
    const techKeywords = [
      'react', 'javascript', 'typescript', 'node', 'api', 'database', 'sql',
      'docker', 'kubernetes', 'aws', 'authentication', 'security', 'performance',
      'bug', 'fix', 'feature', 'deployment', 'test', 'error', 'issue'
    ];

    const lowerText = text.toLowerCase();
    return techKeywords.filter(keyword => lowerText.includes(keyword));
  }

  private calculateQualityScore(text: string, keywords: string[]): number {
    let score = 0.5; // Base score

    // Length factor
    if (text.length > 100) score += 0.1;
    if (text.length > 300) score += 0.1;

    // Technical content factor
    if (keywords.length > 0) score += Math.min(0.3, keywords.length * 0.1);

    // Structure factor
    if (text.includes(':') || text.includes('```') || text.includes('-')) score += 0.1;

    return Math.min(1.0, score);
  }

  private calculateRelevanceScore(text: string): number {
    // For MVP, base on content indicators
    const relevanceIndicators = ['how to', 'solution', 'fix', 'problem', 'issue', 'error', 'help'];
    const lowerText = text.toLowerCase();
    
    let score = 0.5;
    relevanceIndicators.forEach(indicator => {
      if (lowerText.includes(indicator)) score += 0.1;
    });

    return Math.min(1.0, score);
  }

  private async updateTopicClustersAsync(organizationId: string, knowledgePointId: string, embedding: number[]): Promise<void> {
    // Run in background - find which existing topics this knowledge point belongs to
    setTimeout(async () => {
      try {
        const { data: topics } = await this.supabase
          .from('discovered_topics')
          .select('id, cluster_centroid')
          .eq('organization_id', organizationId);

        for (const topic of topics || []) {
          if (topic.cluster_centroid) {
            const similarity = this.cosineSimilarity(embedding, topic.cluster_centroid);
            if (similarity > 0.7) {
              // Add this knowledge point to the topic
              await this.supabase
                .from('knowledge_topic_memberships')
                .upsert({
                  knowledge_point_id: knowledgePointId,
                  topic_id: topic.id,
                  similarity_score: similarity
                });
            }
          }
        }
      } catch (error) {
        console.error('Failed to update topic clusters:', error);
      }
    }, 100);
  }

  private async updateExpertiseScoresAsync(organizationId: string, authorExternalId: string, knowledgePointId: string): Promise<void> {
    // Run in background - update expertise scores based on contribution
    setTimeout(async () => {
      try {
        // Find person by external ID
        const { data: identity } = await this.supabase
          .from('external_identities')
          .select('person_id')
          .eq('external_id', authorExternalId)
          .single();

        if (!identity) return;

        // Find topics this knowledge point belongs to
        const { data: topicMemberships } = await this.supabase
          .from('knowledge_topic_memberships')
          .select('topic_id, similarity_score')
          .eq('knowledge_point_id', knowledgePointId);

        // Update expertise scores for each topic
        for (const membership of topicMemberships || []) {
          await this.supabase
            .from('topic_experts')
            .upsert({
              person_id: identity.person_id,
              topic_id: membership.topic_id,
              expertise_score: membership.similarity_score,
              contribution_count: 1,
              last_contribution_at: new Date().toISOString(),
              is_active: true
            }, {
              onConflict: 'person_id,topic_id'
            });
        }
      } catch (error) {
        console.error('Failed to update expertise scores:', error);
      }
    }, 200);
  }

  private async logSearchQuery(query: string, embedding: number[], organizationId: string): Promise<void> {
    await this.supabase
      .from('search_queries')
      .insert({
        organization_id: organizationId,
        query_text: query,
        query_embedding: `[${embedding.join(',')}]`
      });
  }

  private async findRelevantTopics(queryEmbedding: number[], organizationId: string): Promise<any[]> {
    const { data: topics } = await this.supabase
      .from('discovered_topics')
      .select('id, name, cluster_centroid')
      .eq('organization_id', organizationId);

    if (!topics) return [];

    return topics
      .map((topic: any) => ({
        ...topic,
        similarity: topic.cluster_centroid ? this.cosineSimilarity(queryEmbedding, topic.cluster_centroid) : 0
      }))
      .filter((topic: any) => topic.similarity > 0.6)
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, 3);
  }

  private async findTopicExperts(topics: any[], limit: number): Promise<ExpertMatch[]> {
    if (topics.length === 0) return [];

    const topicIds = topics.map(t => t.id);
    const { data: experts } = await this.supabase
      .rpc('find_topic_experts', {
        topic_id_param: topicIds[0], // For MVP, just use first topic
        limit_count: limit
      });

    return experts || [];
  }



  private async createOrUpdateTopic(organizationId: string, cluster: any): Promise<void> {
    await this.supabase
      .from('discovered_topics')
      .upsert({
        organization_id: organizationId,
        name: cluster.name,
        description: cluster.description,
        cluster_centroid: cluster.centroid,
        knowledge_point_count: cluster.members.length,
        confidence_score: Math.min(1.0, cluster.members.length / 10)
      }, {
        onConflict: 'organization_id,name'
      });
  }

  private generateTopicName(summary: string, keywords: string[]): string {
    // Simple topic name generation for MVP
    if (keywords.length > 0) {
      const primaryKeyword = keywords[0];
      return primaryKeyword.charAt(0).toUpperCase() + primaryKeyword.slice(1) + ' Development';
    }
    
    const words = summary.split(' ').slice(0, 2);
    return words.join(' ') + ' Topic';
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}