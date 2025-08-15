import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/lib/database"

export async function GET() {
  try {
    const supabase = getSupabaseClient(true)
    
    // For now, get the first organization - in production this would be based on auth context
    const { data: organization, error } = await supabase
      .from('organizations')
      .select('*')
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching organization:', error)
      return NextResponse.json(
        { error: 'Failed to fetch organization' },
        { status: 500 }
      )
    }

    return NextResponse.json({ organization: organization || null })
  } catch (error) {
    console.error('Error in organization API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, settings } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient(true)
    
    // For now, update the first organization - in production this would be based on auth context
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single()

    if (!existingOrg) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const { data: organization, error } = await supabase
      .from('organizations')
      .update({
        name,
        settings: settings || {},
        updated_at: new Date().toISOString()
      })
      .eq('id', existingOrg.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating organization:', error)
      return NextResponse.json(
        { error: 'Failed to update organization' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, organization })
  } catch (error) {
    console.error('Error in PUT organization API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}