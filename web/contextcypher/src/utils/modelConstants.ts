// src/utils/modelConstants.ts
// Client-side model token limits and configurations
import api from '../api';
import { providerInfoService } from '../services/ProviderInfoService';

// Token limits for different model types
// Note: For Ollama models, these are MAXIMUM supported, but default is usually 8192
// Users need to configure Ollama with custom num_ctx parameter to use larger contexts
export const MODEL_TOKEN_LIMITS: Record<string, number> = {
  'foundation-sec': 32768,     // Foundation-Sec models can handle extended context
  'llama-2': 32768,           // Many Llama 2 variants support extended context
  'llama-3': 32768,           // Llama 3 models support even larger contexts
  'llama3.1': 128000,         // Llama 3.1 models support 128k context (but Ollama default is 8192)
  'llama3.2': 128000,         // Llama 3.2 models support 128k context (but Ollama default is 8192)
  'llama3.3': 128000,         // Llama 3.3 models - similar to 3.1 405B performance
  'mistral': 32768,           // Mistral models
  'mixtral': 32768,           // Mixtral MoE models
  'qwen': 32768,              // Qwen models
  'qwen2.5-coder': 32768,     // Qwen 2.5 Coder - good for security code analysis
  'deepseek': 32768,          // DeepSeek models
  'cybersecurity': 16384,     // CyberSecurityThreatAnalysis models (conservative estimate)
  'cybershield': 16384,       // CyberShieldAI models
  'gpt-3.5': 16384,           // GPT-3.5-turbo-16k 
  'gpt-4': 32768,             // GPT-4-32k
  'gpt-4-turbo': 128000,      // GPT-4 Turbo has 128k context
  'claude': 100000,           // Claude models have large context
  'gemini': 1048576,          // Gemini 1.5 Pro supports up to 1M tokens
  'local': 8192,              // Default Ollama context (more realistic)
  'default': 8192             // Default Ollama context window
};

// Provider-specific model patterns
export const PROVIDER_MODEL_PATTERNS: Record<string, string[]> = {
  'openai': ['gpt-3.5', 'gpt-4'],
  'anthropic': ['claude'],
  'google': ['gemini'],
  'local': ['llama', 'mistral', 'mixtral', 'qwen', 'deepseek', 'foundation']
};

// Get model info based on model name and provider
export function getModelInfo(modelName: string | undefined, provider: string = 'local'): {
  model: string;
  maxTokens: number;
  warningThreshold: number;
  type: 'api' | 'local';
} {
  const lowerModel = (modelName || '').toLowerCase();
  let maxTokens = MODEL_TOKEN_LIMITS['default'];
  let type: 'api' | 'local' = 'local';

  // Provider-specific handling
  if (provider === 'openai' || provider === 'OpenAI') {
    type = 'api';
    if (lowerModel.includes('gpt-4-turbo') || lowerModel.includes('gpt-4-1106')) {
      maxTokens = MODEL_TOKEN_LIMITS['gpt-4-turbo'];
    } else if (lowerModel.includes('gpt-4')) {
      maxTokens = MODEL_TOKEN_LIMITS['gpt-4'];
    } else if (lowerModel.includes('gpt-3.5')) {
      maxTokens = MODEL_TOKEN_LIMITS['gpt-3.5'];
    }
  } else if (provider === 'anthropic' || provider === 'Anthropic') {
    type = 'api';
    maxTokens = MODEL_TOKEN_LIMITS['claude'];
  } else if (provider === 'google' || provider === 'Google' || provider === 'gemini') {
    type = 'api';
    maxTokens = MODEL_TOKEN_LIMITS['gemini'];
  } else {
    // Local models (primarily Ollama)
    type = 'local';
    
    // Check for specific security models first
    if (lowerModel.includes('cybersecuritythreatanalysis') || lowerModel.includes('cybersecurity')) {
      maxTokens = MODEL_TOKEN_LIMITS['cybersecurity'];
    } else if (lowerModel.includes('cybershield')) {
      maxTokens = MODEL_TOKEN_LIMITS['cybershield'];
    } 
    // Llama variants
    else if (lowerModel.includes('llama3.3') || lowerModel.includes('llama-3.3')) {
      maxTokens = MODEL_TOKEN_LIMITS['llama3.3'];
    } else if (lowerModel.includes('llama3.2') || lowerModel.includes('llama-3.2')) {
      maxTokens = MODEL_TOKEN_LIMITS['llama3.2'];
    } else if (lowerModel.includes('llama3.1') || lowerModel.includes('llama-3.1')) {
      maxTokens = MODEL_TOKEN_LIMITS['llama3.1'];
    } else if (lowerModel.includes('llama-3') || lowerModel.includes('llama3')) {
      maxTokens = MODEL_TOKEN_LIMITS['llama-3'];
    } else if (lowerModel.includes('llama-2') || lowerModel.includes('llama2')) {
      maxTokens = MODEL_TOKEN_LIMITS['llama-2'];
    }
    // Other models
    else if (lowerModel.includes('mistral')) {
      maxTokens = MODEL_TOKEN_LIMITS['mistral'];
    } else if (lowerModel.includes('mixtral')) {
      maxTokens = MODEL_TOKEN_LIMITS['mixtral'];
    } else if (lowerModel.includes('qwen2.5-coder')) {
      maxTokens = MODEL_TOKEN_LIMITS['qwen2.5-coder'];
    } else if (lowerModel.includes('qwen')) {
      maxTokens = MODEL_TOKEN_LIMITS['qwen'];
    } else if (lowerModel.includes('deepseek')) {
      maxTokens = MODEL_TOKEN_LIMITS['deepseek'];
    } else if (lowerModel.includes('foundation')) {
      maxTokens = MODEL_TOKEN_LIMITS['foundation-sec'];
    } else {
      // Default to Ollama's default context size
      maxTokens = MODEL_TOKEN_LIMITS['default'];
    }
  }

  // Warning threshold at 80% of max tokens
  const warningThreshold = Math.floor(maxTokens * 0.8);

  return {
    model: modelName || 'unknown',
    maxTokens,
    warningThreshold,
    type
  };
}

// Format token count with commas for readability
export function formatTokenCount(tokens: number): string {
  return tokens.toLocaleString();
}

// Get appropriate color for token usage
export function getTokenUsageColor(tokens: number, maxTokens: number, theme: any): string {
  const percentage = (tokens / maxTokens) * 100;
  
  if (percentage >= 100) {
    return theme.colors.error; // Red - exceeds limit
  } else if (percentage >= 80) {
    return theme.colors.warning; // Orange - warning zone
  } else if (percentage >= 60) {
    return theme.colors.info; // Yellow - caution
  } else {
    return theme.colors.success; // Green - safe
  }
}

// Get dynamic model info with server-provided token limits
export async function getDynamicModelInfo(modelName: string | undefined, provider: string = 'local'): Promise<{
  model: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  warningThreshold: number;
  type: 'api' | 'local';
}> {
  try {
    // Try to get dynamic limits from server
    const tokenLimits = await providerInfoService.getTokenLimits();
    
    // Get static info as fallback
    const staticInfo = getModelInfo(modelName, provider);
    
    return {
      model: modelName || 'unknown',
      maxInputTokens: tokenLimits.maxInput || staticInfo.maxTokens,
      maxOutputTokens: tokenLimits.maxOutput || staticInfo.maxTokens,
      warningThreshold: Math.floor((tokenLimits.maxInput || staticInfo.maxTokens) * 0.8),
      type: staticInfo.type
    };
  } catch (error) {
    // Fallback to static info
    const staticInfo = getModelInfo(modelName, provider);
    return {
      model: modelName || 'unknown',
      maxInputTokens: staticInfo.maxTokens,
      maxOutputTokens: staticInfo.maxTokens,
      warningThreshold: staticInfo.warningThreshold,
      type: staticInfo.type
    };
  }
}

// Cache for Ollama model context sizes to avoid repeated API calls
const ollamaContextCache: Record<string, number> = {};

// Fetch actual context size from Ollama API
export async function getOllamaModelContext(modelName: string, forceRefresh = false): Promise<number> {
  // Check cache first
  if (!forceRefresh && ollamaContextCache[modelName]) {
    return ollamaContextCache[modelName];
  }

  try {
    // Use the configured api instance to ensure the correct port is used
    const response = await api.get(`/api/ollama/model-info/${encodeURIComponent(modelName)}`);
    if (response.status === 200) {
      const data = response.data;
      if (data.success && (data.context_length || data.num_ctx)) {
        const ctx = data.context_length || data.num_ctx;
        // Update cache if changed or new
        if (!ollamaContextCache[modelName] || ollamaContextCache[modelName] !== ctx) {
          ollamaContextCache[modelName] = ctx;
        }
        return ctx;
      } else if (data.modelfile) {
        const matchCtx = data.modelfile.match(/context_length\s+(\d+)/i) || data.modelfile.match(/num_ctx\s+(\d+)/i);
        if (matchCtx) {
          const ctx = parseInt(matchCtx[1], 10);
          ollamaContextCache[modelName] = ctx;
          return ctx;
        }
      }
    }
  } catch (error: any) {
    // Fail silently for connection errors - don't spam the console
    if (!error?.message?.includes('ECONNREFUSED')) {
      console.error('Failed to fetch Ollama model context:', error);
    }
  }

  // Fall back to default if API call fails
  return MODEL_TOKEN_LIMITS['default'];
}