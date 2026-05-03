// Cloudflare Pages Function for /api/chat
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { context: userContext, sheetData, notionData, workspacePrompt, conversationHistory, aiModel, stream, calendarEvents, nutrientEntries } = await request.json();

    const isGeminiModel = (model) => model?.startsWith('gemini');

    let systemPrompt = '';

    if (workspacePrompt) {
      systemPrompt += workspacePrompt + '\n\n---\n\n';
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    systemPrompt += `Current Date & Time: ${dateStr}, ore ${timeStr}\n\n---\n\n`;

    if (sheetData && Array.isArray(sheetData)) {
      systemPrompt += 'Google Sheets Database (ALL SHEETS - COMPLETE DATA):\n\n';
      sheetData.forEach((sheet) => {
        systemPrompt += `\n=== ${sheet.sheet} (${sheet.rows} rows) ===\n`;
        if (sheet.data && sheet.data.length > 0) {
          sheet.data.forEach((row) => {
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
      calendarEvents.forEach((event) => {
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
      const totals = nutrientEntries.reduce((acc, entry) => ({
        energy: acc.energy + entry.energy,
        protein: acc.protein + entry.protein,
        carbs: acc.carbs + entry.carbs,
        fats: acc.fats + entry.fats
      }), { energy: 0, protein: 0, carbs: 0, fats: 0 });
      
      systemPrompt += `Total: ${totals.energy.toFixed(0)} kJ | Protein: ${totals.protein.toFixed(1)}g | Carbs: ${totals.carbs.toFixed(1)}g | Fats: ${totals.fats.toFixed(1)}g\n\n`;
      systemPrompt += 'Entries:\n';
      nutrientEntries.forEach((entry) => {
        systemPrompt += `- ${entry.food} (${entry.grams}g) at ${new Date(entry.time).toLocaleString('it-IT')}: ${entry.energy.toFixed(0)} kJ | P: ${entry.protein.toFixed(1)}g | C: ${entry.carbs.toFixed(1)}g | F: ${entry.fats.toFixed(1)}g\n`;
      });
      systemPrompt += '\n---\n\n';
    }

    if (notionData && notionData.length > 0) {
      systemPrompt += 'Notion Pages:\n\n';
      notionData.forEach((page) => {
        systemPrompt += `[${page.title}]\n${page.content}\n\n`;
      });
      systemPrompt += '---\n\n';
    }

    if (userContext && userContext.length > 0) {
      systemPrompt += 'My Notes:\n\n';
      userContext.forEach((note) => {
        systemPrompt += `[${note.title}]\n${note.content}\n\n`;
      });
      systemPrompt += `---\n\n`;
    }

    const messages = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach((msg) => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }

    messages.push({ role: 'user', content: conversationHistory[conversationHistory.length - 1]?.content || '' });

    let response, data, aiResponse;

    if (isGeminiModel(aiModel)) {
      let geminiPrompt = '';
      if (systemPrompt) geminiPrompt += systemPrompt + '\n\n';
      if (conversationHistory && conversationHistory.length > 0) {
        conversationHistory.forEach((msg) => {
          geminiPrompt += `${msg.role}: ${msg.content}\n`;
        });
      }
      geminiPrompt += `user: ${conversationHistory[conversationHistory.length - 1]?.content || ''}`;

      if (stream) {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:streamGenerateContent?alt=sse&key=${env.GEMINI_API_KEY}`,
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
        `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${env.GEMINI_API_KEY}`,
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
          'Authorization': `Bearer ${env.GROQ_API_KEY}`,
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

      if (stream && response.body) {
        return new Response(response.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        });
      }

      data = await response.json();
      aiResponse = data.choices?.[0]?.message?.content || 'No response from Groq';
    }

    if (!response.ok) {
      if (response.status === 413) {
        return new Response(JSON.stringify({ 
          response: `Groq Error: Payload too large. Try reducing context or using a different model.`,
          error: {
            type: 'PAYLOAD_TOO_LARGE',
            message: 'The prompt is too large for Groq API. Try using Gemini models or reduce the context.'
          },
          status: response.status 
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      
      return new Response(JSON.stringify({ 
        response: `API Error: ${data.error?.message || data.message || 'Unknown error'}`,
        error: data,
        status: response.status 
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      response: `Error: ${error.message}`,
      error: error.stack 
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
