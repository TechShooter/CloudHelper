// @ts-ignore - Deno and JSR modules are only available in Supabase Edge Functions environment
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
// @ts-ignore
import { createClient } from 'jsr:@supabase/supabase-js@2'

// ============================================================================
// RAG Ingestion Edge Function
// 
// Runs asynchronously in Supabase (not Cloudflare Edge) with longer timeout.
// Fetches documents from sources, chunks them, generates embeddings via
// Gemini API, and stores everything in Supabase pgvector.
//
// Triggered by: Fire-and-forget POST from the Next.js app
// ============================================================================

// @ts-ignore
const supabaseUrl = Deno.env.get('PROJECT_URL')
// @ts-ignore
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY')
// @ts-ignore
const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
// @ts-ignore
const supabaseAnonKey = Deno.env.get('ANON_KEY')

const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768
const CHUNK_SIZE_TOKENS = 800  // ~500-1000 tokens per chunk
const CHUNK_OVERLAP_TOKENS = 100
const EMBEDDING_BATCH_SIZE = 20 // Gemini can do batches of embeddings

// ============================================================================
// Chunking Utilities
// ============================================================================

interface Chunk {
  content: string
  enrichedContent: string
  chunkIndex: number
  tokenCount: number
  metadata: Record<string, any>
}

interface DocumentSource {
  userId: string
  sourceType: string
  sourceId: string
  sourceName: string
  workspaceId?: string
  rawContent: string
  metadata: Record<string, any>
}

/** Naive token estimator: ~4 chars per token for English text */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Simple sentence-aware chunking. Splits on sentence boundaries + paragraph breaks. */
function chunkText(text: string, sourceName: string, metadata: Record<string, any>): Chunk[] {
  const chunks: Chunk[] = []
  
  // Split into paragraphs first
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0)
  
  let currentChunk = ''
  let chunkIndex = 0

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph)
    
    // If adding this paragraph would exceed chunk size, save current chunk first
    if (estimateTokens(currentChunk) + paragraphTokens > CHUNK_SIZE_TOKENS && currentChunk.length > 0) {
      chunks.push(createChunk(currentChunk.trim(), sourceName, chunkIndex++, metadata))
      
      // Handle overlap: keep last ~100 tokens
      const overlap = currentChunk.slice(-Math.min(currentChunk.length, CHUNK_OVERLAP_TOKENS * 4))
      currentChunk = overlap
    }
    
    currentChunk += (currentChunk ? '\n\n' : '') + paragraph
  }
  
  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(createChunk(currentChunk.trim(), sourceName, chunkIndex++, metadata))
  }
  
  return chunks
}

function createChunk(
  content: string, 
  sourceName: string, 
  chunkIndex: number, 
  metadata: Record<string, any>
): Chunk {
  return {
    content,
    enrichedContent: `Source: ${sourceName}\n---\n${content}`,
    chunkIndex,
    tokenCount: estimateTokens(content),
    metadata
  }
}

function chunkNotionPage(rawContent: string, pageTitle: string): Chunk[] {
  // Notion content comes pre-formatted with markdown headers
  // Split on headers (# ## ###) to create natural sections
  const sections = rawContent.split(/(?=^#{1,3}\s)/m).filter(s => s.trim())
  
  const allChunks: Chunk[] = []
  let chunkIndex = 0
  
  for (const section of sections) {
    // Extract header for metadata
    const headerMatch = section.match(/^(#{1,3})\s+(.+)/m)
    const sectionTitle = headerMatch ? headerMatch[2].trim() : pageTitle
    
    const sectionChunks = chunkText(section, `${pageTitle} > ${sectionTitle}`, {
      pageTitle,
      sectionTitle,
      source: 'notion',
      type: headerMatch ? `heading_${headerMatch[1].length}` : 'paragraph'
    })
    
    // Re-index chunks to be globally sequential
    for (const chunk of sectionChunks) {
      chunk.chunkIndex = chunkIndex++
      allChunks.push(chunk)
    }
  }
  
  return allChunks
}

function chunkGoogleSheet(rawContent: string, sheetName: string): Chunk[] {
  // Sheet content is pipe-delimited: "Col1 | Col2 | Col3"
  const rows = rawContent.split('\n').filter(r => r.trim())
  if (rows.length === 0) return []
  
  // First row is headers
  const headers = rows[0].split('|').map(h => h.trim())
  const dataRows = rows.slice(1)
  
  // Batch 10 rows per chunk for small rows, 1 row for large rows
  const chunks: Chunk[] = []
  let currentBatch: string[] = []
  let chunkIndex = 0
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    currentBatch.push(row)
    
    const batchSize = currentBatch.join('\n').length
    if (batchSize > 1500 || currentBatch.length >= 10 || i === dataRows.length - 1) {
      const headerLine = headers.join(' | ')
      const dataLines = currentBatch.join('\n')
      const content = `${headerLine}\n${dataLines}`
      
      chunks.push({
        content,
        enrichedContent: `Sheet: ${sheetName}\nRows: ${i - currentBatch.length + 2}-${i + 1}\n---\n${content}`,
        chunkIndex: chunkIndex++,
        tokenCount: estimateTokens(content),
        metadata: {
          sheetName,
          source: 'google_sheet',
          headers,
          rowRange: [i - currentBatch.length + 2, i + 1]
        }
      })
      
      currentBatch = []
    }
  }
  
  return chunks
}

function chunkUserNote(rawContent: string, noteTitle: string): Chunk[] {
  // Notes are typically short. If under 2000 chars, one chunk.
  if (rawContent.length < 2000) {
    return [createChunk(rawContent, noteTitle, 0, { source: 'user_note', noteTitle })]
  }
  return chunkText(rawContent, noteTitle, { source: 'user_note', noteTitle })
}

// ============================================================================
// Embedding Generation
// ============================================================================

interface EmbeddingResponse {
  embeddings: Array<{ values: number[] }>
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${geminiApiKey}`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: texts.map(text => ({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }))
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Embedding API error (${response.status}): ${errorText}`)
  }
  
  const data: EmbeddingResponse = await response.json()
  return data.embeddings.map(e => e.values)
}

async function generateSingleEmbedding(text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${geminiApiKey}`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIMENSIONS,
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Embedding API error (${response.status}): ${errorText}`)
  }
  
  const data = await response.json()
  return data.embedding.values
}

// ============================================================================
// Main Ingestion Pipeline
// ============================================================================

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function indexDocument(doc: DocumentSource, supabase: any): Promise<{ success: boolean; chunks: number; error?: string }> {
  try {
    const contentHash = await hashContent(doc.rawContent)
    
    // Check if this document has already been indexed with the same content
    const { data: existing } = await supabase
      .from('documents')
      .select('id, content_hash, status')
      .eq('user_id', doc.userId)
      .eq('source_type', doc.sourceType)
      .eq('source_id', doc.sourceId)
      .maybeSingle()
    
    if (existing && existing.content_hash === contentHash && existing.status === 'indexed') {
      console.log(`Skipping ${doc.sourceName} - content unchanged`)
      return { success: true, chunks: 0 }
    }
    
    // Upsert document record
    const documentId = existing?.id || crypto.randomUUID()
    await supabase.from('documents').upsert({
      id: documentId,
      user_id: doc.userId,
      source_type: doc.sourceType,
      source_id: doc.sourceId,
      source_name: doc.sourceName,
      workspace_id: doc.workspaceId || null,
      content_hash: contentHash,
      raw_content: doc.rawContent,
      metadata: doc.metadata,
      status: 'indexing'
    })
    
    // Delete old chunks if re-indexing
    if (existing) {
      await supabase.from('document_chunks').delete().eq('document_id', documentId)
    }
    
    // Chunk the content based on source type
    let chunks: Chunk[]
    switch (doc.sourceType) {
      case 'notion_page':
      case 'notion_database':
        chunks = chunkNotionPage(doc.rawContent, doc.sourceName)
        break
      case 'google_sheet':
        chunks = chunkGoogleSheet(doc.rawContent, doc.sourceName)
        break
      case 'user_note':
      case 'uploaded_file':
        chunks = chunkUserNote(doc.rawContent, doc.sourceName)
        break
      default:
        chunks = chunkText(doc.rawContent, doc.sourceName, doc.metadata)
    }
    
    if (chunks.length === 0) {
      await supabase.from('documents').update({
        status: 'indexed', chunk_count: 0, last_indexed_at: new Date().toISOString()
      }).eq('id', documentId)
      return { success: true, chunks: 0 }
    }
    
    // Generate embeddings in batches
    let embeddingsGenerated = 0
    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE)
      const batchTexts = batch.map(c => c.enrichedContent)
      
      const embeddings = await generateEmbeddings(batchTexts)
      
      // Insert chunks with their embeddings
      const chunkRows = batch.map((chunk, idx) => ({
        document_id: documentId,
        user_id: doc.userId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        enriched_content: chunk.enrichedContent,
        token_count: chunk.tokenCount,
        embedding: embeddings[idx],
        metadata: chunk.metadata
      }))
      
      await supabase.from('document_chunks').insert(chunkRows)
      embeddingsGenerated += batch.length
      
      console.log(`Indexed ${embeddingsGenerated}/${chunks.length} chunks for ${doc.sourceName}`)
    }
    
    // Mark as indexed
    await supabase.from('documents').update({
      status: 'indexed',
      chunk_count: chunks.length,
      last_indexed_at: new Date().toISOString()
    }).eq('id', documentId)
    
    return { success: true, chunks: chunks.length }
    
  } catch (error: any) {
    // Mark as error
    await supabase.from('documents').update({
      status: 'error',
      error_message: error.message
    }).eq('user_id', doc.userId)
     .eq('source_type', doc.sourceType)
     .eq('source_id', doc.sourceId)
    
    return { success: false, chunks: 0, error: error.message }
  }
}

// ============================================================================
// Edge Function Handler
// ============================================================================

// @ts-ignore
Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      }
    })
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { action, userId, documents, workspaceId } = await req.json()
    
    // Validate auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }
    
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error: userError } = await authSupabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    
    if (userError || !user || user.id !== userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }
    
    if (action === 'indexDocuments') {
      if (!documents || !Array.isArray(documents)) {
        return new Response(JSON.stringify({ error: 'documents array required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        })
      }
      
      const results: Array<{ sourceType: string; sourceName: string; success: boolean; chunks: number; error?: string }> = []
      
      for (const doc of documents) {
        const result = await indexDocument({
          userId: user.id,
          workspaceId,
          ...doc
        }, supabase)
        
        results.push({
          sourceType: doc.sourceType,
          sourceName: doc.sourceName,
          ...result
        })
      }
      
      const totalChunks = results.reduce((sum, r) => sum + r.chunks, 0)
      const successCount = results.filter(r => r.success).length
      
      return new Response(JSON.stringify({
        success: true,
        documentsProcessed: results.length,
        documentsSucceeded: successCount,
        totalChunks,
        results
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }
    
    if (action === 'indexQuery') {
      const { queryText } = await req.json()
      if (!queryText) {
        return new Response(JSON.stringify({ error: 'queryText required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        })
      }
      
      const embedding = await generateSingleEmbedding(queryText)
      
      return new Response(JSON.stringify({ embedding }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }
    
    if (action === 'reindexAll') {
      // Fetch all user's document records that need re-indexing
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'indexing')
      
      if (!docs || docs.length === 0) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'No documents to re-index',
          documentsProcessed: 0
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        })
      }
      
      const documents = docs.map((d: any) => ({
        sourceType: d.source_type,
        sourceId: d.source_id,
        sourceName: d.source_name,
        rawContent: d.raw_content,
        metadata: d.metadata,
        workspaceId: d.workspace_id
      }))
      
      const results: any[] = []
      for (const doc of documents) {
        const result = await indexDocument({
          userId: user.id,
          workspaceId: workspaceId || doc.workspaceId,
          ...doc
        }, supabase)
        results.push({ sourceType: doc.sourceType, sourceName: doc.sourceName, ...result })
      }
      
      return new Response(JSON.stringify({
        success: true,
        documentsProcessed: results.length,
        results
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }
    
    if (action === 'getStatus') {
      const { data: status, error } = await supabase.rpc('get_indexing_status', {
        match_user_id: user.id
      })
      
      if (error) throw error
      
      return new Response(JSON.stringify({ 
        success: true, 
        status: status?.[0] || { 
          total_documents: 0, 
          indexed_documents: 0, 
          pending_documents: 0,
          error_documents: 0,
          total_chunks: 0,
          last_indexed_at: null
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }
    
    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
    
  } catch (error: any) {
    console.error('[rag-ingestion] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
