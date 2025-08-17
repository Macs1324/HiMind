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
        knowledge_sources!inner(organization_id, platform, source_type)
      `)
      .eq('knowledge_sources.organization_id', org.id)
      .limit(30) // More samples for better clustering

    if (!knowledgePoints || knowledgePoints.length < 3) {
      return NextResponse.json({ error: 'Not enough knowledge points' })
    }

    // Parse embeddings
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
          continue
        }
        
        if (Array.isArray(embedding) && embedding.length === 1536) {
          validEmbeddings.push(embedding)
          validKnowledgePoints.push(kp)
        }
      } catch (error) {
        continue
      }
    }

    console.log(`📊 [DEBUG] Testing with ${validEmbeddings.length} embeddings`)

    // Test with different K values
    const clusteringResults = []

    for (let k = 2; k <= Math.min(8, Math.floor(validEmbeddings.length / 2)); k++) {
      const clusters = await performDetailedClustering(validEmbeddings, validKnowledgePoints, k)
      clusteringResults.push({
        k,
        clusters: clusters.map((cluster, idx) => ({
          id: idx,
          size: cluster.points.length,
          platforms: [...new Set(cluster.points.map(p => p.knowledge_sources.platform))],
          sourceTypes: [...new Set(cluster.points.map(p => p.knowledge_sources.source_type))],
          sampleSummaries: cluster.points.slice(0, 3).map(p => p.summary?.substring(0, 60) + '...')
        }))
      })
    }

    return NextResponse.json({
      success: true,
      totalValidEmbeddings: validEmbeddings.length,
      clusteringResults
    })
  } catch (error) {
    console.error('❌ [DEBUG] Detailed clustering failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

// Detailed clustering with cluster info
async function performDetailedClustering(embeddings: number[][], knowledgePoints: any[], k: number) {
  const numPoints = embeddings.length
  const dimensions = embeddings[0].length

  console.log(`📊 [DEBUG] Clustering ${numPoints} points into ${k} clusters`)

  // Simple random initialization for debugging
  let centroids = Array(k).fill(null).map(() => 
    Array(dimensions).fill(0).map(() => Math.random() * 0.2 - 0.1) // Smaller random values
  )

  let assignments = new Array(numPoints).fill(0)
  
  // Multiple iterations
  for (let iter = 0; iter < 20; iter++) {
    const newAssignments = embeddings.map((point, pointIndex) => {
      let minDistance = Infinity
      let assignedCluster = 0

      for (let clusterIndex = 0; clusterIndex < k; clusterIndex++) {
        // Use cosine similarity
        const similarity = cosineSimilarity(point, centroids[clusterIndex])
        const distance = 1 - similarity
        if (distance < minDistance) {
          minDistance = distance
          assignedCluster = clusterIndex
        }
      }

      return assignedCluster
    })

    // Check for convergence
    const converged = assignments.every((assignment, index) => assignment === newAssignments[index])
    assignments = newAssignments

    if (converged) {
      console.log(`📊 [DEBUG] Converged after ${iter + 1} iterations`)
      break
    }

    // Update centroids
    centroids = Array(k).fill(null).map((_, clusterIndex) => {
      const clusterPoints = embeddings.filter((_, pointIndex) => assignments[pointIndex] === clusterIndex)
      
      if (clusterPoints.length === 0) {
        return Array(dimensions).fill(0).map(() => Math.random() * 0.2 - 0.1)
      }

      return calculateCentroid(clusterPoints)
    })
  }

  // Group points by cluster
  const clusters = Array(k).fill(null).map(() => ({ points: [] }))
  assignments.forEach((clusterIndex, pointIndex) => {
    clusters[clusterIndex].points.push(knowledgePoints[pointIndex])
  })

  console.log(`📊 [DEBUG] Final cluster sizes: ${clusters.map(c => c.points.length).join(', ')}`)

  return clusters.filter(cluster => cluster.points.length > 0)
}

function calculateCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return []
  
  const dimensions = vectors[0].length
  const centroid = new Array(dimensions).fill(0)

  for (const vector of vectors) {
    for (let i = 0; i < dimensions; i++) {
      centroid[i] += vector[i]
    }
  }

  for (let i = 0; i < dimensions; i++) {
    centroid[i] /= vectors.length
  }

  return centroid
}

function cosineSimilarity(vec1: number[], vec2: number[]): number {
  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i]
    norm1 += vec1[i] * vec1[i]
    norm2 += vec2[i] * vec2[i]
  }

  norm1 = Math.sqrt(norm1)
  norm2 = Math.sqrt(norm2)

  if (norm1 === 0 || norm2 === 0) return 0
  return dotProduct / (norm1 * norm2)
}
