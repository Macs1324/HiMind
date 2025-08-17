import { NextRequest, NextResponse } from 'next/server'
import { startGitHubIntegration } from '@/integrations/github/integration'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [API] GitHub backfill requested via UI')

    if (!process.env.GITHUB_TOKEN) {
      return NextResponse.json(
        { error: 'GITHUB_TOKEN not configured' },
        { status: 400 }
      )
    }

    if (!process.env.GITHUB_REPOSITORY) {
      return NextResponse.json(
        { error: 'GITHUB_REPOSITORY not configured. Set it to "owner/repo" format.' },
        { status: 400 }
      )
    }

    // Start GitHub integration (which auto-triggers backfill)
    startGitHubIntegration().catch(error => 
      console.error("❌ [API] GitHub integration failed:", error)
    )

    return NextResponse.json({ 
      success: true, 
      message: `GitHub backfill started for ${process.env.GITHUB_REPOSITORY}`,
      repository: process.env.GITHUB_REPOSITORY
    })
  } catch (error) {
    console.error('❌ [API] Failed to start GitHub backfill:', error)
    return NextResponse.json(
      { error: 'Failed to start GitHub backfill', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
