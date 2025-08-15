import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/lib/database"

export async function GET() {
  try {
    const supabase = getSupabaseClient(true)
    
    // Get the organization
    const { data: organization } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single()

    if (!organization) {
      return NextResponse.json({ people: [] })
    }
    
    // Get all people with their external identities for this organization
    const { data: people, error } = await supabase
      .from('people')
      .select(`
        *,
        external_identities (
          id,
          platform,
          external_id,
          username
        )
      `)
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching people:', error)
      return NextResponse.json(
        { error: 'Failed to fetch people' },
        { status: 500 }
      )
    }

    return NextResponse.json({ people: people || [] })
  } catch (error) {
    console.error('Error in people API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      display_name, 
      email, 
      role = 'member',
      slack_username,
      slack_id,
      github_username,
      github_id 
    } = body

    if (!display_name || !email) {
      return NextResponse.json(
        { error: 'Display name and email are required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient(true)
    
    // Get the first organization - in production this would come from auth context
    const { data: organization } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single()

    if (!organization) {
      return NextResponse.json(
        { error: 'No organization found. Please create an organization first.' },
        { status: 400 }
      )
    }

    // Create the person
    const { data: person, error: personError } = await supabase
      .from('people')
      .insert({
        organization_id: organization.id,
        display_name,
        email,
        role,
        is_active: true
      })
      .select()
      .single()

    if (personError) {
      console.error('Error creating person:', personError)
      return NextResponse.json(
        { error: 'Failed to create person' },
        { status: 500 }
      )
    }

    // Create external identities if provided
    const identities = []
    
    if (slack_username || slack_id) {
      identities.push({
        person_id: person.id,
        platform: 'slack',
        external_id: slack_id || slack_username,
        username: slack_username
      })
    }

    if (github_username || github_id) {
      identities.push({
        person_id: person.id,
        platform: 'github',
        external_id: github_id || github_username,
        username: github_username
      })
    }

    if (identities.length > 0) {
      const { error: identityError } = await supabase
        .from('external_identities')
        .insert(identities)

      if (identityError) {
        console.warn('Error creating external identities:', identityError)
        // Don't fail the whole request for this
      }
    }

    return NextResponse.json({ success: true, person })
  } catch (error) {
    console.error('Error in POST people API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}