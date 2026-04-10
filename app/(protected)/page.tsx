'use client';

import { useState, useEffect, useRef } from 'react';
import WorkspaceManager from '../components/WorkspaceManager';
import ModelSelector from '../components/ModelSelector';
import LogoutButton from '../components/LogoutButton';

export default function Home() {
  const [notes, setNotes] = useState<{id: string, title: string, content: string}[]>([]);
  const [sheetData, setSheetData] = useState<any>(null);
  const [aiModel, setAiModel] = useState<string>('gemini-flash');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [mealHistory, setMealHistory] = useState<any[]>([]);
  const [notionPages, setNotionPages] = useState<any[]>([]);
  const [hierarchicalNotionPages, setHierarchicalNotionPages] = useState<any[]>([]);
  const workspaceManagerRef = useRef<any>(null);

  // Auto-load default sheet on mount
  useEffect(() => {
    const loadDefaultSheet = async () => {
      try {
        console.log('🔄 Loading default sheet...');
        const res = await fetch('/api/sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'getAllSheets',
            sheetId: '1FvjfZ5a-OMM2ScO2lJewBFIrbnWvgQKJug_Ve32gAQA'
          })
        });
        const data = await res.json();
        console.log('📊 Sheets API response:', data);
        
        if (data.sheets) {
          console.log(`✅ Loaded ${data.sheets.length} sheets`);
          data.sheets.forEach((sheet: any, idx: number) => {
            console.log(`Sheet ${idx + 1}: ${sheet.sheet} - ${sheet.rows} rows`);
          });
          setSheetData(data.sheets);
        } else {
          console.error('❌ No sheets data received:', data);
        }
      } catch (error) {
        console.error('❌ Failed to auto-load sheet:', error);
      }
    };

    loadDefaultSheet();
  }, []);

  // Auto-load Notion pages on mount with streaming
  useEffect(() => {
    const loadNotionPages = async () => {
      console.log('Loading Notion pages...');
      try {
        const res = await fetch('/api/notion/stream');
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          const pages: any[] = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value);
            const lines = text.split('\n').filter(line => line.trim());

            for (const line of lines) {
              try {
                const page = JSON.parse(line);
                if (page.error) {
                  console.error('Notion error:', page.error);
                } else {
                  pages.push(page);
                  setNotionPages([...pages]);
                }
              } catch (e) {
                console.error('Parse error:', e);
              }
            }
          }
          console.log(`✅ Loaded ${pages.length} Notion pages`);
        }
      } catch (error) {
        console.error('❌ Failed to load Notion:', error);
      }
    };

    loadNotionPages();
  }, []);

  const reloadNotion = async () => {
    console.log('Reloading Notion pages...');
    try {
      const res = await fetch('/api/notion/stream');
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        const pages: any[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const page = JSON.parse(line);
              if (page.error) {
                console.error('Notion error:', page.error);
              } else {
                pages.push(page);
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
        console.log(`✅ Reloaded ${pages.length} Notion pages`);
        setNotionPages(pages);
        setHierarchicalNotionPages([]);
      }
    } catch (error) {
      console.error('❌ Failed to reload Notion:', error);
    }
  };

  const returnToGeneralChat = () => {
    if (workspaceManagerRef.current) {
      workspaceManagerRef.current.setActiveWorkspace('general');
      workspaceManagerRef.current.setActiveTab('chat');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
        <button
          onClick={returnToGeneralChat}
          className="text-lg sm:text-xl font-semibold text-white hover:text-blue-400 transition-colors cursor-pointer"
          title="Return to General Chat"
        >
          ☁️ CloudHelper
        </button>
        <div className="flex items-center gap-2 sm:gap-3">
          <ModelSelector 
            selectedModel={aiModel}
            onModelSelect={setAiModel}
          />
          <LogoutButton />
        </div>
      </header>
      
      <div className="flex-1 flex overflow-x-auto">
      
      <WorkspaceManager
        ref={workspaceManagerRef}
        notes={notes}
        aiModel={aiModel}
        userProfile={userProfile}
        sheetData={sheetData}
        mealHistory={mealHistory}
        notionPages={notionPages}
        allNotionPages={notionPages}
        hierarchicalNotionPages={hierarchicalNotionPages}
        onReloadNotion={reloadNotion}
      />
      </div>
    </div>
  );
}
