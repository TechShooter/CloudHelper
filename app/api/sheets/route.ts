import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

async function fetchSheetAsCsv(sheetId: string, gid: number = 0): Promise<string[][] | null> {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const csvText = await res.text();
    const rows = csvText.split('\n').filter(r => r.trim());
    return rows.map(r => {
      const cols: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < r.length; i++) {
        const ch = r[i];
        if (inQuotes) {
          if (ch === '"') {
            if (r[i + 1] === '"') { current += '"'; i++; continue; } // escaped quote
            inQuotes = false;
          } else {
            current += ch;
          }
        } else if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          cols.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
      cols.push(current);
      return cols;
    });
  } catch {
    return null;
  }
}

// Best-effort discovery of tabs (name + gid) via public, no-API-key sources.
// The CSV export only gives the first tab, so we enumerate the rest here.
async function discoverTabs(sheetId: string): Promise<Array<{ name: string; gid: number }>> {
  const tabs: Array<{ name: string; gid: number }> = [];

  // Source 1: legacy public worksheets feed (works for view-shared sheets).
  try {
    const res = await fetch(`https://spreadsheets.google.com/feeds/worksheets/${sheetId}/public/basic?alt=json`);
    if (res.ok) {
      const json = await res.json();
      const entries = json?.feed?.entry ?? [];
      for (const e of entries) {
        const name = (e?.title?.$t ?? '').trim();
        const id = (e?.id?.$t ?? '').trim();
        const m = id.match(/(\d+)\/?$/);
        const gid = m ? Number(m[1]) : NaN;
        if (name && Number.isFinite(gid) && gid >= 0) tabs.push({ name, gid });
      }
    }
  } catch {
    // ignore
  }

  // Source 2: scrape the HTML export menu if the feed didn't work.
  if (tabs.length <= 1) {
    try {
      const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=html`);
      if (res.ok) {
        const html = await res.text();
        const pairs: Array<{ name: string; gid: number }> = [];
        const re = /(?:gid|data-tabid)=["']?(\d{2,})["']?/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(html)) !== null) {
          const gid = Number(m[1]);
          if (Number.isFinite(gid) && gid >= 0 && gid <= 2147483647) {
            pairs.push({ name: `Sheet-${gid}`, gid });
          }
        }
        const seen = new Set<number>();
        for (const p of pairs) {
          if (!seen.has(p.gid)) {
            seen.add(p.gid);
            tabs.push(p);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Source 3: scrape tab ids straight out of the htmlview page. The legacy
  // feed and the HTML export both fail for many "anyone with link" sheets,
  // but htmlview exposes every gid reliably.
  if (tabs.length <= 1) {
    try {
      const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`);
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
    } catch {
      // ignore
    }
  }

  // Always ensure the first tab (gid 0) is present.
  if (!tabs.some((t) => t.gid === 0)) tabs.unshift({ name: 'Sheet1', gid: 0 });
  return tabs;
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key-google-sheets') || process.env.GOOGLE_SHEETS_API_KEY || '';
    const { searchParams } = new URL(req.url);
    const sheetId = searchParams.get('sheetId');
    const query = searchParams.get('query');
    const full = searchParams.get('full') === 'true';
    
    if (!sheetId) {
      return NextResponse.json({ error: 'sheetId query parameter is required' }, { status: 400 });
    }
    const range = 'A:ZZ';
    
    let rows: string[][] = [];
    let totalRows = 0;

    if (apiKey) {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Google Sheets API error:', data);
        return NextResponse.json({ error: data.error?.message || 'Failed to fetch sheet' }, { status: 500 });
      }
      
      rows = data.values || [];
    } else {
      // Fallback: fetch public sheet as CSV (no API key needed)
      const csvRows = await fetchSheetAsCsv(sheetId);
      if (!csvRows) {
        return NextResponse.json({ error: 'Failed to fetch public sheet' }, { status: 500 });
      }
      rows = csvRows;
    }

    totalRows = rows.length;
    
    if (query && rows.length > 0) {
      const headers = rows[0];
      const filtered = rows.filter((row: string[], idx: number) => {
        if (idx === 0) return true;
        return row.some(cell => cell?.toLowerCase().includes(query.toLowerCase()));
      });
      rows = filtered;
    } else if (!full && rows.length > 150) {
      rows = rows.slice(0, 151);
    }
    
    return NextResponse.json({ 
      data: rows, 
      totalRows,
      limited: !full && totalRows > 151,
      searchResults: query ? rows.length - 1 : null
    });
  } catch (error: any) {
    console.error('Server error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key-google-sheets') || process.env.GOOGLE_SHEETS_API_KEY || '';
    const { action, query, sheetId } = await req.json();
    
    if (action === 'getAllSheets') {
      if (!sheetId) {
        return NextResponse.json({ error: 'sheetId is required' }, { status: 400 });
      }
      const targetSheetId = sheetId;

      if (apiKey) {
        // Use API v4 (supports multiple sheets)
        const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}?key=${apiKey}`;
        const metadataResponse = await fetch(metadataUrl);
        const metadata = await metadataResponse.json();
        
        if (!metadataResponse.ok) {
          return NextResponse.json({ error: metadata.error?.message || 'Failed to get sheet metadata' }, { status: 500 });
        }
        
        const sheetNames = metadata.sheets.map((sheet: any) => sheet.properties.title);
        const allData = [];
        
        for (const sheetName of sheetNames) {
          try {
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}/values/${encodeURIComponent(sheetName)}!A:ZZ?key=${apiKey}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (response.ok && data.values && data.values.length > 0) {
              allData.push({
                sheet: sheetName,
                data: data.values,
                rows: data.values.length
              });
            }
          } catch (error) {
            console.log(`Sheet ${sheetName} error:`, error);
          }
        }
        
        return NextResponse.json({ sheets: allData, usedFallback: false });
      } else {
        // Fallback: fetch public sheet as CSV. Load every discovered tab so a
        // food database that isn't on the first tab is still found.
        const tabs = await discoverTabs(targetSheetId);
        const sheets: Array<{ sheet: string; data: string[][]; rows: number }> = [];
        const loadErrors: string[] = [];
        for (const tab of tabs.slice(0, 30)) {
          const rows = await fetchSheetAsCsv(targetSheetId, tab.gid);
          if (rows && rows.length > 0) {
            sheets.push({ sheet: tab.name, data: rows, rows: rows.length });
          } else {
            loadErrors.push(`gid:${tab.gid} (empty)`);
          }
        }
        if (sheets.length === 0) {
          return NextResponse.json({ error: 'Failed to fetch public sheet' }, { status: 500 });
        }
        return NextResponse.json({
          sheets,
          usedFallback: true,
          debug: {
            sheetId: targetSheetId,
            method: 'csv-fallback',
            discovered: tabs.map((t) => t.name || `gid:${t.gid}`),
            loaded: sheets.map((s) => `${s.sheet}(${s.rows} rows)`),
            loadErrors,
          },
        });
      }
    }
    
    if (action === 'search') {
      const searchUrl = `/api/sheets?query=${encodeURIComponent(query)}&full=true`;
      const response = await fetch(`${req.nextUrl.origin}${searchUrl}`);
      return response;
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}