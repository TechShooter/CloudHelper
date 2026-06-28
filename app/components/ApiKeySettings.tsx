'use client';

import { useEffect, useState } from 'react';
import { ALL_API_KEYS, type ApiKeyName, getApiKey, setApiKey, getKeyLabel, obfuscateKey } from '../lib/api-keys';

export default function ApiKeySettings() {
  const [isOpen, setIsOpen] = useState(false);
  const [keys, setKeys] = useState<Record<string, string>>({});

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
        className="rounded bg-gray-700 px-2.5 py-2 text-sm text-gray-300 hover:bg-gray-600"
        title="API Key Settings"
      >
        ⚙
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
