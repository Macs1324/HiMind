// API endpoint for content processing pipeline management

import { NextRequest, NextResponse } from 'next/server'
import { getProcessingOrchestrator } from '@/core/processing/orchestrator/processing-orchestrator'

// GET /api/processing - Get pipeline status and statistics
export async function GET(request: NextRequest) {
  try {
    const orchestrator = await getProcessingOrchestrator()
    
    const [status, health, stats] = await Promise.all([
      orchestrator.getPipelineStatus(),
      orchestrator.getHealthStatus(),
      Promise.resolve(orchestrator.getProcessingStatistics())
    ])

    return NextResponse.json({
      success: true,
      data: {
        pipeline: status,
        health,
        statistics: stats,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error getting processing status:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST /api/processing - Start/stop pipeline or trigger processing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, artifactId, organizationId, filter } = body

    const orchestrator = await getProcessingOrchestrator()

    switch (action) {
      case 'start':
        await orchestrator.startPipeline()
        return NextResponse.json({
          success: true,
          message: 'Processing pipeline started',
          timestamp: new Date().toISOString()
        })

      case 'stop':
        await orchestrator.stopPipeline()
        return NextResponse.json({
          success: true,
          message: 'Processing pipeline stopped',
          timestamp: new Date().toISOString()
        })

      case 'process_artifact':
        if (!artifactId) {
          return NextResponse.json({
            success: false,
            error: 'artifactId is required for process_artifact action'
          }, { status: 400 })
        }

        const result = await orchestrator.processArtifact(artifactId)
        return NextResponse.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        })

      case 'create_batch':
        if (!organizationId) {
          return NextResponse.json({
            success: false,
            error: 'organizationId is required for create_batch action'
          }, { status: 400 })
        }

        const job = await orchestrator.createBatchJob(organizationId, filter || { unprocessedOnly: true })
        return NextResponse.json({
          success: true,
          data: job,
          timestamp: new Date().toISOString()
        })

      case 'run_batch':
        if (!body.jobId) {
          return NextResponse.json({
            success: false,
            error: 'jobId is required for run_batch action'
          }, { status: 400 })
        }

        // Start batch processing in background
        orchestrator.runBatchJob(body.jobId).catch(error => {
          console.error(`Batch job ${body.jobId} failed:`, error)
        })

        return NextResponse.json({
          success: true,
          message: `Batch job ${body.jobId} started`,
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in processing API:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}