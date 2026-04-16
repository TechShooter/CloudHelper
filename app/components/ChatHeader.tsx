'use client';

import React, { useState, useEffect } from 'react';

interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  workspaceId: string;
  activeChatId: string | null;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
}

export default function ChatHeader({ workspaceId, activeChatId, onChatSelect, onNewChat }: Props) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Load chats from Supabase
  useEffect(() => {
    const loadChats = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/chats?workspaceId=${workspaceId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.chats) {
            setChats(data.chats);
          }
        }
      } catch (error) {
        console.error('Failed to load chats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChats();
  }, [workspaceId]);

  // Create new chat
  const handleCreateChat = async () => {
    try {
      console.log('Creating chat with workspaceId:', workspaceId);
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      });
      console.log('Response status:', res.status);
      const data = await res.json();
      console.log('Response data:', data);
      if (res.ok) {
        if (data.chat) {
          setChats(prev => [data.chat, ...prev]);
          onChatSelect(data.chat.id);
        }
      } else {
        console.error('Failed to create chat:', data.error);
      }
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  // Delete chat
  const handleDeleteChat = async (chatId: string) => {
    try {
      const res = await fetch(`/api/chats?chatId=${chatId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setChats(prev => prev.filter(c => c.id !== chatId));
        if (activeChatId === chatId) {
          onNewChat();
        }
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
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
          onClick={handleCreateChat}
          className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 text-sm flex items-center gap-1 flex-shrink-0"
        >
          <span className="text-base">+</span>
          <span>New Chat</span>
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
                      {formatDate(chat.updated_at)}
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
      </div>
    </div>
  );
}
