-- ============================================================================
-- RAG (Retrieval-Augmented Generation) Migration
-- Enables semantic search over user documents using pgvector + Gemini embeddings
-- ============================================================================

-- Step 1: Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions; -- For GIN trigram indexes on text search

-- Step 2: Create documents table (tracks source documents and their indexing status)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- What kind of document is this?
  source_type TEXT NOT NULL CHECK (source_type IN (
    'notion_page',       -- Notion page content
    'notion_database',    -- Notion database entries
    'google_sheet',       -- Google Sheets data
    'user_note',          -- User-created notes/context
    'uploaded_file',      -- Uploaded file (PDF, text, etc.)
    'calendar_event'      -- Calendar entries (time-aware, not vectorized)
  )),
  
  -- Source identification (e.g., Notion page ID, sheet name, file path)
  source_id TEXT NOT NULL,
  source_name TEXT,        -- Human-readable name (e.g., Notion page title)
  workspace_id TEXT,        -- Which workspace this belongs to
  
  -- Content tracking for incremental updates
  content_hash TEXT,        -- SHA-256 hash of raw content (skip re-indexing if unchanged)
  raw_content TEXT,         -- Original text content before chunking
  metadata JSONB DEFAULT '{}'::jsonb, -- Flexible metadata (URLs, parent IDs, timestamps, etc.)
  
  -- Indexing status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'indexing', 'indexed', 'error')),
  error_message TEXT,       -- Last error if status = 'error'
  chunk_count INTEGER DEFAULT 0,  -- How many chunks were created
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_indexed_at TIMESTAMPTZ,  -- When embeddings were last generated
  
  UNIQUE(user_id, source_type, source_id)
);

-- Step 3: Create document_chunks table (individual searchable chunks with embeddings)
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Chunk data
  chunk_index INTEGER NOT NULL,     -- Position within the document (0-based)
  content TEXT NOT NULL,            -- The actual text chunk
  token_count INTEGER DEFAULT 0,    -- Estimated token count for this chunk
  
  -- Vector embedding (768-dim for Gemini text-embedding-004)
  embedding VECTOR(768),
  
  -- Context for the LLM (title, source info baked into the chunk text)
  enriched_content TEXT,  -- e.g., "Page: My Notes\nSection: Meeting Notes\n---\nactual content..."
  
  -- Metadata for filtering
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(document_id, chunk_index)
);

-- Step 4: Create indexes for performance
CREATE INDEX idx_documents_user_status ON documents(user_id, status);
CREATE INDEX idx_documents_source ON documents(user_id, source_type, source_id);
CREATE INDEX idx_documents_workspace ON documents(workspace_id);

CREATE INDEX idx_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_chunks_user ON document_chunks(user_id);

-- HNSW index for fast approximate nearest neighbor search on embeddings
-- This is critical for sub-100ms retrieval at query time
CREATE INDEX idx_chunks_embedding ON document_chunks 
  USING hnsw (embedding vector_cosine_ops) 
  WITH (m = 16, ef_construction = 200);

-- GIN trigram index for fast ILIKE keyword filtering in hybrid search
CREATE INDEX idx_chunks_content_trgm ON document_chunks 
  USING gin (content gin_trgm_ops);

-- Step 5: Hybrid search function (semantic + keyword)
-- Searches by vector similarity AND optional keyword filter
CREATE OR REPLACE FUNCTION search_document_chunks(
  query_embedding VECTOR(768),
  match_user_id UUID,
  match_count INT DEFAULT 5,
  similarity_threshold FLOAT DEFAULT 0.5,
  keyword_filter TEXT DEFAULT NULL,     -- Optional keyword to filter by
  source_type_filter TEXT DEFAULT NULL  -- Optional: only search certain source types
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_index INT,
  content TEXT,
  enriched_content TEXT,
  metadata JSONB,
  source_type TEXT,
  source_name TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    dc.enriched_content,
    dc.metadata,
    d.source_type,
    d.source_name,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE dc.user_id = match_user_id
    AND dc.embedding IS NOT NULL
    -- Cosine similarity threshold (higher = more similar)
    AND 1 - (dc.embedding <=> query_embedding) > similarity_threshold
    -- Optional keyword filter using PostgreSQL full-text search
    AND (
      keyword_filter IS NULL 
      OR dc.content ILIKE '%' || keyword_filter || '%'
      OR dc.enriched_content ILIKE '%' || keyword_filter || '%'
    )
    -- Optional source type filter
    AND (
      source_type_filter IS NULL
      OR d.source_type = source_type_filter
    )
  ORDER BY dc.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;

-- Step 6: Get document indexing status for a user
CREATE OR REPLACE FUNCTION get_indexing_status(match_user_id UUID)
RETURNS TABLE (
  total_documents BIGINT,
  indexed_documents BIGINT,
  pending_documents BIGINT,
  error_documents BIGINT,
  total_chunks BIGINT,
  last_indexed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_documents,
    COUNT(*) FILTER (WHERE d.status = 'indexed')::BIGINT AS indexed_documents,
    COUNT(*) FILTER (WHERE d.status = 'pending')::BIGINT AS pending_documents,
    COUNT(*) FILTER (WHERE d.status = 'error')::BIGINT AS error_documents,
    COALESCE(SUM(d.chunk_count), 0)::BIGINT AS total_chunks,
    MAX(d.last_indexed_at) AS last_indexed_at
  FROM documents d
  WHERE d.user_id = match_user_id;
END;
$$;

-- Step 7: Trigger for updated_at on documents
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_documents_updated_at ON documents;
CREATE TRIGGER trigger_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

-- Step 8: Enable Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Step 9: RLS Policies for documents
CREATE POLICY "Users can view own documents" ON documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents" ON documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents" ON documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents" ON documents
  FOR DELETE USING (auth.uid() = user_id);

-- Step 10: RLS Policies for document_chunks
CREATE POLICY "Users can view own chunks" ON document_chunks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chunks" ON document_chunks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chunks" ON document_chunks
  FOR DELETE USING (auth.uid() = user_id);

-- Step 11: Grant usage to authenticated users
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT EXECUTE ON FUNCTION search_document_chunks TO authenticated;
GRANT EXECUTE ON FUNCTION get_indexing_status TO authenticated;
