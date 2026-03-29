import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const timeMin = searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = searchParams.get('timeMax') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const calendarId = searchParams.get('calendarId') || 'primary';

    if (!process.env.GOOGLE_CALENDAR_API_KEY) {
      return NextResponse.json({ error: 'Google Calendar API key not configured' }, { status: 400 });
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      `key=${process.env.GOOGLE_CALENDAR_API_KEY}&` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `singleEvents=true&` +
      `orderBy=startTime&` +
      `maxResults=250`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('Google Calendar API error:', data);
      return NextResponse.json({ error: data.error?.message || 'Failed to fetch calendar events' }, { status: 500 });
    }

    const events = data.items || [];
    
    return NextResponse.json({ 
      events,
      totalEvents: events.length,
      calendarId,
      timeRange: { timeMin, timeMax }
    });
  } catch (error: any) {
    console.error('Server error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, event, calendarId = 'primary' } = await req.json();

    if (!process.env.GOOGLE_CALENDAR_API_KEY) {
      return NextResponse.json({ error: 'Google Calendar API key not configured' }, { status: 400 });
    }

    if (action === 'createEvent') {
      if (!event || !event.summary) {
        return NextResponse.json({ error: 'Event summary is required' }, { status: 400 });
      }

      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${process.env.GOOGLE_CALENDAR_API_KEY}`;

      const eventData = {
        summary: event.summary,
        description: event.description || '',
        start: event.start || { dateTime: new Date().toISOString() },
        end: event.end || { dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
        ...(event.location && { location: event.location }),
        ...(event.attendees && { attendees: event.attendees }),
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GOOGLE_CALENDAR_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to create event:', data);
        return NextResponse.json({ error: data.error?.message || 'Failed to create event' }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true,
        event: data,
        message: 'Event created successfully'
      });
    }

    if (action === 'getCalendars') {
      const url = `https://www.googleapis.com/calendar/v3/users/me/calendarList?key=${process.env.GOOGLE_CALENDAR_API_KEY}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${process.env.GOOGLE_CALENDAR_API_KEY}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to fetch calendars:', data);
        return NextResponse.json({ error: data.error?.message || 'Failed to fetch calendars' }, { status: 500 });
      }

      return NextResponse.json({ 
        calendars: data.items || [],
        totalCalendars: data.items?.length || 0
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Server error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
