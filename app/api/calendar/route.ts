import { NextRequest, NextResponse } from 'next/server';
import { fetchCalendarEvents } from '@/lib/google-calendar-edge';

export const runtime = 'edge';

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
}

function getServiceAccount(): ServiceAccount {
  // Debug: Log all available env vars
  const allEnvVars = Object.keys(process.env).filter(k => 
    k.includes('GOOGLE') || k.includes('ENV') || k.includes('NODE')
  );
  console.log('Available env vars:', allEnvVars);
  
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  
  console.log('GOOGLE_SERVICE_ACCOUNT_KEY present:', !!privateKey);
  console.log('GOOGLE_SERVICE_ACCOUNT_KEY length:', privateKey?.length || 0);
  console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL present:', !!clientEmail);
  console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL value:', clientEmail);

  if (!privateKey || !clientEmail) {
    throw new Error(
      `Google service account credentials not configured. ` +
      `Available GOOGLE vars: ${allEnvVars.join(', ') || 'NONE'}. ` +
      `EMAIL: ${clientEmail ? 'SET' : 'MISSING'}, ` +
      `KEY: ${privateKey ? 'SET' : 'MISSING'}`
    );
  }

  return {
    type: 'service_account',
    project_id: 'gen-lang-client-0415055055',
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID || '',
    private_key: privateKey,
    client_email: clientEmail,
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`,
    universe_domain: 'googleapis.com',
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const calendarId = searchParams.get('calendarId');
    const daysBack = parseInt(searchParams.get('daysBack') || '30');
    const daysForward = parseInt(searchParams.get('daysForward') || '30');

    if (!calendarId) {
      return NextResponse.json(
        { error: 'Calendar ID is required', events: [] },
        { status: 400 }
      );
    }

    const now = new Date();
    const timeMin = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(now.getTime() + daysForward * 24 * 60 * 60 * 1000).toISOString();

    const serviceAccount = getServiceAccount();
    const events = await fetchCalendarEvents(serviceAccount, calendarId, timeMin, timeMax);

    return NextResponse.json({ events });
  } catch (error: any) {
    console.error('Calendar API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch calendar events', events: [] },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return NextResponse.json(
    { error: 'POST not implemented', calendars: [] },
    { status: 501 }
  );
}
