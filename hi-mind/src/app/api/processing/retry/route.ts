import { NextResponse } from "next/server";
import { ProcessingOrchestrator } from "@/services/processing-orchestrator";

const orchestrator = new ProcessingOrchestrator();

export async function POST() {
  try {
    const retriedCount = await orchestrator.retryFailedJobs();
    
    return NextResponse.json({
      success: true,
      retriedJobs: retriedCount,
      message: `Retried ${retriedCount} failed jobs`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error retrying failed jobs:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retry jobs', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}