'use client';

import { useState, useEffect } from 'react';

interface Props {
  selectedContexts: string[];
  setSelectedContexts: (contexts: string[]) => void;
  notes: {id: string, title: string, content: string}[];
  setNotes: (notes: {id: string, title: string, content: string}[]) => void;
}

export default function ContextSelector({ selectedContexts, setSelectedContexts, notes, setNotes }: Props) {
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '' });
  const [sheetData, setSheetData] = useState<string[][] | null>(null);
  const [loadingSheet, setLoadingSheet] = useState(false);

  const loadSheet = async () => {
    setLoadingSheet(true);
    try {
      const res = await fetch('/api/sheets');
      const data = await res.json();
      if (data.data) {
        setSheetData(data.data);
      }
    } catch (error) {
      console.error('Failed to load sheet:', error);
    }
    setLoadingSheet(false);
  };

  const toggleContext = (id: string) => {
    setSelectedContexts(
      selectedContexts.includes(id)
        ? selectedContexts.filter(c => c !== id)
        : [...selectedContexts, id]
    );
  };

  const addNote = () => {
    if (newNote.title && newNote.content) {
      const note = { id: Date.now().toString(), ...newNote };
      setNotes([...notes, note]);
      setNewNote({ title: '', content: '' });
      setShowAddNote(false);
    }
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-gray-300">Select Context</h2>
        <div className="flex gap-2">
          <button
            onClick={loadSheet}
            disabled={loadingSheet}
            className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:bg-gray-600"
          >
            {loadingSheet ? 'Loading...' : sheetData ? '✓ Sheet' : 'Load Sheet'}
          </button>
          <button
            onClick={() => setShowAddNote(!showAddNote)}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            + Note
          </button>
        </div>
      </div>

      {showAddNote && (
        <div className="mb-3 p-3 bg-gray-700 rounded">
          <input
            type="text"
            placeholder="Note title"
            value={newNote.title}
            onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded mb-2"
          />
          <textarea
            placeholder="Note content"
            value={newNote.content}
            onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded mb-2"
            rows={3}
          />
          <button onClick={addNote} className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">
            Save
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {sheetData && (
          <label className="flex items-center gap-1 text-sm text-green-400">
            <input
              type="checkbox"
              checked={selectedContexts.includes('sheet')}
              onChange={() => toggleContext('sheet')}
            />
            <span>Google Sheet Database</span>
          </label>
        )}
        {notes.map(note => (
          <label key={note.id} className="flex items-center gap-1 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={selectedContexts.includes(note.id)}
              onChange={() => toggleContext(note.id)}
            />
            <span>{note.title}</span>
          </label>
        ))}
        {notes.length === 0 && !sheetData && (
          <p className="text-xs text-gray-500">Load your sheet or add notes to get started!</p>
        )}
      </div>
    </div>
  );
}
