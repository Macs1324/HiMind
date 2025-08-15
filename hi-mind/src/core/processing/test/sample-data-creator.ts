// Utility to create sample content artifacts for testing the processing pipeline

import { DatabaseManager, getServerDb } from '@/lib/database'
import type { ContentSourceType } from '@/types/database'

export interface SampleContent {
  title?: string
  content: string
  sourceType: ContentSourceType
  author: {
    displayName: string
    externalId: string
    platform: string
  }
  metadata?: {
    channel?: string
    repository?: string
    reactions?: Array<{ emoji: string; count: number }>
    [key: string]: any
  }
}

export class SampleDataCreator {
  private db: DatabaseManager

  constructor(db?: DatabaseManager) {
    this.db = db || getServerDb()
  }

  // Create sample Slack messages
  getSampleSlackMessages(): SampleContent[] {
    return [
      {
        content: `Hey team! I just solved a tricky issue with our React components. The problem was that we were calling useState inside a conditional, which violates the Rules of Hooks. 

Here's what I changed:

\`\`\`javascript
// Before (broken)
function MyComponent({ showData }) {
  if (showData) {
    const [data, setData] = useState(null)
  }
  // ...
}

// After (fixed)
function MyComponent({ showData }) {
  const [data, setData] = useState(null)
  
  if (!showData) {
    return null
  }
  // ...
}
\`\`\`

The key insight is that hooks must always be called in the same order on every render. Hope this helps anyone else who runs into this!`,
        sourceType: 'slack_message',
        author: {
          displayName: 'Sarah Chen',
          externalId: 'U12345678',
          platform: 'slack'
        },
        metadata: {
          channel: 'frontend-dev',
          reactions: [
            { emoji: '👍', count: 8 },
            { emoji: '🔥', count: 3 }
          ]
        }
      },
      {
        content: `Quick tip for anyone working with TypeScript and async/await: 

If you're getting "Promise<void> is not assignable to void" errors in your event handlers, you probably need to wrap your async function:

\`\`\`typescript
// Don't do this
<button onClick={async () => await handleSubmit()}>

// Do this instead
<button onClick={() => { handleSubmit() }}>

// Or use a wrapper
const handleClick = async () => {
  await handleSubmit()
}
<button onClick={handleClick}>
\`\`\`

The issue is that React expects event handlers to return void, but async functions return Promise<void>.`,
        sourceType: 'slack_message',
        author: {
          displayName: 'Alex Rodriguez',
          externalId: 'U87654321',
          platform: 'slack'
        },
        metadata: {
          channel: 'typescript-help',
          reactions: [
            { emoji: '💯', count: 12 },
            { emoji: '🙏', count: 5 }
          ]
        }
      },
      {
        content: `Update on the database migration: We've successfully migrated 85% of our user data from MongoDB to PostgreSQL. Performance is looking great so far - query times are down 40% on average.

Key learnings:
• Batch size of 1000 records worked best for our dataset
• Using connection pooling was crucial for maintaining performance
• Indexing strategy needed to be adjusted for PostgreSQL

ETA for completion: Friday EOD. Will post final metrics once we're done.`,
        sourceType: 'slack_message',
        author: {
          displayName: 'Jordan Kim',
          externalId: 'U11111111',
          platform: 'slack'
        },
        metadata: {
          channel: 'backend-eng',
          reactions: [
            { emoji: '🚀', count: 6 },
            { emoji: '📊', count: 2 }
          ]
        }
      }
    ]
  }

  // Create sample GitHub content
  getSampleGitHubContent(): SampleContent[] {
    return [
      {
        title: 'Add user authentication middleware',
        content: `Add user authentication middleware

This PR introduces a new authentication middleware that handles JWT token validation and user session management.

## Changes:
- Added \`authMiddleware.ts\` with token validation logic
- Integrated middleware into Express app configuration
- Added error handling for expired/invalid tokens
- Updated route protection for sensitive endpoints

## Security considerations:
- Tokens are validated using RS256 algorithm
- User roles are checked for authorization
- Rate limiting applied to auth endpoints

## Testing:
- Added unit tests for middleware functions
- Integration tests for protected routes
- Manual testing with various token scenarios

Closes #234`,
        sourceType: 'github_pr',
        author: {
          displayName: 'Maria Santos',
          externalId: 'mariasantos',
          platform: 'github'
        },
        metadata: {
          repository: 'company/backend-api',
          number: 156,
          additions: 247,
          deletions: 12,
          changedFiles: 8
        }
      },
      {
        title: 'Fix memory leak in WebSocket connections',
        content: `Fix memory leak in WebSocket connections

## Problem
WebSocket connections were not being properly cleaned up when users disconnected, leading to memory leaks in long-running server instances.

## Root Cause
The issue was in our connection manager where we were adding event listeners but not removing them when connections closed. Additionally, we weren't properly clearing interval timers used for heartbeat checks.

## Solution
1. Implemented proper cleanup in connection close handlers
2. Added WeakMap for tracking active connections
3. Clear all timers when connections terminate
4. Added connection pooling with automatic cleanup

## Impact
- Memory usage reduced by ~60% during stress testing
- No more gradual memory increase over time
- Better handling of sudden connection drops

## Testing
- Load tested with 10k concurrent connections
- Memory profiling shows stable usage
- Verified cleanup with connection drop scenarios`,
        sourceType: 'github_pr',
        author: {
          displayName: 'David Park',
          externalId: 'davidpark',
          platform: 'github'
        },
        metadata: {
          repository: 'company/realtime-service',
          number: 89,
          additions: 156,
          deletions: 78,
          changedFiles: 5
        }
      },
      {
        title: 'Performance issue with large dataset queries',
        content: `We're experiencing significant performance degradation when querying large datasets (>100k records). Response times have increased from ~200ms to 5-8 seconds.

## Current Query
\`\`\`sql
SELECT u.*, p.name as plan_name 
FROM users u 
LEFT JOIN plans p ON u.plan_id = p.id 
WHERE u.created_at > '2024-01-01' 
ORDER BY u.created_at DESC
\`\`\`

## Environment
- PostgreSQL 14.2
- 850k user records
- Running on AWS RDS (db.r5.large)

## Suspected Issues
1. Missing index on \`created_at\` column
2. Inefficient join strategy
3. Possible table bloat from frequent updates

Has anyone dealt with similar performance issues? Looking for optimization strategies.`,
        sourceType: 'github_issue',
        author: {
          displayName: 'Lisa Wang',
          externalId: 'lisawang',
          platform: 'github'
        },
        metadata: {
          repository: 'company/backend-api',
          number: 278,
          labels: ['performance', 'database', 'bug']
        }
      }
    ]
  }

  // Create sample content artifacts in the database
  async createSampleArtifacts(organizationId: string): Promise<{
    created: number
    artifacts: Array<{ id: string; type: string; title?: string }>
  }> {
    const allSamples = [
      ...this.getSampleSlackMessages(),
      ...this.getSampleGitHubContent()
    ]

    const createdArtifacts = []

    for (const sample of allSamples) {
      try {
        // Create or find person
        const person = await this.createSamplePerson(organizationId, sample.author)
        
        // Create content artifact
        const artifactResult = await this.db.content.createContentArtifact({
          organization_id: organizationId,
          source_type: sample.sourceType,
          external_id: `sample-${Date.now()}-${Math.random().toString(36).substring(2)}`,
          title: sample.title,
          body: sample.content,
          author_person_id: person.id,
          author_external_id: sample.author.externalId,
          platform_created_at: new Date().toISOString(),
          raw_content: {
            sample: true,
            metadata: sample.metadata,
            platform: sample.author.platform
          }
        })

        if (artifactResult.success && artifactResult.data) {
          createdArtifacts.push({
            id: artifactResult.data.id,
            type: sample.sourceType,
            title: sample.title
          })
        }

      } catch (error) {
        console.error('Error creating sample artifact:', error)
      }
    }

    return {
      created: createdArtifacts.length,
      artifacts: createdArtifacts
    }
  }

  private async createSamplePerson(organizationId: string, author: SampleContent['author']) {
    // Try to find existing person first
    const existingPerson = await this.db.people.findPersonByExternalId(
      author.platform, 
      author.externalId
    )

    if (existingPerson.success && existingPerson.data) {
      return existingPerson.data.people
    }

    // Create new person
    const personResult = await this.db.people.createPerson({
      organization_id: organizationId,
      display_name: author.displayName,
      email: `${author.externalId}@example.com`, // Sample email
    })

    if (!personResult.success || !personResult.data) {
      throw new Error(`Failed to create person: ${personResult.error}`)
    }

    // Add external identity
    await this.db.people.addExternalIdentity(personResult.data.id, {
      platform: author.platform,
      external_id: author.externalId,
      username: author.externalId
    })

    return personResult.data
  }

  // Create sample topics for testing
  async createSampleTopics(organizationId: string): Promise<{
    created: number
    topics: Array<{ id: string; name: string }>
  }> {
    const sampleTopics = [
      {
        name: 'React Development',
        description: 'React.js framework, components, hooks, and best practices',
        keywords: ['react', 'jsx', 'hooks', 'components', 'frontend']
      },
      {
        name: 'TypeScript',
        description: 'TypeScript language, type safety, and advanced typing patterns',
        keywords: ['typescript', 'types', 'interfaces', 'generics']
      },
      {
        name: 'Database Optimization',
        description: 'Database performance, query optimization, and scaling strategies',
        keywords: ['database', 'postgresql', 'optimization', 'performance', 'sql']
      },
      {
        name: 'Authentication & Security',
        description: 'User authentication, authorization, JWT tokens, and security practices',
        keywords: ['auth', 'jwt', 'security', 'middleware', 'authentication']
      },
      {
        name: 'Performance Optimization',
        description: 'Application performance, memory management, and optimization techniques',
        keywords: ['performance', 'optimization', 'memory', 'speed', 'profiling']
      }
    ]

    const createdTopics = []

    for (const topicData of sampleTopics) {
      try {
        const result = await this.db.topics.createTopic({
          organization_id: organizationId,
          name: topicData.name,
          description: topicData.description,
          keyword_signatures: topicData.keywords,
          is_cluster_root: false
        })

        if (result.success && result.data) {
          // Approve the topic immediately for testing
          await this.db.topics.approveTopic(result.data.id)
          
          createdTopics.push({
            id: result.data.id,
            name: result.data.name
          })
        }

      } catch (error) {
        console.error('Error creating sample topic:', error)
      }
    }

    return {
      created: createdTopics.length,
      topics: createdTopics
    }
  }

  // Create a complete sample organization with content
  async createSampleOrganization(
    orgName: string, 
    orgSlug: string, 
    adminEmail: string, 
    adminName: string
  ): Promise<{
    organization: any
    topics: { created: number; topics: Array<{ id: string; name: string }> }
    artifacts: { created: number; artifacts: Array<{ id: string; type: string; title?: string }> }
  }> {
    // Create organization using the built-in function
    const orgResult = await this.db.organizations.createOrganization(orgName, orgSlug, {
      sample: true,
      createdBy: 'sample-data-creator',
      createdAt: new Date().toISOString()
    })

    if (!orgResult.success || !orgResult.data) {
      throw new Error(`Failed to create organization: ${orgResult.error}`)
    }

    const organizationId = orgResult.data.id

    // Create admin user
    await this.db.people.createPerson({
      organization_id: organizationId,
      display_name: adminName,
      email: adminEmail,
      role: 'admin'
    })

    // Create sample topics
    const topics = await this.createSampleTopics(organizationId)

    // Create sample content artifacts
    const artifacts = await this.createSampleArtifacts(organizationId)

    return {
      organization: orgResult.data,
      topics,
      artifacts
    }
  }
}

// Convenience function for creating sample data
export async function createSampleData(): Promise<void> {
  const creator = new SampleDataCreator()
  
  console.log('🏗️ Creating sample organization and content...')
  
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
  
  console.log('\n🚀 Ready to test processing pipeline!')
  console.log('Next steps:')
  console.log('1. Start the processing pipeline: POST /api/processing { "action": "start" }')
  console.log(`2. Create batch job: POST /api/processing { "action": "create_batch", "organizationId": "${result.organization.id}" }`)
  console.log('3. Monitor processing status: GET /api/processing')
}