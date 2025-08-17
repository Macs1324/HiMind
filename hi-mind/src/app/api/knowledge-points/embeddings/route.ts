import { NextResponse } from 'next/server'
import { getCurrentOrganization } from '@/lib/organization'
import { createServiceClient } from '@/utils/supabase/service'

export async function GET() {
  try {
    console.log('🔍 [API] Fetching knowledge points with embeddings')

    const org = await getCurrentOrganization()
    if (!org) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Fetch all knowledge points with their embeddings and source metadata
    const { data: knowledgePoints, error } = await supabase
      .from('knowledge_points')
      .select(`
        id,
        summary,
        keywords,
        embedding,
        quality_score,
        relevance_score,
        processed_at,
        knowledge_sources!inner(
          organization_id,
          platform,
          source_type,
          external_url,
          platform_created_at,
          people(display_name)
        )
      `)
      .eq('knowledge_sources.organization_id', org.id)
      .not('embedding', 'is', null) // Only get points with embeddings
      .order('processed_at', { ascending: false })

    if (error) {
      console.error('❌ [API] Failed to fetch knowledge points:', error)
      return NextResponse.json(
        { error: 'Failed to fetch knowledge points', details: error.message },
        { status: 500 }
      )
    }

    // Transform the data to include parsed embeddings
    const transformedPoints = (knowledgePoints || []).map((kp: { id: string; summary: string; keywords: string[] | null; embedding: string | number[]; quality_score: number | null; processed_at: string; knowledge_sources: { platform: string; source_type: string; external_url: string | null; platform_created_at: string | null; people: { display_name: string } | null } }) => {
      let parsedEmbedding: number[] = []
      
      try {
        // Parse embedding from database (stored as JSON string)
        if (typeof kp.embedding === 'string') {
          parsedEmbedding = JSON.parse(kp.embedding)
        } else if (Array.isArray(kp.embedding)) {
          parsedEmbedding = kp.embedding
        }
        
        // Validate embedding dimensions
        if (!Array.isArray(parsedEmbedding) || parsedEmbedding.length !== 1536) {
          console.warn(`⚠️ [API] Invalid embedding for knowledge point ${kp.id}`)
          return null
        }
      } catch (error) {
        console.warn(`⚠️ [API] Failed to parse embedding for knowledge point ${kp.id}:`, error)
        return null
      }

      return {
        id: kp.id,
        summary: kp.summary,
        keywords: kp.keywords || [],
        embedding: parsedEmbedding,
        platform: kp.knowledge_sources.platform,
        sourceType: kp.knowledge_sources.source_type,
        externalUrl: kp.knowledge_sources.external_url,
        authorName: kp.knowledge_sources.people?.display_name,
        createdAt: kp.knowledge_sources.platform_created_at || kp.processed_at,
        qualityScore: kp.quality_score || 0.5
      }
    }).filter(Boolean) // Remove null entries

    console.log(`✅ [API] Successfully fetched ${transformedPoints.length} knowledge points with embeddings`)

    return NextResponse.json({
      success: true,
      knowledgePoints: transformedPoints,
      count: transformedPoints.length
    })
  } catch (error) {
    console.error('❌ [API] Failed to fetch knowledge points with embeddings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch knowledge points', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}