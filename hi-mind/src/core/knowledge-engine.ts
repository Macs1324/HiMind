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

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

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
   * Enhanced ingestion for Slack messages with contextual processing
   */
  async ingestSlackMessageWithContext(
    source: KnowledgeSource & {
      channelId?: string;
      threadTs?: string;
    }, 
    organizationId: string
  ): Promise<string | null> {
    console.log(`🧠 [CONTEXTUAL INGEST] Processing Slack message: ${source.externalId}`);

    // 1. Process message with contextual enhancement
    const contextualResult = await this.processSlackMessageWithContext({
      ...source,
      timestamp: source.platformCreatedAt
    });

    if (!contextualResult.shouldIndex) {
      console.log(`⏭️ [CONTEXTUAL INGEST] Skipping non-substantial message: ${source.externalId}`);
      return null;
    }

    // 2. Try to resolve author first to get person_id
    let authorPersonId: string | null = null;
    if (source.authorExternalId && source.platform) {
      authorPersonId = await this.getOrCreateAuthorPerson(source, organizationId);
    }

    // 3. Store the raw knowledge source with contextual content
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
        contextual_content: contextualResult.contextualContent,
        channel_id: source.channelId,
        thread_ts: source.threadTs,
        author_external_id: source.authorExternalId,
        author_person_id: authorPersonId,
        platform_created_at: source.platformCreatedAt
      }, { 
        onConflict: 'organization_id,platform,external_id'
      })
      .select()
      .single();

    if (sourceError) {
      console.error('❌ [CONTEXTUAL INGEST] Failed to store knowledge source:', sourceError);
      throw sourceError;
    }

    // 4. Additional safety check: Skip obvious questions that slipped through LLM filtering
    // Be less aggressive with thread replies to capture more conversational content
    const isThread = source.sourceType === 'slack_thread';
    const shouldFilter = !isThread && (this.isObviousQuestion(source.content) || this.isObviousQuestion(contextualResult.contextualContent));
    
    if (shouldFilter) {
      console.log(`⚠️ [CONTEXTUAL INGEST] Safety filter caught question that LLM missed: ${source.externalId}`);
      console.log(`🔍 [CONTEXTUAL INGEST] Original: "${source.content}"`);
      console.log(`🔍 [CONTEXTUAL INGEST] Enhanced: "${contextualResult.contextualContent}"`);
      return null;
    }
    
    if (isThread) {
      console.log(`🧵 [CONTEXTUAL INGEST] Processing thread reply with relaxed filtering: "${source.content}"`);
    }

    // 5. Process content with AI using contextual enhancement and related questions
    const processed = await this.processContentWithAI(
      source.content, 
      source.title, 
      contextualResult.contextualContent,
      contextualResult.relatedQuestions
    );

    // 6. Store the processed knowledge point with contextual data
    const { data: knowledgePoint, error: pointError } = await this.supabase
      .from('knowledge_points')
      .upsert({
        source_id: knowledgeSource.id,
        summary: processed.summary,
        contextual_summary: processed.contextualSummary,
        context_sources: contextualResult.contextSources,
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
      console.error('❌ [CONTEXTUAL INGEST] Failed to store knowledge point:', pointError);
      throw pointError;
    }

    // 7. Update topic clusters and expert scores asynchronously
    this.updateTopicClustersAsync(organizationId, knowledgePoint.id, processed.embedding);
    this.updateExpertiseScoresAsync(organizationId, source.authorExternalId, knowledgePoint.id);

    console.log(`✅ [CONTEXTUAL INGEST] Processed contextual knowledge point: ${knowledgePoint.id}`);
    console.log(`🎯 [CONTEXTUAL INGEST] Enhanced: "${source.content}" → "${contextualResult.contextualContent}"`);
    
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
          email: result.data.email || undefined, // May be null if private
          displayName: result.data.name || undefined,
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
      const exactMatch = people.find((person: any) => 
        this.normalizeName(person.display_name) === normalizedTarget
      );

      if (exactMatch) {
        return exactMatch;
      }

      // Find fuzzy matches with similarity scoring
      const fuzzyMatches = people.map((person: any) => ({
        person,
        similarity: this.calculateNameSimilarity(normalizedTarget, this.normalizeName(person.display_name))
      }))
      .filter((match: any) => match.similarity > 0.8) // High threshold for confidence
      .sort((a: any, b: any) => b.similarity - a.similarity);

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
      archivedTopics: number;
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
          updatedTopics: 0,
          archivedTopics: 0
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
          updatedTopics: 0,
          archivedTopics: 0
        }
      };
    }

    console.log(`🔍 [KNOWLEDGE ENGINE] Found ${clusters.length} clusters`);

    // Smart topic management - handle existing topics intelligently
    const results = await this.manageTopicsIntelligently(organizationId, clusters);

    console.log(`✨ [KNOWLEDGE ENGINE] Topic discovery complete: ${results.newTopics} new, ${results.updatedTopics} updated`);

    return {
      topics: results.topics,
      stats: {
        totalKnowledgePoints: knowledgePoints.length,
        clustersFound: clusters.length,
        newTopics: results.newTopics,
        updatedTopics: results.updatedTopics,
        archivedTopics: results.archivedTopics
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
   * Intelligently manage topics during rediscovery
   * - Compare new clusters with existing topics using centroid similarity
   * - Update existing topics when clusters are similar
   * - Create new topics for genuinely new clusters  
   * - Archive topics that are no longer relevant
   */
  private async manageTopicsIntelligently(organizationId: string, newClusters: any[]): Promise<{
    topics: any[];
    newTopics: number;
    updatedTopics: number;
    archivedTopics: number;
  }> {
    console.log(`🧠 [KNOWLEDGE ENGINE] Starting intelligent topic management for ${newClusters.length} clusters`);

    // Get all existing topics
    const { data: existingTopics } = await this.supabase
      .from('discovered_topics')
      .select('*')
      .eq('organization_id', organizationId);

    const topics = existingTopics || [];
    console.log(`📊 [KNOWLEDGE ENGINE] Found ${topics.length} existing topics to compare against`);

    // Track results
    const results = {
      topics: [],
      newTopics: 0,
      updatedTopics: 0,
      archivedTopics: 0
    };

    // Parse existing topic centroids for comparison
    const existingCentroids = topics.map((topic: any) => ({
      topic,
      centroid: this.parseClusterCentroid(topic.cluster_centroid)
    })).filter((item: any) => item.centroid !== null);

    const usedTopicIds = new Set<string>();

    // Process each new cluster
    for (const cluster of newClusters) {
      let bestMatch = null;
      let bestSimilarity = 0;

      // Find the most similar existing topic using centroid cosine similarity
      for (const existingItem of existingCentroids) {
        if (usedTopicIds.has(existingItem.topic.id)) continue; // Already matched

        const similarity = this.cosineSimilarity(cluster.centroid, existingItem.centroid);
        if (similarity > bestSimilarity && similarity > 0.7) { // 70% similarity threshold
          bestSimilarity = similarity;
          bestMatch = existingItem;
        }
      }

      if (bestMatch) {
        // Update existing topic
        console.log(`🔄 [KNOWLEDGE ENGINE] Updating existing topic "${bestMatch.topic.name}" (similarity: ${(bestSimilarity * 100).toFixed(1)}%)`);
        
        const updatedTopic = await this.updateExistingTopic(bestMatch.topic, cluster);
        if (updatedTopic) {
          (results.topics as any[]).push({ ...updatedTopic, isNew: false });
          results.updatedTopics++;
          usedTopicIds.add(bestMatch.topic.id);
        }
      } else {
        // Create new topic
        console.log(`✨ [KNOWLEDGE ENGINE] Creating new topic for unmatched cluster`);
        
        const newTopic = await this.createNewTopicFromCluster(organizationId, cluster);
        if (newTopic) {
          (results.topics as any[]).push({ ...newTopic, isNew: true });
          results.newTopics++;
        }
      }
    }

    // Archive topics that were not matched (no longer relevant)
    const unmatchedTopics = topics.filter((topic: any) => !usedTopicIds.has(topic.id));
    for (const topic of unmatchedTopics) {
      console.log(`🗄️ [KNOWLEDGE ENGINE] Archiving outdated topic: "${topic.name}"`);
      await this.archiveOutdatedTopic(topic.id);
      results.archivedTopics++;
    }

    console.log(`🎯 [KNOWLEDGE ENGINE] Topic management complete: ${results.newTopics} new, ${results.updatedTopics} updated, ${results.archivedTopics} archived`);
    return results;
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
   * Generate meaningful topic name using enhanced LLM analysis of cluster content
   */
  private async generateTopicNameFromCluster(cluster: any): Promise<string | null> {
    try {
      // Step 1: Extract comprehensive themes from ALL cluster points
      const themes = await this.extractClusterThemes(cluster);
      
      // Step 2: Generate topic name based on comprehensive analysis
      const topicName = await this.generateTopicNameFromThemes(themes, cluster);
      
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
   * Extract comprehensive themes from all points in a cluster
   */
  private async extractClusterThemes(cluster: any): Promise<string> {
    try {
      // Analyze ALL points, but in batches to avoid token limits
      const allSummaries = cluster.points.map((point: any) => point.summary);
      const allKeywords = cluster.points.flatMap((point: any) => point.keywords || []);
      
      // Get platform and source type distribution
      const platformStats = this.getClusterStats(cluster);
      
      // Combine key information for thematic analysis
      const keyContent = allSummaries.slice(0, 15).join('. '); // More content for better analysis
      const topKeywords = [...new Set(allKeywords)].slice(0, 10).join(', ');
      
      const prompt = `Analyze this cluster of ${cluster.size} knowledge points and identify the main themes.

Key Content Samples:
${keyContent}

Common Keywords: ${topKeywords}

Platform Distribution: ${platformStats}

Task: Identify the 2-3 most significant themes that unite these knowledge points. Focus on:
- Technical topics, tools, or technologies
- Business processes or workflows  
- Problem domains or solution areas
- Feature areas or system components

Respond with just the key themes (not a topic name), separated by semicolons:`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 80,
        temperature: 0.2,
      });

      return response.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      console.error('❌ [KNOWLEDGE ENGINE] Theme extraction failed:', error);
      return '';
    }
  }

  /**
   * Generate topic name from extracted themes
   */
  private async generateTopicNameFromThemes(themes: string, cluster: any): Promise<string | null> {
    if (!themes) return null;

    try {
      const prompt = `Based on these identified themes from a cluster of ${cluster.size} knowledge points, create a concise topic name.

Identified Themes: ${themes}

Create a topic name that:
- Is 2-4 words maximum
- Captures the OVERARCHING theme that connects all these points
- Is specific and technical when appropriate
- Avoids generic terms like "Discussion", "General", "Various"
- Focuses on the bigger picture, not individual details

Examples of good topic names:
- "API Authentication"
- "React Performance"  
- "Database Migration"
- "CI/CD Pipeline"
- "Error Handling"

Topic Name:`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 15,
        temperature: 0.1, // Very low for consistency
      });

      return response.choices[0]?.message?.content?.trim() || null;
    } catch (error) {
      console.error('❌ [KNOWLEDGE ENGINE] Topic name generation failed:', error);
      return null;
    }
  }

  /**
   * Get cluster statistics for better context
   */
  private getClusterStats(cluster: any): string {
    const platforms = cluster.points.map((p: any) => p.knowledge_sources?.platform).filter(Boolean);
    const sourceTypes = cluster.points.map((p: any) => p.knowledge_sources?.source_type).filter(Boolean);
    
    const platformCounts = platforms.reduce((acc: Record<string, number>, platform: string) => {
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {});
    
    const sourceCounts = sourceTypes.reduce((acc: Record<string, number>, type: string) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    const platformSummary = Object.entries(platformCounts)
      .map(([platform, count]) => `${platform}: ${count}`)
      .join(', ');
    
    const sourceSummary = Object.entries(sourceCounts)
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ');
    
    return `Platforms: ${platformSummary}; Sources: ${sourceSummary}`;
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
   * Enhanced contextual processing for Slack messages with conversation context
   */
  async processSlackMessageWithContext(source: KnowledgeSource & {
    channelId?: string;
    threadTs?: string;
    timestamp: string;
  }  ): Promise<{
    contextualContent: string;
    shouldIndex: boolean;
    contextSources: string[];
    relatedQuestions: string[];
  }> {
    try {
      console.log(`🧠 [CONTEXTUAL] Processing message with context: ${source.externalId}`);

      // 1. Get conversation context
      const context = await this.gatherConversationContext(
        source.channelId,
        source.threadTs,
        source.platformCreatedAt
      );

      // 2. Use LLM to enhance content with context
      const enhancement = await this.enhanceMessageWithContext(
        source.content,
        context.recentMessages,
        context.threadMessages
      );

      if (!enhancement.shouldIndex) {
        console.log(`⏭️ [CONTEXTUAL] Skipping message (not substantial): ${source.externalId}`);
        return {
          contextualContent: source.content,
          shouldIndex: false,
          contextSources: [],
          relatedQuestions: []
        };
      }

      console.log(`✅ [CONTEXTUAL] Enhanced message: "${source.content}" → "${enhancement.contextualContent}"`);
      if (enhancement.relatedQuestions.length > 0) {
        console.log(`🔗 [CONTEXTUAL] Found related questions: ${enhancement.relatedQuestions.join(', ')}`);
      }
      
      return {
        contextualContent: enhancement.contextualContent,
        shouldIndex: true,
        contextSources: context.sourceIds,
        relatedQuestions: enhancement.relatedQuestions
      };

    } catch (error) {
      console.error(`❌ [CONTEXTUAL] Context enhancement failed for ${source.externalId}:`, error);
      console.log(`🔧 [CONTEXTUAL] Falling back to safety filter only for: "${source.content}"`);
      
      // Apply safety filter even in fallback
      if (this.isObviousQuestion(source.content)) {
        console.log(`⚠️ [CONTEXTUAL] Safety filter caught question in fallback: ${source.externalId}`);
        return {
          contextualContent: source.content,
          shouldIndex: false,
          contextSources: [],
          relatedQuestions: []
        };
      }
      
      // Fallback to original content
      return {
        contextualContent: source.content,
        shouldIndex: true,
        contextSources: [],
        relatedQuestions: []
      };
    }
  }

  /**
   * Gather conversation context from channel history and thread
   */
  private async gatherConversationContext(
    channelId?: string,
    threadTs?: string,
    messageTimestamp?: string
  ): Promise<{
    recentMessages: Array<{author: string; content: string; timestamp: string}>;
    threadMessages: Array<{author: string; content: string; timestamp: string}>;
    sourceIds: string[];
  }> {
    const context = {
      recentMessages: [] as Array<{author: string; content: string; timestamp: string}>,
      threadMessages: [] as Array<{author: string; content: string; timestamp: string}>,
      sourceIds: [] as string[]
    };

    try {
      const beforeTimestamp = messageTimestamp || new Date().toISOString();

      // Get recent channel messages for context
      if (channelId) {
        const { data: channelContext } = await this.supabase
          .rpc('get_channel_context', {
            channel_id_param: channelId,
            before_timestamp: beforeTimestamp,
            message_limit: 8
          });

        if (channelContext) {
          context.recentMessages = channelContext.map((msg: any) => ({
            author: msg.author_external_id || 'unknown',
            content: msg.content,
            timestamp: msg.platform_created_at
          }));
          context.sourceIds.push(...channelContext.map((msg: any) => msg.external_id));
        }
      }

      // Get thread messages if this is part of a thread
      if (threadTs && channelId) {
        const { data: threadContext } = await this.supabase
          .rpc('get_thread_context', {
            thread_ts_param: threadTs,
            channel_id_param: channelId
          });

        if (threadContext) {
          context.threadMessages = threadContext.map((msg: any) => ({
            author: msg.author_external_id || 'unknown',
            content: msg.content,
            timestamp: msg.platform_created_at
          }));
          context.sourceIds.push(...threadContext.map((msg: any) => msg.external_id));
        }
      }

    } catch (error) {
      console.error('❌ [CONTEXTUAL] Failed to gather conversation context:', error);
    }

    return context;
  }

  /**
   * Use LLM to enhance message content with conversation context and question-answer linking
   */
  private async enhanceMessageWithContext(
    currentMessage: string,
    recentMessages: Array<{author: string; content: string; timestamp: string}>,
    threadMessages: Array<{author: string; content: string; timestamp: string}>
  ): Promise<{
    contextualContent: string;
    shouldIndex: boolean;
    referencedTopics: string[];
    relatedQuestions: string[];
  }> {
    try {
      // Build context for the LLM
      const recentContext = recentMessages
        .slice(0, 6) // Limit to prevent token overflow
        .map(msg => `${msg.author}: ${msg.content}`)
        .join('\n');

      const threadContext = threadMessages.length > 0 
        ? threadMessages.map(msg => `${msg.author}: ${msg.content}`).join('\n')
        : '';

      const prompt = `You are analyzing a Slack message to extract meaningful knowledge for a workplace knowledge discovery system.

${threadContext ? `Thread Context:\n${threadContext}\n\n` : ''}${recentContext ? `Recent Channel Messages:\n${recentContext}\n\n` : ''}Current Message: "${currentMessage}"

Your task is to determine if this message contains VALUABLE KNOWLEDGE worth indexing.

ONLY EXTRACT knowledge from messages that:
- Provide solutions, answers, or explanations
- Share factual information or procedures
- Describe how something works
- Offer to help with specific technical tasks
- State definitive facts or status updates

ALWAYS SKIP these message types:
- Pure questions asking for help (what/how/where/when/why questions)
- Requests for assistance ("can someone help", "@user help me")
- Social greetings ("hello", "thanks", "ok")
- Simple acknowledgments
- Messages asking someone to do something ("@user say something")

CRITICAL: If the message is asking a question or requesting help, respond with "SKIP" - do NOT try to extract facts from it.

RESPONSE FORMAT:
If substantial knowledge exists, respond in JSON format:
{
  "knowledge": "The enhanced factual knowledge",
  "relatedQuestions": ["question1", "question2"]
}

If no substantial knowledge, respond: "SKIP"

Examples:

GOOD - Extract these:
Input: "You can find it at https://docs.example.com"
Output: {"knowledge": "The project documentation is available at https://docs.example.com", "relatedQuestions": []}

Input: "The fix is to restart the Redis service"
Output: {"knowledge": "To fix cache timeout issues, restart the Redis service", "relatedQuestions": []}

Input: "I can set us up with Next.js"
Output: {"knowledge": "Next.js setup is available for the project", "relatedQuestions": []}

BAD - Skip these:
Input: "@user what do I need to do to test the slack bot locally"
Output: "SKIP"

Input: "@user say something"
Output: "SKIP"

Input: "hello"
Output: "SKIP"

Input: "where can I find the documentation?"
Output: "SKIP"

Input: "how do I run this?"
Output: "SKIP"

Respond with either the JSON or "SKIP":`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.1, // Low temperature for consistent extraction
      });

      const result = response.choices[0]?.message?.content?.trim();
      
      if (!result || result === 'SKIP') {
        return {
          contextualContent: currentMessage,
          shouldIndex: false,
          referencedTopics: [],
          relatedQuestions: []
        };
      }

      // Try to parse JSON response
      try {
        const parsed = JSON.parse(result);
        if (parsed.knowledge) {
          return {
            contextualContent: parsed.knowledge,
            shouldIndex: true,
            referencedTopics: [], // Could be enhanced later
            relatedQuestions: parsed.relatedQuestions || []
          };
        }
      } catch (parseError) {
        console.warn('❌ [CONTEXTUAL] Failed to parse JSON response, using as-is:', parseError);
      }

      // Fallback to treating result as plain text (backward compatibility)
      return {
        contextualContent: result,
        shouldIndex: true,
        referencedTopics: [],
        relatedQuestions: []
      };

    } catch (error) {
      console.error('❌ [CONTEXTUAL] LLM enhancement failed:', error);
      return {
        contextualContent: currentMessage,
        shouldIndex: true,
        referencedTopics: [],
        relatedQuestions: []
      };
    }
  }

  /**
   * Safety check to catch obvious questions that slipped through LLM filtering
   */
  private isObviousQuestion(content: string): boolean {
    const questionPatterns = [
      // Direct questions with question marks
      /^(what|how|where|when|why|can|should|could|would|do|does|is|are)\s+.*\?$/i,
      // Questions without question marks but with question words + help/need/find patterns
      /(what|how|where|when|why|can|should|could|would).+(do|does|need|find|get|help|know)/i,
      // @mentions with question words
      /@[A-Z0-9]+.*?(what|how|where|when|why|can|should|could|would)/i,
      // Simple commands/requests to users
      /@[A-Z0-9]+\s+(say|tell|help|show|explain)/i,
      // @mentions followed by simple words
      /@[A-Z0-9]+>\s+(hello|hi|hey|say)/i,
      // Help requests
      /help.*?(with|me|please)/i,
      /anyone.*?(know|help)/i,
      // Simple greetings and social
      /^(hello|hi|hey|thanks|thank you|ok|okay)$/i
    ];

    for (const pattern of questionPatterns) {
      if (pattern.test(content.trim())) {
        return true;
      }
    }

    return false;
  }

  private async processContentWithAI(
    content: string, 
    title?: string, 
    contextualContent?: string,
    relatedQuestions?: string[]
  ): Promise<ProcessedKnowledge & { contextualSummary?: string }> {
    // Build embedding text with contextual content and related questions
    let embeddingText = contextualContent || (title ? `${title}\n\n${content}` : content);
    
    // Include related questions in the embedding to improve searchability
    if (relatedQuestions && relatedQuestions.length > 0) {
      const questionsText = relatedQuestions.join(' ');
      embeddingText = `${embeddingText}\n\nRelated questions: ${questionsText}`;
    }
    
    const summaryText = title ? `${title}\n\n${content}` : content;

    // Generate embedding from contextually enhanced content with questions
    const embedding = await this.generateEmbedding(embeddingText);

    // Extract summary and keywords using original content for consistency
    const summary = await this.generateSummary(summaryText);
    const contextualSummary = contextualContent ? await this.generateSummary(contextualContent) : undefined;
    const keywords = await this.extractKeywords(embeddingText); // Use contextual content for better keywords
    
    // Calculate quality metrics on contextual content
    const qualityScore = this.calculateQualityScore(embeddingText, keywords);
    const relevanceScore = this.calculateRelevanceScore(embeddingText);

    return {
      sourceId: '', // Will be set by caller
      summary,
      contextualSummary,
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

  /**
   * Parse cluster centroid from database string format
   */
  private parseClusterCentroid(centroidStr: string): number[] | null {
    try {
      if (!centroidStr) return null;
      
      // Remove brackets and parse as array
      const cleanStr = centroidStr.replace(/^\[|\]$/g, '');
      return cleanStr.split(',').map(num => parseFloat(num.trim()));
    } catch (error) {
      console.warn('Failed to parse cluster centroid:', error);
      return null;
    }
  }

  /**
   * Update an existing topic with new cluster data
   */
  private async updateExistingTopic(existingTopic: any, newCluster: any): Promise<any | null> {
    try {
      // Update the topic with new cluster information
      const { data: updatedTopic, error } = await this.supabase
        .from('discovered_topics')
        .update({
          cluster_centroid: `[${newCluster.centroid.join(',')}]`,
          knowledge_point_count: newCluster.size,
          confidence_score: this.calculateTopicConfidence(newCluster),
          last_updated: new Date().toISOString()
        })
        .eq('id', existingTopic.id)
        .select()
        .single();

      if (error) {
        console.error('Failed to update existing topic:', error);
        return null;
      }

      // Update knowledge point memberships
      const pointIds = newCluster.points?.map((p: any) => p.id) || [];
      await this.linkKnowledgePointsToTopic(existingTopic.id, pointIds);

      return updatedTopic;
    } catch (error) {
      console.error('Error updating existing topic:', error);
      return null;
    }
  }

  /**
   * Create a completely new topic from a cluster
   */
  private async createNewTopicFromCluster(organizationId: string, cluster: any): Promise<any | null> {
    try {
      // Generate intelligent topic name using LLM
      const topicName = await this.generateTopicNameFromCluster(cluster);
      
      if (!topicName) {
        console.log('⚠️ [KNOWLEDGE ENGINE] Failed to generate topic name for cluster');
        return null;
      }

      // Create new topic
      const { data: newTopic, error } = await this.supabase
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

      if (error) {
        console.error('Failed to create new topic:', error);
        return null;
      }

      // Link knowledge points to the new topic
      const pointIds = cluster.points?.map((p: any) => p.id) || [];
      await this.linkKnowledgePointsToTopic(newTopic.id, pointIds);

      return newTopic;
    } catch (error) {
      console.error('Error creating new topic:', error);
      return null;
    }
  }

  /**
   * Archive an outdated topic (mark as inactive rather than delete)
   */
  private async archiveOutdatedTopic(topicId: string): Promise<void> {
    try {
      // Delete the topic completely for now (could be changed to archiving)
      await this.supabase
        .from('discovered_topics')
        .delete()
        .eq('id', topicId);

      // Remove knowledge point memberships for archived topic
      await this.supabase
        .from('knowledge_topic_memberships')
        .delete()
        .eq('topic_id', topicId);

    } catch (error) {
      console.error('Error archiving topic:', error);
    }
  }

  /**
   * Link knowledge points to a topic by creating membership records
   */
  private async linkKnowledgePointsToTopic(topicId: string, knowledgePointIds: string[]): Promise<void> {
    if (!knowledgePointIds.length) {
      console.log('⚠️ [KNOWLEDGE ENGINE] No knowledge points to link to topic');
      return;
    }

    try {
      console.log(`🔗 [KNOWLEDGE ENGINE] Linking ${knowledgePointIds.length} knowledge points to topic ${topicId}`);

      // First, remove existing memberships for this topic
      await this.supabase
        .from('knowledge_topic_memberships')
        .delete()
        .eq('topic_id', topicId);

      // Create new memberships
      const memberships = knowledgePointIds.map(kpId => ({
        topic_id: topicId,
        knowledge_point_id: kpId,
        similarity_score: 0.8 // Default similarity, could be made more sophisticated
      }));

      const { error } = await this.supabase
        .from('knowledge_topic_memberships')
        .insert(memberships);

      if (error) {
        console.error('❌ [KNOWLEDGE ENGINE] Failed to create topic memberships:', error);
      } else {
        console.log(`✅ [KNOWLEDGE ENGINE] Successfully linked ${knowledgePointIds.length} knowledge points to topic`);
      }

    } catch (error) {
      console.error('❌ [KNOWLEDGE ENGINE] Error linking knowledge points to topic:', error);
    }
  }
}