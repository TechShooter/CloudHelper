'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ChatHeader, { ChatHeaderRef } from './ChatHeader';
import { createClient } from '@/utils/supabase/client';
import type { Session } from '@supabase/supabase-js';
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

// Rough token estimate: ~4 characters per token (matches the RAG ingestion heuristic).
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function formatChars(chars: number): string {
  if (chars >= 1_000_000) return `${(chars / 1_000_000).toFixed(1)}M chars`;
  if (chars >= 1_000) return `${(chars / 1_000).toFixed(1)}k chars`;
  return `${chars} chars`;
}

/**
 * Builds a best-effort breakdown of the payload that will be sent to /api/chat.
 * Mirrors the server's system-prompt assembly so the user can see which context
 * source is inflating the request (and causing e.g. Groq's 413 "payload too large").
 */
function buildPayloadInfo(ctx: any, model: string, provider: string): PayloadInfo {
  const sources: PayloadSource[] = [];
  const add = (label: string, text: string) => {
    if (!text || text.length === 0) return;
    sources.push({ label, chars: text.length, tokens: estimateTokens(text) });
  };

  const history = Array.isArray(ctx.conversationHistory) ? ctx.conversationHistory : [];
  add('Conversation history', history.map((m: any) => `${m.role}: ${m.content}`).join('\n'));

  if (Array.isArray(ctx.context) && ctx.context.length) {
    add('Notes', ctx.context.map((n: any) => `[${n.title}]\n${n.content}`).join('\n\n'));
  }

  if (Array.isArray(ctx.sheetData) && ctx.sheetData.length) {
    let sheetText = '';
    ctx.sheetData.forEach((s: any) => {
      sheetText += `=== ${s.sheet} (${s.rows} rows) ===\n`;
      if (Array.isArray(s.data)) {
        s.data.forEach((row: string[]) => { sheetText += row.join(' | ') + '\n'; });
      }
      sheetText += '\n';
    });
    add('Google Sheets', sheetText);
  }

  if (Array.isArray(ctx.notionData) && ctx.notionData.length) {
    add('Notion pages', ctx.notionData.map((p: any) => `[${p.title}]\n${p.content}`).join('\n\n'));
  }

  if (Array.isArray(ctx.calendarEvents) && ctx.calendarEvents.length) {
    add('Calendar events', ctx.calendarEvents.map((e: any) => e.summary || '').join('\n'));
  }

  if (Array.isArray(ctx.nutrientEntries) && ctx.nutrientEntries.length) {
    add('Nutrient tracker', ctx.nutrientEntries.map((e: any) => `${e.food} (${e.grams}g)`).join('\n'));
  }

  if (Array.isArray(ctx.ragContext) && ctx.ragContext.length) {
    add('Retrieved documents (RAG)', ctx.ragContext.map((r: any) => r.content || '').join('\n\n'));
  }

  if (ctx.workspacePrompt) {
    add('Workspace prompt', ctx.workspacePrompt);
  }

  const totalChars = sources.reduce((sum, s) => sum + s.chars, 0);
  const totalTokens = sources.reduce((sum, s) => sum + s.tokens, 0);

  return {
    totalChars,
    totalTokens,
    sources: [...sources].sort((a, b) => b.chars - a.chars),
    model,
    provider,
    note: 'Estimate only (~4 characters per token). Server-side retrieved documents and the date/time line are not counted.',
  };
}

function PayloadInfoPanel({ info }: { info: PayloadInfo }) {
  return (
    <div className="mt-2 space-y-1 border-t border-gray-600/40 pt-2 text-xs text-gray-300">
      <div className="flex items-center justify-between gap-2 font-medium text-gray-200">
        <span>Request payload</span>
        <span className="tabular-nums">~{info.totalTokens.toLocaleString()} tokens · {formatChars(info.totalChars)}</span>
      </div>
      <div className="text-gray-400">{info.model} · {info.provider}</div>
      <div className="space-y-0.5 pt-1">
        {info.sources.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-2">
            <span className="text-gray-400">{s.label}</span>
            <span className="tabular-nums text-gray-300">~{s.tokens.toLocaleString()} tok</span>
          </div>
        ))}
      </div>
      <p className="pt-1 leading-snug text-gray-500">{info.note}</p>
    </div>
  );
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  // Best-effort breakdown of the request payload that produced this turn (user messages only).
  payloadInfo?: PayloadInfo;
}

interface PayloadSource {
  label: string;
  chars: number;
  tokens: number;
}

interface PayloadInfo {
  totalChars: number;
  totalTokens: number;
  sources: PayloadSource[];
  model: string;
  provider: string;
  note: string;
}

interface StreamResult {
  text: string;
  // Gemini puts the stop reason on candidates[0].finishReason (e.g. STOP, MAX_TOKENS, SAFETY).
  finishReason: string | null;
  // OpenAI-compatible providers (Groq/OpenRouter) use choices[0].finish_reason (e.g. stop, length).
  finishReasonOpenAI: string | null;
  // True when the stream emitted data: [DONE].
  doneMarker: boolean;
  // True when the stream ended without any completion signal (connection dropped mid-response).
  interrupted: boolean;
  // Error surfaced by the upstream stream, if any.
  errorMessage: string | null;
}

/**
 * Reads a server-sent-events stream from /api/chat and accumulates the text.
 * Also surfaces the model's finish reason so the caller can detect truncation,
 * safety blocks, or a connection that dropped before the response completed.
 */
async function readSseStream(
  res: Response,
  signal: AbortSignal,
  onUpdate: (runningText: string) => void
): Promise<StreamResult> {
  const reader = res.body?.getReader();
  if (!reader) {
    const data = await res.json().catch(() => null);
    return {
      text: data?.response || '',
      finishReason: null,
      finishReasonOpenAI: null,
      doneMarker: false,
      interrupted: false,
      errorMessage: data?.error?.message || null,
    };
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let finishReason: string | null = null;
  let finishReasonOpenAI: string | null = null;
  let doneMarker = false;
  let errorMessage: string | null = null;
  let readError: string | null = null;

  const processLine = (rawLine: string) => {
    const line = rawLine.replace(/\r$/, '');
    if (!line.startsWith('data:')) return;
    const jsonStr = line.slice(5).trim();
    if (!jsonStr) return;
    if (jsonStr === '[DONE]') {
      doneMarker = true;
      return;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return;
    }
    if (parsed.error) {
      errorMessage = parsed.error.message || JSON.stringify(parsed.error);
      return;
    }
    let content = parsed.content;
    if (typeof content !== 'string') {
      const parts = parsed.candidates?.[0]?.content?.parts;
      content = Array.isArray(parts) ? parts.map((p: any) => p.text || '').join('') : '';
    }
    if (!content) content = parsed.choices?.[0]?.delta?.content || '';
    if (content) {
      text += content;
      onUpdate(text);
    }
    if (parsed.candidates?.[0]?.finishReason) finishReason = parsed.candidates[0].finishReason;
    if (parsed.choices?.[0]?.finish_reason) finishReasonOpenAI = parsed.choices[0].finish_reason;
  };

  try {
    while (true) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        processLine(line);
      }
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    readError = e?.message || String(e);
  }

  // Flush any final line that arrived without a trailing newline.
  if (buffer.trim()) processLine(buffer);

  const completed = doneMarker || !!finishReason || !!finishReasonOpenAI;
  const interrupted = !completed || !!readError;
  if (readError) errorMessage = errorMessage || readError;

  return { text, finishReason, finishReasonOpenAI, doneMarker, interrupted, errorMessage };
}

// Separate component for individual messages to prevent re-renders
const MessageItem = React.memo(({ message, onDelete, index }: { message: Message; onDelete: (index: number) => void; index: number }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [showInfo, setShowInfo] = React.useState(false);
  const [showActions, setShowActions] = React.useState(false);

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
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] sm:max-w-[80%] px-3 sm:px-4 py-2 rounded-lg relative ${message.role === 'user'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-700 text-gray-100 prose-chat'
        }`}>
        <div className={showActions ? 'pr-32' : 'pr-10'}>
          {message.role === 'assistant' ? (
            <SimpleMarkdown content={message.content} />
          ) : (
            message.content
          )}
        </div>

        {showInfo && message.payloadInfo && (
          <PayloadInfoPanel info={message.payloadInfo} />
        )}

        {/* Action toggle + buttons (shown only when toggled) */}
        <div className="absolute top-1 right-1 flex items-center gap-1">
          {showActions && (
            <>
              {/* Payload info button */}
              {message.role === 'user' && message.payloadInfo && (
                <button
                  onClick={() => setShowInfo((s) => !s)}
                  className={`text-xs p-1 rounded hover:bg-gray-600 cursor-pointer ${showInfo ? 'text-white bg-gray-600' : 'text-gray-300'}`}
                  title="Request payload info"
                >
                  ℹ️
                </button>
              )}

              {/* Copy button */}
              <button
                onClick={handleCopy}
                className="text-gray-300 hover:text-white text-xs p-1 rounded hover:bg-gray-600 cursor-pointer"
                title="Copy message"
              >
                {copied ? '✓' : '📋'}
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
                  className="text-gray-300 hover:text-red-400 text-sm p-1 rounded hover:bg-gray-600 cursor-pointer"
                  title="Delete message"
                >
                  🗑️
                </button>
              )}
            </>
          )}

          {/* Toggle button */}
          <button
            onClick={() => setShowActions((s) => !s)}
            className={`text-sm p-1 rounded cursor-pointer ${showActions ? 'text-white bg-gray-600' : 'text-gray-300 opacity-70 hover:opacity-100 hover:bg-gray-600'}`}
            title="Message actions"
            aria-label="Toggle message actions"
          >
            ⋮
          </button>
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
  const [authReady, setAuthReady] = useState(false);
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
  const messagesReadyRef = useRef(false);
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
    let mounted = true;

    const applySession = (session: Session | null) => {
      if (!mounted) return;
      const loggedIn = !!session;
      setIsLoggedIn(loggedIn);
      isLoggedInRef.current = loggedIn;
      isGuestRef.current = !loggedIn;
      setAuthReady(true);
      refreshGuestChunkStats();
    };

    supabase.auth.getSession().then(({ data: { session } }) => applySession(session)).catch(() => applySession(null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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
    messagesReadyRef.current = false;
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

  // Authenticated users load only from Supabase; guests load only from IndexedDB.
  useEffect(() => {
    const loadMessagesForChat = async () => {
      if (!authReady || !activeChatId) {
        messagesReadyRef.current = false;
        return;
      }
      if (isNewlyCreatedChatRef.current) {
        isNewlyCreatedChatRef.current = false;
        messagesReadyRef.current = true;
        return;
      }

      messagesReadyRef.current = false;
      setMessages([]);
      setLoadingMessages(true);
      try {
        if (isLoggedIn) {
          const res = await fetch(`/api/chat-persistence?chatId=${encodeURIComponent(activeChatId)}`);
          if (!res.ok) throw new Error(`Failed to load cloud messages (${res.status})`);
          const data = await res.json();
          setMessages(Array.isArray(data.messages) ? data.messages : []);
        } else {
          setMessages(await loadMessages(activeChatId));
        }
        messagesReadyRef.current = true;
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setLoadingMessages(false);
      }
    };
    loadMessagesForChat();
  }, [activeChatId, isLoggedIn, authReady]);

  // Save guest messages locally, or authenticated messages in Supabase only.
  useEffect(() => {
    if (!authReady || !activeChatId || !messagesReadyRef.current) return;
    const timeoutId = setTimeout(async () => {
      try {
        if (isLoggedIn) {
          const res = await fetch('/api/chat-persistence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: activeChatId, messages })
          });
          if (!res.ok) throw new Error(`Failed to save cloud messages (${res.status})`);
          chatHeaderRef.current?.refreshChats();
        } else {
          await saveMessages(activeChatId, messages);
        }
      } catch (error) {
        console.error('Failed to save messages:', error);
      }
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [messages, activeChatId, isLoggedIn, authReady]);

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
    if (!input.trim() || loading || !authReady) return;

    // Capture activeChatId at the start to prevent chat switching issues
    const currentActiveChatId = activeChatId;

    // Create a new chat if none is active
    let chatIdToUse = currentActiveChatId;
    let isNewChat = false;
    if (!chatIdToUse) {
      isNewChat = true;
      isNewlyCreatedChatRef.current = true;
      const title = input.trim().substring(0, 50) + (input.length > 50 ? '...' : '');

      if (isLoggedIn) {
        const res = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId, title }),
        });
        if (!res.ok) {
          isNewlyCreatedChatRef.current = false;
          console.error('Failed to create cloud chat:', res.status);
          return;
        }
        const data = await res.json();
        chatIdToUse = data.chat?.id || null;
      } else {
        chatIdToUse = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const now = new Date().toISOString();
        await saveChat({ id: chatIdToUse, workspaceId, title, createdAt: now, updatedAt: now });
      }

      if (!chatIdToUse) {
        isNewlyCreatedChatRef.current = false;
        messagesReadyRef.current = false;
        return;
      }
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
      context: contextNotes,
      sheetData: sheetContext,
      notionData: notionContext,
      workspacePrompt: workspacePrompt,
      conversationHistory: updatedMessages.slice(-6), // Use updatedMessages with the new user message
      aiModel: aiModel,
      aiProvider: aiProvider || 'gemini',
      chatId: chatIdToUse, // Pass chatId for server-side persistence
      stream: true,
      calendarEvents: calendarEvents,
      nutrientEntries: nutrientEntries,
      ...(ragContext ? { ragContext } : {}),
    };

    // Best-effort breakdown of what's being sent, shown via the ℹ️ button on the user message.
    const payloadInfo = buildPayloadInfo(contextData, aiModel, aiProvider || 'gemini');
    setMessages(prev => {
      const next = [...prev];
      const userIdx = assistantIndex - 1;
      if (next[userIdx] && next[userIdx].role === 'user') {
        next[userIdx] = { ...next[userIdx], payloadInfo };
      }
      return next;
    });

    try {
      setLoadingStatus('thinking');

      const geminiKey = getApiKey('gemini');
      const groqKey = getApiKey('groq');

      // Update the live assistant message as text streams in.
      const applyText = (text: string) => {
        fullText = text;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[assistantIndex] = { role: 'assistant', content: text };
          return newMessages;
        });
      };

      // One streaming round-trip to /api/chat. Returns stream metadata so we can
      // detect truncation (MAX_TOKENS), safety blocks, or a dropped connection.
      const doStream = async (ctx: any): Promise<{ result: StreamResult | null; errorText: string | null }> => {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(geminiKey && { 'x-api-key-gemini': geminiKey }),
            ...(groqKey && { 'x-api-key-groq': groqKey }),
          },
          body: JSON.stringify(ctx),
          signal: controller.signal,
        });

        if (!res.ok) {
          let errorText: string | null = null;
          const rawBody = await res.text().catch(() => '');
          try {
            const data = JSON.parse(rawBody);
            errorText = data.response || data.error?.message || (typeof data.error === 'string' ? data.error : null) || null;
          } catch {
            // Not JSON (e.g. an HTML error page from the platform).
          }

          // 502/503/504 usually come from the platform/gateway timing out or the
          // provider being unavailable, not from our code — so explain the cause.
          let friendly: string | null = null;
          if (!errorText) {
            if (res.status === 504) {
              friendly = 'The AI provider took too long to respond (gateway timeout). This usually means the model is busy or the selected context (notes/sheets/documents) is very large. Try again, or deselect some context.';
            } else if (res.status === 502) {
              friendly = 'The AI provider returned a bad gateway error and may be temporarily unavailable. Please try again.';
            } else if (res.status === 503) {
              friendly = 'The AI provider is temporarily overloaded or unavailable. Please try again in a moment.';
            }
          }

          return {
            result: null,
            errorText: errorText || friendly || rawBody.trim().slice(0, 300) || `Request failed with status ${res.status}.`,
          };
        }

        setLoadingStatus('responding');

        const isSSE = res.headers.get('content-type')?.includes('text/event-stream');
        if (!isSSE) {
          const data = await res.json().catch(() => ({}));
          const text = typeof data.response === 'string' ? data.response : '';
          if (text) applyText(text);
          return {
            result: { text, finishReason: null, finishReasonOpenAI: null, doneMarker: false, interrupted: false, errorMessage: null },
            errorText: null,
          };
        }

        const result = await readSseStream(res, controller.signal, applyText);
        return { result, errorText: null };
      };

      // ---- Initial request ----
      const first = await doStream(contextData);

      if (first.errorText) {
        applyText(first.errorText);
        return;
      }
      if (!first.result) {
        applyText('Error: Could not get response. Please try again.');
        return;
      }

      let result: StreamResult = first.result;
      let baseText = result.text;

      if (!baseText || baseText.trim() === '') {
        applyText('No response from the AI model. This could be due to:\n• Invalid model name\n• API error or rate limit\n• Network issue\n\nPlease try again or use a different model.');
        return;
      }

      // Figure out WHY the stream stopped early.
      const truncated = result.finishReason === 'MAX_TOKENS' || result.finishReasonOpenAI === 'length';
      const interrupted = result.interrupted;
      const rawReason = result.finishReason || result.finishReasonOpenAI || null;
      const stoppedEarly = !truncated && !interrupted && !!rawReason && rawReason !== 'STOP' && rawReason !== 'stop';

      // Auto-continue once when the model hit its output limit or the connection dropped.
      const shouldContinue = (truncated || interrupted) && !controller.signal.aborted && baseText.trim().length > 0;

      let continued = false;

      if (shouldContinue) {
        const continueHistory = [
          ...updatedMessages.slice(-6),
          { role: 'assistant' as const, content: baseText },
          { role: 'user' as const, content: 'Continue from where you left off. Do not repeat anything already written. Continue the response exactly from the last character.' },
        ];
        const cont = await doStream({ ...contextData, conversationHistory: continueHistory });

        if (cont.result) {
          const contText = cont.result.text;
          if (contText && contText.trim()) {
            baseText = baseText + contText;
            applyText(baseText);
            continued = true;
          }
          result = cont.result;
        }
      }

      // Explain what happened so the user can see the cause.
      let note = '';
      if (continued) {
        const contTruncated = result.finishReason === 'MAX_TOKENS' || result.finishReasonOpenAI === 'length';
        const contInterrupted = result.interrupted;
        const cause = truncated ? 'hit the output limit' : 'the connection was interrupted';
        note = contTruncated
          ? `\n\n*⚠️ The response ${cause} and was auto-continued, but hit the output limit again and may still be incomplete.*`
          : contInterrupted
            ? `\n\n*⚠️ The response ${cause} and was auto-continued, but the connection was interrupted again and may still be incomplete.*`
            : `\n\n*ℹ️ The response ${cause} and was auto-continued.*`;
      } else if (truncated) {
        note = '\n\n*⚠️ The response hit the model\u2019s output limit and may be incomplete.*';
      } else if (interrupted) {
        note = result.errorMessage
          ? `\n\n*⚠️ The connection to the AI was interrupted mid-response (${result.errorMessage}).*`
          : '\n\n*⚠️ The connection to the AI was interrupted mid-response.*';
      } else if (stoppedEarly) {
        note = `\n\n*⚠️ The response was stopped early by the model (reason: \u201c${rawReason}\u201d).*`;
      }

      if (note) {
        baseText = baseText + note;
        applyText(baseText);
      }

      if (interrupted || truncated || stoppedEarly) {
        console.warn('[Chat] stream ended early', {
          finishReason: result.finishReason,
          finishReasonOpenAI: result.finishReasonOpenAI,
          interrupted: result.interrupted,
          errorMessage: result.errorMessage,
          continued,
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
  }, [input, loading, currentMessages, messages, workspaceId, notes, selectedContexts, sheetData, notionPages, workspacePrompt, aiModel, aiProvider, calendarEvents, nutrientEntries, isLoggedIn, authReady]);

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
    messagesReadyRef.current = false;
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
            disabled={loading || !anyProviderAvailable || !authReady}
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
