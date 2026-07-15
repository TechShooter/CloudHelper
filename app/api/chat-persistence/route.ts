import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'edge';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

// GET: Fetch all chat messages for a chat
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
    }

    if (!isValidUUID(chatId)) {
      console.log('[chat-persistence GET] Non-UUID chatId (local chat), returning empty:', chatId);
      return NextResponse.json({ messages: [] });
    }

    console.log('[chat-persistence GET] Loading messages for chatId:', chatId, 'user:', user.id);
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[chat-persistence GET] Error loading messages:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[chat-persistence GET] Loaded messages count:', messages?.length || 0);
    // Transform to match the format expected by ChatInterface
    const transformedMessages = messages?.map(msg => ({
      role: msg.role,
      content: msg.content
    })) || [];

    return NextResponse.json({ messages: transformedMessages });
  } catch (error: any) {
    console.error('[chat-persistence GET] Exception:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Save chat messages for a chat
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId, messages } = await req.json();

    if (!chatId || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'chatId and messages array are required' }, { status: 400 });
    }

    console.log('[chat-persistence POST] Saving messages for chatId:', chatId, 'count:', messages.length, 'user:', user.id);

    if (!isValidUUID(chatId)) {
      console.log('[chat-persistence POST] Non-UUID chatId (local chat), skipping DB persist:', chatId);
      return NextResponse.json({ success: true });
    }

    // Delete existing messages for this chat
    const { error: deleteError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', user.id)
      .eq('chat_id', chatId);

    if (deleteError) {
      console.error('[chat-persistence POST] Error deleting messages:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Insert new messages
    const messagesToInsert = messages
      .filter(msg => msg && msg.role && msg.content)
      .map(msg => ({
      user_id: user.id,
      chat_id: chatId,
      role: msg.role,
      content: msg.content
    }));

    if (messagesToInsert.length > 0) {
      console.log('[chat-persistence POST] Inserting messages:', messagesToInsert.length);
      const { error: insertError } = await supabase
        .from('chat_messages')
        .insert(messagesToInsert);

      if (insertError) {
        console.error('[chat-persistence POST] Error inserting messages:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    // Update chat's updated_at timestamp
    await supabase
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId)
      .eq('user_id', user.id);

    console.log('[chat-persistence POST] Successfully saved messages');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[chat-persistence POST] Exception:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete all chat messages for a chat
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
    }

    if (!isValidUUID(chatId)) {
      return NextResponse.json({ success: true });
    }

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', user.id)
      .eq('chat_id', chatId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
