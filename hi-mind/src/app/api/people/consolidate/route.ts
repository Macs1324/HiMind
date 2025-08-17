import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/database'
import { getCurrentOrganization } from '@/lib/organization'

interface ConsolidationResult {
  mergedPeople: Array<{
    primaryPerson: any
    mergedPeople: any[]
    strategy: string
  }>
  errors: string[]
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [CONSOLIDATION] Starting people consolidation...')

    const org = await getCurrentOrganization()
    if (!org) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const supabase = getSupabaseClient(true)
    
    // Get all people with their external identities
    const { data: people } = await supabase
      .from('people')
      .select(`
        *,
        external_identities (*)
      `)
      .eq('organization_id', org.id)
      .order('created_at', { ascending: true }) // Keep oldest as primary

    if (!people || people.length === 0) {
      return NextResponse.json({ success: true, message: 'No people to consolidate' })
    }

    const result = await consolidatePeople(supabase, people)

    return NextResponse.json({
      success: true,
      message: `Consolidated ${result.mergedPeople.length} duplicate groups`,
      details: result
    })
  } catch (error) {
    console.error('❌ [CONSOLIDATION] Failed:', error)
    return NextResponse.json(
      { error: 'Failed to consolidate people', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function consolidatePeople(supabase: any, people: any[]): Promise<ConsolidationResult> {
  const result: ConsolidationResult = {
    mergedPeople: [],
    errors: []
  }

  // Group people by normalized name for exact/fuzzy matching
  const nameGroups = new Map<string, any[]>()
  
  for (const person of people) {
    const normalizedName = normalizeName(person.display_name)
    if (!nameGroups.has(normalizedName)) {
      nameGroups.set(normalizedName, [])
    }
    nameGroups.get(normalizedName)!.push(person)
  }

  // Process each group with multiple people
  for (const [normalizedName, group] of nameGroups) {
    if (group.length > 1) {
      try {
        console.log(`🔀 [CONSOLIDATION] Merging ${group.length} people with name: "${normalizedName}"`)
        
        // Sort by creation date (oldest first) and prefer people with emails
        const sortedGroup = group.sort((a, b) => {
          // Prefer people with emails
          if (a.email && !b.email) return -1
          if (!a.email && b.email) return 1
          // Then by creation date
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        })

        const primaryPerson = sortedGroup[0]
        const duplicatePeople = sortedGroup.slice(1)

        // Merge all external identities into the primary person
        for (const duplicate of duplicatePeople) {
          // Move external identities
          for (const identity of duplicate.external_identities) {
            await supabase
              .from('external_identities')
              .update({ person_id: primaryPerson.id })
              .eq('id', identity.id)
          }

          // Update knowledge sources to point to primary person
          await supabase
            .from('knowledge_sources')
            .update({ author_person_id: primaryPerson.id })
            .eq('author_person_id', duplicate.id)

          // Delete the duplicate person
          await supabase
            .from('people')
            .delete()
            .eq('id', duplicate.id)
        }

        // Update primary person with best available information
        const updateData: any = {}
        
        // Use email from any person if primary doesn't have one
        if (!primaryPerson.email) {
          const personWithEmail = sortedGroup.find(p => p.email)
          if (personWithEmail) {
            updateData.email = personWithEmail.email
          }
        }

        // Use the most "complete" display name (prefer proper case)
        const bestName = sortedGroup
          .map(p => p.display_name)
          .sort((a, b) => {
            // Prefer names with proper capitalization
            const aProper = a.split(' ').every((word: string) => word[0] === word[0].toUpperCase())
            const bProper = b.split(' ').every((word: string) => word[0] === word[0].toUpperCase())
            if (aProper && !bProper) return -1
            if (!aProper && bProper) return 1
            return a.length - b.length // Prefer longer names
          })[0]

        if (bestName !== primaryPerson.display_name) {
          updateData.display_name = bestName
        }

        if (Object.keys(updateData).length > 0) {
          await supabase
            .from('people')
            .update(updateData)
            .eq('id', primaryPerson.id)
        }

        result.mergedPeople.push({
          primaryPerson: { ...primaryPerson, ...updateData },
          mergedPeople: duplicatePeople.map(p => p.display_name),
          strategy: 'name_matching'
        })

        console.log(`✅ [CONSOLIDATION] Merged ${duplicatePeople.length} duplicates into: ${bestName}`)

      } catch (error) {
        const errorMsg = `Failed to merge group for "${normalizedName}": ${error}`
        result.errors.push(errorMsg)
        console.error(`❌ [CONSOLIDATION] ${errorMsg}`)
      }
    }
  }

  return result
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize spaces
}
