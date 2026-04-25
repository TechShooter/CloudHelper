export interface Model {
  id: string; // This is the API model name (no redundancy)
  name: string;
  provider: string;
  description: string;
  limits?: {
    requestsPerMinute?: number;
    requestsPerDay?: string;
    tokensPerMinute?: string;
    tokensPerDay?: string;
  };
  category: 'gemini' | 'groq' | 'auto';
}

export const MODELS: Model[] = [
  // Gemini Models
  {
    id: 'gemini-3.1-flash-lite-preview',
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
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5',
    provider: 'Google',
    description: 'Versione standard per compiti generali',
    limits: {
      requestsPerMinute: 15,
      requestsPerDay: '250K',
      tokensPerMinute: '250K',
      tokensPerDay: '20'
    },
    category: 'gemini'
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    description: 'Versione avanzata per compiti complessi',
    limits: {
      requestsPerMinute: 15,
      requestsPerDay: '250K',
      tokensPerMinute: '250K',
      tokensPerDay: '20'
    },
    category: 'gemini'
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash Latest',
    provider: 'Google',
    description: 'Veloce, efficiente, ottimo per chat generiche',
    limits: {
      requestsPerMinute: 15,
      requestsPerDay: '250K',
      tokensPerMinute: '250K',
      tokensPerDay: '20'
    },
    category: 'gemini'
  },

  // Groq Models. Ignore Allam, it's for arabics
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    provider: 'Groq',
    description: 'Modello versatile per compiti generali',
    category: 'groq'
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    provider: 'Groq',
    description: 'Ultra veloce per risposte rapide',
    category: 'groq'
  },
  {
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout 17B',
    provider: 'Groq',
    description: 'Nuovo modello Llama 4',
    category: 'groq'
  },
  {
    id: 'compound-beta',
    name: 'Compound Beta',
    provider: 'Groq',
    description: 'Modello compound beta',
    category: 'groq'
  },
  {
    id: 'compound-beta-mini',
    name: 'Compound Beta Mini',
    provider: 'Groq',
    description: 'Versione mini di Compound',
    category: 'groq'
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT OSS 120B',
    provider: 'Groq',
    description: 'Modello GPT OSS 120B',
    category: 'groq'
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT OSS 20B',
    provider: 'Groq',
    description: 'Modello GPT OSS 20B',
    category: 'groq'
  },
  {
    id: 'openai/gpt-oss-safeguard-20b',
    name: 'GPT OSS Safeguard 20B',
    provider: 'Groq',
    description: 'Modello GPT OSS Safeguard',
    category: 'groq'
  },
  {
    id: 'qwen/qwen3-32b',
    name: 'Qwen3 32B',
    provider: 'Groq',
    description: 'Modello Qwen3',
    category: 'groq'
  },
  {
    id: 'meta-llama/llama-prompt-guard-2-22m',
    name: 'Llama Prompt Guard 2 22M',
    provider: 'Groq',
    description: 'Modello di sicurezza',
    category: 'groq'
  },
  {
    id: 'meta-llama/llama-prompt-guard-2-86m',
    name: 'Llama Prompt Guard 2 86M',
    provider: 'Groq',
    description: 'Modello di sicurezza avanzato',
    category: 'groq'
  }
];

// Helper function to get the API model name for a given model ID
export function getApiModelName(modelId: string): string {
  return modelId;
}

// Helper function to get all Gemini model IDs
export function getGeminiModelIds(): string[] {
  return MODELS.filter(m => m.category === 'gemini').map(m => m.id);
}

// Helper function to get all Groq model IDs
export function getGroqModelIds(): string[] {
  return MODELS.filter(m => m.category === 'groq').map(m => m.id);
}

// Helper function to check if a model is Gemini
export function isGeminiModel(modelId: string): boolean {
  const model = MODELS.find(m => m.id === modelId);
  return model?.category === 'gemini' || false;
}
