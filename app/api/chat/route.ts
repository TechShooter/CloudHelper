import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { message, context, sheetData, conversationHistory, aiModel } = await req.json();

    let systemPrompt = '';
    
    if (sheetData && sheetData.length > 0) {
      systemPrompt = 'Google Sheet Database (showing first 50 rows):\n';
      const headers = sheetData[0];
      systemPrompt += headers.join(' | ') + '\n';
      sheetData.slice(1).forEach((row: string[]) => {
        systemPrompt += row.join(' | ') + '\n';
      });
      systemPrompt += '\n---\n\n';
      systemPrompt += 'Note: If you need to search for specific data in the database, ask the user to be more specific.\n\n';
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

    if (aiModel === 'gemini-flash' || aiModel === 'gemini-2.5') {
      // Google Gemini API
      const modelName = aiModel === 'gemini-2.5' ? 'gemini-2.5-flash' : 'gemini-flash-latest';
      
      let geminiPrompt = '';
      if (systemPrompt) geminiPrompt += systemPrompt + '\n\n';
      if (conversationHistory && conversationHistory.length > 0) {
        conversationHistory.forEach((msg: any) => {
          geminiPrompt += `${msg.role}: ${msg.content}\n`;
        });
      }
      geminiPrompt += `user: ${message}`;

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
      // Groq API
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
          max_tokens: 1024
        })
      });
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
