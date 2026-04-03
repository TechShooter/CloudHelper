'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface MessageItemProps {
  message: Message;
  index: number;
  onDelete: (index: number) => void;
  openMenuIndex: number | null;
  setOpenMenuIndex: (index: number | null) => void;
}

// Separate component for individual messages to prevent re-renders
const MessageItem = React.memo(({ message, index, onDelete, openMenuIndex, setOpenMenuIndex }: MessageItemProps) => {
  const isMenuOpen = openMenuIndex === index;

  return (
    <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
      <div className={`max-w-[85%] sm:max-w-[80%] px-3 sm:px-4 py-2 rounded-lg relative ${message.role === 'user'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-700 text-gray-100 prose-chat'
        }`}>
        {!isMenuOpen ? (
          <button
            onClick={() => setOpenMenuIndex(index)}
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-600 hover:bg-gray-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold"
            title="More options"
          >
            ...
          </button>
        ) : (
          <div className="absolute top-1 right-1 flex gap-1 bg-gray-800 rounded-lg p-1 shadow-lg">
            <button
              onClick={() => setOpenMenuIndex(null)}
              className="bg-gray-600 hover:bg-gray-700 text-white rounded px-2 py-1 text-xs font-medium"
              title="Cancel"
            >
              Cancel
            </button>
            <button
              onClick={() => onDelete(index)}
              className="bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1 text-xs font-medium"
              title="Delete message"
            >
              Delete
            </button>
          </div>
        )}
        <div className={`pr-8 ${isMenuOpen ? 'pr-20' : ''}`}>
          {message.role === 'assistant' ? (
            <ReactMarkdown>
              {message.content}
            </ReactMarkdown>
          ) : (
            message.content
          )}
        </div>
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

interface Props {
  selectedContexts: string[];
  notes: { id: string, title: string, content: string }[];
  aiModel: 'gemini-flash' | 'gemini-2.5' | 'gemini-2.5-pro' | 'groq';
  userProfile: any;
  sheetData: any;
  mealHistory: any[];
  notionPages: any[];
  workspacePrompt?: string;
  workspaceId: string;
  calendarEvents?: any[];
  nutrientEntries?: any[];
}

export default function ChatInterface({ selectedContexts, notes, aiModel, userProfile, sheetData, mealHistory, notionPages, workspacePrompt, workspaceId, calendarEvents, nutrientEntries }: Props) {
  const [messages, setMessages] = useState<{ [key: string]: Message[] }>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<'connecting' | 'thinking' | 'responding' | 'error'>('connecting');
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const [visibleMessageCount, setVisibleMessageCount] = useState(50);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any[]>([]);
  const [aiUsage, setAiUsage] = useState({
    tokensUsed: 0,
    requestsCount: 0,
    lastRequestTime: null as Date | null
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Memoize current messages to avoid recalculation on every render
  const currentMessages = useMemo(() => messages[workspaceId] || [], [messages, workspaceId]);
  const visibleMessages = useMemo(() => {
    const total = currentMessages.length;
    if (total <= visibleMessageCount) return currentMessages;
    return currentMessages.slice(total - visibleMessageCount);
  }, [currentMessages, visibleMessageCount]);

  // Debounced save to localStorage
  const saveMessages = useCallback((messagesToSave: { [key: string]: Message[] }) => {
    if (Object.keys(messagesToSave).length > 0) {
      localStorage.setItem('chatMessages', JSON.stringify(messagesToSave));
    }
  }, []);

  // Load messages from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('chatMessages');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    }
  }, []);

  // Save messages to localStorage with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveMessages(messages);
    }, 500); // Debounce 500ms

    return () => clearTimeout(timeoutId);
  }, [messages, saveMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  // Handle scroll to load more messages
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop === 0 && visibleMessageCount < currentMessages.length) {
      const prevHeight = target.scrollHeight;
      setVisibleMessageCount(prev => Math.min(prev + 30, currentMessages.length));
      
      setTimeout(() => {
        const newHeight = target.scrollHeight;
        target.scrollTop = newHeight - prevHeight;
      }, 0);
    }
  }, [visibleMessageCount, currentMessages.length]);

  const stopResponse = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setLoading(false);
    }
  }, [abortController]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;

    const controller = new AbortController();
    setAbortController(controller);
    setLoading(true);
    setLoadingStatus('connecting');

    const userMessage = { role: 'user' as const, content: input };
    const updatedMessages = [...currentMessages, userMessage];
    setMessages({ ...messages, [workspaceId]: updatedMessages });
    setInput('');

    // Add empty assistant message
    const assistantIndex = updatedMessages.length;
    setMessages({ ...messages, [workspaceId]: [...updatedMessages, { role: 'assistant', content: '' }] });

    const contextData = notes.filter(n => selectedContexts.includes(n.id));
    let sheetContext = selectedContexts.includes('sheet') ? sheetData : null;
    let notionContext = notionPages || [];

    let fullText = '';
    const requestStartTime = new Date();
    
    // Prepare debug info
    const debugPayload = {
      message: input,
      context: contextData,
      sheetData: sheetContext,
      notionData: notionContext,
      userProfile: userProfile,
      mealHistory: mealHistory,
      workspacePrompt: workspacePrompt,
      conversationHistory: currentMessages.slice(-6),
      aiModel: aiModel,
      stream: true,
      calendarEvents: calendarEvents,
      nutrientEntries: nutrientEntries,
      timestamp: requestStartTime.toISOString()
    };

    try {
      setLoadingStatus('thinking');
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(debugPayload),
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      setLoadingStatus('responding');
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          if (controller.signal.aborted) break;
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          fullText += text;

          setMessages(prev => {
            const workspaceMessages = prev[workspaceId] || [];
            const newMessages = [...workspaceMessages];
            newMessages[assistantIndex] = { role: 'assistant', content: fullText };
            return { ...prev, [workspaceId]: newMessages };
          });
        }
      } else {
        const data = await res.json();
        fullText = data.response;
        setMessages(prev => {
          const workspaceMessages = prev[workspaceId] || [];
          const newMessages = [...workspaceMessages];
          newMessages[assistantIndex] = { role: 'assistant', content: fullText };
          return { ...prev, [workspaceId]: newMessages };
        });
      }

      // Update AI usage tracking
      const requestEndTime = new Date();
      setAiUsage(prev => ({
        tokensUsed: prev.tokensUsed + Math.floor(fullText.length / 4), // Rough estimate
        requestsCount: prev.requestsCount + 1,
        lastRequestTime: requestEndTime
      }));

      // Store debug info
      setDebugInfo(prev => [...prev.slice(-9), {
        ...debugPayload,
        response: fullText,
        duration: requestEndTime.getTime() - requestStartTime.getTime(),
        success: true
      }]);

    } catch (error: any) {
      setLoadingStatus('error');
      
      // Store error debug info
      setDebugInfo(prev => [...prev.slice(-9), {
        ...debugPayload,
        error: error.message,
        duration: new Date().getTime() - requestStartTime.getTime(),
        success: false
      }]);
      
      if (error.name === 'AbortError') {
        setMessages(prev => {
          const workspaceMessages = prev[workspaceId] || [];
          const newMessages = [...workspaceMessages];
          newMessages[assistantIndex] = { role: 'assistant', content: fullText + (fullText ? '\n\n*(stopped)*' : '*(stopped)*') };
          return { ...prev, [workspaceId]: newMessages };
        });
      } else {
        setMessages(prev => {
          const workspaceMessages = prev[workspaceId] || [];
          const newMessages = [...workspaceMessages];
          newMessages[assistantIndex] = { role: 'assistant', content: 'Error: Could not get response. Please try again.' };
          return { ...prev, [workspaceId]: newMessages };
        });
      }
    } finally {
      setLoading(false);
      setAbortController(null);
      setLoadingStatus('connecting');
    }
  }, [input, loading, currentMessages, messages, workspaceId, notes, selectedContexts, sheetData, notionPages, userProfile, mealHistory, workspacePrompt, aiModel, calendarEvents, nutrientEntries]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const deleteMessage = useCallback((messageIndex: number) => {
    setMessages(prev => {
      const workspaceMessages = prev[workspaceId] || [];
      const newMessages = workspaceMessages.filter((_, index) => index !== messageIndex);
      return { ...prev, [workspaceId]: newMessages };
    });
    setOpenMenuIndex(null);
  }, [workspaceId]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* AI Usage Indicator */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <div className="text-gray-400">
            🤖 AI Usage: <span className="text-white font-medium">{aiUsage.requestsCount}</span> requests
          </div>
          <div className="text-gray-400">
            📊 Tokens: <span className="text-white font-medium">{aiUsage.tokensUsed}</span>
          </div>
          {aiUsage.lastRequestTime && (
            <div className="text-gray-400">
              ⏰ Last: <span className="text-white font-medium">{aiUsage.lastRequestTime.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDebugInfo(!showDebugInfo)}
            className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 text-xs"
          >
            {showDebugInfo ? 'Hide Debug' : '🔍 Debug'}
          </button>
        </div>
      </div>

      {/* Debug Window */}
      {showDebugInfo && (
        <div className="bg-gray-800 border-b border-gray-700 p-4 max-h-64 overflow-y-auto">
          <h3 className="text-sm font-semibold text-white mb-3">🔍 Debug: Last 10 Requests</h3>
          <div className="space-y-3">
            {debugInfo.length === 0 ? (
              <div className="text-gray-500 text-sm">No debug data yet. Send a message to see debug info.</div>
            ) : (
              debugInfo.map((debug, index) => (
                <div key={index} className="bg-gray-700 rounded p-3 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400">
                      {new Date(debug.timestamp).toLocaleString()} - {debug.aiModel}
                    </span>
                    <span className={`px-2 py-1 rounded ${debug.success ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                      {debug.success ? 'Success' : 'Error'}
                    </span>
                  </div>
                  <div className="mb-2">
                    <strong>User Message:</strong> {debug.message}
                  </div>
                  <div className="mb-2">
                    <strong>Context Size:</strong> {JSON.stringify(debug.context || []).length} chars | 
                    <strong> Sheet Data:</strong> {debug.sheetData ? 'Yes' : 'No'} | 
                    <strong> Notion:</strong> {debug.notionData?.length || 0} pages
                  </div>
                  <div className="mb-2">
                    <strong>Workspace Prompt:</strong> {debug.workspacePrompt ? 'Yes' : 'No'}
                  </div>
                  <div className="mb-2">
                    <strong>Duration:</strong> {debug.duration}ms
                  </div>
                  {debug.response && (
                    <div className="mb-2">
                      <strong>Response Preview:</strong> {debug.response.substring(0, 200)}...
                    </div>
                  )}
                  {debug.error && (
                    <div className="text-red-400">
                      <strong>Error:</strong> {debug.error}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(debug, null, 2));
                    }}
                    className="mt-2 bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                  >
                    📋 Copy JSON
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-0 p-2 sm:p-4 space-y-3 sm:space-y-4 bg-gray-900 h-full"
      >
        {currentMessages.length > visibleMessageCount && (
          <div className="text-center text-gray-500 text-sm py-2">
            Showing {visibleMessageCount} of {currentMessages.length} messages. Scroll up to load more.
          </div>
        )}
        {visibleMessages.map((msg, i) => {
          const actualIndex = currentMessages.length - visibleMessages.length + i;
          return (
            <MessageItem 
              key={`${workspaceId}-${actualIndex}`} 
              message={msg} 
              index={actualIndex} 
              onDelete={deleteMessage} 
              openMenuIndex={openMenuIndex}
              setOpenMenuIndex={setOpenMenuIndex}
            />
          );
        })}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 text-gray-100 px-4 py-2 rounded-lg flex items-center gap-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
              <div className="text-sm">
                {loadingStatus === 'connecting' && 'Connecting to AI...'}
                {loadingStatus === 'thinking' && 'AI is thinking...'}
                {loadingStatus === 'responding' && 'Generating response...'}
                {loadingStatus === 'error' && 'Something went wrong...'}
              </div>
              <button
                onClick={stopResponse}
                className="bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700"
              >
                Stop
              </button>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-700 bg-gray-800 p-3 sm:p-4">
        <div className="flex gap-2 flex-col sm:flex-row">
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question... (Shift+Enter for newline)"
            className="flex-1 px-3 sm:px-4 py-2 border border-gray-600 bg-gray-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-20 sm:h-24 text-sm sm:text-base"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg disabled:bg-gray-600 hover:bg-blue-700 w-full sm:w-auto mt-2 sm:mt-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
