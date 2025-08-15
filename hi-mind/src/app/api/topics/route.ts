// Topic Management API - Handle topic operations, approval, and analytics

import { NextRequest, NextResponse } from 'next/server'
import { DatabaseManager } from '@/lib/database'
import { TopicClusteringService } from '@/core/processing/topics/topic-clustering-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const organizationId = searchParams.get('organizationId')

    if (!organizationId) {
      return NextResponse.json({
        success: false,
        error: 'organizationId is required'
      }, { status: 400 })
    }

    const db = new DatabaseManager(true)

    switch (action) {
      case 'list':
        return await handleListTopics(db, organizationId, searchParams)
      
      case 'emerging':
        return await handleGetEmergingTopics(db, organizationId)
      
      case 'analytics':
        return await handleGetTopicAnalytics(db, organizationId, searchParams)
      
      case 'relationships':
        return await handleGetTopicRelationships(db, organizationId, searchParams)
      
      default:
        return await handleListTopics(db, organizationId, searchParams)
    }

  } catch (error) {
    console.error('Topic API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, organizationId } = body

    if (!organizationId) {
      return NextResponse.json({
        success: false,
        error: 'organizationId is required'
      }, { status: 400 })
    }

    const db = new DatabaseManager(true)

    switch (action) {
      case 'approve':
        return await handleApproveTopic(db, body)
      
      case 'merge':
        return await handleMergeTopics(db, body)
      
      case 'create_relationship':
        return await handleCreateRelationship(db, body)
      
      case 'create':
        return await handleCreateTopic(db, body)
      
      case 'bulk_approve':
        return await handleBulkApprove(db, body)
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Topic API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

// ===========================
// GET Handlers
// ===========================

async function handleListTopics(
  db: DatabaseManager, 
  organizationId: string, 
  searchParams: URLSearchParams
) {
  const includeUnapproved = searchParams.get('includeUnapproved') === 'true'
  const category = searchParams.get('category')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  let query = db.supabase
    .from('topics')
    .select(`
      *,
      statement_topics (
        statement_id,
        relevance_score
      )
    `, { count: 'exact' })
    .eq('organization_id', organizationId)

  if (!includeUnapproved) {
    query = query.eq('is_approved', true)
  }

  if (category) {
    // Filter by category through keyword analysis
    query = query.contains('keyword_signatures', [category])
  }

  const { data: topics, error, count } = await query
    .order('activity_score', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw new Error(`Failed to list topics: ${error.message}`)
  }

  // Calculate topic metrics
  const enrichedTopics = topics?.map(topic => ({
    ...topic,
    statementCount: topic.statement_topics?.length || 0,
    lastActivity: topic.updated_at,
    needsApproval: !topic.is_approved && (topic.emergence_strength || 0) > 0.6
  })) || []

  return NextResponse.json({
    success: true,
    data: {
      topics: enrichedTopics,
      pagination: {
        total: count || 0,
        offset,
        limit,
        hasMore: (offset + limit) < (count || 0)
      }
    }
  })
}

async function handleGetEmergingTopics(db: DatabaseManager, organizationId: string) {
  const { data: emergingTopics, error } = await db.supabase
    .from('topics')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_approved', false)
    .gte('emergence_strength', 0.3)
    .order('emergence_strength', { ascending: false })
    .limit(20)

  if (error) {
    throw new Error(`Failed to get emerging topics: ${error.message}`)
  }

  // Analyze emergence patterns
  const analysisResults = emergingTopics?.map(topic => ({
    ...topic,
    emergenceAnalysis: {
      strength: topic.emergence_strength || 0,
      frequency: topic.statement_count || 0,
      readyForApproval: (topic.emergence_strength || 0) > 0.6 && (topic.statement_count || 0) >= 3,
      keywordDensity: topic.keyword_signatures?.length || 0,
      ageInDays: Math.floor((Date.now() - new Date(topic.created_at).getTime()) / (1000 * 60 * 60 * 24))
    }
  })) || []

  return NextResponse.json({
    success: true,
    data: {
      emergingTopics: analysisResults,
      summary: {
        totalEmerging: analysisResults.length,
        readyForApproval: analysisResults.filter(t => t.emergenceAnalysis.readyForApproval).length,
        averageEmergenceStrength: analysisResults.reduce((sum, t) => sum + t.emergence_strength, 0) / analysisResults.length
      }
    }
  })
}

async function handleGetTopicAnalytics(
  db: DatabaseManager, 
  organizationId: string, 
  searchParams: URLSearchParams
) {
  const timeframe = (searchParams.get('timeframe') as 'day' | 'week' | 'month') || 'week'
  
  const clusteringService = new TopicClusteringService(db, organizationId)
  const analytics = await clusteringService.getTopicAnalytics(timeframe)

  // Additional analytics
  const { data: topicStats } = await db.supabase
    .from('topics')
    .select('is_approved, emergence_strength, statement_count, created_at')
    .eq('organization_id', organizationId)

  const stats = {
    totalTopics: topicStats?.length || 0,
    approvedTopics: topicStats?.filter(t => t.is_approved).length || 0,
    emergingTopics: topicStats?.filter(t => !t.is_approved && (t.emergence_strength || 0) > 0.3).length || 0,
    averageStatementsPerTopic: topicStats?.reduce((sum, t) => sum + (t.statement_count || 0), 0) / (topicStats?.length || 1) || 0
  }

  return NextResponse.json({
    success: true,
    data: {
      ...analytics,
      statistics: stats,
      timeframe
    }
  })
}

async function handleGetTopicRelationships(
  db: DatabaseManager, 
  organizationId: string, 
  searchParams: URLSearchParams
) {
  const topicId = searchParams.get('topicId')

  let query = db.supabase
    .from('topics')
    .select(`
      id,
      name,
      parent_topic_id,
      topics!parent_topic_id (
        id,
        name
      )
    `)
    .eq('organization_id', organizationId)

  if (topicId) {
    query = query.or(`id.eq.${topicId},parent_topic_id.eq.${topicId}`)
  }

  const { data: relationships, error } = await query

  if (error) {
    throw new Error(`Failed to get topic relationships: ${error.message}`)
  }

  // Build relationship graph
  const graph = {
    nodes: relationships?.map(topic => ({
      id: topic.id,
      name: topic.name,
      type: topic.parent_topic_id ? 'child' : 'parent'
    })) || [],
    edges: relationships?.filter(topic => topic.parent_topic_id).map(topic => ({
      from: topic.parent_topic_id,
      to: topic.id,
      type: 'specialization'
    })) || []
  }

  return NextResponse.json({
    success: true,
    data: {
      relationships: graph,
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length
    }
  })
}

// ===========================
// POST Handlers
// ===========================

async function handleApproveTopic(db: DatabaseManager, body: any) {
  const { topicId, organizationId } = body

  if (!topicId) {
    throw new Error('topicId is required')
  }

  const result = await db.topics.approveTopic(topicId)
  
  if (!result.success) {
    throw new Error(`Failed to approve topic: ${result.error}`)
  }

  // Update emergence strength to indicate approval
  await db.supabase
    .from('topics')
    .update({
      emergence_strength: 1.0,
      updated_at: new Date().toISOString()
    })
    .eq('id', topicId)

  return NextResponse.json({
    success: true,
    message: 'Topic approved successfully',
    data: result.data
  })
}

async function handleMergeTopics(db: DatabaseManager, body: any) {
  const { sourceTopicId, targetTopicId, organizationId, mergeStrategy = 'synonym' } = body

  if (!sourceTopicId || !targetTopicId) {
    throw new Error('sourceTopicId and targetTopicId are required')
  }

  // Get both topics
  const [sourceResult, targetResult] = await Promise.all([
    db.supabase.from('topics').select('*').eq('id', sourceTopicId).single(),
    db.supabase.from('topics').select('*').eq('id', targetTopicId).single()
  ])

  if (sourceResult.error || targetResult.error) {
    throw new Error('Failed to fetch topics for merging')
  }

  const sourceTopic = sourceResult.data
  const targetTopic = targetResult.data

  // Merge keywords and update target topic
  const mergedKeywords = [...new Set([
    ...(targetTopic.keyword_signatures || []),
    ...(sourceTopic.keyword_signatures || [])
  ])]

  const mergedActivityScore = (targetTopic.activity_score || 0) + (sourceTopic.activity_score || 0)
  const mergedStatementCount = (targetTopic.statement_count || 0) + (sourceTopic.statement_count || 0)

  // Update target topic with merged data
  await db.supabase
    .from('topics')
    .update({
      keyword_signatures: mergedKeywords,
      activity_score: mergedActivityScore,
      statement_count: mergedStatementCount,
      description: `${targetTopic.description} (Merged with: ${sourceTopic.name})`,
      updated_at: new Date().toISOString()
    })
    .eq('id', targetTopicId)

  // Move all statement_topics from source to target
  await db.supabase
    .from('statement_topics')
    .update({ topic_id: targetTopicId })
    .eq('topic_id', sourceTopicId)

  // Move all expertise_scores from source to target
  await db.supabase
    .from('expertise_scores')
    .update({ topic_id: targetTopicId })
    .eq('topic_id', sourceTopicId)

  // Archive source topic
  await db.supabase
    .from('topics')
    .update({
      is_archived: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', sourceTopicId)

  return NextResponse.json({
    success: true,
    message: `Topics merged successfully using ${mergeStrategy} strategy`,
    data: {
      targetTopicId,
      mergedKeywords: mergedKeywords.length,
      transferredStatements: sourceTopic.statement_count || 0
    }
  })
}

async function handleCreateRelationship(db: DatabaseManager, body: any) {
  const { parentTopicId, childTopicId, relationshipType = 'specialization', organizationId } = body

  if (!parentTopicId || !childTopicId) {
    throw new Error('parentTopicId and childTopicId are required')
  }

  // Update child topic to have parent relationship
  const { data, error } = await db.supabase
    .from('topics')
    .update({
      parent_topic_id: parentTopicId,
      updated_at: new Date().toISOString()
    })
    .eq('id', childTopicId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create topic relationship: ${error.message}`)
  }

  return NextResponse.json({
    success: true,
    message: 'Topic relationship created successfully',
    data: {
      parentTopicId,
      childTopicId,
      relationshipType
    }
  })
}

async function handleCreateTopic(db: DatabaseManager, body: any) {
  const { organizationId, name, description, keywords = [], category = 'technology' } = body

  if (!name) {
    throw new Error('Topic name is required')
  }

  const result = await db.topics.createTopic({
    organization_id: organizationId,
    name,
    description,
    keyword_signatures: keywords,
    emergence_strength: 1.0, // Manual creation gets full strength
    is_cluster_root: false
  })

  if (!result.success) {
    throw new Error(`Failed to create topic: ${result.error}`)
  }

  // Auto-approve manually created topics
  await db.topics.approveTopic(result.data!.id)

  return NextResponse.json({
    success: true,
    message: 'Topic created successfully',
    data: result.data
  })
}

async function handleBulkApprove(db: DatabaseManager, body: any) {
  const { topicIds, organizationId } = body

  if (!Array.isArray(topicIds) || topicIds.length === 0) {
    throw new Error('topicIds array is required')
  }

  const results = []
  
  for (const topicId of topicIds) {
    try {
      const result = await db.topics.approveTopic(topicId)
      results.push({ topicId, success: result.success, error: result.error })
    } catch (error) {
      results.push({ 
        topicId, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
    }
  }

  const successCount = results.filter(r => r.success).length
  const failureCount = results.length - successCount

  return NextResponse.json({
    success: true,
    message: `Bulk approval completed: ${successCount} succeeded, ${failureCount} failed`,
    data: {
      results,
      summary: {
        total: results.length,
        succeeded: successCount,
        failed: failureCount
      }
    }
  })
}