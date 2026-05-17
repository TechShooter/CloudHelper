'use client';

import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useRouter } from 'next/navigation';

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
  const [notionError, setNotionError] = useState<string | null>(null);
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

  // Function to build hierarchy from flat pages
  const buildHierarchy = (pages: any[]) => {
    const pageMap = new Map();
    pages.forEach(page => pageMap.set(page.id, { ...page, children: [] }));
    
    const rootPages: any[] = [];
    pages.forEach(page => {
      const parentId = page.parent?.page_id || page.parent?.database_id || page.parent?.data_source_id;
      if (parentId && pageMap.has(parentId)) {
        pageMap.get(parentId).children.push(pageMap.get(page.id));
      } else {
        rootPages.push(pageMap.get(page.id));
      }
    });
    return rootPages;
  };

  const loadNotionStreaming = async () => {
    try {
      const response = await fetch(`/api/notion?t=${Date.now()}`);
      if (!response.ok) {
        const errorMsg = response.status === 429 
          ? '⚠️ Notion API Rate Limit: Too many requests. Please wait a moment and try again.'
          : `Failed to fetch Notion data: ${response.status}`;
        console.error('Failed to fetch Notion data:', response.status);
        setNotionError(errorMsg);
        return;
      }

      const data = await response.json();
      if (data.error) {
        console.error('Notion API error:', data.error);
        setNotionError(`Notion API Error: ${data.error}`);
        return;
      }

      setNotionPages(data.pages || []);
      setHierarchicalNotionPages(data.hierarchicalPages || []);
      setNotionError(null); // Clear error on success
    } catch (error) {
      console.error('Failed to load Notion data:', error);
      setNotionError(`Error loading Notion data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Load data
  useEffect(() => {
    if (checkingAuth) return;
    
    const loadData = async () => {
      try {
        // Load sheets separately
        fetch('/api/sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'getAllSheets',
            sheetId: '1FvjfZ5a-OMM2ScO2lJewBFIrbnWvgQKJug_Ve32gAQA'
          })
        }).then(res => {
          if (res.ok) return res.json();
        }).then(data => {
          if (data?.sheets) setSheetData(data.sheets);
        }).catch(err => console.error('Failed to load sheets:', err));
        
        // Load Notion using streaming
        await loadNotionStreaming();
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    
    loadData();
  }, [checkingAuth]);

  const reloadNotion = async () => {
    setNotionPages([]);
    setHierarchicalNotionPages([]);
    await loadNotionStreaming();
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
            notionError={notionError}
            onReloadNotion={reloadNotion}
          />
        </Suspense>
      </div>
    </div>
  );
}
