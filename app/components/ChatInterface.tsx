'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  selectedContexts: string[];
  notes: {id: string, title: string, content: string}[];
  aiModel: 'gemini-flash' | 'gemini-2.5' | 'groq';
  userProfile: any;
  sheetData: any;
}

export default function ChatInterface({ selectedContexts, notes, aiModel, userProfile, sheetData }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Add empty assistant message
    const assistantIndex = messages.length + 1;
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    const contextData = notes.filter(n => selectedContexts.includes(n.id));
    
    let sheetContext = selectedContexts.includes('sheet') ? sheetData : null;

    let notionContext = null;
    const notionIds = selectedContexts.filter(c => c.startsWith('notion-'));
    if (notionIds.length > 0) {
      const res = await fetch('/api/notion');
      const data = await res.json();
      notionContext = data.pages?.filter((p: any) => notionIds.includes(`notion-${p.id}`));
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input, 
          context: contextData, 
          sheetData: sheetContext,
          notionData: notionContext,
          userProfile: userProfile,
          conversationHistory: messages.slice(-6),
          aiModel: aiModel,
          stream: true
        })
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          fullText += text;
          
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[assistantIndex] = { role: 'assistant', content: fullText };
            return newMessages;
          });
        }
      } else {
        const data = await res.json();
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[assistantIndex] = { role: 'assistant', content: data.response };
          return newMessages;
        });
      }
    } catch (error) {
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[assistantIndex] = { role: 'assistant', content: 'Error: Could not get response' };
        return newMessages;
      });
    }
    setLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2 rounded-lg ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 text-gray-100 prose-chat'
            }`}>
              {msg.role === 'assistant' ? (
                <ReactMarkdown>
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 text-gray-100 px-4 py-2 rounded-lg flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-700 bg-gray-800 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask a question..."
            className="flex-1 px-4 py-2 border border-gray-600 bg-gray-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg disabled:bg-gray-600 hover:bg-blue-700"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
