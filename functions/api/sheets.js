// Cloudflare Pages Function for /api/sheets
export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    const full = url.searchParams.get('full') === 'true';
    
    const sheetId = '1FvjfZ5a-OMM2ScO2lJewBFIrbnWvgQKJug_Ve32gAQA';
    const range = 'A:ZZ';
    
    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${env.GOOGLE_SHEETS_API_KEY}`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || 'Failed to fetch sheet' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    let rows = data.values || [];
    const totalRows = rows.length;
    
    if (query && rows.length > 0) {
      const filtered = rows.filter((row, idx) => {
        if (idx === 0) return true;
        return row.some(cell => cell?.toLowerCase().includes(query.toLowerCase()));
      });
      rows = filtered;
    } else if (!full && rows.length > 150) {
      rows = rows.slice(0, 151);
    }
    
    return new Response(JSON.stringify({ 
      data: rows, 
      totalRows,
      limited: !full && totalRows > 151,
      searchResults: query ? rows.length - 1 : null
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { action, query, sheetId } = await request.json();
    
    if (action === 'getAllSheets') {
      const targetSheetId = sheetId || '1FvjfZ5a-OMM2ScO2lJewBFIrbnWvgQKJug_Ve32gAQA';
      
      const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}?key=${env.GOOGLE_SHEETS_API_KEY}`;
      const metadataResponse = await fetch(metadataUrl);
      const metadata = await metadataResponse.json();
      
      if (!metadataResponse.ok) {
        return new Response(JSON.stringify({ error: metadata.error?.message || 'Failed to get sheet metadata' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const sheetNames = metadata.sheets.map((sheet) => sheet.properties.title);
      const allData = [];
      
      for (const sheetName of sheetNames) {
        try {
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}/values/${encodeURIComponent(sheetName)}!A:ZZ?key=${env.GOOGLE_SHEETS_API_KEY}`;
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
      
      return new Response(JSON.stringify({ sheets: allData }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'search') {
      const searchUrl = new URL(request.url);
      searchUrl.pathname = '/api/sheets';
      searchUrl.searchParams.set('query', query);
      searchUrl.searchParams.set('full', 'true');
      const response = await fetch(searchUrl.toString());
      return response;
    }
    
    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
