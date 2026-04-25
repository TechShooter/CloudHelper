'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import ChatHeader, { ChatHeaderRef } from './ChatHeader';
import { createClient } from '@/utils/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Separate component for individual messages to prevent re-renders
const MessageItem = React.memo(({ message, onDelete, index }: { message: Message; onDelete: (index: number) => void; index: number }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Guard clause to prevent crash if message becomes undefined during deletion
  if (!message) return null;

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
  sheetData: any;
  notionPages: any[];
  workspacePrompt?: string;
  workspaceId: string;
  calendarEvents?: any[];
  nutrientEntries?: any[];
}

export default function ChatInterface({ selectedContexts, notes, aiModel, sheetData, notionPages, workspacePrompt, workspaceId, calendarEvents, nutrientEntries }: Props) {
  const chatHeaderRef = useRef<ChatHeaderRef>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<'connecting' | 'thinking' | 'responding' | 'error'>('connecting');
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [visibleMessageCount, setVisibleMessageCount] = useState(50);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNewlyCreatedChatRef = useRef(false);

  // Memoize current messages to avoid recalculation on every render
  const currentMessages = messages;
  const visibleMessages = useMemo(() => {
    const total = currentMessages.length;
    if (total <= visibleMessageCount) return currentMessages;
    return currentMessages.slice(total - visibleMessageCount);
  }, [currentMessages, visibleMessageCount]);

  // Clear chat state when workspaceId changes
  useEffect(() => {
    setActiveChatId(null);
    setMessages([]);
    setInput('');
  }, [workspaceId]);

  // Abort streaming response when activeChatId changes
  useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [activeChatId]);

  // Load messages from Supabase when activeChatId changes
  useEffect(() => {
    const loadMessages = async () => {
      if (!activeChatId) {
        console.log('No activeChatId, skipping load');
        return;
      }
      // Skip loading if this is a newly created chat (messages are already in state)
      if (isNewlyCreatedChatRef.current) {
        console.log('Newly created chat, skipping load from Supabase');
        isNewlyCreatedChatRef.current = false;
        return;
      }
      // Clear messages and load from Supabase when switching chats
      setMessages([]);
      setLoadingMessages(true);
      console.log('Loading messages for chatId:', activeChatId);
      try {
        const res = await fetch(`/api/chat-persistence?chatId=${activeChatId}`);
        console.log('Load response status:', res.status);
        if (res.ok) {
          const data = await res.json();
          console.log('Loaded messages:', data.messages?.length || 0);
          if (data.messages) {
            setMessages(data.messages);
          }
        } else {
          console.error('Failed to load messages, status:', res.status);
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [activeChatId]);

  // Save messages to Supabase with debounce (backup for non-streaming responses)
  useEffect(() => {
    if (!activeChatId) return;
    const timeoutId = setTimeout(async () => {
      console.log('Saving messages for chatId:', activeChatId, 'count:', messages.length);
      try {
        const res = await fetch('/api/chat-persistence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: activeChatId, messages })
        });
        console.log('Save response status:', res.status);
        if (!res.ok) {
          console.error('Failed to save messages, status:', res.status);
        }
      } catch (error) {
        console.error('Failed to save messages:', error);
      }
    }, 5000); // Increased to 5 seconds since server handles streaming persistence

    return () => clearTimeout(timeoutId);
  }, [messages, activeChatId]);

  useEffect(() => {
    if (!userScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentMessages, userScrolledUp]);

  // Handle scroll to load more messages and track user scroll position
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = target;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    // Track if user has scrolled up (not near bottom)
    setUserScrolledUp(!isNearBottom);

    // Load more messages when scrolling to top
    if (scrollTop === 0 && visibleMessageCount < currentMessages.length) {
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

    // Capture activeChatId at the start to prevent chat switching issues
    const currentActiveChatId = activeChatId;

    // Create a new chat if none is active
    let chatIdToUse = currentActiveChatId;
    let isNewChat = false;
    if (!chatIdToUse) {
      try {
        // Generate title from first message (first 50 characters)
        const title = input.trim().substring(0, 50) + (input.length > 50 ? '...' : '');
        const res = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId, title })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.chat) {
            chatIdToUse = data.chat.id;
            isNewChat = true;
            isNewlyCreatedChatRef.current = true;
            setActiveChatId(chatIdToUse);
            // Refresh chat header to show the new chat immediately
            chatHeaderRef.current?.refreshChats();
          }
        }
      } catch (error) {
        console.error('Failed to create chat:', error);
        return;
      }
    }

    if (!chatIdToUse) return;

    // Update chat title if it's the first message in the chat
    if (!isNewChat && currentMessages.length === 0) {
      try {
        const title = input.trim().substring(0, 50) + (input.length > 50 ? '...' : '');
        await fetch('/api/chats', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: chatIdToUse, title })
        });
        chatHeaderRef.current?.refreshChats();
      } catch (error) {
        console.error('Failed to update chat title:', error);
      }
    }

    const controller = new AbortController();
    setAbortController(controller);
    setLoading(true);
    setLoadingStatus('connecting');

    const userMessage = { role: 'user' as const, content: input };
    const updatedMessages = [...currentMessages, userMessage];
    
    // Add empty assistant message in the same update to prevent race condition
    const finalMessages: Message[] = [...updatedMessages, { role: 'assistant' as const, content: '' }];
    setMessages(finalMessages);
    setInput('');

    const assistantIndex = updatedMessages.length;

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
      workspacePrompt: workspacePrompt,
      conversationHistory: updatedMessages.slice(-6), // Use updatedMessages with the new user message
      aiModel: aiModel,
      chatId: chatIdToUse, // Pass chatId for server-side persistence
      stream: true,
      calendarEvents: calendarEvents
    };

    try {
      setLoadingStatus('thinking');

      // Get session token for Edge Function authentication
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No session token found');
      }

      // Call Supabase Edge Function for server-side streaming with persistence
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/chat-stream`
      
      const res = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(contextData),
        signal: controller.signal
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ response: `API Error: ${res.status}` }));
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[assistantIndex] = { role: 'assistant', content: errorData.response || errorData.error?.message || 'An error occurred while processing your request.' };
          return newMessages;
        });
        setLoading(false);
        setLoadingStatus('error');
        return;
      }

      setLoadingStatus('responding');
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      const isSSE = res.headers.get('content-type')?.includes('text/event-stream');

      if (reader) {
        let buffer = '';
        while (true) {
          if (controller.signal.aborted) break;
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          if (isSSE) {
            // Parse SSE format (Gemini or Groq)
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6);
                if (jsonStr === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(jsonStr);
                  // Try Edge Function format first (from Supabase Edge Function)
                  let textContent = parsed.content;
                  // Try Gemini format if Edge Function format not found
                  if (!textContent) {
                    textContent = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                  }
                  // Try Groq format if Gemini format not found
                  if (!textContent) {
                    textContent = parsed.choices?.[0]?.delta?.content;
                  }
                  if (textContent) {
                    fullText += textContent;
                    setMessages(prev => {
                      const newMessages = [...prev];
                      newMessages[assistantIndex] = { role: 'assistant', content: fullText };
                      return newMessages;
                    });
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          } else {
            // Plain text for Groq
            fullText += chunk;
            setMessages(prev => {
              const newMessages = [...prev];
              newMessages[assistantIndex] = { role: 'assistant', content: fullText };
              return newMessages;
            });
          }
        }

        // Check if response is empty after streaming
        if (!fullText || fullText.trim() === '') {
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[assistantIndex] = { role: 'assistant', content: 'No response from the AI model. This could be due to:\n• Invalid model name\n• API error or rate limit\n• Network issue\n\nPlease try again or use a different model.' };
            return newMessages;
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
          const newMessages = [...prev];
          newMessages[assistantIndex] = { role: 'assistant', content: fullText };
          return newMessages;
        });
      }

    } catch (error: any) {
      setLoadingStatus('error');
      
      if (error.name === 'AbortError') {
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[assistantIndex] = { role: 'assistant', content: fullText + (fullText ? '\n\n*(stopped)*' : '*(stopped)*') };
          return newMessages;
        });
      } else {
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[assistantIndex] = { role: 'assistant', content: 'Error: Could not get response. Please try again.' };
          return newMessages;
        });
      }
    } finally {
      setLoading(false);
      setAbortController(null);
      setLoadingStatus('connecting');
    }
  }, [input, loading, currentMessages, messages, workspaceId, notes, selectedContexts, sheetData, notionPages, workspacePrompt, aiModel, calendarEvents, nutrientEntries]);

  // Memoize delete handler to prevent re-renders
  const handleDeleteMessage = useCallback((index: number) => {
    setMessages(prev => prev.filter((_, idx) => idx !== index));
  }, []);

  // Handle chat selection from header
  const handleChatSelect = useCallback((chatId: string) => {
    setActiveChatId(chatId);
  }, []);

  // Handle new chat creation
  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    setMessages([]);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Chat Header */}
      <ChatHeader
        ref={chatHeaderRef}
        workspaceId={workspaceId}
        activeChatId={activeChatId}
        onChatSelect={handleChatSelect}
        onNewChat={handleNewChat}
      />
      
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-4 py-2 sm:py-4 space-y-3 sm:space-y-4 bg-gray-900 h-full"
      >
        {loadingMessages && (
          <div className="flex justify-center">
            <div className="bg-gray-700 text-gray-100 px-4 py-2 rounded-lg flex items-center gap-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
              <div className="text-sm">
                Loading messages...
              </div>
            </div>
          </div>
        )}
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

      <div className="border-t border-gray-700 bg-gray-800 px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex gap-2 flex-col sm:flex-row">
          <textarea
            id="chat-input"
            name="chat-input"
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
