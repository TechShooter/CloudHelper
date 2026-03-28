'use client';

import { useState, useEffect } from 'react';
import UserProfile from './components/UserProfile';
import SheetManager from './components/SheetManager';
import MealTracker from './components/MealTracker';
import ContextSelector from './components/ContextSelector';
import WorkspaceManager from './components/WorkspaceManager';

export default function Home() {
  const [notes, setNotes] = useState<{id: string, title: string, content: string}[]>([]);
  const [sheetData, setSheetData] = useState<any>(null);
  const [aiModel, setAiModel] = useState<'gemini-flash' | 'gemini-2.5' | 'gemini-2.5-pro' | 'groq'>('gemini-flash');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [mealHistory, setMealHistory] = useState<any[]>([]);
  const [notionPages, setNotionPages] = useState<any[]>([]);
  const [hierarchicalNotionPages, setHierarchicalNotionPages] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  // Auto-load default sheet on mount
  useEffect(() => {
    const loadDefaultSheet = async () => {
      try {
        const res = await fetch('/api/sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'getAllSheets',
            sheetId: '1FvjfZ5a-OMM2ScO2lJewBFIrbnWvgQKJug_Ve32gAQA'
          })
        });
        const data = await res.json();
        if (data.sheets) {
          setSheetData(data.sheets);
        }
      } catch (error) {
        console.error('Failed to auto-load sheet:', error);
      }
    };

    loadDefaultSheet();
  }, []);

  // Auto-load Notion pages on mount
  useEffect(() => {
    const loadNotionPages = async () => {
      console.log('Loading Notion pages...');
      try {
        const res = await fetch('/api/notion');
        console.log('Notion API response status:', res.status);
        const data = await res.json();
        console.log('Notion API response data:', data);
        if (data.pages) {
          setNotionPages(data.pages);
          setHierarchicalNotionPages(data.hierarchicalPages || []);
          console.log('Set Notion pages:', data.pages.length);
        } else if (data.error) {
          console.error('Notion API error:', data.error);
        }
      } catch (error) {
        console.error('Failed to auto-load Notion:', error);
      }
    };

    loadNotionPages();
  }, []);

  const reloadNotionPages = async () => {
    try {
      const res = await fetch('/api/notion');
      const data = await res.json();
      if (data.pages) {
        setNotionPages(data.pages);
        setHierarchicalNotionPages(data.hierarchicalPages || []);
      }
    } catch (error) {
      console.error('Failed to reload Notion:', error);
      throw error;
    }
  };

  const handleSheetLoad = (data: any) => {
    setSheetData(data);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">CloudHelper AI</h1>
        <div className="flex items-center gap-3">
          <select 
            value={aiModel} 
            onChange={(e) => setAiModel(e.target.value as any)}
            className="bg-gray-700 text-white px-3 py-1 rounded text-sm border border-gray-600"
          >
            <option value="gemini-flash">Gemini Flash Latest</option>
            <option value="gemini-2.5">Gemini 2.5 Flash</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="groq">Groq (Llama 3.3 70B)</option>
          </select>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-gray-300 hover:text-white text-xl"
          >
            ⚙️
          </button>
        </div>
      </header>
      
      {showSettings && (
        <div className="bg-gray-800 border-b border-gray-700 overflow-y-auto max-h-96">
          <UserProfile onProfileChange={setUserProfile} />
          <MealTracker onMealsChange={setMealHistory} />
          <SheetManager onSheetLoad={handleSheetLoad} />
          <ContextSelector 
            selectedContexts={[]}
            setSelectedContexts={() => {}}
            notes={notes}
            setNotes={setNotes}
            sheetData={sheetData}
            onNotionLoad={setNotionPages}
          />
        </div>
      )}
      
      <WorkspaceManager
        notes={notes}
        aiModel={aiModel}
        userProfile={userProfile}
        sheetData={sheetData}
        mealHistory={mealHistory}
        notionPages={notionPages}
        allNotionPages={notionPages}
        hierarchicalNotionPages={hierarchicalNotionPages}
        onReloadNotion={reloadNotionPages}
      />
    </div>
  );
}
