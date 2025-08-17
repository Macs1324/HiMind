// Core database utilities and query functions for HiMind (Simplified Schema)

import { createClient } from '@/utils/supabase/client'
import { createServerClient } from '@/utils/supabase/server'
import type { 
  PersonWithIdentities, 
  TopicWithExperts,
  ApiResponse,
  KnowledgeMatch,
  ExpertMatch
} from '@/types/database'

type SupabaseClient = ReturnType<typeof createClient>

// ===========================
// Core Database Client Factory
// ===========================

export const getSupabaseClient = (serverSide = false) => {
  // If we have a service role key and are on server side, use service client
  if (serverSide && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Check if we're in a request context
    try {
      // Try to access cookies to see if we're in a request context
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { cookies } = require('next/headers');
      cookies();
      // We're in a request context, use server client with cookies
      return createServerClient();
    } catch {
      // We're not in a request context (background process, Knowledge Engine, etc.)
      // Use service client instead
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createServiceClient } = require('@/utils/supabase/service');
      return createServiceClient();
    }
  }
  
  return serverSide ? createServerClient() : createClient()
}

// ===========================
// Organization Management
// ===========================

export class OrganizationService {
  constructor(private supabase: SupabaseClient) {}

  async createOrganization(name: string, slug: string) {
    const { data, error } = await this.supabase
      .from('organizations')
      .insert({ name, slug })
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async getOrganization(id: string) {
    const { data, error } = await this.supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async getOrganizationBySlug(slug: string) {
    const { data, error } = await this.supabase
      .from('organizations')
      .select('*')
      .eq('slug', slug)
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async listOrganizations() {
    const { data, error } = await this.supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false })

    return { data: data || [], error: error?.message || null, success: !error }
  }
}

// ===========================
// People Management
// ===========================

export class PeopleService {
  constructor(private supabase: SupabaseClient) {}

  async createPerson(organizationId: string, displayName: string, email?: string) {
    const { data, error } = await this.supabase
      .from('people')
      .insert({
        organization_id: organizationId,
        display_name: displayName,
        email
      })
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async getPerson(id: string): Promise<ApiResponse<PersonWithIdentities>> {
    const { data, error } = await this.supabase
      .from('people')
      .select(`
        *,
        external_identities (*)
      `)
      .eq('id', id)
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async getPersonByExternalId(platform: string, externalId: string) {
    const { data, error } = await this.supabase
      .from('external_identities')
      .select(`
        *,
        people (*)
      `)
      .eq('platform', platform)
      .eq('external_id', externalId)
      .single()

    return { 
      data: data?.people || null, 
      error: error?.message || null, 
      success: !error 
    }
  }

  async getPersonByEmail(email: string, organizationId: string) {
    const { data, error } = await this.supabase
      .from('people')
      .select(`
        *,
        external_identities (*)
      `)
      .eq('email', email.toLowerCase().trim())
      .eq('organization_id', organizationId)
      .single()

    return { 
      data, 
      error: error?.message || null, 
      success: !error 
    }
  }

  async listPeople(organizationId: string): Promise<ApiResponse<PersonWithIdentities[]>> {
    const { data, error } = await this.supabase
      .from('people')
      .select(`
        *,
        external_identities (*)
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    return { data: data || [], error: error?.message || null, success: !error }
  }

  async createExternalIdentity(
    personId: string, 
    platform: 'slack' | 'github', 
    externalId: string, 
    username?: string
  ) {
    const { data, error } = await this.supabase
      .from('external_identities')
      .insert({
        person_id: personId,
        platform,
        external_id: externalId,
        username
      })
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }
}

// ===========================
// Knowledge Management
// ===========================

export class KnowledgeService {
  constructor(private supabase: SupabaseClient) {}

  async createKnowledgeSource(data: {
    organizationId: string
    platform: 'slack' | 'github'
    sourceType: 'slack_message' | 'slack_thread' | 'github_pr' | 'github_issue' | 'github_comment'
    externalId: string
    externalUrl?: string
    title?: string
    content: string
    authorPersonId?: string
    authorExternalId?: string
    platformCreatedAt?: string
  }) {
    const { data: result, error } = await this.supabase
      .from('knowledge_sources')
      .upsert({
        organization_id: data.organizationId,
        platform: data.platform,
        source_type: data.sourceType,
        external_id: data.externalId,
        external_url: data.externalUrl,
        title: data.title,
        content: data.content,
        author_person_id: data.authorPersonId,
        author_external_id: data.authorExternalId,
        platform_created_at: data.platformCreatedAt
      }, {
        onConflict: 'organization_id,platform,external_id'
      })
      .select()
      .single()

    return { data: result, error: error?.message || null, success: !error }
  }

  async createKnowledgePoint(data: {
    sourceId: string
    summary: string
    keywords: string[]
    embedding: number[]
    qualityScore: number
    relevanceScore: number
  }) {
    const { data: result, error } = await this.supabase
      .from('knowledge_points')
      .upsert({
        source_id: data.sourceId,
        summary: data.summary,
        keywords: data.keywords,
        embedding: `[${data.embedding.join(',')}]`, // Convert to postgres vector format
        quality_score: data.qualityScore,
        relevance_score: data.relevanceScore
      }, {
        onConflict: 'source_id'
      })
      .select()
      .single()

    return { data: result, error: error?.message || null, success: !error }
  }

  async searchKnowledge(organizationId: string, queryEmbedding: number[], limit = 10): Promise<ApiResponse<KnowledgeMatch[]>> {
    const { data, error } = await this.supabase
      .rpc('find_similar_knowledge', {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        org_id: organizationId,
        similarity_threshold: 0.7,
        result_limit: limit
      })

    return { data: data || [], error: error?.message || null, success: !error }
  }
}

// ===========================
// Topic Management
// ===========================

export class TopicService {
  constructor(private supabase: SupabaseClient) {}

  async createTopic(data: {
    organizationId: string
    name: string
    description?: string
    clusterCentroid?: number[]
    knowledgePointCount?: number
    confidenceScore?: number
  }) {
    const { data: result, error } = await this.supabase
      .from('discovered_topics')
      .upsert({
        organization_id: data.organizationId,
        name: data.name,
        description: data.description,
        cluster_centroid: data.clusterCentroid ? `[${data.clusterCentroid.join(',')}]` : null,
        knowledge_point_count: data.knowledgePointCount || 0,
        confidence_score: data.confidenceScore || 0.5
      }, {
        onConflict: 'organization_id,name'
      })
      .select()
      .single()

    return { data: result, error: error?.message || null, success: !error }
  }

  async getTopicExperts(topicId: string, limit = 5): Promise<ApiResponse<ExpertMatch[]>> {
    const { data, error } = await this.supabase
      .rpc('find_topic_experts', {
        topic_id_param: topicId,
        limit_count: limit
      })

    return { data: data || [], error: error?.message || null, success: !error }
  }

  async addKnowledgeToTopic(knowledgePointId: string, topicId: string, similarityScore: number) {
    const { data, error } = await this.supabase
      .from('knowledge_topic_memberships')
      .upsert({
        knowledge_point_id: knowledgePointId,
        topic_id: topicId,
        similarity_score: similarityScore
      })
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async listTopics(organizationId: string): Promise<ApiResponse<TopicWithExperts[]>> {
    const { data, error } = await this.supabase
      .from('discovered_topics')
      .select(`
        *,
        topic_experts (
          *,
          people (*)
        )
      `)
      .eq('organization_id', organizationId)
      .order('confidence_score', { ascending: false })

    return { data: data || [], error: error?.message || null, success: !error }
  }
}

// ===========================
// Expert Management
// ===========================

export class ExpertService {
  constructor(private supabase: SupabaseClient) {}

  async createOrUpdateExpert(data: {
    personId: string
    topicId: string
    expertiseScore: number
    contributionCount: number
    lastContributionAt: string
    isActive?: boolean
  }) {
    const { data: result, error } = await this.supabase
      .from('topic_experts')
      .upsert({
        person_id: data.personId,
        topic_id: data.topicId,
        expertise_score: data.expertiseScore,
        contribution_count: data.contributionCount,
        last_contribution_at: data.lastContributionAt,
        is_active: data.isActive ?? true
      }, {
        onConflict: 'person_id,topic_id'
      })
      .select()
      .single()

    return { data: result, error: error?.message || null, success: !error }
  }
}

// ===========================
// Search Query Logging
// ===========================

export class SearchService {
  constructor(private supabase: SupabaseClient) {}

  async logQuery(data: {
    organizationId: string
    queryText: string
    queryEmbedding: number[]
    searcherPersonId?: string
  }) {
    const { data: result, error } = await this.supabase
      .from('search_queries')
      .insert({
        organization_id: data.organizationId,
        query_text: data.queryText,
        query_embedding: `[${data.queryEmbedding.join(',')}]`,
        searcher_person_id: data.searcherPersonId
      })
      .select()
      .single()

    return { data: result, error: error?.message || null, success: !error }
  }
}

// ===========================
// Main Database Manager
// ===========================

export class DatabaseManager {
  public organizations: OrganizationService
  public people: PeopleService
  public knowledge: KnowledgeService
  public topics: TopicService
  public experts: ExpertService
  public search: SearchService

  constructor(serverSide = false) {
    const supabase = getSupabaseClient(serverSide)
    
    this.organizations = new OrganizationService(supabase)
    this.people = new PeopleService(supabase)
    this.knowledge = new KnowledgeService(supabase)
    this.topics = new TopicService(supabase)
    this.experts = new ExpertService(supabase)
    this.search = new SearchService(supabase)
  }
}

// ===========================
// Convenience Exports
// ===========================

// Lazy initialization to avoid circular dependencies
let _db: DatabaseManager | null = null

export function getDatabase(serverSide = false): DatabaseManager {
  if (!_db || (serverSide && !_db.organizations)) {
    _db = new DatabaseManager(serverSide)
  }
  return _db
}

export function resetDatabase(): void {
  _db = null
}