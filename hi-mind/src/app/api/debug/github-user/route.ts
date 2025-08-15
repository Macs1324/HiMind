import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')
    
    if (!username) {
      return NextResponse.json({ error: 'username parameter required' }, { status: 400 })
    }

    if (!process.env.GITHUB_TOKEN) {
      return NextResponse.json({ error: 'GITHUB_TOKEN not configured' }, { status: 400 })
    }

    console.log(`🔍 [DEBUG] Fetching GitHub user info for: ${username}`)
    
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    })

    const result = await octokit.rest.users.getByUsername({ username })
    
    console.log(`📋 [DEBUG] GitHub API response:`, JSON.stringify(result.data, null, 2))

    if (result.data) {
      const userInfo = {
        id: result.data.id,
        login: result.data.login,
        name: result.data.name,
        email: result.data.email,
        bio: result.data.bio,
        company: result.data.company,
        location: result.data.location,
        public_repos: result.data.public_repos,
        followers: result.data.followers,
        following: result.data.following
      }

      return NextResponse.json({ 
        success: true, 
        userInfo,
        hasEmail: !!result.data.email
      })
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch user info'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('❌ [DEBUG] Failed to fetch GitHub user info:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user info', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
