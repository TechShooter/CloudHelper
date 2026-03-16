'use client';

import { useState, useEffect } from 'react';

interface Props {
  selectedContexts: string[];
  setSelectedContexts: (contexts: string[]) => void;
  notes: {id: string, title: string, content: string}[];
  setNotes: (notes: {id: string, title: string, content: string}[]) => void;
  sheetData: any;
}

export default function ContextSelector({ selectedContexts, setSelectedContexts, notes, setNotes, sheetData }: Props) {
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '' });
  const [notionPages, setNotionPages] = useState<{id: string, title: string, content: string}[]>([]);
  const [loadingNotion, setLoadingNotion] = useState(false);

  const loadNotion = async () => {
    setLoadingNotion(true);
    try {
      const res = await fetch('/api/notion');
      const data = await res.json();
      if (data.error) {
        alert(`Notion Error: ${data.error}`);
        console.error('Notion error:', data.error);
      } else if (data.pages) {
        setNotionPages(data.pages);
        if (data.pages.length === 0) {
          alert('No Notion pages found. Make sure you shared your database with the integration.');
        }
      }
    } catch (error) {
      console.error('Failed to load Notion:', error);
      alert('Failed to load Notion pages. Check console for details.');
    }
    setLoadingNotion(false);
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
            onClick={loadNotion}
            disabled={loadingNotion}
            className="text-xs bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 disabled:bg-gray-600"
          >
            {loadingNotion ? 'Loading...' : notionPages.length > 0 ? '✓ Notion' : 'Load Notion'}
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
        {notionPages.map(page => (
          <label key={page.id} className="flex items-center gap-1 text-sm text-purple-400">
            <input
              type="checkbox"
              checked={selectedContexts.includes(`notion-${page.id}`)}
              onChange={() => toggleContext(`notion-${page.id}`)}
            />
            <span>{page.title}</span>
          </label>
        ))}
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
        {notes.length === 0 && !sheetData && notionPages.length === 0 && (
          <p className="text-xs text-gray-500">Load your sheet, Notion pages, or add notes to get started!</p>
        )}
      </div>
    </div>
  );
}
