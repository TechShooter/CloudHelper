import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const SHEET_ID = '1Vm1JcvHTkh9GQniwINhlyI7XoPD0U1i9yrMblDanZo8';
const SHEET_NAMES = ['ModelSelector [Free tiers]', 'Benchmarks'];

function normalizeValue(value: any) {
  return value == null ? '' : String(value).trim();
}

function parseSheet(values: string[][], headerRowIndex = 0) {
  if (!values || values.length <= headerRowIndex) return { headers: [], rows: [] as Record<string, string>[] };

  const headers = values[headerRowIndex].map((h) => normalizeValue(h));
  const rows = values.slice(headerRowIndex + 1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      row[header] = normalizeValue(cells[index]);
    });
    return row;
  });

  return { headers, rows };
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

    const raw: Record<string, { headers: string[]; rows: Record<string, string>[] }> = {};

    for (const sheetName of SHEET_NAMES) {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheetName)}!A:ZZ?key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        raw[sheetName] = { headers: [], rows: [] };
        console.error(`Failed to fetch sheet "${sheetName}":`, data.error?.message);
        continue;
      }

      const values: string[][] = data.values || [];
      const headerRow = sheetName === 'Benchmarks' ? 1 : 0;
      raw[sheetName] = parseSheet(values, headerRow);
    }

    const freeTiers = raw['ModelSelector [Free tiers]']?.rows || [];
    const benchmarks = raw['Benchmarks']?.rows || [];

    const freeHeaders = raw['ModelSelector [Free tiers]']?.headers || [];
    const benchHeaders = raw['Benchmarks']?.headers || [];

    const benchExclusive = benchHeaders.filter((h) => !freeHeaders.includes(h));

    const mergedRows: Array<Record<string, string>> = [];
    const usedBenchIndices = new Set<number>();

    for (const freeRow of freeTiers) {
      const freeName = (freeRow.Name || freeRow.Model || '').toLowerCase().trim();
      let match: Record<string, string> | null = null;
      let matchIndex = -1;

      for (let i = 0; i < benchmarks.length; i++) {
        if (usedBenchIndices.has(i)) continue;
        const benchName = (benchmarks[i].Name || benchmarks[i].Model || '').toLowerCase().trim();
        if (freeName && benchName && matchesName(freeName, benchName)) {
          match = benchmarks[i];
          matchIndex = i;
          break;
        }
      }

      const merged: Record<string, string> = { ...freeRow };
      if (match) {
        usedBenchIndices.add(matchIndex);
        for (const key of benchExclusive) {
          if (match[key]) {
            merged[key] = match[key];
          }
        }
      }

      mergedRows.push(merged);
    }

    const allHeaders = [...freeHeaders, ...benchExclusive];

    return NextResponse.json({
      success: true,
      headers: allHeaders,
      rows: mergedRows,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
