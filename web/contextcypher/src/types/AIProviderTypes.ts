// AIProviderTypes.ts

export type AIProviderType = 'local' | 'openai' | 'anthropic' | 'google';

export interface AIProvider {
  name: AIProviderType;
  model: string;
  analyze: (context: AnalysisContext) => Promise<AnalysisResponse>;
}

export interface AnalysisContext {
  diagram: any;
  threatIntel?: any;
  previousMessages?: { sender: string; content: string }[];
  message?: string;
}

export interface AnalysisResponse {
  content: string;
  metadata?: {
    model: string;
    provider: AIProviderType;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
}

export interface TokenLimits {
  contextWindow: number;  // Total context window size
  maxOutput: number;     // Maximum output tokens
  defaultOutput: number; // Default output we'll request
}

export const AI_PROVIDER_LIMITS: Record<string, TokenLimits> = {
  'gpt-4': {
    contextWindow: 8192,
    maxOutput: 4096,
    defaultOutput: 4000
  },
  'claude-3-sonnet': {
    contextWindow: 200000,
    maxOutput: 4096,
    defaultOutput: 4000
  },
  'gemini-pro': {
    contextWindow: 32768,
    maxOutput: 2048,
    defaultOutput: 2000
  }
}; 