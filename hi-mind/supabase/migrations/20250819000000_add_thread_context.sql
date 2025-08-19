-- Add thread context and enhanced content fields to knowledge sources
-- This enables contextual knowledge extraction from Slack conversations

-- Add thread context fields to knowledge_sources
ALTER TABLE knowledge_sources 
ADD COLUMN thread_ts TEXT, -- Slack thread timestamp
ADD COLUMN parent_message_id TEXT, -- ID of the parent message in thread
ADD COLUMN channel_id TEXT, -- Slack channel ID for context retrieval
ADD COLUMN contextual_content TEXT; -- LLM-enhanced content with conversation context

-- Add index for thread lookups
CREATE INDEX idx_knowledge_sources_thread ON knowledge_sources(thread_ts, channel_id) WHERE thread_ts IS NOT NULL;
CREATE INDEX idx_knowledge_sources_channel_created ON knowledge_sources(channel_id, platform_created_at DESC) WHERE channel_id IS NOT NULL;

-- Add contextual content to knowledge_points for better embeddings
ALTER TABLE knowledge_points 
ADD COLUMN contextual_summary TEXT, -- Summary enhanced with conversation context
ADD COLUMN context_sources TEXT[]; -- References to other messages that provided context

-- Function to get recent channel messages for context
CREATE OR REPLACE FUNCTION get_channel_context(
  channel_id_param TEXT,
  before_timestamp TIMESTAMPTZ,
  message_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  content TEXT,
  author_external_id TEXT,
  platform_created_at TIMESTAMPTZ,
  external_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ks.content,
    ks.author_external_id,
    ks.platform_created_at,
    ks.external_id
  FROM knowledge_sources ks
  WHERE ks.channel_id = channel_id_param
    AND ks.platform_created_at < before_timestamp
    AND ks.platform = 'slack'
  ORDER BY ks.platform_created_at DESC
  LIMIT message_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get thread messages for context
CREATE OR REPLACE FUNCTION get_thread_context(
  thread_ts_param TEXT,
  channel_id_param TEXT
) RETURNS TABLE (
  content TEXT,
  author_external_id TEXT,
  platform_created_at TIMESTAMPTZ,
  external_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ks.content,
    ks.author_external_id,
    ks.platform_created_at,
    ks.external_id
  FROM knowledge_sources ks
  WHERE ks.thread_ts = thread_ts_param
    AND ks.channel_id = channel_id_param
    AND ks.platform = 'slack'
  ORDER BY ks.platform_created_at ASC;
END;
$$ LANGUAGE plpgsql;