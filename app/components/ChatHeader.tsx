'use client';

import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { listChats, loadMessages, saveChat, deleteChat as deleteChatStorage, clearAllData } from '../lib/chat-storage';
import { createClient } from '@/utils/supabase/client';
import type { Session } from '@supabase/supabase-js';

interface Chat {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  workspaceId: string;
  activeChatId: string | null;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
}

export interface ChatHeaderRef {
  refreshChats: () => void;
}

const ChatHeader = forwardRef<ChatHeaderRef, Props>(({ workspaceId, activeChatId, onChatSelect, onNewChat }, ref) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearApiKeysToo, setClearApiKeysToo] = useState(false);
  const localMigrationAttemptedRef = React.useRef(false);

  const migrateLocalChats = useCallback(async () => {
    if (!isLoggedIn || localMigrationAttemptedRef.current) return;
    localMigrationAttemptedRef.current = true;

    try {
      const localChats = (await listChats()).filter(chat => chat.id.startsWith('local-'));
      for (const localChat of localChats) {
        const createRes = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId: localChat.workspaceId, title: localChat.title }),
        });
        if (!createRes.ok) continue;

        const created = await createRes.json();
        const cloudChatId = created.chat?.id;
        if (!cloudChatId) continue;

        const messages = await loadMessages(localChat.id);
        if (messages.length > 0) {
          const saveRes = await fetch('/api/chat-persistence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: cloudChatId, messages }),
          });
          if (!saveRes.ok) continue;
        }

        await deleteChatStorage(localChat.id);
      }
    } catch (error) {
      // Keep local data if migration cannot complete; it can be retried on the next sign-in.
      localMigrationAttemptedRef.current = false;
      console.error('Failed to migrate local chats to Supabase:', error);
    }
  }, [isLoggedIn]);

  const loadChats = useCallback(async () => {
    if (!authReady) return;

    try {
      setLoading(true);
      if (isLoggedIn) {
        const res = await fetch(`/api/chats?workspaceId=${encodeURIComponent(workspaceId)}`);
        if (!res.ok) throw new Error(`Failed to load cloud chats (${res.status})`);
        const data = await res.json();
        setChats(data.chats || []);
      } else {
        const stored = await listChats(workspaceId);
        setChats(stored);
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, [authReady, isLoggedIn, workspaceId]);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const applySession = (session: Session | null) => {
      if (!mounted) return;
      const loggedIn = !!session;
      setIsLoggedIn(loggedIn);
      if (!loggedIn) localMigrationAttemptedRef.current = false;
      setAuthReady(true);
    };

    supabase.auth.getSession().then(({ data: { session } }) => applySession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      await migrateLocalChats();
      await loadChats();
    };
    load();
  }, [loadChats, migrateLocalChats]);

  useImperativeHandle(ref, () => ({ refreshChats: loadChats }), [loadChats]);

  const handleCreateChat = async (title?: string) => {
    const chatTitle = title || 'New Chat';
    if (isLoggedIn) {
      try {
        const res = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId, title: chatTitle }),
        });
        if (!res.ok) throw new Error(`Failed to create cloud chat (${res.status})`);
        const data = await res.json();
        const chat = data.chat as Chat;
        setChats(prev => [chat, ...prev]);
        onChatSelect(chat.id);
      } catch (error) {
        console.error('Failed to create chat:', error);
      }
      return;
    }

    const chatId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();
    const chat = { id: chatId, workspaceId, title: chatTitle, createdAt: now, updatedAt: now };
    await saveChat(chat);
    setChats(prev => [chat, ...prev]);
    onChatSelect(chatId);
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      if (isLoggedIn) {
        const res = await fetch(`/api/chats?chatId=${encodeURIComponent(chatId)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`Failed to delete cloud chat (${res.status})`);
      } else {
        await deleteChatStorage(chatId);
      }
      setChats(prev => prev.filter(c => c.id !== chatId));
      setDeleteConfirmId(null);
      if (activeChatId === chatId) onNewChat();
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  const handleClearAllData = async () => {
    try {
      if (isLoggedIn) {
        const res = await fetch('/api/chats', { method: 'DELETE' });
        if (!res.ok) throw new Error(`Failed to delete cloud chats (${res.status})`);
      } else {
        await clearAllData(clearApiKeysToo);
      }
      setChats([]);
      setShowClearConfirm(false);
      setClearApiKeysToo(false);
      onNewChat();
    } catch (error) {
      console.error('Failed to clear chats:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => handleCreateChat()}
          disabled={!authReady}
          className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 text-lg flex items-center gap-1 flex-shrink-0 disabled:opacity-50"
        >
          +
        </button>

        <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
          <div className="flex gap-2">
            {loading ? (
              <div className="text-gray-400 text-sm py-1">Loading chats...</div>
            ) : chats.length === 0 ? (
              <div className="text-gray-400 text-sm py-1">No chats yet</div>
            ) : (
              chats.map(chat => (
                <div
                  key={chat.id}
                  className={`group flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer flex-shrink-0 ${activeChatId === chat.id ? 'bg-gray-700' : 'hover:bg-gray-750'}`}
                  onClick={() => onChatSelect(chat.id)}
                >
                  <div className="min-w-0 max-w-[200px]">
                    <div className="text-white text-sm font-medium truncate">{chat.title}</div>
                    <div className="text-gray-400 text-xs truncate">{formatDate(chat.updatedAt)}</div>
                  </div>
                  {deleteConfirmId === chat.id ? (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }} className="bg-red-600 text-white px-2 py-0.5 rounded text-xs hover:bg-red-700">✓</button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }} className="bg-gray-600 text-white px-2 py-0.5 rounded text-xs hover:bg-gray-700">✗</button>
                    </div>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(chat.id); }} className="text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 text-sm p-1 rounded hover:bg-gray-600 flex-shrink-0" title="Delete chat">🗑️</button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <button onClick={() => setShowClearConfirm(true)} className="flex-shrink-0 rounded bg-red-600/20 px-2 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-600/40" title="Delete all chats">🗑</button>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Delete all data?</h3>
            <p className="text-sm text-gray-400 mb-4">This will permanently delete all your chats and messages.</p>
            {!isLoggedIn && (
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input type="checkbox" checked={clearApiKeysToo} onChange={(e) => setClearApiKeysToo(e.target.checked)} className="accent-red-500" />
                <span className="text-sm text-gray-300">Also delete saved API keys</span>
              </label>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowClearConfirm(false); setClearApiKeysToo(false); }} className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-600">Cancel</button>
              <button onClick={handleClearAllData} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700">Delete{clearApiKeysToo && !isLoggedIn ? ' everything' : ' chats'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ChatHeader.displayName = 'ChatHeader';

export default ChatHeader;
