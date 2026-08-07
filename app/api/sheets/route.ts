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
        
        return NextResponse.json({ sheets: allData });
      } else {
        // Fallback: fetch public sheet as CSV (first sheet only)
        const csvRows = await fetchSheetAsCsv(targetSheetId);
        if (!csvRows) {
          return NextResponse.json({ error: 'Failed to fetch public sheet' }, { status: 500 });
        }
        return NextResponse.json({
          sheets: [{
            sheet: 'Sheet1',
            data: csvRows,
            rows: csvRows.length
          }]
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