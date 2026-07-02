import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const SHEET_ID = '1Vm1JcvHTkh9GQniwINhlyI7XoPD0U1i9yrMblDanZo8';
const SHEET_NAMES = ['ModelSelector [Free tiers]', 'Benchmarks'];

function normalizeValue(value: any) {
  return value == null ? '' : String(value).trim();
}

interface CellMeta {
  backgroundColor?: { red: number; green: number; blue: number } | null;
  hyperlink?: string | null;
}

function parseSheetCell(cell: any): { value: string; meta: CellMeta } {
  const value = normalizeValue(cell?.formattedValue ?? cell?.userEnteredValue?.stringValue ?? '');
  const meta: CellMeta = {};
  if (cell?.hyperlink) meta.hyperlink = cell.hyperlink;
  if (cell?.effectiveFormat?.backgroundColor) {
    const bg = cell.effectiveFormat.backgroundColor;
    if (bg.red !== undefined && bg.green !== undefined && bg.blue !== undefined) {
      meta.backgroundColor = { red: bg.red, green: bg.green, blue: bg.blue };
    }
  }
  return { value, meta };
}

function parseSheetGrid(sheet: any, headerRowIndex = 0) {
  const rowData = sheet?.data?.[0]?.rowData ?? [];
  if (!rowData.length) return { headers: [], rows: [] as Record<string, string>[], cellMetas: [] as Record<string, CellMeta>[] };

  const headerCells = rowData[headerRowIndex]?.values ?? [];
  const headers = headerCells.map((c: any) => (c?.formattedValue ?? '').trim());

  const rows: Record<string, string>[] = [];
  const cellMetas: Record<string, CellMeta>[] = [];

  for (let r = headerRowIndex + 1; r < rowData.length; r++) {
    const cells = rowData[r]?.values ?? [];
    const row: Record<string, string> = {};
    const rowMeta: Record<string, CellMeta> = {};
    let hasValue = false;
    headers.forEach((header: string, ci: number) => {
      if (!header) return;
      const cell = cells[ci];
      if (cell) {
        const parsed = parseSheetCell(cell);
        row[header] = parsed.value;
        rowMeta[header] = parsed.meta;
        if (parsed.value) hasValue = true;
      } else {
        row[header] = '';
        rowMeta[header] = {};
      }
    });
    if (!hasValue) continue;
    rows.push(row);
    cellMetas.push(rowMeta);
  }

  return { headers, rows, cellMetas };
}

function matchesName(freeName: string, benchName: string): boolean {
  const a = freeName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const b = benchName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return a.includes(b) || b.includes(a);
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key-google-sheets') || process.env.GOOGLE_SHEETS_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json({ error: 'GOOGLE_SHEETS_API_KEY not configured' }, { status: 500 });
    }

    const raw: Record<string, { headers: string[]; rows: Record<string, string>[]; cellMetas: Record<string, CellMeta>[] }> = {};

    for (const sheetName of SHEET_NAMES) {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?ranges=${encodeURIComponent(sheetName)}&includeGridData=true&fields=sheets.data.rowData.values(effectiveFormat.backgroundColor,hyperlink,formattedValue,userEnteredValue)&key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        raw[sheetName] = { headers: [], rows: [], cellMetas: [] };
        console.error(`Failed to fetch sheet "${sheetName}":`, data.error?.message);
        continue;
      }

      const sheet = data?.sheets?.[0];
      const headerRow = sheetName === 'Benchmarks' ? 1 : 0;
      raw[sheetName] = parseSheetGrid(sheet, headerRow);
    }

    const freeTiers = raw['ModelSelector [Free tiers]']?.rows || [];
    const benchmarks = raw['Benchmarks']?.rows || [];
    const freeCellMetas = raw['ModelSelector [Free tiers]']?.cellMetas || [];
    const benchCellMetas = raw['Benchmarks']?.cellMetas || [];

    const freeHeaders = raw['ModelSelector [Free tiers]']?.headers || [];
    const benchHeaders = raw['Benchmarks']?.headers || [];

    const benchExclusive = benchHeaders.filter((h) => !freeHeaders.includes(h));

    const mergedRows: Array<Record<string, string>> = [];
    const mergedCellMetas: Array<Record<string, CellMeta>> = [];
    const usedBenchIndices = new Set<number>();

    for (let fi = 0; fi < freeTiers.length; fi++) {
      const freeRow = freeTiers[fi];
      const freeMeta = freeCellMetas[fi] || {};
      const freeName = (freeRow.Name || freeRow.Model || '').toLowerCase().trim();
      let match: Record<string, string> | null = null;
      let matchMeta: Record<string, CellMeta> | null = null;
      let matchIndex = -1;

      for (let bi = 0; bi < benchmarks.length; bi++) {
        if (usedBenchIndices.has(bi)) continue;
        const benchName = (benchmarks[bi].Name || benchmarks[bi].Model || '').toLowerCase().trim();
        if (freeName && benchName && matchesName(freeName, benchName)) {
          match = benchmarks[bi];
          matchMeta = benchCellMetas[bi] || {};
          matchIndex = bi;
          break;
        }
      }

      const merged: Record<string, string> = { ...freeRow };
      const mergedMeta: Record<string, CellMeta> = { ...freeMeta };
      if (match) {
        usedBenchIndices.add(matchIndex);
        for (const key of benchExclusive) {
          if (match[key]) {
            merged[key] = match[key];
          }
          if (matchMeta && matchMeta[key]) {
            mergedMeta[key] = matchMeta[key];
          }
        }
      }

      mergedRows.push(merged);
      mergedCellMetas.push(mergedMeta);
    }

    const allHeaders = [...freeHeaders, ...benchExclusive];

    return NextResponse.json({
      success: true,
      headers: allHeaders,
      rows: mergedRows,
      cellMetas: mergedCellMetas,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
