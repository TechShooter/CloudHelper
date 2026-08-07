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

// --- No-API-key public fallback (CSV export) -----------------------------
// Used when no key is configured so the sheet (which has a hardcoded ID) can
// still be read. Loses cell background colors but keeps all the data.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = false; }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ',') {
      row.push(cur); cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      rows.push(row); row = [];
    } else {
      cur += ch;
    }
  }
  if (cur !== '' || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

interface CsvTab { name: string; gid: number; }

async function discoverTabs(): Promise<CsvTab[]> {
  const tabs: CsvTab[] = [];

  // Source 1: legacy public worksheets feed.
  try {
    const res = await fetch(`https://spreadsheets.google.com/feeds/worksheets/${SHEET_ID}/public/basic?alt=json`);
    if (res.ok) {
      const json = await res.json();
      for (const e of json?.feed?.entry ?? []) {
        const name = (e?.title?.$t ?? '').trim();
        const m = (e?.id?.$t ?? '').match(/(\d+)\/?$/);
        const gid = m ? Number(m[1]) : NaN;
        if (name && Number.isFinite(gid) && gid >= 0) tabs.push({ name, gid });
      }
    }
  } catch { /* ignore */ }

  // Source 2: scrape the tab gids out of the htmlview page. The legacy feed
  // frequently 404s for "anyone with link" sheets, but htmlview exposes the
  // gids so we can still enumerate every tab via the CSV export.
  if (tabs.length <= 1) {
    try {
      const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/htmlview`);
      if (res.ok) {
        const html = await res.text();
        const seen = new Set<number>(tabs.map((t) => t.gid));
        const re = /gid=(\d{2,})/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(html)) !== null) {
          const gid = Number(m[1]);
          if (Number.isFinite(gid) && gid >= 0 && !seen.has(gid)) {
            seen.add(gid);
            tabs.push({ name: `Sheet-${gid}`, gid });
          }
        }
      }
    } catch { /* ignore */ }
  }

  // Always ensure the first tab (gid 0) is present — it is the main list for
  // this spreadsheet and must never be skipped just because its name is
  // generic ("Sheet1").
  if (!tabs.some((t) => t.gid === 0)) tabs.unshift({ name: 'Sheet1', gid: 0 });
  return tabs;
}

async function fetchTabCsv(gid: number): Promise<string[][] | null> {
  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`);
    if (!res.ok) return null;
    return parseCsv(await res.text());
  } catch {
    return null;
  }
}

function buildTab(raw: string[][] | null): { headers: string[]; rows: Record<string, string>[]; cellMetas: Record<string, CellMeta>[] } {
  if (!raw || !raw.length) return { headers: [], rows: [], cellMetas: [] };
  const headers = (raw[0] || []).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  const cellMetas: Record<string, CellMeta>[] = [];
  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i];
    const row: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((h, ci) => {
      const v = cells[ci] ?? '';
      row[h] = v;
      if (v) hasValue = true;
    });
    if (!hasValue) continue;
    rows.push(row);
    cellMetas.push({});
  }
  return { headers, rows, cellMetas };
}

async function loadTabsFromCsvFallback(): Promise<{
  raw: Record<string, { headers: string[]; rows: Record<string, string>[]; cellMetas: Record<string, CellMeta>[] }>;
  debug: { method: string; discovered: string[]; loaded: string[]; rejected: string[] };
}> {
  const raw: Record<string, { headers: string[]; rows: Record<string, string>[]; cellMetas: Record<string, CellMeta>[] }> = {};

  const tabs = await discoverTabs();
  const discovered = tabs.map((t) => t.name || `gid:${t.gid}`);
  const loaded: string[] = [];
  const rejected: string[] = [];

  // Slot for the main model list and (best-effort) the benchmarks tab.
  let freeTier: { headers: string[]; rows: Record<string, string>[]; cellMetas: Record<string, CellMeta>[]; gid: number } | null = null;
  let benchmark: { headers: string[]; rows: Record<string, string>[]; cellMetas: Record<string, CellMeta>[]; gid: number } | null = null;

  for (const tab of tabs.slice(0, 30)) {
    const csv = await fetchTabCsv(tab.gid);
    const built = buildTab(csv);
    if (built.rows.length === 0) {
      rejected.push(`gid:${tab.gid} (empty)`);
      continue;
    }
    loaded.push(`gid:${tab.gid}(${built.rows.length} rows)`);

    // Classify by header CONTENT, not by tab name, because the discovered
    // name can be a generic "Sheet1"/"Sheet-<gid>" and the main list is the
    // first tab. A tab is the main list when it has Name/Company + license or
    // tier columns; benchmarks have Intelligence/Speed or a bench marker.
    const headerKey = built.headers.join(' ').toLowerCase();
    const has = (kw: string) => headerKey.includes(kw);
    // Main model list: the "ModelSelector [Free tiers]" tab. Its distinguishing
    // column is the *decommission date*, which appears only on that tab (the
    // first tab "gid 0" is a different/older export) — so we key off it rather
    // than generic Name/Company headers.
    const isMain = has('name') && has('decomm');
    // Benchmarks: bench tables carry an Intelligence/Speed or "Bench" marker.
    const isBench = has('bench') || (has('intelligence') && (has('speed') || has('reasoning')));

    if (isMain && !freeTier) freeTier = { ...built, gid: tab.gid };
    else if (isBench && !benchmark) benchmark = { ...built, gid: tab.gid };
  }

  if (freeTier) raw['ModelSelector [Free tiers]'] = freeTier;
  if (benchmark) raw['Benchmarks'] = benchmark;

  return { raw, debug: { method: 'csv-fallback', discovered, loaded, rejected } };
}

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key-google-sheets') || process.env.GOOGLE_SHEETS_API_KEY || '';
  const debug: any = {
    sheetId: SHEET_ID,
    method: apiKey ? 'sheets-api' : 'csv-fallback',
    hasApiKey: !!apiKey,
    errors: [] as string[],
    discovered: [] as string[],
    loaded: [] as string[],
  };
  const raw: Record<string, { headers: string[]; rows: Record<string, string>[]; cellMetas: Record<string, CellMeta>[] }> = {};

  try {
    if (!apiKey) {
      const { raw: fbRaw, debug: fbDebug } = await loadTabsFromCsvFallback();
      Object.assign(raw, fbRaw);
      debug.discovered = fbDebug.discovered;
      debug.loaded = fbDebug.loaded;
    } else {
      for (const sheetName of SHEET_NAMES) {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?ranges=${encodeURIComponent(sheetName)}&includeGridData=true&fields=sheets.data.rowData.values(effectiveFormat.backgroundColor,hyperlink,formattedValue,userEnteredValue)&key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
          raw[sheetName] = { headers: [], rows: [], cellMetas: [] };
          debug.errors.push(`Failed to fetch sheet "${sheetName}": ${data.error?.message}`);
          console.error(`Failed to fetch sheet "${sheetName}":`, data.error?.message);
          continue;
        }

        const sheet = data?.sheets?.[0];
        const headerRow = sheetName === 'Benchmarks' ? 1 : 0;
        raw[sheetName] = parseSheetGrid(sheet, headerRow);
        debug.loaded.push(`${sheetName}(${raw[sheetName].rows.length} rows)`);
      }
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

    for (let fi = 0; fi < freeTiers.length; fi++) {
      const freeRow = freeTiers[fi];
      const freeMeta = freeCellMetas[fi] || {};
      const freeName = (freeRow.Name || freeRow.Model || '').toLowerCase().trim();
      let match: Record<string, string> | null = null;
      let matchMeta: Record<string, CellMeta> | null = null;

      for (let bi = 0; bi < benchmarks.length; bi++) {
        const benchName = (benchmarks[bi].Name || benchmarks[bi].Model || '').toLowerCase().trim();
        if (freeName && benchName && matchesName(freeName, benchName)) {
          match = benchmarks[bi];
          matchMeta = benchCellMetas[bi] || {};
          break;
        }
      }

      const merged: Record<string, string> = { ...freeRow };
      const mergedMeta: Record<string, CellMeta> = { ...freeMeta };
      if (match) {
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
      debug: {
        ...debug,
        freeRows: freeTiers.length,
        benchRows: benchmarks.length,
        mergedRows: mergedRows.length,
      },
    });
  } catch (error: any) {
    debug.errors.push(error.message);
    return NextResponse.json({ error: error.message, debug }, { status: 500 });
  }
}
