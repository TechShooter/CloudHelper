'use client';

import { useState, useEffect } from 'react';
import { getApiKey } from '../lib/api-keys';

interface Sheet {
  id: string;
  name: string;
  sheetId: string;
}

interface Props {
  onSheetLoad: (data: any) => void;
}

export default function SheetManager({ onSheetLoad }: Props) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newSheet, setNewSheet] = useState({ name: '', sheetId: '' });

  useEffect(() => {
    const saved = localStorage.getItem('googleSheets');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setSheets(parsed);
      } catch {
        // ignore
      }
    }
  }, []);

  const addSheet = () => {
    if (newSheet.name && newSheet.sheetId) {
      const sheet = { id: Date.now().toString(), ...newSheet };
      const updated = [...sheets, sheet];
      setSheets(updated);
      localStorage.setItem('googleSheets', JSON.stringify(updated));
      setNewSheet({ name: '', sheetId: '' });
      setShowAdd(false);
    }
  };

  const removeSheet = (id: string) => {
    const updated = sheets.filter(s => s.id !== id);
    setSheets(updated);
    localStorage.setItem('googleSheets', JSON.stringify(updated));
    if (selectedSheet === id) setSelectedSheet('');
  };

  const loadSheet = async (sheetId: string) => {
    setLoading(true);
    setSelectedSheet(sheetId);
    try {
      const sheetsKey = getApiKey('google-sheets-api-key');
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sheetsKey && { 'x-api-key-google-sheets': sheetsKey }),
        },
        body: JSON.stringify({ action: 'getAllSheets', sheetId })
      });
      const data = await res.json();
      
      if (data.sheets) {
        onSheetLoad(data.sheets);
        alert(`✓ Loaded ${data.sheets.length} sheets`);
      } else if (data.error) {
        alert(`Error: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Failed to load: ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-gray-300">Google Sheets</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
        >
          + Add Sheet
        </button>
      </div>

      {showAdd && (
        <div className="mb-3 p-3 bg-gray-700 rounded space-y-2">
          <input
            type="text"
            placeholder="Sheet name (e.g., Food Database)"
            value={newSheet.name}
            onChange={(e) => setNewSheet({ ...newSheet, name: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
          />
          <input
            type="text"
            placeholder="Sheet ID (from URL)"
            value={newSheet.sheetId}
            onChange={(e) => setNewSheet({ ...newSheet, sheetId: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
          />
          <button
            onClick={addSheet}
            className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
          >
            Save
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {sheets.map(sheet => (
          <div key={sheet.id} className="flex items-center gap-1 bg-gray-700 rounded px-2 py-1">
            <button
              onClick={() => loadSheet(sheet.sheetId)}
              disabled={loading}
              className={`text-xs px-2 py-1 rounded ${
                selectedSheet === sheet.sheetId
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-600 text-white hover:bg-gray-500'
              }`}
            >
              {loading && selectedSheet === sheet.sheetId ? 'Loading...' : sheet.name}
            </button>
            <button
              onClick={() => removeSheet(sheet.id)}
              className="text-xs text-red-400 hover:text-red-300"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
