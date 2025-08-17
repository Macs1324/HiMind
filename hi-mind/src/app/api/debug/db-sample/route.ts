import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/database'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    const supabase = getSupabaseClient(true)
    
    // Get a few knowledge sources with author_external_id
    const { data: sources } = await supabase
      .from('knowledge_sources')
      .select('id, platform, author_external_id, content')
      .not('author_external_id', 'is', null)
      .eq('platform', 'slack')
      .limit(5)

    return NextResponse.json({ 
      success: true, 
      sources: sources || [],
      count: sources?.length || 0
    })
  } catch (error) {
    console.error('❌ [DEBUG] Failed to fetch sources:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sources', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
