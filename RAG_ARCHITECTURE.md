# RAG Architecture for CloudHelper

## Overview

Retrieval-Augmented Generation (RAG) replaces the current "dump everything into the system prompt" approach with intelligent, semantic retrieval. Instead of sending ALL Notion pages, ALL Google Sheets rows, and ALL notes with every message, we:

1. **Embed** the user's query into a vector (768-dimensional)
2. **Search** a vector database for the most semantically similar document chunks
3. **Inject** only the top 5-8 relevant chunks into the system prompt
4. **Generate** the AI response with this focused context

This reduces prompt size by **80-95%** while maintaining or improving answer quality.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER CHAT FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User Query                                                     │
│      │                                                          │
│      ▼                                                          │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │ /api/rag/search  │───▶│  Gemini Embedding │                   │
│  │  (Edge Route)    │    │  text-embedding-004│                  │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           │                       │                             │
│           │  query_vector         │                             │
│           ▼                       │                             │
│  ┌──────────────────┐             │                             │
│  │  Supabase pgvector│◀───────────┘                             │
│  │  HNSW index      │                                           │
│  │  (cosine search)  │                                           │
│  └────────┬─────────┘                                           │
│           │                                                     │
│           │  top-K chunks                                       │
│           ▼                                                     │
│  ┌──────────────────┐                                           │
│  │  /api/chat       │◀──── RAG context + user query             │
│  │  (Modified)      │                                           │
│  └────────┬─────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  Gemini / Groq API ──────▶ AI Response                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                     INGESTION PIPELINE                          │
│                 (Async - runs in background)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Data Sources                                                   │
│  (Notion, Sheets, Notes, Uploaded Files)                        │
│      │                                                          │
│      ▼                                                          │
│  ┌──────────────────────┐                                       │
│  │ /api/rag/ingest      │── Fire-and-forget trigger             │
│  │ (Edge Route)         │                                       │
│  └──────────┬───────────┘                                       │
│             │                                                   │
│             ▼                                                   │
│  ┌──────────────────────────────────────────┐                   │
│  │  Supabase Edge Function                  │                   │
│  │  rag-ingestion                           │                   │
│  │                                          │                   │
│  │  1. Check content hash (skip if same)    │                   │
│  │  2. Chunk text by source type            │                   │
│  │  3. Generate embeddings (Gemini batch)   │                   │
│  │  4. Store in document_chunks (pgvector)  │                   │
│  └──────────────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### `documents` table
Tracks source documents and their indexing status.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK → auth.users |
| source_type | TEXT | notion_page, google_sheet, user_note, uploaded_file |
| source_id | TEXT | Unique ID from the source (Notion page ID, sheet name, etc.) |
| source_name | TEXT | Human-readable name |
| content_hash | TEXT | SHA-256 of raw content (for incremental updates) |
| raw_content | TEXT | Original text before chunking |
| metadata | JSONB | Flexible metadata (URLs, parent info, timestamps) |
| status | TEXT | pending → indexing → indexed (or error) |
| chunk_count | INT | Number of chunks created |

### `document_chunks` table
Individual searchable chunks with vector embeddings.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| document_id | UUID | FK → documents |
| user_id | UUID | FK → auth.users (for RLS) |
| chunk_index | INT | Position within document (0-based) |
| content | TEXT | Raw chunk text |
| enriched_content | TEXT | Content + source name prefix for better embeddings |
| token_count | INT | Estimated token count |
| embedding | VECTOR(768) | 768-dim vector from Gemini text-embedding-004 |
| metadata | JSONB | Chunk-specific metadata |

## Chunking Strategies

| Source Type | Strategy | Why |
|-------------|----------|-----|
| **Notion Page** | Split on headers (# ## ###), then paragraphs within each section | Headers create natural semantic boundaries |
| **Google Sheet** | Batch 10 rows per chunk, include header row | Individual rows too small; headers provide column context |
| **User Note** | Single chunk if <2000 chars, else split by paragraphs | Notes are typically short and self-contained |
| **Uploaded File** | Paragraph-based splitting with overlap | Generic strategy works well for most text files |

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/rag/search` | POST | Embed query → search pgvector → return top-K chunks |
| `/api/rag/search` | GET | Get indexing status for current user |
| `/api/rag/ingest` | POST | Fire-and-forget trigger for background ingestion |
| `/api/rag/ingest` | GET | Get detailed ingestion status + recent documents |
| Supabase `rag-ingestion` | POST | Edge Function that does the actual chunking/embedding/storage |

## Integration with Existing Chat Route

The modified `app/api/chat/route.ts` will:

1. **Before building the system prompt**, call `/api/rag/search` with the user's latest message
2. **If RAG returns chunks**, inject them as "RETRIEVED CONTEXT" at the top of the system prompt
3. **Still include temporal data** (calendar events, nutrient entries) directly since they're time-sensitive and not well-suited for vector search
4. **Fall back to current behavior** if RAG search fails or returns no results

## Re-indexing Strategy

- **Triggered by**: Data source refresh (Notion sync, sheet reload), app load, or manual "Sync Knowledge Base" button
- **Mechanism**: Fire-and-forget POST to `/api/rag/ingest` → Supabase Edge Function processes asynchronously
- **Incremental updates**: Content hash comparison prevents re-indexing unchanged documents
- **Edge constraint**: The ingestion runs on Supabase (not Cloudflare Edge) which has a longer timeout (~60s+)

## Cost Analysis

| Component | Cost | Notes |
|-----------|------|-------|
| Gemini text-embedding-004 | **Free** | Generous free tier (1500 requests/min) |
| Supabase pgvector | **Free** | Included in Supabase Postgres |
| Supabase Edge Function | **Free** | 500K invocations/month free |
| Additional token savings | **Net savings** | 80-95% fewer prompt tokens per message |

## Migration Steps

1. Run `supabase/rag-migration.sql` in Supabase SQL Editor
2. Add `GEMINI_API_KEY` to Supabase Edge Function environment variables
3. Deploy the `rag-ingestion` Edge Function: `supabase functions deploy rag-ingestion`
4. The Next.js API routes work immediately after deployment
5. Migrate existing data: create a script that reads all current documents and triggers ingestion
6. Modify `ChatInterface.tsx` to call RAG search before sending messages
