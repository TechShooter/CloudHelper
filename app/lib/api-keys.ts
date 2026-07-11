const STORAGE_PREFIX = 'cloudhelper.api-key.';

export type ApiKeyName = 'gemini' | 'groq' | 'notion' | 'google-sheet-id' | 'google-calendar-id';

const KEY_LABELS: Record<ApiKeyName, string> = {
  gemini: 'Gemini API Key',
  groq: 'Groq API Key',
  notion: 'Notion API Key',
  'google-sheet-id': 'Google Sheet ID (food database)',
  'google-calendar-id': 'Google Calendar ID',
};

export function getApiKey(name: ApiKeyName): string {
  try {
    return localStorage.getItem(STORAGE_PREFIX + name) || '';
  } catch {
    return '';
  }
}

export function setApiKey(name: ApiKeyName, value: string): void {
  try {
    if (value) {
      localStorage.setItem(STORAGE_PREFIX + name, value.trim());
    } else {
      localStorage.removeItem(STORAGE_PREFIX + name);
    }
  } catch (error) {
    console.error('Failed to save API key:', error);
  }
}

export function clearApiKey(name: ApiKeyName): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + name);
  } catch {
    // ignore
  }
}

export function hasApiKey(name: ApiKeyName): boolean {
  return !!getApiKey(name);
}

export function getKeyLabel(name: ApiKeyName): string {
  return KEY_LABELS[name];
}

export const ALL_API_KEYS: ApiKeyName[] = ['gemini', 'groq', 'notion', 'google-sheet-id', 'google-calendar-id'];

const RESOURCE_ID_KEYS: ApiKeyName[] = ['google-sheet-id', 'google-calendar-id'];

export function isResourceIdKey(name: ApiKeyName): boolean {
  return RESOURCE_ID_KEYS.includes(name);
}

export function obfuscateKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return key.slice(0, 4) + '....';
  return key.slice(0, 6) + '....' + key.slice(-4);
}

// Sync all API keys to Supabase (for logged-in users)
export async function syncApiKeysToSupabase(): Promise<void> {
  try {
    const keys: Record<string, string> = {};
    for (const name of ALL_API_KEYS) {
      keys[name] = getApiKey(name);
    }

    const res = await fetch('/api/workspace-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: '__global__',
        settingKey: 'api-keys',
        settingValue: keys
      })
    });

    if (!res.ok) {
      console.error('Failed to sync API keys to Supabase:', res.status);
    }
  } catch (error) {
    console.error('Failed to sync API keys to Supabase:', error);
  }
}

// Load API keys from Supabase into localStorage (only fills missing keys)
export async function loadApiKeysFromSupabase(): Promise<void> {
  try {
    const res = await fetch('/api/workspace-settings?workspaceId=__global__&settingKey=api-keys');
    if (!res.ok) return;

    const data = await res.json();
    const keys = data?.settings?.['__global___api-keys'];
    if (!keys || typeof keys !== 'object') return;

    for (const name of ALL_API_KEYS) {
      if (keys[name] && !getApiKey(name)) {
        setApiKey(name, keys[name]);
      }
    }
  } catch (error) {
    console.error('Failed to load API keys from Supabase:', error);
  }
}
