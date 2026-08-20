import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'edge';

interface ChatRow {
  id: string;
  workspace_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateChatRequest {
  workspaceId?: unknown;
  title?: unknown;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function toChatResponse(chat: ChatRow) {
  return {
    id: chat.id,
    workspaceId: chat.workspace_id,
    title: chat.title || 'New Chat',
    createdAt: chat.created_at,
    updatedAt: chat.updated_at,
  };
}

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null };
  }

  return { supabase, user };
}

// GET: List the authenticated user's chats, optionally limited to one workspace.
export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = new URL(req.url).searchParams.get('workspaceId');
    let query = supabase
      .from('chats')
      .select('id, workspace_id, title, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[chats GET] Failed to load chats:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ chats: (data || []).map(toChatResponse) });
  } catch (error: unknown) {
    console.error('[chats GET] Exception:', error);
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to load chats') }, { status: 500 });
  }
}

// POST: Create a chat owned by the authenticated user.
export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as CreateChatRequest;
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId.trim() : '';
    const title = typeof body.title === 'string' && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : 'New Chat';

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('chats')
      .insert({ user_id: user.id, workspace_id: workspaceId, title })
      .select('id, workspace_id, title, created_at, updated_at')
      .single();

    if (error) {
      console.error('[chats POST] Failed to create chat:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ chat: toChatResponse(data) }, { status: 201 });
  } catch (error: unknown) {
    console.error('[chats POST] Exception:', error);
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to create chat') }, { status: 500 });
  }
}

// DELETE: Delete one chat, or all chats for the authenticated user when no id is given.
export async function DELETE(req: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const chatId = new URL(req.url).searchParams.get('chatId');
    let query = supabase.from('chats').delete().eq('user_id', user.id);
    if (chatId) query = query.eq('id', chatId);

    const { error } = await query;
    if (error) {
      console.error('[chats DELETE] Failed to delete chats:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[chats DELETE] Exception:', error);
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to delete chats') }, { status: 500 });
  }
}
