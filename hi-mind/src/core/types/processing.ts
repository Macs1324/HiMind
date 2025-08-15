// Core types for the Content Processing Pipeline

export interface ProcessingConfig {
  // OpenAI API configuration
  openai?: {
    apiKey: string
    model: 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002'
    dimensions?: number
  }
  
  // Processing thresholds and limits
  thresholds: {
    minContentLength: number
    maxContentLength: number
    minQualityScore: number
    similarityThreshold: number
    confidenceThreshold: number
  }
  
  // Batch processing settings
  batch: {
    maxBatchSize: number
    processingDelayMs: number
    retryAttempts: number
  }
}

// Raw content from any platform
export interface RawContent {
  id: string
  platform: 'slack' | 'github' | 'linear' | 'jira' | 'confluence' | 'notion' | 'discord'
  type: 'message' | 'thread' | 'pr' | 'issue' | 'comment' | 'commit' | 'page'
  content: string
  title?: string
  author: {
    id: string
    username?: string
    displayName?: string
  }
  metadata: {
    timestamp: string
    url?: string
    parentId?: string
    channel?: string
    repository?: string
    reactions?: Array<{ emoji: string; count: number; users: string[] }>
    mentions?: string[]
    tags?: string[]
    [key: string]: any
  }
  raw: any // Original platform-specific data
}

// Processed and cleaned content
export interface ProcessedContent {
  originalId: string
  platform: string
  type: string
  
  // Cleaned and normalized content
  cleanText: string
  title?: string
  headline: string // AI-generated summary/headline
  
  // Author information
  authorId: string
  authorDisplayName: string
  
  // Context and metadata
  context: {
    platform: string
    source: string // channel, repo, etc.
    parentContext?: string
    mentions: string[]
    urls: string[]
    codeBlocks: Array<{ language?: string; code: string }>
    timestamp: string
  }
  
  // NLP Analysis results
  analysis: {
    language: string
    sentiment: 'positive' | 'negative' | 'neutral'
    contentType: 'explanation' | 'question' | 'solution' | 'discussion' | 'announcement'
    complexity: 'simple' | 'moderate' | 'complex'
    technicalTerms: string[]
    entities: Array<{ text: string; label: string; confidence: number }>
    keyPhrases: Array<{ text: string; score: number }>
  }
  
  // Quality assessment
  quality: {
    score: number // 0-1
    factors: {
      length: number
      structure: number
      clarity: number
      engagement: number
      technical_depth: number
    }
    confidence: number
  }
  
  // Vector embeddings
  embedding: number[]
  
  // Processing metadata
  processingMetadata: {
    version: string
    processedAt: string
    processingTimeMs: number
    model: string
    warnings: string[]
    errors: string[]
  }
}

// Topic detection result
export interface TopicDetection {
  topics: Array<{
    id?: string // If topic already exists
    name: string
    confidence: number
    category: 'technology' | 'domain' | 'process' | 'problem' | 'tool'
    keywords: string[]
    reasoning: string
  }>
  
  // Emerging topic signatures
  emergingTopics: Array<{
    name: string
    keywords: string[]
    confidence: number
    evidence: string[]
    relatedExisting?: string[] // IDs of related existing topics
  }>
  
  // Context-based topics
  contextTopics: Array<{
    source: string // repository, channel, etc.
    topics: string[]
    confidence: number
  }>
}

// Knowledge statement creation result
export interface KnowledgeStatement {
  headline: string
  content: string
  statementType: 'explanation' | 'decision' | 'solution' | 'best_practice' | 'warning' | 'tip' | 'example' | 'reference'
  
  // Source attribution
  sourceArtifactId: string
  authorPersonId?: string
  sourceUrl?: string
  relatedUrls: string[]
  
  // Content analysis
  keywords: string[]
  technicalLevel: 'beginner' | 'intermediate' | 'advanced'
  confidence: number
  qualityScore: number
  
  // Embeddings and search
  contentVector: number[]
  searchTokens: string
  
  // Topics and context
  detectedTopics: TopicDetection
  context: any
  
  // Processing metadata
  processingMetadata: any
}

// Expertise signal from content analysis
export interface ExpertiseSignal {
  personId: string
  topicIds: string[]
  signalType: 'authored_statement' | 'helpful_response' | 'code_review' | 'problem_resolution' | 
              'detailed_explanation' | 'fast_response' | 'positive_reaction'
  
  strength: number // Base signal strength
  confidence: number // How confident we are in this signal
  
  // Evidence
  sourceArtifactId: string
  statementId?: string
  evidence: {
    contentQuality: number
    engagement: number // reactions, responses, etc.
    technicality: number
    helpfulness: number
    responseTime?: number // for fast_response signals
  }
  
  // Temporal
  occurredAt: string
  decayRate: number
  
  // Context
  context: {
    platform: string
    contentType: string
    audience: string // channel, team, etc.
  }
}

// Processing pipeline result
export interface ProcessingResult {
  success: boolean
  artifactId: string
  
  // Generated outputs
  processedContent?: ProcessedContent
  knowledgeStatement?: KnowledgeStatement
  expertiseSignals: ExpertiseSignal[]
  
  // Processing info
  processingTimeMs: number
  warnings: string[]
  errors: string[]
  
  // Metrics
  metrics: {
    contentQuality: number
    topicConfidence: number
    expertiseSignalCount: number
    processingVersion: string
  }
}

// Batch processing job
export interface BatchProcessingJob {
  id: string
  organizationId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  
  // Job configuration
  filter: {
    platforms?: string[]
    dateRange?: { start: string; end: string }
    unprocessedOnly: boolean
    reprocessExisting: boolean
  }
  
  // Progress tracking
  progress: {
    total: number
    processed: number
    successful: number
    failed: number
    startedAt?: string
    completedAt?: string
    estimatedCompletionAt?: string
  }
  
  // Results summary
  results?: {
    statementsCreated: number
    topicsDiscovered: number
    expertiseSignalsRecorded: number
    errors: Array<{ artifactId: string; error: string }>
  }
}

// Platform-specific extractor interface
export interface PlatformExtractor {
  platform: string
  extractContent(rawData: any): Promise<RawContent>
  validateContent(content: RawContent): boolean
  enrichContext(content: RawContent): Promise<RawContent>
}

// NLP Service interface
export interface NLPService {
  // Text processing
  cleanText(text: string): string
  extractHeadline(text: string): Promise<string>
  analyzeContent(text: string): Promise<ProcessedContent['analysis']>
  assessQuality(content: RawContent, analysis: ProcessedContent['analysis']): ProcessedContent['quality']
  
  // Embeddings
  generateEmbedding(text: string): Promise<number[]>
  calculateSimilarity(embedding1: number[], embedding2: number[]): number
  
  // Topic detection
  detectTopics(content: ProcessedContent): Promise<TopicDetection>
  
  // Entity extraction
  extractEntities(text: string): Promise<Array<{ text: string; label: string; confidence: number }>>
  extractKeyPhrases(text: string): Promise<Array<{ text: string; score: number }>>
}

// Pipeline orchestrator interface
export interface ProcessingOrchestrator {
  // Single item processing
  processArtifact(artifactId: string): Promise<ProcessingResult>
  
  // Batch processing
  createBatchJob(organizationId: string, filter: BatchProcessingJob['filter']): Promise<BatchProcessingJob>
  runBatchJob(jobId: string): Promise<void>
  getBatchJobStatus(jobId: string): Promise<BatchProcessingJob>
  
  // Pipeline management
  startPipeline(): Promise<void>
  stopPipeline(): Promise<void>
  getPipelineStatus(): Promise<{ running: boolean; queued: number; processing: number }>
}

// Error types
export class ProcessingError extends Error {
  constructor(
    message: string,
    public code: string,
    public artifactId?: string,
    public stage?: string,
    public recoverable = true
  ) {
    super(message)
    this.name = 'ProcessingError'
  }
}

export class NLPError extends Error {
  constructor(
    message: string,
    public operation: string,
    public input?: string
  ) {
    super(message)
    this.name = 'NLPError'
  }
}