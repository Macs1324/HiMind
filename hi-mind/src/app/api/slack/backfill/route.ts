import { NextRequest, NextResponse } from 'next/server'
import { SlackBackfill } from '@/integrations/slack/backfill'
import { getSlackConfig } from '@/integrations/slack/config'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [API] Slack backfill requested via UI')

    // Get Slack config
    const config = getSlackConfig()
    
    // Create and run backfill
    const backfill = new SlackBackfill(config.botToken)
    
    // Run backfill in background
    backfill.runBackfill().catch(error => 
      console.error("❌ [API] Backfill failed:", error)
    )

    return NextResponse.json({ 
      success: true, 
      message: 'Slack backfill started in background' 
    })
  } catch (error) {
    console.error('❌ [API] Failed to start Slack backfill:', error)
    return NextResponse.json(
      { error: 'Failed to start Slack backfill', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
