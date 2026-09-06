// Service to fetch and cache provider information including dynamic token limits
import { guardianOperation } from './guardianApi';

interface TokenLimits {
  maxInput: number;
  maxOutput: number;
}

interface ProviderInfo {
  provider: string;
  isInitialized: boolean;
  availableProviders: string[];
  tokenLimits: TokenLimits;
  modelConfig: string | null;
}

class ProviderInfoService {
  private cachedInfo: ProviderInfo | null = null;
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 60000; // 1 minute cache

  async getProviderInfo(forceRefresh = false): Promise<ProviderInfo> {
    const now = Date.now();
    
    // Use cache if available and not expired
    if (!forceRefresh && this.cachedInfo && (now - this.lastFetch) < this.CACHE_DURATION) {
      return this.cachedInfo;
    }

    try {
      const result = await guardianOperation('ai.providers.list');
      const configuration = result.configuration;
      const response = { status: 200, data: {
        provider: configuration?.provider === 'ollama' ? 'local' : (configuration?.provider || ''),
        isInitialized: configuration?.ready === true,
        availableProviders: result.providers.map((provider: { name: string }) => provider.name),
        tokenLimits: { maxInput: 8192, maxOutput: 4096 },
        modelConfig: configuration?.model || null,
      } };
      
      if (response.status === 200 && response.data) {
        this.cachedInfo = response.data;
        this.lastFetch = now;
        return response.data;
      }
    } catch (error) {
      console.error('Failed to fetch provider info:', error);
      
      // Return cached data if available, even if expired
      if (this.cachedInfo) {
        return this.cachedInfo;
      }
    }

    // Return default values if all else fails
    return {
      provider: 'local',
      isInitialized: false,
      availableProviders: [],
      tokenLimits: {
        maxInput: 8192,
        maxOutput: 8192
      },
      modelConfig: null
    };
  }

  async getTokenLimits(forceRefresh = false): Promise<TokenLimits> {
    const info = await this.getProviderInfo(forceRefresh);
    return info.tokenLimits || { maxInput: 8192, maxOutput: 8192 };
  }

  clearCache(): void {
    this.cachedInfo = null;
    this.lastFetch = 0;
  }

  // Get token limits for a specific provider (useful for estimation)
  getProviderTokenLimits(provider: string): TokenLimits {
    // Return cached limits if we have them for this provider
    if (this.cachedInfo && this.cachedInfo.provider === provider && this.cachedInfo.tokenLimits) {
      return this.cachedInfo.tokenLimits;
    }

    // Otherwise return sensible defaults based on provider
    switch (provider) {
      case 'openai':
        return { maxInput: 128000, maxOutput: 16384 };
      case 'anthropic':
        return { maxInput: 200000, maxOutput: 8192 };
      case 'gemini':
        return { maxInput: 30720, maxOutput: 8192 };
      case 'local':
      default:
        return { maxInput: 131072, maxOutput: 131072 };
    }
  }
}

export const providerInfoService = new ProviderInfoService();
