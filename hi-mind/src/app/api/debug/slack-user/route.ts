import { NextRequest, NextResponse } from 'next/server'
import { getSlackConfig } from '@/integrations/slack/config'
import { WebClient } from '@slack/web-api'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({ error: 'userId parameter required' }, { status: 400 })
    }

    console.log(`🔍 [DEBUG] Fetching Slack user info for: ${userId}`)
    
    const config = getSlackConfig()
    const client = new WebClient(config.botToken)

    const result = await client.users.info({ user: userId })
    
    console.log(`📋 [DEBUG] Slack API response:`, JSON.stringify(result, null, 2))

    if (result.ok && result.user) {
      const userInfo = {
        id: result.user.id,
        name: result.user.name,
        profile: {
          email: result.user.profile?.email,
          display_name: result.user.profile?.display_name,
          real_name: result.user.profile?.real_name,
          first_name: result.user.profile?.first_name,
          last_name: result.user.profile?.last_name
        },
        is_bot: result.user.is_bot,
        deleted: result.user.deleted
      }

      return NextResponse.json({ 
        success: true, 
        userInfo,
        hasEmail: !!result.user.profile?.email
      })
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch user info',
        slackError: result.error 
      }, { status: 500 })
    }
  } catch (error) {
    console.error('❌ [DEBUG] Failed to fetch Slack user info:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user info', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
