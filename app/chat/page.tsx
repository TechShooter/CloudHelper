'use client';

import { useState, useEffect, useRef, Suspense, lazy, useCallback } from 'react';

// Dynamic imports to reduce initial bundle size
const WorkspaceManager = lazy(() => import('../components/WorkspaceManager'));
const ModelSelectorV3 = lazy(() => import('../components/ModelSelectorV3'));
const LogoutButton = lazy(() => import('../components/LogoutButton'));
const ApiKeySettings = lazy(() => import('../components/ApiKeySettings'));

import { getApiKey, loadApiKeysFromSupabase, pushLocalApiKeysToSupabase } from '../lib/api-keys';
import { createClient } from '@/utils/supabase/client';

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [aiModel, setAiModel] = useState<string>('gemini-flash-latest');
  const [aiProvider, setAiProvider] = useState<string>('gemini');
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
  const MODEL_STORAGE_KEY = 'cloudhelper.selectedModel';

  useEffect(() => {
    try {
      const savedModel = localStorage.getItem(MODEL_STORAGE_KEY);
      if (savedModel && savedModel !== aiModel) {
        setAiModel(savedModel);
      }
    } catch (error) {
      console.error('Failed to load saved model:', error);
    }
  }, []);

  const loadSheets = useCallback(async () => {
    const sheetsKey = getApiKey('google-sheets-api-key');
    const sheetId = getApiKey('google-sheet-id');
    console.debug('[sheet-load] sheetId:', sheetId, '| hasSheetsKey:', !!sheetsKey);
    if (!sheetId) {
      console.debug('[sheet-load] Aborting: hmm no Sheet ID configured (google-sheet-id).');
      return;
    }
    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sheetsKey && { 'x-api-key-google-sheets': sheetsKey }),
        },
        body: JSON.stringify({ action: 'getAllSheets', sheetId })
      });
      if (res.ok) {
        const data = await res.json();
        console.debug('[sheet-load] response usedFallback:', data?.usedFallback, '| tabs:', data?.sheets?.length, '| sheets:', data?.sheets?.map((s: any) => s.sheet));
        if (data?.sheets) setSheetData(data.sheets);
      } else {
        const errTxt = await res.text();
        console.warn('[sheet-load] HTTP', res.status, errTxt);
      }
    } catch (err) {
      console.error('[sheet-load] Failed to load sheets:', err);
    }
  }, []);

  useEffect(() => {
    loadApiKeysFromSupabase().then(() => {
      pushLocalApiKeysToSupabase();
      loadSheets();
    });

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === 'SIGNED_IN') {
        loadApiKeysFromSupabase().then(() => {
          pushLocalApiKeysToSupabase();
          loadSheets();
        });
      }
    });

    return () => subscription?.unsubscribe();
  }, [loadSheets]);

  useEffect(() => {
    history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);

    const setAppHeight = () => {
      if (containerRef.current) {
        const h = window.visualViewport?.height ?? window.innerHeight;
        containerRef.current.style.height = `${h}px`;
      }
    };
    setAppHeight();
    window.visualViewport?.addEventListener('resize', setAppHeight);
    window.addEventListener('resize', setAppHeight);
    return () => {
      window.visualViewport?.removeEventListener('resize', setAppHeight);
      window.removeEventListener('resize', setAppHeight);
    };
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === MODEL_STORAGE_KEY && event.newValue) {
        setAiModel(event.newValue);
      }
    };

    const handleModelSync = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (typeof customEvent.detail === 'string' && customEvent.detail) {
        setAiModel(customEvent.detail);
      }
    };

    const handleProviderChange = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (typeof customEvent.detail === 'string') {
        setAiProvider(customEvent.detail);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('cloudhelper:model-change', handleModelSync as EventListener);
    window.addEventListener('cloudhelper:provider-change', handleProviderChange);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('cloudhelper:model-change', handleModelSync as EventListener);
      window.removeEventListener('cloudhelper:provider-change', handleProviderChange);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, aiModel);
    } catch (error) {
      console.error('Failed to persist selected model:', error);
    }
  }, [aiModel]);

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
      setHierarchicalNotionPages([]);
      setNotionPages([]);
      setNotionError(null);
      setDebugInfo(null);

      console.log('[FRONTEND] 🚀 [1/5] Starting Notion stream...');
      setLoadingStatus({ step: 'Starting Notion stream', stage: 1, details: 'Connecting to Notion...' });

      const controller = new AbortController();
      notionAbortControllerRef.current = controller;
      const notionKey = getApiKey('notion');
      const response = await fetch(`/api/notion-stream?t=${Date.now()}`, {
        signal: controller.signal,
        headers: {
          ...(notionKey && { 'x-api-key-notion': notionKey }),
        },
      });
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

  const reloadNotion = async () => {
    setNotionPages([]);
    setHierarchicalNotionPages([]);
    await loadNotionStreaming();
  };

  const stopNotion = () => {
    stopNotionLoading();
  };

  return (
    <div ref={containerRef} className="fixed top-0 left-0 right-0 flex flex-col bg-gray-900 overflow-hidden">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-950/80 px-2 py-1 sm:px-4 sm:py-2">
        <span className="text-xs font-semibold text-white sm:text-base">☁️ CloudHelper</span>
        <div className="flex items-center gap-1 sm:gap-2">
          <Suspense fallback={<div className="text-white text-xs">...</div>}>
            <ModelSelectorV3 selectedModel={aiModel} onModelSelect={setAiModel} />
            <ApiKeySettings />
            <LogoutButton />
          </Suspense>
        </div>
      </header>

      <div className="flex-1 flex overflow-x-auto min-h-0">
        <Suspense fallback={<div className="text-white p-4">Caricamento...</div>}>
          <WorkspaceManager
            ref={workspaceManagerRef}
            notes={[]}
            aiModel={aiModel}
            aiProvider={aiProvider}
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
