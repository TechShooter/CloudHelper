'use client';

import { useState } from 'react';
import { MODELS, type Model } from '../lib/models';

const LOCAL_MODELS: Model[] = [
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
    category: 'auto' as const
  }
];

const ALL_MODELS = [...LOCAL_MODELS, ...MODELS];

interface ModelSelectorProps {
  selectedModel: string;
  onModelSelect: (modelId: string) => void;
}

export default function ModelSelector({ selectedModel, onModelSelect }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'gemini' | 'groq' | 'auto'>('all');

  const selectedModelData = ALL_MODELS.find(m => m.id === selectedModel);

  const filteredModels = selectedCategory === 'all'
    ? ALL_MODELS
    : ALL_MODELS.filter(m => m.category === selectedCategory);

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-lg bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white sm:px-3 sm:py-2 sm:text-sm"
      >
        <span className="truncate">
          {selectedModelData?.name || 'Model'}
        </span>
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

            {/* Category Filter with Rate Limit Buttons */}
            <div className="flex gap-2 mb-4 flex-wrap items-center">
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
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-gray-400">Limits:</span>
                <a
                  href="https://aistudio.google.com/rate-limit?timeRange=last-7-days&project=gen-lang-client-0415055055"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded text-sm bg-purple-600 text-white hover:bg-purple-700 cursor-pointer transition-colors"
                >
                  🔮 Gemini
                </a>
                <a
                  href="https://console.groq.com/settings/limits"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded text-sm bg-green-600 text-white hover:bg-green-700 cursor-pointer transition-colors"
                >
                  ⚡ Groq
                </a>
              </div>
            </div>

            {/* Models List */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {filteredModels.map((model: Model) => (
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
                          <div className="text-xs text-gray-400 mt-1">
                            <div>📊 {model.limits?.requestsPerMinute} req/min</div>
                            <div>📅 {model.limits?.requestsPerDay} req/day</div>
                            <div>🔢 {model.limits?.tokensPerMinute} tokens/min</div>
                            <div>💾 {model.limits?.tokensPerDay} tokens/day</div>
                          </div>
                        </div>
                        <div className="bg-gray-800 rounded p-2">
                          <div className="text-gray-400">Tokens/min</div>
                          <div className="text-white font-medium">
                            {model.limits?.tokensPerMinute}
                          </div>
                        </div>
                        <div className="bg-gray-800 rounded p-2">
                          <div className="text-gray-400">Tokens/day</div>
                          <div className="text-white font-medium">
                            {model.limits?.tokensPerDay}
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
