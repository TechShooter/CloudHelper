import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');
    
    const sheetId = '1FvjfZ5a-OMM2ScO2lJewBFIrbnWvgQKJug_Ve32gAQA';
    const range = 'A:ZZ';
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${process.env.GOOGLE_SHEETS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'Failed to fetch sheet' }, { status: 500 });
    }
    
    let rows = data.values || [];
    
    if (query && rows.length > 0) {
      const headers = rows[0];
      const filtered = rows.filter((row: string[], idx: number) => {
        if (idx === 0) return true;
        return row.some(cell => cell?.toLowerCase().includes(query.toLowerCase()));
      });
      rows = filtered.length > 1 ? filtered : rows.slice(0, 51);
    } else {
      rows = rows.slice(0, 51);
    }
    
    return NextResponse.json({ data: rows, total: data.values?.length || 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
