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

    // 1. Store the raw knowledge source
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
   * Search for knowledge points and experts based on a query
   */
  async searchKnowledge(query: string, organizationId: string): Promise<QueryResult> {
    console.log(`🔍 [KNOWLEDGE ENGINE] Searching: "${query}"`);

    // 1. Generate embedding for the query
    const queryEmbedding = await this.generateEmbedding(query);

    // 2. Log the search query
    await this.logSearchQuery(query, queryEmbedding, organizationId);

    // 3. Find similar knowledge points
    const { data: knowledgeMatches } = await this.supabase
      .rpc('find_similar_knowledge', {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        org_id: organizationId,
        similarity_threshold: 0.1,
        result_limit: 10
      });

    // 4. Find relevant topics and their experts
    const topicMatches = await this.findRelevantTopics(queryEmbedding, organizationId);
    const suggestedExperts = await this.findTopicExperts(topicMatches, 5);

    const result: QueryResult = {
      query,
      knowledgeMatches: knowledgeMatches || [],
      suggestedExperts,
      topicMatches: topicMatches.map(t => t.name)
    };

    console.log(`📊 [KNOWLEDGE ENGINE] Found ${result.knowledgeMatches.length} knowledge matches, ${result.suggestedExperts.length} expert suggestions`);
    return result;
  }

  /**
   * Discover new topics from knowledge point clusters
   */
  async discoverTopicClusters(organizationId: string): Promise<void> {
    console.log(`🎯 [KNOWLEDGE ENGINE] Discovering topic clusters for org: ${organizationId}`);

    // This is where the "centers of mass" magic happens
    // Get all knowledge points with their embeddings
    const { data: knowledgePoints } = await this.supabase
      .from('knowledge_points')
      .select(`
        id,
        embedding,
        summary,
        keywords,
        knowledge_sources!inner(organization_id)
      `)
      .eq('knowledge_sources.organization_id', organizationId);

    if (!knowledgePoints || knowledgePoints.length < 5) {
      console.log('Not enough knowledge points for clustering');
      return;
    }

    // Use K-means clustering on embeddings to find topic centers
    const clusters = await this.performEmbeddingClustering(knowledgePoints);

    // Create/update discovered topics
    for (const cluster of clusters) {
      await this.createOrUpdateTopic(organizationId, cluster);
    }

    console.log(`✨ [KNOWLEDGE ENGINE] Discovered ${clusters.length} topic clusters`);
  }

  // =========================
  // Private Helper Methods
  // =========================

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
      .map(topic => ({
        ...topic,
        similarity: topic.cluster_centroid ? this.cosineSimilarity(queryEmbedding, topic.cluster_centroid) : 0
      }))
      .filter(topic => topic.similarity > 0.6)
      .sort((a, b) => b.similarity - a.similarity)
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

  private async performEmbeddingClustering(knowledgePoints: any[]): Promise<any[]> {
    // For MVP, use simple clustering based on similarity thresholds
    // In production, this would use proper K-means clustering
    const clusters: any[] = [];
    const processed = new Set<string>();

    for (const point of knowledgePoints) {
      if (processed.has(point.id)) continue;

      const cluster = {
        centroid: point.embedding,
        members: [point],
        name: this.generateTopicName(point.summary, point.keywords),
        description: point.summary
      };

      // Find similar points
      for (const other of knowledgePoints) {
        if (other.id === point.id || processed.has(other.id)) continue;
        
        const similarity = this.cosineSimilarity(point.embedding, other.embedding);
        if (similarity > 0.8) {
          cluster.members.push(other);
          processed.add(other.id);
        }
      }

      if (cluster.members.length >= 3) { // Only create topics with multiple knowledge points
        clusters.push(cluster);
      }
      
      processed.add(point.id);
    }

    return clusters;
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