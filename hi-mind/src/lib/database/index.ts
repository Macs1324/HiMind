// Core database utilities and query functions for HiMind

import { createClient } from '@/utils/supabase/client'
import { createServerClient } from '@/utils/supabase/server'
import type { 
  Database, 
  PersonWithIdentities, 
  StatementWithTopics, 
  QuestionWithRoute,
  TopicWithExpertise,
  ApiResponse,
  PaginatedResponse,
  ContentSourceType,
  StatementType,
  ExpertiseSignalType,
  QuestionStatus,
  QuestionUrgency
} from '@/types/database'

type SupabaseClient = ReturnType<typeof createClient>

// ===========================
// Core Database Client Factory
// ===========================

export const getSupabaseClient = (serverSide = false) => {
  return serverSide ? createServerClient() : createClient()
}

// ===========================
// Organization Management
// ===========================

export class OrganizationService {
  constructor(private supabase: SupabaseClient) {}

  async createOrganization(name: string, slug: string, settings = {}) {
    const { data, error } = await this.supabase
      .from('organizations')
      .insert({ name, slug, settings })
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
}

// ===========================
// People & Identity Management
// ===========================

export class PeopleService {
  constructor(private supabase: SupabaseClient) {}

  async createPerson(personData: {
    organization_id: string
    display_name: string
    email?: string
    auth_user_id?: string
    timezone?: string
    role?: 'admin' | 'member' | 'readonly'
  }) {
    const { data, error } = await this.supabase
      .from('people')
      .insert(personData)
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async getPersonWithIdentities(personId: string): Promise<ApiResponse<PersonWithIdentities>> {
    const { data, error } = await this.supabase
      .from('people')
      .select(`
        *,
        external_identities (*)
      `)
      .eq('id', personId)
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async findPersonByExternalId(platform: string, externalId: string) {
    const { data, error } = await this.supabase
      .from('external_identities')
      .select(`
        *,
        people (*)
      `)
      .eq('platform', platform)
      .eq('external_id', externalId)
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async addExternalIdentity(personId: string, identityData: {
    platform: string
    external_id: string
    username?: string
    profile_data?: any
  }) {
    const { data, error } = await this.supabase
      .from('external_identities')
      .insert({ person_id: personId, ...identityData })
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async updatePersonAvailability(personId: string, availability: {
    work_hours_start?: number
    work_hours_end?: number
    work_days?: number[]
    max_questions_per_day?: number
    is_available?: boolean
    status_message?: string
  }) {
    const { data, error } = await this.supabase
      .from('person_availability')
      .upsert({ person_id: personId, ...availability })
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }
}

// ===========================
// Content & Artifact Management
// ===========================

export class ContentService {
  constructor(private supabase: SupabaseClient) {}

  async createContentArtifact(artifactData: {
    organization_id: string
    source_type: ContentSourceType
    external_id?: string
    external_url?: string
    parent_artifact_id?: string
    title?: string
    body?: string
    raw_content?: any
    author_person_id?: string
    author_external_id?: string
    platform_created_at?: string
  }) {
    const { data, error } = await this.supabase
      .from('content_artifacts')
      .insert(artifactData)
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async getUnprocessedArtifacts(organizationId: string, limit = 50) {
    const { data, error } = await this.supabase
      .from('content_artifacts')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_processed', false)
      .order('created_at', { ascending: true })
      .limit(limit)

    return { data, error: error?.message || null, success: !error }
  }

  async markArtifactAsProcessed(artifactId: string, processingMetadata = {}) {
    const { data, error } = await this.supabase
      .from('content_artifacts')
      .update({ 
        is_processed: true, 
        processing_metadata: processingMetadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', artifactId)
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }
}

// ===========================
// Knowledge Statement Management
// ===========================

export class KnowledgeService {
  constructor(private supabase: SupabaseClient) {}

  async createStatement(statementData: {
    organization_id: string
    headline: string
    content: string
    statement_type?: StatementType
    source_artifact_id?: string
    author_person_id?: string
    context?: any
    source_url?: string
    related_urls?: string[]
    keywords?: string[]
    is_public?: boolean
  }) {
    const { data, error } = await this.supabase
      .from('knowledge_statements')
      .insert(statementData)
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async searchStatements(
    organizationId: string, 
    query: string, 
    options: {
      limit?: number
      offset?: number
      topic_ids?: string[]
      statement_types?: StatementType[]
      min_quality_score?: number
    } = {}
  ): Promise<PaginatedResponse<Database['public']['Tables']['knowledge_statements']['Row']>> {
    let queryBuilder = this.supabase
      .from('knowledge_statements')
      .select('*, people!author_person_id(display_name)', { count: 'exact' })
      .eq('organization_id', organizationId)
      .eq('is_public', true)
      .textSearch('search_tokens', query)

    if (options.topic_ids?.length) {
      queryBuilder = queryBuilder.in('id', 
        this.supabase
          .from('statement_topics')
          .select('statement_id')
          .in('topic_id', options.topic_ids)
      )
    }

    if (options.statement_types?.length) {
      queryBuilder = queryBuilder.in('statement_type', options.statement_types)
    }

    if (options.min_quality_score) {
      queryBuilder = queryBuilder.gte('quality_score', options.min_quality_score)
    }

    const { data, error, count } = await queryBuilder
      .order('quality_score', { ascending: false })
      .range(options.offset || 0, (options.offset || 0) + (options.limit || 20) - 1)

    const limit = options.limit || 20
    const offset = options.offset || 0

    return {
      data,
      error: error?.message || null,
      success: !error,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total: count || 0,
        hasMore: (offset + limit) < (count || 0)
      }
    }
  }

  async getStatementWithTopics(statementId: string): Promise<ApiResponse<StatementWithTopics>> {
    const { data, error } = await this.supabase
      .from('knowledge_statements')
      .select(`
        *,
        statement_topics (
          *,
          topics (*)
        )
      `)
      .eq('id', statementId)
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async linkStatementToTopic(statementId: string, topicId: string, relevanceScore = 1.0) {
    const { data, error } = await this.supabase
      .from('statement_topics')
      .insert({
        statement_id: statementId,
        topic_id: topicId,
        relevance_score: relevanceScore
      })
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async updateStatementQuality(statementId: string, qualityScore: number) {
    const { data, error } = await this.supabase
      .from('knowledge_statements')
      .update({ quality_score: qualityScore, updated_at: new Date().toISOString() })
      .eq('id', statementId)
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }
}

// ===========================
// Topic & Clustering Management
// ===========================

export class TopicService {
  constructor(private supabase: SupabaseClient) {}

  async createTopic(topicData: {
    organization_id: string
    name: string
    canonical_name?: string
    description?: string
    keyword_signatures?: string[]
    parent_topic_id?: string
    is_cluster_root?: boolean
  }) {
    const { data, error } = await this.supabase
      .from('topics')
      .insert({
        ...topicData,
        canonical_name: topicData.canonical_name || topicData.name.toLowerCase().replace(/\s+/g, '_')
      })
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async getTopicsWithExpertise(organizationId: string): Promise<ApiResponse<TopicWithExpertise[]>> {
    const { data, error } = await this.supabase
      .from('topics')
      .select(`
        *,
        expertise_scores (
          *,
          people (display_name, email, is_active)
        )
      `)
      .eq('organization_id', organizationId)
      .eq('is_approved', true)
      .order('activity_score', { ascending: false })

    return { data, error: error?.message || null, success: !error }
  }

  async getEmergingTopics(organizationId: string, minEmergenceStrength = 0.5) {
    const { data, error } = await this.supabase
      .from('topics')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_approved', false)
      .gte('emergence_strength', minEmergenceStrength)
      .order('emergence_strength', { ascending: false })

    return { data, error: error?.message || null, success: !error }
  }

  async approveTopic(topicId: string) {
    const { data, error } = await this.supabase
      .from('topics')
      .update({ is_approved: true, updated_at: new Date().toISOString() })
      .eq('id', topicId)
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async createTopicCluster(organizationId: string, name: string, topicIds: string[]) {
    // Create the cluster
    const { data: cluster, error: clusterError } = await this.supabase
      .from('topic_clusters')
      .insert({
        organization_id: organizationId,
        name,
        auto_generated: false
      })
      .select()
      .single()

    if (clusterError) {
      return { data: null, error: clusterError.message, success: false }
    }

    // Add topics to cluster
    const memberships = topicIds.map(topicId => ({
      cluster_id: cluster.id,
      topic_id: topicId,
      membership_strength: 1.0
    }))

    const { error: membershipError } = await this.supabase
      .from('topic_cluster_memberships')
      .insert(memberships)

    return { 
      data: cluster, 
      error: membershipError?.message || null, 
      success: !membershipError 
    }
  }
}

// ===========================
// Expertise & Signal Management
// ===========================

export class ExpertiseService {
  constructor(private supabase: SupabaseClient) {}

  async recordExpertiseSignal(signalData: {
    organization_id: string
    person_id: string
    topic_id?: string
    signal_type: ExpertiseSignalType
    strength?: number
    source_artifact_id?: string
    statement_id?: string
    confidence?: number
    occurred_at: string
  }) {
    const { data, error } = await this.supabase
      .from('expertise_signals')
      .insert(signalData)
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async getExpertiseScores(personId: string, includeUnavailable = false) {
    let query = this.supabase
      .from('expertise_scores')
      .select(`
        *,
        topics (name, description),
        people (display_name)
      `)
      .eq('person_id', personId)
      .gte('normalized_score', 0.1)
      .order('normalized_score', { ascending: false })

    if (!includeUnavailable) {
      query = query.eq('is_available_for_questions', true)
    }

    const { data, error } = await query

    return { data, error: error?.message || null, success: !error }
  }

  async getTopicExperts(topicId: string, limit = 10) {
    const { data, error } = await this.supabase
      .from('v_topic_experts')
      .select('*')
      .eq('topic_id', topicId)
      .eq('is_available_for_questions', true)
      .order('normalized_score', { ascending: false })
      .limit(limit)

    return { data, error: error?.message || null, success: !error }
  }

  async recomputeExpertiseScores(organizationId: string, personId?: string) {
    // This would typically call a stored procedure or edge function
    // For now, we'll implement a basic version
    
    const { data, error } = await this.supabase.rpc('recompute_expertise_scores', {
      org_id: organizationId,
      person_id: personId
    })

    return { data, error: error?.message || null, success: !error }
  }

  async updateExpertiseAvailability(personId: string, topicId: string, isAvailable: boolean) {
    const { data, error } = await this.supabase
      .from('expertise_scores')
      .update({ is_available_for_questions: isAvailable })
      .eq('person_id', personId)
      .eq('topic_id', topicId)
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }
}

// ===========================
// Question & Routing Management
// ===========================

export class QuestionService {
  constructor(private supabase: SupabaseClient) {}

  async createQuestion(questionData: {
    organization_id: string
    title?: string
    content: string
    asker_person_id?: string
    asker_external_id?: string
    source_platform?: string
    source_url?: string
    urgency?: QuestionUrgency
    estimated_complexity?: 'simple' | 'moderate' | 'complex'
  }) {
    const { data, error } = await this.supabase
      .from('questions')
      .insert(questionData)
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async getQuestionWithRoutes(questionId: string): Promise<ApiResponse<QuestionWithRoute>> {
    const { data, error } = await this.supabase
      .from('questions')
      .select(`
        *,
        question_routes (*)
      `)
      .eq('id', questionId)
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async findSimilarQuestions(
    organizationId: string,
    questionText: string,
    similarityThreshold = 0.8,
    limit = 5
  ) {
    // This would use vector similarity search in a real implementation
    const { data, error } = await this.supabase.rpc('find_similar_questions', {
      org_id: organizationId,
      query_text: questionText,
      similarity_threshold: similarityThreshold,
      result_limit: limit
    })

    return { data, error: error?.message || null, success: !error }
  }

  async routeQuestion(questionId: string, routeData: {
    route_type: 'auto_answer' | 'expert_route' | 'escalation' | 'no_match'
    target_person_id?: string
    alternative_experts?: string[]
    matched_statement_ids?: string[]
    similarity_score?: number
    routing_reason?: any
    confidence_score?: number
  }) {
    const { data, error } = await this.supabase
      .from('question_routes')
      .insert({
        question_id: questionId,
        ...routeData
      })
      .select()
      .single()

    if (!error) {
      // Update question status
      await this.supabase
        .from('questions')
        .update({ 
          status: routeData.route_type === 'auto_answer' ? 'answered' : 'routed',
          updated_at: new Date().toISOString()
        })
        .eq('id', questionId)
    }

    return { data, error: error?.message || null, success: !error }
  }

  async getRoutingCandidates(questionId: string) {
    const { data, error } = await this.supabase
      .from('v_routing_candidates')
      .select('*')
      .eq('question_id', questionId)
      .order('normalized_score', { ascending: false })

    return { data, error: error?.message || null, success: !error }
  }

  async updateQuestionStatus(questionId: string, status: QuestionStatus, resolutionTimeMinutes?: number) {
    const updateData: any = { 
      status, 
      updated_at: new Date().toISOString() 
    }
    
    if (resolutionTimeMinutes !== undefined) {
      updateData.resolution_time_minutes = resolutionTimeMinutes
    }

    const { data, error } = await this.supabase
      .from('questions')
      .update(updateData)
      .eq('id', questionId)
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }
}

// ===========================
// Feedback & Quality Management
// ===========================

export class FeedbackService {
  constructor(private supabase: SupabaseClient) {}

  async submitStatementFeedback(feedbackData: {
    organization_id: string
    statement_id: string
    feedback_type: 'helpful' | 'not_helpful' | 'outdated' | 'incorrect' | 'missing_context'
    rating?: number
    comment?: string
    reviewer_person_id?: string
    reviewer_external_id?: string
  }) {
    const { data, error } = await this.supabase
      .from('knowledge_feedback')
      .insert(feedbackData)
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async submitRouteFeedback(feedbackData: {
    organization_id: string
    question_route_id: string
    feedback_type: 'helpful' | 'not_helpful' | 'outdated' | 'incorrect' | 'missing_context'
    rating?: number
    comment?: string
    reviewer_person_id?: string
  }) {
    const { data, error } = await this.supabase
      .from('knowledge_feedback')
      .insert(feedbackData)
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async getStatementFeedback(statementId: string) {
    const { data, error } = await this.supabase
      .from('knowledge_feedback')
      .select(`
        *,
        people!reviewer_person_id (display_name)
      `)
      .eq('statement_id', statementId)
      .order('created_at', { ascending: false })

    return { data, error: error?.message || null, success: !error }
  }
}

// ===========================
// Analytics & Metrics
// ===========================

export class AnalyticsService {
  constructor(private supabase: SupabaseClient) {}

  async recordMetric(metricData: {
    organization_id: string
    metric_name: string
    metric_category: string
    value_numeric?: number
    value_json?: any
    entity_type?: string
    entity_id?: string
    period_start?: string
    period_end?: string
  }) {
    const { data, error } = await this.supabase
      .from('knowledge_metrics')
      .insert(metricData)
      .select()
      .single()

    return { data, error: error?.message || null, success: !error }
  }

  async getOrganizationMetrics(organizationId: string, category?: string) {
    let query = this.supabase
      .from('knowledge_metrics')
      .select('*')
      .eq('organization_id', organizationId)

    if (category) {
      query = query.eq('metric_category', category)
    }

    const { data, error } = await query
      .order('computed_at', { ascending: false })

    return { data, error: error?.message || null, success: !error }
  }

  async getKnowledgeCoverage(organizationId: string) {
    const { data, error } = await this.supabase.rpc('calculate_knowledge_coverage', {
      org_id: organizationId
    })

    return { data, error: error?.message || null, success: !error }
  }
}

// ===========================
// Main Database Manager
// ===========================

export class DatabaseManager {
  public organizations: OrganizationService
  public people: PeopleService
  public content: ContentService
  public knowledge: KnowledgeService
  public topics: TopicService
  public expertise: ExpertiseService
  public questions: QuestionService
  public feedback: FeedbackService
  public analytics: AnalyticsService

  constructor(serverSide = false) {
    const supabase = getSupabaseClient(serverSide)
    
    this.organizations = new OrganizationService(supabase)
    this.people = new PeopleService(supabase)
    this.content = new ContentService(supabase)
    this.knowledge = new KnowledgeService(supabase)
    this.topics = new TopicService(supabase)
    this.expertise = new ExpertiseService(supabase)
    this.questions = new QuestionService(supabase)
    this.feedback = new FeedbackService(supabase)
    this.analytics = new AnalyticsService(supabase)
  }
}

// ===========================
// Convenience Exports
// ===========================

export const db = new DatabaseManager()
export const serverDb = new DatabaseManager(true)

export default DatabaseManager