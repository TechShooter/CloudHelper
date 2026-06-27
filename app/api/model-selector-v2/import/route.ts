import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'edge';

type SheetRow = Record<string, string>;

function normalizeValue(value: any) {
  return value == null ? '' : String(value).trim();
}

function parseSheetRows(values: string[][]) {
  if (!values || values.length === 0) return { headers: [], rows: [] as SheetRow[] };

  const headers = values[0].map((header) => normalizeValue(header));
  const rows = values.slice(1).map((cells) => {
    const row: SheetRow = {};

    headers.forEach((header, index) => {
      if (!header) return;
      row[header] = normalizeValue(cells[index]);
    });

    return row;
  });

  return { headers, rows };
}

function parseHyperlinkRows(gridData: any, headers: string[]) {
  const hyperlinkRows: Array<Record<string, string>> = [];
  const rowData = gridData?.rowData || [];

  // Skip header row (index 0) to align with parsed values rows
  for (let rowIndex = 1; rowIndex < rowData.length; rowIndex++) {
    const row = rowData[rowIndex];
    const values = row?.values || [];
    const hyperlinkMap: Record<string, string> = {};

    headers.forEach((header, colIndex) => {
      if (!header) return;
      const cell = values[colIndex] || {};
      const hyperlink = normalizeValue(cell.hyperlink || '');
      if (hyperlink) {
        hyperlinkMap[header] = hyperlink;
      }
    });

    hyperlinkRows.push(hyperlinkMap);
  }

  return hyperlinkRows;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sheetId, sheetName } = await req.json();
    const targetSheetId = sheetId || '1FvjfZ5a-OMM2ScO2lJewBFIrbnWvgQKJug_Ve32gAQA';

    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}?key=${process.env.GOOGLE_SHEETS_API_KEY}`;
    const metadataResponse = await fetch(metadataUrl);
    const metadata = await metadataResponse.json();

    if (!metadataResponse.ok) {
      return NextResponse.json({ error: metadata.error?.message || 'Failed to get sheet metadata' }, { status: 500 });
    }

    const sheets = metadata.sheets || [];
    const targetSheet = sheetName
      ? sheets.find((sheet: any) => sheet.properties?.title === sheetName)
      : sheets[0];

    if (!targetSheet) {
      return NextResponse.json({ error: 'Sheet not found' }, { status: 404 });
    }

    const resolvedSheetName = targetSheet.properties.title;

    const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}/values/${encodeURIComponent(resolvedSheetName)}!A:ZZ?key=${process.env.GOOGLE_SHEETS_API_KEY}`;
    const valuesResponse = await fetch(valuesUrl);
    const valuesData = await valuesResponse.json();

    if (!valuesResponse.ok) {
      return NextResponse.json({ error: valuesData.error?.message || 'Failed to fetch sheet values' }, { status: 500 });
    }

    const values: string[][] = valuesData.values || [];
    if (values.length === 0) {
      return NextResponse.json({ error: 'Sheet is empty' }, { status: 400 });
    }

    const { headers, rows } = parseSheetRows(values);

    // Optional hyperlink extraction: includeGridData exposes per-cell hyperlinks when available.
    let hyperlinkRows: Array<Record<string, string>> = [];
    try {
      const hyperlinkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}?includeGridData=true&ranges=${encodeURIComponent(resolvedSheetName)}!A:ZZ&fields=sheets(data(rowData(values(hyperlink))),properties(title))&key=${process.env.GOOGLE_SHEETS_API_KEY}`;
      const hyperlinkResponse = await fetch(hyperlinkUrl);
      if (hyperlinkResponse.ok) {
        const hyperlinkData = await hyperlinkResponse.json();
        const sheetWithGrid = (hyperlinkData.sheets || []).find((sheet: any) => sheet.properties?.title === resolvedSheetName) || hyperlinkData.sheets?.[0];
        const grid = sheetWithGrid?.data?.[0];
        hyperlinkRows = parseHyperlinkRows(grid, headers);
      }
    } catch {
      // Keep import robust if hyperlink extraction fails.
      hyperlinkRows = [];
    }

    const rowsToUpsert = rows.map((rowData, index) => {
      const sheetRowNumber = index + 2;
      const modelValue = rowData.Model || rowData.Name || rowData.name || `row-${sheetRowNumber}`;
      const hyperlinkMap = hyperlinkRows[index] || {};

      const rowDataWithLinks = Object.keys(hyperlinkMap).length > 0
        ? {
            ...rowData,
            __links: hyperlinkMap,
          }
        : rowData;

      return {
        user_id: user.id,
        slug: modelValue,
        row_data: rowDataWithLinks,
        sheet_source_id: targetSheetId,
        sheet_source_name: resolvedSheetName,
        sheet_row_number: sheetRowNumber,
        sort_order: index,
        is_enabled: true,
      };
    });

    if (rowsToUpsert.length === 0) {
      return NextResponse.json({ error: 'No rows found to import' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('model_selector_v2_rows')
      .upsert(rowsToUpsert, {
        onConflict: 'user_id,sheet_source_id,sheet_source_name,sheet_row_number',
      })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sheetId: targetSheetId,
      sheetName: resolvedSheetName,
      importedRows: rowsToUpsert.length,
      headers,
      rows: data || [],
      linksImported: hyperlinkRows.some((row) => Object.keys(row).length > 0),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
