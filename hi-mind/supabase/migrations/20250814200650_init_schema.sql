-- HiMind – Supabase/Postgres schema (MVP+)
-- Extensions
create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists "uuid-ossp";

-- =========================
-- Organizations & Identity
-- =========================
create table if not exists orgs (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamp with time zone default now()
);

create table if not exists members (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null, -- link to auth.users.id (Supabase)
  display_name text,
  email text,
  tz text default 'UTC',
  role text check (role in ('admin','member')) default 'member',
  created_at timestamp with time zone default now(),
  unique (org_id, user_id)
);

create table if not exists identities (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references members(id) on delete cascade,
  provider text not null check (provider in ('slack','github','linear','jira','confluence','notion')),
  external_user_id text not null,
  handle text,
  meta jsonb default '{}'::jsonb,
  unique (provider, external_user_id)
);

-- =========================
-- Canonical People & Teams
-- =========================
create table if not exists teams (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default now(),
  unique (org_id, name)
);

create table if not exists team_members (
  team_id uuid not null references teams(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  primary key (team_id, member_id)
);

-- =========================
-- Content & Artifacts
-- =========================
create type artifact_kind as enum ('slack_message','slack_thread','github_pr','github_review','github_issue','commit','doc','note','answer','question');

create table if not exists artifacts (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  kind artifact_kind not null,
  source_id text,
  source_url text,
  author_member_id uuid references members(id) on delete set null,
  title text,
  body text,
  body_ts tsvector,
  embedding vector(1536),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  meta jsonb default '{}'::jsonb,
  unique (org_id, kind, source_id)
);

create index if not exists artifacts_org_kind_idx on artifacts(org_id, kind);
create index if not exists artifacts_body_gin on artifacts using gin (body_ts);
create index if not exists artifacts_embedding_idx on artifacts using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table if not exists artifact_links (
  id uuid primary key default uuid_generate_v4(),
  artifact_id uuid not null references artifacts(id) on delete cascade,
  label text,
  url text not null
);

-- =========================
-- Q&A / Statements
-- =========================
create table if not exists statements (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  artifact_id uuid references artifacts(id) on delete set null,
  author_member_id uuid references members(id) on delete set null,
  headline text not null,
  content text not null,
  content_ts tsvector,
  embedding vector(1536),
  attribution jsonb default '{}'::jsonb,
  is_private boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists statements_org_idx on statements(org_id);
create index if not exists statements_content_gin on statements using gin(content_ts);
create index if not exists statements_embedding_idx on statements using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table if not exists statement_links (
  id uuid primary key default uuid_generate_v4(),
  statement_id uuid not null references statements(id) on delete cascade,
  label text,
  url text not null
);

-- =========================
-- Topics & Emerging Clusters
-- =========================
create table if not exists topics (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  description text,
  keywords text[],
  embedding vector(1536),
  created_at timestamp with time zone default now(),
  unique (org_id, name)
);

create table if not exists topic_clusters (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  label text,
  centroid vector(1536),
  created_at timestamp with time zone default now()
);

create table if not exists topic_cluster_membership (
  cluster_id uuid not null references topic_clusters(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  strength real default 1.0,
  primary key (cluster_id, topic_id)
);

create table if not exists topic_tags (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  artifact_id uuid references artifacts(id) on delete cascade,
  statement_id uuid references statements(id) on delete cascade,
  weight real default 1.0,
  created_at timestamp with time zone default now(),
  check ((artifact_id is not null) <> (statement_id is not null))
);

create index if not exists topic_tags_topic_idx on topic_tags(topic_id);
create index if not exists topic_tags_artifact_idx on topic_tags(artifact_id);
create index if not exists topic_tags_statement_idx on topic_tags(statement_id);

-- =========================
-- Signals → Expertise
-- =========================
create type signal_kind as enum ('accepted_pr','code_review','bugfix','message_helpful','answer_accepted','doc_edit','fast_response','reaction','routing_success');

create table if not exists signals (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  topic_id uuid references topics(id) on delete set null,
  artifact_id uuid references artifacts(id) on delete set null,
  statement_id uuid references statements(id) on delete set null,
  kind signal_kind not null,
  weight real not null default 1.0,
  occurred_at timestamp with time zone not null default now(),
  meta jsonb default '{}'::jsonb
);

create index if not exists signals_member_idx on signals(member_id, occurred_at desc);
create index if not exists signals_topic_idx on signals(topic_id, occurred_at desc);

create table if not exists expertise (
  member_id uuid not null references members(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  score real not null,
  confidence real not null,
  last_seen_at timestamp with time zone,
  primary key (member_id, topic_id)
);

-- =========================
-- Routing & Feedback
-- =========================
create type route_status as enum ('pending','routed','answered','escalated','closed');
create table if not exists questions (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  asker_member_id uuid references members(id) on delete set null,
  text text not null,
  text_ts tsvector,
  embedding vector(1536),
  urgency int default 0,
  created_at timestamp with time zone default now()
);

create index if not exists questions_embedding_idx on questions using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists questions_text_gin on questions using gin(text_ts);

create table if not exists routes (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid not null references questions(id) on delete cascade,
  candidates jsonb not null,
  chosen_member_id uuid references members(id) on delete set null,
  status route_status not null default 'pending',
  created_at timestamp with time zone default now(),
  answered_statement_id uuid references statements(id) on delete set null
);

create table if not exists feedback (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  statement_id uuid references statements(id) on delete set null,
  route_id uuid references routes(id) on delete set null,
  is_upvote boolean,
  comment text,
  created_at timestamp with time zone default now()
);

-- =========================
-- Availability
-- =========================
create table if not exists availability (
  member_id uuid primary key references members(id) on delete cascade,
  tz text,
  quiet_hours int4range,
  preferred_hours int4range,
  meta jsonb default '{}'::jsonb,
  updated_at timestamp with time zone default now()
);

-- =========================
-- Triggers & helper functions
-- =========================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger artifacts_updated_at
before update on artifacts
for each row execute procedure set_updated_at();

create trigger statements_updated_at
before update on statements
for each row execute procedure set_updated_at();

create or replace function populate_tsvectors()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'artifacts' then
    new.body_ts := to_tsvector('simple', coalesce(new.body,''));
  elsif tg_table_name = 'statements' then
    new.content_ts := to_tsvector('simple', coalesce(new.content,''));
  elsif tg_table_name = 'questions' then
    new.text_ts := to_tsvector('simple', coalesce(new.text,''));
  end if;
  return new;
end $$;

create trigger artifacts_fts before insert or update on artifacts
for each row execute procedure populate_tsvectors();

create trigger statements_fts before insert or update on statements
for each row execute procedure populate_tsvectors();

create trigger questions_fts before insert or update on questions
for each row execute procedure populate_tsvectors();

-- Embedding stub (replace with Edge Function call in app code)
create or replace function compute_embedding_stub(_text text)
returns vector language sql immutable as $$
  select ('[' || rpad('', 1536*2-1, '0,') || '0' || ']')::vector
$$;

-- =========================
-- Views
-- =========================
create or replace view v_statement_quicklinks as
select s.id as statement_id, s.headline, s.created_at, s.attribution,
       coalesce(json_agg(json_build_object('label', l.label, 'url', l.url)) filter (where l.id is not null), '[]'::json) as links
from statements s
left join statement_links l on l.statement_id = s.id
group by s.id;

create or replace view v_expertise as
select e.member_id, m.display_name, e.topic_id, t.name as topic, e.score, e.confidence, e.last_seen_at
from expertise e
join members m on m.id = e.member_id
join topics t on t.id = e.topic_id;

-- =========================
-- RLS (basic example policies)
-- =========================
alter table orgs enable row level security;
alter table members enable row level security;
alter table identities enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table artifacts enable row level security;
alter table artifact_links enable row level security;
alter table statements enable row level security;
alter table statement_links enable row level security;
alter table topics enable row level security;
alter table topic_clusters enable row level security;
alter table topic_cluster_membership enable row level security;
alter table topic_tags enable row level security;
alter table signals enable row level security;
alter table expertise enable row level security;
alter table questions enable row level security;
alter table routes enable row level security;
alter table feedback enable row level security;
alter table availability enable row level security;

create or replace function current_member_org()
returns uuid language sql stable as $$
  select (select org_id from members where user_id = auth.uid() limit 1)
$$;

create policy org_read_artifacts on artifacts for select using (org_id = current_member_org());
create policy org_read_statements on statements for select using (org_id = current_member_org());
create policy org_read_topics on topics for select using (org_id = current_member_org());
create policy org_read_questions on questions for select using (org_id = current_member_org());
create policy org_read_routes on routes for select using (exists (select 1 from questions q where q.id = question_id and q.org_id = current_member_org()));
