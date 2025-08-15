-- Processing Jobs Table for Content Orchestration
-- This handles queued content processing with retry logic and monitoring

create type processing_job_status as enum ('pending', 'processing', 'completed', 'failed', 'retrying');
create type processing_priority as enum ('high', 'normal', 'low');

create table if not exists processing_jobs (
  id text primary key,
  
  -- Content identification
  content_type text not null, -- 'slack_message', 'github_pr', etc.
  content_data jsonb not null, -- Full ContentSource object
  
  -- Processing control
  priority processing_priority default 'normal',
  status processing_job_status default 'pending',
  retry_count integer default 0,
  max_retries integer default 3,
  
  -- Scheduling
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  scheduled_for timestamp with time zone, -- For delayed/retry processing
  started_at timestamp with time zone, -- When processing actually started
  completed_at timestamp with time zone, -- When processing finished
  
  -- Results and errors
  error text, -- Error message if processing failed
  processing_metadata jsonb default '{}'::jsonb, -- Results, timing, etc.
  
  -- Performance tracking
  processing_time_ms integer, -- How long processing took
  
  constraint valid_retry_count check (retry_count >= 0 and retry_count <= max_retries)
);

-- Indexes for efficient queue processing
create index idx_processing_jobs_status on processing_jobs(status);
create index idx_processing_jobs_priority_created on processing_jobs(priority desc, created_at asc) where status = 'pending';
create index idx_processing_jobs_scheduled on processing_jobs(scheduled_for) where scheduled_for is not null;
create index idx_processing_jobs_content_type on processing_jobs(content_type);
create index idx_processing_jobs_created_at on processing_jobs(created_at desc);

-- Update trigger for updated_at
create trigger update_processing_jobs_updated_at before update on processing_jobs
  for each row execute function update_updated_at();

-- RLS (allow all for now)
alter table processing_jobs enable row level security;
create policy allow_all_processing_jobs on processing_jobs for all using (true);

-- Function to clean up old completed/failed jobs
create or replace function cleanup_old_processing_jobs(
  older_than_days integer default 7,
  keep_failed_days integer default 30
)
returns json language plpgsql as $$
declare
  completed_deleted integer;
  failed_deleted integer;
  result json;
begin
  -- Delete old completed jobs
  delete from processing_jobs 
  where status = 'completed' 
    and completed_at < now() - interval '1 day' * older_than_days;
  
  get diagnostics completed_deleted = row_count;
  
  -- Delete old failed jobs (keep them longer for analysis)
  delete from processing_jobs 
  where status = 'failed' 
    and updated_at < now() - interval '1 day' * keep_failed_days;
  
  get diagnostics failed_deleted = row_count;
  
  result := json_build_object(
    'completed_jobs_deleted', completed_deleted,
    'failed_jobs_deleted', failed_deleted,
    'cleanup_date', now()
  );
  
  return result;
end $$;

-- Function to get processing queue statistics
create or replace function get_processing_queue_stats()
returns json language plpgsql as $$
declare
  result json;
  pending_count integer;
  processing_count integer;
  completed_count integer;
  failed_count integer;
  avg_processing_time real;
  total_jobs integer;
begin
  -- Get counts by status
  select count(*) into pending_count from processing_jobs where status = 'pending';
  select count(*) into processing_count from processing_jobs where status = 'processing';
  select count(*) into completed_count from processing_jobs where status = 'completed';
  select count(*) into failed_count from processing_jobs where status = 'failed';
  
  -- Get average processing time for completed jobs
  select avg(processing_time_ms) into avg_processing_time 
  from processing_jobs 
  where status = 'completed' and processing_time_ms is not null;
  
  total_jobs := pending_count + processing_count + completed_count + failed_count;
  
  result := json_build_object(
    'total_jobs', total_jobs,
    'pending_jobs', pending_count,
    'processing_jobs', processing_count,
    'completed_jobs', completed_count,
    'failed_jobs', failed_count,
    'average_processing_time_ms', coalesce(avg_processing_time, 0),
    'queue_health', case 
      when failed_count::real / nullif(total_jobs, 0) > 0.1 then 'unhealthy'
      when pending_count > 100 then 'backlogged'
      else 'healthy'
    end,
    'checked_at', now()
  );
  
  return result;
end $$;

-- Processing Errors Table for Error Tracking and Analysis
create type processing_error_type as enum ('validation', 'processing', 'database', 'api', 'timeout', 'unknown');
create type error_severity as enum ('low', 'medium', 'high', 'critical');

create table if not exists processing_errors (
  id text primary key,
  job_id text, -- references processing_jobs(id), but nullable for non-job errors
  content_type text not null,
  error_type processing_error_type not null,
  error_message text not null,
  error_stack text,
  context jsonb default '{}'::jsonb,
  severity error_severity default 'medium',
  resolved boolean default false,
  resolution text,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Indexes for error analysis
create index idx_processing_errors_job_id on processing_errors(job_id);
create index idx_processing_errors_content_type on processing_errors(content_type);
create index idx_processing_errors_error_type on processing_errors(error_type);
create index idx_processing_errors_severity on processing_errors(severity);
create index idx_processing_errors_resolved on processing_errors(resolved);
create index idx_processing_errors_created_at on processing_errors(created_at desc);

-- RLS for processing errors
alter table processing_errors enable row level security;
create policy allow_all_processing_errors on processing_errors for all using (true);

-- View for monitoring processing jobs
create or replace view v_processing_queue_monitor as
select 
  id,
  content_type,
  priority,
  status,
  retry_count,
  max_retries,
  created_at,
  updated_at,
  scheduled_for,
  case 
    when status = 'processing' and started_at is not null 
    then extract(epoch from (now() - started_at)) * 1000 
  end as current_processing_time_ms,
  case 
    when status = 'pending' and scheduled_for is not null 
    then extract(epoch from (scheduled_for - now()))
    else 0
  end as seconds_until_scheduled,
  processing_time_ms,
  error,
  processing_metadata->'statements_created' as statements_created,
  processing_metadata->'topics_created' as topics_created
from processing_jobs
order by 
  case priority when 'high' then 1 when 'normal' then 2 when 'low' then 3 end,
  created_at desc;

-- Function to get error summary for monitoring
create or replace function get_processing_error_summary(
  timeframe_hours integer default 24
)
returns json language plpgsql as $$
declare
  result json;
  since_time timestamp with time zone;
  total_errors integer;
  critical_errors integer;
  unresolved_errors integer;
begin
  since_time := now() - interval '1 hour' * timeframe_hours;
  
  -- Get error counts
  select count(*) into total_errors 
  from processing_errors 
  where created_at >= since_time;
  
  select count(*) into critical_errors 
  from processing_errors 
  where created_at >= since_time and severity = 'critical';
  
  select count(*) into unresolved_errors 
  from processing_errors 
  where created_at >= since_time and resolved = false;
  
  result := json_build_object(
    'timeframe_hours', timeframe_hours,
    'total_errors', total_errors,
    'critical_errors', critical_errors,
    'unresolved_errors', unresolved_errors,
    'error_rate_per_hour', case when timeframe_hours > 0 then total_errors::real / timeframe_hours else 0 end,
    'resolution_rate', case when total_errors > 0 then ((total_errors - unresolved_errors)::real / total_errors) * 100 else 100 end,
    'health_status', case 
      when critical_errors > 0 then 'critical'
      when unresolved_errors > total_errors * 0.1 then 'degraded'
      when total_errors > timeframe_hours * 10 then 'high_error_rate'
      else 'healthy'
    end,
    'checked_at', now()
  );
  
  return result;
end $$;