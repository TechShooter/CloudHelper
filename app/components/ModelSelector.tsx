'use client';

import { useState } from 'react';

interface Model {
  id: string;
  name: string;
  provider: string;
  description: string;
  limits: {
    requestsPerMinute: number;
    requestsPerDay: string;
    tokensPerMinute: string;
    tokensPerDay: string;
  };
  category: 'gemini' | 'groq' | 'auto';
}

const MODELS: Model[] = [
  {
    id: 'gemini-flash',
    name: 'Gemini Flash Latest',
    provider: 'Google',
    description: 'Veloce, efficiente, ottimo per chat generiche',
    limits: {
      requestsPerMinute: 15,
      requestsPerDay: '1,500',
      tokensPerMinute: '1M',
      tokensPerDay: 'Unlimited'
    },
    category: 'gemini'
  },
  {
    id: 'gemini-2.5',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    description: 'Più recente e potente di Flash',
    limits: {
      requestsPerMinute: 15,
      requestsPerDay: '1,500',
      tokensPerMinute: '1M',
      tokensPerDay: 'Unlimited'
    },
    category: 'gemini'
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    description: 'Il più potente per compiti complessi',
    limits: {
      requestsPerMinute: 5,
      requestsPerDay: '500',
      tokensPerMinute: '2M',
      tokensPerDay: 'Unlimited'
    },
    category: 'gemini'
  },
  {
    id: 'auto',
    name: 'Auto Model',
    provider: 'CloudHelper',
    description: 'Seleziona automaticamente il modello migliore in base al contesto',
    limits: {
      requestsPerMinute: 0,
      requestsPerDay: 'N/A',
      tokensPerMinute: 'N/A',
      tokensPerDay: 'N/A'
    },
    category: 'auto'
  },
  // Groq Models
  {
    id: 'groq-allam-2-7b',
    name: 'Allam 2 7B',
    provider: 'Groq',
    description: 'Modello arabo bilanciato',
    limits: {
      requestsPerMinute: 30,
      requestsPerDay: '7K',
      tokensPerMinute: '6K',
      tokensPerDay: '500K'
    },
    category: 'groq'
  },
  {
    id: 'groq-compound',
    name: 'Compound',
    provider: 'Groq',
    description: 'Modello versatile per compiti generici',
    limits: {
      requestsPerMinute: 30,
      requestsPerDay: '250',
      tokensPerMinute: '70K',
      tokensPerDay: 'Unlimited'
    },
    category: 'groq'
  },
  {
    id: 'groq-compound-mini',
    name: 'Compound Mini',
    provider: 'Groq',
    description: 'Versione leggera di Compound',
    limits: {
      requestsPerMinute: 30,
      requestsPerDay: '250',
      tokensPerMinute: '70K',
      tokensPerDay: 'Unlimited'
    },
    category: 'groq'
  },
  {
    id: 'groq-llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    provider: 'Groq',
    description: 'Velocità istantanea, ottimo per chat',
    limits: {
      requestsPerMinute: 30,
      requestsPerDay: '14.4K',
      tokensPerMinute: '6K',
      tokensPerDay: '500K'
    },
    category: 'groq'
  },
  {
    id: 'groq-llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    provider: 'Groq',
    description: 'Il più potente di Groq, molto versatile',
    limits: {
      requestsPerMinute: 30,
      requestsPerDay: '1K',
      tokensPerMinute: '12K',
      tokensPerDay: '100K'
    },
    category: 'groq'
  },
  {
    id: 'groq-llama-4-scout-17b',
    name: 'Llama 4 Scout 17B',
    provider: 'Groq',
    description: 'Modello scout di nuova generazione',
    limits: {
      requestsPerMinute: 30,
      requestsPerDay: '1K',
      tokensPerMinute: '30K',
      tokensPerDay: '500K'
    },
    category: 'groq'
  },
  {
    id: 'groq-llama-prompt-guard-2-22m',
    name: 'Llama Prompt Guard 2 22M',
    provider: 'Groq',
    description: 'Specializzato in sicurezza dei prompt',
    limits: {
      requestsPerMinute: 30,
      requestsPerDay: '14.4K',
      tokensPerMinute: '15K',
      tokensPerDay: '500K'
    },
    category: 'groq'
  },
  {
    id: 'groq-llama-prompt-guard-2-86m',
    name: 'Llama Prompt Guard 2 86M',
    provider: 'Groq',
    description: 'Sicurezza avanzata dei prompt',
    limits: {
      requestsPerMinute: 30,
      requestsPerDay: '14.4K',
      tokensPerMinute: '15K',
      tokensPerDay: '500K'
    },
    category: 'groq'
  },
  {
    id: 'groq-kimi-k2-instruct',
    name: 'Kimi K2 Instruct',
    provider: 'Groq',
    description: 'Modello istruction-tuned veloce',
    limits: {
      requestsPerMinute: 60,
      requestsPerDay: '1K',
      tokensPerMinute: '10K',
      tokensPerDay: '300K'
    },
    category: 'groq'
  },
  {
    id: 'groq-kimi-k2-instruct-0905',
    name: 'Kimi K2 Instruct 0905',
    provider: 'Groq',
    description: 'Versione aggiornata di Kimi K2',
    limits: {
      requestsPerMinute: 60,
      requestsPerDay: '1K',
      tokensPerMinute: '10K',
      tokensPerDay: '300K'
    },
    category: 'groq'
  },
  {
    id: 'groq-gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'Groq',
    description: 'Modello open source di grandi dimensioni',
    limits: {
      requestsPerMinute: 30,
      requestsPerDay: '1K',
      tokensPerMinute: '8K',
      tokensPerDay: '200K'
    },
    category: 'groq'
  },
  {
    id: 'groq-gpt-oss-20b',
    name: 'GPT-OSS 20B',
    provider: 'Groq',
    description: 'Modello open source bilanciato',
    limits: {
      requestsPerMinute: 30,
      requestsPerDay: '1K',
      tokensPerMinute: '8K',
      tokensPerDay: '200K'
    },
    category: 'groq'
  },
  {
    id: 'groq-gpt-oss-safeguard-20b',
    name: 'GPT-OSS Safeguard 20B',
    provider: 'Groq',
    description: 'Modello con sicurezza integrata',
    limits: {
      requestsPerMinute: 30,
      requestsPerDay: '1K',
      tokensPerMinute: '8K',
      tokensPerDay: '200K'
    },
    category: 'groq'
  },
  {
    id: 'groq-qwen3-32b',
    name: 'Qwen3 32B',
    provider: 'Groq',
    description: 'Modello cinese versatile',
    limits: {
      requestsPerMinute: 60,
      requestsPerDay: '1K',
      tokensPerMinute: '6K',
      tokensPerDay: '500K'
    },
    category: 'groq'
  }
];

interface ModelSelectorProps {
  selectedModel: string;
  onModelSelect: (modelId: string) => void;
}

export default function ModelSelector({ selectedModel, onModelSelect }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'gemini' | 'groq' | 'auto'>('all');

  const selectedModelData = MODELS.find(m => m.id === selectedModel);

  const filteredModels = selectedCategory === 'all' 
    ? MODELS 
    : MODELS.filter(m => m.category === selectedCategory);

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gray-700 text-white px-3 py-2 rounded text-sm border border-gray-600 hover:bg-gray-600 min-w-0 flex-1 sm:flex-none text-left"
      >
        <div className="flex items-center justify-between">
          <span className="truncate">
            {selectedModelData?.name || 'Select Model'}
          </span>
        </div>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">🤖 Select AI Model</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded text-sm ${
                  selectedCategory === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                All Models
              </button>
              <button
                onClick={() => setSelectedCategory('gemini')}
                className={`px-3 py-1 rounded text-sm ${
                  selectedCategory === 'gemini'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                🔮 Gemini
              </button>
              <button
                onClick={() => setSelectedCategory('groq')}
                className={`px-3 py-1 rounded text-sm ${
                  selectedCategory === 'groq'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                ⚡ Groq
              </button>
              <button
                onClick={() => setSelectedCategory('auto')}
                className={`px-3 py-1 rounded text-sm ${
                  selectedCategory === 'auto'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                🤖 Auto
              </button>
            </div>

            {/* Models List */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {filteredModels.map((model) => (
                <div
                  key={model.id}
                  onClick={() => {
                    onModelSelect(model.id);
                    setIsOpen(false);
                  }}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedModel === model.id
                      ? 'bg-blue-600 border-blue-500'
                      : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-white">{model.name}</h4>
                        <span className="text-xs bg-gray-600 text-gray-300 px-2 py-1 rounded">
                          {model.provider}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 mb-2">{model.description}</p>
                      
                      {/* Limits */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-gray-800 rounded p-2">
                          <div className="text-gray-400">Req/min</div>
                          <div className="text-white font-medium">
                            {model.limits.requestsPerMinute || 'N/A'}
                          </div>
                        </div>
                        <div className="bg-gray-800 rounded p-2">
                          <div className="text-gray-400">Req/day</div>
                          <div className="text-white font-medium">
                            {model.limits.requestsPerDay}
                          </div>
                        </div>
                        <div className="bg-gray-800 rounded p-2">
                          <div className="text-gray-400">Tokens/min</div>
                          <div className="text-white font-medium">
                            {model.limits.tokensPerMinute}
                          </div>
                        </div>
                        <div className="bg-gray-800 rounded p-2">
                          <div className="text-gray-400">Tokens/day</div>
                          <div className="text-white font-medium">
                            {model.limits.tokensPerDay}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {selectedModel === model.id && (
                      <div className="ml-4">
                        <div className="text-blue-400 text-xl">✓</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
