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
          total_knowledge_sources: 0,
          processing_health: 'unhealthy'
        }
      })
    }

    const orgId = organization.id

    // Fetch stats in parallel (simplified schema)
    const [
      peopleStats,
      topicStats,
      knowledgeStats,
      processingHealth
    ] = await Promise.all([
      // People stats
      supabase
        .from('people')
        .select('id', { count: 'exact' })
        .eq('organization_id', orgId),
      
      // Topic stats  
      supabase
        .from('discovered_topics')
        .select('id', { count: 'exact' })
        .eq('organization_id', orgId),
      
      // Knowledge points stats
      supabase
        .from('knowledge_sources')
        .select('id', { count: 'exact' })
        .eq('organization_id', orgId),
      
      // Processing health check (knowledge points processed)
      supabase
        .from('knowledge_points')
        .select('id', { count: 'exact' })
        .limit(100) // Check recent items
    ])

    const totalPeople = peopleStats.count || 0
    const activePeople = totalPeople // Simplified - no is_active field in simplified schema
    const totalTopics = topicStats.count || 0
    const approvedTopics = totalTopics // Simplified - no is_approved field in simplified schema
    const totalKnowledgeSources = knowledgeStats.count || 0

    // Simple health check based on knowledge points processed
    const knowledgePointsCount = processingHealth.count || 0
    const processingRate = totalKnowledgeSources > 0 ? knowledgePointsCount / totalKnowledgeSources : 1

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
        total_knowledge_sources: totalKnowledgeSources,
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