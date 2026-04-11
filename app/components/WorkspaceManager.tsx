'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { ReactNode } from 'react';
import ChatInterface from './ChatInterface';
import CalendarView from './CalendarView';
import NutrientTracker from './NutrientTracker';
import ModelTesting from './ModelTesting';

interface Workspace {
  id: string;
  name: string;
  icon: string;
  description: string;
  autoLoadSheets: boolean;
  autoLoadNotion: boolean;
  autoLoadMeals: boolean;
  autoLoadProfile: boolean;
  systemPrompt?: string;
}

const DEFAULT_WORKSPACES: Workspace[] = [
  {
    id: 'general',
    name: 'General',
    icon: '💬',
    description: 'General purpose chat with all data',
    autoLoadSheets: true,
    autoLoadNotion: true,
    autoLoadMeals: true,
    autoLoadProfile: true
  },
  {
    id: 'nutrition',
    name: 'Nutrition',
    icon: '🥗',
    description: 'Food analysis and meal planning',
    autoLoadSheets: true,
    autoLoadNotion: true,
    autoLoadMeals: true,
    autoLoadProfile: true,
    systemPrompt: 'You are a nutrition expert. Focus on food analysis, meal planning, calorie tracking, and nutritional advice. You have access to the food database and home inventory ("Cosa c\'è in casa / Scorte a casa").'
  },
  {
    id: 'goals',
    name: 'Goals & Progress',
    icon: '🎯',
    description: 'Track goals and analyze progress',
    autoLoadSheets: false,
    autoLoadNotion: true,
    autoLoadMeals: true,
    autoLoadProfile: false,
    systemPrompt: 'You are a personal coach. Focus on goal setting, progress tracking, and motivation. You have access to Timeline, Tasks to do db, and Goals pages.'
  },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: '📅',
    description: 'View and manage your schedule',
    autoLoadSheets: false,
    autoLoadNotion: false,
    autoLoadMeals: false,
    autoLoadProfile: false,
    systemPrompt: 'You are a scheduling assistant. Help with calendar management, event planning, and time organization.'
  },
  {
    id: 'research',
    name: 'Research',
    icon: '📚',
    description: 'Deep analysis and research',
    autoLoadSheets: true,
    autoLoadNotion: true,
    autoLoadMeals: false,
    autoLoadProfile: false,
    systemPrompt: 'You are a research assistant. Focus on detailed analysis, data interpretation, and insights.'
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: '🎮',
    description: 'Games, TV shows, music and entertainment',
    autoLoadSheets: false,
    autoLoadNotion: true,
    autoLoadMeals: false,
    autoLoadProfile: false,
    systemPrompt: 'You are an entertainment expert. Focus on games, TV shows, music, movies, and entertainment recommendations. You have access to the Entertainment list page.'
  },
  {
    id: 'emotion-regulation',
    name: 'Regolazione emotiva',
    icon: '💭',
    description: 'Emotional regulation and well-being support',
    autoLoadSheets: false,
    autoLoadNotion: true,
    autoLoadMeals: false,
    autoLoadProfile: false,
    systemPrompt: 'You are an emotional wellness expert. Focus on emotional regulation, stress management, coping strategies, and personal well-being. Provide compassionate, supportive guidance for emotional challenges.'
  },
  {
    id: 'model-testing',
    name: 'Model Testing',
    icon: '🧪',
    description: 'Test multiple AI models simultaneously',
    autoLoadSheets: false,
    autoLoadNotion: false,
    autoLoadMeals: false,
    autoLoadProfile: false,
    systemPrompt: 'You are a helpful AI assistant. Respond to the user\'s message clearly and concisely.'
  }
];

interface Props {
  notes: { id: string, title: string, content: string }[];
  aiModel: string;
  userProfile: any;
  sheetData: any;
  mealHistory: any[];
  notionPages: any[];
  allNotionPages: any[];
  hierarchicalNotionPages?: any[];
  onReloadNotion?: () => Promise<void>;
}

export default forwardRef(function WorkspaceManager({ notes, aiModel, userProfile, sheetData, mealHistory, notionPages, allNotionPages, hierarchicalNotionPages, onReloadNotion }: Props, ref) {
  const [activeWorkspace, setActiveWorkspace] = useState('general');
  const [activeTab, setActiveTab] = useState<'chat' | 'docs' | 'calendar' | 'nutrients'>('chat');
  const [workspaces] = useState<Workspace[]>(DEFAULT_WORKSPACES);
  const [showMenu, setShowMenu] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [nutrientEntries, setNutrientEntries] = useState<any[]>([]);
  
  // Prompt control state
  const [promptSettings, setPromptSettings] = useState({
    includeSheets: true,
    includeNotion: true,
    includeMealHistory: true,
    includeChatHistory: true,
    maxChatMessages: 6,
    maxSheetRows: 100,
    maxNotionPages: 50
  });

  // Expose functions to parent component
  useImperativeHandle(ref, () => ({
    setActiveWorkspace,
    setActiveTab
  }));

  const currentWorkspace = workspaces.find(w => w.id === activeWorkspace) || workspaces[0];
  const [selectedContexts, setSelectedContexts] = useState<string[]>([]);
  const [loadingNotion, setLoadingNotion] = useState(false);
  const [sortOrder, setSortOrder] = useState<'title' | 'type' | 'hierarchy'>('hierarchy');
  const [groupByTags, setGroupByTags] = useState(true);
  const [defaultDocs, setDefaultDocs] = useState<{ [workspaceId: string]: string[] }>({});
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [customTags, setCustomTags] = useState<{ [pageId: string]: string[] }>({});
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

  // Load custom tags from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('notionCustomTags');
    if (saved) {
      try {
        setCustomTags(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load custom tags:', error);
      }
    }
  }, []);

  // Save custom tags to localStorage
  useEffect(() => {
    localStorage.setItem('notionCustomTags', JSON.stringify(customTags));
  }, [customTags]);

  // Load default docs from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('workspaceDefaultDocs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDefaultDocs(parsed);
        // Then initialize missing workspaces
        const updated = { ...parsed };
        let changed = false;
        workspaces.forEach(workspace => {
          if (!updated[workspace.id]) {
            const contexts: string[] = [];
            if (workspace.autoLoadSheets && sheetData) contexts.push('sheet');
            if (workspace.autoLoadNotion) {
              const notionCandidates = getNotionPagesForWorkspace(workspace, allNotionPages);
              notionCandidates.forEach((p: any) => contexts.push(`notion-${p.id}`));
            }
            updated[workspace.id] = contexts;
            changed = true;
          }
        });
        if (changed) {
          setDefaultDocs(updated);
        }
      } catch (error) {
        console.error('Failed to load default docs:', error);
        // Initialize all workspaces
        const initial: { [workspaceId: string]: string[] } = {};
        workspaces.forEach(workspace => {
          const contexts: string[] = [];
          if (workspace.autoLoadSheets && sheetData) contexts.push('sheet');
          if (workspace.autoLoadNotion) {
            const notionCandidates = getNotionPagesForWorkspace(workspace, allNotionPages);
            notionCandidates.forEach((p: any) => contexts.push(`notion-${p.id}`));
          }
          initial[workspace.id] = contexts;
        });
        setDefaultDocs(initial);
      }
    } else {
      // Initialize all workspaces
      const initial: { [workspaceId: string]: string[] } = {};
      workspaces.forEach(workspace => {
        const contexts: string[] = [];
        if (workspace.autoLoadSheets && sheetData) contexts.push('sheet');
        if (workspace.autoLoadNotion) {
          const notionCandidates = getNotionPagesForWorkspace(workspace, allNotionPages);
          notionCandidates.forEach((p: any) => contexts.push(`notion-${p.id}`));
        }
        initial[workspace.id] = contexts;
      });
      setDefaultDocs(initial);
    }
  }, [allNotionPages, sheetData]);

  // Save default docs to localStorage
  useEffect(() => {
    localStorage.setItem('workspaceDefaultDocs', JSON.stringify(defaultDocs));
  }, [defaultDocs]);

  // Helper function to get Notion pages for a workspace
  const getNotionPagesForWorkspace = (workspace: Workspace, allPages: any[]) => {
    if (!workspace.autoLoadNotion) return [];
    if (workspace.id === 'nutrition' || workspace.id === 'general') {
      return allPages.filter((p: any) =>
        p.title.toLowerCase().includes('casa') ||
        p.title.toLowerCase().includes('scorte')
      );
    } else if (workspace.id === 'goals') {
      return allPages.filter((p: any) => {
        const t = (p.title || '').toLowerCase();
        return (
          t.includes('timeline') ||
          t.includes('tasks') ||
          t.includes('task') ||
          t.includes('todo') ||
          t.includes('goal')
        );
      });
    } else if (workspace.id === 'entertainment') {
      return allPages.filter((p: any) =>
        p.title.toLowerCase().includes('entertainment') ||
        p.title.toLowerCase().includes('list')
      );
    } else if (workspace.id === 'emotion-regulation') {
      return allPages;
    }
    return allPages;
  };

  // Auto-select contexts based on workspace defaults
  const getAutoContexts = () => {
    return defaultDocs[activeWorkspace] || [];
  };

  // Filter Notion pages based on selected contexts (prioritize user selection over workspace rules)
  const getNotionPages = () => {
    // Get pages that match workspace rules
    const workspacePages = getNotionPagesForWorkspace(currentWorkspace, allNotionPages);
    // Also include any pages that are explicitly selected by the user
    const selectedPages = allNotionPages.filter((page: any) =>
      selectedContexts.includes(`notion-${page.id}`)
    );
    // Combine and deduplicate
    const allRelevantPages = [...workspacePages];
    selectedPages.forEach((page: any) => {
      if (!allRelevantPages.find((p: any) => p.id === page.id)) {
        allRelevantPages.push(page);
      }
    });

    console.log('=== WorkspaceManager.getNotionPages() ===');
    console.log('selectedContexts:', selectedContexts);
    console.log('workspacePages count:', workspacePages.length);
    console.log('selectedPages count:', selectedPages.length);
    console.log('allRelevantPages count:', allRelevantPages.length);
    console.log('allRelevantPages:', allRelevantPages.map((p: any) => ({ id: p.id, title: p.title, contentLength: p.content?.length || 0 })));

    return allRelevantPages;
  };

  // Clean up stale page IDs from selectedContexts when pages are loaded
  useEffect(() => {
    if (allNotionPages.length > 0) {
      const validNotionIds = new Set(allNotionPages.map((p: any) => p.id));
      setSelectedContexts(prev =>
        prev.filter(ctx => {
          if (ctx === 'sheet') return true;
          if (ctx.startsWith('notion-')) {
            const pageId = ctx.replace('notion-', '');
            return validNotionIds.has(pageId);
          }
          return false;
        })
      );
    }
  }, [allNotionPages]);

  useEffect(() => {
    setSelectedContexts(getAutoContexts());
  }, [activeWorkspace, defaultDocs]);

  const toggleContext = (id: string) => {
    setSelectedContexts(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleDefaultDoc = (id: string) => {
    setDefaultDocs(prev => {
      const current = prev[activeWorkspace] || [];
      const updated = current.includes(id)
        ? current.filter(docId => docId !== id)
        : [...current, id];
      return { ...prev, [activeWorkspace]: updated };
    });
  };

  const isDefaultDoc = (id: string) => {
    return (defaultDocs[activeWorkspace] || []).includes(id);
  };

  // Toggle expanded state for a page
  const toggleExpanded = (pageId: string) => {
    setExpandedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageId)) {
        newSet.delete(pageId);
      } else {
        newSet.add(pageId);
      }
      return newSet;
    });
  };

  // Reload Notion pages
  const reloadNotionPages = async () => {
    if (onReloadNotion) {
      setLoadingNotion(true);
      try {
        await onReloadNotion();
      } catch (error) {
        console.error('Failed to reload Notion:', error);
      }
      setLoadingNotion(false);
    }
  };

// Enhanced hierarchical rendering with toggle functionality
  const renderHierarchicalPages = (pages: any[], level = 0): ReactNode[] => {
    // Sort pages based on current sort order
    const sortedPages = [...pages].sort((a, b) => {
      if (sortOrder === 'title') {
        return a.title.localeCompare(b.title);
      } else if (sortOrder === 'type') {
        const aType = a.object === 'database' ? 'database' : 'page';
        const bType = b.object === 'database' ? 'database' : 'page';
        if (aType !== bType) return aType === 'database' ? -1 : 1;
        return a.title.localeCompare(b.title);
      }
      // hierarchy - keep original order
      return 0;
    });

    return sortedPages.flatMap(page => {
      const isDatabase = page.object === 'database';
      const hasChildren = page.children && page.children.length > 0;
      const isExpanded = expandedPages.has(page.id);
      const indent = level > 0 ? '  '.repeat(level) : '';
      const bgColor = isDatabase ? 'bg-purple-900/30' : level === 0 ? 'bg-gray-800' : level === 1 ? 'bg-gray-750' : 'bg-gray-700';
      const borderLeft = level > 0 ? 'border-l-2 border-purple-500/30' : isDatabase ? 'border-l-4 border-purple-500' : '';
      
      const elements: ReactNode[] = [];
      
      elements.push(
        <div key={page.id} className={`flex items-center justify-between gap-2 text-sm p-2 rounded ${bgColor} ${borderLeft} ${level > 0 ? 'ml-4' : ''}`}>
          <label className="flex items-center gap-2 flex-1">
            {hasChildren && (
              <button
                onClick={() => toggleExpanded(page.id)}
                className="text-gray-400 hover:text-white mr-1 font-bold"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            {!hasChildren && <span className="w-4"></span>}
            <input
              type="checkbox"
              checked={selectedContexts.includes(`notion-${page.id}`)}
              onChange={() => toggleContext(`notion-${page.id}`)}
              className="form-checkbox h-4 w-4"
            />
            <div className="flex items-center gap-2 flex-1">
              {isDatabase && <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded font-bold">DATABASE</span>}
              <span className={`${isDatabase ? 'font-bold text-purple-200' : level > 0 ? 'text-xs' : ''} ${level > 1 ? 'text-gray-400' : 'text-purple-300'}`}>
                {indent}{page.title}
              </span>
              {page.url && (
                <a
                  href={page.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-xs"
                  title="Open in Notion"
                >
                  🔗
                </a>
              )}
              {hasChildren && (
                <span className="text-xs text-gray-500">
                  ({page.children.length} {isDatabase ? 'items' : 'pages'})
                </span>
              )}
            </div>
          </label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (editingTags === page.id) {
                  setEditingTags(null);
                  setTagInput('');
                } else {
                  setEditingTags(page.id);
                  setTagInput((customTags[page.id] || []).join(', '));
                }
              }}
              className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
              title="Edit tags"
            >
              🏷️
            </button>
            <button
              onClick={() => toggleDefaultDoc(`notion-${page.id}`)}
              className={`text-xs px-2 py-1 rounded ${
                isDefaultDoc(`notion-${page.id}`)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title="Mark as default for this chat"
            >
              {isDefaultDoc(`notion-${page.id}`) ? '✓ Default' : 'Default'}
            </button>
          </div>
        </div>
      );
      
      if (editingTags === page.id) {
        elements.push(
          <div key={`${page.id}-tags`} className={`flex gap-2 p-2 bg-gray-750 rounded mt-1 ${level > 0 ? 'ml-4' : ''}`}>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Enter tags separated by commas"
              className="flex-1 px-2 py-1 text-xs bg-gray-700 text-white rounded border border-gray-600"
            />
            <button
              onClick={() => {
                const tags = tagInput.split(',').map(t => t.trim()).filter(t => t);
                setCustomTags(prev => ({ ...prev, [page.id]: tags }));
                setEditingTags(null);
                setTagInput('');
              }}
              className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditingTags(null);
                setTagInput('');
              }}
              className="text-xs bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        );
      }

      // Only render children if expanded
      if (hasChildren && isExpanded) {
        elements.push(...renderHierarchicalPages(page.children, level + 1));
      }

      return elements;
    });
  };

  // Extract tags from page content
  const extractTags = (page: any): string[] => {
    // Check custom tags first
    if (customTags[page.id] && customTags[page.id].length > 0) {
      return customTags[page.id];
    }

    const tags: string[] = [];
    const title = page.title?.toLowerCase() || '';
    
    // Simple keyword-based tagging
    if (title.includes('task') || title.includes('todo') || title.includes('goals')) tags.push('Tasks');
    if (title.includes('timeline') || title.includes('schedule') || title.includes('calendar')) tags.push('Timeline');
    if (title.includes('food') || title.includes('meal') || title.includes('nutrition') || title.includes('casa') || title.includes('scorte')) tags.push('Food');
    if (title.includes('entertainment') || title.includes('game') || title.includes('movie') || title.includes('music')) tags.push('Entertainment');
    if (title.includes('emotion') || title.includes('mood') || title.includes('wellbeing')) tags.push('Wellbeing');
    if (title.includes('research') || title.includes('study') || title.includes('analysis')) tags.push('Research');
    
    // Database indicator
    if (page.object === 'database') tags.push('Database');
    
    return tags.length > 0 ? tags : ['Other'];
  };

  // Group pages by tags
  const groupPagesByTags = (pages: any[]): { [tag: string]: any[] } => {
    const groups: { [tag: string]: any[] } = {};
    
    pages.forEach(page => {
      const tags = extractTags(page);
      tags.forEach(tag => {
        if (!groups[tag]) groups[tag] = [];
        groups[tag].push(page);
      });
    });
    
    return groups;
  };

  // Get all available tags
  const getAllTags = (pages: any[]): string[] => {
    const tagSet = new Set<string>();
    pages.forEach(page => {
      const tags = extractTags(page);
      tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  };

  // Filter pages by selected tags
  const filterPagesByTags = (pages: any[]): any[] => {
    if (selectedTags.size === 0) return pages;
    return pages.filter(page => {
      const pageTags = extractTags(page);
      return pageTags.some(tag => selectedTags.has(tag));
    });
  };

  // Toggle tag selection
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
  };

  // Render grouped pages
  const renderGroupedPages = (pages: any[]): ReactNode => {
    console.log('renderGroupedPages called with pages:', pages.length, pages);
    if (!groupByTags) {
      return <>{renderHierarchicalPages(pages)}</>;
    }
    
    const groups = groupPagesByTags(pages);
    const sortedTags = Object.keys(groups).sort();
    
    return (
      <>
        {sortedTags.map(tag => (
          <div key={`group-${tag}`} className="mb-3">
            <h5 className="text-xs font-medium text-purple-400 mb-2 px-2 py-1 bg-purple-900/20 rounded">
              {tag} ({groups[tag].length})
            </h5>
            <div className="space-y-1 ml-2">
              <>{renderHierarchicalPages(groups[tag])}</>
            </div>
          </div>
        ))}
      </>
    );
  };

  return (
    <div className="flex-1 flex min-w-0 sm:min-w-[800px]">
      {/* Sidebar */}
      <div className={`${showMenu ? 'w-64' : 'w-0 sm:w-16'} bg-gray-800 border-r border-gray-700 transition-all duration-200 flex-shrink-0 overflow-hidden`}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-full p-4 sm:p-3 text-gray-400 hover:text-white hover:bg-gray-700 text-left text-2xl sm:text-lg"
          title={showMenu ? "Close menu" : "Open menu"}
        >
          {showMenu ? '←' : '☰'}
        </button>

        {showMenu && (
          <div className="p-2 space-y-1 max-h-screen overflow-y-auto">
            {workspaces.map(workspace => (
              <button
                key={workspace.id}
                onClick={() => setActiveWorkspace(workspace.id)}
                className={`w-full text-left px-3 sm:px-3 py-3 sm:py-2 rounded transition-colors ${activeWorkspace === workspace.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg sm:text-lg">{workspace.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm sm:text-sm font-medium truncate">{workspace.name}</div>
                    <div className="text-xs text-gray-400 truncate">{workspace.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-auto">
        {/* Tab Navigation */}
        <div className="bg-gray-800 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center px-4 py-2">
            {/* Mobile burger button */}
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="sm:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-700 mr-2"
              title={showMenu ? "Close menu" : "Open menu"}
            >
              {showMenu ? '←' : '☰'}
            </button>
            <div className="flex items-center gap-2 mr-6">
              <span className="text-2xl">{currentWorkspace.icon}</span>
              <div>
                <h2 className="text-sm font-semibold text-white">{currentWorkspace.name}</h2>
                <p className="text-xs text-gray-400">{currentWorkspace.description}</p>
              </div>
            </div>
            
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-4 py-2 text-sm font-medium rounded-t ${
                  activeTab === 'chat'
                    ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                💬 Chat
              </button>
              <button
                onClick={() => setActiveTab('docs')}
                className={`px-4 py-2 text-sm font-medium rounded-t ${
                  activeTab === 'docs'
                    ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                📄 Docs
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className={`px-4 py-2 text-sm font-medium rounded-t ${
                  activeTab === 'calendar'
                    ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                📅 Calendar
              </button>
              <button
                onClick={() => setActiveTab('nutrients')}
                className={`px-4 py-2 text-sm font-medium rounded-t ${
                  activeTab === 'nutrients'
                    ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                🥗 Nutrients
              </button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto min-w-0 sm:min-w-[800px]">
          {activeTab === 'chat' && currentWorkspace.id === 'model-testing' && (
            <ModelTesting
              notes={notes}
              userProfile={userProfile}
              sheetData={sheetData}
              mealHistory={mealHistory}
              notionPages={notionPages}
            />
          )}

          {activeTab === 'chat' && currentWorkspace.id !== 'model-testing' && (
            <ChatInterface
              selectedContexts={selectedContexts}
              notes={notes}
              aiModel={aiModel}
              userProfile={currentWorkspace.autoLoadProfile ? userProfile : null}
              sheetData={currentWorkspace.autoLoadSheets ? sheetData : null}
              mealHistory={currentWorkspace.autoLoadMeals ? mealHistory : []}
              notionPages={getNotionPages()}
              workspacePrompt={currentWorkspace.systemPrompt}
              workspaceId={currentWorkspace.id}
              calendarEvents={calendarEvents}
              nutrientEntries={currentWorkspace.id === 'nutrition' ? nutrientEntries : []}
            />
          )}

          {activeTab === 'docs' && (
            <div className="h-full overflow-y-auto p-4">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Manage accessible documents</h3>
                  <button
                    onClick={reloadNotionPages}
                    disabled={loadingNotion}
                    className="text-sm bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:bg-gray-600"
                  >
                    {loadingNotion ? 'Loading...' : '↻ Reload'}
                  </button>
                </div>

                {/* Controls */}
                <div className="mb-4 space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-800 rounded">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-300">Sort:</label>
                        <select
                          value={sortOrder}
                          onChange={(e) => setSortOrder(e.target.value as any)}
                          className="text-sm bg-gray-700 text-white px-3 py-1 rounded border border-gray-600"
                        >
                          <option value="hierarchy">Hierarchy</option>
                          <option value="title">Title</option>
                          <option value="type">Type</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={groupByTags}
                          onChange={(e) => setGroupByTags(!groupByTags)}
                          className="form-checkbox h-4 w-4"
                        />
                        Group by tags
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            // Expand all pages that have children
                            const allPages = hierarchicalNotionPages || allNotionPages.map(p => ({ ...p, children: [] }));
                            const pagesWithChildren = new Set<string>();
                            const findPagesWithChildren = (pages: any[]) => {
                              pages.forEach(page => {
                                if (page.children && page.children.length > 0) {
                                  pagesWithChildren.add(page.id);
                                  findPagesWithChildren(page.children);
                                }
                              });
                            };
                            findPagesWithChildren(allPages);
                            setExpandedPages(pagesWithChildren);
                          }}
                          className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                        >
                          Expand All
                        </button>
                        <button
                          onClick={() => setExpandedPages(new Set())}
                          className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                        >
                          Collapse All
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Tag Filter */}
                  {(hierarchicalNotionPages || allNotionPages) && (
                    <div className="p-3 bg-gray-800 rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <label className="text-sm text-gray-300">Filter by tags:</label>
                        <button
                          onClick={() => setSelectedTags(new Set())}
                          className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-500"
                        >
                          Clear All
                        </button>
                        <button
                          onClick={() => {
                            const allTags = getAllTags(hierarchicalNotionPages || allNotionPages);
                            setSelectedTags(new Set(allTags));
                          }}
                          className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                        >
                          Select All
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {getAllTags(hierarchicalNotionPages || allNotionPages).map(tag => (
                          <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={`text-xs px-3 py-1 rounded transition-colors ${
                              selectedTags.has(tag)
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {sheetData ? (
                    <div className="flex items-center justify-between gap-2 text-sm text-green-300 p-3 bg-gray-800 rounded">
                      <label className="flex items-center gap-2 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedContexts.includes('sheet')}
                          onChange={() => toggleContext('sheet')}
                          className="form-checkbox h-4 w-4"
                        />
                        Food I eat db (loaded)
                      </label>
                      <button
                        onClick={() => toggleDefaultDoc('sheet')}
                        className={`text-xs px-2 py-1 rounded ${
                          isDefaultDoc('sheet')
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                        title="Mark as default for this chat"
                      >
                        {isDefaultDoc('sheet') ? '✓ Default' : 'Default'}
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 p-3 bg-gray-800 rounded">
                      Google Sheet data is not loaded yet.
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                      Notion Pages
                      {loadingNotion && <span className="text-sm text-purple-400">(Loading...)</span>}
                      {selectedTags.size > 0 && (
                        <span className="text-xs text-purple-400">
                          (filtered by {selectedTags.size} tag{selectedTags.size > 1 ? 's' : ''})
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        (hierarchical: {hierarchicalNotionPages?.length || 0}, flat: {allNotionPages?.length || 0})
                      </span>
                    </h4>
                    {hierarchicalNotionPages && hierarchicalNotionPages.length > 0 ? (
                      <div className="space-y-1">
                        {renderGroupedPages(filterPagesByTags(hierarchicalNotionPages))}
                      </div>
                    ) : allNotionPages && allNotionPages.length > 0 ? (
                      <div className="space-y-1">
                        {renderGroupedPages(filterPagesByTags(allNotionPages.map(page => ({ ...page, children: [] }))))}
                      </div>
                    ) : loadingNotion ? (
                      <div className="text-sm text-gray-500 p-3 bg-gray-800 rounded">
                        Loading Notion pages...
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 p-3 bg-gray-800 rounded">
                        No Notion pages found. Click "↻ Reload" to fetch them.
                      </div>
                    )}
                  </div>
                </div>

                {/* Prompt Control Section */}
                <div className="mt-6 p-4 bg-gray-800 rounded">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    🔍 Prompt Control
                    <span className="text-sm text-gray-400">(Manage what gets sent to AI)</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Data Sources */}
                    <div className="space-y-3">
                      <h4 className="text-white font-medium">Data Sources</h4>
                      
                      <label className="flex items-center gap-2 text-white">
                        <input
                          type="checkbox"
                          checked={promptSettings.includeSheets}
                          onChange={(e) => setPromptSettings(prev => ({ ...prev, includeSheets: e.target.checked }))}
                          className="form-checkbox"
                        />
                        Google Sheets ({sheetData ? Array.isArray(sheetData) ? sheetData.length : 1 : 0} sheets)
                      </label>
                      
                      {promptSettings.includeSheets && (
                        <div className="ml-6">
                          <label className="text-gray-300 text-sm">
                            Max rows per sheet: 
                            <input
                              type="number"
                              value={promptSettings.maxSheetRows}
                              onChange={(e) => setPromptSettings(prev => ({ ...prev, maxSheetRows: parseInt(e.target.value) || 0 }))}
                              className="ml-2 w-20 px-2 py-1 bg-gray-700 rounded text-white"
                              min="1"
                              max="1000"
                            />
                          </label>
                        </div>
                      )}
                      
                      <label className="flex items-center gap-2 text-white">
                        <input
                          type="checkbox"
                          checked={promptSettings.includeNotion}
                          onChange={(e) => setPromptSettings(prev => ({ ...prev, includeNotion: e.target.checked }))}
                          className="form-checkbox"
                        />
                        Notion Pages ({allNotionPages.length} pages)
                      </label>
                      
                      {promptSettings.includeNotion && (
                        <div className="ml-6">
                          <label className="text-gray-300 text-sm">
                            Max pages: 
                            <input
                              type="number"
                              value={promptSettings.maxNotionPages}
                              onChange={(e) => setPromptSettings(prev => ({ ...prev, maxNotionPages: parseInt(e.target.value) || 0 }))}
                              className="ml-2 w-20 px-2 py-1 bg-gray-700 rounded text-white"
                              min="1"
                              max="100"
                            />
                          </label>
                        </div>
                      )}
                      
                      <label className="flex items-center gap-2 text-white">
                        <input
                          type="checkbox"
                          checked={promptSettings.includeMealHistory}
                          onChange={(e) => setPromptSettings(prev => ({ ...prev, includeMealHistory: e.target.checked }))}
                          className="form-checkbox"
                        />
                        Meal History ({mealHistory.length} meals)
                      </label>
                    </div>
                    
                    {/* Chat Control */}
                    <div className="space-y-3">
                      <h4 className="text-white font-medium">Chat Context</h4>
                      
                      <label className="flex items-center gap-2 text-white">
                        <input
                          type="checkbox"
                          checked={promptSettings.includeChatHistory}
                          onChange={(e) => setPromptSettings(prev => ({ ...prev, includeChatHistory: e.target.checked }))}
                          className="form-checkbox"
                        />
                        Include Previous Messages
                      </label>
                      
                      {promptSettings.includeChatHistory && (
                        <div className="ml-6">
                          <label className="text-gray-300 text-sm">
                            Max previous messages: 
                            <input
                              type="number"
                              value={promptSettings.maxChatMessages}
                              onChange={(e) => setPromptSettings(prev => ({ ...prev, maxChatMessages: parseInt(e.target.value) || 0 }))}
                              className="ml-2 w-20 px-2 py-1 bg-gray-700 rounded text-white"
                              min="1"
                              max="20"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setPromptSettings({
                          includeSheets: true,
                          includeNotion: true,
                          includeMealHistory: true,
                          includeChatHistory: true,
                          maxChatMessages: 6,
                          maxSheetRows: 100,
                          maxNotionPages: 50
                        })}
                        className="text-sm bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700"
                      >
                        ✅ Enable All
                      </button>
                      <button
                        onClick={() => setPromptSettings({
                          includeSheets: false,
                          includeNotion: false,
                          includeMealHistory: false,
                          includeChatHistory: false,
                          maxChatMessages: 6,
                          maxSheetRows: 100,
                          maxNotionPages: 50
                        })}
                        className="text-sm bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700"
                      >
                        ❌ Disable All
                      </button>
                      <button
                        onClick={() => setPromptSettings({
                          includeSheets: false,
                          includeNotion: false,
                          includeMealHistory: false,
                          includeChatHistory: true,
                          maxChatMessages: 2,
                          maxSheetRows: 100,
                          maxNotionPages: 50
                        })}
                        className="text-sm bg-yellow-600 text-white px-3 py-2 rounded hover:bg-yellow-700"
                      >
                        ⚡ Groq Mode (Minimal)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Prompt Preview Section */}
                <div className="mt-6 p-4 bg-gray-800 rounded">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    📋 Prompt Preview
                    <span className="text-sm text-gray-400">(What will be sent to AI)</span>
                  </h3>

                  <div className="space-y-4">
                    {/* Selected Contexts Summary */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Selected Contexts ({selectedContexts.length})</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedContexts.map(ctx => (
                          <span key={ctx} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                            {ctx === 'sheet' ? '📊 Google Sheets' : ctx.startsWith('notion-') ? `📄 ${allNotionPages.find((p: any) => p.id === ctx.replace('notion-', ''))?.title || ctx}` : ctx}
                          </span>
                        ))}
                        {selectedContexts.length === 0 && (
                          <span className="text-sm text-gray-500">No contexts selected</span>
                        )}
                      </div>
                    </div>

                    {/* Content Preview */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Content Preview</h4>
                      <div className="bg-gray-900 rounded p-3 max-h-96 overflow-y-auto text-xs font-mono text-gray-300">
                        {selectedContexts.includes('sheet') && sheetData && (
                          <div className="mb-3">
                            <div className="text-green-400 font-bold mb-1">Google Sheets Data:</div>
                            <div className="text-gray-400">
                              {Array.isArray(sheetData) ? `${sheetData.length} sheets loaded` : '1 sheet loaded'}
                            </div>
                          </div>
                        )}

                        {getNotionPages().map((page: any) => (
                          <div key={page.id} className="mb-3">
                            <div className="text-purple-400 font-bold mb-1">{page.title}:</div>
                            <div className="text-gray-400 whitespace-pre-wrap max-h-32 overflow-y-auto">
                              {page.content?.substring(0, 500)}
                              {page.content?.length > 500 && '...'}
                            </div>
                          </div>
                        ))}

                        {selectedContexts.filter(ctx => ctx.startsWith('notion-')).length === 0 && !selectedContexts.includes('sheet') && (
                          <div className="text-gray-500">No content will be sent to AI</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setSelectedContexts(getAutoContexts());
                    }}
                    className="text-sm bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600"
                  >
                    Reset to defaults
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'calendar' && (
            <CalendarView onEventsChange={setCalendarEvents} />
          )}

          {activeTab === 'nutrients' && (
            <NutrientTracker 
              sheetData={sheetData} 
              userProfile={userProfile} 
              onEntriesChange={setNutrientEntries}
            />
          )}
        </div>
      </div>
    </div>
  );
});
