// API endpoint for batch job status

import { NextRequest, NextResponse } from 'next/server'
import { getProcessingOrchestrator } from '@/core/processing/orchestrator/processing-orchestrator'

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const orchestrator = await getProcessingOrchestrator()
    const job = await orchestrator.getBatchJobStatus(params.jobId)

    return NextResponse.json({
      success: true,
      data: job,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error(`Error getting batch job status for ${params.jobId}:`, error)
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({
        success: false,
        error: `Batch job not found: ${params.jobId}`
      }, { status: 404 })
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}