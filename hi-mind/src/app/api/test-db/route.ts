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
    
    // Simple health check query
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)

    console.log('Query result:', { data, error })

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        details: error
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      data: data || []
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