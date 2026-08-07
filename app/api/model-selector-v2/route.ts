import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'edge';

type RowData = Record<string, string>;


function normalizeRowData(input: any): RowData {
  const output: RowData = {};
  if (!input || typeof input !== 'object') return output;

  for (const [key, value] of Object.entries(input)) {
    output[key] = value == null ? '' : String(value);
  }

  return output;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('model_selector_v2_rows')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rows: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action || 'create';

    if (action === 'createBackup') {
      const { data: rows, error: rowsError } = await supabase
        .from('model_selector_v2_rows')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })
        .order('updated_at', { ascending: false });

      if (rowsError) {
        return NextResponse.json({ error: rowsError.message }, { status: 500 });
      }

      const backupPayload = {
        createdAt: new Date().toISOString(),
        rowCount: (rows || []).length,
        reason: String(body.reason || 'manual'),
        rows: rows || [],
      };

      const { error: backupError } = await supabase
        .from('workspace_settings')
        .upsert({
          user_id: user.id,
          workspace_id: 'model_selector_v2',
          setting_key: 'last_backup',
          setting_value: backupPayload,
        }, { onConflict: 'user_id,workspace_id,setting_key' });

      if (backupError) {
        return NextResponse.json({ error: backupError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, backup: backupPayload });
    }

    if (action === 'restoreBackup') {
      const { data: setting, error: backupReadError } = await supabase
        .from('workspace_settings')
        .select('setting_value')
        .eq('user_id', user.id)
        .eq('workspace_id', 'model_selector_v2')
        .eq('setting_key', 'last_backup')
        .maybeSingle();

      if (backupReadError) {
        return NextResponse.json({ error: backupReadError.message }, { status: 500 });
      }

      const backupValue = setting?.setting_value as any;
      const backupRows = Array.isArray(backupValue?.rows) ? backupValue.rows : null;

      if (!backupRows) {
        return NextResponse.json({ error: 'No backup found' }, { status: 404 });
      }

      const { error: deleteError } = await supabase
        .from('model_selector_v2_rows')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      if (backupRows.length > 0) {
        const rowsToInsert = backupRows.map((row: any) => ({
          id: row.id,
          user_id: user.id,
          slug: String(row.slug || row?.row_data?.Model || row?.row_data?.Name || row?.row_data?.name || `row-${Date.now()}`),
          row_data: normalizeRowData(row.row_data || {}),
          sheet_source_id: row.sheet_source_id || null,
          sheet_source_name: row.sheet_source_name || null,
          sheet_row_number: row.sheet_row_number || null,
          sort_order: row.sort_order ?? 0,
          is_enabled: row.is_enabled ?? true,
        }));

        const { error: insertError } = await supabase
          .from('model_selector_v2_rows')
          .insert(rowsToInsert);

        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true, restoredRows: backupRows.length, restoredAt: new Date().toISOString() });
    }

    if (action === 'resetAll') {
      const { error: deleteError } = await supabase
        .from('model_selector_v2_rows')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, reset: true });
    }

    if (action === 'create') {
      const rowData = normalizeRowData(body.rowData || body.row_data || {});
      const slug = String(rowData.Model || rowData.Name || rowData.name || `row-${Date.now()}`);

      const { data, error } = await supabase
        .from('model_selector_v2_rows')
        .insert({
          user_id: user.id,
          slug: slug,
          row_data: rowData,
          sheet_source_id: body.sheetSourceId || null,
          sheet_source_name: body.sheetSourceName || null,
          sheet_row_number: body.sheetRowNumber || null,
          sort_order: body.sortOrder ?? 0,
          is_enabled: body.isEnabled ?? true,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ row: data });
    }

    if (action === 'addColumn') {
      const columnName = String(body.columnName || '').trim();

      if (!columnName) {
        return NextResponse.json({ error: 'columnName is required' }, { status: 400 });
      }

      const { data: rows, error: selectError } = await supabase
        .from('model_selector_v2_rows')
        .select('id, row_data')
        .eq('user_id', user.id);

      if (selectError) {
        return NextResponse.json({ error: selectError.message }, { status: 500 });
      }

      const updates = (rows || []).map(async (row) => {
        const currentData = normalizeRowData(row.row_data || {});
        if (Object.prototype.hasOwnProperty.call(currentData, columnName)) {
          return null;
        }

        const { error } = await supabase
          .from('model_selector_v2_rows')
          .update({
            row_data: {
              ...currentData,
              [columnName]: '',
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)
          .eq('user_id', user.id);

        if (error) {
          throw new Error(error.message);
        }

        return true;
      });

      await Promise.all(updates);

      return NextResponse.json({ success: true, columnName });
    }

    if (action === 'renameColumn') {
      const oldColumnName = String(body.oldColumnName || '').trim();
      const newColumnName = String(body.newColumnName || '').trim();

      if (!oldColumnName || !newColumnName) {
        return NextResponse.json({ error: 'oldColumnName and newColumnName are required' }, { status: 400 });
      }

      if (oldColumnName === newColumnName) {
        return NextResponse.json({ success: true, oldColumnName, newColumnName, renamedRows: 0 });
      }

      const { data: rows, error: selectError } = await supabase
        .from('model_selector_v2_rows')
        .select('id, row_data')
        .eq('user_id', user.id);

      if (selectError) {
        return NextResponse.json({ error: selectError.message }, { status: 500 });
      }

      const conflictingRow = (rows || []).find((row) => {
        const currentData = normalizeRowData(row.row_data || {});
        return Object.prototype.hasOwnProperty.call(currentData, oldColumnName)
          && Object.prototype.hasOwnProperty.call(currentData, newColumnName);
      });

      if (conflictingRow) {
        return NextResponse.json({ error: `Column '${newColumnName}' already exists.` }, { status: 400 });
      }

      const rowsToRename = (rows || []).filter((row) => {
        const currentData = normalizeRowData(row.row_data || {});
        return Object.prototype.hasOwnProperty.call(currentData, oldColumnName);
      });

      const updates = rowsToRename.map(async (row) => {
        const currentData = normalizeRowData(row.row_data || {});
        const nextData: RowData = {
          ...currentData,
          [newColumnName]: currentData[oldColumnName],
        };
        delete nextData[oldColumnName];

        const { error } = await supabase
          .from('model_selector_v2_rows')
          .update({
            row_data: nextData,
            slug: String(nextData.Model || nextData.Name || nextData.name || `row-${Date.now()}`),
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)
          .eq('user_id', user.id);

        if (error) {
          throw new Error(error.message);
        }

        return true;
      });

      await Promise.all(updates);

      return NextResponse.json({
        success: true,
        oldColumnName,
        newColumnName,
        renamedRows: rowsToRename.length,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const rowId = body.id;

    if (!rowId) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const rowData = body.rowData || body.row_data;
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (rowData !== undefined) {
      updates.row_data = normalizeRowData(rowData);
      updates.slug = String(updates.row_data.Model || updates.row_data.Name || updates.row_data.name || `row-${Date.now()}`);
    }

    if (body.sortOrder !== undefined) {
      updates.sort_order = body.sortOrder;
    }

    if (body.isEnabled !== undefined) {
      updates.is_enabled = body.isEnabled;
    }

    if (body.sheetSourceId !== undefined) {
      updates.sheet_source_id = body.sheetSourceId;
    }

    if (body.sheetSourceName !== undefined) {
      updates.sheet_source_name = body.sheetSourceName;
    }

    if (body.sheetRowNumber !== undefined) {
      updates.sheet_row_number = body.sheetRowNumber;
    }

    const { data, error } = await supabase
      .from('model_selector_v2_rows')
      .update(updates)
      .eq('id', rowId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rowId = searchParams.get('id');

    if (!rowId) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('model_selector_v2_rows')
      .delete()
      .eq('id', rowId)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}