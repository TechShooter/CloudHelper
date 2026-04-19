import { NextRequest, NextResponse } from 'next/server';
import { isGeminiModel } from '../../lib/models';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { context, sheetData, notionData, workspacePrompt, conversationHistory, aiModel, stream, calendarEvents, nutrientEntries } = await req.json();

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

    if (isGeminiModel(aiModel)) {
      let geminiPrompt = '';
      if (systemPrompt) geminiPrompt += systemPrompt + '\n\n';
      if (conversationHistory && conversationHistory.length > 0) {
        conversationHistory.forEach((msg: any) => {
          geminiPrompt += `${msg.role}: ${msg.content}\n`;
        });
      }
      geminiPrompt += `user: ${conversationHistory[conversationHistory.length - 1]?.content || ''}`;

      if (stream) {
        // Gemini streaming - test raw passthrough
        console.log('[STREAM] Starting Gemini stream for model:', aiModel);
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: geminiPrompt }] }]
            })
          }
        );

        console.log('[STREAM] Response status:', response.status, response.statusText);

        if (response.ok && response.body) {
          console.log('[STREAM] Returning raw SSE stream');
          return new Response(response.body, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive'
            }
          });
        } else {
          console.error('[STREAM] Response not ok or no body');
        }
      }

      // Non-streaming fallback
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: geminiPrompt }] }]
          })
        }
      );
      data = await response.json();
      aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini';
    } else {
      // Groq models - use aiModel directly since IDs are now API names
      console.log('[STREAM] Starting Groq stream for model:', aiModel);
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
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

      console.log('[STREAM] Response status:', response.status, response.statusText);
      console.log('[STREAM] Response headers:', Object.fromEntries(response.headers.entries()));

      if (stream && response.body) {
        // Handle Groq streaming
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let chunkCount = 0;
        let totalBytes = 0;

        const { readable, writable } = new TransformStream({
          transform(chunk, controller) {
            chunkCount++;
            totalBytes += chunk.length;
            console.log('[STREAM] Chunk', chunkCount, 'size:', chunk.length, 'total:', totalBytes);

            const text = decoder.decode(chunk, { stream: true });
            const lines = text.split('\n');
            console.log('[STREAM] Lines in chunk:', lines.length);

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6);
                if (jsonStr === '[DONE]') {
                  console.log('[STREAM] Received [DONE] signal');
                  continue;
                }
                try {
                  const parsed = JSON.parse(jsonStr);
                  const text = parsed.choices?.[0]?.delta?.content;
                  if (text) {
                    console.log('[STREAM] Enqueuing text content, length:', text.length);
                    controller.enqueue(encoder.encode(text));
                  }
                } catch (e) {
                  console.log('[STREAM] Failed to parse JSON:', jsonStr.substring(0, 100));
                }
              }
            }
          },
          flush(controller) {
            console.log('[STREAM] TransformStream flush called, total chunks:', chunkCount, 'total bytes:', totalBytes);
          }
        });

        console.log('[STREAM] Starting pipeTo');
        // Start pumping the body. NOTE: No await!
        response.body.pipeTo(writable).catch(err => {
          console.error('[STREAM] pipeTo error:', err);
        });

        console.log('[STREAM] Returning Response with readable stream');
        return new Response(readable, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        });
      }

      data = await response.json();
      aiResponse = data.choices?.[0]?.message?.content || 'No response from Groq';
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