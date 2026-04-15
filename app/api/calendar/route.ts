import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const calendarId = searchParams.get('calendarId') || 'primary';
    const daysBack = parseInt(searchParams.get('daysBack') || '30');
    const daysForward = parseInt(searchParams.get('daysForward') || '30');

    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      return NextResponse.json({
        error: 'Google service account credentials not found. Set GOOGLE_SERVICE_ACCOUNT_JSON environment variable.'
      }, { status: 500 });
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly']
    });

    const calendar = google.calendar({ version: 'v3', auth });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysForward);

    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250
    });

    return NextResponse.json({
      events: response.data.items || [],
      calendarId
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    if (action === 'listCalendars') {
      const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      if (!serviceAccountJson) {
        return NextResponse.json({
          error: 'Google service account credentials not found. Set GOOGLE_SERVICE_ACCOUNT_JSON environment variable.'
        }, { status: 500 });
      }

      const serviceAccount = JSON.parse(serviceAccountJson);

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
