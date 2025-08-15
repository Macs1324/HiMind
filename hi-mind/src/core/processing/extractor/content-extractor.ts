// Content Extractor - Main processing engine for transforming raw content into structured knowledge

import type { 
  RawContent, 
  ProcessedContent, 
  KnowledgeStatement,
  ExpertiseSignal,
  ProcessingResult,
  ProcessingError,
  NLPService 
} from '@/core/types/processing'
import type { Database } from '@/types/database'
import { HiMindNLPService } from '../nlp/nlp-service'
import { DatabaseManager } from '@/lib/database'
import { TopicClusteringService } from '../topics/topic-clustering-service'

export class ContentExtractor {
  private nlpService: NLPService
  private db: DatabaseManager
  private topicClusteringService: TopicClusteringService | null = null
  private config: {
    minContentLength: number
    maxContentLength: number
    minQualityScore: number
    processingVersion: string
    enhancedTopicExtraction: boolean
  }

  constructor(
    nlpService: NLPService,
    db: DatabaseManager,
    config?: Partial<ContentExtractor['config']>
  ) {
    this.nlpService = nlpService
    this.db = db
    this.config = {
      minContentLength: 10,
      maxContentLength: 10000,
      minQualityScore: 0.3,
      processingVersion: '1.1.0', // Updated for enhanced topic extraction
      enhancedTopicExtraction: true,
      ...config
    }
  }

  // ===========================
  // Main Processing Pipeline
  // ===========================

  async processContentArtifact(artifactId: string): Promise<ProcessingResult> {
    const startTime = Date.now()
    const warnings: string[] = []
    const errors: string[] = []

    try {
      // 1. Fetch the content artifact
      const artifact = await this.fetchContentArtifact(artifactId)
      if (!artifact) {
        throw new Error(`Content artifact not found: ${artifactId}`)
      }

      // 2. Validate content
      const validationResult = this.validateContent(artifact)
      if (!validationResult.isValid) {
        throw new Error(`Content validation failed: ${validationResult.reason}`)
      }
      warnings.push(...validationResult.warnings)

      // 3. Extract and process content
      const rawContent = this.extractRawContent(artifact)
      const processedContent = await this.processContent(rawContent)

      // 4. Detect topics (enhanced or standard)
      const topicDetection = this.config.enhancedTopicExtraction 
        ? await this.nlpService.detectTopicsEnhanced(processedContent)
        : await this.nlpService.detectTopics(processedContent)

      // 5. Create knowledge statement
      const knowledgeStatement = await this.createKnowledgeStatement(
        processedContent, 
        artifact
      )

      // 6. Record expertise signals
      const expertiseSignals = await this.recordExpertiseSignals(
        processedContent,
        knowledgeStatement,
        artifact
      )

      // 7. Process enhanced topic detection and clustering
      let topicClusteringResults = null
      if (this.config.enhancedTopicExtraction && 'candidateTopics' in topicDetection) {
        topicClusteringResults = await this.processTopicClustering(artifactId, topicDetection, artifact.organization_id)
      }

      // 7. Save to database
      await this.saveProcessingResults(
        artifact,
        processedContent,
        knowledgeStatement,
        expertiseSignals
      )

      // 8. Mark artifact as processed
      await this.db.content.markArtifactAsProcessed(artifactId, {
        version: this.config.processingVersion,
        processedAt: new Date().toISOString(),
        warnings,
        qualityScore: processedContent.quality.score
      })

      const processingTime = Date.now() - startTime

      return {
        success: true,
        artifactId,
        processedContent,
        knowledgeStatement,
        expertiseSignals,
        processingTimeMs: processingTime,
        warnings,
        errors,
        metrics: {
          contentQuality: processedContent.quality.score,
          topicConfidence: this.calculateAverageTopicConfidence(processedContent),
          expertiseSignalCount: expertiseSignals.length,
          processingVersion: this.config.processingVersion
        }
      }

    } catch (error) {
      const processingTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push(errorMessage)

      // Log error but don't throw - return failed result
      console.error(`Processing failed for artifact ${artifactId}:`, error)

      return {
        success: false,
        artifactId,
        expertiseSignals: [],
        processingTimeMs: processingTime,
        warnings,
        errors,
        metrics: {
          contentQuality: 0,
          topicConfidence: 0,
          expertiseSignalCount: 0,
          processingVersion: this.config.processingVersion
        }
      }
    }
  }

  // ===========================
  // Content Processing Steps
  // ===========================

  private async processContent(rawContent: RawContent): Promise<ProcessedContent> {
    // Clean and normalize text
    const cleanText = this.nlpService.cleanText(rawContent.content)
    
    // Generate headline
    const headline = await this.nlpService.extractHeadline(cleanText)
    
    // Analyze content
    const analysis = await this.nlpService.analyzeContent(cleanText)
    
    // Assess quality
    const quality = this.nlpService.assessQuality(rawContent, analysis)
    
    // Generate embedding
    const embedding = await this.nlpService.generateEmbedding(cleanText)
    
    // Extract context
    const context = this.extractContext(rawContent)
    
    // Topic detection is now handled in the main pipeline

    return {
      originalId: rawContent.id,
      platform: rawContent.platform,
      type: rawContent.type,
      cleanText,
      headline,
      title: rawContent.title,
      authorId: rawContent.author.id,
      authorDisplayName: rawContent.author.displayName || rawContent.author.username || 'Unknown',
      context,
      analysis,
      quality,
      embedding,
      processingMetadata: {
        version: this.config.processingVersion,
        processedAt: new Date().toISOString(),
        processingTimeMs: Date.now(),
        model: 'himind-nlp-v1',
        warnings: [],
        errors: []
      }
    }
  }

  private async createKnowledgeStatement(
    processedContent: ProcessedContent,
    artifact: Database['public']['Tables']['content_artifacts']['Row']
  ): Promise<KnowledgeStatement> {
    
    // Determine statement type based on content analysis
    const statementType = this.determineStatementType(processedContent.analysis)
    
    // Extract technical level
    const technicalLevel = this.determineTechnicalLevel(processedContent.analysis)
    
    // Generate search tokens (for full-text search)
    const searchTokens = this.generateSearchTokens(processedContent)
    
    return {
      headline: processedContent.headline,
      content: processedContent.cleanText,
      statementType,
      
      // Source attribution
      sourceArtifactId: artifact.id,
      authorPersonId: artifact.author_person_id || undefined,
      sourceUrl: artifact.external_url || undefined,
      relatedUrls: this.extractUrls(processedContent.cleanText),
      
      // Content analysis
      keywords: this.extractKeywords(processedContent),
      technicalLevel,
      confidence: processedContent.quality.confidence,
      qualityScore: processedContent.quality.score,
      
      // Embeddings and search
      contentVector: processedContent.embedding,
      searchTokens,
      
      // Topics and context
      detectedTopics: await this.nlpService.detectTopics(processedContent),
      context: {
        platform: processedContent.platform,
        source: processedContent.context.source,
        contentType: processedContent.analysis.contentType,
        technicalTerms: processedContent.analysis.technicalTerms,
        entities: processedContent.analysis.entities
      },
      
      // Processing metadata
      processingMetadata: processedContent.processingMetadata
    }
  }

  private async recordExpertiseSignals(
    processedContent: ProcessedContent,
    knowledgeStatement: KnowledgeStatement,
    artifact: Database['public']['Tables']['content_artifacts']['Row']
  ): Promise<ExpertiseSignal[]> {
    
    if (!artifact.author_person_id) {
      return [] // Can't record signals without identified author
    }

    const signals: ExpertiseSignal[] = []
    const topicIds = await this.resolveTopicIds(knowledgeStatement.detectedTopics)
    
    // Base authored statement signal
    signals.push({
      personId: artifact.author_person_id,
      topicIds,
      signalType: 'authored_statement',
      strength: this.calculateSignalStrength('authored_statement', processedContent),
      confidence: processedContent.quality.confidence,
      sourceArtifactId: artifact.id,
      evidence: {
        contentQuality: processedContent.quality.score,
        engagement: this.calculateEngagement(artifact),
        technicality: processedContent.quality.factors.technical_depth,
        helpfulness: this.calculateHelpfulness(processedContent)
      },
      occurredAt: artifact.platform_created_at || artifact.created_at,
      decayRate: 0.95, // Standard decay rate
      context: {
        platform: processedContent.platform,
        contentType: processedContent.analysis.contentType,
        audience: processedContent.context.source
      }
    })

    // Additional signals based on content analysis
    if (processedContent.analysis.contentType === 'solution') {
      signals.push({
        personId: artifact.author_person_id,
        topicIds,
        signalType: 'problem_resolution',
        strength: this.calculateSignalStrength('problem_resolution', processedContent),
        confidence: processedContent.quality.confidence,
        sourceArtifactId: artifact.id,
        evidence: {
          contentQuality: processedContent.quality.score,
          engagement: this.calculateEngagement(artifact),
          technicality: processedContent.quality.factors.technical_depth,
          helpfulness: 0.9 // Solutions are inherently helpful
        },
        occurredAt: artifact.platform_created_at || artifact.created_at,
        decayRate: 0.98, // Solutions decay slower
        context: {
          platform: processedContent.platform,
          contentType: 'solution',
          audience: processedContent.context.source
        }
      })
    }

    if (processedContent.analysis.contentType === 'explanation' && 
        processedContent.quality.factors.technical_depth > 0.7) {
      signals.push({
        personId: artifact.author_person_id,
        topicIds,
        signalType: 'detailed_explanation',
        strength: this.calculateSignalStrength('detailed_explanation', processedContent),
        confidence: processedContent.quality.confidence,
        sourceArtifactId: artifact.id,
        evidence: {
          contentQuality: processedContent.quality.score,
          engagement: this.calculateEngagement(artifact),
          technicality: processedContent.quality.factors.technical_depth,
          helpfulness: processedContent.quality.factors.clarity
        },
        occurredAt: artifact.platform_created_at || artifact.created_at,
        decayRate: 0.97,
        context: {
          platform: processedContent.platform,
          contentType: 'detailed_explanation',
          audience: processedContent.context.source
        }
      })
    }

    return signals
  }

  // ===========================
  // Helper Methods
  // ===========================

  private async fetchContentArtifact(artifactId: string): Promise<Database['public']['Tables']['content_artifacts']['Row'] | null> {
    try {
      // Use getSupabaseClient to get a direct client instance
      const { getSupabaseClient } = await import('@/lib/database')
      const supabase = getSupabaseClient(true) // Server-side client
      
      const { data, error } = await supabase
        .from('content_artifacts')
        .select('*')
        .eq('id', artifactId)
        .single()

      if (error) {
        console.error('Error fetching content artifact:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Failed to fetch content artifact:', error)
      return null
    }
  }

  private validateContent(artifact: Database['public']['Tables']['content_artifacts']['Row']): { 
    isValid: boolean; 
    reason?: string; 
    warnings: string[] 
  } {
    const warnings: string[] = []
    
    // Check if content exists
    if (!artifact.body || artifact.body.trim().length === 0) {
      return { isValid: false, reason: 'Empty content', warnings }
    }

    // Check content length
    if (artifact.body.length < this.config.minContentLength) {
      return { isValid: false, reason: 'Content too short', warnings }
    }

    if (artifact.body.length > this.config.maxContentLength) {
      warnings.push('Content is very long and may be truncated')
    }

    // Check if already processed
    if (artifact.is_processed) {
      warnings.push('Content already processed')
    }

    return { isValid: true, warnings }
  }

  private extractRawContent(artifact: Database['public']['Tables']['content_artifacts']['Row']): RawContent {
    return {
      id: artifact.external_id || artifact.id,
      platform: this.inferPlatform(artifact.source_type),
      type: this.inferContentType(artifact.source_type),
      content: artifact.body || '',
      title: artifact.title,
      author: {
        id: artifact.author_external_id || artifact.author_person_id || 'unknown',
        username: artifact.author_external_id,
        displayName: undefined // Will be resolved later
      },
      metadata: {
        timestamp: artifact.platform_created_at || artifact.created_at,
        url: artifact.external_url,
        parentId: artifact.parent_artifact_id,
        ...((artifact.raw_content as any) || {})
      },
      raw: artifact.raw_content
    }
  }

  private extractContext(rawContent: RawContent): ProcessedContent['context'] {
    return {
      platform: rawContent.platform,
      source: rawContent.metadata.channel || rawContent.metadata.repository || 'unknown',
      parentContext: rawContent.metadata.parentId,
      mentions: rawContent.metadata.mentions || [],
      urls: this.extractUrls(rawContent.content),
      codeBlocks: this.extractCodeBlocks(rawContent.content),
      timestamp: rawContent.metadata.timestamp
    }
  }

  private extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s]+/g
    return text.match(urlRegex) || []
  }

  private extractCodeBlocks(text: string): Array<{ language?: string; code: string }> {
    const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g
    const blocks: Array<{ language?: string; code: string }> = []
    
    let match
    while ((match = codeBlockRegex.exec(text)) !== null) {
      blocks.push({
        language: match[1] || undefined,
        code: match[2].trim()
      })
    }
    
    return blocks
  }

  private determineStatementType(analysis: ProcessedContent['analysis']): KnowledgeStatement['statementType'] {
    switch (analysis.contentType) {
      case 'explanation': return 'explanation'
      case 'solution': return 'solution'
      case 'question': return 'reference' // Questions become reference material
      default: return 'explanation'
    }
  }

  private determineTechnicalLevel(analysis: ProcessedContent['analysis']): KnowledgeStatement['technicalLevel'] {
    const termCount = analysis.technicalTerms.length
    const complexity = analysis.complexity
    
    if (complexity === 'simple' && termCount < 3) return 'beginner'
    if (complexity === 'complex' || termCount > 8) return 'advanced'
    return 'intermediate'
  }

  private generateSearchTokens(processedContent: ProcessedContent): string {
    const tokens = [
      processedContent.headline,
      processedContent.cleanText,
      ...processedContent.analysis.technicalTerms,
      ...processedContent.analysis.keyPhrases.map(p => p.text)
    ]
    
    return tokens
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private extractKeywords(processedContent: ProcessedContent): string[] {
    const keywords = new Set<string>()
    
    // Add technical terms
    processedContent.analysis.technicalTerms.forEach(term => keywords.add(term))
    
    // Add high-scoring key phrases
    processedContent.analysis.keyPhrases
      .filter(phrase => phrase.score > 0.5)
      .forEach(phrase => keywords.add(phrase.text))
    
    // Add entity names
    processedContent.analysis.entities
      .filter(entity => entity.confidence > 0.7)
      .forEach(entity => keywords.add(entity.text))
    
    return Array.from(keywords).slice(0, 20) // Limit to 20 keywords
  }

  private async resolveTopicIds(topicDetection: KnowledgeStatement['detectedTopics']): Promise<string[]> {
    // This would resolve topic names to actual database IDs
    // For now, return empty array - implement topic resolution
    return []
  }

  private calculateSignalStrength(signalType: ExpertiseSignal['signalType'], content: ProcessedContent): number {
    const baseStrengths = {
      'authored_statement': 1.0,
      'helpful_response': 0.8,
      'problem_resolution': 1.1,
      'detailed_explanation': 1.2,
      'code_review': 0.9,
      'fast_response': 0.4,
      'positive_reaction': 0.3
    }
    
    const baseStrength = baseStrengths[signalType] || 1.0
    const qualityMultiplier = content.quality.score
    const technicalMultiplier = 1 + (content.quality.factors.technical_depth * 0.5)
    
    return Math.min(2.0, baseStrength * qualityMultiplier * technicalMultiplier)
  }

  private calculateEngagement(artifact: Database['public']['Tables']['content_artifacts']['Row']): number {
    // Calculate engagement from raw content metadata
    const rawContent = (artifact.raw_content as any) || {}
    const reactions = rawContent.reactions || []
    const replyCount = rawContent.replies || 0
    
    const reactionScore = Math.min(1.0, reactions.length * 0.1)
    const replyScore = Math.min(0.5, replyCount * 0.05)
    
    return reactionScore + replyScore
  }

  private calculateHelpfulness(content: ProcessedContent): number {
    // Estimate helpfulness from content characteristics
    let score = 0.5 // Base score
    
    if (content.analysis.contentType === 'solution') score += 0.3
    if (content.analysis.contentType === 'explanation') score += 0.2
    if (content.context.codeBlocks.length > 0) score += 0.2
    if (content.quality.factors.clarity > 0.7) score += 0.1
    
    return Math.min(1.0, score)
  }

  private calculateAverageTopicConfidence(content: ProcessedContent): number {
    // This would calculate from actual topic detection results
    return 0.8 // Placeholder
  }

  private async saveProcessingResults(
    artifact: Database['public']['Tables']['content_artifacts']['Row'],
    processedContent: ProcessedContent,
    knowledgeStatement: KnowledgeStatement,
    expertiseSignals: ExpertiseSignal[]
  ): Promise<void> {
    // Save knowledge statement to database
    const statementResult = await this.db.knowledge.createStatement({
      organization_id: artifact.organization_id,
      headline: knowledgeStatement.headline,
      content: knowledgeStatement.content,
      statement_type: knowledgeStatement.statementType,
      source_artifact_id: artifact.id,
      author_person_id: knowledgeStatement.authorPersonId,
      source_url: knowledgeStatement.sourceUrl,
      related_urls: knowledgeStatement.relatedUrls,
      keywords: knowledgeStatement.keywords,
      context: knowledgeStatement.context
    })

    if (!statementResult.success) {
      throw new Error(`Failed to save knowledge statement: ${statementResult.error}`)
    }

    // Save expertise signals
    for (const signal of expertiseSignals) {
      await this.db.expertise.recordExpertiseSignal({
        organization_id: artifact.organization_id,
        person_id: signal.personId,
        topic_id: signal.topicIds[0], // TODO: Handle multiple topics
        signal_type: signal.signalType,
        strength: signal.strength,
        source_artifact_id: signal.sourceArtifactId,
        statement_id: statementResult.data?.id,
        confidence: signal.confidence,
        occurred_at: signal.occurredAt
      })
    }
  }

  // ===========================
  // Enhanced Topic Processing
  // ===========================

  private async processTopicClustering(
    artifactId: string, 
    enhancedTopicDetection: any, 
    organizationId: string
  ) {
    try {
      // Initialize topic clustering service if not already done
      if (!this.topicClusteringService) {
        this.topicClusteringService = new TopicClusteringService(this.db, organizationId)
      }

      // Process the enhanced topic detection results
      const results = await this.topicClusteringService.processTopicDetectionResults(
        artifactId, 
        enhancedTopicDetection
      )

      console.log(`Topic clustering processed: ${results.processedTopics.length} topics, ${results.newTopics.length} new, ${results.mergedTopics.length} merge candidates`)

      return results
    } catch (error) {
      console.error('Error in topic clustering processing:', error)
      return null
    }
  }

  private inferPlatform(sourceType: string): RawContent['platform'] {
    if (sourceType.startsWith('slack_')) return 'slack'
    if (sourceType.startsWith('github_')) return 'github'
    if (sourceType.startsWith('linear_')) return 'linear'
    return 'slack' // Default fallback
  }

  private inferContentType(sourceType: string): RawContent['type'] {
    if (sourceType.includes('message')) return 'message'
    if (sourceType.includes('pr')) return 'pr'
    if (sourceType.includes('issue')) return 'issue'
    if (sourceType.includes('comment')) return 'comment'
    return 'message' // Default fallback
  }
}

// Factory function for creating configured content extractor
export async function createContentExtractor(config?: {
  openaiApiKey?: string
  embeddingModel?: string
  minQualityScore?: number
}): Promise<ContentExtractor> {
  const openaiApiKey = config?.openaiApiKey || process.env.OPENAI_API_KEY
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key is required for content processing')
  }

  const nlpService = new HiMindNLPService({
    openaiApiKey,
    embeddingModel: config?.embeddingModel || 'text-embedding-3-small'
  })

  const db = new DatabaseManager(true) // Use server-side client

  return new ContentExtractor(nlpService, db, {
    minQualityScore: config?.minQualityScore || 0.3
  })
}