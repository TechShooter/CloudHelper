import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'edge';

/**
 * Document Upload API
 * 
 * Receives parsed text content from the client (PDF/Word/text files parsed
 * in the browser), stores metadata in Supabase, and triggers async ingestion.
 * 
 * POST /api/rag/upload
 * Body: { 
 *   fileName: string,
 *   fileType: 'pdf' | 'docx' | 'txt' | 'md' | 'csv',
 *   content: string,        // Already-parsed text content
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

    const { fileName, fileType, content, workspaceId } = await req.json();

    // Validate fileType
    const ALLOWED_TYPES = ['pdf', 'docx', 'txt', 'md', 'csv'];
    if (!ALLOWED_TYPES.includes(fileType)) {
      return NextResponse.json(
        { error: `Invalid fileType. Allowed: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!fileName || !content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'fileName and content are required' },
        { status: 400 }
      );
    }

    if (content.length > 1_000_000) {
      return NextResponse.json(
        { error: 'File too large. Maximum 1 million characters.' },
        { status: 400 }
      );
    }

    // Generate a unique source ID for this upload
    const sourceId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Step 1: Immediately store the document record in Supabase
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .upsert({
        user_id: user.id,
        source_type: 'uploaded_file',
        source_id: sourceId,
        source_name: fileName,
        workspace_id: workspaceId || null,
        raw_content: content,
        metadata: {
          fileType,
          uploadedAt: new Date().toISOString(),
          charCount: content.length
        },
        status: 'pending'
      })
      .select('id')
      .single();

    if (docError) {
      console.error('[Upload] Error storing document:', docError);
      return NextResponse.json({ error: 'Failed to store document' }, { status: 500 });
    }

    // Step 2: Fire-and-forget trigger the Supabase Edge Function for ingestion
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (accessToken) {
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
            documents: [{
              sourceType: 'uploaded_file',
              sourceId,
              sourceName: fileName,
              rawContent: content,
              metadata: { fileType, uploadedAt: new Date().toISOString() }
            }]
          })
        }).catch(err => {
          console.error('[Upload] Fire-and-forget ingestion error:', err);
        });
      }
    }

    return NextResponse.json({
      success: true,
      document: {
        id: doc.id,
        sourceId,
        fileName,
        fileType,
        charCount: content.length,
        status: 'pending'
      }
    });

  } catch (error: any) {
    console.error('[Upload] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rag/upload
 * Lists all uploaded documents for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');

    let query = supabase
      .from('documents')
      .select('id, source_id, source_name, metadata, status, chunk_count, created_at, last_indexed_at')
      .eq('user_id', user.id)
      .eq('source_type', 'uploaded_file');
    
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    const { data: docs, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      documents: docs || []
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/rag/upload?sourceId=xxx
 * Deletes an uploaded document and its chunks
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sourceId = searchParams.get('sourceId');

    if (!sourceId) {
      return NextResponse.json({ error: 'sourceId is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('user_id', user.id)
      .eq('source_type', 'uploaded_file')
      .eq('source_id', sourceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
