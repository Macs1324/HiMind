import { getSupabaseClient } from "@/lib/database";
import { ContentIngestionService, type ContentSource } from "./content-ingestion.service";

export interface ProcessingJob {
  id: string;
  content: ContentSource;
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  scheduledFor?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  error?: string;
  processingMetadata?: Record<string, any>;
}

export interface ProcessingStats {
  totalJobs: number;
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  throughputPerHour: number;
}

export class ProcessingOrchestrator {
  private supabase = getSupabaseClient(true);
  private contentIngestion = new ContentIngestionService();
  private processing = false;
  private concurrency = 3; // Process up to 3 items concurrently
  private currentJobs = new Set<string>();
  private processingStats = {
    completed: 0,
    failed: 0,
    totalProcessingTime: 0,
    startTime: Date.now()
  };

  constructor() {
    // Start processing loop
    this.startProcessingLoop();
  }

  async queueContent(content: ContentSource, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<string> {
    const jobId = `${content.type}_${content.externalId}_${Date.now()}`;
    
    const job: ProcessingJob = {
      id: jobId,
      content,
      priority,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      status: 'pending'
    };

    // Store job in database
    await this.storeProcessingJob(job);
    
    console.log(`📋 [PROCESSING ORCHESTRATOR] Queued ${content.type} job: ${jobId}`);
    return jobId;
  }

  async batchQueueContent(contents: ContentSource[], priority: 'high' | 'normal' | 'low' = 'normal'): Promise<string[]> {
    const jobIds: string[] = [];
    
    for (const content of contents) {
      const jobId = await this.queueContent(content, priority);
      jobIds.push(jobId);
    }
    
    console.log(`📋 [PROCESSING ORCHESTRATOR] Batch queued ${contents.length} jobs`);
    return jobIds;
  }

  async getProcessingStats(): Promise<ProcessingStats> {
    // Get current job counts from database
    const [pendingCount, processingCount, completedCount, failedCount] = await Promise.all([
      this.getJobCountByStatus('pending'),
      this.getJobCountByStatus('processing'),
      this.getJobCountByStatus('completed'),
      this.getJobCountByStatus('failed')
    ]);

    const totalJobs = pendingCount + processingCount + completedCount + failedCount;
    const upTimeHours = (Date.now() - this.processingStats.startTime) / (1000 * 60 * 60);
    const averageProcessingTime = this.processingStats.completed > 0 
      ? this.processingStats.totalProcessingTime / this.processingStats.completed 
      : 0;

    return {
      totalJobs,
      pendingJobs: pendingCount,
      processingJobs: processingCount,
      completedJobs: completedCount,
      failedJobs: failedCount,
      averageProcessingTime,
      throughputPerHour: upTimeHours > 0 ? this.processingStats.completed / upTimeHours : 0
    };
  }

  async retryFailedJobs(maxAge?: number): Promise<number> {
    let query = this.supabase
      .from('processing_jobs')
      .select('*')
      .eq('status', 'failed')
      .lt('retry_count', 3); // Only retry jobs that haven't exceeded max retries

    if (maxAge) {
      const cutoffDate = new Date(Date.now() - maxAge);
      query = query.gte('created_at', cutoffDate.toISOString());
    }

    const { data: failedJobs, error } = await query;
    
    if (error || !failedJobs) {
      console.error('Failed to fetch failed jobs:', error);
      return 0;
    }

    let retriedCount = 0;
    for (const job of failedJobs) {
      await this.supabase
        .from('processing_jobs')
        .update({
          status: 'pending',
          retry_count: job.retry_count + 1,
          error: null,
          scheduled_for: new Date().toISOString()
        })
        .eq('id', job.id);
      
      retriedCount++;
    }

    console.log(`🔄 [PROCESSING ORCHESTRATOR] Retried ${retriedCount} failed jobs`);
    return retriedCount;
  }

  private async startProcessingLoop(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;
    console.log(`🚀 [PROCESSING ORCHESTRATOR] Started with concurrency: ${this.concurrency}`);
    
    while (this.processing) {
      try {
        if (this.currentJobs.size < this.concurrency) {
          const job = await this.getNextJob();
          if (job) {
            this.processJobAsync(job);
          }
        }
        
        // Wait a bit before checking for more jobs
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error('Error in processing loop:', error);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait longer on error
      }
    }
  }

  private async getNextJob(): Promise<ProcessingJob | null> {
    const { data: jobs, error } = await this.supabase
      .from('processing_jobs')
      .select('*')
      .eq('status', 'pending')
      .or('scheduled_for.is.null,scheduled_for.lte.' + new Date().toISOString())
      .order('priority', { ascending: false }) // high priority first
      .order('created_at', { ascending: true })
      .limit(1);

    if (error || !jobs || jobs.length === 0) {
      return null;
    }

    return this.dbRowToJob(jobs[0]);
  }

  private async processJobAsync(job: ProcessingJob): Promise<void> {
    this.currentJobs.add(job.id);
    
    try {
      await this.processJob(job);
    } finally {
      this.currentJobs.delete(job.id);
    }
  }

  private async processJob(job: ProcessingJob): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Mark job as processing
      await this.updateJobStatus(job.id, 'processing');
      
      console.log(`⚡ [PROCESSING ORCHESTRATOR] Processing job: ${job.id}`);
      
      // Process the content
      const result = await this.contentIngestion.ingestContent(job.content);
      
      // Mark job as completed
      await this.updateJobStatus(job.id, 'completed', undefined, {
        statements_created: result.knowledgeStatements.length,
        topics_created: result.topics.length,
        content_artifact_id: result.contentArtifactId,
        processing_time_ms: Date.now() - startTime
      });
      
      // Update stats
      this.processingStats.completed++;
      this.processingStats.totalProcessingTime += Date.now() - startTime;
      
      console.log(`✅ [PROCESSING ORCHESTRATOR] Completed job: ${job.id} (${Date.now() - startTime}ms)`);
      
    } catch (error) {
      console.error(`❌ [PROCESSING ORCHESTRATOR] Failed job: ${job.id}`, error);
      
      const shouldRetry = job.retryCount < job.maxRetries;
      const newStatus = shouldRetry ? 'retrying' : 'failed';
      const scheduledFor = shouldRetry ? new Date(Date.now() + (job.retryCount + 1) * 30000) : undefined; // Exponential backoff
      
      await this.updateJobStatus(
        job.id, 
        newStatus, 
        error instanceof Error ? error.message : String(error),
        { retry_count: job.retryCount + 1 },
        scheduledFor
      );
      
      if (shouldRetry) {
        console.log(`🔄 [PROCESSING ORCHESTRATOR] Scheduling retry for job: ${job.id} (attempt ${job.retryCount + 2})`);
      } else {
        this.processingStats.failed++;
      }
    }
  }

  private async storeProcessingJob(job: ProcessingJob): Promise<void> {
    const { error } = await this.supabase
      .from('processing_jobs')
      .insert({
        id: job.id,
        content_type: job.content.type,
        content_data: job.content,
        priority: job.priority,
        retry_count: job.retryCount,
        max_retries: job.maxRetries,
        status: job.status,
        created_at: job.createdAt.toISOString(),
        scheduled_for: job.scheduledFor?.toISOString()
      });

    if (error) {
      throw new Error(`Failed to store processing job: ${error.message}`);
    }
  }

  private async updateJobStatus(
    jobId: string, 
    status: ProcessingJob['status'], 
    error?: string,
    metadata?: Record<string, any>,
    scheduledFor?: Date
  ): Promise<void> {
    const updateData: any = { 
      status,
      updated_at: new Date().toISOString()
    };
    
    if (error !== undefined) updateData.error = error;
    if (metadata) updateData.processing_metadata = metadata;
    if (scheduledFor) updateData.scheduled_for = scheduledFor.toISOString();
    
    await this.supabase
      .from('processing_jobs')
      .update(updateData)
      .eq('id', jobId);
  }

  private async getJobCountByStatus(status: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('processing_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', status);

    return error ? 0 : (count || 0);
  }

  private dbRowToJob(row: any): ProcessingJob {
    return {
      id: row.id,
      content: row.content_data,
      priority: row.priority,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      createdAt: new Date(row.created_at),
      scheduledFor: row.scheduled_for ? new Date(row.scheduled_for) : undefined,
      status: row.status,
      error: row.error,
      processingMetadata: row.processing_metadata
    };
  }

  stop(): void {
    this.processing = false;
    console.log('🛑 [PROCESSING ORCHESTRATOR] Stopped');
  }
}