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
}

// Separate component for individual messages to prevent re-renders
const MessageItem = React.memo(({ message, index }: MessageItemProps) => (
  <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
    <div className={`max-w-[80%] px-4 py-2 rounded-lg ${message.role === 'user'
        ? 'bg-blue-600 text-white'
        : 'bg-gray-700 text-gray-100 prose-chat'
      }`}>
      {message.role === 'assistant' ? (
        <ReactMarkdown>
          {message.content}
        </ReactMarkdown>
      ) : (
        message.content
      )}
    </div>
  </div>
));

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
}

export default function ChatInterface({ selectedContexts, notes, aiModel, userProfile, sheetData, mealHistory, notionPages, workspacePrompt, workspaceId }: Props) {
  const [messages, setMessages] = useState<{ [key: string]: Message[] }>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Memoize current messages to avoid recalculation on every render
  const currentMessages = useMemo(() => messages[workspaceId] || [], [messages, workspaceId]);

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

    const userMessage = { role: 'user' as const, content: input };
    const updatedMessages = [...currentMessages, userMessage];
    setMessages({ ...messages, [workspaceId]: updatedMessages });
    setInput('');
    setLoading(true);

    // Add empty assistant message
    const assistantIndex = updatedMessages.length;
    setMessages({ ...messages, [workspaceId]: [...updatedMessages, { role: 'assistant', content: '' }] });

    const contextData = notes.filter(n => selectedContexts.includes(n.id));
    let sheetContext = selectedContexts.includes('sheet') ? sheetData : null;
    let notionContext = notionPages || [];

    let fullText = '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          context: contextData,
          sheetData: sheetContext,
          notionData: notionContext,
          userProfile: userProfile,
          mealHistory: mealHistory,
          workspacePrompt: workspacePrompt,
          conversationHistory: currentMessages.slice(-6),
          aiModel: aiModel,
          stream: true
        }),
        signal: controller.signal
      });

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
    } catch (error: any) {
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
          newMessages[assistantIndex] = { role: 'assistant', content: 'Error: Could not get response' };
          return { ...prev, [workspaceId]: newMessages };
        });
      }
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  }, [input, loading, currentMessages, messages, workspaceId, notes, selectedContexts, sheetData, notionPages, userProfile, mealHistory, workspacePrompt, aiModel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
        {currentMessages.map((msg, i) => (
          <MessageItem key={`${workspaceId}-${i}`} message={msg} index={i} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 text-gray-100 px-4 py-2 rounded-lg flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
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

      <div className="border-t border-gray-700 bg-gray-800 p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question... (Shift+Enter for newline)"
            className="flex-1 px-4 py-2 border border-gray-600 bg-gray-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg disabled:bg-gray-600 hover:bg-blue-700"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
