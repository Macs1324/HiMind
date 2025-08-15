-- HiMind Initial Bootstrap Migration
-- Complete database schema for AI-powered knowledge discovery and expert routing
-- This single migration contains everything needed to bootstrap the MVP

-- Extensions for AI/ML capabilities
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop our existing tables if they exist (but keep Supabase's structure intact)
DROP TABLE IF EXISTS search_queries CASCADE;
DROP TABLE IF EXISTS topic_experts CASCADE;
DROP TABLE IF EXISTS knowledge_topic_memberships CASCADE;
DROP TABLE IF EXISTS discovered_topics CASCADE;
DROP TABLE IF EXISTS knowledge_points CASCADE;
DROP TABLE IF EXISTS knowledge_sources CASCADE;
DROP TABLE IF EXISTS external_identities CASCADE;
DROP TABLE IF EXISTS people CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- =========================
-- Core Tables
-- =========================

-- Organizations (workspaces)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- People in the organization
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, email)
);

-- External platform identities (Slack users, GitHub users, etc.)
CREATE TABLE external_identities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('slack', 'github')),
  external_id TEXT NOT NULL, -- Slack user ID, GitHub username
  username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (platform, external_id)
);

-- Raw knowledge sources from various platforms
CREATE TABLE knowledge_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Source identification
  platform TEXT NOT NULL CHECK (platform IN ('slack', 'github')),
  source_type TEXT NOT NULL CHECK (source_type IN ('slack_message', 'slack_thread', 'github_pr', 'github_issue', 'github_comment')),
  external_id TEXT NOT NULL, -- Platform-specific ID
  external_url TEXT, -- Direct link to the source
  
  -- Content
  title TEXT,
  content TEXT NOT NULL,
  
  -- Attribution
  author_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  author_external_id TEXT, -- Fallback if person not linked
  
  -- Timestamps
  platform_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (organization_id, platform, external_id)
);

-- AI-generated knowledge embeddings and metadata
CREATE TABLE knowledge_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL UNIQUE REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  
  -- AI-extracted content summary
  summary TEXT NOT NULL, -- Short, searchable summary of the knowledge
  keywords TEXT[], -- Extracted keywords for search
  
  -- Vector embeddings for semantic search
  embedding VECTOR(1536), -- OpenAI ada-002 dimensions
  
  -- Quality and relevance scoring
  quality_score REAL DEFAULT 0.5 CHECK (quality_score >= 0 AND quality_score <= 1),
  relevance_score REAL DEFAULT 0.5 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  
  -- Processing metadata
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  processing_version TEXT DEFAULT 'v1'
);

-- Auto-discovered topic clusters from embedding analysis
CREATE TABLE discovered_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Topic identity (AI-generated)
  name TEXT NOT NULL,
  description TEXT,
  
  -- Clustering metadata
  cluster_centroid VECTOR(1536), -- Center point of knowledge cluster
  cluster_radius REAL, -- How tight the cluster is
  confidence_score REAL DEFAULT 0.5, -- How confident we are this is a real topic
  
  -- Statistics
  knowledge_point_count INTEGER DEFAULT 0,
  expert_count INTEGER DEFAULT 0,
  
  -- Discovery metadata
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (organization_id, name)
);

-- Many-to-many: Which knowledge points belong to which topics
CREATE TABLE knowledge_topic_memberships (
  knowledge_point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES discovered_topics(id) ON DELETE CASCADE,
  similarity_score REAL NOT NULL, -- How similar this knowledge is to the topic centroid
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (knowledge_point_id, topic_id)
);

-- Auto-discovered expertise based on contribution patterns
CREATE TABLE topic_experts (
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES discovered_topics(id) ON DELETE CASCADE,
  
  -- Expertise scoring
  expertise_score REAL NOT NULL DEFAULT 0.0, -- Computed based on contributions
  contribution_count INTEGER DEFAULT 0, -- Number of knowledge points contributed
  
  -- Recency and activity
  last_contribution_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE, -- Whether this person is still active in this topic
  
  -- Discovery metadata
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (person_id, topic_id)
);

-- Track what people search for to improve the system
CREATE TABLE search_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Query details
  query_text TEXT NOT NULL,
  query_embedding VECTOR(1536), -- Embedding of the search query
  
  -- Results and routing
  matched_knowledge_points UUID[], -- Array of knowledge_point IDs that were returned
  routed_to_expert_id UUID REFERENCES people(id), -- If routed to an expert
  routing_confidence REAL, -- How confident the routing was
  
  -- User interaction
  searcher_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  clicked_results UUID[], -- Which results did they click
  was_helpful BOOLEAN, -- Did they find what they needed
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================
-- Indexes for Performance
-- =========================

-- Knowledge sources
CREATE INDEX idx_knowledge_sources_org_platform ON knowledge_sources(organization_id, platform);
CREATE INDEX idx_knowledge_sources_author ON knowledge_sources(author_person_id);
CREATE INDEX idx_knowledge_sources_created ON knowledge_sources(platform_created_at DESC);

-- Knowledge points
CREATE INDEX idx_knowledge_points_source ON knowledge_points(source_id);
CREATE INDEX idx_knowledge_points_quality ON knowledge_points(quality_score DESC);
CREATE INDEX idx_knowledge_points_embedding ON knowledge_points USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Topics
CREATE INDEX idx_discovered_topics_org ON discovered_topics(organization_id);
CREATE INDEX idx_discovered_topics_confidence ON discovered_topics(confidence_score DESC);
CREATE INDEX idx_discovered_topics_centroid ON discovered_topics USING ivfflat (cluster_centroid vector_cosine_ops) WITH (lists = 50);

-- Experts
CREATE INDEX idx_topic_experts_topic_score ON topic_experts(topic_id, expertise_score DESC);
CREATE INDEX idx_topic_experts_person_active ON topic_experts(person_id) WHERE is_active = TRUE;

-- Search
CREATE INDEX idx_search_queries_org_created ON search_queries(organization_id, created_at DESC);
CREATE INDEX idx_search_queries_embedding ON search_queries USING ivfflat (query_embedding vector_cosine_ops) WITH (lists = 100);

-- Full-text search on knowledge content
CREATE INDEX idx_knowledge_sources_content_fts ON knowledge_sources USING gin(to_tsvector('english', content));
CREATE INDEX idx_knowledge_points_summary_fts ON knowledge_points USING gin(to_tsvector('english', summary));

-- =========================
-- Functions for AI Operations
-- =========================

-- Function to find similar knowledge points using vector similarity
CREATE OR REPLACE FUNCTION find_similar_knowledge(
  query_embedding vector(1536),
  org_id uuid,
  similarity_threshold real DEFAULT 0.8,
  result_limit integer DEFAULT 10
)
RETURNS TABLE (
  knowledge_point_id uuid,
  source_id uuid,
  summary text,
  similarity_score real,
  source_url text,
  source_title text,
  author_name text
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kp.id,
    ks.id,
    kp.summary,
    (1 - (kp.embedding <=> query_embedding))::real as similarity_score,
    ks.external_url,
    ks.title,
    p.display_name
  FROM knowledge_points kp
  JOIN knowledge_sources ks ON kp.source_id = ks.id
  LEFT JOIN people p ON ks.author_person_id = p.id
  WHERE ks.organization_id = org_id
    AND (1 - (kp.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY similarity_score DESC
  LIMIT result_limit;
END $$;

-- Function to find topic experts for routing
CREATE OR REPLACE FUNCTION find_topic_experts(
  topic_id_param uuid,
  limit_count integer DEFAULT 5
)
RETURNS TABLE (
  person_id uuid,
  display_name text,
  expertise_score real,
  contribution_count integer,
  last_contribution_at timestamptz
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.display_name,
    te.expertise_score,
    te.contribution_count,
    te.last_contribution_at
  FROM topic_experts te
  JOIN people p ON te.person_id = p.id
  WHERE te.topic_id = topic_id_param
    AND te.is_active = TRUE
  ORDER BY te.expertise_score DESC, te.last_contribution_at DESC
  LIMIT limit_count;
END $$;

-- =========================
-- Ready for Organization Creation
-- =========================

-- Organizations will be created through the UI setup flow
-- No hardcoded demo data needed