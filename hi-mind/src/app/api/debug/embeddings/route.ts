/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/database'
import { getCurrentOrganization } from '@/lib/organization'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    const org = await getCurrentOrganization()
    if (!org) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const supabase = getSupabaseClient(true)
    
    // Get sample knowledge points with embeddings
    const { data: knowledgePoints } = await supabase
      .from('knowledge_points')
      .select(`
        id,
        embedding,
        summary,
        knowledge_sources!inner(organization_id)
      `)
      .eq('knowledge_sources.organization_id', org.id)
      .limit(5)

    const embeddingInfo = knowledgePoints?.map((kp: any) => {
      let embeddingData = null
      let embeddingLength = 0
      const embeddingType = typeof kp.embedding
      let embeddingSample = null
      
      try {
        if (typeof kp.embedding === 'string') {
          // Handle different string formats
          const embeddingStr = kp.embedding
          if (embeddingStr.startsWith('[') && embeddingStr.endsWith(']')) {
            embeddingData = JSON.parse(embeddingStr)
          } else {
            // Try to parse as array string without brackets
            embeddingData = JSON.parse(`[${embeddingStr}]`)
          }
        } else if (Array.isArray(kp.embedding)) {
          embeddingData = kp.embedding
        }
        
        if (Array.isArray(embeddingData)) {
          embeddingLength = embeddingData.length
          embeddingSample = embeddingData.slice(0, 5) // First 5 values
        }
      } catch (error) {
        embeddingData = `Parse error: ${error}`
      }

      return {
        id: kp.id,
        summary: kp.summary?.substring(0, 100) + '...',
        embeddingType,
        embeddingLength,
        embeddingSample,
        rawEmbedding: kp.embedding?.toString().substring(0, 200) + '...'
      }
    })

    return NextResponse.json({
      success: true,
      totalKnowledgePoints: knowledgePoints?.length || 0,
      embeddingInfo
    })
  } catch (error) {
    console.error('❌ [DEBUG] Failed to analyze embeddings:', error)
    return NextResponse.json(
      { error: 'Failed to analyze embeddings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
