-- HiMind Enhanced Schema - Optimized for expertise graphs and emerging topic clusters
-- Extensions
create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists "uuid-ossp";

-- =========================
-- Core Organization & Identity
-- =========================

create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  settings jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists people (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  auth_user_id uuid, -- links to auth.users.id (Supabase)
  display_name text not null,
  email text,
  timezone text default 'UTC',
  bio text,
  role text check (role in ('admin', 'member', 'readonly')) default 'member',
  is_active boolean default true,
  last_seen_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (organization_id, email)
);

-- External platform identities (Slack, GitHub, etc.)
create table if not exists external_identities (
  id uuid primary key default uuid_generate_v4(),
  person_id uuid not null references people(id) on delete cascade,
  platform text not null check (platform in ('slack', 'github', 'linear', 'jira', 'confluence', 'notion', 'discord')),
  external_id text not null,
  username text,
  profile_data jsonb default '{}'::jsonb,
  last_synced_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  unique (platform, external_id)
);

-- =========================
-- Content Sources & Artifacts
-- =========================

create type content_source_type as enum (
  'slack_message', 'slack_thread', 'slack_reaction',
  'github_pr', 'github_review', 'github_issue', 'github_commit', 'github_comment',
  'linear_issue', 'linear_comment',
  'confluence_page', 'notion_page',
  'manual_entry', 'api_submission'
);

-- Raw content from various sources
create table if not exists content_artifacts (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  source_type content_source_type not null,
  external_id text, -- ID from the source platform
  external_url text,
  parent_artifact_id uuid references content_artifacts(id), -- for threads/replies
  
  -- Content
  title text,
  body text,
  raw_content jsonb, -- Store original platform-specific data
  
  -- Attribution
  author_person_id uuid references people(id) on delete set null,
  author_external_id text, -- fallback if person not matched yet
  
  -- Metadata
  platform_created_at timestamp with time zone,
  platform_updated_at timestamp with time zone,
  
  -- Processing
  is_processed boolean default false,
  processing_metadata jsonb default '{}'::jsonb,
  
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  unique (organization_id, source_type, external_id)
);

-- =========================
-- Knowledge Statements - Core Knowledge Units
-- =========================

create type statement_type as enum (
  'explanation', 'decision', 'solution', 'best_practice', 
  'warning', 'tip', 'example', 'reference'
);

create table if not exists knowledge_statements (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  
  -- Core content
  headline text not null,
  content text not null,
  statement_type statement_type default 'explanation',
  
  -- Source attribution
  source_artifact_id uuid references content_artifacts(id) on delete set null,
  author_person_id uuid references people(id) on delete set null,
  
  -- Context and metadata
  context jsonb default '{}'::jsonb, -- related technologies, projects, etc.
  confidence_score real default 0.5, -- 0-1 how confident we are in this statement
  
  -- Links and references
  source_url text, -- direct link to original content
  related_urls text[], -- additional reference links
  
  -- Search and discovery
  content_vector vector(1536), -- embedding for semantic search
  search_tokens tsvector, -- full-text search
  keywords text[], -- extracted/manual keywords
  
  -- Quality and freshness
  quality_score real default 0.5, -- based on reactions, usage, feedback
  last_validated_at timestamp with time zone,
  is_outdated boolean default false,
  
  -- Privacy
  is_public boolean default true,
  visibility_scope text[], -- teams or roles that can see this
  
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- =========================
-- Topics - Emerging Knowledge Clusters  
-- =========================

create table if not exists topics (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  
  -- Topic identity
  name text not null,
  canonical_name text, -- normalized version
  description text,
  
  -- Discovery metadata
  emergence_strength real default 1.0, -- how strongly this topic emerged from data
  keyword_signatures text[], -- key terms that define this topic
  topic_vector vector(1536), -- centroid of statements in this topic
  
  -- Hierarchy and relationships
  parent_topic_id uuid references topics(id),
  is_cluster_root boolean default false, -- true for main topic clusters
  
  -- Statistics
  statement_count integer default 0,
  expert_count integer default 0,
  activity_score real default 0.0, -- recent activity in this topic
  
  -- Management
  is_approved boolean default false, -- admin has verified this is a valid topic
  is_archived boolean default false,
  
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  unique (organization_id, canonical_name)
);

-- Many-to-many: statements belong to multiple topics
create table if not exists statement_topics (
  id uuid primary key default uuid_generate_v4(),
  statement_id uuid not null references knowledge_statements(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  relevance_score real default 1.0, -- how relevant is this statement to this topic
  extraction_method text default 'auto', -- 'auto', 'manual', 'ml'
  created_at timestamp with time zone default now(),
  unique (statement_id, topic_id)
);

-- Topic clustering - groups related topics together
create table if not exists topic_clusters (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  cluster_vector vector(1536), -- centroid of all topics in cluster
  auto_generated boolean default true,
  created_at timestamp with time zone default now()
);

create table if not exists topic_cluster_memberships (
  cluster_id uuid not null references topic_clusters(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  membership_strength real default 1.0,
  primary key (cluster_id, topic_id)
);

-- =========================
-- Expertise Graph - Who Knows What
-- =========================

create type expertise_signal_type as enum (
  'authored_statement', 'helpful_response', 'code_review', 'pr_accepted',
  'bug_fix', 'documentation', 'answered_question', 'positive_reaction',
  'fast_response', 'detailed_explanation', 'problem_resolution'
);

-- Individual signals that contribute to expertise
create table if not exists expertise_signals (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  topic_id uuid references topics(id) on delete set null,
  
  -- Signal details
  signal_type expertise_signal_type not null,
  strength real not null default 1.0, -- how strong this signal is
  
  -- Context
  source_artifact_id uuid references content_artifacts(id) on delete set null,
  statement_id uuid references knowledge_statements(id) on delete set null,
  
  -- Quality indicators
  confidence real default 0.5, -- how confident we are in this signal
  validation_count integer default 0, -- how many people validated this
  
  -- Temporal data
  occurred_at timestamp with time zone not null,
  decay_rate real default 0.95, -- how quickly this signal loses relevance
  
  created_at timestamp with time zone default now()
);

-- Computed expertise scores per person per topic
create table if not exists expertise_scores (
  person_id uuid not null references people(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  
  -- Core scores
  raw_score real not null default 0.0, -- sum of all signals
  normalized_score real not null default 0.0, -- 0-1 normalized within org
  confidence_level real not null default 0.0, -- how confident we are in this score
  
  -- Temporal aspects
  last_activity_at timestamp with time zone,
  activity_frequency real default 0.0, -- signals per week
  score_trend real default 0.0, -- increasing/decreasing expertise
  
  -- Computed metadata
  signal_count integer default 0,
  statement_count integer default 0,
  
  -- Availability for routing
  is_available_for_questions boolean default true,
  max_questions_per_week integer default 10,
  
  computed_at timestamp with time zone default now(),
  primary key (person_id, topic_id)
);

-- =========================
-- Question Routing & Knowledge Retrieval
-- =========================

create type question_status as enum ('pending', 'routed', 'answered', 'escalated', 'closed');
create type question_urgency as enum ('low', 'normal', 'high', 'urgent');

create table if not exists questions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  
  -- Question content
  title text,
  content text not null,
  question_vector vector(1536), -- for similarity matching
  search_tokens tsvector,
  
  -- Context
  asker_person_id uuid references people(id) on delete set null,
  asker_external_id text, -- fallback if person not identified
  source_platform text, -- where the question came from
  source_url text,
  
  -- Classification
  detected_topics uuid[], -- array of topic IDs
  urgency question_urgency default 'normal',
  estimated_complexity text check (estimated_complexity in ('simple', 'moderate', 'complex')),
  
  -- Status tracking
  status question_status default 'pending',
  resolution_time_minutes integer,
  satisfaction_score real, -- 1-5 rating from asker
  
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Question routing decisions and outcomes
create table if not exists question_routes (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid not null references questions(id) on delete cascade,
  
  -- Routing decision
  route_type text check (route_type in ('auto_answer', 'expert_route', 'escalation', 'no_match')),
  target_person_id uuid references people(id) on delete set null,
  alternative_experts uuid[], -- backup options
  
  -- Auto-answer details
  matched_statement_ids uuid[], -- statements used to answer
  similarity_score real, -- how well existing knowledge matched
  
  -- Routing rationale
  routing_reason jsonb, -- explanation of why this route was chosen
  confidence_score real default 0.0,
  
  -- Outcome tracking
  was_successful boolean,
  response_time_minutes integer,
  expert_feedback jsonb,
  
  created_at timestamp with time zone default now()
);

-- =========================
-- People Availability & Preferences
-- =========================

create table if not exists person_availability (
  person_id uuid primary key references people(id) on delete cascade,
  
  -- Working hours (stored as hour ranges, e.g., 9-17)
  work_hours_start integer check (work_hours_start >= 0 and work_hours_start <= 23),
  work_hours_end integer check (work_hours_end >= 0 and work_hours_end <= 23),
  work_days integer[] default '{1,2,3,4,5}'::integer[], -- 1=Monday, 7=Sunday
  
  -- Question handling preferences
  max_questions_per_day integer default 5,
  preferred_question_types text[],
  expertise_areas_to_exclude uuid[], -- topic IDs they don't want questions about
  
  -- Communication preferences
  notification_methods jsonb default '{"slack": true, "email": false}'::jsonb,
  response_time_expectation text default '4 hours',
  
  -- Status
  is_available boolean default true,
  out_of_office_until timestamp with time zone,
  status_message text,
  
  updated_at timestamp with time zone default now()
);

-- =========================
-- Knowledge Quality & Feedback
-- =========================

create type feedback_type as enum ('helpful', 'not_helpful', 'outdated', 'incorrect', 'missing_context');

create table if not exists knowledge_feedback (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  
  -- What's being rated
  statement_id uuid references knowledge_statements(id) on delete cascade,
  question_route_id uuid references question_routes(id) on delete cascade,
  
  -- Feedback details
  feedback_type feedback_type not null,
  rating integer check (rating >= 1 and rating <= 5),
  comment text,
  
  -- Attribution
  reviewer_person_id uuid references people(id) on delete set null,
  reviewer_external_id text,
  
  created_at timestamp with time zone default now(),
  
  check ((statement_id is not null) <> (question_route_id is not null))
);

-- =========================
-- Analytics & Metrics
-- =========================

create table if not exists knowledge_metrics (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  
  -- Metric identification
  metric_name text not null,
  metric_category text not null, -- 'expertise', 'routing', 'knowledge_quality', etc.
  
  -- Values
  value_numeric real,
  value_json jsonb,
  
  -- Context
  entity_type text, -- 'person', 'topic', 'statement', 'organization'
  entity_id uuid,
  
  -- Temporal
  period_start timestamp with time zone,
  period_end timestamp with time zone,
  
  computed_at timestamp with time zone default now(),
  
  unique (organization_id, metric_name, entity_type, entity_id, period_start)
);

-- =========================
-- Functions & Triggers
-- =========================

-- Update timestamps
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Populate search vectors
create or replace function update_search_vectors()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'knowledge_statements' then
    new.search_tokens := to_tsvector('english', 
      coalesce(new.headline, '') || ' ' || coalesce(new.content, ''));
  elsif tg_table_name = 'questions' then
    new.search_tokens := to_tsvector('english',
      coalesce(new.title, '') || ' ' || coalesce(new.content, ''));
  end if;
  return new;
end $$;

-- Update topic statistics
create or replace function update_topic_stats()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update topics set 
      statement_count = statement_count + 1,
      updated_at = now()
    where id = new.topic_id;
  elsif tg_op = 'DELETE' then
    update topics set 
      statement_count = statement_count - 1,
      updated_at = now()
    where id = old.topic_id;
  end if;
  return coalesce(new, old);
end $$;

-- Create triggers
create trigger update_organizations_updated_at before update on organizations
  for each row execute function update_updated_at();

create trigger update_people_updated_at before update on people
  for each row execute function update_updated_at();

create trigger update_content_artifacts_updated_at before update on content_artifacts
  for each row execute function update_updated_at();

create trigger update_knowledge_statements_updated_at before update on knowledge_statements
  for each row execute function update_updated_at();

create trigger update_topics_updated_at before update on topics
  for each row execute function update_updated_at();

create trigger update_questions_updated_at before update on questions
  for each row execute function update_updated_at();

create trigger update_knowledge_statements_search before insert or update on knowledge_statements
  for each row execute function update_search_vectors();

create trigger update_questions_search before insert or update on questions
  for each row execute function update_search_vectors();

create trigger update_topic_statement_count after insert or delete on statement_topics
  for each row execute function update_topic_stats();

-- =========================
-- Indexes for Performance
-- =========================

-- Organizations
create index idx_organizations_slug on organizations(slug);

-- People
create index idx_people_org_email on people(organization_id, email);
create index idx_people_auth_user on people(auth_user_id);
create index idx_people_active on people(organization_id, is_active);

-- External identities
create index idx_external_identities_person on external_identities(person_id);
create index idx_external_identities_platform_id on external_identities(platform, external_id);

-- Content artifacts
create index idx_content_artifacts_org_type on content_artifacts(organization_id, source_type);
create index idx_content_artifacts_author on content_artifacts(author_person_id);
create index idx_content_artifacts_parent on content_artifacts(parent_artifact_id);
create index idx_content_artifacts_processed on content_artifacts(is_processed);
create index idx_content_artifacts_external on content_artifacts(source_type, external_id);

-- Knowledge statements
create index idx_knowledge_statements_org on knowledge_statements(organization_id);
create index idx_knowledge_statements_author on knowledge_statements(author_person_id);
create index idx_knowledge_statements_type on knowledge_statements(statement_type);
create index idx_knowledge_statements_public on knowledge_statements(organization_id, is_public);
create index idx_knowledge_statements_quality on knowledge_statements(quality_score desc);
create index idx_knowledge_statements_search on knowledge_statements using gin(search_tokens);
create index idx_knowledge_statements_vector on knowledge_statements 
  using ivfflat (content_vector vector_cosine_ops) with (lists = 100);

-- Topics
create index idx_topics_org_name on topics(organization_id, canonical_name);
create index idx_topics_parent on topics(parent_topic_id);
create index idx_topics_approved on topics(organization_id, is_approved);
create index idx_topics_vector on topics using ivfflat (topic_vector vector_cosine_ops) with (lists = 100);

-- Statement topics
create index idx_statement_topics_statement on statement_topics(statement_id);
create index idx_statement_topics_topic on statement_topics(topic_id);
create index idx_statement_topics_relevance on statement_topics(topic_id, relevance_score desc);

-- Expertise signals
create index idx_expertise_signals_person_topic on expertise_signals(person_id, topic_id);
create index idx_expertise_signals_occurred on expertise_signals(occurred_at desc);
create index idx_expertise_signals_type on expertise_signals(signal_type);

-- Expertise scores
create index idx_expertise_scores_person on expertise_scores(person_id);
create index idx_expertise_scores_topic on expertise_scores(topic_id);
create index idx_expertise_scores_normalized on expertise_scores(topic_id, normalized_score desc);
create index idx_expertise_scores_available on expertise_scores(topic_id, is_available_for_questions, normalized_score desc);

-- Questions
create index idx_questions_org_status on questions(organization_id, status);
create index idx_questions_asker on questions(asker_person_id);
create index idx_questions_urgency on questions(urgency, created_at desc);
create index idx_questions_search on questions using gin(search_tokens);
create index idx_questions_vector on questions using ivfflat (question_vector vector_cosine_ops) with (lists = 100);

-- Question routes
create index idx_question_routes_question on question_routes(question_id);
create index idx_question_routes_target on question_routes(target_person_id);
create index idx_question_routes_type on question_routes(route_type);

-- Feedback
create index idx_knowledge_feedback_statement on knowledge_feedback(statement_id);
create index idx_knowledge_feedback_route on knowledge_feedback(question_route_id);
create index idx_knowledge_feedback_reviewer on knowledge_feedback(reviewer_person_id);

-- Metrics
create index idx_knowledge_metrics_org_category on knowledge_metrics(organization_id, metric_category);
create index idx_knowledge_metrics_entity on knowledge_metrics(entity_type, entity_id);
create index idx_knowledge_metrics_period on knowledge_metrics(period_start, period_end);

-- =========================
-- Row Level Security (RLS)
-- =========================

-- Enable RLS on all tables
alter table organizations enable row level security;
alter table people enable row level security;
alter table external_identities enable row level security;
alter table content_artifacts enable row level security;
alter table knowledge_statements enable row level security;
alter table topics enable row level security;
alter table statement_topics enable row level security;
alter table topic_clusters enable row level security;
alter table topic_cluster_memberships enable row level security;
alter table expertise_signals enable row level security;
alter table expertise_scores enable row level security;
alter table questions enable row level security;
alter table question_routes enable row level security;
alter table person_availability enable row level security;
alter table knowledge_feedback enable row level security;
alter table knowledge_metrics enable row level security;

-- Helper function to get current user's organization
create or replace function current_user_organization_id()
returns uuid language sql stable as $$
  select organization_id from people where auth_user_id = auth.uid() limit 1
$$;

-- Helper function to check if user is admin
create or replace function current_user_is_admin()
returns boolean language sql stable as $$
  select exists(
    select 1 from people 
    where auth_user_id = auth.uid() 
    and role = 'admin'
    and is_active = true
  )
$$;

-- Organization-level policies (users can only see data from their org)
create policy org_isolation_organizations on organizations for all using (id = current_user_organization_id());
create policy org_isolation_people on people for all using (organization_id = current_user_organization_id());
create policy org_isolation_content_artifacts on content_artifacts for all using (organization_id = current_user_organization_id());
create policy org_isolation_knowledge_statements on knowledge_statements for all using (organization_id = current_user_organization_id());
create policy org_isolation_topics on topics for all using (organization_id = current_user_organization_id());
create policy org_isolation_expertise_signals on expertise_signals for all using (organization_id = current_user_organization_id());
create policy org_isolation_questions on questions for all using (organization_id = current_user_organization_id());
create policy org_isolation_knowledge_metrics on knowledge_metrics for all using (organization_id = current_user_organization_id());

-- Public knowledge statements (unless marked private)
create policy public_knowledge_statements on knowledge_statements 
  for select using (is_public = true and organization_id = current_user_organization_id());

-- People can edit their own availability
create policy own_availability on person_availability 
  for all using (person_id in (select id from people where auth_user_id = auth.uid()));

-- =========================
-- Additional RLS Policies for remaining tables
-- =========================

-- External identities (linked to people)
create policy org_isolation_external_identities on external_identities 
  for all using (person_id in (select id from people where organization_id = current_user_organization_id()));

-- Statement topics (linked to statements and topics)
create policy org_isolation_statement_topics on statement_topics 
  for all using (
    statement_id in (select id from knowledge_statements where organization_id = current_user_organization_id())
  );

-- Topic cluster memberships (linked to clusters)
create policy org_isolation_topic_cluster_memberships on topic_cluster_memberships 
  for all using (
    cluster_id in (select id from topic_clusters where organization_id = current_user_organization_id())
  );

-- Topic clusters
create policy org_isolation_topic_clusters on topic_clusters 
  for all using (organization_id = current_user_organization_id());

-- Expertise scores (linked to people and topics)
create policy org_isolation_expertise_scores on expertise_scores 
  for all using (
    person_id in (select id from people where organization_id = current_user_organization_id())
  );

-- Question routes (linked to questions)
create policy org_isolation_question_routes on question_routes 
  for all using (
    question_id in (select id from questions where organization_id = current_user_organization_id())
  );

-- Knowledge feedback
create policy org_isolation_knowledge_feedback on knowledge_feedback 
  for all using (organization_id = current_user_organization_id());

-- Person availability (linked to people)
create policy org_isolation_person_availability on person_availability 
  for all using (
    person_id in (select id from people where organization_id = current_user_organization_id())
  );

-- =========================
-- Essential Database Functions
-- =========================

-- Function to recompute expertise scores (stub for now, implement with actual logic)
create or replace function recompute_expertise_scores(org_id uuid, person_id uuid default null)
returns json language plpgsql as $$
declare
  result json;
begin
  -- This is a placeholder - implement the actual scoring algorithm
  result := '{"status": "success", "message": "Expertise scores recomputation scheduled"}';
  return result;
end $$;

-- Function to find similar questions using vector similarity
create or replace function find_similar_questions(
  org_id uuid,
  query_text text,
  similarity_threshold real default 0.8,
  result_limit integer default 5
)
returns table(
  question_id uuid,
  similarity_score real,
  title text,
  content text,
  created_at timestamp with time zone
) language plpgsql as $$
begin
  -- This is a placeholder - implement vector similarity search
  -- For now, return empty result set
  return query
  select 
    q.id,
    0.0::real as similarity_score,
    q.title,
    q.content,
    q.created_at
  from questions q
  where q.organization_id = org_id
  limit 0;
end $$;

-- Function to calculate knowledge coverage metrics
create or replace function calculate_knowledge_coverage(org_id uuid)
returns json language plpgsql as $$
declare
  result json;
  total_topics integer;
  covered_topics integer;
  total_statements integer;
  quality_statements integer;
begin
  -- Count total and covered topics
  select count(*) into total_topics from topics where organization_id = org_id and is_approved = true;
  select count(distinct topic_id) into covered_topics 
  from expertise_scores es
  join topics t on es.topic_id = t.id
  where t.organization_id = org_id and es.normalized_score > 0.1;
  
  -- Count total and quality statements
  select count(*) into total_statements from knowledge_statements where organization_id = org_id;
  select count(*) into quality_statements from knowledge_statements 
  where organization_id = org_id and quality_score > 0.7;
  
  result := json_build_object(
    'total_topics', total_topics,
    'covered_topics', covered_topics,
    'coverage_percentage', case when total_topics > 0 then round((covered_topics::real / total_topics) * 100, 2) else 0 end,
    'total_statements', total_statements,
    'quality_statements', quality_statements,
    'quality_percentage', case when total_statements > 0 then round((quality_statements::real / total_statements) * 100, 2) else 0 end
  );
  
  return result;
end $$;

-- =========================
-- Useful Views
-- =========================

-- Expertise leaderboard per topic
create or replace view v_topic_experts as
select 
  t.organization_id,
  t.id as topic_id,
  t.name as topic_name,
  es.person_id,
  p.display_name,
  es.normalized_score,
  es.confidence_level,
  es.last_activity_at,
  es.is_available_for_questions,
  pa.is_available as person_available
from expertise_scores es
join topics t on es.topic_id = t.id
join people p on es.person_id = p.id
left join person_availability pa on p.id = pa.person_id
where es.normalized_score > 0.1
order by t.name, es.normalized_score desc;

-- Knowledge statement search with topic context
create or replace view v_searchable_statements as
select 
  ks.id,
  ks.organization_id,
  ks.headline,
  ks.content,
  ks.statement_type,
  ks.quality_score,
  ks.source_url,
  p.display_name as author_name,
  array_agg(distinct t.name) filter (where t.name is not null) as topic_names,
  ks.created_at,
  ks.updated_at
from knowledge_statements ks
left join people p on ks.author_person_id = p.id
left join statement_topics st on ks.id = st.statement_id
left join topics t on st.topic_id = t.id
where ks.is_public = true
group by ks.id, p.display_name;

-- Question routing candidates
create or replace view v_routing_candidates as
select distinct
  q.id as question_id,
  q.content as question_content,
  q.detected_topics,
  es.person_id,
  p.display_name,
  es.topic_id,
  t.name as topic_name,
  es.normalized_score,
  es.confidence_level,
  pa.is_available,
  pa.max_questions_per_day
from questions q
cross join unnest(q.detected_topics) as topic_uuid
join expertise_scores es on es.topic_id = topic_uuid
join people p on es.person_id = p.id
join topics t on es.topic_id = t.id
left join person_availability pa on p.id = pa.person_id
where 
  q.status = 'pending'
  and es.is_available_for_questions = true
  and es.normalized_score > 0.2
  and (pa.is_available is null or pa.is_available = true)
order by es.normalized_score desc, es.confidence_level desc;

-- =========================
-- Sample Data & Setup Functions
-- =========================

-- Function to create a sample organization with initial setup
create or replace function create_sample_organization(
  org_name text,
  org_slug text,
  admin_email text,
  admin_name text
)
returns json language plpgsql as $$
declare
  org_id uuid;
  admin_id uuid;
  result json;
begin
  -- Create organization
  insert into organizations (name, slug, settings)
  values (org_name, org_slug, '{"setup_complete": false}'::jsonb)
  returning id into org_id;
  
  -- Create admin user
  insert into people (organization_id, display_name, email, role, is_active)
  values (org_id, admin_name, admin_email, 'admin', true)
  returning id into admin_id;
  
  -- Create sample topics to get started
  insert into topics (organization_id, name, canonical_name, description, is_approved) values
  (org_id, 'Backend Development', 'backend_development', 'Server-side development, APIs, databases', true),
  (org_id, 'Frontend Development', 'frontend_development', 'Client-side development, UI/UX, web frameworks', true),
  (org_id, 'DevOps', 'devops', 'Infrastructure, deployment, monitoring, CI/CD', true),
  (org_id, 'Product Management', 'product_management', 'Product strategy, roadmaps, user research', true),
  (org_id, 'Data & Analytics', 'data_analytics', 'Data engineering, analytics, machine learning', true);
  
  result := json_build_object(
    'organization_id', org_id,
    'admin_id', admin_id,
    'status', 'success',
    'message', 'Sample organization created successfully'
  );
  
  return result;
end $$;

-- Function to bootstrap a person's expertise based on their role
create or replace function bootstrap_person_expertise(
  person_id_input uuid,
  expertise_areas text[]
)
returns json language plpgsql as $$
declare
  topic_record record;
  signal_count integer := 0;
begin
  -- Add initial expertise signals for each area
  for topic_record in 
    select id, name from topics 
    where canonical_name = any(expertise_areas) 
    and organization_id = (select organization_id from people where id = person_id_input)
  loop
    -- Create some initial signals
    insert into expertise_signals (
      organization_id, person_id, topic_id, signal_type, strength, 
      confidence, occurred_at
    )
    select 
      (select organization_id from people where id = person_id_input),
      person_id_input,
      topic_record.id,
      'authored_statement',
      1.0,
      0.8,
      now() - interval '7 days'
    union all
    select 
      (select organization_id from people where id = person_id_input),
      person_id_input,
      topic_record.id,
      'helpful_response',
      0.8,
      0.7,
      now() - interval '3 days';
    
    -- Create initial expertise score
    insert into expertise_scores (
      person_id, topic_id, raw_score, normalized_score, 
      confidence_level, last_activity_at, signal_count
    ) values (
      person_id_input, topic_record.id, 1.8, 0.6, 
      0.75, now(), 2
    );
    
    signal_count := signal_count + 2;
  end loop;
  
  return json_build_object(
    'person_id', person_id_input,
    'expertise_areas', expertise_areas,
    'signals_created', signal_count,
    'status', 'success'
  );
end $$;

-- =========================
-- Data Validation & Health Checks
-- =========================

-- Function to validate database integrity
create or replace function validate_database_health()
returns json language plpgsql as $$
declare
  result json;
  orphaned_count integer;
  missing_scores integer;
begin
  -- Check for orphaned records
  select count(*) into orphaned_count from (
    select count(*) from external_identities ei 
    left join people p on ei.person_id = p.id 
    where p.id is null
    union all
    select count(*) from statement_topics st 
    left join knowledge_statements ks on st.statement_id = ks.id 
    where ks.id is null
    union all
    select count(*) from expertise_signals es 
    left join people p on es.person_id = p.id 
    where p.id is null
  ) as orphaned;
  
  -- Check for missing expertise scores
  select count(distinct concat(es.person_id, es.topic_id)) into missing_scores
  from expertise_signals es
  left join expertise_scores esc on es.person_id = esc.person_id and es.topic_id = esc.topic_id
  where esc.person_id is null;
  
  result := json_build_object(
    'orphaned_records', orphaned_count,
    'missing_expertise_scores', missing_scores,
    'database_health', case when orphaned_count = 0 and missing_scores = 0 then 'healthy' else 'needs_attention' end,
    'checked_at', now()
  );
  
  return result;
end $$;