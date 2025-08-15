// API endpoint to create sample data for testing the processing pipeline

import { NextRequest, NextResponse } from 'next/server'
import { SampleDataCreator } from '@/core/processing/test/sample-data-creator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      orgName = 'HiMind Demo',
      orgSlug = `himind-demo-${Date.now()}`,
      adminEmail = 'admin@demo.com',
      adminName = 'Demo Admin'
    } = body

    console.log('🏗️ Creating sample data...')
    
    const creator = new SampleDataCreator()
    const result = await creator.createSampleOrganization(
      orgName,
      orgSlug,
      adminEmail,
      adminName
    )

    console.log(`✅ Sample data created successfully`)
    console.log(`📝 Organization: ${result.organization.name} (${result.organization.id})`)
    console.log(`📊 Topics: ${result.topics.created}, Artifacts: ${result.artifacts.created}`)

    return NextResponse.json({
      success: true,
      data: {
        organization: result.organization,
        summary: {
          topics: result.topics.created,
          artifacts: result.artifacts.created
        },
        details: {
          topics: result.topics.topics,
          artifacts: result.artifacts.artifacts
        },
        nextSteps: [
          'Start processing pipeline: POST /api/processing {"action": "start"}',
          `Create batch job: POST /api/processing {"action": "create_batch", "organizationId": "${result.organization.id}"}`,
          'Monitor status: GET /api/processing'
        ]
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error creating sample data:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}