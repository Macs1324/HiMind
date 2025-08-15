import { NextRequest, NextResponse } from 'next/server'
import { getKnowledgeEngine } from '@/core/knowledge-engine-singleton'
import { getCurrentOrganization } from '@/lib/organization'

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 [API] Topic discovery requested via UI')

    const org = await getCurrentOrganization()
    if (!org) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    // Parse options from request body
    const body = await request.json().catch(() => ({}))
    const options = {
      minClusterSize: body.minClusterSize || 3,
      maxClusters: body.maxClusters || 20,
      similarityThreshold: body.similarityThreshold || 0.7
    }

    console.log(`🎯 [API] Starting topic discovery with options:`, options)

    // Run topic discovery
    const result = await getKnowledgeEngine().discoverTopicClusters(org.id, options)

    return NextResponse.json({
      success: true,
      message: `Topic discovery completed! Found ${result.stats.clustersFound} clusters, created ${result.stats.newTopics} new topics, updated ${result.stats.updatedTopics} existing topics.`,
      stats: result.stats,
      topics: result.topics.map(topic => ({
        id: topic.id,
        name: topic.name,
        knowledgePointCount: topic.knowledge_point_count,
        confidenceScore: topic.confidence_score,
        isNew: topic.isNew
      }))
    })
  } catch (error) {
    console.error('❌ [API] Failed to discover topics:', error)
    return NextResponse.json(
      { error: 'Failed to discover topics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const org = await getCurrentOrganization()
    if (!org) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const { getSupabaseClient } = await import('@/lib/database')
    const supabase = getSupabaseClient(true)

    // Get all discovered topics for the organization
    const { data: topics } = await supabase
      .from('discovered_topics')
      .select(`
        *,
        knowledge_topic_memberships (
          knowledge_point_id,
          confidence_score
        )
      `)
      .eq('organization_id', org.id)
      .order('knowledge_point_count', { ascending: false })

    return NextResponse.json({
      success: true,
      topics: topics || [],
      count: topics?.length || 0
    })
  } catch (error) {
    console.error('❌ [API] Failed to fetch topics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch topics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
