// Generated types for HiMind enhanced database schema

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
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          id: string
          organization_id: string
          auth_user_id: string | null
          display_name: string
          email: string | null
          timezone: string
          bio: string | null
          role: 'admin' | 'member' | 'readonly'
          is_active: boolean
          last_seen_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          auth_user_id?: string | null
          display_name: string
          email?: string | null
          timezone?: string
          bio?: string | null
          role?: 'admin' | 'member' | 'readonly'
          is_active?: boolean
          last_seen_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          auth_user_id?: string | null
          display_name?: string
          email?: string | null
          timezone?: string
          bio?: string | null
          role?: 'admin' | 'member' | 'readonly'
          is_active?: boolean
          last_seen_at?: string | null
          created_at?: string
          updated_at?: string
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
          platform: 'slack' | 'github' | 'linear' | 'jira' | 'confluence' | 'notion' | 'discord'
          external_id: string
          username: string | null
          profile_data: Json
          last_synced_at: string
          created_at: string
        }
        Insert: {
          id?: string
          person_id: string
          platform: 'slack' | 'github' | 'linear' | 'jira' | 'confluence' | 'notion' | 'discord'
          external_id: string
          username?: string | null
          profile_data?: Json
          last_synced_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          person_id?: string
          platform?: 'slack' | 'github' | 'linear' | 'jira' | 'confluence' | 'notion' | 'discord'
          external_id?: string
          username?: string | null
          profile_data?: Json
          last_synced_at?: string
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
      content_artifacts: {
        Row: {
          id: string
          organization_id: string
          source_type: ContentSourceType
          external_id: string | null
          external_url: string | null
          parent_artifact_id: string | null
          title: string | null
          body: string | null
          raw_content: Json | null
          author_person_id: string | null
          author_external_id: string | null
          platform_created_at: string | null
          platform_updated_at: string | null
          is_processed: boolean
          processing_metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          source_type: ContentSourceType
          external_id?: string | null
          external_url?: string | null
          parent_artifact_id?: string | null
          title?: string | null
          body?: string | null
          raw_content?: Json | null
          author_person_id?: string | null
          author_external_id?: string | null
          platform_created_at?: string | null
          platform_updated_at?: string | null
          is_processed?: boolean
          processing_metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          source_type?: ContentSourceType
          external_id?: string | null
          external_url?: string | null
          parent_artifact_id?: string | null
          title?: string | null
          body?: string | null
          raw_content?: Json | null
          author_person_id?: string | null
          author_external_id?: string | null
          platform_created_at?: string | null
          platform_updated_at?: string | null
          is_processed?: boolean
          processing_metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'content_artifacts_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_artifacts_parent_artifact_id_fkey'
            columns: ['parent_artifact_id']
            isOneToOne: false
            referencedRelation: 'content_artifacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_artifacts_author_person_id_fkey'
            columns: ['author_person_id']
            isOneToOne: false
            referencedRelation: 'people'
            referencedColumns: ['id']
          }
        ]
      }
      knowledge_statements: {
        Row: {
          id: string
          organization_id: string
          headline: string
          content: string
          statement_type: StatementType
          source_artifact_id: string | null
          author_person_id: string | null
          context: Json
          confidence_score: number
          source_url: string | null
          related_urls: string[] | null
          content_vector: string | null // vector representation
          search_tokens: unknown // tsvector
          keywords: string[] | null
          quality_score: number
          last_validated_at: string | null
          is_outdated: boolean
          is_public: boolean
          visibility_scope: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          headline: string
          content: string
          statement_type?: StatementType
          source_artifact_id?: string | null
          author_person_id?: string | null
          context?: Json
          confidence_score?: number
          source_url?: string | null
          related_urls?: string[] | null
          content_vector?: string | null
          search_tokens?: unknown
          keywords?: string[] | null
          quality_score?: number
          last_validated_at?: string | null
          is_outdated?: boolean
          is_public?: boolean
          visibility_scope?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          headline?: string
          content?: string
          statement_type?: StatementType
          source_artifact_id?: string | null
          author_person_id?: string | null
          context?: Json
          confidence_score?: number
          source_url?: string | null
          related_urls?: string[] | null
          content_vector?: string | null
          search_tokens?: unknown
          keywords?: string[] | null
          quality_score?: number
          last_validated_at?: string | null
          is_outdated?: boolean
          is_public?: boolean
          visibility_scope?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'knowledge_statements_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'knowledge_statements_source_artifact_id_fkey'
            columns: ['source_artifact_id']
            isOneToOne: false
            referencedRelation: 'content_artifacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'knowledge_statements_author_person_id_fkey'
            columns: ['author_person_id']
            isOneToOne: false
            referencedRelation: 'people'
            referencedColumns: ['id']
          }
        ]
      }
      topics: {
        Row: {
          id: string
          organization_id: string
          name: string
          canonical_name: string | null
          description: string | null
          emergence_strength: number
          keyword_signatures: string[] | null
          topic_vector: string | null // vector representation
          parent_topic_id: string | null
          is_cluster_root: boolean
          statement_count: number
          expert_count: number
          activity_score: number
          is_approved: boolean
          is_archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          canonical_name?: string | null
          description?: string | null
          emergence_strength?: number
          keyword_signatures?: string[] | null
          topic_vector?: string | null
          parent_topic_id?: string | null
          is_cluster_root?: boolean
          statement_count?: number
          expert_count?: number
          activity_score?: number
          is_approved?: boolean
          is_archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          canonical_name?: string | null
          description?: string | null
          emergence_strength?: number
          keyword_signatures?: string[] | null
          topic_vector?: string | null
          parent_topic_id?: string | null
          is_cluster_root?: boolean
          statement_count?: number
          expert_count?: number
          activity_score?: number
          is_approved?: boolean
          is_archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'topics_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'topics_parent_topic_id_fkey'
            columns: ['parent_topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          }
        ]
      }
      statement_topics: {
        Row: {
          id: string
          statement_id: string
          topic_id: string
          relevance_score: number
          extraction_method: string
          created_at: string
        }
        Insert: {
          id?: string
          statement_id: string
          topic_id: string
          relevance_score?: number
          extraction_method?: string
          created_at?: string
        }
        Update: {
          id?: string
          statement_id?: string
          topic_id?: string
          relevance_score?: number
          extraction_method?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'statement_topics_statement_id_fkey'
            columns: ['statement_id']
            isOneToOne: false
            referencedRelation: 'knowledge_statements'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'statement_topics_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          }
        ]
      }
      topic_clusters: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          cluster_vector: string | null // vector representation
          auto_generated: boolean
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          cluster_vector?: string | null
          auto_generated?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          cluster_vector?: string | null
          auto_generated?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'topic_clusters_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      topic_cluster_memberships: {
        Row: {
          cluster_id: string
          topic_id: string
          membership_strength: number
        }
        Insert: {
          cluster_id: string
          topic_id: string
          membership_strength?: number
        }
        Update: {
          cluster_id?: string
          topic_id?: string
          membership_strength?: number
        }
        Relationships: [
          {
            foreignKeyName: 'topic_cluster_memberships_cluster_id_fkey'
            columns: ['cluster_id']
            isOneToOne: false
            referencedRelation: 'topic_clusters'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'topic_cluster_memberships_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          }
        ]
      }
      expertise_signals: {
        Row: {
          id: string
          organization_id: string
          person_id: string
          topic_id: string | null
          signal_type: ExpertiseSignalType
          strength: number
          source_artifact_id: string | null
          statement_id: string | null
          confidence: number
          validation_count: number
          occurred_at: string
          decay_rate: number
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          person_id: string
          topic_id?: string | null
          signal_type: ExpertiseSignalType
          strength?: number
          source_artifact_id?: string | null
          statement_id?: string | null
          confidence?: number
          validation_count?: number
          occurred_at: string
          decay_rate?: number
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          person_id?: string
          topic_id?: string | null
          signal_type?: ExpertiseSignalType
          strength?: number
          source_artifact_id?: string | null
          statement_id?: string | null
          confidence?: number
          validation_count?: number
          occurred_at?: string
          decay_rate?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'expertise_signals_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expertise_signals_person_id_fkey'
            columns: ['person_id']
            isOneToOne: false
            referencedRelation: 'people'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expertise_signals_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          }
        ]
      }
      expertise_scores: {
        Row: {
          person_id: string
          topic_id: string
          raw_score: number
          normalized_score: number
          confidence_level: number
          last_activity_at: string | null
          activity_frequency: number
          score_trend: number
          signal_count: number
          statement_count: number
          is_available_for_questions: boolean
          max_questions_per_week: number
          computed_at: string
        }
        Insert: {
          person_id: string
          topic_id: string
          raw_score?: number
          normalized_score?: number
          confidence_level?: number
          last_activity_at?: string | null
          activity_frequency?: number
          score_trend?: number
          signal_count?: number
          statement_count?: number
          is_available_for_questions?: boolean
          max_questions_per_week?: number
          computed_at?: string
        }
        Update: {
          person_id?: string
          topic_id?: string
          raw_score?: number
          normalized_score?: number
          confidence_level?: number
          last_activity_at?: string | null
          activity_frequency?: number
          score_trend?: number
          signal_count?: number
          statement_count?: number
          is_available_for_questions?: boolean
          max_questions_per_week?: number
          computed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'expertise_scores_person_id_fkey'
            columns: ['person_id']
            isOneToOne: false
            referencedRelation: 'people'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expertise_scores_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          }
        ]
      }
      questions: {
        Row: {
          id: string
          organization_id: string
          title: string | null
          content: string
          question_vector: string | null // vector representation
          search_tokens: unknown // tsvector
          asker_person_id: string | null
          asker_external_id: string | null
          source_platform: string | null
          source_url: string | null
          detected_topics: string[] | null
          urgency: QuestionUrgency
          estimated_complexity: 'simple' | 'moderate' | 'complex' | null
          status: QuestionStatus
          resolution_time_minutes: number | null
          satisfaction_score: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          title?: string | null
          content: string
          question_vector?: string | null
          search_tokens?: unknown
          asker_person_id?: string | null
          asker_external_id?: string | null
          source_platform?: string | null
          source_url?: string | null
          detected_topics?: string[] | null
          urgency?: QuestionUrgency
          estimated_complexity?: 'simple' | 'moderate' | 'complex' | null
          status?: QuestionStatus
          resolution_time_minutes?: number | null
          satisfaction_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          title?: string | null
          content?: string
          question_vector?: string | null
          search_tokens?: unknown
          asker_person_id?: string | null
          asker_external_id?: string | null
          source_platform?: string | null
          source_url?: string | null
          detected_topics?: string[] | null
          urgency?: QuestionUrgency
          estimated_complexity?: 'simple' | 'moderate' | 'complex' | null
          status?: QuestionStatus
          resolution_time_minutes?: number | null
          satisfaction_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'questions_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'questions_asker_person_id_fkey'
            columns: ['asker_person_id']
            isOneToOne: false
            referencedRelation: 'people'
            referencedColumns: ['id']
          }
        ]
      }
      question_routes: {
        Row: {
          id: string
          question_id: string
          route_type: 'auto_answer' | 'expert_route' | 'escalation' | 'no_match'
          target_person_id: string | null
          alternative_experts: string[] | null
          matched_statement_ids: string[] | null
          similarity_score: number | null
          routing_reason: Json | null
          confidence_score: number
          was_successful: boolean | null
          response_time_minutes: number | null
          expert_feedback: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          question_id: string
          route_type: 'auto_answer' | 'expert_route' | 'escalation' | 'no_match'
          target_person_id?: string | null
          alternative_experts?: string[] | null
          matched_statement_ids?: string[] | null
          similarity_score?: number | null
          routing_reason?: Json | null
          confidence_score?: number
          was_successful?: boolean | null
          response_time_minutes?: number | null
          expert_feedback?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          question_id?: string
          route_type?: 'auto_answer' | 'expert_route' | 'escalation' | 'no_match'
          target_person_id?: string | null
          alternative_experts?: string[] | null
          matched_statement_ids?: string[] | null
          similarity_score?: number | null
          routing_reason?: Json | null
          confidence_score?: number
          was_successful?: boolean | null
          response_time_minutes?: number | null
          expert_feedback?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'question_routes_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'questions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'question_routes_target_person_id_fkey'
            columns: ['target_person_id']
            isOneToOne: false
            referencedRelation: 'people'
            referencedColumns: ['id']
          }
        ]
      }
      person_availability: {
        Row: {
          person_id: string
          work_hours_start: number | null
          work_hours_end: number | null
          work_days: number[] | null
          max_questions_per_day: number
          preferred_question_types: string[] | null
          expertise_areas_to_exclude: string[] | null
          notification_methods: Json
          response_time_expectation: string
          is_available: boolean
          out_of_office_until: string | null
          status_message: string | null
          updated_at: string
        }
        Insert: {
          person_id: string
          work_hours_start?: number | null
          work_hours_end?: number | null
          work_days?: number[] | null
          max_questions_per_day?: number
          preferred_question_types?: string[] | null
          expertise_areas_to_exclude?: string[] | null
          notification_methods?: Json
          response_time_expectation?: string
          is_available?: boolean
          out_of_office_until?: string | null
          status_message?: string | null
          updated_at?: string
        }
        Update: {
          person_id?: string
          work_hours_start?: number | null
          work_hours_end?: number | null
          work_days?: number[] | null
          max_questions_per_day?: number
          preferred_question_types?: string[] | null
          expertise_areas_to_exclude?: string[] | null
          notification_methods?: Json
          response_time_expectation?: string
          is_available?: boolean
          out_of_office_until?: string | null
          status_message?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'person_availability_person_id_fkey'
            columns: ['person_id']
            isOneToOne: true
            referencedRelation: 'people'
            referencedColumns: ['id']
          }
        ]
      }
      knowledge_feedback: {
        Row: {
          id: string
          organization_id: string
          statement_id: string | null
          question_route_id: string | null
          feedback_type: FeedbackType
          rating: number | null
          comment: string | null
          reviewer_person_id: string | null
          reviewer_external_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          statement_id?: string | null
          question_route_id?: string | null
          feedback_type: FeedbackType
          rating?: number | null
          comment?: string | null
          reviewer_person_id?: string | null
          reviewer_external_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          statement_id?: string | null
          question_route_id?: string | null
          feedback_type?: FeedbackType
          rating?: number | null
          comment?: string | null
          reviewer_person_id?: string | null
          reviewer_external_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'knowledge_feedback_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'knowledge_feedback_statement_id_fkey'
            columns: ['statement_id']
            isOneToOne: false
            referencedRelation: 'knowledge_statements'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'knowledge_feedback_question_route_id_fkey'
            columns: ['question_route_id']
            isOneToOne: false
            referencedRelation: 'question_routes'
            referencedColumns: ['id']
          }
        ]
      }
      knowledge_metrics: {
        Row: {
          id: string
          organization_id: string
          metric_name: string
          metric_category: string
          value_numeric: number | null
          value_json: Json | null
          entity_type: string | null
          entity_id: string | null
          period_start: string | null
          period_end: string | null
          computed_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          metric_name: string
          metric_category: string
          value_numeric?: number | null
          value_json?: Json | null
          entity_type?: string | null
          entity_id?: string | null
          period_start?: string | null
          period_end?: string | null
          computed_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          metric_name?: string
          metric_category?: string
          value_numeric?: number | null
          value_json?: Json | null
          entity_type?: string | null
          entity_id?: string | null
          period_start?: string | null
          period_end?: string | null
          computed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'knowledge_metrics_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      v_topic_experts: {
        Row: {
          organization_id: string
          topic_id: string
          topic_name: string
          person_id: string
          display_name: string
          normalized_score: number
          confidence_level: number
          last_activity_at: string | null
          is_available_for_questions: boolean
          person_available: boolean | null
        }
        Relationships: []
      }
      v_searchable_statements: {
        Row: {
          id: string
          organization_id: string
          headline: string
          content: string
          statement_type: StatementType
          quality_score: number
          source_url: string | null
          author_name: string | null
          topic_names: string[] | null
          created_at: string
          updated_at: string
        }
        Relationships: []
      }
      v_routing_candidates: {
        Row: {
          question_id: string
          question_content: string
          detected_topics: string[] | null
          person_id: string
          display_name: string
          topic_id: string
          topic_name: string
          normalized_score: number
          confidence_level: number
          is_available: boolean | null
          max_questions_per_day: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_user_organization_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      current_user_is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      content_source_type: ContentSourceType
      statement_type: StatementType
      expertise_signal_type: ExpertiseSignalType
      question_status: QuestionStatus
      question_urgency: QuestionUrgency
      feedback_type: FeedbackType
    }
  }
}

// Enum types
export type ContentSourceType = 
  | 'slack_message'
  | 'slack_thread'
  | 'slack_reaction'
  | 'github_pr'
  | 'github_review'
  | 'github_issue'
  | 'github_commit'
  | 'github_comment'
  | 'linear_issue'
  | 'linear_comment'
  | 'confluence_page'
  | 'notion_page'
  | 'manual_entry'
  | 'api_submission'

export type StatementType = 
  | 'explanation'
  | 'decision'
  | 'solution'
  | 'best_practice'
  | 'warning'
  | 'tip'
  | 'example'
  | 'reference'

export type ExpertiseSignalType = 
  | 'authored_statement'
  | 'helpful_response'
  | 'code_review'
  | 'pr_accepted'
  | 'bug_fix'
  | 'documentation'
  | 'answered_question'
  | 'positive_reaction'
  | 'fast_response'
  | 'detailed_explanation'
  | 'problem_resolution'

export type QuestionStatus = 
  | 'pending'
  | 'routed'
  | 'answered'
  | 'escalated'
  | 'closed'

export type QuestionUrgency = 
  | 'low'
  | 'normal'
  | 'high'
  | 'urgent'

export type FeedbackType = 
  | 'helpful'
  | 'not_helpful'
  | 'outdated'
  | 'incorrect'
  | 'missing_context'

// Helper types for common database operations
export type PersonWithIdentities = Database['public']['Tables']['people']['Row'] & {
  external_identities: Database['public']['Tables']['external_identities']['Row'][]
}

export type StatementWithTopics = Database['public']['Tables']['knowledge_statements']['Row'] & {
  statement_topics: (Database['public']['Tables']['statement_topics']['Row'] & {
    topics: Database['public']['Tables']['topics']['Row']
  })[]
}

export type QuestionWithRoute = Database['public']['Tables']['questions']['Row'] & {
  question_routes: Database['public']['Tables']['question_routes']['Row'][]
}

export type TopicWithExpertise = Database['public']['Tables']['topics']['Row'] & {
  expertise_scores: (Database['public']['Tables']['expertise_scores']['Row'] & {
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