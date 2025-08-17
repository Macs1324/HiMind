import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/database'
import { getCurrentOrganization } from '@/lib/organization'

export async function GET() {
  try {
    const org = await getCurrentOrganization()
    if (!org) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const supabase = getSupabaseClient(true)
    
    // Get diverse samples from different platforms
    const { data: slackSamples } = await supabase
      .from('knowledge_points')
      .select(`
        summary,
        knowledge_sources!inner(platform, source_type, content)
      `)
      .eq('knowledge_sources.platform', 'slack')
      .eq('knowledge_sources.organization_id', org.id)
      .limit(10)

    const { data: githubSamples } = await supabase
      .from('knowledge_points')
      .select(`
        summary,
        knowledge_sources!inner(platform, source_type, content)
      `)
      .eq('knowledge_sources.platform', 'github')
      .eq('knowledge_sources.organization_id', org.id)
      .limit(10)

    // Get platform distribution
    const { data: platformCounts } = await supabase
      .from('knowledge_sources')
      .select('platform')
      .eq('organization_id', org.id)

    const platformDistribution = platformCounts?.reduce((acc: Record<string, number>, source) => {
      acc[source.platform] = (acc[source.platform] || 0) + 1
      return acc
    }, {})

    // Get source type distribution
    const { data: sourceTypes } = await supabase
      .from('knowledge_sources')
      .select('source_type')
      .eq('organization_id', org.id)

    const sourceTypeDistribution = sourceTypes?.reduce((acc: Record<string, number>, source) => {
      acc[source.source_type] = (acc[source.source_type] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      analysis: {
        platformDistribution,
        sourceTypeDistribution,
        totalKnowledgePoints: platformCounts?.length || 0
      },
      samples: {
        slack: slackSamples?.map(s => ({
          summary: s.summary?.substring(0, 100) + '...',
          sourceType: s.knowledge_sources.source_type,
          contentPreview: s.knowledge_sources.content?.substring(0, 100) + '...'
        })) || [],
        github: githubSamples?.map(s => ({
          summary: s.summary?.substring(0, 100) + '...',
          sourceType: s.knowledge_sources.source_type,
          contentPreview: s.knowledge_sources.content?.substring(0, 100) + '...'
        })) || []
      }
    })
  } catch (error) {
    console.error('❌ [DEBUG] Content diversity analysis failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
