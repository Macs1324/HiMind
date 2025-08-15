import { getSupabaseClient } from "@/lib/database";

export interface ProcessingError {
  id: string;
  jobId: string;
  contentType: string;
  errorType: 'validation' | 'processing' | 'database' | 'api' | 'timeout' | 'unknown';
  errorMessage: string;
  errorStack?: string;
  context: Record<string, any>;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
}

export class ProcessingErrorHandler {
  private supabase = getSupabaseClient(true);
  private errorCache = new Map<string, number>(); // Track error frequencies
  
  async logError(
    jobId: string,
    contentType: string,
    error: Error | string,
    context: Record<string, any> = {},
    severity: ProcessingError['severity'] = 'medium'
  ): Promise<string> {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'object' && error.stack ? error.stack : undefined;
    
    // Determine error type based on error message and context
    const errorType = this.categorizeError(errorMessage, context);
    
    // Generate error ID
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Track error frequency
    const errorKey = `${contentType}:${errorType}:${errorMessage}`;
    const frequency = (this.errorCache.get(errorKey) || 0) + 1;
    this.errorCache.set(errorKey, frequency);
    
    // Escalate severity if error is frequent
    if (frequency > 5) {
      severity = severity === 'low' ? 'medium' : severity === 'medium' ? 'high' : 'critical';
    }
    
    const processingError: ProcessingError = {
      id: errorId,
      jobId,
      contentType,
      errorType,
      errorMessage,
      errorStack,
      context: {
        ...context,
        frequency,
        userAgent: context.userAgent || 'server',
        timestamp: new Date().toISOString()
      },
      timestamp: new Date(),
      severity,
      resolved: false
    };
    
    // Store error in database
    await this.storeError(processingError);
    
    // Send alerts for high severity errors
    if (severity === 'high' || severity === 'critical') {
      await this.sendAlert(processingError);
    }
    
    console.error(`🚨 [PROCESSING ERROR] ${severity.toUpperCase()}: ${errorMessage}`, {
      jobId,
      contentType,
      errorType,
      frequency,
      context
    });
    
    return errorId;
  }
  
  private categorizeError(errorMessage: string, context: Record<string, any>): ProcessingError['errorType'] {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('timeout') || message.includes('abort')) return 'timeout';
    if (message.includes('validation') || message.includes('invalid')) return 'validation';
    if (message.includes('database') || message.includes('supabase') || message.includes('sql')) return 'database';
    if (message.includes('api') || message.includes('fetch') || message.includes('network')) return 'api';
    if (message.includes('processing') || message.includes('extraction') || message.includes('nlp')) return 'processing';
    
    return 'unknown';
  }
  
  private async storeError(error: ProcessingError): Promise<void> {
    try {
      const { error: dbError } = await this.supabase
        .from('processing_errors')
        .insert({
          id: error.id,
          job_id: error.jobId,
          content_type: error.contentType,
          error_type: error.errorType,
          error_message: error.errorMessage,
          error_stack: error.errorStack,
          context: error.context,
          severity: error.severity,
          resolved: error.resolved,
          created_at: error.timestamp.toISOString()
        });
        
      if (dbError) {
        console.error('Failed to store processing error:', dbError);
      }
    } catch (e) {
      console.error('Error storing processing error:', e);
    }
  }
  
  private async sendAlert(error: ProcessingError): Promise<void> {
    // In a production system, you would integrate with:
    // - Slack/Discord webhooks
    // - Email alerts
    // - PagerDuty/other alerting systems
    // - Dashboard notifications
    
    console.warn(`🚨 ALERT: ${error.severity.toUpperCase()} processing error`, {
      errorId: error.id,
      jobId: error.jobId,
      contentType: error.contentType,
      errorType: error.errorType,
      message: error.errorMessage,
      frequency: error.context.frequency
    });
    
    // For now, just log critical errors more prominently
    if (error.severity === 'critical') {
      console.error('💥 CRITICAL PROCESSING ERROR - IMMEDIATE ATTENTION REQUIRED', error);
    }
  }
  
  async markErrorResolved(errorId: string, resolution: string): Promise<void> {
    try {
      await this.supabase
        .from('processing_errors')
        .update({
          resolved: true,
          resolution,
          resolved_at: new Date().toISOString()
        })
        .eq('id', errorId);
        
      console.log(`✅ [PROCESSING ERROR] Marked error ${errorId} as resolved: ${resolution}`);
    } catch (error) {
      console.error('Failed to mark error as resolved:', error);
    }
  }
  
  async getErrorSummary(timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<{
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsByContent: Record<string, number>;
    severityDistribution: Record<string, number>;
    topErrors: Array<{ message: string; count: number; lastSeen: Date }>;
  }> {
    const hours = timeframe === 'hour' ? 1 : timeframe === 'day' ? 24 : 168;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    try {
      const { data: errors } = await this.supabase
        .from('processing_errors')
        .select('*')
        .gte('created_at', since.toISOString());
        
      if (!errors) return this.getEmptyErrorSummary();
      
      const errorsByType: Record<string, number> = {};
      const errorsByContent: Record<string, number> = {};
      const severityDistribution: Record<string, number> = {};
      const errorMessages: Record<string, { count: number; lastSeen: Date }> = {};
      
      for (const error of errors) {
        // Count by type
        errorsByType[error.error_type] = (errorsByType[error.error_type] || 0) + 1;
        
        // Count by content type
        errorsByContent[error.content_type] = (errorsByContent[error.content_type] || 0) + 1;
        
        // Count by severity
        severityDistribution[error.severity] = (severityDistribution[error.severity] || 0) + 1;
        
        // Track unique error messages
        const message = error.error_message.substring(0, 100); // Truncate for grouping
        if (!errorMessages[message]) {
          errorMessages[message] = { count: 0, lastSeen: new Date(error.created_at) };
        }
        errorMessages[message].count++;
        const errorDate = new Date(error.created_at);
        if (errorDate > errorMessages[message].lastSeen) {
          errorMessages[message].lastSeen = errorDate;
        }
      }
      
      // Get top 10 most frequent errors
      const topErrors = Object.entries(errorMessages)
        .sort(([,a], [,b]) => b.count - a.count)
        .slice(0, 10)
        .map(([message, data]) => ({ message, count: data.count, lastSeen: data.lastSeen }));
      
      return {
        totalErrors: errors.length,
        errorsByType,
        errorsByContent,
        severityDistribution,
        topErrors
      };
      
    } catch (error) {
      console.error('Failed to get error summary:', error);
      return this.getEmptyErrorSummary();
    }
  }
  
  private getEmptyErrorSummary() {
    return {
      totalErrors: 0,
      errorsByType: {},
      errorsByContent: {},
      severityDistribution: {},
      topErrors: []
    };
  }
  
  // Clean up old error cache entries periodically
  cleanupErrorCache(): void {
    if (this.errorCache.size > 1000) {
      // Keep only the most recent 500 entries
      const entries = Array.from(this.errorCache.entries());
      this.errorCache.clear();
      entries.slice(-500).forEach(([key, value]) => {
        this.errorCache.set(key, value);
      });
    }
  }
}