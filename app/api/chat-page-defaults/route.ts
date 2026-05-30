import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all default pages for this workspace
    const { data, error } = await supabase
      .from('chat_page_defaults')
      .select('page_id, page_title')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('Error fetching page defaults:', error);
      return NextResponse.json({ error: 'Failed to fetch defaults' }, { status: 500 });
    }

    return NextResponse.json({ defaults: data || [] });
  } catch (error: any) {
    console.error('Error in chat-page-defaults GET:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, pageId, pageTitle, isDefault } = body;

    if (!workspaceId || !pageId) {
      return NextResponse.json({ error: 'workspaceId and pageId are required' }, { status: 400 });
    }

    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isDefault) {
      // Add/update default page
      const { error } = await supabase
        .from('chat_page_defaults')
        .upsert(
          {
            user_id: user.id,
            workspace_id: workspaceId,
            page_id: pageId,
            page_title: pageTitle || 'Untitled',
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id,workspace_id,page_id' }
        );

      if (error) {
        console.error('Error upserting page default:', error);
        return NextResponse.json({ error: 'Failed to save default' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Page marked as default' });
    } else {
      // Remove default page
      const { error } = await supabase
        .from('chat_page_defaults')
        .delete()
        .eq('user_id', user.id)
        .eq('workspace_id', workspaceId)
        .eq('page_id', pageId);

      if (error) {
        console.error('Error deleting page default:', error);
        return NextResponse.json({ error: 'Failed to remove default' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Page removed from defaults' });
    }
  } catch (error: any) {
    console.error('Error in chat-page-defaults POST:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
