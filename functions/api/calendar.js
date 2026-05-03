// Cloudflare Pages Function for /api/calendar
// Includes edge-compatible Google Calendar helper

function base64UrlEncode(str) {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str) {
  const padding = '='.repeat((4 - str.length % 4) % 4);
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + padding;
  return atob(base64);
}

async function importPrivateKey(pem) {
  let cleanPem = pem.trim();
  
  if ((cleanPem.startsWith('"') && cleanPem.endsWith('"')) ||
      (cleanPem.startsWith("'") && cleanPem.endsWith("'"))) {
    cleanPem = cleanPem.slice(1, -1);
  }
  
  cleanPem = cleanPem
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  
  const pemContents = cleanPem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');

  const binaryDer = base64UrlDecode(pemContents);
  const binaryDerBytes = new Uint8Array(binaryDer.length);
  for (let i = 0; i < binaryDer.length; i++) {
    binaryDerBytes[i] = binaryDer.charCodeAt(i);
  }

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDerBytes,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

async function signData(privateKey, data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  return crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, dataBuffer);
}

async function generateJWT(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: serviceAccount.private_key_id,
  };

  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    aud: serviceAccount.token_uri,
    iat: now,
    exp: expiry,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const claimB64 = base64UrlEncode(JSON.stringify(claim));
  const signatureInput = `${headerB64}.${claimB64}`;

  const privateKey = await importPrivateKey(serviceAccount.private_key);
  const signatureBuffer = await signData(privateKey, signatureInput);
  const signatureArray = new Uint8Array(signatureBuffer);
  let signatureString = '';
  for (let i = 0; i < signatureArray.length; i++) {
    signatureString += String.fromCharCode(signatureArray[i]);
  }
  const signatureB64 = base64UrlEncode(signatureString);

  return `${headerB64}.${claimB64}.${signatureB64}`;
}

async function getAccessToken(serviceAccount) {
  const jwt = await generateJWT(serviceAccount);

  const response = await fetch(serviceAccount.token_uri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchCalendarEvents(serviceAccount, calendarId, timeMin, timeMax, maxResults = 100) {
  const accessToken = await getAccessToken(serviceAccount);

  const params = new URLSearchParams({
    calendarId: calendarId,
    maxResults: maxResults.toString(),
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  if (timeMin) params.append('timeMin', timeMin);
  if (timeMax) params.append('timeMax', timeMax);

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Calendar API error: ${error}`);
  }

  const data = await response.json();
  return data.items || [];
}

function getServiceAccount(env) {
  const privateKey = env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!privateKey || !clientEmail) {
    throw new Error('Google service account credentials not configured');
  }

  return {
    type: 'service_account',
    project_id: 'gen-lang-client-0415055055',
    private_key_id: env.GOOGLE_PRIVATE_KEY_ID || '',
    private_key: privateKey,
    client_email: clientEmail,
    client_id: env.GOOGLE_CLIENT_ID || '',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`,
    universe_domain: 'googleapis.com',
  };
}

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const calendarId = url.searchParams.get('calendarId');
    const daysBack = parseInt(url.searchParams.get('daysBack') || '30');
    const daysForward = parseInt(url.searchParams.get('daysForward') || '30');

    if (!calendarId) {
      return new Response(JSON.stringify({ error: 'Calendar ID is required', events: [] }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = new Date();
    const timeMin = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(now.getTime() + daysForward * 24 * 60 * 60 * 1000).toISOString();

    const serviceAccount = getServiceAccount(env);
    const events = await fetchCalendarEvents(serviceAccount, calendarId, timeMin, timeMax);

    return new Response(JSON.stringify({ events }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Failed to fetch calendar events', events: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  return new Response(JSON.stringify({ error: 'POST not implemented', calendars: [] }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' }
  });
}
