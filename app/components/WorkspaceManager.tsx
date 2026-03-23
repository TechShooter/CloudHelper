'use client';

import { useState, useEffect } from 'react';
import ChatInterface from './ChatInterface';

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
    id: 'research',
    name: 'Research',
    icon: '📚',
    description: 'Deep analysis and research',
    autoLoadSheets: true,
    autoLoadNotion: true,
    autoLoadMeals: false,
    autoLoadProfile: false,
    systemPrompt: 'You are a research assistant. Focus on detailed analysis, data interpretation, and insights.'
  }
];

interface Props {
  notes: {id: string, title: string, content: string}[];
  aiModel: 'gemini-flash' | 'gemini-2.5' | 'gemini-2.5-pro' | 'groq';
  userProfile: any;
  sheetData: any;
  mealHistory: any[];
  notionPages: any[];
  allNotionPages: any[];
}

export default function WorkspaceManager({ notes, aiModel, userProfile, sheetData, mealHistory, notionPages, allNotionPages }: Props) {
  const [activeWorkspace, setActiveWorkspace] = useState('general');
  const [workspaces] = useState<Workspace[]>(DEFAULT_WORKSPACES);
  const [showMenu, setShowMenu] = useState(false);

  const currentWorkspace = workspaces.find(w => w.id === activeWorkspace) || workspaces[0];

  // Auto-select contexts based on workspace
  const getAutoContexts = () => {
    const contexts: string[] = [];
    if (currentWorkspace.autoLoadSheets && sheetData) contexts.push('sheet');
    return contexts;
  };

  // Filter Notion pages based on workspace
  const getNotionPages = () => {
    if (!currentWorkspace.autoLoadNotion) return [];
    
    if (currentWorkspace.id === 'nutrition' || currentWorkspace.id === 'general') {
      // Filter for home inventory
      return allNotionPages.filter((p: any) => 
        p.title.toLowerCase().includes('casa') || 
        p.title.toLowerCase().includes('scorte')
      );
    } else if (currentWorkspace.id === 'goals') {
      // Filter for Timeline, Tasks, Goals
      return allNotionPages.filter((p: any) => 
        p.title.toLowerCase().includes('timeline') ||
        p.title.toLowerCase().includes('tasks') ||
        p.title.toLowerCase().includes('goal')
      );
    }
    
    return allNotionPages;
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <div className={`${showMenu ? 'w-64' : 'w-12'} bg-gray-800 border-r border-gray-700 transition-all duration-200`}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-full p-3 text-gray-400 hover:text-white hover:bg-gray-700 text-left"
        >
          {showMenu ? '←' : '☰'}
        </button>
        
        {showMenu && (
          <div className="p-2 space-y-1">
            {workspaces.map(workspace => (
              <button
                key={workspace.id}
                onClick={() => setActiveWorkspace(workspace.id)}
                className={`w-full text-left px-3 py-2 rounded transition-colors ${
                  activeWorkspace === workspace.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{workspace.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{workspace.name}</div>
                    <div className="text-xs text-gray-400 truncate">{workspace.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{currentWorkspace.icon}</span>
            <div>
              <h2 className="text-sm font-semibold text-white">{currentWorkspace.name}</h2>
              <p className="text-xs text-gray-400">{currentWorkspace.description}</p>
            </div>
          </div>
        </div>

        <ChatInterface
          selectedContexts={getAutoContexts()}
          notes={notes}
          aiModel={aiModel}
          userProfile={currentWorkspace.autoLoadProfile ? userProfile : null}
          sheetData={currentWorkspace.autoLoadSheets ? sheetData : null}
          mealHistory={currentWorkspace.autoLoadMeals ? mealHistory : []}
          notionPages={getNotionPages()}
          workspacePrompt={currentWorkspace.systemPrompt}
          workspaceId={currentWorkspace.id}
        />
      </div>
    </div>
  );
}
