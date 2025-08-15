-- Fix the similarity function to properly cast double precision to real

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
