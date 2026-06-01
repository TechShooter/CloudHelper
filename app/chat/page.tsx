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
  const [isLoadingNotion, setIsLoadingNotion] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<{
    step: string;
    stage: number;
    details: string;
  } | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const notionAbortControllerRef = useRef<AbortController | null>(null);
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

  // Function to build hierarchy from flat pages.
  // If a page has a parent that isn't loaded yet, create a placeholder parent node so children still appear nested.
  const buildHierarchy = (pages: any[]) => {
    const pageMap = new Map<string, any>();

    const formatPlaceholderTitle = (parentId: string, parentType: string) => {
      const shortId = parentId?.slice(0, 6);
      if (parentType === 'page_id') {
        return `Loading parent page (${shortId})...`;
      }
      if (parentType === 'database_id') {
        return `Loading parent database (${shortId})...`;
      }
      if (parentType === 'data_source_id') {
        return `Loading parent data source (${shortId})...`;
      }
      if (parentType === 'block_id') {
        return `Loading parent block (${shortId})...`;
      }
      if (parentType === 'agent_id') {
        return `Loading parent agent (${shortId})...`;
      }
      return `Loading ${parentType.replace('_', ' ')} (${shortId})...`;
    };

    const ensureParentNode = (parentId: string, parentType: string) => {
      if (!pageMap.has(parentId)) {
        const placeholderTitle = formatPlaceholderTitle(parentId, parentType);
        pageMap.set(parentId, {
          id: parentId,
          title: placeholderTitle,
          content: '',
          object: parentType === 'database_id' ? 'database' : parentType === 'data_source_id' ? 'data_source' : parentType === 'block_id' ? 'block' : parentType === 'agent_id' ? 'agent' : 'page',
          parent: { type: 'workspace' },
          children: [],
          __placeholder: true
        });
      }
    };

    pages.forEach(page => {
      pageMap.set(page.id, { ...page, children: page.children || [] });
    });

    const rootPages: any[] = [];
    const childIds = new Set<string>();

    pages.forEach(page => {
      const parent = page.parent;
      const parentId = parent?.page_id || parent?.database_id || parent?.data_source_id || parent?.block_id || parent?.agent_id;
      const parentType = parent?.type || 'workspace';

      if (parentId && parentType !== 'workspace') {
        ensureParentNode(parentId, parentType);
        const parentNode = pageMap.get(parentId);
        parentNode.children.push(pageMap.get(page.id));
        childIds.add(page.id);
      } else {
        rootPages.push(pageMap.get(page.id));
      }
    });

    // Any placeholder parents that were created but never became real pages should also be roots if they have children.
    pageMap.forEach((page, id) => {
      if (page.__placeholder && page.children.length > 0 && !childIds.has(id)) {
        rootPages.push(page);
      }
    });

    return rootPages;
  };

  const stopNotionLoading = () => {
    if (notionAbortControllerRef.current) {
      notionAbortControllerRef.current.abort();
      notionAbortControllerRef.current = null;
      setLoadingStatus({ step: 'Notion load stopped', stage: 0, details: 'Notion loading was cancelled.' });
      setIsLoadingNotion(false);
    }
  };

  const loadNotionStreaming = async () => {
    try {
      setIsLoadingNotion(true);
      setHierarchicalNotionPages([]); // Clear old data
      setNotionPages([]);
      setNotionError(null);
      setDebugInfo(null);

      console.log('[FRONTEND] 🚀 [1/5] Starting Notion stream...');
      setLoadingStatus({ step: 'Starting Notion stream', stage: 1, details: 'Connecting to Notion...' });

      const controller = new AbortController();
      notionAbortControllerRef.current = controller;
      const response = await fetch(`/api/notion-stream?t=${Date.now()}`, { signal: controller.signal });
      console.log('[FRONTEND] ✅ [2/5] Stream response received:', response.status);

      if (!response.ok) {
        const text = await response.text();
        const errorMsg = response.status === 429
          ? '⚠️ Notion API Rate Limit: Too many requests. Please wait a moment and try again.'
          : `Failed to fetch Notion stream: ${response.status}`;
        console.error('Failed to fetch Notion stream:', response.status, text);
        setNotionError(errorMsg);
        setIsLoadingNotion(false);
        return;
      }

      if (!response.body) {
        const text = await response.text();
        const data = JSON.parse(text);

        if (data.error) {
          setNotionError(`Notion API Error: ${data.error}`);
        } else {
          setNotionPages(data.pages || []);
          setHierarchicalNotionPages(buildHierarchy(data.pages || []));
          if (data.debug) {
            setDebugInfo(data.debug);
          }
        }

        setIsLoadingNotion(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let processedPages = 0;
      let streamError = false;

      const handleStreamLine = (line: string) => {
        if (!line.trim()) return;
        try {
          const message = JSON.parse(line);

          if (message.type === 'status') {
            setLoadingStatus({
              step: message.step || 'Loading Notion',
              stage: message.stage || 2,
              details: message.details || ''
            });
          }

          if (message.type === 'page_batch') {
            const newPages = message.pages || [];
            processedPages += newPages.length;
            setNotionPages(prev => {
              const updated = [...prev, ...newPages];
              setHierarchicalNotionPages(buildHierarchy(updated));
              return updated;
            });
            setLoadingStatus({
              step: 'Receiving pages',
              stage: 3,
              details: `${processedPages}/${message.totalPages || '?'} pages loaded`
            });
          }

          if (message.type === 'done') {
            setLoadingStatus({
              step: 'Notion stream complete',
              stage: 5,
              details: message.details || 'Loaded all pages'
            });
          }

          if (message.type === 'error') {
            console.error('[FRONTEND] Stream error:', message.message);
            setNotionError(`Notion stream error: ${message.message}`);
            streamError = true;
          }
        } catch (error) {
          console.warn('[FRONTEND] Failed to parse stream message:', error, line);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach(handleStreamLine);
        if (streamError) break;
      }

      if (buffer && !streamError) {
        handleStreamLine(buffer);
      }

      if (!streamError) {
        setIsLoadingNotion(false);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.log('[FRONTEND] Notion stream aborted by user');
        setLoadingStatus({ step: 'Notion load stopped', stage: 0, details: 'Notion loading was cancelled.' });
      } else {
        console.error('Failed to load Notion stream:', error);
        setNotionError(`Error loading Notion stream: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      setIsLoadingNotion(false);
    } finally {
      notionAbortControllerRef.current = null;
    }
  };

  // Load data on mount (but NOT Notion - only on button click)
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

        // Note: Notion is NOT auto-loaded. User must click "Reload" button.
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

  const stopNotion = () => {
    stopNotionLoading();
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
            isLoadingNotion={isLoadingNotion}
            onReloadNotion={reloadNotion}
            onStopNotion={stopNotion}
          />
        </Suspense>
      </div>
    </div>
  );
}
