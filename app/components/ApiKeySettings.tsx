'use client';

import { useEffect, useState } from 'react';
import { ALL_API_KEYS, type ApiKeyName, getApiKey, setApiKey, getKeyLabel, obfuscateKey } from '../lib/api-keys';

export default function ApiKeySettings() {
  const [isOpen, setIsOpen] = useState(false);
  const [keys, setKeys] = useState<Record<string, string>>({});

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('cloudhelper:open-api-settings', handler);
    return () => window.removeEventListener('cloudhelper:open-api-settings', handler);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const initial: Record<string, string> = {};
    for (const name of ALL_API_KEYS) {
      initial[name] = getApiKey(name);
    }
    setKeys(initial);
  }, [isOpen]);

  const saveKey = (name: ApiKeyName) => {
    setApiKey(name, keys[name] || '');
  };

  const clearKey = (name: ApiKeyName) => {
    setKeys((prev) => ({ ...prev, [name]: '' }));
    setApiKey(name, '');
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-sm text-gray-400 transition-colors hover:bg-gray-800 hover:text-white sm:h-8 sm:w-8"
        title="API Key Settings"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M11.828 2.25c-.916 0-1.699.663-1.85 1.567l-.091.558a.83.83 0 01-1.415.432l-.404-.404a1.854 1.854 0 00-2.623 0l-.736.736a1.854 1.854 0 000 2.623l.404.404c.368.368.613.896.432 1.415l-.558.09a1.857 1.857 0 00-1.567 1.851v1.036c0 .916.663 1.699 1.567 1.85l.558.091a.83.83 0 01.432 1.415l-.404.404a1.854 1.854 0 000 2.623l.736.736a1.854 1.854 0 002.623 0l.404-.404a.83.83 0 011.415.432l.091.558a1.857 1.857 0 001.85 1.567h1.036c.916 0 1.699-.663 1.85-1.567l.091-.558a.83.83 0 011.415-.432l.404.404a1.854 1.854 0 002.623 0l.736-.736a1.854 1.854 0 000-2.623l-.404-.404a.83.83 0 01-.432-1.415l.558-.09a1.857 1.857 0 001.567-1.851v-1.036c0-.916-.663-1.699-1.567-1.85l-.558-.091a.83.83 0 01-.432-1.415l.404-.404a1.854 1.854 0 000-2.623l-.736-.736a1.854 1.854 0 00-2.623 0l-.404.404a.83.83 0 01-1.415-.432l-.091-.558a1.857 1.857 0 00-1.85-1.567h-1.036zM12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">API Key Settings</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <p className="mb-4 text-sm text-gray-400">
              Provide your own API keys to enable features. Keys are saved locally in your browser and never sent to any server other than the respective API provider.
            </p>

            <div className="space-y-4">
              {ALL_API_KEYS.map((name) => (
                <div key={name}>
                  <label className="mb-1 block text-sm font-medium text-gray-300">
                    {getKeyLabel(name)}
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={keys[name] || ''}
                      onChange={(e) => setKeys((prev) => ({ ...prev, [name]: e.target.value }))}
                      placeholder={obfuscateKey(getApiKey(name)) || `Enter ${getKeyLabel(name)}`}
                      className="flex-1 rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-600"
                      type="password"
                    />
                    <button
                      onClick={() => saveKey(name)}
                      className="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                    >
                      Save
                    </button>
                    {getApiKey(name) && (
                      <button
                        onClick={() => clearKey(name)}
                        className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="rounded bg-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
