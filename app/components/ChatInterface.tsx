'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ChatHeader, { ChatHeaderRef } from './ChatHeader';
import { createClient } from '@/utils/supabase/client';
import { getApiKey } from '../lib/api-keys';
import { ingestFile, searchQuery, removeDocument, getStats } from '../lib/browser-rag';
import { saveChat, saveMessages, loadMessages } from '../lib/chat-storage';
import TermsOfService from './TermsOfService';

interface UploadedFile {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt' | 'md' | 'csv';
  status: 'parsing' | 'uploading' | 'indexing' | 'ready' | 'error';
  error?: string;
  charCount?: number;
  sourceId?: string;
  documentId?: string;
}

// Lightweight markdown parser (replaces heavy react-markdown)
function SimpleMarkdown({ content }: { content: string }) {
  // Simple formatting: code blocks, bold, italic, links
  const formatted = content
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-gray-800 p-2 rounded my-2 overflow-x-auto"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-800 px-1 rounded">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
  
  return <div dangerouslySetInnerHTML={{ __html: formatted }} />;
}

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
            <SimpleMarkdown content={message.content} />
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
  aiProvider?: string;
  sheetData: any;
  notionPages: any[];
  workspacePrompt?: string;
  workspaceId: string;
  calendarEvents?: any[];
  nutrientEntries?: any[];
}

export default function ChatInterface({ selectedContexts, notes, aiModel, aiProvider, sheetData, notionPages, workspacePrompt, workspaceId, calendarEvents, nutrientEntries }: Props) {
  const chatHeaderRef = useRef<ChatHeaderRef>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<'connecting' | 'thinking' | 'responding' | 'error'>('connecting');
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [visibleMessageCount, setVisibleMessageCount] = useState(50);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // Whether the deployer configured a chat key server-side. null = unknown
  // yet (treat as available so guests are never locked out while it loads).
  const [serverKeys, setServerKeys] = useState<{ gemini: boolean | null; groq: boolean | null }>({
    gemini: null,
    groq: null,
  });
  useEffect(() => {
    let active = true;
    fetch('/api/ai-key-status')
      .then((r) => r.json())
      .then((d) => {
        if (active) setServerKeys({ gemini: !!d?.gemini, groq: !!d?.groq });
      })
      .catch(() => {
        // Ignore: keep unknown (assume available).
      });
    return () => {
      active = false;
    };
  }, []);
  // A provider is usable when the user set their own key OR the server env has one.
  const geminiAvailable = !!getApiKey('gemini') || serverKeys.gemini !== false;
  const groqAvailable = !!getApiKey('groq') || serverKeys.groq !== false;
  const anyProviderAvailable = geminiAvailable || groqAvailable;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNewlyCreatedChatRef = useRef(false);
  const isGuestRef = useRef<boolean | null>(null);
  const isLoggedInRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedFilesRef = useRef(uploadedFiles);
  useEffect(() => {
    uploadedFilesRef.current = uploadedFiles;
  }, [uploadedFiles]);
  const hasIndexedDbChunksRef = useRef(false);
  const refreshGuestChunkStats = useCallback(() => {
    if (isGuestRef.current) {
      getStats().then((s) => { hasIndexedDbChunksRef.current = s.chunks > 0; }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      isLoggedInRef.current = !!session;
      isGuestRef.current = !session;
      refreshGuestChunkStats();
    });
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
      isLoggedInRef.current = !!user;
      isGuestRef.current = !user;
      refreshGuestChunkStats();
    }).catch(() => {
      setIsLoggedIn(false);
      isLoggedInRef.current = false;
      isGuestRef.current = true;
      refreshGuestChunkStats();
    });
    return () => subscription?.unsubscribe();
  }, [refreshGuestChunkStats]);

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
    setUploadedFiles([]);
  }, [workspaceId]);

  // Abort streaming response when activeChatId changes
  useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [activeChatId]);

  // Load messages from IndexedDB (and Supabase if logged in) when activeChatId changes
  useEffect(() => {
    const loadFromDB = async () => {
      if (!activeChatId) return;
      if (isNewlyCreatedChatRef.current) {
        isNewlyCreatedChatRef.current = false;
        return;
      }
      setMessages([]);
      setLoadingMessages(true);
      try {
        const msgs = await loadMessages(activeChatId);
        if (msgs.length > 0) {
          setMessages(msgs);
        } else if (isLoggedIn) {
          const res = await fetch(`/api/chat-persistence?chatId=${encodeURIComponent(activeChatId)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.messages && data.messages.length > 0) {
              setMessages(data.messages);
              saveMessages(activeChatId, data.messages);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setLoadingMessages(false);
      }
    };
    loadFromDB();
  }, [activeChatId, isLoggedIn]);

  // Save messages to IndexedDB with debounce, sync to Supabase if logged in
  useEffect(() => {
    if (!activeChatId || messages.length === 0) return;
    const timeoutId = setTimeout(async () => {
      try {
        await saveMessages(activeChatId, messages);
        if (isLoggedIn) {
          await fetch('/api/chat-persistence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: activeChatId, messages })
          });
        }
      } catch (error) {
        console.error('Failed to save messages:', error);
      }
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [messages, activeChatId, isLoggedIn]);

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
      chatIdToUse = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      isNewChat = true;
      isNewlyCreatedChatRef.current = true;
      const title = input.trim().substring(0, 50) + (input.length > 50 ? '...' : '');
      const now = new Date().toISOString();
      await saveChat({ id: chatIdToUse, workspaceId, title, createdAt: now, updatedAt: now });
      setActiveChatId(chatIdToUse);
      chatHeaderRef.current?.refreshChats();
    }

    if (!chatIdToUse) return;

    // Update chat title in IndexedDB if it's the first message
    if (isNewChat) {
      // Title already set above during creation
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

    // ===================================================================
    // Browser RAG: search indexed documents for relevant context (guests)
    // ===================================================================
    let ragContext: Array<{ sourceName: string; content: string; similarity: number }> | undefined;
    if (isGuestRef.current && (uploadedFilesRef.current.some((f) => f.status === 'ready') || hasIndexedDbChunksRef.current)) {
      const geminiKey = getApiKey('gemini');
      if (geminiKey && input.trim()) {
        try {
          const results = await searchQuery(input, geminiKey, 3);
          if (results.length > 0) {
            ragContext = results.map((r) => ({
              sourceName: r.chunk.enrichedContent.startsWith('Source: ')
                ? r.chunk.enrichedContent.split('\n')[0].replace('Source: ', '')
                : 'Uploaded document',
              content: r.chunk.content,
              similarity: r.similarity, // send raw for server formatting
            }));
          }
        } catch {
          // Browser RAG unavailable — silently continue
        }
      }
    }

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
      aiProvider: aiProvider || 'gemini',
      chatId: chatIdToUse, // Pass chatId for server-side persistence
      stream: true,
      calendarEvents: calendarEvents,
      ...(ragContext ? { ragContext } : {}),
    };

    try {
      setLoadingStatus('thinking');

      const geminiKey = getApiKey('gemini');
      const groqKey = getApiKey('groq');

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(geminiKey && { 'x-api-key-gemini': geminiKey }),
          ...(groqKey && { 'x-api-key-groq': groqKey }),
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
  }, [input, loading, currentMessages, messages, workspaceId, notes, selectedContexts, sheetData, notionPages, workspacePrompt, aiModel, aiProvider, calendarEvents, nutrientEntries]);

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

  // ===================================================================
  // File Upload Handler
  // ===================================================================
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      
      let fileType: UploadedFile['type'];
      if (ext === 'pdf') fileType = 'pdf';
      else if (ext === 'docx') fileType = 'docx';
      else if (ext === 'txt') fileType = 'txt';
      else if (ext === 'md') fileType = 'md';
      else if (ext === 'csv') fileType = 'csv';
      else continue; // Unsupported type

      const fileId = `file-${Date.now()}-${i}`;
      
      // Add file with "parsing" status
      setUploadedFiles(prev => [...prev, {
        id: fileId,
        name: file.name,
        type: fileType,
        status: 'parsing'
      }]);

      try {
        // File size limit (20MB) to prevent browser freeze on large files
        if (file.size > 20_000_000) {
          throw new Error('File too large (max 20MB)');
        }

        // Parse file in browser
        let content = '';
        
        if (fileType === 'txt' || fileType === 'md' || fileType === 'csv') {
          content = await file.text();
        } else if (fileType === 'docx') {
          const mammoth = await import('mammoth');
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          content = result.value;
        } else if (fileType === 'pdf') {
          setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'parsing' } : f));
          const pdfjsLib = await import('pdfjs-dist');
          // Local copy from node_modules/pdfjs-dist/build/pdf.worker.min.mjs — update if upgrading pdfjs-dist
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
          
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          
          const textParts: string[] = [];
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(' ');
            textParts.push(pageText);
          }
          content = textParts.join('\n\n');
        }

        if (!content || content.trim().length === 0) {
          throw new Error('No text content could be extracted');
        }

        // ===================================================================
        // Guest path: browser-only RAG (IndexedDB + Gemini embeddings)
        // Logged-in path: server-side RAG (Supabase + Edge Function)
        // ===================================================================
        const isGuest = isGuestRef.current;

        if (isGuest) {
          // ---- Browser-only RAG ----
          const geminiKey = getApiKey('gemini');
          if (!geminiKey) {
            throw new Error('Gemini API key is required to index files. Please add it in Settings.');
          }

          setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'indexing' as const, charCount: content.length } : f));

          const result = await ingestFile(
            file.name,
            fileType,
            content,
            geminiKey,
            (statusMsg) => {
              console.log('[Browser RAG]', statusMsg);
            }
          );

          setUploadedFiles(prev => prev.map(f => f.id === fileId ? {
            ...f,
            status: 'ready' as const,
            documentId: result.documentId,
            charCount: content.length,
          } : f));

        } else {
          // ---- Server-side RAG (existing Supabase flow) ----
          setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'uploading' as const, charCount: content.length } : f));

          const res = await fetch('/api/rag/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileType,
              content,
              workspaceId
            })
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Upload failed');
          }

          const uploadResult = await res.json();
          const sourceId = uploadResult.document?.sourceId;

          setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'indexing' as const, sourceId } : f));
          
          // Poll for real indexing status
          const pollForStatus = async () => {
            for (let attempt = 0; attempt < 30; attempt++) {
              await new Promise(r => setTimeout(r, 2000));
              try {
                const statusRes = await fetch(`/api/rag/upload?sourceId=${sourceId}`);
                if (statusRes.ok) {
                  const statusData = await statusRes.json();
                  const doc = statusData.documents?.find((d: any) => d.source_id === sourceId);
                  if (doc?.status === 'indexed') {
                    setUploadedFiles(prev => prev.map(f => f.id === fileId && f.status === 'indexing' ? { ...f, status: 'ready' as const } : f));
                    return;
                  } else if (doc?.status === 'error') {
                    setUploadedFiles(prev => prev.map(f => f.id === fileId && f.status === 'indexing' ? { ...f, status: 'error' as const, error: doc.error_message || 'Indexing failed' } : f));
                    return;
                  }
                }
              } catch {
                // Retry on network error
              }
            }
            // Timeout: mark as ready anyway (optimistic)
            setUploadedFiles(prev => prev.map(f => f.id === fileId && f.status === 'indexing' ? { ...f, status: 'ready' as const } : f));
          };
          pollForStatus();
        }

      } catch (err: any) {
        setUploadedFiles(prev => prev.map(f => f.id === fileId ? { 
          ...f, status: 'error' as const, error: err.message || 'Failed to process file' 
        } : f));
      }
    }

    // Reset file input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [workspaceId]);

  const removeFile = useCallback(async (fileId: string) => {
    const file = uploadedFiles.find(f => f.id === fileId);
    if (!file) return;

    if (file.documentId) {
      // Browser RAG cleanup (guest)
      try {
        await removeDocument(file.documentId);
      } catch {
        // Best effort cleanup
      }
    } else if (file.sourceId) {
      // Server-side cleanup (logged-in user)
      try {
        await fetch(`/api/rag/upload?sourceId=${file.sourceId}`, { method: 'DELETE' });
      } catch {
        // Best effort cleanup
      }
    }
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  }, [uploadedFiles]);

  useEffect(() => {
    const el = document.getElementById('chat-input') as HTMLTextAreaElement | null;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
  }, [input]);

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

      <div className="border-t border-gray-800 bg-gray-900/80 px-4 py-3 backdrop-blur-sm">
        {/* Uploaded file chips */}
        {uploadedFiles.length > 0 && (
          <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-2">
            {uploadedFiles.map(file => (
              <div
                key={file.id}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${
                  file.status === 'error'
                    ? 'bg-red-900/40 text-red-300 border border-red-700/40'
                    : file.status === 'ready'
                    ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-700/30'
                    : 'bg-gray-700/60 text-gray-300 border border-gray-600/30'
                }`}
              >
                {/* File type icon */}
                <span className="text-[10px] opacity-70">
                  {file.type === 'pdf' ? '📄' : file.type === 'docx' ? '📝' : '📃'}
                </span>
                <span className="max-w-[120px] truncate">{file.name}</span>
                {/* Status indicator */}
                {file.status === 'parsing' && (
                  <span className="h-3 w-3 animate-spin rounded-full border border-indigo-400/40 border-t-indigo-400" />
                )}
                {file.status === 'uploading' && (
                  <span className="h-3 w-3 animate-spin rounded-full border border-amber-400/40 border-t-amber-400" />
                )}
                {file.status === 'indexing' && (
                  <span className="text-[10px] text-amber-400">⏳</span>
                )}
                {file.status === 'ready' && (
                  <span className="text-[10px] text-emerald-400">✓</span>
                )}
                {file.status === 'error' && (
                  <span className="text-[10px] text-red-400" title={file.error}>!</span>
                )}
                {/* Remove button */}
                <button
                  onClick={() => removeFile(file.id)}
                  className="ml-0.5 text-gray-500 hover:text-gray-300"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mx-auto flex max-w-3xl items-end gap-2">
          {/* File upload button */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            accept=".pdf,.docx,.txt,.md,.csv"
            multiple
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-700 bg-gray-800 text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Upload files (PDF, Word, text)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <textarea
            id="chat-input"
            name="chat-input"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            rows={1}
            className="min-h-[44px] max-h-32 flex-1 resize-none rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white outline-none placeholder:text-gray-500 focus:border-gray-500"
            disabled={loading || !anyProviderAvailable}
          />
          {anyProviderAvailable ? (
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-gray-900 transition-colors hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => {
                const event = new CustomEvent('cloudhelper:open-api-settings');
                window.dispatchEvent(event);
              }}
              className="flex h-11 items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
              </svg>
              Manage APIs
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-[11px] leading-snug text-gray-500">
          This AI can make mistakes, including about people. By using this chat you agree to the{' '}
          <button
            type="button"
            onClick={() => setShowTerms(true)}
            className="text-gray-400 underline hover:text-gray-300 cursor-pointer"
          >
            Terms of Service
          </button>.
        </p>
      </div>
      {showTerms && <TermsOfService onClose={() => setShowTerms(false)} />}
    </div>
  );
}
