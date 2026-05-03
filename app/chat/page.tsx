'use client';

import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useRouter } from 'next/navigation';

export const runtime = 'edge';

// Dynamic imports to reduce initial bundle size
const WorkspaceManager = lazy(() => import('../components/WorkspaceManager'));
const ModelSelector = lazy(() => import('../components/ModelSelector'));
const LogoutButton = lazy(() => import('../components/LogoutButton'));

export default function Home() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [aiModel, setAiModel] = useState<string>('gemini-flash-latest');
  const [sheetData, setSheetData] = useState<any>(null);
  const [notionPages, setNotionPages] = useState<any[]>([]);
  const [hierarchicalNotionPages, setHierarchicalNotionPages] = useState<any[]>([]);
  const workspaceManagerRef = useRef<any>(null);

  // Check auth on mount - dynamic import of supabase
  useEffect(() => {
    const checkAuth = async () => {
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setCheckingAuth(false);
    };
    checkAuth();
  }, [router]);

  // Load data
  useEffect(() => {
    if (checkingAuth) return;
    
    const loadData = async () => {
      try {
        const [sheetsRes, notionRes] = await Promise.all([
          fetch('/api/sheets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'getAllSheets',
              sheetId: '1FvjfZ5a-OMM2ScO2lJewBFIrbnWvgQKJug_Ve32gAQA'
            })
          }),
          fetch('/api/notion/stream')
        ]);
        
        const sheetsData = await sheetsRes.json();
        if (sheetsData.sheets) setSheetData(sheetsData.sheets);
        
        // Stream notion pages
        const reader = notionRes.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          const pages: any[] = [];
          let buffer = '';
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const page = JSON.parse(line);
                if (!page.error) {
                  pages.push(page);
                  setNotionPages([...pages]);
                }
              } catch {}
            }
          }
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    
    loadData();
  }, [checkingAuth]);

  const reloadNotion = async () => {
    try {
      const res = await fetch('/api/notion/stream');
      const reader = res.body?.getReader();
      if (!reader) return;
      
      const decoder = new TextDecoder();
      const pages: any[] = [];
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const page = JSON.parse(line);
            if (!page.error) {
              pages.push(page);
              setNotionPages([...pages]);
            }
          } catch {}
        }
      }
    } catch (error) {
      console.error('Failed to reload:', error);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
        <span className="text-lg sm:text-xl font-semibold text-white">☁️ CloudHelper</span>
        <div className="flex items-center gap-2 sm:gap-3">
          <Suspense fallback={<div className="text-white">...</div>}>
            <ModelSelector selectedModel={aiModel} onModelSelect={setAiModel} />
            <LogoutButton />
          </Suspense>
        </div>
      </header>
      
      <div className="flex-1 flex overflow-x-auto">
        <Suspense fallback={<div className="text-white p-4">Caricamento...</div>}>
          <WorkspaceManager
            ref={workspaceManagerRef}
            notes={[]}
            aiModel={aiModel}
            sheetData={sheetData}
            notionPages={notionPages}
            allNotionPages={notionPages}
            hierarchicalNotionPages={hierarchicalNotionPages}
            onReloadNotion={reloadNotion}
          />
        </Suspense>
      </div>
    </div>
  );
}
