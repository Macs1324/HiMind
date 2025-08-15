import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/lib/database"

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { display_name, email, role, is_active } = body

    if (!display_name || !email) {
      return NextResponse.json(
        { error: 'Display name and email are required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient(true)
    
    const { data: person, error } = await supabase
      .from('people')
      .update({
        display_name,
        email,
        role,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating person:', error)
      return NextResponse.json(
        { error: 'Failed to update person' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, person })
  } catch (error) {
    console.error('Error in PUT people API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const supabase = getSupabaseClient(true)
    
    // Delete the person (external identities will be cascade deleted)
    const { error } = await supabase
      .from('people')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting person:', error)
      return NextResponse.json(
        { error: 'Failed to delete person' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE people API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}