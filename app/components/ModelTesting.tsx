'use client';

import { useState, useRef, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import { MODELS } from '../lib/models';

interface ModelChat {
  modelId: string;
  modelName: string;
  messages: any[];
  isLoading: boolean;
  error: string | null;
}

interface Props {
  notes: { id: string, title: string, content: string }[];
  userProfile: any;
  sheetData: any;
  mealHistory: any[];
  notionPages: any[];
}

export default function ModelTesting({ notes, userProfile, sheetData, mealHistory, notionPages }: Props) {
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [modelChats, setModelChats] = useState<{ [key: string]: ModelChat }>({});
  const [currentMessage, setCurrentMessage] = useState('');
  const [isSendingAll, setIsSendingAll] = useState(false);
  const chatEndRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Initialize selected models with first 5 models
  useEffect(() => {
    const firstFive = MODELS.slice(0, 5).map(m => m.id);
    setSelectedModels(firstFive);
    
    const initialChats: { [key: string]: ModelChat } = {};
    firstFive.forEach(modelId => {
      const model = MODELS.find(m => m.id === modelId);
      if (model) {
        initialChats[modelId] = {
          modelId,
          modelName: model.name,
          messages: [],
          isLoading: false,
          error: null
        };
      }
    });
    setModelChats(initialChats);
  }, []);

  const toggleModel = (modelId: string) => {
    setSelectedModels(prev => {
      const newSelection = prev.includes(modelId) 
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId];
      
      // Update model chats
      updateModelChats(newSelection);
      
      return newSelection;
    });
  };

  const updateModelChats = (newSelection: string[]) => {
    setModelChats(prevChats => {
      const newChats = { ...prevChats };
      
      // Add new models
      newSelection.forEach(modelId => {
        if (!newChats[modelId]) {
          const model = MODELS.find(m => m.id === modelId);
          if (model) {
            newChats[modelId] = {
              modelId,
              modelName: model.name,
              messages: [],
              isLoading: false,
              error: null
            };
          }
        }
      });
      
      // Remove deselected models
      Object.keys(newChats).forEach(modelId => {
        if (!newSelection.includes(modelId)) {
          delete newChats[modelId];
        }
      });
      
      return newChats;
    });
  };

  const sendMessageToAll = async () => {
    if (!currentMessage.trim()) return;
    
    setIsSendingAll(true);
    const message = currentMessage;
    setCurrentMessage('');
    
    // Add user message to all selected chats
    const userMessage = { role: 'user' as const, content: message };
    
    setModelChats(prevChats => {
      const newChats = { ...prevChats };
      selectedModels.forEach(modelId => {
        if (newChats[modelId]) {
          newChats[modelId] = {
            ...newChats[modelId],
            messages: [...newChats[modelId].messages, userMessage],
            isLoading: true,
            error: null
          };
        }
      });
      return newChats;
    });

    // Send to all models simultaneously
    const promises = selectedModels.map(async (modelId) => {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            aiModel: modelId,
            conversationHistory: [{ role: 'user', content: message }],
            context: [],
            sheetData: null,
            notionData: [],
            userProfile: null,
            mealHistory: [],
            workspacePrompt: 'You are a helpful AI assistant. Respond to the user\'s message clearly and concisely.',
            stream: false,
            calendarEvents: null,
            nutrientEntries: null
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.response || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        setModelChats(prevChats => {
          const newChats = { ...prevChats };
          if (newChats[modelId]) {
            newChats[modelId] = {
              ...newChats[modelId],
              messages: [...newChats[modelId].messages, { role: 'assistant', content: data.response }],
              isLoading: false,
              error: null
            };
          }
          return newChats;
        });

        // Scroll to bottom for this chat
        setTimeout(() => {
          if (chatEndRefs.current[modelId]) {
            chatEndRefs.current[modelId]?.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
        
      } catch (error) {
        console.error(`Error with model ${modelId}:`, error);
        setModelChats(prevChats => {
          const newChats = { ...prevChats };
          if (newChats[modelId]) {
            newChats[modelId] = {
              ...newChats[modelId],
              isLoading: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
          return newChats;
        });
      }
    });

    await Promise.all(promises);
    setIsSendingAll(false);
  };

  const clearAllChats = () => {
    setModelChats(prevChats => {
      const newChats: { [key: string]: ModelChat } = {};
      Object.keys(prevChats).forEach(modelId => {
        newChats[modelId] = {
          ...prevChats[modelId],
          messages: [],
          isLoading: false,
          error: null
        };
      });
      return newChats;
    });
  };

  const selectAllModels = () => {
    const allModelIds = MODELS.map(m => m.id);
    setSelectedModels(allModelIds);
    updateModelChats(allModelIds);
  };

  const clearSelection = () => {
    setSelectedModels([]);
    updateModelChats([]);
  };

  const clearChat = (modelId: string) => {
    setModelChats(prevChats => ({
      ...prevChats,
      [modelId]: {
        ...prevChats[modelId],
        messages: [],
        isLoading: false,
        error: null
      }
    }));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Model Selection */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="mb-3">
          <h3 className="text-sm font-medium text-white mb-2">Select Models to Test:</h3>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {MODELS.map(model => (
              <button
                key={model.id}
                onClick={() => toggleModel(model.id)}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  selectedModels.includes(model.id)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {model.name}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={selectAllModels}
            className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
          >
            Select All
          </button>
          <button
            onClick={clearSelection}
            className="text-xs bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
          >
            Clear Selection
          </button>
          <button
            onClick={clearAllChats}
            className="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
          >
            Clear All Chats
          </button>
          <span className="text-xs text-gray-400">
            {selectedModels.length} models selected
          </span>
        </div>
      </div>

      {/* Chat Input */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessageToAll()}
            placeholder="Type message to send to all selected models..."
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400"
            disabled={isSendingAll || selectedModels.length === 0}
          />
          <button
            onClick={sendMessageToAll}
            disabled={isSendingAll || selectedModels.length === 0 || !currentMessage.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {isSendingAll ? 'Sending...' : 'Send to All'}
          </button>
        </div>
      </div>

      {/* Chat Containers */}
      <div className="flex-1 overflow-x-auto overflow-y-auto bg-gray-900">
        <div className="flex gap-4 p-4 min-w-max" style={{ height: 'fit-content' }}>
          {selectedModels.map(modelId => {
            const chat = modelChats[modelId];
            if (!chat) return null;
            
            return (
              <div
                key={modelId}
                className="flex-shrink-0 w-80 bg-gray-800 rounded-lg border border-gray-700 flex flex-col"
                style={{ height: '600px' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-3 border-b border-gray-700">
                  <h4 className="text-sm font-medium text-white truncate">{chat.modelName}</h4>
                  <button
                    onClick={() => clearChat(modelId)}
                    className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded hover:bg-gray-600"
                  >
                    Clear
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {chat.messages.length === 0 && !chat.isLoading && (
                    <div className="text-center text-gray-500 text-sm mt-8">
                      No messages yet
                    </div>
                  )}
                  
                  {chat.messages.map((message, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-sm ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white ml-4'
                          : 'bg-gray-700 text-gray-100 mr-4'
                      }`}
                    >
                      {message.content}
                    </div>
                  ))}

                  {chat.isLoading && (
                    <div className="text-center text-gray-400 text-sm">
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      <span className="ml-2">Thinking...</span>
                    </div>
                  )}

                  {chat.error && (
                    <div className="bg-red-900/50 border border-red-600 text-red-200 p-2 rounded text-sm">
                      Error: {chat.error}
                    </div>
                  )}

                  <div ref={el => { chatEndRefs.current[modelId] = el; }} />
                </div>
              </div>
            );
          })}
          
          {selectedModels.length === 0 && (
            <div className="flex items-center justify-center w-full h-64">
              <p className="text-gray-500">Select models above to start testing</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
