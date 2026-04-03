import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const calendarId = searchParams.get('calendarId') || 'primary';
    const daysBack = parseInt(searchParams.get('daysBack') || '30');
    const daysForward = parseInt(searchParams.get('daysForward') || '30');
    
    // Load service account credentials
    const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
    
    if (!fs.existsSync(serviceAccountPath)) {
      return NextResponse.json({ 
        error: 'Service account file not found. Make sure service-account.json is in the project root.' 
      }, { status: 500 });
    }
    
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    // Create auth client
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly']
    });
    
    const calendar = google.calendar({ version: 'v3', auth });
    
    // Get events from daysBack to daysForward
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysForward);
    
    console.log('Fetching calendar:', calendarId, 'from', startDate.toISOString(), 'to', endDate.toISOString());
    
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250
    });
    
    console.log('Calendar events fetched:', response.data.items?.length || 0);
    return NextResponse.json({ 
      events: response.data.items || [], 
      calendarId 
    });
  } catch (error: any) {
    console.error('Calendar API error:', error);
    return NextResponse.json({ 
      error: error.message,
      details: error.errors || error
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();
    
    if (action === 'listCalendars') {
      // Load service account credentials
      const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
      
      if (!fs.existsSync(serviceAccountPath)) {
        return NextResponse.json({ 
          error: 'Service account file not found' 
        }, { status: 500 });
      }
      
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      
      const auth = new google.auth.GoogleAuth({
        credentials: serviceAccount,
        scopes: ['https://www.googleapis.com/auth/calendar.readonly']
      });
      
      const calendar = google.calendar({ version: 'v3', auth });
      
      const response = await calendar.calendarList.list();
      
      return NextResponse.json({ calendars: response.data.items || [] });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Calendar API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
