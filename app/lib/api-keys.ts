const STORAGE_PREFIX = 'cloudhelper.api-key.';

export type ApiKeyName = 'gemini' | 'groq' | 'google-sheets' | 'notion';

const KEY_LABELS: Record<ApiKeyName, string> = {
  gemini: 'Gemini API Key',
  groq: 'Groq API Key',
  'google-sheets': 'Google Sheets API Key',
  notion: 'Notion API Key',
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

export const ALL_API_KEYS: ApiKeyName[] = ['gemini', 'groq', 'google-sheets', 'notion'];

export function obfuscateKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return key.slice(0, 4) + '....';
  return key.slice(0, 6) + '....' + key.slice(-4);
}
