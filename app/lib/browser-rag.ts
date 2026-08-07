'use client';

// ============================================================================
// Browser-only RAG Engine
// Stores document chunks + embeddings in IndexedDB, searches via cosine
// similarity. No Supabase, no server-side infrastructure required.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RagDocument {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt' | 'md' | 'csv';
  charCount: number;
  uploadedAt: number;
}

export interface RagChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  enrichedContent: string;
  tokenCount: number;
  /** 768-dim embedding from Gemini embedding model */
  embedding: number[];
}

export interface SearchResult {
  chunk: RagChunk;
  similarity: number;
}

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

const DB_NAME = 'cloudhelper-rag';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('chunks')) {
        db.createObjectStore('chunks', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function storeDocument(doc: RagDocument): Promise<void> {
  return withStore('documents', 'readwrite', (store) => {
    store.put(doc);
  });
}

function storeChunks(chunks: RagChunk[]): Promise<void> {
  return withStore('chunks', 'readwrite', (store) => {
    for (const chunk of chunks) {
      store.put(chunk);
    }
  });
}

function getAllChunks(): Promise<RagChunk[]> {
  return withStore('chunks', 'readonly', (store) => {
    const req = store.getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  });
}

function deleteDocumentChunks(documentId: string): Promise<void> {
  return withStore('chunks', 'readwrite', async (store) => {
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        if (cursor.value.documentId === documentId) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
    // Await completion is handled by withStore
  });
}

function deleteDocumentMeta(docId: string): Promise<void> {
  return withStore('documents', 'readwrite', (store) => {
    store.delete(docId);
  });
}

function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => void | Promise<T>,
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const db = await openDB();
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);

    let result: any;
    try {
      const maybePromise = fn(store);
      if (maybePromise instanceof Promise) {
        result = await maybePromise;
      }
    } catch (err) {
      reject(err);
      return;
    }

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Chunking — adapted from the Supabase Edge Function
// ---------------------------------------------------------------------------

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const CHUNK_SIZE_TOKENS = 800;
const CHUNK_OVERLAP_TOKENS = 100;

function chunkText(text: string, sourceName: string): RagChunk[] {
  const chunks: RagChunk[] = [];
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const dateKey = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  const documentId = `guest-${dateKey}-${rand}`;

  let currentChunk = '';
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const paraTokens = estimateTokens(paragraph);

    if (
      estimateTokens(currentChunk) + paraTokens > CHUNK_SIZE_TOKENS &&
      currentChunk.length > 0
    ) {
      const content = currentChunk.trim();
      chunks.push({
        id: `${documentId}-${chunkIndex}`,
        documentId,
        chunkIndex: chunkIndex++,
        content,
        enrichedContent: `Source: ${sourceName}\n---\n${content}`,
        tokenCount: estimateTokens(content),
        embedding: [],
      });
      // Overlap: keep roughly the last CHUNK_OVERLAP_TOKENS
      const overlapLen = CHUNK_OVERLAP_TOKENS * 4;
      currentChunk = currentChunk.slice(-Math.min(currentChunk.length, overlapLen));
    }

    currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
  }

  if (currentChunk.trim().length > 0) {
    const content = currentChunk.trim();
    chunks.push({
      id: `${documentId}-${chunkIndex}`,
      documentId,
      chunkIndex,
      content,
      enrichedContent: `Source: ${sourceName}\n---\n${content}`,
      tokenCount: estimateTokens(content),
      embedding: [],
    });
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Gemini Embedding API (called directly from the browser)
// ---------------------------------------------------------------------------

/** Gemini embedding model — text-only, 768-dim via output_dimensionality */
const EMBEDDING_MODEL = 'gemini-embedding-001';

async function generateEmbeddings(texts: string[], geminiKey: string): Promise<number[][]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${geminiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: texts.map((t) => ({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text: t }] },
        outputDimensionality: 768,
      })),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => 'Unknown error');
    throw new Error(
      `Gemini Embedding API error (HTTP ${res.status})
URL: ${url}
Response: ${body}

Fix: Make sure your Gemini API key is valid and has access to "${EMBEDDING_MODEL}".`
    );
  }

  const data = await res.json();
  return (data.embeddings || []).map((e: any) => e.values);
}

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Ingest a file into the browser RAG store.
 * 1. Chunks the text into ~800-token segments with overlap
 * 2. Generates embeddings via Gemini API (batched)
 * 3. Stores everything in IndexedDB
 *
 * Requires the user's Gemini API key to be available.
 */
export async function ingestFile(
  fileName: string,
  fileType: RagDocument['type'],
  content: string,
  geminiKey: string,
  onProgress?: (msg: string) => void,
): Promise<{ documentId: string; chunksCount: number }> {
  // 1. Chunk
  onProgress?.('Splitting text into chunks...');
  const chunks = chunkText(content, fileName);
  if (chunks.length === 0) {
    throw new Error('No chunks could be created from this file');
  }

  const documentId = chunks[0].documentId;

  // 2. Store document metadata
  onProgress?.('Saving document info...');
  const doc: RagDocument = {
    id: documentId,
    name: fileName,
    type: fileType,
    charCount: content.length,
    uploadedAt: Date.now(),
  };
  await storeDocument(doc);

  // 3. Generate embeddings in batches
  const BATCH_SIZE = 20;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const end = Math.min(i + BATCH_SIZE, chunks.length);
    onProgress?.(`Generating embeddings (${i + 1}–${end} of ${chunks.length})...`);

    const texts = batch.map((c) => c.enrichedContent);
    const embeddings = await generateEmbeddings(texts, geminiKey);

    for (let j = 0; j < batch.length; j++) {
      batch[j].embedding = embeddings[j];
    }
  }

  // 4. Store chunks
  onProgress?.('Saving to browser database...');
  await storeChunks(chunks);

  return { documentId, chunksCount: chunks.length };
}

/**
 * Search indexed documents for chunks relevant to `query`.
 * Returns top-K results sorted by cosine similarity (descending).
 */
export async function searchQuery(
  query: string,
  geminiKey: string,
  topK = 3,
): Promise<SearchResult[]> {
  // Embed the query
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${geminiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text: query }] },
      outputDimensionality: 768,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => 'Unknown error');
    console.error(
      `[Browser RAG] Embedding API error (${res.status})
URL: ${url}
Response: ${body}`
    );
    return [];
  }
  const data = await res.json();
  const qEmb: number[] | undefined = data.embedding?.values;
  if (!qEmb || qEmb.length === 0) return [];

  // Load all chunks from IndexedDB and score them
  const allChunks = await getAllChunks();
  const results: SearchResult[] = [];

  for (const chunk of allChunks) {
    if (!chunk.embedding || chunk.embedding.length === 0) continue;
    const sim = cosineSimilarity(qEmb, chunk.embedding);
    if (sim > 0.4) {
      results.push({ chunk, similarity: sim });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, topK);
}

/**
 * Remove a document and all its chunks from IndexedDB.
 */
export async function removeDocument(documentId: string): Promise<void> {
  await deleteDocumentChunks(documentId);
  await deleteDocumentMeta(documentId);
}

/**
 * Get the count of indexed documents/chunks for display purposes.
 */
export async function getStats(): Promise<{ documents: number; chunks: number }> {
  const db = await openDB();
  const tx = db.transaction(['documents', 'chunks'], 'readonly');
  const docCount = await new Promise<number>((resolve) => {
    const req = tx.objectStore('documents').count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(0);
  });
  const chunkCount = await new Promise<number>((resolve) => {
    const req = tx.objectStore('chunks').count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(0);
  });
  return { documents: docCount, chunks: chunkCount };
}
