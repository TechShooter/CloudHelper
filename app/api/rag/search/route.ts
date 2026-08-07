import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'edge';

/**
 * RAG Retrieval API
 * 
 * Embeds the user's query via Gemini, searches pgvector for the most
 * relevant document chunks, and returns them for injection into the chat prompt.
 * 
 * POST /api/rag/search
 * Body: { query: string, topK?: number, sourceTypes?: string[] }
 * Response: { chunks: Array<{ content, sourceName, sourceType, similarity }> }
 */

interface SearchChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  enriched_content: string;
  metadata: any;
  source_type: string;
  source_name: string;
  similarity: number;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, topK = 5, sourceTypes, similarityThreshold = 0.5 } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const geminiKey = req.headers.get('x-api-key-gemini') || process.env.GEMINI_API_KEY || '';

    if (!geminiKey) {
      return NextResponse.json(
        { error: 'Gemini API key required for embeddings' },
        { status: 500 }
      );
    }

    // Step 1: Generate embedding for the query
    const embUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiKey}`;
    const embeddingResponse = await fetch(embUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text: query.trim() }] },
        outputDimensionality: 768,
      })
    });

    if (!embeddingResponse.ok) {
      const body = await embeddingResponse.text().catch(() => 'Unknown error');
      console.error(`[RAG] Embedding API error (HTTP ${embeddingResponse.status})
URL: ${embUrl}
Response: ${body}`);
      return NextResponse.json({
        error: `Gemini Embedding API error (HTTP ${embeddingResponse.status}). Check your Gemini API key has access to gemini-embedding-001.`,
        errorDetail: body,
        chunks: []
      }, { status: 500 });
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.embedding?.values;

    if (!queryEmbedding || queryEmbedding.length === 0) {
      return NextResponse.json(
        { error: 'Empty embedding returned', chunks: [] },
        { status: 500 }
      );
    }

    // Step 2: Search pgvector for similar chunks
    // If multiple source types are specified, call RPC once per type and merge results
    let allChunks: SearchChunk[] = [];

    if (sourceTypes && sourceTypes.length > 0) {
      // Search each source type separately and merge
      for (const sourceType of sourceTypes) {
        const { data: chunks, error: searchError } = await supabase.rpc(
          'search_document_chunks',
          {
            query_embedding: queryEmbedding,
            match_user_id: user.id,
            match_count: topK,
            similarity_threshold: similarityThreshold,
            keyword_filter: null,
            source_type_filter: sourceType
          }
        );

        if (!searchError && chunks) {
          allChunks = allChunks.concat(chunks as SearchChunk[]);
        }
      }
      
      // Re-sort by similarity and take topK
      allChunks.sort((a, b) => b.similarity - a.similarity);
      allChunks = allChunks.slice(0, topK);
    } else {
      const { data: chunks, error: searchError } = await supabase.rpc(
        'search_document_chunks',
        {
          query_embedding: queryEmbedding,
          match_user_id: user.id,
          match_count: topK,
          similarity_threshold: similarityThreshold,
          keyword_filter: null,
          source_type_filter: null
        }
      );

      if (searchError) {
        console.error('[RAG] Search error:', searchError);
        return NextResponse.json(
          { error: 'Failed to search documents', chunks: [] },
          { status: 500 }
        );
      }

      allChunks = (chunks as SearchChunk[]) || [];
    }

    // Step 3: Format results
    const formattedChunks = allChunks.map(chunk => ({
      id: chunk.id,
      content: chunk.content,
      enrichedContent: chunk.enriched_content,
      sourceName: chunk.source_name,
      sourceType: chunk.source_type,
      similarity: Math.round(chunk.similarity * 100) / 100,
      metadata: chunk.metadata
    }));

    return NextResponse.json({
      success: true,
      query,
      chunks: formattedChunks,
      totalFound: formattedChunks.length
    });

  } catch (error: any) {
    console.error('[RAG] Error:', error);
    return NextResponse.json(
      { error: error.message, chunks: [] },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rag/search
 * Returns indexing status for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: status, error } = await supabase.rpc('get_indexing_status', {
      match_user_id: user.id
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      status: status?.[0] || {
        total_documents: 0,
        indexed_documents: 0,
        pending_documents: 0,
        error_documents: 0,
        total_chunks: 0,
        last_indexed_at: null
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
