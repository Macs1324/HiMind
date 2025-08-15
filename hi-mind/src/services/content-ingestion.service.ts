import { getSupabaseClient } from "@/lib/database";
import { EnhancedTopicExtractor } from "@/core/processing/nlp/enhanced-topic-extractor";
import { ProcessingErrorHandler } from "./processing-error-handler";

export interface ContentSource {
  type: 'slack_message' | 'slack_thread' | 'github_pr' | 'github_issue' | 'github_commit';
  externalId: string;
  externalUrl?: string;
  title?: string;
  body: string;
  authorExternalId: string;
  authorPlatform: 'slack' | 'github';
  platformCreatedAt: string;
  rawContent: Record<string, any>;
  parentExternalId?: string;
}

export interface ProcessingResult {
  contentArtifactId: string;
  knowledgeStatements: KnowledgeStatement[];
  topics: Topic[];
  processingMetadata: Record<string, any>;
}

export interface KnowledgeStatement {
  headline: string;
  content: string;
  statementType: 'explanation' | 'decision' | 'solution' | 'best_practice' | 'warning' | 'tip' | 'example' | 'reference';
  keywords: string[];
  confidence: number;
}

export interface Topic {
  name: string;
  canonicalName: string;
  description?: string;
  keywords: string[];
  relevanceScore: number;
}

export class ContentIngestionService {
  private supabase = getSupabaseClient(true);
  private topicExtractor = new EnhancedTopicExtractor();
  private errorHandler = new ProcessingErrorHandler();

  async ingestContent(source: ContentSource): Promise<ProcessingResult> {
    console.log(`🔄 [CONTENT INGESTION] Processing ${source.type}: ${source.externalId}`);

    try {
      // Get organization ID
      const { data: organization } = await this.supabase
        .from('organizations')
        .select('id')
        .limit(1)
        .single();

      if (!organization) {
        throw new Error('No organization found');
      }

      // Check if content already exists
      const { data: existingArtifact } = await this.supabase
        .from('content_artifacts')
        .select('id, is_processed')
        .eq('organization_id', organization.id)
        .eq('source_type', source.type)
        .eq('external_id', source.externalId)
        .single();

      if (existingArtifact?.is_processed) {
        console.log(`⏭️ [CONTENT INGESTION] Content already processed: ${source.externalId}`);
        return this.getExistingProcessingResult(existingArtifact.id);
      }

      // Get or create author person
      const authorPersonId = await this.resolveAuthor(source.authorExternalId, source.authorPlatform, organization.id);

      // Create or update content artifact
      const contentArtifactId = await this.createContentArtifact(source, organization.id, authorPersonId);

      // Process content through enhanced topic extraction
      const extractionResult = await this.processContentWithTopicExtraction(source.body, source.title);

      // Save knowledge statements
      const knowledgeStatements = await this.saveKnowledgeStatements(
        extractionResult.statements,
        organization.id,
        contentArtifactId,
        authorPersonId
      );

      // Save and link topics
      const topics = await this.saveTopics(
        extractionResult.topics,
        organization.id,
        knowledgeStatements
      );

      // Update expertise signals
      await this.updateExpertiseSignals(authorPersonId, topics, organization.id, contentArtifactId);

      // Mark content as processed
      await this.markContentProcessed(contentArtifactId, {
        statements_created: knowledgeStatements.length,
        topics_created: topics.length,
        processing_time: Date.now(),
        extraction_method: 'enhanced_nlp'
      });

      console.log(`✅ [CONTENT INGESTION] Processed ${source.type}: ${knowledgeStatements.length} statements, ${topics.length} topics`);

      return {
        contentArtifactId,
        knowledgeStatements,
        topics,
        processingMetadata: {
          statementsCreated: knowledgeStatements.length,
          topicsCreated: topics.length,
          processingTime: Date.now()
        }
      };

    } catch (error) {
      // Log error with context
      await this.errorHandler.logError(
        source.externalId,
        source.type,
        error instanceof Error ? error : String(error),
        {
          source_external_id: source.externalId,
          source_type: source.type,
          author_external_id: source.authorExternalId,
          content_length: source.body.length,
          processing_step: 'content_ingestion'
        },
        'high'
      );
      
      console.error(`❌ [CONTENT INGESTION] Failed to process ${source.type}:`, error);
      throw error;
    }
  }

  private async resolveAuthor(externalId: string, platform: 'slack' | 'github', organizationId: string): Promise<string | null> {
    // Try to find existing person by external identity
    const { data: identity } = await this.supabase
      .from('external_identities')
      .select('person_id')
      .eq('platform', platform)
      .eq('external_id', externalId)
      .single();

    if (identity?.person_id) {
      return identity.person_id;
    }

    // If no person found, return null for now
    // In production, you might want to create placeholder persons
    console.log(`👤 [CONTENT INGESTION] No person found for ${platform}:${externalId}`);
    return null;
  }

  private async createContentArtifact(
    source: ContentSource, 
    organizationId: string, 
    authorPersonId: string | null
  ): Promise<string> {
    const artifactData = {
      organization_id: organizationId,
      source_type: source.type,
      external_id: source.externalId,
      external_url: source.externalUrl,
      title: source.title,
      body: source.body,
      raw_content: source.rawContent,
      author_person_id: authorPersonId,
      author_external_id: source.authorExternalId,
      platform_created_at: source.platformCreatedAt,
      is_processed: false,
      processing_metadata: { started_at: new Date().toISOString() }
    };

    // Handle parent artifact for threads/replies
    if (source.parentExternalId) {
      const { data: parentArtifact } = await this.supabase
        .from('content_artifacts')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('external_id', source.parentExternalId)
        .single();

      if (parentArtifact) {
        artifactData['parent_artifact_id'] = parentArtifact.id;
      }
    }

    const { data, error } = await this.supabase
      .from('content_artifacts')
      .upsert(artifactData, { onConflict: 'organization_id,source_type,external_id' })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  private async processContentWithTopicExtraction(body: string, title?: string): Promise<{
    statements: KnowledgeStatement[];
    topics: Topic[];
  }> {
    const fullText = title ? `${title}\n\n${body}` : body;
    
    // Use the simple topic extraction system
    const result = await this.topicExtractor.extractTopicsAndStatements(fullText);

    const statements: KnowledgeStatement[] = result.statements.map(stmt => ({
      headline: stmt.headline,
      content: stmt.content,
      statementType: this.mapStatementType(stmt.type),
      keywords: stmt.keywords || [],
      confidence: stmt.confidence || 0.7
    }));

    const topics: Topic[] = result.topics.map(topic => ({
      name: topic.name,
      canonicalName: topic.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      description: `${topic.category} topic with keywords: ${topic.keywords.join(', ')}`,
      keywords: topic.keywords || [],
      relevanceScore: topic.confidence || 0.5
    }));

    return { statements, topics };
  }

  private mapStatementType(type: string): 'explanation' | 'decision' | 'solution' | 'best_practice' | 'warning' | 'tip' | 'example' | 'reference' {
    const typeMap: Record<string, any> = {
      'explanation': 'explanation',
      'decision': 'decision',
      'solution': 'solution',
      'best_practice': 'best_practice',
      'warning': 'warning',
      'tip': 'tip',
      'example': 'example',
      'reference': 'reference'
    };
    return typeMap[type] || 'explanation';
  }

  private async saveKnowledgeStatements(
    statements: KnowledgeStatement[],
    organizationId: string,
    sourceArtifactId: string,
    authorPersonId: string | null
  ): Promise<KnowledgeStatement[]> {
    const savedStatements: KnowledgeStatement[] = [];

    for (const statement of statements) {
      const { data, error } = await this.supabase
        .from('knowledge_statements')
        .insert({
          organization_id: organizationId,
          headline: statement.headline,
          content: statement.content,
          statement_type: statement.statementType,
          source_artifact_id: sourceArtifactId,
          author_person_id: authorPersonId,
          keywords: statement.keywords,
          confidence_score: statement.confidence,
          is_public: true
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to save knowledge statement:', error);
        continue;
      }

      savedStatements.push({ ...statement, id: data.id });
    }

    return savedStatements;
  }

  private async saveTopics(
    topics: Topic[],
    organizationId: string,
    knowledgeStatements: KnowledgeStatement[]
  ): Promise<Topic[]> {
    const savedTopics: Topic[] = [];

    for (const topic of topics) {
      // Check if topic already exists
      let { data: existingTopic } = await this.supabase
        .from('topics')
        .select('id, name')
        .eq('organization_id', organizationId)
        .eq('canonical_name', topic.canonicalName)
        .single();

      let topicId: string;

      if (existingTopic) {
        topicId = existingTopic.id;
        savedTopics.push({ ...topic, id: topicId });
      } else {
        // Create new topic
        const { data: newTopic, error } = await this.supabase
          .from('topics')
          .insert({
            organization_id: organizationId,
            name: topic.name,
            canonical_name: topic.canonicalName,
            description: topic.description,
            keyword_signatures: topic.keywords,
            emergence_strength: topic.relevanceScore,
            is_approved: true
          })
          .select('id')
          .single();

        if (error) {
          console.error('Failed to save topic:', error);
          continue;
        }

        topicId = newTopic.id;
        savedTopics.push({ ...topic, id: topicId });
      }

      // Link statements to topics
      for (const statement of knowledgeStatements) {
        await this.supabase
          .from('statement_topics')
          .upsert({
            statement_id: statement.id,
            topic_id: topicId,
            relevance_score: topic.relevanceScore,
            extraction_method: 'auto'
          }, { onConflict: 'statement_id,topic_id' });
      }
    }

    return savedTopics;
  }

  private async updateExpertiseSignals(
    authorPersonId: string | null,
    topics: Topic[],
    organizationId: string,
    sourceArtifactId: string
  ): Promise<void> {
    if (!authorPersonId) return;

    for (const topic of topics) {
      await this.supabase
        .from('expertise_signals')
        .insert({
          organization_id: organizationId,
          person_id: authorPersonId,
          topic_id: topic.id,
          signal_type: 'authored_statement',
          strength: topic.relevanceScore,
          confidence: 0.7,
          source_artifact_id: sourceArtifactId,
          occurred_at: new Date().toISOString()
        });
    }
  }

  private async markContentProcessed(contentArtifactId: string, metadata: Record<string, any>): Promise<void> {
    await this.supabase
      .from('content_artifacts')
      .update({
        is_processed: true,
        processing_metadata: metadata
      })
      .eq('id', contentArtifactId);
  }

  private async getExistingProcessingResult(contentArtifactId: string): Promise<ProcessingResult> {
    // Fetch existing processed content
    const { data: statements } = await this.supabase
      .from('knowledge_statements')
      .select('*')
      .eq('source_artifact_id', contentArtifactId);

    const { data: metadata } = await this.supabase
      .from('content_artifacts')
      .select('processing_metadata')
      .eq('id', contentArtifactId)
      .single();

    return {
      contentArtifactId,
      knowledgeStatements: statements || [],
      topics: [], // Would need to fetch via statement_topics join
      processingMetadata: metadata?.processing_metadata || {}
    };
  }
}