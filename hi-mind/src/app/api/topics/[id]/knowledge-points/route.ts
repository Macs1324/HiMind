import { NextRequest, NextResponse } from 'next/server'
import { getKnowledgeEngine } from '@/core/knowledge-engine-singleton'
import { getCurrentOrganization } from '@/lib/organization'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log(`🔍 [API] Fetching knowledge points for topic: ${id}`)
    
    const org = await getCurrentOrganization()
    if (!org) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const engine = getKnowledgeEngine()
    
    // Get knowledge points that belong to this topic
    const { data: knowledgePoints, error } = await engine.supabase
      .from('knowledge_topic_memberships')
      .select(`
        knowledge_points!inner(
          id,
          summary,
          keywords,
          knowledge_sources!inner(
            content,
            platform,
            source_type,
            external_url,
            title,
            platform_created_at,
            people(display_name)
          )
        )
      `)
      .eq('topic_id', id)

    if (error) {
      console.error('❌ [API] Database error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Transform the data into a cleaner format
    const formattedKnowledgePoints = knowledgePoints?.map((membership: any) => {
      const kp = membership.knowledge_points
      const source = kp.knowledge_sources
      
      return {
        id: kp.id,
        summary: kp.summary,
        keywords: kp.keywords || [],
        content: source.content,
        platform: source.platform,
        sourceType: source.source_type,
        externalUrl: source.external_url,
        title: source.title,
        authorName: source.people?.display_name || 'Unknown',
        createdAt: source.platform_created_at
      }
    }) || []

    console.log(`✅ [API] Found ${formattedKnowledgePoints.length} knowledge points for topic`)

    return NextResponse.json({
      success: true,
      knowledgePoints: formattedKnowledgePoints
    })

  } catch (error) {
    console.error('❌ [API] Error fetching knowledge points:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
