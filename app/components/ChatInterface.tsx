'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Separate component for individual messages to prevent re-renders
const MessageItem = React.memo(({ message, onDelete, index }: { message: Message; onDelete: (index: number) => void; index: number }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Memoize the delete handler to prevent re-renders
  const handleDelete = React.useCallback(() => {
    onDelete(index);
  }, [onDelete, index]);

  // Copy message content
  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
      <div className={`max-w-[85%] sm:max-w-[80%] px-3 sm:px-4 py-2 rounded-lg relative ${message.role === 'user'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-700 text-gray-100 prose-chat'
        }`}>
        <div className="pr-16">
          {message.role === 'assistant' ? (
            <ReactMarkdown>
              {message.content}
            </ReactMarkdown>
          ) : (
            message.content
          )}
        </div>

        {/* Action buttons */}
        <div className="absolute top-1 right-1 flex gap-1">
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="text-gray-400 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs p-1 rounded hover:bg-gray-600 cursor-pointer"
            title="Copy message"
          >
            {copied ? 'Copied!' : '📋'}
          </button>

          {/* Delete button with confirmation */}
          {showDeleteConfirm ? (
            <div className="flex gap-1">
              <button
                onClick={handleDelete}
                className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 cursor-pointer"
                title="Confirm delete"
              >
                ✓
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="bg-gray-600 text-white px-2 py-1 rounded text-xs hover:bg-gray-700 cursor-pointer"
                title="Cancel"
              >
                ✗
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm p-1 rounded hover:bg-gray-600 cursor-pointer"
              title="Delete message"
            >
              🗑️
            </button>
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
  aiModel: string;
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
  const [visibleMessageCount, setVisibleMessageCount] = useState(50);
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
    e.preventDefault(); // Prevent unnecessary re-renders
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

    const contextNotes = notes.filter(n => selectedContexts.includes(n.id));
    let sheetContext = selectedContexts.includes('sheet') ? sheetData : null;
    // notionPages is already filtered by WorkspaceManager's getNotionPages()
    let notionContext = notionPages || [];

    console.log('=== CHAT CONTEXT DEBUG ===');
    console.log('selectedContexts:', selectedContexts);
    console.log('notionPages received:', notionPages?.length || 0);
    console.log('notionContext being sent:', notionContext.map((p: any) => ({ id: p.id, title: p.title, contentLength: p.content?.length || 0 })));

    let fullText = '';
    const requestStartTime = new Date();
    
    // Prepare context data - include the NEW message in conversationHistory
    const contextData = {
      notes: contextNotes,
      sheetData: sheetContext,
      notionData: notionContext,
      mealHistory: mealHistory,
      userProfile: userProfile,
      workspacePrompt: workspacePrompt,
      conversationHistory: updatedMessages.slice(-6), // Use updatedMessages with the new user message
      aiModel: aiModel,
      stream: true,
      calendarEvents: calendarEvents
    };

    try {
      setLoadingStatus('thinking');
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contextData),
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

        // Check if response is empty after streaming
        if (!fullText || fullText.trim() === '') {
          setMessages(prev => {
            const workspaceMessages = prev[workspaceId] || [];
            const newMessages = [...workspaceMessages];
            newMessages[assistantIndex] = { role: 'assistant', content: 'No response from the AI model. This could be due to:\n• Invalid model name\n• API error or rate limit\n• Network issue\n\nPlease try again or use a different model.' };
            return { ...prev, [workspaceId]: newMessages };
          });
        }
      } else {
        const data = await res.json();
        fullText = data.response;

        // Check if response is empty
        if (!fullText || fullText.trim() === '') {
          fullText = 'No response from the AI model. This could be due to:\n• Invalid model name\n• API error or rate limit\n• Network issue\n\nPlease try again or use a different model.';
        }

        setMessages(prev => {
          const workspaceMessages = prev[workspaceId] || [];
          const newMessages = [...workspaceMessages];
          newMessages[assistantIndex] = { role: 'assistant', content: fullText };
          return { ...prev, [workspaceId]: newMessages };
        });
      }

    } catch (error: any) {
      setLoadingStatus('error');
      
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

  // Memoize delete handler to prevent re-renders
  const handleDeleteMessage = useCallback((index: number) => {
    setMessages(prev => {
      const workspaceMessages = prev[workspaceId] || [];
      const newMessages = workspaceMessages.filter((_, idx) => idx !== index);
      return { ...prev, [workspaceId]: newMessages };
    });
  }, [workspaceId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
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
              onDelete={handleDeleteMessage}
              index={actualIndex}
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
