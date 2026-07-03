'use client';

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { listChats, saveChat, deleteChat as deleteChatStorage, clearAllData } from '../lib/chat-storage';

interface LocalChat {
  id: string;
  title: string;
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
  const [chats, setChats] = useState<LocalChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearApiKeysToo, setClearApiKeysToo] = useState(false);

  const loadChats = async () => {
    try {
      setLoading(true);
      const stored = await listChats(workspaceId);
      setChats(stored.map(c => ({ id: c.id, title: c.title, updatedAt: c.updatedAt })));
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChats();
  }, [workspaceId]);

  useImperativeHandle(ref, () => ({
    refreshChats: loadChats
  }));

  const handleCreateChat = async (title?: string) => {
    const chatId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();
    await saveChat({ id: chatId, workspaceId, title: title || 'New Chat', createdAt: now, updatedAt: now });
    setChats(prev => [{ id: chatId, title: title || 'New Chat', updatedAt: now }, ...prev]);
    onChatSelect(chatId);
  };

  const handleDeleteChat = async (chatId: string) => {
    await deleteChatStorage(chatId);
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (activeChatId === chatId) {
      onNewChat();
    }
  };

  const handleClearAllData = async () => {
    await clearAllData(clearApiKeysToo);
    setChats([]);
    setShowClearConfirm(false);
    onNewChat();
  };

  // Format date for display
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
        {/* New Chat Button */}
        <button
          onClick={() => handleCreateChat()}
          className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 text-lg flex items-center gap-1 flex-shrink-0"
        >
          +
        </button>

        {/* Chat List - Horizontal Scroll */}
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
                  className={`group flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer flex-shrink-0 ${
                    activeChatId === chat.id
                      ? 'bg-gray-700'
                      : 'hover:bg-gray-750'
                  }`}
                  onClick={() => onChatSelect(chat.id)}
                >
                  <div className="min-w-0 max-w-[200px]">
                    <div className="text-white text-sm font-medium truncate">
                      {chat.title}
                    </div>
                    <div className="text-gray-400 text-xs truncate">
                      {formatDate(chat.updatedAt)}
                    </div>
                  </div>
                  {deleteConfirmId === chat.id ? (
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteChat(chat.id);
                        }}
                        className="bg-red-600 text-white px-2 py-0.5 rounded text-xs hover:bg-red-700"
                      >
                        ✓
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(null);
                        }}
                        className="bg-gray-600 text-white px-2 py-0.5 rounded text-xs hover:bg-gray-700"
                      >
                        ✗
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(chat.id);
                      }}
                      className="text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 text-sm p-1 rounded hover:bg-gray-600 flex-shrink-0"
                      title="Delete chat"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Delete all data button */}
        <button
          onClick={() => setShowClearConfirm(true)}
          className="flex-shrink-0 rounded bg-red-600/20 px-2 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-600/40"
          title="Delete all local data"
        >
          🗑
        </button>
      </div>

      {/* Clear all data confirmation dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Delete all data?</h3>
            <p className="text-sm text-gray-400 mb-4">
              This will permanently delete all your chats and messages.
            </p>
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={clearApiKeysToo}
                onChange={(e) => setClearApiKeysToo(e.target.checked)}
                className="accent-red-500"
              />
              <span className="text-sm text-gray-300">Also delete saved API keys</span>
            </label>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowClearConfirm(false); setClearApiKeysToo(false); }}
                className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllData}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Delete{clearApiKeysToo ? ' everything' : ' chats'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default ChatHeader;
