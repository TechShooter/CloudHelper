const DB_NAME = 'cloudhelper';
const DB_VERSION = 1;
const CHATS_STORE = 'chats';
const MESSAGES_STORE = 'messages';

interface StoredChat {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredMessage {
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CHATS_STORE)) {
        const store = db.createObjectStore(CHATS_STORE, { keyPath: 'id' });
        store.createIndex('workspaceId', 'workspaceId', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        const store = db.createObjectStore(MESSAGES_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('chatId', 'chatId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ========== Chats ==========

export async function saveChat(chat: StoredChat): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHATS_STORE, 'readwrite');
    tx.objectStore(CHATS_STORE).put(chat);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listChats(workspaceId?: string): Promise<StoredChat[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHATS_STORE, 'readonly');
    const store = tx.objectStore(CHATS_STORE);
    const req = workspaceId
      ? store.index('workspaceId').getAll(workspaceId)
      : store.getAll();
    req.onsuccess = () => {
      const chats: StoredChat[] = req.result || [];
      chats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      resolve(chats);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteChat(chatId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CHATS_STORE, MESSAGES_STORE], 'readwrite');
    tx.objectStore(CHATS_STORE).delete(chatId);
    const msgIndex = tx.objectStore(MESSAGES_STORE).index('chatId');
    msgIndex.openCursor(IDBKeyRange.only(chatId)).onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ========== Messages ==========

export async function saveMessages(chatId: string, messages: { role: 'user' | 'assistant'; content: string }[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MESSAGES_STORE, 'readwrite');
    const store = tx.objectStore(MESSAGES_STORE);

    // Delete existing messages for this chat
    const index = store.index('chatId');
    index.openCursor(IDBKeyRange.only(chatId)).onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    // Insert new messages
    messages.forEach((msg, i) => {
      store.add({
        chatId,
        role: msg.role,
        content: msg.content,
        createdAt: new Date(Date.now() + i).toISOString(),
      });
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadMessages(chatId: string): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MESSAGES_STORE, 'readonly');
    const index = tx.objectStore(MESSAGES_STORE).index('chatId');
    const req = index.getAll(chatId);
    req.onsuccess = () => {
      const stored: StoredMessage[] = req.result || [];
      stored.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      resolve(stored.map(s => ({ role: s.role, content: s.content })));
    };
    req.onerror = () => reject(req.error);
  });
}

// ========== Clear all ==========

export async function clearAllChats(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CHATS_STORE, MESSAGES_STORE], 'readwrite');
    tx.objectStore(CHATS_STORE).clear();
    tx.objectStore(MESSAGES_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function clearApiKeys(): void {
  const prefix = 'cloudhelper.api-key.';
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
}

export async function clearAllData(includeApiKeys: boolean): Promise<void> {
  await clearAllChats();
  if (includeApiKeys) {
    clearApiKeys();
  }
}
