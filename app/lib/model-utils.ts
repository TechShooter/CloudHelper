// Helper functions extracted from the old models.ts model list (now archived).

/**
 * Helper function to get the API model name for a given model ID.
 * Currently returns the ID as-is; here for forward-compatibility.
 */
export function getApiModelName(modelId: string): string {
  return modelId;
}

/**
 * Check whether a model ID belongs to Gemini.
 * Gemini model IDs typically start with "gemini-".
 * All other models (including those served by Groq, OpenRouter, etc.) are non-Gemini.
 */
export function isGeminiModel(modelId: string): boolean {
  return modelId.startsWith('gemini-');
}
