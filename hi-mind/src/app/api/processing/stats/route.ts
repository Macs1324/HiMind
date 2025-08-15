import { NextResponse } from "next/server";
import { ProcessingOrchestrator } from "@/services/processing-orchestrator";

const orchestrator = new ProcessingOrchestrator();

export async function GET() {
  try {
    const stats = await orchestrator.getProcessingStats();
    
    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching processing stats:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch processing stats', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}