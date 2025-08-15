import { NextResponse } from "next/server"
import { getSupabaseClient } from "@/lib/database"

export async function POST() {
  try {
    const supabase = getSupabaseClient(true)
    
    console.log("🏗️ Creating sample organization and management data...")

    // 1. Create or get organization
    let organization
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('*')
      .limit(1)
      .single()

    if (existingOrg) {
      organization = existingOrg
      console.log("✅ Using existing organization:", organization.name)
    } else {
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: 'HiMind Demo Organization',
          slug: 'himind-demo',
          settings: {
            slack_enabled: true,
            github_enabled: true,
            processing_enabled: true
          }
        })
        .select()
        .single()

      if (orgError) {
        throw new Error(`Failed to create organization: ${orgError.message}`)
      }
      organization = newOrg
      console.log("✅ Created new organization:", organization.name)
    }

    // 2. Create sample people
    const samplePeople = [
      {
        display_name: 'Alice Johnson',
        email: 'alice@company.com',
        role: 'admin',
        slack_username: 'alice.johnson',
        github_username: 'alicej'
      },
      {
        display_name: 'Bob Smith',
        email: 'bob@company.com', 
        role: 'member',
        slack_username: 'bob.smith',
        github_username: 'bobsmith'
      },
      {
        display_name: 'Carol Davis',
        email: 'carol@company.com',
        role: 'member',
        slack_username: 'carol.davis'
      },
      {
        display_name: 'David Wilson',
        email: 'david@company.com',
        role: 'readonly',
        github_username: 'dwilson'
      }
    ]

    const createdPeople = []
    
    for (const personData of samplePeople) {
      // Check if person already exists
      const { data: existingPerson } = await supabase
        .from('people')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('email', personData.email)
        .single()

      if (existingPerson) {
        console.log(`⏭️ Person ${personData.email} already exists, skipping`)
        continue
      }

      // Create person
      const { data: person, error: personError } = await supabase
        .from('people')
        .insert({
          organization_id: organization.id,
          display_name: personData.display_name,
          email: personData.email,
          role: personData.role,
          is_active: true
        })
        .select()
        .single()

      if (personError) {
        console.error(`Failed to create person ${personData.email}:`, personError)
        continue
      }

      createdPeople.push(person)

      // Create external identities
      const identities = []
      
      if (personData.slack_username) {
        identities.push({
          person_id: person.id,
          platform: 'slack',
          external_id: personData.slack_username,
          username: personData.slack_username
        })
      }

      if (personData.github_username) {
        identities.push({
          person_id: person.id,
          platform: 'github', 
          external_id: personData.github_username,
          username: personData.github_username
        })
      }

      if (identities.length > 0) {
        const { error: identityError } = await supabase
          .from('external_identities')
          .insert(identities)

        if (identityError) {
          console.warn(`Failed to create identities for ${personData.email}:`, identityError)
        }
      }

      console.log(`✅ Created person: ${person.display_name}`)
    }

    // 3. Create some sample topics  
    const sampleTopics = [
      { name: 'React Development', description: 'Frontend development with React' },
      { name: 'Node.js Backend', description: 'Server-side development with Node.js' },
      { name: 'Database Design', description: 'PostgreSQL and database architecture' },
      { name: 'DevOps', description: 'Deployment and infrastructure management' },
      { name: 'API Design', description: 'RESTful and GraphQL API development' }
    ]

    for (const topicData of sampleTopics) {
      const { data: existingTopic } = await supabase
        .from('topics')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('name', topicData.name)
        .single()

      if (existingTopic) {
        console.log(`⏭️ Topic ${topicData.name} already exists, skipping`)
        continue
      }

      const { error: topicError } = await supabase
        .from('topics')
        .insert({
          organization_id: organization.id,
          name: topicData.name,
          canonical_name: topicData.name.toLowerCase().replace(/\s+/g, '_'),
          description: topicData.description,
          is_approved: true,
          emergence_strength: 1.0
        })

      if (topicError) {
        console.error(`Failed to create topic ${topicData.name}:`, topicError)
      } else {
        console.log(`✅ Created topic: ${topicData.name}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sample management data created successfully',
      organization: organization,
      people_created: createdPeople.length
    })

  } catch (error) {
    console.error('Error creating sample management data:', error)
    return NextResponse.json(
      { error: 'Failed to create sample data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}