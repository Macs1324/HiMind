// Generated types for HiMind simplified database schema
// This schema aligns with the migration file: 20250815000000_initial_bootstrap.sql

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          id: string
          organization_id: string
          display_name: string
          email: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          display_name: string
          email?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          display_name?: string
          email?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'people_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      external_identities: {
        Row: {
          id: string
          person_id: string
          platform: 'slack' | 'github'
          external_id: string
          username: string | null
          created_at: string
        }
        Insert: {
          id?: string
          person_id: string
          platform: 'slack' | 'github'
          external_id: string
          username?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          person_id?: string
          platform?: 'slack' | 'github'
          external_id?: string
          username?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'external_identities_person_id_fkey'
            columns: ['person_id']
            isOneToOne: false
            referencedRelation: 'people'
            referencedColumns: ['id']
          }
        ]
      }
      knowledge_sources: {
        Row: {
          id: string
          organization_id: string
          platform: 'slack' | 'github'
          source_type: 'slack_message' | 'slack_thread' | 'github_pr' | 'github_issue' | 'github_comment'
          external_id: string
          external_url: string | null
          title: string | null
          content: string
          author_person_id: string | null
          author_external_id: string | null
          platform_created_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          platform: 'slack' | 'github'
          source_type: 'slack_message' | 'slack_thread' | 'github_pr' | 'github_issue' | 'github_comment'
          external_id: string
          external_url?: string | null
          title?: string | null
          content: string
          author_person_id?: string | null
          author_external_id?: string | null
          platform_created_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          platform?: 'slack' | 'github'
          source_type?: 'slack_message' | 'slack_thread' | 'github_pr' | 'github_issue' | 'github_comment'
          external_id?: string
          external_url?: string | null
          title?: string | null
          content?: string
          author_person_id?: string | null
          author_external_id?: string | null
          platform_created_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'knowledge_sources_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'knowledge_sources_author_person_id_fkey'
            columns: ['author_person_id']
            isOneToOne: false
            referencedRelation: 'people'
            referencedColumns: ['id']
          }
        ]
      }
      knowledge_points: {
        Row: {
          id: string
          source_id: string
          summary: string
          keywords: string[] | null
          embedding: string | null // vector representation
          quality_score: number
          relevance_score: number
          processed_at: string
          processing_version: string
        }
        Insert: {
          id?: string
          source_id: string
          summary: string
          keywords?: string[] | null
          embedding?: string | null
          quality_score?: number
          relevance_score?: number
          processed_at?: string
          processing_version?: string
        }
        Update: {
          id?: string
          source_id?: string
          summary?: string
          keywords?: string[] | null
          embedding?: string | null
          quality_score?: number
          relevance_score?: number
          processed_at?: string
          processing_version?: string
        }
        Relationships: [
          {
            foreignKeyName: 'knowledge_points_source_id_fkey'
            columns: ['source_id']
            isOneToOne: true
            referencedRelation: 'knowledge_sources'
            referencedColumns: ['id']
          }
        ]
      }
      discovered_topics: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          cluster_centroid: string | null // vector representation
          knowledge_point_count: number
          confidence_score: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          cluster_centroid?: string | null
          knowledge_point_count?: number
          confidence_score?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          cluster_centroid?: string | null
          knowledge_point_count?: number
          confidence_score?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'discovered_topics_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      knowledge_topic_memberships: {
        Row: {
          id: string
          knowledge_point_id: string
          topic_id: string
          similarity_score: number
          created_at: string
        }
        Insert: {
          id?: string
          knowledge_point_id: string
          topic_id: string
          similarity_score?: number
          created_at?: string
        }
        Update: {
          id?: string
          knowledge_point_id?: string
          topic_id?: string
          similarity_score?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'knowledge_topic_memberships_knowledge_point_id_fkey'
            columns: ['knowledge_point_id']
            isOneToOne: false
            referencedRelation: 'knowledge_points'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'knowledge_topic_memberships_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'discovered_topics'
            referencedColumns: ['id']
          }
        ]
      }
      topic_experts: {
        Row: {
          id: string
          person_id: string
          topic_id: string
          expertise_score: number
          contribution_count: number
          last_contribution_at: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          person_id: string
          topic_id: string
          expertise_score?: number
          contribution_count?: number
          last_contribution_at?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          person_id?: string
          topic_id?: string
          expertise_score?: number
          contribution_count?: number
          last_contribution_at?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'topic_experts_person_id_fkey'
            columns: ['person_id']
            isOneToOne: false
            referencedRelation: 'people'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'topic_experts_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'discovered_topics'
            referencedColumns: ['id']
          }
        ]
      }
      search_queries: {
        Row: {
          id: string
          organization_id: string
          query_text: string
          query_embedding: string | null // vector representation
          matched_knowledge_points: string[] | null
          routed_to_expert_id: string | null
          routing_confidence: number | null
          searcher_person_id: string | null
          clicked_results: string[] | null
          was_helpful: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          query_text: string
          query_embedding?: string | null
          matched_knowledge_points?: string[] | null
          routed_to_expert_id?: string | null
          routing_confidence?: number | null
          searcher_person_id?: string | null
          clicked_results?: string[] | null
          was_helpful?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          query_text?: string
          query_embedding?: string | null
          matched_knowledge_points?: string[] | null
          routed_to_expert_id?: string | null
          routing_confidence?: number | null
          searcher_person_id?: string | null
          clicked_results?: string[] | null
          was_helpful?: boolean | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'search_queries_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'search_queries_routed_to_expert_id_fkey'
            columns: ['routed_to_expert_id']
            isOneToOne: false
            referencedRelation: 'people'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'search_queries_searcher_person_id_fkey'
            columns: ['searcher_person_id']
            isOneToOne: false
            referencedRelation: 'people'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      // Simplified views for knowledge search
      searchable_knowledge: {
        Row: {
          id: string
          organization_id: string
          summary: string
          content: string
          source_url: string | null
          author_name: string | null
          platform: string
          source_type: string
          quality_score: number
          relevance_score: number
          created_at: string
        }
        Relationships: []
      }
    }
    Functions: {
      // Vector similarity search function
      find_similar_knowledge: {
        Args: {
          query_embedding: string
          org_id: string
          similarity_threshold?: number
          result_limit?: number
        }
        Returns: {
          knowledge_point_id: string
          summary: string
          similarity_score: number
          source_url: string | null
          source_title: string | null
          author_name: string | null
          platform: string
        }[]
      }
      // Topic expert finder
      find_topic_experts: {
        Args: {
          topic_id_param: string
          limit_count?: number
        }
        Returns: {
          person_id: string
          display_name: string
          expertise_score: number
          contribution_count: number
          last_contribution_at: string
        }[]
      }
    }
    Enums: {}
  }
}

// Helper types for common database operations
export type PersonWithIdentities = Database['public']['Tables']['people']['Row'] & {
  external_identities: Database['public']['Tables']['external_identities']['Row'][]
}

export type KnowledgeSourceWithPoint = Database['public']['Tables']['knowledge_sources']['Row'] & {
  knowledge_points: Database['public']['Tables']['knowledge_points']['Row'] | null
}

export type TopicWithExperts = Database['public']['Tables']['discovered_topics']['Row'] & {
  topic_experts: (Database['public']['Tables']['topic_experts']['Row'] & {
    people: Database['public']['Tables']['people']['Row']
  })[]
}

// API Response types
export type ApiResponse<T> = {
  data: T | null
  error: string | null
  success: boolean
}

export type PaginatedResponse<T> = ApiResponse<T[]> & {
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
}

// Knowledge Engine specific types
export type KnowledgeMatch = {
  knowledgePointId: string
  summary: string
  similarityScore: number
  sourceUrl: string | null
  sourceTitle: string | null
  authorName: string | null
  platform: string
}

export type ExpertMatch = {
  personId: string
  displayName: string
  expertiseScore: number
  contributionCount: number
  lastContributionAt: string
}

export type SearchResult = {
  query: string
  knowledgeMatches: KnowledgeMatch[]
  suggestedExperts: ExpertMatch[]
  topicMatches: string[]
}