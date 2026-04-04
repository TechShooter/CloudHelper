'use client';

import { useState } from 'react';

interface PromptDebugProps {
  isOpen: boolean;
  onClose: () => void;
  promptData: {
    systemPrompt: string;
    conversationHistory: any[];
    message: string;
    sheetData: any;
    notionData: any[];
    userProfile: any;
    mealHistory: any[];
  };
  onPromptUpdate: (newPromptData: any) => void;
}

export default function PromptDebug({ isOpen, onClose, promptData, onPromptUpdate }: PromptDebugProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'system' | 'conversation' | 'data'>('overview');
  const [contextSettings, setContextSettings] = useState({
    includeSheetData: true,
    includeNotionData: true,
    includeUserProfile: true,
    includeMealHistory: true,
    maxSheetRows: 100,
    maxNotionPages: 50
  });

  if (!isOpen) return null;

  // Calculate sizes
  const systemPromptSize = promptData.systemPrompt.length;
  const conversationSize = JSON.stringify(promptData.conversationHistory).length;
  const messageSize = promptData.message.length;
  const totalSize = systemPromptSize + conversationSize + messageSize;

  // Generate optimized prompt based on settings
  const generateOptimizedPrompt = () => {
    let optimizedPrompt = '';

    // Add workspace prompt (always included)
    if (promptData.systemPrompt.includes('Workspace:')) {
      const workspaceMatch = promptData.systemPrompt.match(/^[^---]*---/);
      if (workspaceMatch) {
        optimizedPrompt += workspaceMatch[0] + '\n\n';
      }
    }

    // Add current date/time
    const now = new Date();
    const dateStr = now.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    optimizedPrompt += `Current Date & Time: ${dateStr}, ore ${timeStr}\n\n---\n\n`;

    // Add user profile if enabled
    if (contextSettings.includeUserProfile && promptData.userProfile) {
      optimizedPrompt += 'User Profile & Goals:\n';
      if (promptData.userProfile.calories) optimizedPrompt += `Daily Calories: ${promptData.userProfile.calories}\n`;
      if (promptData.userProfile.protein) optimizedPrompt += `Protein: ${promptData.userProfile.protein}\n`;
      if (promptData.userProfile.carbs) optimizedPrompt += `Carbs: ${promptData.userProfile.carbs}\n`;
      if (promptData.userProfile.fats) optimizedPrompt += `Fats: ${promptData.userProfile.fats}\n`;
      if (promptData.userProfile.goal) optimizedPrompt += `Goal: ${promptData.userProfile.goal}\n`;
      if (promptData.userProfile.notes) optimizedPrompt += `Notes: ${promptData.userProfile.notes}\n`;
      optimizedPrompt += '\n---\n\n';
    }

    // Add meal history if enabled
    if (contextSettings.includeMealHistory && promptData.mealHistory && promptData.mealHistory.length > 0) {
      optimizedPrompt += 'Meal History (Last 7 Days):\n';
      promptData.mealHistory.slice(0, 10).forEach((meal: any) => {
        optimizedPrompt += `${meal.date} ${meal.time} - ${meal.type}: ${meal.food}`;
        if (meal.calories) optimizedPrompt += ` (${meal.calories} kcal)`;
        if (meal.notes) optimizedPrompt += ` - ${meal.notes}`;
        optimizedPrompt += '\n';
      });
      optimizedPrompt += '\n---\n\n';
    }

    // Add sheet data if enabled
    if (contextSettings.includeSheetData && promptData.sheetData) {
      optimizedPrompt += 'Google Sheets Database:\n\n';
      if (Array.isArray(promptData.sheetData)) {
        promptData.sheetData.forEach((sheet: any) => {
          optimizedPrompt += `\n=== ${sheet.sheet} (${sheet.rows} rows) ===\n`;
          if (sheet.data && sheet.data.length > 0) {
            const rowsToShow = Math.min(sheet.data.length, contextSettings.maxSheetRows);
            sheet.data.slice(0, rowsToShow).forEach((row: string[]) => {
              optimizedPrompt += row.join(' | ') + '\n';
            });
            if (sheet.data.length > contextSettings.maxSheetRows) {
              optimizedPrompt += `... and ${sheet.data.length - contextSettings.maxSheetRows} more rows\n`;
            }
          }
          optimizedPrompt += '\n';
        });
      }
      optimizedPrompt += '---\n\n';
    }

    // Add notion data if enabled
    if (contextSettings.includeNotionData && promptData.notionData && promptData.notionData.length > 0) {
      optimizedPrompt += 'My Notes:\n\n';
      const pagesToShow = Math.min(promptData.notionData.length, contextSettings.maxNotionPages);
      promptData.notionData.slice(0, pagesToShow).forEach((note: any) => {
        optimizedPrompt += `[${note.title}]\n${note.content}\n\n`;
      });
      if (promptData.notionData.length > contextSettings.maxNotionPages) {
        optimizedPrompt += `... and ${promptData.notionData.length - contextSettings.maxNotionPages} more pages\n\n`;
      }
      optimizedPrompt += '---\n\n';
    }

    return optimizedPrompt;
  };

  const optimizedPrompt = generateOptimizedPrompt();
  const optimizedSize = optimizedPrompt.length;
  const sizeReduction = ((totalSize - optimizedSize) / totalSize * 100).toFixed(1);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">🔍 Prompt Debug & Control</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-700 rounded p-3">
                <div className="text-gray-400 text-sm">Total Size</div>
                <div className="text-white font-bold">{totalSize.toLocaleString()} chars</div>
                <div className="text-xs text-gray-400">~{Math.round(totalSize / 4)} tokens</div>
              </div>
              <div className="bg-gray-700 rounded p-3">
                <div className="text-gray-400 text-sm">System Prompt</div>
                <div className="text-white font-bold">{systemPromptSize.toLocaleString()}</div>
                <div className="text-xs text-gray-400">{(systemPromptSize / totalSize * 100).toFixed(1)}%</div>
              </div>
              <div className="bg-gray-700 rounded p-3">
                <div className="text-gray-400 text-sm">Conversation</div>
                <div className="text-white font-bold">{conversationSize.toLocaleString()}</div>
                <div className="text-xs text-gray-400">{promptData.conversationHistory.length} msgs</div>
              </div>
              <div className="bg-gray-700 rounded p-3">
                <div className="text-gray-400 text-sm">Message</div>
                <div className="text-white font-bold">{messageSize.toLocaleString()}</div>
                <div className="text-xs text-gray-400">Current msg</div>
              </div>
            </div>

            {/* Context Settings */}
            <div className="bg-gray-700 rounded p-4">
              <h4 className="text-white font-semibold mb-3">Context Control</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-white">
                    <input
                      type="checkbox"
                      checked={contextSettings.includeSheetData}
                      onChange={(e) => setContextSettings(prev => ({ ...prev, includeSheetData: e.target.checked }))}
                      className="form-checkbox"
                    />
                    Include Google Sheets ({promptData.sheetData ? Array.isArray(promptData.sheetData) ? promptData.sheetData.length : 1 : 0} sheets)
                  </label>
                  {contextSettings.includeSheetData && (
                    <div className="ml-6">
                      <label className="text-gray-300 text-sm">
                        Max rows per sheet: 
                        <input
                          type="number"
                          value={contextSettings.maxSheetRows}
                          onChange={(e) => setContextSettings(prev => ({ ...prev, maxSheetRows: parseInt(e.target.value) || 0 }))}
                          className="ml-2 w-20 px-2 py-1 bg-gray-600 rounded text-white"
                          min="1"
                          max="1000"
                        />
                      </label>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-white">
                    <input
                      type="checkbox"
                      checked={contextSettings.includeNotionData}
                      onChange={(e) => setContextSettings(prev => ({ ...prev, includeNotionData: e.target.checked }))}
                      className="form-checkbox"
                    />
                    Include Notion Pages ({promptData.notionData?.length || 0} pages)
                  </label>
                  {contextSettings.includeNotionData && (
                    <div className="ml-6">
                      <label className="text-gray-300 text-sm">
                        Max pages: 
                        <input
                          type="number"
                          value={contextSettings.maxNotionPages}
                          onChange={(e) => setContextSettings(prev => ({ ...prev, maxNotionPages: parseInt(e.target.value) || 0 }))}
                          className="ml-2 w-20 px-2 py-1 bg-gray-600 rounded text-white"
                          min="1"
                          max="100"
                        />
                      </label>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-white">
                    <input
                      type="checkbox"
                      checked={contextSettings.includeUserProfile}
                      onChange={(e) => setContextSettings(prev => ({ ...prev, includeUserProfile: e.target.checked }))}
                      className="form-checkbox"
                    />
                    Include User Profile
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-white">
                    <input
                      type="checkbox"
                      checked={contextSettings.includeMealHistory}
                      onChange={(e) => setContextSettings(prev => ({ ...prev, includeMealHistory: e.target.checked }))}
                      className="form-checkbox"
                    />
                    Include Meal History ({promptData.mealHistory?.length || 0} meals)
                  </label>
                </div>
              </div>
            </div>

            {/* Optimization Preview */}
            <div className="bg-gray-700 rounded p-4">
              <h4 className="text-white font-semibold mb-2">Optimization Preview</h4>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white">Optimized Size: {optimizedSize.toLocaleString()} chars</div>
                  <div className="text-green-400">Size Reduction: {sizeReduction}%</div>
                  <div className="text-xs text-gray-400">~{Math.round(optimizedSize / 4)} tokens</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${optimizedSize < 48000 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {optimizedSize < 48000 ? '✅ Groq Compatible' : '⚠️ Still Too Large'}
                  </div>
                  <div className="text-xs text-gray-400">Max: ~48,000 chars (12K tokens)</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-gray-600">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'overview' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'system' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400'
            }`}
          >
            System Prompt ({systemPromptSize})
          </button>
          <button
            onClick={() => setActiveTab('conversation')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'conversation' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400'
            }`}
          >
            Conversation ({conversationSize})
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'data' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400'
            }`}
          >
            Data Sources
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'system' && (
            <div className="h-full overflow-auto">
              <textarea
                readOnly
                value={promptData.systemPrompt}
                className="w-full h-full bg-gray-900 text-gray-300 p-4 font-mono text-sm resize-none"
              />
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="h-full overflow-auto">
              <textarea
                readOnly
                value={optimizedPrompt}
                className="w-full h-full bg-gray-900 text-gray-300 p-4 font-mono text-sm resize-none"
              />
            </div>
          )}

          {activeTab === 'conversation' && (
            <div className="h-full overflow-auto bg-gray-900 p-4">
              {promptData.conversationHistory.map((msg: any, index: number) => (
                <div key={index} className="mb-3">
                  <div className={`font-semibold ${msg.role === 'user' ? 'text-blue-400' : 'text-green-400'}`}>
                    {msg.role}:
                  </div>
                  <div className="text-gray-300 text-sm">{msg.content}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'data' && (
            <div className="h-full overflow-auto bg-gray-900 p-4 space-y-4">
              <div>
                <h4 className="text-white font-semibold mb-2">Google Sheets ({Array.isArray(promptData.sheetData) ? promptData.sheetData.length : 0} sheets)</h4>
                {Array.isArray(promptData.sheetData) && promptData.sheetData.map((sheet: any, index: number) => (
                  <div key={index} className="mb-2 text-gray-300">
                    <div className="font-medium">{sheet.sheet}: {sheet.rows} rows</div>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-white font-semibold mb-2">Notion Pages ({promptData.notionData?.length || 0} pages)</h4>
                {promptData.notionData?.map((page: any, index: number) => (
                  <div key={index} className="mb-2 text-gray-300">
                    <div className="font-medium">{page.title}: {page.content?.length || 0} chars</div>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-white font-semibold mb-2">User Profile</h4>
                <pre className="text-gray-300 text-sm">{JSON.stringify(promptData.userProfile, null, 2)}</pre>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-2">Meal History ({promptData.mealHistory?.length || 0} meals)</h4>
                {promptData.mealHistory?.map((meal: any, index: number) => (
                  <div key={index} className="mb-1 text-gray-300 text-sm">
                    {meal.date} {meal.type}: {meal.food?.substring(0, 50)}...
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-600">
          <button
            onClick={() => {
              navigator.clipboard.writeText(optimizedPrompt);
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
          >
            Copy Optimized
          </button>
          <button
            onClick={() => {
              onPromptUpdate({
                ...promptData,
                systemPrompt: optimizedPrompt
              });
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
          >
            Apply & Send
          </button>
        </div>
      </div>
    </div>
  );
}
