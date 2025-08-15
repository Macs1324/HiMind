// Simple database connection test

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing direct Supabase connection...')
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    console.log('URL:', supabaseUrl)
    console.log('Key length:', supabaseKey?.length)
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Check knowledge sources and points counts
    const [
      { count: sourcesCount },
      { count: pointsCount }
    ] = await Promise.all([
      supabase.from('knowledge_sources').select('*', { count: 'exact', head: true }),
      supabase.from('knowledge_points').select('*', { count: 'exact', head: true })
    ])

    // Get a sample knowledge source
    const { data: sampleSource } = await supabase
      .from('knowledge_sources')
      .select('id, platform, source_type, title, content')
      .limit(1)
      .single()

    // Check if there are any knowledge points
    const { data: samplePoint } = await supabase
      .from('knowledge_points')
      .select('id, source_id, summary, quality_score')
      .limit(1)
      .single()

    // Test the search function directly
    const testEmbedding = new Array(1536).fill(0.1); // Simple test vector
    const { data: searchResult, error: searchError } = await supabase
      .rpc('find_similar_knowledge', {
        query_embedding: `[${testEmbedding.join(',')}]`,
        org_id: '9c353c02-5f78-44d0-a701-481cccc4f4dd', 
        similarity_threshold: 0.1,
        result_limit: 3
      });

    return NextResponse.json({
      success: true,
      message: 'Database analysis complete',
      counts: {
        knowledge_sources: sourcesCount,
        knowledge_points: pointsCount
      },
      samples: {
        source: sampleSource,
        point: samplePoint
      },
      searchTest: {
        result: searchResult,
        error: searchError,
        testEmbedding: testEmbedding.slice(0, 5) // Just first 5 values for display
      }
    })

  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}