import { NextRequest, NextResponse } from 'next/server';
import { isGeminiModel } from '../../lib/model-utils';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'edge';

/**
 * Search for relevant chunks from uploaded documents only.
 * Returns null silently if RAG is unavailable or no docs are indexed.
 */
async function searchUploadedFiles(
  query: string,
  geminiKey: string,
  supabase: any,
  userId: string
): Promise<string | null> {
  try {
    const embUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiKey}`;
    const embRes = await fetch(embUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text: query }] },
        outputDimensionality: 768,
      })
    });
    if (!embRes.ok) {
      const body = await embRes.text().catch(() => 'Unknown error');
      console.error(`[RAG] Embedding API error (HTTP ${embRes.status})
URL: ${embUrl}
Response: ${body}`);
      return null;
    }
    const embData = await embRes.json();
    const queryEmbedding = embData.embedding?.values;
    if (!queryEmbedding) return null;

    const { data: chunks, error } = await supabase.rpc('search_document_chunks', {
      query_embedding: queryEmbedding,
      match_user_id: userId,
      match_count: 3,
      similarity_threshold: 0.5,
      keyword_filter: null,
      source_type_filter: 'uploaded_file'
    });

    if (error || !chunks || chunks.length === 0) return null;

    const contextBlocks = chunks.map((chunk: any, i: number) =>
      `[Document: ${chunk.source_name} (relevance: ${Math.round(chunk.similarity * 100)}%)]\n${chunk.content}`
    );

    return `UPLOADED DOCUMENTS (relevant excerpts):\n\n${contextBlocks.join('\n\n')}\n\n---\n\nIMPORTANT: Use the above document excerpts to answer the user's question.`;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const geminiKey = req.headers.get('x-api-key-gemini') || process.env.GEMINI_API_KEY || '';
    const groqKey = req.headers.get('x-api-key-groq') || process.env.GROQ_API_KEY || '';
    const { context, sheetData, notionData, workspacePrompt, conversationHistory, aiModel, aiProvider, stream, calendarEvents, nutrientEntries, ragContext } = await req.json();

    let systemPrompt = '';

    // Add workspace-specific prompt first
    if (workspacePrompt) {
      systemPrompt += workspacePrompt + '\n\n---\n\n';
    }

    // Add current date and time
    const now = new Date();
    const dateStr = now.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    systemPrompt += `Current Date & Time: ${dateStr}, ore ${timeStr}\n\n---\n\n`;

    // ===================================================================
    // Browser RAG context (sent from client-side, for guests)
    // ===================================================================
    if (ragContext && Array.isArray(ragContext) && ragContext.length > 0) {
      systemPrompt += 'RETRIEVED DOCUMENTS (browser RAG):\n\n';
      for (const item of ragContext) {
        const label = item.sourceName || 'Uploaded document';
        systemPrompt += `[${label} (relevance: ${Math.round((item.similarity || 0) * 100)}%)]\n${item.content}\n\n`;
      }
      systemPrompt += '---\n\n';
      systemPrompt += 'IMPORTANT: Use the above document excerpts to answer the user\'s question.\n\n';
    }

    // ===================================================================
    // RAG: Search uploaded documents for relevant context
    // Only runs if the user has indexed uploaded documents
    // ===================================================================
    if (geminiKey) {
      const userQuery = conversationHistory?.[conversationHistory.length - 1]?.content || '';
      if (userQuery.trim()) {
        try {
          const supabase = await createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // Gate: only call embedding API if user has indexed documents
            const { count } = await supabase
              .from('documents')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('source_type', 'uploaded_file')
              .eq('status', 'indexed');
            
            if (count && count > 0) {
              const docContext = await searchUploadedFiles(userQuery, geminiKey, supabase, user.id);
              if (docContext) {
                systemPrompt += docContext + '\n';
              }
            }
          }
        } catch (err) {
          console.warn('[RAG] Search unavailable:', err instanceof Error ? err.message : err);
        }
      }
    }

    if (sheetData && Array.isArray(sheetData)) {
      systemPrompt += 'Google Sheets Database (ALL SHEETS - COMPLETE DATA):\n\n';

      sheetData.forEach((sheet: any) => {
        systemPrompt += `\n=== ${sheet.sheet} (${sheet.rows} rows) ===\n`;
        if (sheet.data && sheet.data.length > 0) {
          sheet.data.forEach((row: string[]) => {
            systemPrompt += row.join(' | ') + '\n';
          });
        }
        systemPrompt += '\n';
      });

      systemPrompt += '---\n\n';
      systemPrompt += 'IMPORTANT: You have access to ALL sheets and ALL rows. This is the complete database.\n\n';
    }

    if (calendarEvents && calendarEvents.length > 0) {
      systemPrompt += 'Calendar Events (Next 30 Days):\n';
      calendarEvents.forEach((event: any) => {
        const start = event.start.dateTime || event.start.date;
        const end = event.end?.dateTime || event.end?.date;
        systemPrompt += `- ${event.summary}`;
        if (start) systemPrompt += ` | ${new Date(start).toLocaleString('it-IT')}`;
        if (end && event.start.dateTime) systemPrompt += ` - ${new Date(end).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
        if (event.location) systemPrompt += ` | Location: ${event.location}`;
        if (event.description) systemPrompt += ` | ${event.description}`;
        systemPrompt += '\n';
      });
      systemPrompt += '\n---\n\n';
    }

    if (nutrientEntries && nutrientEntries.length > 0) {
      systemPrompt += 'Nutrient Tracker (Last 24 Hours):\n';
      const totals = nutrientEntries.reduce((acc: any, entry: any) => ({
        energy: acc.energy + entry.energy,
        protein: acc.protein + entry.protein,
        carbs: acc.carbs + entry.carbs,
        fats: acc.fats + entry.fats
      }), { energy: 0, protein: 0, carbs: 0, fats: 0 });
      
      systemPrompt += `Total: ${totals.energy.toFixed(0)} kJ | Protein: ${totals.protein.toFixed(1)}g | Carbs: ${totals.carbs.toFixed(1)}g | Fats: ${totals.fats.toFixed(1)}g\n\n`;
      systemPrompt += 'Entries:\n';
      nutrientEntries.forEach((entry: any) => {
        systemPrompt += `- ${entry.food} (${entry.grams}g) at ${new Date(entry.time).toLocaleString('it-IT')}: ${entry.energy.toFixed(0)} kJ | P: ${entry.protein.toFixed(1)}g | C: ${entry.carbs.toFixed(1)}g | F: ${entry.fats.toFixed(1)}g\n`;
      });
      systemPrompt += '\n---\n\n';
    }

    if (notionData && notionData.length > 0) {
      systemPrompt += 'Notion Pages:\n\n';
      notionData.forEach((page: any) => {
        systemPrompt += `[${page.title}]\n${page.content}\n\n`;
      });
      systemPrompt += '---\n\n';
    }

    if (context && context.length > 0) {
      systemPrompt += 'My Notes:\n\n';
      context.forEach((note: any) => {
        systemPrompt += `[${note.title}]\n${note.content}\n\n`;
      });
      systemPrompt += `---\n\n`;
    }

    const messages = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach((msg: any) => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }

    messages.push({ role: 'user', content: conversationHistory[conversationHistory.length - 1]?.content || '' });

    let response, data, aiResponse;

    // Determine the API provider from the Sheet's API Link column, or fall back to isGeminiModel
    const apiProvider = aiProvider || (isGeminiModel(aiModel) ? 'gemini' : 'groq');

    // Validate the provider key before making the upstream call. Calling the API
    // with an empty key yields hard-to-debug 401/403s, so fail fast and clearly.
    if (apiProvider === 'gemini' && !geminiKey) {
      return NextResponse.json({
        response: 'Gemini API key not configured. Add your key in Settings or set GEMINI_API_KEY on the server.',
        error: { type: 'MISSING_API_KEY', message: 'Gemini key required' }
      }, { status: 400 });
    }
    if (apiProvider !== 'gemini' && apiProvider !== 'openrouter' && !groqKey) {
      return NextResponse.json({
        response: 'Groq API key not configured. Add your key in Settings or set GROQ_API_KEY on the server.',
        error: { type: 'MISSING_API_KEY', message: 'Groq key required' }
      }, { status: 400 });
    }

    if (apiProvider === 'gemini') {
      let geminiPrompt = '';
      if (systemPrompt) geminiPrompt += systemPrompt + '\n\n';
      if (conversationHistory && conversationHistory.length > 0) {
        conversationHistory.forEach((msg: any) => {
          geminiPrompt += `${msg.role}: ${msg.content}\n`;
        });
      }
      geminiPrompt += `user: ${conversationHistory[conversationHistory.length - 1]?.content || ''}`;

      if (stream) {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:streamGenerateContent?alt=sse&key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: geminiPrompt }] }]
            })
          }
        );

        if (response.ok && response.body) {
          return new Response(response.body, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive'
            }
          });
        }
      }

      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: geminiPrompt }] }]
          })
        }
      );
      const geminiBodyText = await response.text().catch(() => '');
      if (!geminiBodyText) {
        return NextResponse.json({ response: 'Gemini API returned an empty response. Check your API key and model name.' }, { status: 500 });
      }
      try {
        data = JSON.parse(geminiBodyText);
      } catch {
        return NextResponse.json({ response: 'Gemini API returned invalid JSON: ' + geminiBodyText.slice(0, 200) }, { status: 500 });
      }
      aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini';
    } else if (apiProvider === 'groq') {
      // Groq API (OpenAI-compatible)
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: aiModel,
          messages: messages,
          temperature: 0.5,
          max_tokens: 1024,
          stream: stream
        })
      });

      if (response.ok && stream && response.body) {
        // Return raw SSE stream for Groq
        return new Response(response.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        });
      }

      const groqBodyText = await response.text().catch(() => '');
      if (!groqBodyText) {
        return NextResponse.json({ response: 'Groq API returned an empty response. Check your API key and model name.' }, { status: 500 });
      }
      try {
        data = JSON.parse(groqBodyText);
      } catch {
        return NextResponse.json({ response: 'Groq API returned invalid JSON: ' + groqBodyText.slice(0, 200) }, { status: 500 });
      }
      aiResponse = data.choices?.[0]?.message?.content || 'No response from Groq';
    } else if (apiProvider === 'openrouter') {
      // OpenRouter API (OpenAI-compatible)
      const openrouterKey = req.headers.get('x-api-key-openrouter') || process.env.OPENROUTER_API_KEY || '';
      if (!openrouterKey) {
        return NextResponse.json({
          response: 'OpenRouter API key not configured. Add an x-api-key-openrouter header or set OPENROUTER_API_KEY env var.',
          error: { type: 'MISSING_API_KEY', message: 'OpenRouter key required' }
        }, { status: 500 });
      }

      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: aiModel,
          messages: messages,
          temperature: 0.5,
          max_tokens: 1024,
          stream: stream
        })
      });

      if (response.ok && stream && response.body) {
        return new Response(response.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        });
      }

      const orBodyText = await response.text().catch(() => '');
      if (!orBodyText) {
        return NextResponse.json({ response: 'OpenRouter API returned an empty response. Check your API key and model name.' }, { status: 500 });
      }
      try {
        data = JSON.parse(orBodyText);
      } catch {
        return NextResponse.json({ response: 'OpenRouter API returned invalid JSON: ' + orBodyText.slice(0, 200) }, { status: 500 });
      }
      aiResponse = data.choices?.[0]?.message?.content || 'No response from OpenRouter';
    } else {
      // Fallback: treat as Groq-compatible (OpenAI API format)
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: aiModel,
          messages: messages,
          temperature: 0.5,
          max_tokens: 1024,
          stream: stream
        })
      });

      if (response.ok && stream && response.body) {
        return new Response(response.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        });
      }

      const fallbackBodyText = await response.text().catch(() => '');
      if (!fallbackBodyText) {
        return NextResponse.json({ response: 'AI API returned an empty response. Check your API key and model name.' }, { status: 500 });
      }
      try {
        data = JSON.parse(fallbackBodyText);
      } catch {
        return NextResponse.json({ response: 'AI API returned invalid JSON: ' + fallbackBodyText.slice(0, 200) }, { status: 500 });
      }
      aiResponse = data.choices?.[0]?.message?.content || 'No response from AI';
    }

    if (!response.ok) {
      console.error('=== AI API ERROR ===');
      console.error('Response Status:', response.status);
      console.error('Response Status Text:', response.statusText);
      console.error('Error Data:', data);
      console.error('Headers:', Object.fromEntries(response.headers.entries()));
      
      // Special handling for 413 (Payload Too Large)
      if (response.status === 413) {
        return NextResponse.json({ 
          response: `Groq Error: Payload too large. Try reducing context or using a different model.`,
          error: {
            type: 'PAYLOAD_TOO_LARGE',
            message: 'The prompt is too large for Groq API. Try using Gemini models or reduce the context.',
            retryAfter: response.headers.get('retry-after'),
            rateLimit: {
              requests: response.headers.get('x-ratelimit-limit-requests'),
              tokens: response.headers.get('x-ratelimit-limit-tokens')
            }
          },
          status: response.status 
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        response: `API Error: ${data.error?.message || data.message || 'Unknown error'}`,
        error: data,
        status: response.status 
      }, { status: 500 });
    }

    return NextResponse.json({ response: aiResponse });
  } catch (error: any) {
    console.error('=== SERVER ERROR ===');
    console.error('Error:', error);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    
    return NextResponse.json({ 
      response: `Error: ${error.message}`,
      error: error.stack 
    }, { status: 500 });
  }
}