import { NextRequest, NextResponse } from 'next/server'
import { getKnowledgeEngine } from '@/core/knowledge-engine-singleton'
import { getCurrentOrganization } from '@/lib/organization'
import { getSupabaseClient } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const org = await getCurrentOrganization()
    if (!org) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const supabase = getSupabaseClient(true)
    
    // Get knowledge points with embeddings (limited for debugging)
    const { data: knowledgePoints } = await supabase
      .from('knowledge_points')
      .select(`
        id,
        embedding,
        summary,
        knowledge_sources!inner(organization_id)
      `)
      .eq('knowledge_sources.organization_id', org.id)
      .limit(20) // Limit for debugging

    console.log(`📊 [DEBUG] Found ${knowledgePoints?.length || 0} knowledge points`)

    if (!knowledgePoints || knowledgePoints.length === 0) {
      return NextResponse.json({ error: 'No knowledge points found' })
    }

    // Parse embeddings manually
    const debugInfo = {
      totalKnowledgePoints: knowledgePoints.length,
      parsedEmbeddings: 0,
      invalidEmbeddings: 0,
      clusteringAttempted: false,
      clustersFound: 0,
      errors: []
    }

    const validEmbeddings = []
    const validKnowledgePoints = []

    for (const kp of knowledgePoints) {
      try {
        let embedding
        if (typeof kp.embedding === 'string') {
          embedding = JSON.parse(kp.embedding)
        } else if (Array.isArray(kp.embedding)) {
          embedding = kp.embedding
        } else {
          debugInfo.errors.push(`Unknown embedding format for ${kp.id}: ${typeof kp.embedding}`)
          debugInfo.invalidEmbeddings++
          continue
        }
        
        if (Array.isArray(embedding) && embedding.length === 1536) {
          validEmbeddings.push(embedding)
          validKnowledgePoints.push(kp)
          debugInfo.parsedEmbeddings++
        } else {
          debugInfo.errors.push(`Invalid embedding dimensions for ${kp.id}: ${embedding?.length}`)
          debugInfo.invalidEmbeddings++
        }
      } catch (error) {
        debugInfo.errors.push(`Parse error for ${kp.id}: ${error}`)
        debugInfo.invalidEmbeddings++
      }
    }

    console.log(`📊 [DEBUG] Parsed ${debugInfo.parsedEmbeddings} valid embeddings`)

    if (validEmbeddings.length >= 3) {
      debugInfo.clusteringAttempted = true
      
      // Simple K-means with k=3 for debugging
      try {
        const k = Math.min(3, Math.floor(validEmbeddings.length / 2))
        console.log(`📊 [DEBUG] Attempting clustering with k=${k}`)
        
        // Very basic clustering test
        const clusters = await performSimpleClustering(validEmbeddings, k)
        debugInfo.clustersFound = clusters.length
        
        console.log(`📊 [DEBUG] Found ${clusters.length} clusters:`, clusters.map(c => c.length))
        
        return NextResponse.json({
          success: true,
          debugInfo,
          clusterSizes: clusters.map(c => c.length)
        })
      } catch (error) {
        debugInfo.errors.push(`Clustering error: ${error}`)
      }
    }

    return NextResponse.json({
      success: false,
      debugInfo
    })
  } catch (error) {
    console.error('❌ [DEBUG] Clustering debug failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

// Simple clustering function for debugging
async function performSimpleClustering(embeddings: number[][], k: number): Promise<number[][]> {
  const numPoints = embeddings.length
  const dimensions = embeddings[0].length

  console.log(`📊 [DEBUG] Clustering ${numPoints} points with ${dimensions} dimensions`)

  // Initialize centroids randomly
  let centroids = Array(k).fill(null).map(() => 
    Array(dimensions).fill(0).map(() => Math.random() * 2 - 1)
  )

  let assignments = new Array(numPoints).fill(0)
  
  // Single iteration for debugging
  for (let pointIndex = 0; pointIndex < numPoints; pointIndex++) {
    let minDistance = Infinity
    let assignedCluster = 0

    for (let clusterIndex = 0; clusterIndex < k; clusterIndex++) {
      const distance = euclideanDistance(embeddings[pointIndex], centroids[clusterIndex])
      if (distance < minDistance) {
        minDistance = distance
        assignedCluster = clusterIndex
      }
    }

    assignments[pointIndex] = assignedCluster
  }

  // Group point indices by cluster
  const clusters: number[][] = Array(k).fill(null).map(() => [])
  assignments.forEach((clusterIndex, pointIndex) => {
    clusters[clusterIndex].push(pointIndex)
  })

  return clusters.filter(cluster => cluster.length > 0)
}

function euclideanDistance(vec1: number[], vec2: number[]): number {
  let sum = 0
  for (let i = 0; i < vec1.length; i++) {
    sum += Math.pow(vec1[i] - vec2[i], 2)
  }
  return Math.sqrt(sum)
}
