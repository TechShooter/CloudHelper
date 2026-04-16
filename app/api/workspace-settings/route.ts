import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'edge';

// GET: Fetch workspace settings
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    const settingKey = searchParams.get('settingKey');

    let query = supabase
      .from('workspace_settings')
      .select('*')
      .eq('user_id', user.id);

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    if (settingKey) {
      query = query.eq('setting_key', settingKey);
    }

    const { data: settings, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to frontend format
    const transformedSettings: { [key: string]: any } = {};
    settings?.forEach(setting => {
      const key = `${setting.workspace_id}_${setting.setting_key}`;
      transformedSettings[key] = setting.setting_value;
    });

    return NextResponse.json({ settings: transformedSettings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Save workspace settings
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId, settingKey, settingValue } = await req.json();

    if (!workspaceId || !settingKey) {
      return NextResponse.json({ error: 'workspaceId and settingKey are required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('workspace_settings')
      .upsert({
        user_id: user.id,
        workspace_id: workspaceId,
        setting_key: settingKey,
        setting_value: settingValue
      }, { onConflict: 'user_id,workspace_id,setting_key' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
