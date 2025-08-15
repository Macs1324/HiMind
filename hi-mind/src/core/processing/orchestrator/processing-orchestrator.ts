// Processing Orchestrator - Coordinates the entire content processing pipeline

import type { 
  ProcessingOrchestrator, 
  ProcessingResult,
  BatchProcessingJob,
  ProcessingConfig,
  ProcessingError
} from '@/core/types/processing'
import { ContentExtractor, createContentExtractor } from '../extractor/content-extractor'
import { DatabaseManager } from '@/lib/database'

export class HiMindProcessingOrchestrator implements ProcessingOrchestrator {
  private contentExtractor: ContentExtractor | null = null
  private db: DatabaseManager
  private config: ProcessingConfig
  private isRunning = false
  private processingQueue: string[] = []
  private activeBatchJobs = new Map<string, BatchProcessingJob>()
  private processingStats = {
    totalProcessed: 0,
    successfullyProcessed: 0,
    failedProcessing: 0,
    averageProcessingTime: 0
  }

  constructor(config: ProcessingConfig, db?: DatabaseManager) {
    this.config = config
    this.db = db || new DatabaseManager(true)
  }

  // ===========================
  // Orchestrator Lifecycle
  // ===========================

  async startPipeline(): Promise<void> {
    if (this.isRunning) {
      console.log('Processing pipeline is already running')
      return
    }

    try {
      // Initialize content extractor
      this.contentExtractor = await createContentExtractor({
        openaiApiKey: this.config.openai?.apiKey,
        embeddingModel: this.config.openai?.model,
        minQualityScore: this.config.thresholds.minQualityScore
      })

      this.isRunning = true
      console.log('🚀 Content Processing Pipeline started')

      // Start background processing loop
      this.startBackgroundProcessing()

    } catch (error) {
      console.error('Failed to start processing pipeline:', error)
      throw error
    }
  }

  async stopPipeline(): Promise<void> {
    this.isRunning = false
    this.processingQueue = []
    console.log('⏹️ Content Processing Pipeline stopped')
  }

  async getPipelineStatus(): Promise<{ running: boolean; queued: number; processing: number }> {
    return {
      running: this.isRunning,
      queued: this.processingQueue.length,
      processing: this.activeBatchJobs.size
    }
  }

  // ===========================
  // Single Item Processing
  // ===========================

  async processArtifact(artifactId: string): Promise<ProcessingResult> {
    if (!this.contentExtractor) {
      throw new Error('Content extractor not initialized. Call startPipeline() first.')
    }

    const startTime = Date.now()

    try {
      console.log(`🔄 Processing artifact: ${artifactId}`)
      
      const result = await this.contentExtractor.processContentArtifact(artifactId)
      
      // Update statistics
      this.updateProcessingStats(Date.now() - startTime, result.success)
      
      if (result.success) {
        console.log(`✅ Successfully processed artifact: ${artifactId} (${result.processingTimeMs}ms)`)
        
        // Log key metrics
        console.log(`📊 Quality: ${result.metrics?.contentQuality}, Topics: ${result.expertiseSignals.length} signals`)
      } else {
        console.warn(`❌ Failed to process artifact: ${artifactId}`, result.errors)
      }
      
      return result

    } catch (error) {
      const processingTime = Date.now() - startTime
      this.updateProcessingStats(processingTime, false)
      
      console.error(`💥 Error processing artifact ${artifactId}:`, error)
      
      return {
        success: false,
        artifactId,
        expertiseSignals: [],
        processingTimeMs: processingTime,
        warnings: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        metrics: {
          contentQuality: 0,
          topicConfidence: 0,
          expertiseSignalCount: 0,
          processingVersion: 'error'
        }
      }
    }
  }

  // ===========================
  // Batch Processing
  // ===========================

  async createBatchJob(
    organizationId: string, 
    filter: BatchProcessingJob['filter']
  ): Promise<BatchProcessingJob> {
    const jobId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
    
    // Get artifacts to process
    const artifactsToProcess = await this.getArtifactsForBatch(organizationId, filter)
    
    const job: BatchProcessingJob = {
      id: jobId,
      organizationId,
      status: 'pending',
      filter,
      progress: {
        total: artifactsToProcess.length,
        processed: 0,
        successful: 0,
        failed: 0
      }
    }

    this.activeBatchJobs.set(jobId, job)
    
    console.log(`📦 Created batch job ${jobId} with ${artifactsToProcess.length} artifacts`)
    
    return job
  }

  async runBatchJob(jobId: string): Promise<void> {
    const job = this.activeBatchJobs.get(jobId)
    if (!job) {
      throw new Error(`Batch job not found: ${jobId}`)
    }

    if (job.status !== 'pending') {
      throw new Error(`Batch job ${jobId} is not in pending state: ${job.status}`)
    }

    try {
      job.status = 'running'
      job.progress.startedAt = new Date().toISOString()
      
      console.log(`🏃‍♂️ Starting batch job ${jobId}`)

      // Get artifacts to process
      const artifacts = await this.getArtifactsForBatch(job.organizationId, job.filter)
      
      const results: ProcessingResult[] = []
      const errors: Array<{ artifactId: string; error: string }> = []

      // Process in batches to avoid overwhelming the system
      const batchSize = this.config.batch.maxBatchSize
      
      for (let i = 0; i < artifacts.length; i += batchSize) {
        const batch = artifacts.slice(i, i + batchSize)
        
        console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(artifacts.length / batchSize)} (${batch.length} items)`)
        
        // Process batch concurrently but with controlled concurrency
        const batchPromises = batch.map(async (artifact) => {
          try {
            const result = await this.processArtifact(artifact.id)
            
            if (result.success) {
              job.progress.successful++
            } else {
              job.progress.failed++
              errors.push({ artifactId: artifact.id, error: result.errors.join(', ') })
            }
            
            job.progress.processed++
            results.push(result)
            
            // Update estimated completion time
            if (job.progress.processed > 0) {
              const elapsedMs = Date.now() - new Date(job.progress.startedAt!).getTime()
              const avgTimePerItem = elapsedMs / job.progress.processed
              const remainingItems = job.progress.total - job.progress.processed
              const estimatedRemainingMs = remainingItems * avgTimePerItem
              job.progress.estimatedCompletionAt = new Date(Date.now() + estimatedRemainingMs).toISOString()
            }

          } catch (error) {
            job.progress.failed++
            job.progress.processed++
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            errors.push({ artifactId: artifact.id, error: errorMessage })
            console.error(`Error in batch processing artifact ${artifact.id}:`, error)
          }
        })

        await Promise.all(batchPromises)
        
        // Add delay between batches to prevent rate limiting
        if (i + batchSize < artifacts.length) {
          await this.delay(this.config.batch.processingDelayMs)
        }
      }

      // Finalize job
      job.status = 'completed'
      job.progress.completedAt = new Date().toISOString()
      job.results = {
        statementsCreated: results.filter(r => r.success && r.knowledgeStatement).length,
        topicsDiscovered: this.countUniqueTopics(results),
        expertiseSignalsRecorded: results.reduce((sum, r) => sum + r.expertiseSignals.length, 0),
        errors
      }

      console.log(`✅ Batch job ${jobId} completed successfully`)
      console.log(`📊 Results: ${job.results.statementsCreated} statements, ${job.results.expertiseSignalsRecorded} signals, ${errors.length} errors`)

    } catch (error) {
      job.status = 'failed'
      job.progress.completedAt = new Date().toISOString()
      console.error(`❌ Batch job ${jobId} failed:`, error)
      throw error
    }
  }

  async getBatchJobStatus(jobId: string): Promise<BatchProcessingJob> {
    const job = this.activeBatchJobs.get(jobId)
    if (!job) {
      throw new Error(`Batch job not found: ${jobId}`)
    }
    return { ...job } // Return copy to prevent external modification
  }

  // ===========================
  // Background Processing
  // ===========================

  private async startBackgroundProcessing(): Promise<void> {
    console.log('🔄 Starting background processing loop')
    
    while (this.isRunning) {
      try {
        await this.processUnprocessedArtifacts()
        await this.delay(30000) // Check every 30 seconds
      } catch (error) {
        console.error('Error in background processing:', error)
        await this.delay(60000) // Wait longer on error
      }
    }
  }

  private async processUnprocessedArtifacts(): Promise<void> {
    if (!this.contentExtractor) return

    // Get a batch of unprocessed artifacts
    const { data: artifacts } = await this.db.content.getUnprocessedArtifacts(
      '', // TODO: Get organization ID from context
      this.config.batch.maxBatchSize
    )

    if (!artifacts || artifacts.length === 0) {
      return // No work to do
    }

    console.log(`🔍 Found ${artifacts.length} unprocessed artifacts`)

    for (const artifact of artifacts) {
      if (!this.isRunning) break // Stop if pipeline was stopped

      try {
        await this.processArtifact(artifact.id)
        await this.delay(this.config.batch.processingDelayMs) // Rate limiting
      } catch (error) {
        console.error(`Failed to process artifact ${artifact.id} in background:`, error)
      }
    }
  }

  // ===========================
  // Helper Methods
  // ===========================

  private async getArtifactsForBatch(
    organizationId: string, 
    filter: BatchProcessingJob['filter']
  ): Promise<Array<{ id: string }>> {
    // This is a simplified implementation
    // In reality, this would query the database with the filter criteria
    
    if (filter.unprocessedOnly) {
      const { data } = await this.db.content.getUnprocessedArtifacts(organizationId, 1000)
      return (data || []).map(artifact => ({ id: artifact.id }))
    }

    // TODO: Implement more sophisticated filtering
    return []
  }

  private updateProcessingStats(processingTimeMs: number, success: boolean): void {
    this.processingStats.totalProcessed++
    
    if (success) {
      this.processingStats.successfullyProcessed++
    } else {
      this.processingStats.failedProcessing++
    }

    // Update rolling average processing time
    const oldAvg = this.processingStats.averageProcessingTime
    const count = this.processingStats.totalProcessed
    this.processingStats.averageProcessingTime = (oldAvg * (count - 1) + processingTimeMs) / count
  }

  private countUniqueTopics(results: ProcessingResult[]): number {
    const topicNames = new Set<string>()
    
    results.forEach(result => {
      if (result.knowledgeStatement?.detectedTopics) {
        result.knowledgeStatement.detectedTopics.topics.forEach(topic => {
          topicNames.add(topic.name)
        })
      }
    })
    
    return topicNames.size
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // ===========================
  // Public Statistics and Health
  // ===========================

  getProcessingStatistics(): typeof this.processingStats {
    return { ...this.processingStats }
  }

  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    checks: Array<{ name: string; status: 'pass' | 'fail'; details?: string }>
  }> {
    const checks = []

    // Check if pipeline is running
    checks.push({
      name: 'Pipeline Running',
      status: this.isRunning ? 'pass' : 'fail' as const,
      details: this.isRunning ? 'Pipeline is active' : 'Pipeline is stopped'
    })

    // Check content extractor
    checks.push({
      name: 'Content Extractor',
      status: this.contentExtractor ? 'pass' : 'fail' as const,
      details: this.contentExtractor ? 'Extractor initialized' : 'Extractor not initialized'
    })

    // Check database connection
    try {
      // Simple health check query
      await this.db.organizations.getOrganization('test-health-check')
      checks.push({
        name: 'Database Connection',
        status: 'pass',
        details: 'Database accessible'
      })
    } catch (error) {
      checks.push({
        name: 'Database Connection',
        status: 'fail',
        details: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }

    // Check processing success rate
    const successRate = this.processingStats.totalProcessed > 0 
      ? this.processingStats.successfullyProcessed / this.processingStats.totalProcessed
      : 1

    checks.push({
      name: 'Processing Success Rate',
      status: successRate > 0.8 ? 'pass' : 'fail' as const,
      details: `${Math.round(successRate * 100)}% success rate (${this.processingStats.totalProcessed} total)`
    })

    // Determine overall status
    const failedChecks = checks.filter(check => check.status === 'fail').length
    let status: 'healthy' | 'degraded' | 'unhealthy'
    
    if (failedChecks === 0) {
      status = 'healthy'
    } else if (failedChecks <= 1) {
      status = 'degraded'
    } else {
      status = 'unhealthy'
    }

    return { status, checks }
  }

  // Clean up completed batch jobs (call periodically)
  cleanupCompletedJobs(maxAge = 24 * 60 * 60 * 1000): void { // 24 hours default
    const cutoff = Date.now() - maxAge
    
    for (const [jobId, job] of this.activeBatchJobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed') {
        const completedAt = job.progress.completedAt ? new Date(job.progress.completedAt).getTime() : 0
        if (completedAt < cutoff) {
          this.activeBatchJobs.delete(jobId)
          console.log(`🧹 Cleaned up old batch job: ${jobId}`)
        }
      }
    }
  }
}

// Factory function for creating configured orchestrator
export async function createProcessingOrchestrator(config?: Partial<ProcessingConfig>): Promise<HiMindProcessingOrchestrator> {
  const defaultConfig: ProcessingConfig = {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'text-embedding-3-small',
      dimensions: 1536
    },
    thresholds: {
      minContentLength: 10,
      maxContentLength: 10000,
      minQualityScore: 0.3,
      similarityThreshold: 0.8,
      confidenceThreshold: 0.5
    },
    batch: {
      maxBatchSize: 10,
      processingDelayMs: 1000,
      retryAttempts: 3
    }
  }

  const mergedConfig = { ...defaultConfig, ...config }
  
  if (!mergedConfig.openai?.apiKey) {
    throw new Error('OpenAI API key is required for processing orchestrator')
  }

  return new HiMindProcessingOrchestrator(mergedConfig)
}

// Singleton instance for application-wide use
let orchestratorInstance: HiMindProcessingOrchestrator | null = null

export async function getProcessingOrchestrator(): Promise<HiMindProcessingOrchestrator> {
  if (!orchestratorInstance) {
    orchestratorInstance = await createProcessingOrchestrator()
  }
  return orchestratorInstance
}