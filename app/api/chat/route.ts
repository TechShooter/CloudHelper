import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { context, sheetData, notionData, userProfile, mealHistory, workspacePrompt, conversationHistory, aiModel, stream, calendarEvents, nutrientEntries } = await req.json();

    console.log('=== CHAT API DEBUG ===');
    console.log('AI Model:', aiModel);
    console.log('Stream:', stream);
    console.log('GROQ_API_KEY exists:', !!process.env.GROQ_API_KEY);
    console.log('GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
    console.log('Notion Data received:', notionData);

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

    if (userProfile && (userProfile.calories || userProfile.goal)) {
      systemPrompt += 'User Profile & Goals:\n';
      if (userProfile.calories) systemPrompt += `Daily Calories: ${userProfile.calories}\n`;
      if (userProfile.protein) systemPrompt += `Protein: ${userProfile.protein}\n`;
      if (userProfile.carbs) systemPrompt += `Carbs: ${userProfile.carbs}\n`;
      if (userProfile.fats) systemPrompt += `Fats: ${userProfile.fats}\n`;
      if (userProfile.goal) systemPrompt += `Goal: ${userProfile.goal}\n`;
      if (userProfile.notes) systemPrompt += `Notes: ${userProfile.notes}\n`;
      systemPrompt += '\n---\n\n';
    }

    if (mealHistory && mealHistory.length > 0) {
      systemPrompt += 'Meal History (Last 7 Days):\n';
      mealHistory.forEach((meal: any) => {
        systemPrompt += `${meal.date} ${meal.time} - ${meal.type}: ${meal.food}`;
        if (meal.calories) systemPrompt += ` (${meal.calories} kcal)`;
        if (meal.notes) systemPrompt += ` - ${meal.notes}`;
        systemPrompt += '\n';
      });
      systemPrompt += '\n---\n\n';
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

    // Log prompt size for debugging
    const promptSize = JSON.stringify(messages).length;
    console.log('Prompt Size (characters):', promptSize);
    console.log('Number of messages:', messages.length);
    console.log('System Prompt Length:', systemPrompt.length);

    let response, data, aiResponse;

    if (aiModel === 'gemini-flash' || aiModel === 'gemini-2.5' || aiModel === 'gemini-2.5-pro') {
      const modelName = aiModel === 'gemini-2.5' ? 'gemini-2.5-flash' :
        aiModel === 'gemini-2.5-pro' ? 'gemini-2.5-pro' :
          'gemini-flash-latest';

      let geminiPrompt = '';
      if (systemPrompt) geminiPrompt += systemPrompt + '\n\n';
      if (conversationHistory && conversationHistory.length > 0) {
        conversationHistory.forEach((msg: any) => {
          geminiPrompt += `${msg.role}: ${msg.content}\n`;
        });
      }
      geminiPrompt += `user: ${conversationHistory[conversationHistory.length - 1]?.content || ''}`;

      if (stream) {
        // Gemini streaming
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: geminiPrompt }] }]
            })
          }
        );

        if (response.ok && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          const encoder = new TextEncoder();

          const stream = new ReadableStream({
            async start(controller) {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  const chunk = decoder.decode(value);
                  const lines = chunk.split('\n');

                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      const jsonStr = line.slice(6);
                      try {
                        const parsed = JSON.parse(jsonStr);
                        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                          controller.enqueue(encoder.encode(text));
                        }
                      } catch (e) {
                        // Skip invalid JSON
                      }
                    }
                  }
                }
                controller.close();
              } catch (error) {
                controller.error(error);
              }
            }
          });

          return new Response(stream, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        }
      }

      // Non-streaming fallback
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
      // Groq models mapping
      const groqModelMap: { [key: string]: string } = {
        'groq-allam-2-7b': 'allam-2-7b',
        'groq-compound': 'compound-beta',
        'groq-compound-mini': 'compound-beta-mini',
        'groq-llama-3.1-8b-instant': 'llama-3.1-8b-instant',
        'groq-llama-3.3-70b-versatile': 'llama-3.3-70b-versatile',
        'groq-llama-4-scout-17b': 'meta-llama/llama-4-scout-17b-16e-instruct',
        'groq-llama-prompt-guard-2-22m': 'meta-llama/llama-prompt-guard-2-22m',
        'groq-llama-prompt-guard-2-86m': 'meta-llama/llama-prompt-guard-2-86m',
        'groq-kimi-k2-instruct': 'moonshotai/kimi-k2-instruct',
        'groq-kimi-k2-instruct-0905': 'moonshotai/kimi-k2-instruct-0905',
        'groq-gpt-oss-120b': 'openai/gpt-oss-120b',
        'groq-gpt-oss-20b': 'openai/gpt-oss-20b',
        'groq-gpt-oss-safeguard-20b': 'openai/gpt-oss-safeguard-20b',
        'groq-qwen3-32b': 'qwen/qwen3-32b'
      };

      const selectedGroqModel = groqModelMap[aiModel] || 'llama-3.3-70b-versatile';
      
      console.log('Selected Groq Model:', selectedGroqModel);
      console.log('Making Groq API call...');

      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: selectedGroqModel,
          messages: messages,
          temperature: 0.5,
          max_tokens: 1024,
          stream: stream
        })
      });

      console.log('Groq API Response Status:', response.status);
      console.log('Groq API Response Headers:', Object.fromEntries(response.headers.entries()));

      if (stream && response.body) {
        // Handle Groq streaming
        const encoder = new TextEncoder();
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        const stream = new ReadableStream({
          async start(controller) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6);
                    if (jsonStr === '[DONE]') continue;
                    try {
                      const parsed = JSON.parse(jsonStr);
                      const text = parsed.choices?.[0]?.delta?.content;
                      if (text) {
                        controller.enqueue(encoder.encode(text));
                      }
                    } catch (e) {
                      // Skip invalid JSON
                    }
                  }
                }
              }
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          }
        });

        return new Response(stream, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }

      data = await response.json();
      console.log('Groq API Response Data:', data);
      aiResponse = data.choices?.[0]?.message?.content || 'No response from Groq';
    }

    // Log response data regardless of status for debugging
    if (!data) {
      try {
        data = await response.json();
        console.log('Parsed Response Data:', data);
      } catch (parseError) {
        console.log('Failed to parse response as JSON');
        const text = await response.text();
        console.log('Raw Response Text:', text);
        data = { error: text };
      }
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

    console.log('=== API SUCCESS ===');
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