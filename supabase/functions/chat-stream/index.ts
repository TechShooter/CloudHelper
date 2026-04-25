// @ts-ignore - Deno and JSR modules are only available in Supabase Edge Functions environment
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
// @ts-ignore - Deno and JSR modules are only available in Supabase Edge Functions environment
import { createClient } from 'jsr:@supabase/supabase-js@2'

// @ts-ignore
const supabaseUrl = Deno.env.get('PROJECT_URL')
// @ts-ignore
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY')
// @ts-ignore
const supabaseAnonKey = Deno.env.get('ANON_KEY')

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('[Edge Function] Missing environment variables:', { 
    hasUrl: !!supabaseUrl, 
    hasServiceKey: !!supabaseServiceKey,
    hasAnonKey: !!supabaseAnonKey
  })
}

// @ts-ignore
Deno.serve(async (req: Request) => {
  console.log('[Edge Function] Request received, method:', req.method)
  
  // Check environment variables
  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    console.error('[Edge Function] Missing environment variables')
    return new Response(JSON.stringify({ 
      error: 'Server configuration error: Missing environment variables' 
    }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
  
  // Handle CORS preflight request (must be before JSON parsing)
  if (req.method === 'OPTIONS') {
    console.log('[Edge Function] Handling OPTIONS request')
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
    console.log('[Edge Function] Parsing JSON body')
    const { 
      context, 
      sheetData, 
      notionData, 
      workspacePrompt, 
      conversationHistory, 
      aiModel, 
      stream: enableStream, 
      calendarEvents, 
      nutrientEntries, 
      chatId 
    } = await req.json()
    console.log('[Edge Function] JSON parsed, chatId:', chatId)

    if (!chatId) {
      return new Response(JSON.stringify({ error: 'chatId is required' }), { 
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // Create Supabase client with anon key for auth validation
    console.log('[Edge Function] Creating Supabase client for auth, URL:', supabaseUrl)
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)

    // Get user from auth header
    console.log('[Edge Function] Getting auth header')
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('[Edge Function] No auth header found')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    console.log('[Edge Function] Validating user token')
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      console.log('[Edge Function] Invalid token:', userError)
      return new Response(JSON.stringify({ error: 'Invalid token' }), { 
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
    console.log('[Edge Function] User validated:', user.id)

    // Create Supabase client with service role key for DB operations
    console.log('[Edge Function] Creating Supabase client for DB operations')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Build system prompt (same logic as /api/chat)
    console.log('[Edge Function] Building system prompt')
    let systemPrompt = ''
    if (workspacePrompt) {
      systemPrompt += workspacePrompt + '\n\n---\n\n'
    }

    const now = new Date()
    const dateStr = now.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const timeStr = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    systemPrompt += `Current Date & Time: ${dateStr}, ore ${timeStr}\n\n---\n\n`

    if (context) {
      systemPrompt += context + '\n\n---\n\n'
    }

    if (sheetData && sheetData.length > 0) {
      systemPrompt += 'Sheet Data:\n'
      sheetData.forEach((row: any) => {
        systemPrompt += JSON.stringify(row) + '\n'
      })
      systemPrompt += '\n---\n\n'
    }

    if (notionData && notionData.length > 0) {
      systemPrompt += 'Notion Data:\n'
      notionData.forEach((page: any) => {
        systemPrompt += JSON.stringify(page) + '\n'
      })
      systemPrompt += '\n---\n\n'
    }

    if (context && context.length > 0) {
      systemPrompt += 'My Notes:\n\n'
      context.forEach((note: any) => {
        systemPrompt += `[${note.title}]\n${note.content}\n\n`
      })
      systemPrompt += `---\n\n`
    }

    // Determine if Gemini or Groq model
    console.log('[Edge Function] Determining AI model')
    const isGemini = aiModel?.includes('gemini') || aiModel?.includes('flash')
    console.log('[Edge Function] isGemini:', isGemini, 'aiModel:', aiModel)

    let response: Response

    if (isGemini) {
      console.log('[Edge Function] Calling Gemini API')
      // Gemini API call
      let geminiPrompt = ''
      if (systemPrompt) geminiPrompt += systemPrompt + '\n\n'
      if (conversationHistory && conversationHistory.length > 0) {
        conversationHistory.forEach((msg: any) => {
          geminiPrompt += `${msg.role}: ${msg.content}\n`
        })
      }
      geminiPrompt += `user: ${conversationHistory[conversationHistory.length - 1]?.content || ''}`

      response = await fetch(
        // @ts-ignore
        `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:streamGenerateContent?alt=sse&key=${Deno.env.get('GEMINI_API_KEY')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: geminiPrompt }] }]
          })
        }
      )
    } else {
      console.log('[Edge Function] Calling Groq API')
      // Groq API call
      const messages = []
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt })
      }
      if (conversationHistory && conversationHistory.length > 0) {
        conversationHistory.forEach((msg: any) => {
          messages.push({ role: msg.role, content: msg.content })
        })
      }
      messages.push({ role: 'user', content: conversationHistory[conversationHistory.length - 1]?.content || '' })

      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          // @ts-ignore
          'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: aiModel,
          messages: messages,
          temperature: 0.5,
          max_tokens: 1024,
          stream: true
        })
      })
    }
    console.log('[Edge Function] API call completed, response ok:', response.ok)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'API Error' }))
      console.error('[Edge Function] API Error:', errorData, 'Status:', response.status)
      
      // Extract detailed error message for both Gemini and Groq
      let errorMessage = 'API Error'
      if (errorData.error?.message) {
        errorMessage = errorData.error.message
      } else if (errorData.message) {
        errorMessage = errorData.message
      } else if (typeof errorData.error === 'string') {
        errorMessage = errorData.error
      }
      
      return new Response(JSON.stringify({ 
        response: errorMessage,
        status: response.status 
      }), { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // Process stream and save to Supabase in real-time
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const reader = response.body!.getReader()
    let fullText = ''
    let chunkCount = 0
    const SAVE_INTERVAL = 500
    const CHUNKS_PER_SAVE = 10
    let lastSaveTime = Date.now()

    const saveToSupabase = async (content: string) => {
      try {
        const messagesToSave = [
          ...conversationHistory,
          { role: 'assistant', content }
        ]
        
        await supabase
          .from('chat_messages')
          .delete()
          .eq('user_id', user.id)
          .eq('chat_id', chatId)
        
        await supabase
          .from('chat_messages')
          .insert(
            messagesToSave.map((msg) => ({
              user_id: user.id,
              chat_id: chatId,
              role: msg.role,
              content: msg.content
            }))
          )
        
        console.log('[Edge Function] Saved to Supabase, content length:', content.length)
      } catch (error) {
        console.error('[Edge Function] Error saving to Supabase:', error)
      }
    }

    const responseStream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6)
                if (jsonStr === '[DONE]') continue
                try {
                  const parsed = JSON.parse(jsonStr)
                  let textContent = isGemini 
                    ? parsed.candidates?.[0]?.content?.parts?.[0]?.text
                    : parsed.choices?.[0]?.delta?.content
                  
                  if (textContent) {
                    fullText += textContent
                    chunkCount++
                    
                    // Send chunk to client
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: textContent, chatId })}\n\n`))
                    
                    // Save to Supabase periodically
                    const now = Date.now()
                    if (chunkCount % CHUNKS_PER_SAVE === 0 || (now - lastSaveTime) >= SAVE_INTERVAL) {
                      await saveToSupabase(fullText)
                      lastSaveTime = now
                    }
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
          
          // Final save when stream completes
          if (fullText) {
            await saveToSupabase(fullText)
          }
        } catch (error) {
          console.error('[Edge Function] Stream processing error:', error)
        } finally {
          controller.close()
        }
      }
    })

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error: any) {
    console.error('[Edge Function] Error:', error)
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error'
    }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
})
