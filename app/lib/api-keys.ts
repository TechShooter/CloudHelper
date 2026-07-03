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
