// src/services/AnalysisService.ts

import { 
  AnalysisContext, 
  AnalysisResponse, 
  CustomContext, 
  DiagramData, 
  Drawing
} from '../types/AnalysisTypes';
import { ChatMessage } from '../types/ChatTypes';
import { chat as secureChat } from './AIRequestService';
import { providerInfoService } from './ProviderInfoService';


// Keep existing response interfaces
interface ChatApiResponse {
  choices: Array<{ message: { content: string } }>;
  metadata?: {
    timestamp: string;
    threatIntelSources?: {
      mitre: number;
      github: number;
      alienVault: number;
      nvd: number;
    };
  };
}

export interface ApiResponse extends ChatApiResponse {}

// Enhanced AnalysisRequest with additional context
export interface AnalysisRequest {
  message: string;
  diagram: DiagramData;
  context: {
    customContext: CustomContext | null;
    drawings: Drawing[];
    messageHistory: ChatMessage[];
    metadata: {
      timestamp: string;
      version?: string;
      environment: string | undefined;
      isInitialSystem?: boolean;
      systemType?: string;
      hasCustomContext?: boolean;
      isSanitized?: boolean;
    };
  };
}

export class AnalysisService {
  private static instance: AnalysisService;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private customContext: CustomContext | null = null;
  private settings = {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.2,
    maxTokens: 4000
  };
  
  private dynamicTokenLimits: { maxInput: number; maxOutput: number } | null = null;

  private constructor() {
    // Fetch dynamic token limits on initialization
    this.updateDynamicTokenLimits();
  }

  public static getInstance(): AnalysisService {
    if (!AnalysisService.instance) {
      AnalysisService.instance = new AnalysisService();
    }
    return AnalysisService.instance;
  }
  
  private async updateDynamicTokenLimits(): Promise<void> {
    try {
      const tokenLimits = await providerInfoService.getTokenLimits();
      this.dynamicTokenLimits = tokenLimits;
      // Update maxTokens to use the dynamic output limit
      if (tokenLimits.maxOutput) {
        this.settings.maxTokens = tokenLimits.maxOutput;
      }
    } catch (error) {
      console.error('Failed to update dynamic token limits:', error);
    }
  }
  
  public async refreshTokenLimits(): Promise<void> {
    await this.updateDynamicTokenLimits();
  }
  
  public getTokenLimits(): { maxInput: number; maxOutput: number } {
    if (this.dynamicTokenLimits) {
      return this.dynamicTokenLimits;
    }
    // Return default values if dynamic limits not yet loaded
    return { maxInput: 128000, maxOutput: this.settings.maxTokens };
  }

  public async analyzeSystem(diagramData: DiagramData, messageHistory: ChatMessage[] = []): Promise<AnalysisResponse> {
    try {
      console.log('AnalysisService - Starting system analysis');
      
      // Create analysis context
      const analysisContext: AnalysisContext = {
        diagram: diagramData,
        messageHistory,
        customContext: this.customContext,
        metadata: {
          lastModified: new Date(),
          version: '1.0',
          environment: process.env.NODE_ENV,
          timestamp: new Date()
        }
      };

      return this.analyze(analysisContext);
    } catch (error) {
      console.error('Analysis failed:', error);
      throw error;
    }
  }

  async analyze(analysisContext: AnalysisContext): Promise<AnalysisResponse> {
    try {
      console.log('AnalysisService - Starting analysis with context:', {
        hasContext: !!analysisContext,
        hasNodes: analysisContext?.diagram?.nodes?.length || 0,
        hasEdges: analysisContext?.diagram?.edges?.length || 0,
        hasCustomContext: !!analysisContext?.customContext
      });
      
      // Use regular AI service (local or public APIs)
      const response = await this.retryOperation(() =>
        secureChat('Analyze the current system state', analysisContext)
      );
      
      console.log('AnalysisService - Received response:', {
        hasResponse: !!response,
        hasChoices: response?.choices && response.choices.length > 0,
        provider: response?.metadata?.provider || 'unknown'
      });
      
      // Convert to AnalysisResponse format
      const analysisResponse: AnalysisResponse = {
        choices: response.choices || [{
          message: {
            content: response.content || 'No response content available'
          }
        }],
        metadata: {
          threatIntelSources: response.metadata?.threatIntelSources ? {
            mitre: response.metadata.threatIntelSources.mitre || 0,
            github: response.metadata.threatIntelSources.github || 0,
            alienVault: response.metadata.threatIntelSources.alienVault || 0,
            nvd: response.metadata.threatIntelSources.nvd || 0
          } : {
            mitre: 0,
            github: 0,
            alienVault: 0,
            nvd: 0
          },
          provider: response.metadata?.provider || 'unknown',
          timestamp: response.metadata?.timestamp || new Date().toISOString(),
          tokenInfo: response.metadata?.tokenInfo || undefined
        }
      };
      
      return analysisResponse;
    } catch (error) {
      console.error('AnalysisService - Error during analysis:', error);
      
      // Check for API key related errors
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('api key') || 
            errorMessage.includes('authentication') || 
            errorMessage.includes('unauthorized') ||
            errorMessage.includes('not found')) {
          throw new Error(`API Key Error: ${error.message}. Please check your API key settings or environment variables.`);
        }
      }
      
      // Re-throw the original error if not handled above
      throw error;
    }
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    retries: number = this.MAX_RETRIES
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        return this.retryOperation(operation, retries - 1);
      }
      throw error;
    }
  }
}

export default AnalysisService;
