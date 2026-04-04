import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');
    const full = searchParams.get('full') === 'true';
    
    const sheetId = '1FvjfZ5a-OMM2ScO2lJewBFIrbnWvgQKJug_Ve32gAQA';
    const range = 'A:ZZ'; // Remove sheet name, use default
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${process.env.GOOGLE_SHEETS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Google Sheets API error:', data);
      return NextResponse.json({ error: data.error?.message || 'Failed to fetch sheet' }, { status: 500 });
    }
    
    let rows = data.values || [];
    const totalRows = rows.length;
    
    if (query && rows.length > 0) {
      // Search functionality
      const headers = rows[0];
      const filtered = rows.filter((row: string[], idx: number) => {
        if (idx === 0) return true; // Keep headers
        return row.some(cell => cell?.toLowerCase().includes(query.toLowerCase()));
      });
      rows = filtered;
    } else if (!full && rows.length > 150) {
      // Limit to 150 rows + header if not full request
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
    const { action, query, sheetId } = await req.json();
    
    if (action === 'getAllSheets') {
      const targetSheetId = sheetId || '1FvjfZ5a-OMM2ScO2lJewBFIrbnWvgQKJug_Ve32gAQA';
      
      // Get spreadsheet metadata to find all sheet names
      const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}?key=${process.env.GOOGLE_SHEETS_API_KEY}`;
      const metadataResponse = await fetch(metadataUrl);
      const metadata = await metadataResponse.json();
      
      if (!metadataResponse.ok) {
        return NextResponse.json({ error: metadata.error?.message || 'Failed to get sheet metadata' }, { status: 500 });
      }
      
      const sheetNames = metadata.sheets.map((sheet: any) => sheet.properties.title);
      const allData = [];
      
      for (const sheetName of sheetNames) {
        try {
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}/values/${encodeURIComponent(sheetName)}!A:ZZ?key=${process.env.GOOGLE_SHEETS_API_KEY}`;
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