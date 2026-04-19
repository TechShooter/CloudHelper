'use client';

import { useState, useEffect, useRef } from 'react';
import WorkspaceManager from '../components/WorkspaceManager';
import ModelSelector from '../components/ModelSelector';

export const runtime = 'edge';
import LogoutButton from '../components/LogoutButton';

export default function Home() {
  const [notes] = useState<{id: string, title: string, content: string}[]>([]);
  const [sheetData, setSheetData] = useState<any>(null);
  const [aiModel, setAiModel] = useState<string>('gemini-flash-latest');
  const [notionPages, setNotionPages] = useState<any[]>([]);
  const [hierarchicalNotionPages, setHierarchicalNotionPages] = useState<any[]>([]);
  const workspaceManagerRef = useRef<any>(null);

  // Helper function to build hierarchy from flat list
  const buildHierarchy = (pages: any[]) => {
    const pageMap = new Map();
    const rootPages: any[] = [];

    // First pass: create map with children arrays
    pages.forEach(page => {
      pageMap.set(page.id, { ...page, children: [] });
    });

    // Second pass: build hierarchy
    pages.forEach(page => {
      // Extract parent ID based on parent type
      let parentId;
      if (page.parent?.type === 'data_source_id') {
        parentId = page.parent.data_source_id;
      } else if (page.parent?.type === 'database_id') {
        parentId = page.parent.database_id;
      } else if (page.parent?.type === 'page_id') {
        parentId = page.parent.page_id;
      } else {
        parentId = page.parent?.page_id || page.parent?.database_id || page.parent?.data_source_id;
      }

      if (!parentId || page.parent?.type === 'workspace') {
        // Root level page
        rootPages.push(pageMap.get(page.id));
      } else if (pageMap.has(parentId)) {
        // Has a parent in our map
        const parent = pageMap.get(parentId);
        parent.children.push(pageMap.get(page.id));
      } else {
        // Parent not found, treat as root
        rootPages.push(pageMap.get(page.id));
      }
    });

    return rootPages;
  };

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
          console.log(`✅ Loaded ${data.sheets.length} sheets`);
          setSheetData(data.sheets);
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
      try {
        const res = await fetch('/api/notion/stream');
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          const pages: any[] = [];
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            buffer += text;
            
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const page = JSON.parse(line);
                if (page.error) {
                  console.error('Notion error:', page.error);
                } else {
                  pages.push(page);
                  // Update state incrementally for progressive visualization
                  setNotionPages([...pages]);
                  const hierarchical = buildHierarchy(pages);
                  setHierarchicalNotionPages(hierarchical);
                }
              } catch (e) {
                console.error('Parse error:', e, line);
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
    try {
      const res = await fetch('/api/notion/stream');
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        const pages: any[] = [];
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          buffer += text;
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const page = JSON.parse(line);
              if (page.error) {
                console.error('Notion error:', page.error);
              } else {
                pages.push(page);
                // Update state incrementally for progressive visualization
                setNotionPages([...pages]);
                const hierarchical = buildHierarchy(pages);
                setHierarchicalNotionPages(hierarchical);
              }
            } catch (e) {
              console.error('Parse error:', e, line);
            }
          }
        }
        console.log(`✅ Reloaded ${pages.length} Notion pages`);
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
        sheetData={sheetData}
        notionPages={notionPages}
        allNotionPages={notionPages}
        hierarchicalNotionPages={hierarchicalNotionPages}
        onReloadNotion={reloadNotion}
      />
      </div>
    </div>
  );
}
