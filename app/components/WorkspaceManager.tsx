'use client';

import { useState, useEffect, forwardRef, useImperativeHandle, Suspense, lazy, useRef } from 'react';
import type { ReactNode, JSX } from 'react';
import { createClient } from '@/utils/supabase/client';

// Dynamic imports to reduce bundle size - these components are huge!
const ChatInterface = lazy(() => import('./ChatInterface'));
const CalendarView = lazy(() => import('./CalendarView'));
const NutrientTracker = lazy(() => import('./NutrientTracker'));
const ModelTesting = lazy(() => import('./ModelTesting'));

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
    id: 'training',
    name: 'Training',
    icon: '🏋️‍♀️',
    description: 'Fitness and training planning',
    autoLoadSheets: false,
    autoLoadNotion: true,
    autoLoadMeals: false,
    autoLoadProfile: false,
    systemPrompt: 'You are a fitness trainer. Focus on physical fitness, scientific exercises.'
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
    id: 'impersonal',
    name: 'Impersonal',
    icon: '🤖',
    description: 'Generic AI chat without personal data',
    autoLoadSheets: false,
    autoLoadNotion: false,
    autoLoadMeals: false,
    autoLoadProfile: false,
    systemPrompt: 'You are a helpful, objective AI assistant. Provide generic, factual information without referencing any personal data, user-specific context, or personalized information. Keep responses neutral and universally applicable.'
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
  sheetData: any;
  notionPages: any[];
  allNotionPages: any[];
  hierarchicalNotionPages?: any[];
  notionError?: string | null;
  isLoadingNotion?: boolean;
  onReloadNotion?: () => Promise<void>;
  onStopNotion?: () => void;
}

export default forwardRef(function WorkspaceManager({ notes, aiModel, sheetData, notionPages, allNotionPages, hierarchicalNotionPages, notionError, isLoadingNotion, onReloadNotion, onStopNotion }: Props, ref) {
  const [activeWorkspace, setActiveWorkspace] = useState('general');
  const [activeTab, setActiveTab] = useState<'chat' | 'docs' | 'calendar' | 'nutrients'>('chat');
  const [workspaces] = useState<Workspace[]>(DEFAULT_WORKSPACES);
  const [showMenu, setShowMenu] = useState(false);
  const [showTabMenu, setShowTabMenu] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [nutrientEntries, setNutrientEntries] = useState<any[]>([]);
  const isGuestRef = useRef<boolean>(true);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      isGuestRef.current = !session;
      setAuthReady(true);
    };
    checkAuth();
  }, []);

  // Load saved workspace and tab from Supabase on mount
  useEffect(() => {
    if (!authReady || isGuestRef.current) return;
    (async () => {
      try {
        const res = await fetch('/api/workspace-settings');
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            if (data.settings['lastWorkspace']) setActiveWorkspace(data.settings['lastWorkspace']);
            if (data.settings['lastTab']) setActiveTab(data.settings['lastTab']);
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    })();
  }, []);

  // Save active workspace to Supabase on change
  useEffect(() => {
    if (!authReady || isGuestRef.current) return;
    (async () => {
      try {
        await fetch('/api/workspace-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: 'global',
            settingKey: 'lastWorkspace',
            settingValue: activeWorkspace
          })
        });
      } catch (error) {
        console.error('Failed to save workspace:', error);
      }
    })();
  }, [activeWorkspace, authReady]);

  // Save active tab to Supabase on change
  useEffect(() => {
    if (!authReady || isGuestRef.current) return;
    (async () => {
      try {
        await fetch('/api/workspace-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: 'global',
            settingKey: 'lastTab',
            settingValue: activeTab
          })
        });
      } catch (error) {
        console.error('Failed to save tab:', error);
      }
    })();
  }, [activeTab, authReady]);

  // Prompt control state
  const [promptSettings, setPromptSettings] = useState({
    includeSheets: true,
    includeNotion: true,
    includeChatHistory: true,
    maxChatMessages: 6,
    maxSheetRows: 100,
    maxNotionPages: 50
  });

  // Nutrients checkbox state for Docs tab
  const [nutrientSettings, setNutrientSettings] = useState({
    includeFoodEntries: false,
    includeVitaminsMinerals: false
  });
  const [defaultNutrientSettings, setDefaultNutrientSettings] = useState<{ [workspaceId: string]: { includeFoodEntries: boolean, includeVitaminsMinerals: boolean } }>({});

  // Load nutrient entries from Supabase on mount
  useEffect(() => {
    if (!authReady || isGuestRef.current) return;
    (async () => {
      try {
        const res = await fetch('/api/nutrients?type=entries');
        if (res.ok) {
          const data = await res.json();
          if (data.entries) {
            setNutrientEntries(data.entries);
          }
        }
      } catch (error) {
        console.error('Failed to load nutrient entries:', error);
      }
    })();
  }, [authReady]);

  // Load default nutrient settings from Supabase on mount
  useEffect(() => {
    if (!authReady || isGuestRef.current) return;
    (async () => {
      try {
        const res = await fetch('/api/workspace-settings');
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            const loadedSettings: { [workspaceId: string]: { includeFoodEntries: boolean, includeVitaminsMinerals: boolean } } = {};
            Object.keys(data.settings).forEach(key => {
              if (key.startsWith('nutrientSettings_')) {
                const workspaceId = key.replace('nutrientSettings_', '');
                loadedSettings[workspaceId] = data.settings[key];
              }
            });
            setDefaultNutrientSettings(loadedSettings);
          }
        }
      } catch (error) {
        console.error('Failed to load default nutrient settings:', error);
      }
    })();
  }, [authReady]);

  // Save default nutrient settings to Supabase
  useEffect(() => {
    if (!authReady || isGuestRef.current) return;
    Object.entries(defaultNutrientSettings).forEach(async ([workspaceId, settings]) => {
      try {
        await fetch('/api/workspace-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            settingKey: 'nutrientSettings',
            settingValue: settings
          })
        });
      } catch (error) {
        console.error('Failed to save nutrient settings:', error);
      }
    });
  }, [defaultNutrientSettings, authReady]);

  // Auto-select default nutrient settings when workspace changes
  useEffect(() => {
    const defaults = defaultNutrientSettings[activeWorkspace] || { includeFoodEntries: false, includeVitaminsMinerals: false };
    setNutrientSettings(defaults);
  }, [activeWorkspace, defaultNutrientSettings]);

  const toggleDefaultNutrientSetting = (setting: 'includeFoodEntries' | 'includeVitaminsMinerals') => {
    setDefaultNutrientSettings(prev => {
      const current = prev[activeWorkspace] || { includeFoodEntries: false, includeVitaminsMinerals: false };
      const updated = { ...current, [setting]: !current[setting] };
      return { ...prev, [activeWorkspace]: updated };
    });
  };

  const isDefaultNutrientSetting = (setting: 'includeFoodEntries' | 'includeVitaminsMinerals') => {
    const current = defaultNutrientSettings[activeWorkspace] || { includeFoodEntries: false, includeVitaminsMinerals: false };
    return current[setting];
  };

  // Helper function to format nutrient data for prompt
  const formatFoodEntriesAndDailyNutrients = () => {
    if (!nutrientEntries || nutrientEntries.length === 0) {
      return 'No nutrient entries available.';
    }

    const now = new Date();
    const last24hEntries = nutrientEntries.filter((entry: any) => {
      const entryTime = new Date(entry.time);
      return (now.getTime() - entryTime.getTime()) < 24 * 60 * 60 * 1000;
    });

    if (last24hEntries.length === 0) {
      return 'No food entries in the last 24 hours.';
    }

    let output = '🍽️ Food Entries (Last 24h)\n';

    // Food entries
    last24hEntries.forEach((entry: any) => {
      const date = new Date(entry.time);
      const dateStr = date.toLocaleDateString('it-IT') + ', ' + date.toLocaleTimeString('it-IT');
      output += `${entry.food}\n`;
      output += `${dateStr} • ${entry.grams}g\n`;
      output += `Energy: ${entry.energy.toFixed(0)} kJ | Protein: ${entry.protein.toFixed(1)}g | Carbs: ${entry.carbs.toFixed(1)}g | Fats: ${entry.fats.toFixed(1)}g\n`;
      output += entry.cost > 0 ? `💶 €${entry.cost.toFixed(2)}\n` : '💶 Prezzo non disponibile\n';
    });

    // Daily cost
    const totalCost = last24hEntries.reduce((sum: number, entry: any) => sum + (entry.cost || 0), 0);
    output += '\nDaily Cost (Last 24h)\n';
    output += totalCost > 0 ? `💶 €${totalCost.toFixed(2)}\n` : '💶 Prezzo non disponibile\n';
    output += `From ${last24hEntries.length} food entries\n\n`;

    // Daily nutrients totals
    const totals = last24hEntries.reduce((acc: any, entry: any) => ({
      energy: acc.energy + (entry.energy || 0),
      protein: acc.protein + (entry.protein || 0),
      carbs: acc.carbs + (entry.carbs || 0),
      fats: acc.fats + (entry.fats || 0),
      saturatedFats: acc.saturatedFats + (entry.saturatedFats || 0),
      fibers: acc.fibers + (entry.fibers || 0),
      sugars: acc.sugars + (entry.sugars || 0),
      salt: acc.salt + (entry.salt || 0)
    }), {
      energy: 0, protein: 0, carbs: 0, fats: 0, saturatedFats: 0, fibers: 0, sugars: 0, salt: 0
    });

    // Default goals (same as in NutrientTracker)
    const goals = {
      energyKJ: 8000,
      protein: 150,
      carbs: 200,
      fats: 65,
      saturatedFats: 20,
      fibers: 25,
      sugars: 50,
      salt: 6
    };

    const nutrients = [
      { name: 'Energy (kJ)', value: totals.energy, goal: goals.energyKJ, unit: 'kJ', isLimit: false },
      { name: 'Protein (g)', value: totals.protein, goal: goals.protein, unit: 'g', isLimit: false },
      { name: 'Carbs (g)', value: totals.carbs, goal: goals.carbs, unit: 'g', isLimit: false },
      { name: 'Fats (g)', value: totals.fats, goal: goals.fats, unit: 'g', isLimit: false },
      { name: 'Sat. Fats (g)', value: totals.saturatedFats, goal: goals.saturatedFats, unit: 'g', isLimit: true },
      { name: 'Salt (g)', value: totals.salt, goal: goals.salt, unit: 'g', isLimit: true },
      { name: 'Sugars (g)', value: totals.sugars, goal: goals.sugars, unit: 'g', isLimit: false }
    ];

    nutrients.forEach(nutrient => {
      const percentage = nutrient.goal > 0 ? Math.round((nutrient.value / nutrient.goal) * 100) : 0;
      output += `${nutrient.name}\n`;
      output += `${nutrient.value.toFixed(1)}\n`;
      output += nutrient.isLimit ? `Limit: ${nutrient.goal}${nutrient.unit} ⚠️\n` : `Goal: ${nutrient.goal}${nutrient.unit}\n`;
      output += `${percentage}%\n`;
    });

    return output;
  };

  const formatVitaminsAndMinerals = () => {
    if (!nutrientEntries || nutrientEntries.length === 0) {
      return 'No nutrient entries available.';
    }

    const now = new Date();
    const last24hEntries = nutrientEntries.filter((entry: any) => {
      const entryTime = new Date(entry.time);
      return (now.getTime() - entryTime.getTime()) < 24 * 60 * 60 * 1000;
    });

    if (last24hEntries.length === 0) {
      return 'No food entries in the last 24 hours.';
    }

    let output = '💊 Vitamins & Minerals (Last 24h)\n';

    // Calculate totals
    const totals = last24hEntries.reduce((acc: any, entry: any) => ({
      vitaminD: acc.vitaminD + (entry.vitaminD || 0),
      vitaminB1: acc.vitaminB1 + (entry.vitaminB1 || 0),
      vitaminB2: acc.vitaminB2 + (entry.vitaminB2 || 0),
      vitaminB3: acc.vitaminB3 + (entry.vitaminB3 || 0),
      vitaminB5: acc.vitaminB5 + (entry.vitaminB5 || 0),
      vitaminB6: acc.vitaminB6 + (entry.vitaminB6 || 0),
      vitaminB9: acc.vitaminB9 + (entry.vitaminB9 || 0),
      vitaminE: acc.vitaminE + (entry.vitaminE || 0),
      vitaminK: acc.vitaminK + (entry.vitaminK || 0),
      calcium: acc.calcium + (entry.calcium || 0),
      iron: acc.iron + (entry.iron || 0),
      phosphorus: acc.phosphorus + (entry.phosphorus || 0),
      magnesium: acc.magnesium + (entry.magnesium || 0),
      potassium: acc.potassium + (entry.potassium || 0),
      zinc: acc.zinc + (entry.zinc || 0),
      copper: acc.copper + (entry.copper || 0),
      manganese: acc.manganese + (entry.manganese || 0),
      selenium: acc.selenium + (entry.selenium || 0)
    }), {
      vitaminD: 0, vitaminB1: 0, vitaminB2: 0, vitaminB3: 0, vitaminB5: 0, vitaminB6: 0, vitaminB9: 0,
      vitaminE: 0, vitaminK: 0, calcium: 0, iron: 0, phosphorus: 0, magnesium: 0,
      potassium: 0, zinc: 0, copper: 0, manganese: 0, selenium: 0
    });

    // Default goals
    const goals = {
      vitaminD: 10,
      vitaminB1: 1.2,
      vitaminB2: 1.3,
      vitaminB3: 16,
      vitaminB5: 5,
      vitaminB6: 1.3,
      vitaminB9: 400,
      vitaminE: 12,
      vitaminK: 70,
      calcium: 800,
      iron: 14,
      phosphorus: 700,
      magnesium: 320,
      potassium: 2000,
      zinc: 8,
      copper: 0.9,
      manganese: 2,
      selenium: 55
    };

    const vitamins = [
      { name: 'Vitamin D (μg)', value: totals.vitaminD, goal: goals.vitaminD, unit: 'μg' },
      { name: 'Vitamin B1 (mg)', value: totals.vitaminB1, goal: goals.vitaminB1, unit: 'mg' },
      { name: 'Vitamin B2 (mg)', value: totals.vitaminB2, goal: goals.vitaminB2, unit: 'mg' },
      { name: 'Vitamin B3 (mg)', value: totals.vitaminB3, goal: goals.vitaminB3, unit: 'mg' },
      { name: 'Vitamin B5 (mg)', value: totals.vitaminB5, goal: goals.vitaminB5, unit: 'mg' },
      { name: 'Vitamin B6 (mg)', value: totals.vitaminB6, goal: goals.vitaminB6, unit: 'mg' },
      { name: 'Vitamin B9 (μg)', value: totals.vitaminB9, goal: goals.vitaminB9, unit: 'μg' },
      { name: 'Vitamin E (mg)', value: totals.vitaminE, goal: goals.vitaminE, unit: 'mg' },
      { name: 'Vitamin K (μg)', value: totals.vitaminK, goal: goals.vitaminK, unit: 'μg' }
    ];

    const minerals = [
      { name: 'Calcium (mg)', value: totals.calcium, goal: goals.calcium, unit: 'mg' },
      { name: 'Iron (mg)', value: totals.iron, goal: goals.iron, unit: 'mg' },
      { name: 'Phosphorus (mg)', value: totals.phosphorus, goal: goals.phosphorus, unit: 'mg' },
      { name: 'Magnesium (mg)', value: totals.magnesium, goal: goals.magnesium, unit: 'mg' },
      { name: 'Potassium (mg)', value: totals.potassium, goal: goals.potassium, unit: 'mg' },
      { name: 'Zinc (mg)', value: totals.zinc, goal: goals.zinc, unit: 'mg' },
      { name: 'Copper (mg)', value: totals.copper, goal: goals.copper, unit: 'mg' },
      { name: 'Manganese (mg)', value: totals.manganese, goal: goals.manganese, unit: 'mg' },
      { name: 'Selenium (μg)', value: totals.selenium, goal: goals.selenium, unit: 'μg' }
    ];

    output += '\nVitamins:\n';
    vitamins.forEach(vitamin => {
      const percentage = vitamin.goal > 0 ? Math.round((vitamin.value / vitamin.goal) * 100) : 0;
      output += `${vitamin.name}\n`;
      output += `${vitamin.value.toFixed(2)}\n`;
      output += `Goal: ${vitamin.goal}${vitamin.unit}\n`;
      output += `${percentage}%\n`;
    });

    output += '\nMinerals:\n';
    minerals.forEach(mineral => {
      const percentage = mineral.goal > 0 ? Math.round((mineral.value / mineral.goal) * 100) : 0;
      output += `${mineral.name}\n`;
      output += `${mineral.value.toFixed(2)}\n`;
      output += `Goal: ${mineral.goal}${mineral.unit}\n`;
      output += `${percentage}%\n`;
    });

    return output;
  };

  // Expose functions to parent component
  useImperativeHandle(ref, () => ({
    setActiveWorkspace,
    setActiveTab
  }));

  const currentWorkspace = workspaces.find(w => w.id === activeWorkspace) || workspaces[0];
  const [selectedContexts, setSelectedContexts] = useState<string[]>([]);
  const [loadingNotion, setLoadingNotion] = useState(false);

  // Sync isLoadingNotion prop with local state
  useEffect(() => {
    if (isLoadingNotion !== undefined) {
      setLoadingNotion(isLoadingNotion);
    }
  }, [isLoadingNotion]);
  const [sortOrder, setSortOrder] = useState<'title' | 'type' | 'hierarchy'>('hierarchy');
  const [groupByTags, setGroupByTags] = useState(false);
  const [groupByParent, setGroupByParent] = useState(true);
  const [defaultDocs, setDefaultDocs] = useState<{ [workspaceId: string]: string[] }>({});
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [customTags, setCustomTags] = useState<{ [pageId: string]: string[] }>({});
  const [loggedExtractTags] = useState<Set<string>>(new Set());
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [expandedPreviewPages, setExpandedPreviewPages] = useState<Set<string>>(new Set());
  const [notionSearchQuery, setNotionSearchQuery] = useState('');
  const [pageDefaults, setPageDefaults] = useState<{ [workspaceId: string]: Set<string> }>({});
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showApiSearchResults, setShowApiSearchResults] = useState(false);
  const [selectedApiResults, setSelectedApiResults] = useState<any[]>([]);

  // Load custom tags from Supabase
  useEffect(() => {
    if (!authReady || isGuestRef.current) return;
    (async () => {
      try {
        const res = await fetch('/api/workspace-settings?settingKey=notionCustomTags');
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            const tagsValue = Object.values(data.settings)[0] as { [pageId: string]: string[] };
            if (tagsValue) {
              setCustomTags(tagsValue);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load custom tags:', error);
      }
    })();
  }, [authReady]);

  // Save custom tags to Supabase
  useEffect(() => {
    if (!authReady || isGuestRef.current) return;
    (async () => {
      try {
        await fetch('/api/workspace-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: 'global',
            settingKey: 'notionCustomTags',
            settingValue: customTags
          })
        });
      } catch (error) {
        console.error('Failed to save custom tags:', error);
      }
    })();
  }, [customTags, authReady]);

  // Load default docs from Supabase on mount
  useEffect(() => {
    if (!authReady || isGuestRef.current) return;
    (async () => {
      try {
        const res = await fetch('/api/workspace-settings');
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            const loadedDocs: { [workspaceId: string]: string[] } = {};
            Object.keys(data.settings).forEach(key => {
              if (key.startsWith('defaultDocs_')) {
                const workspaceId = key.replace('defaultDocs_', '');
                loadedDocs[workspaceId] = data.settings[key];
              }
            });

            // Initialize missing workspaces
            const updated = { ...loadedDocs };
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
            } else {
              setDefaultDocs(loadedDocs);
            }
          }
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
    })();
  }, [allNotionPages, sheetData, workspaces, authReady]);

  // Save default docs to Supabase
  useEffect(() => {
    if (!authReady || isGuestRef.current) return;
    Object.entries(defaultDocs).forEach(async ([workspaceId, docs]) => {
      try {
        await fetch('/api/workspace-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            settingKey: 'defaultDocs',
            settingValue: docs
          })
        });
      } catch (error) {
        console.error('Failed to save default docs:', error);
      }
    });
  }, [defaultDocs, authReady]);

  // Load page defaults for current workspace from Supabase
  useEffect(() => {
    if (!authReady || isGuestRef.current) return;
    (async () => {
      try {
        const res = await fetch(`/api/chat-page-defaults?workspaceId=${activeWorkspace}`);
        if (res.ok) {
          const data = await res.json();
          if (data.defaults && Array.isArray(data.defaults)) {
            const pageIdSet = new Set(data.defaults.map((d: any) => d.page_id));
            setPageDefaults(prev => ({ ...prev, [activeWorkspace]: pageIdSet } as { [key: string]: Set<string> }));
          }
        }
      } catch (error) {
        console.error('Failed to load page defaults:', error);
      }
    })();
  }, [activeWorkspace, authReady]);

  // Toggle page as default for current workspace
  const togglePageDefault = async (pageId: string, pageTitle: string, isDefault: boolean) => {
    if (isGuestRef.current) return;
    try {
      const res = await fetch('/api/chat-page-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: activeWorkspace,
          pageId,
          pageTitle,
          isDefault: !isDefault
        })
      });

      if (res.ok) {
        setPageDefaults((prev: any) => {
          const currentDefaults = prev[activeWorkspace] || new Set<string>();
          const newDefaults = new Set(currentDefaults);
          if (!isDefault) {
            newDefaults.add(pageId);
          } else {
            newDefaults.delete(pageId);
          }
          return { ...prev, [activeWorkspace]: newDefaults } as { [key: string]: Set<string> };
        });
      }
    } catch (error) {
      console.error('Failed to toggle page default:', error);
    }
  };

  // Search Notion pages from API
  // Extract a usable title from various Notion response shapes
  const extractNotionTitle = (result: any): string | null => {
    try {
      if (!result) return null;
      if (result.properties) {
        for (const k of Object.keys(result.properties)) {
          const prop = result.properties[k];
          if (prop?.type === 'title' && Array.isArray(prop.title) && prop.title.length > 0) {
            return prop.title.map((t: any) => t.plain_text || '').join('') || null;
          }
        }
        if (result.properties.title && Array.isArray(result.properties.title.title)) {
          return result.properties.title.title.map((t: any) => t.plain_text || '').join('') || null;
        }
      }
      if (result.title) {
        if (typeof result.title === 'string') return result.title;
        if (Array.isArray(result.title) && result.title.length > 0) {
          const maybe = result.title[0];
          return maybe?.plain_text || maybe?.text?.content || null;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  const searchNotionPages = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch('/api/notion-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          page_size: 50,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Filter out untitled results using a more robust extractor
        const filteredResults = (data.results || []).map((r: any) => ({ raw: r, title: extractNotionTitle(r) })).filter((x: any) => x.title && x.title.trim().length > 0).map((x: any) => ({ ...x.raw, _extracted_title: x.title }));
        setSearchResults(filteredResults);
        setShowApiSearchResults(true);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Failed to search Notion pages:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Add searched pages to selected contexts (fetch full content via server)
  const addSearchedPageToContext = async (page: any, forceAdd = false) => {
    const pageId = page.id;
    const isCurrentlySelected = selectedContexts.includes(`notion-${pageId}`);
    const alreadyLoaded = selectedApiResults.some(p => p.id === pageId);

    if (isCurrentlySelected && !forceAdd) {
      setSelectedContexts(prev => prev.filter(ctx => ctx !== `notion-${pageId}`));
      setSelectedApiResults(prev => prev.filter(p => p.id !== pageId));
      return;
    }

    if (isCurrentlySelected && alreadyLoaded) {
      return;
    }

    // Fetch full page content from server endpoint
    try {
      const res = await fetch('/api/notion-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId }),
      });
      if (res.ok) {
        const data = await res.json();
        const title = data.title || page._extracted_title || extractNotionTitle(page) || '(Untitled)';
        const content = data.content || '(No content available)';

        const normalized = {
          id: pageId,
          title,
          content,
          object: page.object || 'page',
          parent: { type: 'workspace' },
          children: [],
        };

        setSelectedContexts(prev => [...prev, `notion-${pageId}`]);
        setSelectedApiResults(prev => [...prev, normalized]);
      } else {
        console.error('Failed to fetch full page content for', pageId);
        const title = page._extracted_title || extractNotionTitle(page) || '(Untitled)';
        const normalized = { id: pageId, title, content: '(No content)', object: page.object || 'page', parent: { type: 'workspace' }, children: [] };
        setSelectedContexts(prev => [...prev, `notion-${pageId}`]);
        setSelectedApiResults(prev => [...prev, normalized]);
      }
    } catch (e) {
      console.error('Error fetching page content:', e);
      const title = page._extracted_title || extractNotionTitle(page) || '(Untitled)';
      const normalized = { id: pageId, title, content: '(No content)', object: page.object || 'page', parent: { type: 'workspace' }, children: [] };
      setSelectedContexts(prev => [...prev, `notion-${pageId}`]);
      setSelectedApiResults(prev => [...prev, normalized]);
    }
  };
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

  // Auto-select contexts based on workspace defaults and saved page defaults
  const getAutoContexts = () => {
    const autoDocs = defaultDocs[activeWorkspace] || [];
    const savedPageDefaults = Array.from(pageDefaults[activeWorkspace] || []).map(id => `notion-${id}`);
    return Array.from(new Set([...autoDocs, ...savedPageDefaults]));
  };

  // Filter Notion pages based on selected contexts (user has total control)
  const getNotionPages = () => {
    const selectedPageIds = new Set(
      selectedContexts
        .filter(ctx => ctx.startsWith('notion-'))
        .map(ctx => ctx.replace('notion-', ''))
    );

    const resultPages: any[] = [];
    const processedIds = new Set<string>();

    // Helper to recursively find pages in hierarchical structure
    const findPageInHierarchy = (pages: any[], targetId: string): any => {
      for (const page of pages) {
        if (page.id === targetId) return page;
        if (page.children && page.children.length > 0) {
          const found = findPageInHierarchy(page.children, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    selectedPageIds.forEach(pageId => {
      // Try to find in flat list first
      let page = allNotionPages.find(p => p.id === pageId);

      // If not found, try hierarchical structure
      if (!page && hierarchicalNotionPages) {
        page = findPageInHierarchy(hierarchicalNotionPages, pageId);
      }

      if (page && !processedIds.has(pageId)) {
        resultPages.push(page);
        processedIds.add(pageId);

        // If this is a database or data source, add all its children recursively
        if (page.object === 'database' || page.object === 'data_source') {
          const addChildren = (parent: any) => {
            if (parent.children && parent.children.length > 0) {
              parent.children.forEach((child: any) => {
                if (!processedIds.has(child.id)) {
                  resultPages.push(child);
                  processedIds.add(child.id);
                  // Recursively add nested children
                  addChildren(child);
                }
              });
            }
          };
          addChildren(page);
        }
      }
    });

    // Also include selected API search results
    selectedApiResults.forEach(apiResult => {
      const pageId = apiResult.id;
      if (!processedIds.has(pageId)) {
        // Create a normalized page object from API result or previously fetched normalized data
        const title = typeof apiResult.title === 'string'
          ? apiResult.title
          : apiResult._extracted_title || (apiResult.title?.[0]?.text?.content) || ((apiResult.properties && (() => {
            try {
              for (const k of Object.keys(apiResult.properties)) {
                const p = apiResult.properties[k];
                if (p?.type === 'title' && Array.isArray(p.title)) return p.title.map((t: any) => t.plain_text || '').join('');
              }
            } catch (e) {}
            return null;
          })())) || '(Untitled)';

        const content = apiResult.content || apiResult._content || (apiResult.properties?.content?.rich_text?.[0]?.plain_text) || '(No content available from API)';

        const normalizedPage = {
          id: pageId,
          title,
          content,
          object: apiResult.object || 'page',
          parent: { type: 'workspace' },
          children: [],
        };
        resultPages.push(normalizedPage);
        processedIds.add(pageId);
      }
    });

    return resultPages;
  };

  // Clean up stale page IDs from selectedContexts when pages are loaded
  useEffect(() => {
    if (allNotionPages.length > 0 || selectedApiResults.length > 0 || (pageDefaults[activeWorkspace] && pageDefaults[activeWorkspace].size > 0)) {
      const validNotionIds = new Set([
        ...allNotionPages.map((p: any) => p.id),
        ...selectedApiResults.map((p: any) => p.id),
        ...Array.from(pageDefaults[activeWorkspace] || []),
      ]);
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
  }, [allNotionPages, selectedApiResults, pageDefaults, activeWorkspace]);

  // Auto-select default docs when workspace changes or on initial load
  useEffect(() => {
    setSelectedContexts(getAutoContexts());
  }, [activeWorkspace, defaultDocs, pageDefaults]);

  // Ensure saved workspace page defaults are selected when they load
  useEffect(() => {
    if (!activeWorkspace) return;
    const defaultContexts = Array.from(pageDefaults[activeWorkspace] || []).map(id => `notion-${id}`);
    if (defaultContexts.length === 0) return;

    setSelectedContexts(prev => {
      const nonNotion = prev.filter(ctx => !ctx.startsWith('notion-'));
      return Array.from(new Set([...nonNotion, ...getAutoContexts(), ...defaultContexts]));
    });
  }, [activeWorkspace, pageDefaults, defaultDocs]);

  // Load saved default pages directly from Notion when their IDs are restored
  // Clear selectedApiResults first when workspace changes, then load new defaults
  useEffect(() => {
    const loadDefaultPages = async () => {
      if (!activeWorkspace) return;
      const defaultIds = Array.from(pageDefaults[activeWorkspace] || []);
      if (defaultIds.length === 0) return;

      for (const pageId of defaultIds) {
        await addSearchedPageToContext({ id: pageId, object: 'page' }, true);
      }
    };

    // Clear selectedApiResults when workspace changes, ensuring Content Preview updates
    setSelectedApiResults([]);
    
    // Load defaults after clearing
    loadDefaultPages();
  }, [activeWorkspace, pageDefaults]);

  // Helper function to get all descendant pages from a database
  const getAllDescendants = (page: any): any[] => {
    if (!page.children || page.children.length === 0) {
      return [page];
    }

    let descendants = [page];
    page.children.forEach((child: any) => {
      descendants = [...descendants, ...getAllDescendants(child)];
    });

    return descendants;
  };

  // Helper function to check if a database or data source is selected
  const isDatabaseSelected = (id: string): boolean => {
    // Check if the database/data source itself is selected
    return selectedContexts.includes(`notion-${id}`);
  };

  // Helper function to check if some (but not all) children are selected
  const isPartiallySelected = (page: any): boolean => {
    if (!page.children || page.children.length === 0) return false;

    // If the parent itself is selected, it's not partial
    if (selectedContexts.includes(`notion-${page.id}`)) return false;

    // Check if any descendant is selected
    const hasSelectedDescendant = (p: any): boolean => {
      if (selectedContexts.includes(`notion-${p.id}`)) return true;
      if (p.children && p.children.length > 0) {
        return p.children.some((child: any) => hasSelectedDescendant(child));
      }
      return false;
    };

    return hasSelectedDescendant(page);
  };

  // Helper function to check if a child is selected via its parent database
  const isChildSelectedViaParent = (childId: string): boolean => {
    const child = allNotionPages.find(p => p.id === childId);
    if (!child || !child.parent) return false;

    // Check if any parent database is selected
    let currentParent = child.parent;
    while (currentParent && (currentParent.page_id || currentParent.database_id)) {
      const parentId = currentParent.page_id || currentParent.database_id;
      const parentPage = allNotionPages.find(p => p.id === parentId);
      if (parentPage && parentPage.object === 'database') {
        return isDatabaseSelected(parentId);
      }
      if (parentPage && parentPage.parent) {
        currentParent = parentPage.parent;
      } else {
        break;
      }
    }

    return false;
  };

  // Helper function to get all children of a database or data source from allNotionPages
  const getDatabaseChildren = (parentId: string): any[] => {
    return allNotionPages.filter(page => {
      if (!page.parent) return false;
      const pageParentId = page.parent.page_id || page.parent.database_id || page.parent.data_source_id;
      return pageParentId === parentId;
    });
  };

  // Modified toggle context to handle three-way selection for databases/data sources
  const toggleContext = (id: string) => {
    setSelectedContexts(prev => {
      const pageId = id.replace('notion-', '');
      // Check both arrays for the page
      let pageToSelect = allNotionPages.find(p => p.id === pageId);

      // If not found in flat list, search hierarchical structure
      if (!pageToSelect && hierarchicalNotionPages) {
        const findInHierarchy = (pages: any[], targetId: string): any => {
          for (const page of pages) {
            if (page.id === targetId) return page;
            if (page.children && page.children.length > 0) {
              const found = findInHierarchy(page.children, targetId);
              if (found) return found;
            }
          }
          return null;
        };
        pageToSelect = findInHierarchy(hierarchicalNotionPages, pageId);
      }

      console.log('toggleContext - pageId:', pageId);
      console.log('toggleContext - pageToSelect:', pageToSelect);

      // For databases and data sources, implement three-way selection
      if (pageToSelect && (pageToSelect.object === 'database' || pageToSelect.object === 'data_source')) {
        const isCurrentlySelected = prev.includes(id);

        if (isCurrentlySelected) {
          // Currently selected (all children included) -> deselect completely
          console.log('toggleContext - deselecting database/data source:', id);
          return prev.filter(c => c !== id);
        } else {
          // Not selected or partially selected -> select all (just add parent)
          console.log('toggleContext - selecting database/data source:', id);
          // Remove any individual child selections and add parent
          const getAllDescendantIds = (p: any): string[] => {
            const ids: string[] = [];
            if (p.children && p.children.length > 0) {
              p.children.forEach((child: any) => {
                ids.push(`notion-${child.id}`);
                ids.push(...getAllDescendantIds(child));
              });
            }
            return ids;
          };
          const descendantIds = getAllDescendantIds(pageToSelect);
          // Remove all descendants and add parent
          return [...prev.filter(c => !descendantIds.includes(c)), id];
        }
      } else {
        // Regular page - simple toggle
        if (prev.includes(id)) {
          console.log('toggleContext - removing item:', id);
          return prev.filter(c => c !== id);
        } else {
          console.log('toggleContext - adding item:', id);
          return [...prev, id];
        }
      }
    });
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

  const toggleExpandedPreview = (pageId: string) => {
    setExpandedPreviewPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageId)) {
        newSet.delete(pageId);
      } else {
        newSet.add(pageId);
      }
      return newSet;
    });
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

  // Helper function to build hierarchy path for a page
  const buildHierarchyPath = (page: any, allPages: any[]): string => {
    const path: string[] = [page.title];
    let currentParent = page.parent;

    while (currentParent && (currentParent.page_id || currentParent.database_id)) {
      const parentId = currentParent.page_id || currentParent.database_id;
      const parentPage = allPages.find(p => p.id === parentId);
      if (parentPage) {
        path.unshift(parentPage.title);
        currentParent = parentPage.parent;
      } else {
        break;
      }
    }

    return path.join(' > ');
  };

  // Enhanced hierarchical rendering with toggle functionality
  const renderHierarchicalPages = (pages: any[], level = 0, parentPath: string[] = []): ReactNode[] => {
    // Sort pages based on current sort order
    const sortedPages = [...pages].sort((a, b) => {
      if (sortOrder === 'title') {
        return a.title.localeCompare(b.title);
      } else if (sortOrder === 'type') {
        const aType = a.object === 'database' ? 'database' : a.object === 'data_source' ? 'data_source' : 'page';
        const bType = b.object === 'database' ? 'database' : b.object === 'data_source' ? 'data_source' : 'page';
        if (aType !== bType) {
          if (aType === 'database') return -1;
          if (bType === 'database') return 1;
          if (aType === 'data_source') return -1;
          if (bType === 'data_source') return 1;
        }
        return a.title.localeCompare(b.title);
      }
      // hierarchy - keep original order
      return 0;
    });

    return sortedPages.flatMap(page => {
      const isDatabase = page.object === 'database';
      const isDataSource = page.object === 'data_source';
      const hasChildren = page.children && page.children.length > 0;
      const isExpanded = expandedPages.has(page.id);
      const currentPath = [...parentPath, page.title];

      // Enhanced visual hierarchy with better colors and spacing
      const bgColor = isDatabase
        ? 'bg-blue-900/40 border-blue-600/50'
        : isDataSource
          ? 'bg-purple-900/40 border-purple-600/50'
          : level === 0
            ? 'bg-gray-800/80'
            : level === 1
              ? 'bg-gray-750/60'
              : 'bg-gray-700/40';

      const borderLeft = level > 0
        ? `border-l-2 ${isDatabase || isDataSource ? 'border-purple-400' : 'border-purple-500/30'}`
        : isDatabase
          ? 'border-l-4 border-blue-500'
          : isDataSource
            ? 'border-l-4 border-purple-500'
            : '';

      const marginLeft = level > 0 ? (level === 1 ? 'ml-6' : 'ml-10') : '';

      const elements: ReactNode[] = [];

      elements.push(
        <div key={page.id} className={`flex items-center justify-between gap-2 text-sm p-2 rounded-lg ${bgColor} ${borderLeft} ${marginLeft} transition-all duration-200 hover:opacity-90`}>
          <label className="flex items-center gap-2 flex-1 cursor-pointer">
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleExpanded(page.id);
                }}
                className="text-purple-400 hover:text-purple-300 mr-1 font-bold cursor-pointer transition-colors duration-150"
                title={isExpanded ? 'Collapse children' : 'Expand children'}
              >
                <span className={`inline-block transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                  ▶
                </span>
              </button>
            )}
            {!hasChildren && <span className="w-5 inline-block"></span>}

            {(() => {
              const isChecked = (isDatabase || isDataSource)
                ? isDatabaseSelected(page.id)
                : selectedContexts.includes(`notion-${page.id}`) || isChildSelectedViaParent(page.id);
              const isIndeterminate = (isDatabase || isDataSource) && !isChecked && isPartiallySelected(page);

              return (
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = isIndeterminate;
                    }}
                    onChange={() => toggleContext(`notion-${page.id}`)}
                    className="form-checkbox h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                    title={
                      isIndeterminate
                        ? `Some children selected - click to select all ${isDataSource ? 'items' : 'content'}`
                        : (isDatabase || isDataSource) && isChecked
                          ? `${isDataSource ? 'Data source' : 'Database'} selected with all its content - click to deselect`
                          : (isDatabase || isDataSource)
                            ? `Select to include all ${isDataSource ? 'data source' : 'database'} content`
                            : isChildSelectedViaParent(page.id)
                              ? 'Included via parent selection'
                              : 'Select this page'
                    }
                  />
                </div>
              );
            })()}

            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isDatabase && (
                <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-md font-bold whitespace-nowrap">
                  DATABASE
                </span>
              )}
              {isDataSource && (
                <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-md font-bold whitespace-nowrap">
                  DATA SOURCE
                </span>
              )}

              <span className={`
                ${isDatabase || isDataSource ? 'font-bold text-purple-200' : ''} 
                ${level > 0 ? 'text-xs' : 'text-sm'} 
                ${level > 1 ? 'text-gray-400' : 'text-purple-300'}
                truncate
              `}>
                {page.title}
              </span>

              {level > 0 && (
                <span className="text-xs text-gray-500 bg-gray-700/30 px-2 py-0.5 rounded whitespace-nowrap" title={currentPath.join(' > ')}>
                  {parentPath[parentPath.length - 1]} →
                </span>
              )}

              {page.url && (
                <a
                  href={page.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-xs flex-shrink-0"
                  title="Open in Notion"
                >
                  🔗
                </a>
              )}

              {hasChildren && (
                <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {page.children.length} {isDatabase ? 'data sources' : isDataSource ? 'items' : 'sub-pages'}
                </span>
              )}
            </div>
          </label>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (editingTags === page.id) {
                  setEditingTags(null);
                  setTagInput('');
                } else {
                  setEditingTags(page.id);
                  setTagInput((customTags[page.id] || []).join(', '));
                }
              }}
              className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 cursor-pointer transition-colors duration-150"
              title="Edit tags"
            >
              🏷️
            </button>

            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleDefaultDoc(`notion-${page.id}`);
              }}
              className={`text-xs px-2 py-1 rounded cursor-pointer transition-colors duration-150 ${isDefaultDoc(`notion-${page.id}`)
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              title="Mark as default for this chat"
            >
              {isDefaultDoc(`notion-${page.id}`) ? '✓' : '⭐'}
            </button>
          </div>
        </div>
      );

      if (editingTags === page.id) {
        elements.push(
          <div key={`${page.id}-tags`} className={`flex gap-2 p-2 bg-gray-750/60 rounded-lg mt-1 ${marginLeft} border-l-2 border-purple-500/20`}>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Enter tags separated by commas"
              className="flex-1 px-2 py-1 text-xs bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
              autoFocus
            />
            <button
              onClick={() => {
                const tags = tagInput.split(',').map(t => t.trim()).filter(t => t);
                setCustomTags(prev => ({ ...prev, [page.id]: tags }));
                setEditingTags(null);
                setTagInput('');
              }}
              className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 cursor-pointer transition-colors duration-150"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditingTags(null);
                setTagInput('');
              }}
              className="text-xs bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 cursor-pointer transition-colors duration-150"
            >
              Cancel
            </button>
          </div>
        );
      }

      // Only render children if expanded - with smooth animation
      if (hasChildren && isExpanded) {
        elements.push(
          <div key={`${page.id}-children`} className={`${marginLeft} overflow-hidden transition-all duration-300`}>
            {renderHierarchicalPages(page.children, level + 1, currentPath)}
          </div>
        );
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

    // Debug logging (only once per page to avoid spam)
    if (!loggedExtractTags.has(page.id) && page.object !== 'page') {
      console.log('[extractTags] Page ID:', page.id, 'Title:', page.title, 'Object:', page.object, 'titleLength:', title.length);
      loggedExtractTags.add(page.id);
    }

    // Simple keyword-based tagging
    if (title.includes('task') || title.includes('todo') || title.includes('goals')) tags.push('Tasks');
    if (title.includes('timeline') || title.includes('schedule') || title.includes('calendar')) tags.push('Timeline');
    if (title.includes('food') || title.includes('meal') || title.includes('nutrition') || title.includes('casa') || title.includes('scorte')) tags.push('Food');
    if (title.includes('entertainment') || title.includes('game') || title.includes('movie') || title.includes('music')) tags.push('Entertainment');
    if (title.includes('emotion') || title.includes('mood') || title.includes('wellbeing')) tags.push('Wellbeing');
    if (title.includes('research') || title.includes('study') || title.includes('analysis')) tags.push('Research');

    // Database and data source indicators - these should be tagged even without keywords
    if (page.object === 'database') tags.push('Database');
    if (page.object === 'data_source') tags.push('Data Source');

    // If no tags found, check if we have content with specific patterns
    if (tags.length === 0 && page.content) {
      const contentLower = page.content.toLowerCase();
      if (contentLower.includes('database:') || contentLower.includes('data source:')) {
        // This is likely a parent page with database content
        return ['Database'];
      }
    }

    const result = tags.length > 0 ? tags : ['Other'];
    if (result[0] === 'Other' && title.length === 0) {
      console.log('[extractTags] WARNING - Page has no title:', page.id, 'Object:', page.object, 'Content preview:', page.content?.substring(0, 50));
    }
    return result;
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

  // Render hierarchical pages with toggles
  const renderHierarchicalNotionPages = (pages: any[], depth = 0): ReactNode => {
    // Filter pages by search query
    const filterPages = (pagesToFilter: any[]): any[] => {
      if (!notionSearchQuery.trim()) return pagesToFilter;

      const query = notionSearchQuery.toLowerCase();
      return pagesToFilter.map(page => {
        const titleMatch = (page.title || '').toLowerCase().includes(query);
        const filteredChildren = page.children && page.children.length > 0
          ? filterPages(page.children)
          : [];

        // Only include page if it matches or has matching descendants
        if (titleMatch || filteredChildren.length > 0) {
          return {
            ...page,
            children: filteredChildren
          };
        }
        return null;
      }).filter(page => page !== null);
    };

    const filteredPages = depth === 0 ? filterPages(pages) : pages;

    return (
      <>
        {filteredPages.map(page => {
          const hasChildren = page.children && page.children.length > 0;
          const isExpanded = expandedPages.has(page.id);
          const isSelected = selectedContexts.includes(`notion-${page.id}`);
          const currentWorkspaceDefaults = pageDefaults?.[activeWorkspace] || new Set<string>();
          const isDefault = currentWorkspaceDefaults.has(page.id);

          // Determine icon based on object type
          const getIcon = (obj: string) => {
            switch (obj) {
              case 'database': return '🗄️';
              case 'data_source': return '📊';
              case 'page': return '📄';
              case 'block': return '📌';
              case 'agent': return '🤖';
              default: return '📄';
            }
          };

          const icon = getIcon(page.object);
          const indentPx = depth * 16; // 16px per level

          return (
            <div key={page.id} style={{ marginLeft: indentPx }}>
              <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-700/50 rounded transition-colors">
                {hasChildren ? (
                  <button
                    onClick={() => toggleExpanded(page.id)}
                    className="text-xs text-gray-400 hover:text-white transition-transform duration-200"
                    style={{
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      width: '16px',
                      display: 'inline-block'
                    }}
                  >
                    ▶
                  </button>
                ) : (
                  <span className="w-4"></span>
                )}

                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    setSelectedContexts(prev =>
                      prev.includes(`notion-${page.id}`)
                        ? prev.filter(ctx => ctx !== `notion-${page.id}`)
                        : [...prev, `notion-${page.id}`]
                    );
                  }}
                  className="w-4 h-4 rounded cursor-pointer"
                />

                <span className="text-sm">{icon}</span>

                <span className="text-xs text-gray-300 flex-1 truncate cursor-pointer hover:text-white"
                  onClick={() => setSelectedContexts(prev =>
                    prev.includes(`notion-${page.id}`)
                      ? prev.filter(ctx => ctx !== `notion-${page.id}`)
                      : [...prev, `notion-${page.id}`]
                  )}
                >
                  {page.title || 'Untitled'}
                </span>

                {hasChildren && (
                  <span className="text-xs text-gray-500">
                    ({page.children.length})
                  </span>
                )}

                {/* Default button to mark as default for this chat */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePageDefault(page.id, page.title || 'Untitled', isDefault);
                  }}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors whitespace-nowrap ${isDefault
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  title={isDefault ? 'Remove from defaults' : 'Add to defaults'}
                >
                  {isDefault ? 'Default' : 'Set Default'}
                </button>
              </div>

              {hasChildren && isExpanded && (
                <div className="mt-1">
                  {renderHierarchicalNotionPages(page.children, depth + 1)}
                </div>
              )}
            </div>
          );
        })}
      </>
    );
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
    if (groupByParent) {
      // Show unified hierarchical view - use the pages parameter (may be filtered)
      return renderHierarchicalNotionPages(pages || []);
    }

    if (groupByTags) {
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
    }

    return <>{renderHierarchicalPages(pages)}</>;
  };

  return (
    <div className="flex-1 flex min-w-0 min-h-0 sm:min-w-[800px]">
      {/* Sidebar */}
      <div className={`${showMenu ? 'w-64' : 'w-0 sm:w-16'} bg-gray-800 border-r border-gray-700 transition-all duration-200 flex-shrink-0 overflow-hidden`}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-full p-4 sm:p-3 text-gray-400 hover:text-white hover:bg-gray-700 text-left text-2xl sm:text-lg cursor-pointer"
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
                className={`w-full text-left px-3 sm:px-3 py-3 sm:py-2 rounded transition-colors cursor-pointer ${activeWorkspace === workspace.id
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
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-x-auto">
        {/* Tab Navigation */}
        <div className="flex-shrink-0 border-b border-gray-800 bg-gray-950">
          <div className="flex items-center gap-1.5 px-3 py-1.5">
            {/* Mobile hamburger (sidebar toggle) */}
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="sm:hidden flex h-7 w-7 items-center justify-center rounded-lg text-sm text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
              title={showMenu ? "Close sidebar" : "Open sidebar"}
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Mobile tab menu */}
            <div className="sm:hidden relative">
              <button
                onClick={() => setShowTabMenu(!showTabMenu)}
                className="flex items-center gap-1.5 rounded-lg border-l-2 border-blue-500/30 bg-gray-800/20 px-2.5 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-800/40"
              >
                <span>{activeTab === 'chat' ? '💬' : activeTab === 'docs' ? '📄' : activeTab === 'calendar' ? '📅' : '🥗'}</span>
                <span className="capitalize">{activeTab}</span>
                <svg className={`h-3 w-3 transition-transform ${showTabMenu ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>
              {showTabMenu && (
                <div className="absolute left-0 top-full z-30 mt-1 min-w-[160px] rounded-lg border border-gray-700 bg-gray-900 p-1 shadow-2xl">
                  {(['chat', 'docs', 'calendar', 'nutrients'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => { setActiveTab(tab); setShowTabMenu(false); }}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${activeTab === tab ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                    >
                      <span>{tab === 'chat' ? '💬' : tab === 'docs' ? '📄' : tab === 'calendar' ? '📅' : '🥗'}</span>
                      <span className="capitalize">{tab}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Desktop tabs */}
            <div className="hidden sm:flex items-center gap-0.5">
              {(['chat', 'docs', 'calendar', 'nutrients'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}
                >
                  {tab === 'chat' ? '💬' : tab === 'docs' ? '📄' : tab === 'calendar' ? '📅' : '🥗'} {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden min-w-0 min-h-0 sm:min-w-[800px] flex flex-col">
          {activeTab === 'chat' && currentWorkspace.id === 'model-testing' && (
            <Suspense fallback={<div className="text-white p-4">Loading Model Testing...</div>}>
              <ModelTesting
                notes={notes}
                sheetData={sheetData}
                notionPages={notionPages}
              />
            </Suspense>
          )}

          {activeTab === 'chat' && currentWorkspace.id !== 'model-testing' && (
            <Suspense fallback={<div className="text-white p-4">Loading Chat...</div>}>
              <ChatInterface
                selectedContexts={selectedContexts}
                notes={notes}
                aiModel={aiModel}
                sheetData={currentWorkspace.autoLoadSheets ? sheetData : null}
                notionPages={getNotionPages()}
                workspacePrompt={currentWorkspace.systemPrompt}
                workspaceId={currentWorkspace.id}
                calendarEvents={calendarEvents}
                nutrientEntries={currentWorkspace.id === 'nutrition' ? nutrientEntries : []}
              />
            </Suspense>
          )}

          {activeTab === 'docs' && (
            <div className="h-full overflow-y-auto p-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Main Content */}
                <div className="lg:col-span-2">
                  {/* Error Message */}
                  {notionError && (
                    <div className="mb-4 p-4 bg-red-900 bg-opacity-50 border border-red-600 rounded text-red-200 flex items-start gap-3">
                      <span className="text-xl mt-0.5">⚠️</span>
                      <div>
                        <div className="font-semibold">Notion Error</div>
                        <div className="text-sm mt-1">{notionError}</div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Manage accessible documents</h3>
                    <div className="flex items-center gap-2">
                      <a
                        href="https://www.notion.so/profile/integrations/internal/321edf78-6daa-81fd-b8e2-00271dff58e1"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm bg-gray-900 text-white border border-gray-600 px-4 py-2 rounded hover:bg-gray-800 hover:border-gray-500 cursor-pointer transition-colors"
                        title="Open Notion API Integration"
                      >
                        🔗 Notion API
                      </a>
                      <button
                        onClick={reloadNotionPages}
                        disabled={loadingNotion}
                        className="text-sm bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:bg-gray-600 cursor-pointer"
                      >
                        {loadingNotion ? 'Loading...' : '↻ Reload'}
                      </button>
                      {loadingNotion && onStopNotion && (
                        <button
                          onClick={onStopNotion}
                          className="text-sm bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 cursor-pointer"
                        >
                          ✕ Stop
                        </button>
                      )}
                    </div>
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
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                              type="radio"
                              name="grouping"
                              checked={!groupByTags}
                              onChange={() => {
                                setGroupByParent(true);
                                setGroupByTags(false);
                              }}
                              className="form-radio h-4 w-4"
                            />
                            Hierarchical
                          </label>
                          <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                              type="radio"
                              name="grouping"
                              checked={groupByTags}
                              onChange={() => {
                                setGroupByParent(false);
                                setGroupByTags(true);
                              }}
                              className="form-radio h-4 w-4"
                            />
                            By Tags
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              // Expand all pages that have children in hierarchical structure
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
                            className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 cursor-pointer"
                          >
                            Expand All
                          </button>
                          <button
                            onClick={() => setExpandedPages(new Set())}
                            className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 cursor-pointer"
                          >
                            Collapse All
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Local Search - Only if pages are loaded */}
                    {(hierarchicalNotionPages && hierarchicalNotionPages.length > 0) && (
                      <div className="p-3 bg-gray-800 rounded mb-3">
                        <div className="text-xs text-gray-400 mb-2 font-semibold">📂 Loaded Pages</div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-300">Search:</label>
                          <input
                            type="text"
                            placeholder="Search by page name..."
                            value={notionSearchQuery}
                            onChange={(e) => setNotionSearchQuery(e.target.value)}
                            className="flex-1 text-sm bg-gray-700 text-white px-3 py-1 rounded border border-gray-600 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                          />
                          {notionSearchQuery && (
                            <button
                              onClick={() => setNotionSearchQuery('')}
                              className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-500 cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notion API Search - Always available */}
                    <div className="p-3 bg-gray-800 rounded mb-3">
                      <div className="text-xs text-gray-400 mb-2 font-semibold">🔍 Search Notion</div>
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="text"
                          placeholder="Search for pages to add..."
                          id="apiSearchInput"
                          className="flex-1 text-sm bg-gray-700 text-white px-3 py-1 rounded border border-gray-600 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                              searchNotionPages(e.currentTarget.value);
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            const searchInput = document.getElementById('apiSearchInput') as HTMLInputElement;
                            if (searchInput?.value.trim()) {
                              searchNotionPages(searchInput.value);
                            }
                          }}
                          disabled={isSearching}
                          className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:bg-gray-600 cursor-pointer"
                        >
                          {isSearching ? 'Searching...' : 'Search'}
                        </button>
                      </div>

                      {/* API Search Results */}
                      {showApiSearchResults && (
                        <div className="mt-3">
                          {searchResults.length > 0 ? (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              <p className="text-xs text-gray-400 mb-2">Found {searchResults.length} results (click to select):</p>
                              {searchResults.map((result: any) => {
                                const isSelected = selectedContexts.includes(`notion-${result.id}`);
                                const resultType = result.object || 'page';
                                const displayTitle = result._extracted_title || (typeof result.title === 'string' ? result.title : result.title?.[0]?.text?.content) || '';
                                const currentWorkspaceDefaults = pageDefaults?.[activeWorkspace] || new Set<string>();
                                const isDefault = currentWorkspaceDefaults.has(result.id);

                                return (
                                  <div
                                    key={result.id}
                                    className={`p-2 rounded text-xs transition-colors ${
                                      isSelected
                                        ? 'bg-blue-600 text-white border border-blue-500'
                                        : 'bg-gray-700 text-gray-200 border border-gray-600 hover:bg-gray-650'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => addSearchedPageToContext(result)}>
                                        <div className="font-medium truncate">{displayTitle}</div>
                                        <div className="text-xs text-gray-400 truncate">
                                          {resultType === 'page' && '📄 Page'}
                                          {resultType === 'database' && '🗂️ Database'}
                                          {resultType === 'data_source' && '📊 Data Source'}
                                        </div>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          togglePageDefault(result.id, displayTitle || 'Untitled', isDefault);
                                        }}
                                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${isDefault
                                          ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                        title={isDefault ? 'Remove default' : 'Set default'}
                                      >
                                        Default
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : isSearching ? (
                            <p className="text-xs text-gray-400">Searching...</p>
                          ) : (
                            <p className="text-xs text-gray-400">Enter a search query to find Notion pages</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Tag Filter */}
                    {(hierarchicalNotionPages || allNotionPages) && (
                      <div className="p-3 bg-gray-800 rounded">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm text-gray-300">Filter by tags:</label>
                          <button
                            onClick={() => setSelectedTags(new Set())}
                            className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-500 cursor-pointer"
                          >
                            Clear All
                          </button>
                          <button
                            onClick={() => {
                              const allTags = getAllTags(hierarchicalNotionPages || allNotionPages);
                              setSelectedTags(new Set(allTags));
                            }}
                            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 cursor-pointer"
                          >
                            Select All
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {getAllTags(hierarchicalNotionPages || allNotionPages).map(tag => (
                            <button
                              key={tag}
                              onClick={() => toggleTag(tag)}
                              className={`text-xs px-3 py-1 rounded transition-colors cursor-pointer ${selectedTags.has(tag)
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
                          className={`text-xs px-2 py-1 rounded cursor-pointer ${isDefaultDoc('sheet')
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
                      {allNotionPages && allNotionPages.length > 0 ? (
                        <div className="space-y-1">
                          {(() => {
                            // Show hierarchical structure first (if available)
                            const hierarchicalPages = hierarchicalNotionPages || [];
                            const allFlatPages = allNotionPages.map(page => ({ ...page, children: [] }));

                            // First, deduplicate the hierarchical structure itself
                            const deduplicateHierarchical = (pages: any[]): any[] => {
                              const seenIds = new Set();
                              const deduplicated = [];

                              const processPage = (page: any): any => {
                                if (!page.id || typeof page.id !== 'string') return null;
                                if (seenIds.has(page.id)) return null;

                                seenIds.add(page.id);
                                const dedupPage = { ...page };

                                if (page.children && page.children.length > 0) {
                                  dedupPage.children = page.children
                                    .map(processPage)
                                    .filter((child: any) => child !== null);
                                }

                                return dedupPage;
                              };

                              return pages
                                .map(processPage)
                                .filter(page => page !== null);
                            };

                            const deduplicatedHierarchicalPages = deduplicateHierarchical(hierarchicalPages);

                            // Get IDs of pages actually in hierarchical structure (now properly deduplicated)
                            const hierarchicalPageIds = new Set();
                            const collectPageIds = (pages: any[]) => {
                              pages.forEach(page => {
                                if (page.id && typeof page.id === 'string') {
                                  hierarchicalPageIds.add(page.id);
                                }
                                if (page.children && page.children.length > 0) {
                                  collectPageIds(page.children);
                                }
                              });
                            };
                            collectPageIds(deduplicatedHierarchicalPages);

                            // Filter out pages that are actually in hierarchy
                            const standalonePages = allFlatPages.filter(page =>
                              page.id &&
                              typeof page.id === 'string' &&
                              !hierarchicalPageIds.has(page.id)
                            );

                            // Debug: Show which pages are being marked as standalone vs hierarchical
                            console.log('[RENDER DEBUG] Total pages in allNotionPages:', allFlatPages.length);
                            console.log('[RENDER DEBUG] Hierarchical page IDs found:', Array.from(hierarchicalPageIds));
                            console.log('[RENDER DEBUG] Standalone page IDs:', standalonePages.map(p => p.id));

                            console.log('[RENDER DEBUG] Original hierarchical pages:', hierarchicalPages.length);
                            console.log('[RENDER DEBUG] Deduplicated hierarchical pages:', deduplicatedHierarchicalPages.length);
                            console.log('[RENDER DEBUG] Standalone pages:', standalonePages.length);

                            // Check for "Cosa c'è in casa" in all pages
                            const casaPageInHierarchical = deduplicatedHierarchicalPages.find(p => p.title.toLowerCase().includes('casa'));
                            const casaPageInStandalone = standalonePages.find(p => p.title.toLowerCase().includes('casa'));
                            console.log('[RENDER DEBUG] Casa page in hierarchical:', !!casaPageInHierarchical);
                            console.log('[RENDER DEBUG] Casa page in standalone:', !!casaPageInStandalone);

                            // Log all hierarchical page titles to see what's there
                            console.log('[RENDER DEBUG] ========== COMPLETE HIERARCHY TREE ==========');
                            const collectTitles = (pages: any[], depth = 0, pageNumbers = { count: 0 }) => {
                              pages.forEach(page => {
                                pageNumbers.count++;
                                const indent = '  '.repeat(depth);
                                const hasChildren = page.children && page.children.length > 0;
                                const childCount = hasChildren ? ` [+${page.children.length}]` : '';
                                console.log(`${indent}${pageNumbers.count}. "${page.title}" (${page.id}) ${childCount} [${page.object}]`);
                                if (page.children && page.children.length > 0) {
                                  collectTitles(page.children, depth + 1, pageNumbers);
                                }
                              });
                            };
                            collectTitles(deduplicatedHierarchicalPages);
                            console.log('[RENDER DEBUG] ========== ROOT LEVEL PAGES ==========');
                            deduplicatedHierarchicalPages.forEach((page, idx) => {
                              const childCount = page.children?.length || 0;
                              console.log(`${idx + 1}. ROOT: "${page.title}" (${page.id}) [${page.object}] with ${childCount} children`);
                            });
                            console.log('[RENDER DEBUG] ==========================================');




                            return (
                              <>
                                {/* Hierarchical structure - contains all pages */}
                                {deduplicatedHierarchicalPages.length > 0 && (
                                  <div className="mb-4">
                                    {renderGroupedPages(filterPagesByTags(deduplicatedHierarchicalPages))}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      ) : loadingNotion ? (
                        <div className="text-sm text-gray-400 p-4 bg-gray-800 rounded border border-gray-700">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-block animate-spin">⟳</span>
                            <span>Loading Notion pages...</span>
                          </div>
                          <div className="text-xs text-gray-500 ml-6">
                            Processing and organizing your Notion data. Pages will appear below as they load.
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 p-3 bg-gray-800 rounded">
                          No Notion pages found. Click "↻ Reload" to fetch them.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Nutrients Section */}
                  <div className="mt-6 p-4 bg-gray-800 rounded">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      🥗 Nutrients
                      <span className="text-sm text-gray-400">(Include nutrient data from Nutrients tab)</span>
                    </h3>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 text-sm text-orange-300 p-3 bg-gray-800 rounded">
                        <label className="flex items-center gap-2 flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={nutrientSettings.includeFoodEntries}
                            onChange={(e) => setNutrientSettings(prev => ({ ...prev, includeFoodEntries: e.target.checked }))}
                            className="form-checkbox h-4 w-4"
                          />
                          <span>Food Entries & Daily Nutrients (Last 24h)</span>
                        </label>
                        <button
                          onClick={() => toggleDefaultNutrientSetting('includeFoodEntries')}
                          className={`text-xs px-2 py-1 rounded cursor-pointer ${isDefaultNutrientSetting('includeFoodEntries')
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          title="Mark as default for this chat"
                        >
                          {isDefaultNutrientSetting('includeFoodEntries') ? '✓ Default' : 'Default'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-sm text-cyan-300 p-3 bg-gray-800 rounded">
                        <label className="flex items-center gap-2 flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={nutrientSettings.includeVitaminsMinerals}
                            onChange={(e) => setNutrientSettings(prev => ({ ...prev, includeVitaminsMinerals: e.target.checked }))}
                            className="form-checkbox h-4 w-4"
                          />
                          <span>Vitamins & Minerals (Last 24h)</span>
                        </label>
                        <button
                          onClick={() => toggleDefaultNutrientSetting('includeVitaminsMinerals')}
                          className={`text-xs px-2 py-1 rounded cursor-pointer ${isDefaultNutrientSetting('includeVitaminsMinerals')
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          title="Mark as default for this chat"
                        >
                          {isDefaultNutrientSetting('includeVitaminsMinerals') ? '✓ Default' : 'Default'}
                        </button>
                      </div>
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

                {/* Right Column - Prompt Preview */}
                <div className="lg:col-span-1">
                  <div className="sticky top-4">
                    {/* Prompt Preview Section */}
                    <div className="p-4 bg-gray-800 rounded">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        📋 Prompt Preview
                        <span className="text-sm text-gray-400">(What will be sent to AI)</span>
                      </h3>

                      <div className="space-y-4">
                        {/* Selected Contexts Summary */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-2">Selected Contexts</h4>
                          <div className="space-y-2">
                            {/* Google Sheets toggle */}
                            {(sheetData || selectedContexts.includes('sheet')) && (
                              <div
                                onClick={() => {
                                  if (selectedContexts.includes('sheet')) {
                                    setSelectedContexts(selectedContexts.filter(ctx => ctx !== 'sheet'));
                                  } else {
                                    setSelectedContexts([...selectedContexts, 'sheet']);
                                  }
                                }}
                                className={`text-xs p-2 rounded cursor-pointer transition ${
                                  selectedContexts.includes('sheet')
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                }`}
                              >
                                {selectedContexts.includes('sheet') ? '☑' : '☐'} 📊 Google Sheets
                              </div>
                            )}

                            {/* Default Notion pages - always show them with toggle */}
                            {(() => {
                              const defaultPageIds = Array.from(pageDefaults[activeWorkspace] || []);
                              const rendered = new Set<string>();
                              const items: JSX.Element[] = [];

                              defaultPageIds.forEach(pageId => {
                                if (rendered.has(pageId)) return;
                                rendered.add(pageId);

                                const ctx = `notion-${pageId}`;
                                const isSelected = selectedContexts.includes(ctx);

                                // Try to find page in API results first
                                let apiResult = selectedApiResults.find(p => p.id === pageId);
                                if (apiResult) {
                                  const icon = apiResult.object === 'database' ? '🗄️' : apiResult.object === 'data_source' ? '📊' : '📄';
                                  items.push(
                                    <div
                                      key={ctx}
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedContexts(selectedContexts.filter(c => c !== ctx));
                                        } else {
                                          setSelectedContexts([...selectedContexts, ctx]);
                                        }
                                      }}
                                      className={`text-xs p-2 rounded cursor-pointer transition ${
                                        isSelected
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                      }`}
                                    >
                                      {isSelected ? '☑' : '☐'} {icon} {apiResult.title || 'Untitled'}
                                    </div>
                                  );
                                  return;
                                }

                                // Try to find in hierarchy
                                let page = allNotionPages.find(p => p.id === pageId);
                                if (!page && hierarchicalNotionPages) {
                                  const findInHierarchy = (pages: any[], targetId: string): any => {
                                    for (const p of pages) {
                                      if (p.id === targetId) return p;
                                      if (p.children && p.children.length > 0) {
                                        const found = findInHierarchy(p.children, targetId);
                                        if (found) return found;
                                      }
                                    }
                                    return null;
                                  };
                                  page = findInHierarchy(hierarchicalNotionPages, pageId);
                                }

                                if (page) {
                                  let label = page.title || 'Untitled';
                                  let icon = '📄';

                                  if (page.object === 'database') {
                                    const countDescendants = (p: any): number => {
                                      let count = 0;
                                      if (p.children && p.children.length > 0) {
                                        count += p.children.length;
                                        p.children.forEach((child: any) => {
                                          count += countDescendants(child);
                                        });
                                      }
                                      return count;
                                    };
                                    const totalItems = countDescendants(page);
                                    label = `${page.title} (+${totalItems} items)`;
                                    icon = '🗄️';
                                  } else if (page.object === 'data_source') {
                                    const itemCount = page.children ? page.children.length : 0;
                                    label = `${page.title} (+${itemCount} items)`;
                                    icon = '📊';
                                  }

                                  items.push(
                                    <div
                                      key={ctx}
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedContexts(selectedContexts.filter(c => c !== ctx));
                                        } else {
                                          setSelectedContexts([...selectedContexts, ctx]);
                                        }
                                      }}
                                      className={`text-xs p-2 rounded cursor-pointer transition ${
                                        isSelected
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                      }`}
                                    >
                                      {isSelected ? '☑' : '☐'} {icon} {label}
                                    </div>
                                  );
                                }
                              });

                              return items;
                            })()}

                            {(() => {
                              const defaultPageIds = Array.from(pageDefaults[activeWorkspace] || []);
                              return defaultPageIds.length === 0 ? (
                                <span className="text-sm text-gray-500">No default contexts. Set defaults to see them here!</span>
                              ) : null;
                            })()}
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

                            {getNotionPages().map((page: any) => {
                              const isExpanded = expandedPreviewPages.has(page.id);
                              const displayContent = isExpanded ? page.content : page.content?.substring(0, 500);
                              const needsTruncation = page.content?.length > 500;

                              return (
                                <div key={page.id} className="mb-3">
                                  <div className="text-purple-400 font-bold mb-1">{page.title}:</div>
                                  <div className="text-gray-400 whitespace-pre-wrap">
                                    {displayContent}
                                    {needsTruncation && !isExpanded && '...'}
                                  </div>
                                  {needsTruncation && (
                                    <button
                                      onClick={() => toggleExpandedPreview(page.id)}
                                      className="mt-1 text-xs text-blue-400 hover:text-blue-300"
                                    >
                                      {isExpanded ? 'Show less' : 'More'}
                                    </button>
                                  )}
                                </div>
                              );
                            })}

                            {nutrientSettings.includeFoodEntries && (
                              <div className="mb-3">
                                <div className="text-orange-400 font-bold mb-1">🍽️ Food Entries & Daily Nutrients:</div>
                                <div className="text-gray-400 whitespace-pre-wrap text-xs">
                                  {formatFoodEntriesAndDailyNutrients()}
                                </div>
                              </div>
                            )}

                            {nutrientSettings.includeVitaminsMinerals && (
                              <div className="mb-3">
                                <div className="text-cyan-400 font-bold mb-1">💊 Vitamins & Minerals:</div>
                                <div className="text-gray-400 whitespace-pre-wrap text-xs">
                                  {formatVitaminsAndMinerals()}
                                </div>
                              </div>
                            )}

                            {selectedContexts.filter(ctx => ctx.startsWith('notion-')).length === 0 && !selectedContexts.includes('sheet') && !nutrientSettings.includeFoodEntries && !nutrientSettings.includeVitaminsMinerals && (
                              <div className="text-gray-500">No content will be sent to AI</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}



          {activeTab === 'calendar' && (
            <Suspense fallback={<div className="text-white p-4">Loading Calendar...</div>}>
              <CalendarView onEventsChange={setCalendarEvents} />
            </Suspense>
          )}

          {activeTab === 'nutrients' && (
            <Suspense fallback={<div className="text-white p-4">Loading Nutrients...</div>}>
              <NutrientTracker
                sheetData={sheetData}
                onEntriesChange={setNutrientEntries}
              />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
});
