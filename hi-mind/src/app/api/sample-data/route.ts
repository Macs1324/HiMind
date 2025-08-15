// Sample Data API - Create sample data for testing

import { NextRequest, NextResponse } from 'next/server'
import { SampleDataCreator } from '@/core/processing/test/sample-data-creator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action !== 'create') {
      return NextResponse.json({
        success: false,
        error: `Unknown action: ${action}`
      }, { status: 400 })
    }

    console.log('🏗️ Creating sample organization and content...')
    
    const creator = new SampleDataCreator()
    const result = await creator.createSampleOrganization(
      'HiMind Demo',
      'himind-demo',
      'admin@himind-demo.com',
      'Demo Admin'
    )

    console.log(`✅ Created sample organization: ${result.organization.name}`)
    console.log(`📝 Created ${result.topics.created} topics`)
    console.log(`📄 Created ${result.artifacts.created} content artifacts`)
    console.log(`🆔 Organization ID: ${result.organization.id}`)

    return NextResponse.json({
      success: true,
      message: 'Sample data created successfully',
      data: {
        organization: result.organization,
        topics: result.topics,
        artifacts: result.artifacts,
        next_steps: [
          'Start the processing pipeline: POST /api/processing { "action": "start" }',
          `Create batch job: POST /api/processing { "action": "create_batch", "organizationId": "${result.organization.id}" }`,
          'Monitor processing status: GET /api/processing'
        ]
      }
    })

  } catch (error) {
    console.error('Sample data creation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}