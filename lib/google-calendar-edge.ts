/**
 * Edge Runtime compatible Google Calendar API client
 * Uses Web Crypto API instead of Node.js crypto for JWT signing
 */

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

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  description?: string;
  location?: string;
}

// Base64URL encoding helpers
function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str: string): string {
  // Add padding back
  const padding = '='.repeat((4 - str.length % 4) % 4);
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + padding;
  return atob(base64);
}

// Convert PEM private key to CryptoKey
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Remove PEM headers and whitespace
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = pem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');

  // Base64 decode to get binary
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

// Sign data with private key
async function signData(privateKey: CryptoKey, data: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  return crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, dataBuffer);
}

// Generate JWT for Google Service Account
async function generateJWT(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

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

// Get access token from Google OAuth
async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
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

// Fetch calendar events
export async function fetchCalendarEvents(
  serviceAccount: ServiceAccount,
  calendarId: string,
  timeMin?: string,
  timeMax?: string,
  maxResults: number = 100
): Promise<CalendarEvent[]> {
  const accessToken = await getAccessToken(serviceAccount);

  const params = new URLSearchParams({
    calendarId: calendarId,
    maxResults: maxResults.toString(),
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  if (timeMin) {
    params.append('timeMin', timeMin);
  }
  if (timeMax) {
    params.append('timeMax', timeMax);
  }

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
