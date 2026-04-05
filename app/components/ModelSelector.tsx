'use client';

import { useState, useEffect } from 'react';

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

const DEFAULT_MODELS: Model[] = [
  // Gemini Models - Ordered by version
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    provider: 'Google',
    description: 'Versione ultra-leggera, ottima per query semplici e veloci',
    limits: {
      requestsPerMinute: 15,
      requestsPerDay: '250K',
      tokensPerMinute: '250K',
      tokensPerDay: '500'
    },
    category: 'gemini'
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'Google',
    description: 'Versione leggera e veloce per compiti quotidiani',
    limits: {
      requestsPerMinute: 10,
      requestsPerDay: '250K',
      tokensPerMinute: '250K',
      tokensPerDay: '20'
    },
    category: 'gemini'
  },
  {
    id: 'gemini-flash',
    name: 'Gemini 3 Flash',
    provider: 'Google',
    description: 'Veloce, efficiente, ottimo per chat generiche',
    limits: {
      requestsPerMinute: 5,
      requestsPerDay: '250K',
      tokensPerMinute: '250K',
      tokensPerDay: '20'
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
  const [models, setModels] = useState<Model[]>(DEFAULT_MODELS);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);

  // Load models from localStorage on mount
  useEffect(() => {
    const savedModels = localStorage.getItem('customModels');
    if (savedModels) {
      try {
        setModels(JSON.parse(savedModels));
      } catch (error) {
        console.error('Failed to load custom models:', error);
      }
    }
  }, []);

  // Save models to localStorage when they change
  const saveModels = (newModels: Model[]) => {
    setModels(newModels);
    localStorage.setItem('customModels', JSON.stringify(newModels));
  };

  const selectedModelData = models.find(m => m.id === selectedModel);

  const filteredModels = selectedCategory === 'all' 
    ? models 
    : models.filter(m => m.category === selectedCategory);

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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAdminMode(!isAdminMode)}
                  className={`px-3 py-1 rounded text-sm ${
                    isAdminMode 
                      ? 'bg-orange-600 text-white hover:bg-orange-700' 
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  {isAdminMode ? '🔧 Admin' : '👤 User'}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Admin Controls */}
            {isAdminMode && (
              <div className="mb-4 p-3 bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-white">🛠️ Model Management</h4>
                  <button
                    onClick={() => setEditingModel({
                      id: '',
                      name: '',
                      provider: '',
                      description: '',
                      limits: {
                        requestsPerMinute: 0,
                        requestsPerDay: '',
                        tokensPerMinute: '',
                        tokensPerDay: ''
                      },
                      category: 'gemini'
                    })}
                    className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                  >
                    + Add Model
                  </button>
                </div>
                <button
                  onClick={() => saveModels(DEFAULT_MODELS)}
                  className="text-xs bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
                >
                  Reset to Defaults
                </button>
              </div>
            )}

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
              {filteredModels.map((model: Model) => (
                <div
                  key={model.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    selectedModel === model.id
                      ? 'bg-blue-600 border-blue-500'
                      : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => {
                        onModelSelect(model.id);
                        setIsOpen(false);
                      }}
                    >
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
                    
                    <div className="ml-4 flex items-center gap-2">
                      {selectedModel === model.id && (
                        <div className="text-blue-400 text-xl">✓</div>
                      )}
                      {isAdminMode && (
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingModel(model);
                            }}
                            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newModels = models.filter(m => m.id !== model.id);
                              saveModels(newModels);
                            }}
                            className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Model Modal */}
      {editingModel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingModel.id ? 'Edit Model' : 'Add New Model'}
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Model ID</label>
                  <input
                    type="text"
                    value={editingModel.id}
                    onChange={(e) => setEditingModel({...editingModel, id: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    placeholder="e.g., gemini-3.1-flash-lite"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Model Name</label>
                  <input
                    type="text"
                    value={editingModel.name}
                    onChange={(e) => setEditingModel({...editingModel, name: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    placeholder="e.g., Gemini 3.1 Flash Lite"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Provider</label>
                  <input
                    type="text"
                    value={editingModel.provider}
                    onChange={(e) => setEditingModel({...editingModel, provider: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    placeholder="e.g., Google"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
                  <select
                    value={editingModel.category}
                    onChange={(e) => setEditingModel({...editingModel, category: e.target.value as 'gemini' | 'groq' | 'auto'})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  >
                    <option value="gemini">Gemini</option>
                    <option value="groq">Groq</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  value={editingModel.description}
                  onChange={(e) => setEditingModel({...editingModel, description: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  rows={2}
                  placeholder="e.g., Versione ultra-leggera, ottima per query semplici e veloci"
                />
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">Limits</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Requests/Minute</label>
                    <input
                      type="number"
                      value={editingModel.limits.requestsPerMinute}
                      onChange={(e) => setEditingModel({
                        ...editingModel, 
                        limits: {...editingModel.limits, requestsPerMinute: parseInt(e.target.value) || 0}
                      })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                      placeholder="15"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Requests/Day</label>
                    <input
                      type="text"
                      value={editingModel.limits.requestsPerDay}
                      onChange={(e) => setEditingModel({
                        ...editingModel, 
                        limits: {...editingModel.limits, requestsPerDay: e.target.value}
                      })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                      placeholder="250K"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Tokens/Minute</label>
                    <input
                      type="text"
                      value={editingModel.limits.tokensPerMinute}
                      onChange={(e) => setEditingModel({
                        ...editingModel, 
                        limits: {...editingModel.limits, tokensPerMinute: e.target.value}
                      })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                      placeholder="250K"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Tokens/Day</label>
                    <input
                      type="text"
                      value={editingModel.limits.tokensPerDay}
                      onChange={(e) => setEditingModel({
                        ...editingModel, 
                        limits: {...editingModel.limits, tokensPerDay: e.target.value}
                      })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                      placeholder="500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  if (editingModel.id && editingModel.name) {
                    if (models.find(m => m.id === editingModel.id && m.id !== editingModel.id)) {
                      alert('Model ID already exists!');
                      return;
                    }
                    
                    const newModels = editingModel.id && models.find(m => m.id === editingModel.id)
                      ? models.map(m => m.id === editingModel.id ? editingModel : m)
                      : [...models, editingModel];
                    
                    saveModels(newModels);
                    setEditingModel(null);
                  } else {
                    alert('Model ID and Name are required!');
                  }
                }}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                {editingModel.id && models.find(m => m.id === editingModel.id) ? 'Update' : 'Add'} Model
              </button>
              <button
                onClick={() => setEditingModel(null)}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
