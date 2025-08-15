import { NextResponse } from "next/server"
import { getSupabaseClient } from "@/lib/database"

export async function GET() {
  try {
    const supabase = getSupabaseClient(true)
    
    // Get the first organization for now
    const { data: organization } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single()

    if (!organization) {
      return NextResponse.json({
        stats: {
          total_people: 0,
          active_people: 0,
          total_topics: 0,
          approved_topics: 0,
          total_statements: 0,
          processing_health: 'unhealthy'
        }
      })
    }

    const orgId = organization.id

    // Fetch stats in parallel
    const [
      peopleStats,
      topicStats,
      statementStats,
      processingHealth
    ] = await Promise.all([
      // People stats
      supabase
        .from('people')
        .select('id, is_active', { count: 'exact' })
        .eq('organization_id', orgId),
      
      // Topic stats  
      supabase
        .from('topics')
        .select('id, is_approved', { count: 'exact' })
        .eq('organization_id', orgId),
      
      // Statement stats
      supabase
        .from('knowledge_statements')
        .select('id', { count: 'exact' })
        .eq('organization_id', orgId),
      
      // Processing health check (simplified)
      supabase
        .from('content_artifacts')
        .select('id, is_processed', { count: 'exact' })
        .eq('organization_id', orgId)
        .limit(100) // Check recent items
    ])

    const totalPeople = peopleStats.count || 0
    const activePeople = peopleStats.data?.filter(p => p.is_active).length || 0
    const totalTopics = topicStats.count || 0
    const approvedTopics = topicStats.data?.filter(t => t.is_approved).length || 0
    const totalStatements = statementStats.count || 0

    // Simple health check based on processing rate
    const recentArtifacts = processingHealth.data || []
    const processedCount = recentArtifacts.filter(a => a.is_processed).length
    const processingRate = recentArtifacts.length > 0 ? processedCount / recentArtifacts.length : 1

    let health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    if (processingRate < 0.5) {
      health = 'unhealthy'
    } else if (processingRate < 0.8) {
      health = 'degraded'
    }

    return NextResponse.json({
      stats: {
        total_people: totalPeople,
        active_people: activePeople,
        total_topics: totalTopics,
        approved_topics: approvedTopics,
        total_statements: totalStatements,
        processing_health: health
      }
    })
  } catch (error) {
    console.error('Error fetching organization stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organization stats' },
      { status: 500 }
    )
  }
}