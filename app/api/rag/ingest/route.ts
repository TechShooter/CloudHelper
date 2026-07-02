import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'edge';

/**
 * RAG Ingestion Trigger API
 * 
 * Triggers the Supabase Edge Function to asynchronously ingest documents.
 * This route fires the request and returns immediately (fire-and-forget).
 * 
 * POST /api/rag/ingest
 * Body: { 
 *   documents: Array<{
 *     sourceType: string,
 *     sourceId: string,
 *     sourceName: string,
 *     rawContent: string,
 *     metadata?: any
 *   }>,
 *   workspaceId?: string
 * }
 */

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documents, workspaceId } = await req.json();

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json(
        { error: 'documents array is required' },
        { status: 400 }
      );
    }

    // Get the Supabase Edge Function URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Supabase URL not configured' },
        { status: 500 }
      );
    }

    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No access token available' },
        { status: 401 }
      );
    }

    // Fire-and-forget: trigger the Supabase Edge Function
    // We don't await this - it runs asynchronously in the background
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/rag-ingestion`;

    fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'indexDocuments',
        userId: user.id,
        workspaceId,
        documents
      })
    }).catch(err => {
      console.error('[RAG Ingestion] Fire-and-forget error:', err);
    });

    // Return immediately - the Edge Function processes in background
    return NextResponse.json({
      success: true,
      message: `Triggered ingestion for ${documents.length} documents. Processing in background.`,
      documentsCount: documents.length
    });

  } catch (error: any) {
    console.error('[RAG Ingestion] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rag/ingest
 * Returns the current ingestion/indexing status
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: status } = await supabase.rpc('get_indexing_status', {
      match_user_id: user.id
    });

    const { data: recentDocs } = await supabase
      .from('documents')
      .select('source_type, source_name, status, chunk_count, last_indexed_at, error_message')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      success: true,
      status: status?.[0] || {
        total_documents: 0,
        indexed_documents: 0,
        pending_documents: 0,
        error_documents: 0,
        total_chunks: 0,
        last_indexed_at: null
      },
      recentDocuments: recentDocs || []
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
