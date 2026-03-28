import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { message, context, sheetData, notionData, userProfile, mealHistory, workspacePrompt, conversationHistory, aiModel, stream } = await req.json();

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

    messages.push({ role: 'user', content: message });

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
      geminiPrompt += `user: ${message}`;

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
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: messages,
          temperature: 0.5,
          max_tokens: 1024,
          stream: stream
        })
      });

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
      aiResponse = data.choices?.[0]?.message?.content || 'No response from Groq';
    }

    if (!response.ok) {
      console.error('AI API Error:', data);
      return NextResponse.json({ response: `API Error: ${data.error?.message || 'Unknown error'}` }, { status: 500 });
    }

    return NextResponse.json({ response: aiResponse });
  } catch (error: any) {
    console.error('Server Error:', error);
    return NextResponse.json({ response: `Error: ${error.message}` }, { status: 500 });
  }
}