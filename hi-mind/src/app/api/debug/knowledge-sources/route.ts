/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/database'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    const supabase = getSupabaseClient(true)
    
    // Get knowledge sources by platform
    const { data: sources } = await supabase
      .from('knowledge_sources')
      .select(`
        id,
        platform,
        source_type,
        author_external_id,
        author_person_id,
        external_url,
        content,
        people (display_name)
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    // Get platform counts
    const { data: platformCounts } = await supabase
      .from('knowledge_sources')
      .select('platform')
      .neq('platform', null)

    const counts = platformCounts?.reduce((acc: Record<string, number>, source: any) => {
      acc[source.platform] = (acc[source.platform] || 0) + 1
      return acc
    }, {}) || {}

    return NextResponse.json({ 
      success: true, 
      sources: sources || [],
      platformCounts: counts,
      totalSources: sources?.length || 0
    })
  } catch (error) {
    console.error('❌ [DEBUG] Failed to fetch knowledge sources:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sources', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
