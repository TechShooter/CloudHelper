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
}

export default function ChatInterface({ selectedContexts, notes, aiModel }: Props) {
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

    const contextData = notes.filter(n => selectedContexts.includes(n.id));
    
    let sheetContext = null;
    if (selectedContexts.includes('sheet')) {
      const res = await fetch('/api/sheets');
      const data = await res.json();
      sheetContext = data.data;
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input, 
          context: contextData, 
          sheetData: sheetContext,
          conversationHistory: messages.slice(-6),
          aiModel: aiModel
        })
      });

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: Could not get response' }]);
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
            <div className="bg-gray-700 text-gray-100 px-4 py-2 rounded-lg">Thinking...</div>
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
