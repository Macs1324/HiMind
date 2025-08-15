import { NextResponse } from "next/server"
import { getSupabaseClient } from "@/lib/database"

export async function POST() {
  try {
    const supabase = getSupabaseClient(true)
    
    console.log("🗑️ Resetting database...")

    // Delete data in reverse dependency order to avoid foreign key issues
    const tables = [
      'knowledge_feedback',
      'question_routes', 
      'questions',
      'expertise_signals',
      'expertise_scores',
      'statement_topics',
      'knowledge_statements',
      'topic_cluster_memberships',
      'topic_clusters',
      'topics',
      'external_identities',
      'people',
      'content_artifacts',
      'organizations'
    ]

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

      if (error && !error.message.includes('No rows found')) {
        console.warn(`Warning deleting from ${table}:`, error.message)
      } else {
        console.log(`✅ Cleared ${table}`)
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Database reset successfully'
    })

  } catch (error) {
    console.error('Error resetting database:', error)
    return NextResponse.json(
      { error: 'Failed to reset database', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}