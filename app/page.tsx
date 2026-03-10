'use client';

import { useState } from 'react';
import ContextSelector from './components/ContextSelector';
import ChatInterface from './components/ChatInterface';

export default function Home() {
  const [selectedContexts, setSelectedContexts] = useState<string[]>([]);
  const [notes, setNotes] = useState<{id: string, title: string, content: string}[]>([]);
  const [sheetData, setSheetData] = useState<string[][] | null>(null);
  const [aiModel, setAiModel] = useState<'gemini-flash' | 'gemini-2.5' | 'groq'>('gemini-flash');

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">CloudHelper AI</h1>
        <select 
          value={aiModel} 
          onChange={(e) => setAiModel(e.target.value as any)}
          className="bg-gray-700 text-white px-3 py-1 rounded text-sm border border-gray-600"
        >
          <option value="gemini-flash">Gemini Flash (Latest)</option>
          <option value="gemini-2.5">Gemini 2.5 Flash</option>
          <option value="groq">Groq (Llama 3.3)</option>
        </select>
      </header>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <ContextSelector 
          selectedContexts={selectedContexts}
          setSelectedContexts={setSelectedContexts}
          notes={notes}
          setNotes={setNotes}
        />
        
        <ChatInterface 
          selectedContexts={selectedContexts}
          notes={notes}
          aiModel={aiModel}
        />
      </div>
    </div>
  );
}
