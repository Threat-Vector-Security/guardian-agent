import { AnalysisContext } from '../types/AnalysisTypes';
import { chat as apiChat, analyze as apiAnalyze, detectServerPort } from '../api';
import { loadSettings } from '../settings/settings';
import { AnalysisResponse } from '../types/ChatTypes';
import { AIProvider } from '../types/SettingsTypes';
import { sanitizeRequest } from '../utils/requestSanitizer';
import { chatHistoryLogger } from './ChatHistoryLogger';
import { connectionManager } from './ConnectionManager';
import { logToDebugPanel } from '../components/DebugPanel';


import { runAI } from './guardianApi';

// Define local ApiResponse to match the one from api.ts
interface ApiResponse {
  content: string;
  metadata?: {
    provider?: string;
    timestamp?: string;
    isAnalysis?: boolean;
    threatIntelSources?: Record<string, any>;
    tokenInfo?: {
      promptTokens: number;
      responseTokens: number;
      totalTokens: number;
    };
  };
  choices?: Array<{
    message: {
      content: string;
      role?: string;
    };
  }>;
}

type BrowserEnv = {
  NODE_ENV?: string;
  REACT_APP_API_URL?: string;
};

const getBrowserEnv = (): BrowserEnv => {
  const maybeProcess = (globalThis as { process?: { env?: BrowserEnv } }).process;
  return maybeProcess?.env || {};
};

type ProviderBootstrapConfig = {
  provider: AIProvider;
  apiKey?: string;
  organizationId?: string;
  projectId?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

const resolveProviderForRequest = (providerOverride?: string): AIProvider | undefined => {
  const settings = loadSettings();
  if (settings.api.llmMode === 'local') {
    return 'local';
  }
  return (providerOverride || settings.api.provider) as AIProvider | undefined;
};

// Provider configuration is owned by Guardian. Requests never bootstrap secrets or overwrite it.
const buildProviderBootstrapConfig = async (_providerOverride?: string): Promise<ProviderBootstrapConfig | undefined> => undefined;

// Removed confirmation dialog functionality - simplified direct API calls

/**
 * Convert API response to local format
 */
function convertToLocalApiResponse(response: any): ApiResponse {
  console.log('Converting API response:', response);
  
  let content = '';
  
  // Extract content from the response
  // Handle the format returned by api.ts (with success field and flattened response)
  if (response.success && response.response) {
    // Format from api.ts: {success: true, response: "content", choices: [...], metadata: {...}}
    content = response.response;
  } else if (response.choices && response.choices[0]?.message?.content) {
    // Standard format with choices array (raw server response)
    content = response.choices[0].message.content;
  } else if (response.response) {
    // Legacy format with response field
    content = response.response;
  } else if (response.content) {
    // Direct content field
    content = response.content;
  } else if (response.analysis) {
    // Analysis response format
    content = response.analysis;
  } else {
    console.warn('Unable to extract content from response:', response);
    content = 'Error: Unable to extract response content';
  }
  
  return {
    content: content,
    metadata: response.metadata || {},
    choices: response.choices || [{
      message: {
        content: content,
        role: 'assistant'
      }
    }]
  };
}

// Removed unused confirmation dialog functions

/**
 * Check if running in browser context
 */


/**
 * Function to estimate tokens in a string with improved accuracy
 * Based on OpenAI's tokenization patterns for better estimation
 */
export function estimateTokens(text: string): number {
  // More accurate token estimation based on content type
  let tokenCount = 0;
  
  // Base estimate: ~4 characters per token for normal text
  // But adjust based on content patterns
  
  // Count words (rough approximation)
  const words = text.match(/[\w']+/g) || [];
  tokenCount += words.length * 1.3; // Most words are 1-2 tokens
  
  // Count special characters and punctuation (often individual tokens)
  const specialChars = text.match(/[^\w\s]/g) || [];
  tokenCount += specialChars.length * 0.7; // Not all special chars are separate tokens
  
  // Count numbers (often multiple tokens)
  const numbers = text.match(/\d+/g) || [];
  for (const num of numbers) {
    tokenCount += Math.ceil(num.length / 2);
  }
  
  // Count whitespace and newlines
  const whitespace = text.match(/\s+/g) || [];
  tokenCount += whitespace.length * 0.1; // Whitespace is often part of other tokens
  
  // Code patterns (if present) tend to use more tokens
  const codePatterns = /[{}[\]()<>]|=>|&&|\|\||==|!=|>=|<=|\+\+|--/g;
  const codeMatches = text.match(codePatterns) || [];
  tokenCount += codeMatches.length * 0.5;
  
  // JSON-like structures use more tokens
  if (text.includes('"') && text.includes(':')) {
    const jsonPairs = text.match(/"[^"]+"\s*:/g) || [];
    tokenCount += jsonPairs.length * 0.5;
  }
  
  // Minimum sanity check - at least 1 token per 6 characters
  const minTokens = Math.ceil(text.length / 6);
  
  return Math.max(Math.ceil(tokenCount), minTokens);
}

/**
 * Prepare a request payload for token estimation
 * This ensures consistent token counting across the application
 */
export function prepareRequestPayload(message: string, context: Partial<AnalysisContext>): any {
  // Create a comprehensive context for accurate token estimation
  const fullContext = {
    customContext: context.customContext ? {
      content: context.customContext.content,
      sanitizedContent: context.customContext.sanitizedContent
    } : null,
    messageHistory: context.messageHistory || [],
    diagram: context.diagram ? {
      nodes: context.diagram.nodes || [],
      edges: context.diagram.edges || [],
      metadata: context.diagram.metadata || {}
    } : null,
    // Drawings removed - now handled as nodes
    threatIntel: context.threatIntel || null,
    metadata: context.metadata || {}
  };
  
  return {
    message,
    context: fullContext
  };
}

/**
 * Get a consistent token count estimation for a request
 */
// Track last log time for throttling
let lastTokenLogTime = 0;

export interface TokenBreakdown {
  userMessage: number;
  systemPrompt: number;
  diagramContext: number;
  customContext: number;
  messageHistory: number;
  total: number;
}

export function getTokenEstimation(message: string, context: Partial<AnalysisContext>): number {
  const breakdown = getTokenBreakdown(message, context);
  return breakdown.total;
}

export function getTokenBreakdown(message: string, context: Partial<AnalysisContext>): TokenBreakdown {
  const breakdown: TokenBreakdown = {
    userMessage: 0,
    systemPrompt: 500, // Approximate system prompt size
    diagramContext: 0,
    customContext: 0,
    messageHistory: 0,
    total: 0
  };
  
  // 1. User message tokens
  breakdown.userMessage = estimateTokens(message);
  
  // 2. Diagram context tokens
  if (context.diagram) {
    // Component list (foundation context)
    const componentCount = context.diagram.nodes?.filter((n: any) => n.type !== 'securityZone').length || 0;
    const connectionCount = context.diagram.edges?.length || 0;
    
    // Each component in list: ~15 tokens (name, type, zone)
    // Each connection in list: ~10 tokens (from, to, protocol)
    breakdown.diagramContext = componentCount * 15 + connectionCount * 10;
    
    // Diagram summary and stats: ~200 tokens
    breakdown.diagramContext += 200;
  }
  
  // 3. Custom context tokens
  if (context.customContext) {
    const customContextText = typeof context.customContext === 'string' 
      ? context.customContext 
      : context.customContext.content || '';
    if (customContextText) {
      breakdown.customContext = estimateTokens(customContextText);
    }
  }
  
  // 4. Message history tokens (if included)
  if (context.messageHistory && context.messageHistory.length > 0) {
    // Calculate dynamic message history size based on available tokens
    const availableTokens = 8192; // Default, should be passed from settings
    const usedTokens = breakdown.userMessage + breakdown.diagramContext + breakdown.customContext;
    const availableForHistory = Math.max(500, (availableTokens * 0.85) - usedTokens);
    
    let historyTokens = 0;
    let messageCount = 0;
    
    // Calculate backwards from most recent messages
    for (let i = context.messageHistory.length - 1; i >= 0; i--) {
      const messageTokens = estimateTokens(context.messageHistory[i].content || '');
      if (historyTokens + messageTokens <= availableForHistory) {
        historyTokens += messageTokens;
        messageCount++;
      } else {
        break;
      }
    }
    
    // Ensure minimum context (at least 2 messages for continuity)
    const finalCount = Math.max(2, Math.min(messageCount, context.messageHistory.length));
    const recentMessages = context.messageHistory.slice(-finalCount);
    for (const msg of recentMessages) {
      breakdown.messageHistory += estimateTokens(msg.content || '');
    }
  }
  
  // Drawings/annotations are now handled as nodes, not separate entities
  
  // Calculate total
  breakdown.total = breakdown.userMessage + breakdown.systemPrompt + 
                   breakdown.diagramContext + breakdown.customContext + 
                   breakdown.messageHistory;
  
  // Only log in development mode and throttle the logging
  if (getBrowserEnv().NODE_ENV === 'development') {
    const now = Date.now();
    if (now - lastTokenLogTime > 100) {
      console.log('Token estimation breakdown:', breakdown);
      lastTokenLogTime = now;
    }
  }
  
  return breakdown;
}

/**
 * Get token estimation from a raw JSON string (for confirmation dialog)
 */
export function getTokenEstimationFromJson(jsonData: string): number {
  // Estimate tokens based on character count
  const estimatedTokens = estimateTokens(jsonData);
  
  // Only log in development mode and throttle the logging
  if (getBrowserEnv().NODE_ENV === 'development') {
    // Simple throttling - only log every 100ms
    const now = Date.now();
    if (now - lastTokenLogTime > 100) {
      console.log('Token estimation from JSON:', {
        characters: jsonData.length,
        estimatedTokens
      });
      lastTokenLogTime = now;
    }
  }
  
  return estimatedTokens;
}

/**
 * Send a chat message to the AI provider, with optional confirmation
 */
export async function chat(
  message: string, 
  context: AnalysisContext,
  provider?: string
): Promise<ApiResponse> {
  const settings = loadSettings();
  // Apply Pro sanitization filter when enabled and using public providers
  const needsSanitize = settings.sanitization?.enabled && settings.api.llmMode !== 'local';
  const { message: outboundMessage, context: outboundContext } = needsSanitize ?
    sanitizeRequest(message, context) : { message, context };
  
  // Add chat web search settings if enabled and using Anthropic
  if (settings.api.provider === 'anthropic' && settings.chatWebSearch?.enabled) {
    if (!outboundContext.metadata) {
      (outboundContext as any).metadata = {} as any;
    }
    (outboundContext.metadata as any).enableChatWebSearch = true;
    (outboundContext.metadata as any).chatWebSearchConfig = {
      maxSearches: settings.chatWebSearch.maxSearches,
      domainCategories: settings.chatWebSearch.domainCategories
    };
  }
  
  console.log('AI Request Service - chat', { 
    settingsType: typeof settings,
    message: outboundMessage.substring(0, 50) + '...',
    contextSize: JSON.stringify(outboundContext).length,
    provider: provider || settings?.api?.provider || 'default',
    llmMode: settings?.api?.llmMode
  });
  
  // Log to debug panel
  logToDebugPanel('ai', '📤 Sending chat message (non-streaming)', {
    messageLength: outboundMessage.length,
    provider: settings?.api?.llmMode === 'local' ? 'local' : settings?.api?.provider,
    model: settings?.api?.llmMode === 'local' ? settings.api.localLLM.model : 
           settings.api.provider === 'openai' ? settings.api.providerConfig.openai?.model :
           settings.api.provider === 'anthropic' ? settings.api.providerConfig.anthropic?.model :
           settings.api.provider === 'gemini' ? settings.api.providerConfig.gemini?.model :
           undefined,
    contextSize: JSON.stringify(outboundContext).length,
    hasMessageHistory: (outboundContext.messageHistory?.length || 0) > 0,
    timestamp: new Date().toISOString()
  });
  
  // Log user message and full request context if logging is enabled
  await chatHistoryLogger.logUserMessage(outboundMessage);
  await chatHistoryLogger.logRequestData(
    outboundMessage, 
    outboundContext, 
    provider || settings?.api?.provider,
    settings?.api?.llmMode === 'local' ? settings.api.localLLM.model : undefined
  );
  
  // Inject smartContext flag into request metadata so backend can decide
  if (!context.metadata) {
    (context as any).metadata = {} as any;
  }
  (context.metadata as any).useSmartContext = true; // Always use optimized context

  // Check if provider is properly configured before making API call
  const currentProvider = resolveProviderForRequest(provider);
  if (!currentProvider) {
    throw new Error('No AI provider configured. Please configure an API provider in Settings.');
  }

  // Always call backend API (even for local LLM) so full context formatting is applied
  console.log('AI Request Service - calling backend API');
  try {
    const providerBootstrap = await buildProviderBootstrapConfig(currentProvider);
    const response = await apiChat(
      outboundMessage,
      outboundContext.messageHistory || [],
      outboundContext,
      currentProvider,
      providerBootstrap
    );
    const convertedResponse = convertToLocalApiResponse(response);
    
    // Log response received
    logToDebugPanel('ai', '📥 Chat response received', {
      provider: currentProvider,
      responseLength: convertedResponse.content?.length || 0,
      hasResponse: !!convertedResponse.content,
      success: response.success,
      timestamp: new Date().toISOString()
    });
    
    // Log assistant response
    const selectedProviderConfig = settings?.api?.providerConfig;
    let modelName: string | undefined;
    
    if (currentProvider && currentProvider !== 'local' && selectedProviderConfig) {
      switch (currentProvider) {
        case 'openai':
          modelName = selectedProviderConfig.openai?.model;
          break;
        case 'anthropic':
          modelName = selectedProviderConfig.anthropic?.model;
          break;
        case 'gemini':
          modelName = selectedProviderConfig.gemini?.model;
          break;
      }
    }
    
    await chatHistoryLogger.logAssistantMessage(
      convertedResponse.content,
      currentProvider,
      modelName,
      convertedResponse.metadata?.tokenInfo?.totalTokens
    );
    
    return convertedResponse;
  } catch (error) {
    console.error('AI Request Service - Error during chat:', error);
    await chatHistoryLogger.logSystemMessage(`Chat error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
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

/**
 * Send a chat message to the AI provider, with optional confirmation
 * This version is compatible with the AnalysisResponse type expected by components
 */
export async function chatWithAnalysisResponse(
  message: string, 
  context: AnalysisContext
): Promise<AnalysisResponse> {  
  console.log('AI Request Service - chatWithAnalysisResponse wrapper called');
  
  // Call the regular chat function
  const apiResponse = await chat(message, context);
  
  // Estimate token usage
  const promptText = JSON.stringify({ message, context });
  const responseText = JSON.stringify(apiResponse);
  const promptTokens = estimateTokens(promptText);
  const responseTokens = estimateTokens(responseText);
  
  // Convert ApiResponse to AnalysisResponse format
  const analysisResponse: AnalysisResponse = {
    choices: apiResponse.choices || [{
      message: {
        content: apiResponse.content || ''
      }
    }],
    metadata: {
      // Create a new metadata object with the required fields
      provider: apiResponse.metadata?.provider || 'unknown', 
      timestamp: apiResponse.metadata?.timestamp || new Date().toISOString(),
      isAnalysis: true,
      tokenInfo: {
        promptTokens,
        responseTokens,
        totalTokens: promptTokens + responseTokens
      },
      // Convert the threatIntelSources if available
      threatIntelSources: apiResponse.metadata?.threatIntelSources ? {
        mitre: apiResponse.metadata.threatIntelSources.mitre || 0,
        github: apiResponse.metadata.threatIntelSources.github || 0,
        alienVault: apiResponse.metadata.threatIntelSources.alienVault || 0,
        nvd: apiResponse.metadata.threatIntelSources.nvd || 0
      } : undefined
    }
  };
  
  console.log('AI Request Service - returning formatted response with token info', {
    promptTokens,
    responseTokens,
    totalTokens: promptTokens + responseTokens
  });
  return analysisResponse;
}

/**
 * Send a chat message with streaming support
 */
export async function chatWithStreaming(
  message: string, context: AnalysisContext,
  onToken?: (token: string) => void,
  onComplete?: (response: ApiResponse) => void,
  signal?: AbortSignal,
): Promise<ApiResponse> {
  const settings = loadSettings();
  const outbound = settings.sanitization?.enabled && settings.api.llmMode !== 'local'
    ? sanitizeRequest(message, context) : { message, context };
  // Guardian returns a bounded completed result; keep the UI pending until real model output arrives.
  const result = await runAI('chat', outbound.message, outbound.context as unknown as Record<string, unknown>, signal);
  const response: ApiResponse = { content: result.content, metadata: { provider: result.provider, timestamp: new Date().toISOString() }, choices: [{ message: { role: 'assistant', content: result.content } }] };
  if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
  onToken?.(result.content);
  onComplete?.(response);
  return response;
}

/** Analyse the current diagram using the configured Guardian provider. */
export async function analyze(
  context: AnalysisContext
): Promise<ApiResponse> {
  const settings = loadSettings();
  const needsSanitize = settings.sanitization?.enabled && settings.api.llmMode !== 'local';
  const { context: outboundContext } = needsSanitize ? sanitizeRequest('ANALYZE', context) : { context };
  
  console.log('AI Request Service - analyze', { 
    contextSize: JSON.stringify(outboundContext).length,
    hasNodes: outboundContext?.diagram?.nodes?.length || 0,
    hasEdges: outboundContext?.diagram?.edges?.length || 0,
    llmMode: settings?.api?.llmMode
  });
  
  const analysisPrompt = `Analyze the current system for security threats.

System Components: ${outboundContext?.diagram?.nodes?.length || 0} nodes, ${outboundContext?.diagram?.edges?.length || 0} connections
${outboundContext.customContext ? `Context: ${(outboundContext.customContext as any).sanitizedContent || ''}` : ''}

Provide a comprehensive threat analysis using security frameworks and methodologies.`;

  // Log analysis request and full context
  await chatHistoryLogger.logUserMessage(`[ANALYSIS REQUEST] ${analysisPrompt}`);
  await chatHistoryLogger.logRequestData(
    analysisPrompt, 
    outboundContext, 
    settings?.api?.provider,
    settings?.api?.llmMode === 'local' ? settings.api.localLLM.model : undefined
  );
  
  // Inject smartContext flag
  if (!outboundContext.metadata) {
    (outboundContext as any).metadata = {} as any;
  }
  (outboundContext.metadata as any).useSmartContext = true; // Always use optimized context

  // Proceed without confirmation
  try {
    const response = await apiAnalyze(outboundContext.diagram, outboundContext.messageHistory || [], outboundContext);
    const convertedResponse = convertToLocalApiResponse(response);
    
    // Log analysis response
    const currentProvider = settings?.api?.provider;
    const providerConfig = settings?.api?.providerConfig;
    let modelName: string | undefined;
    
    if (currentProvider && currentProvider !== 'local' && providerConfig) {
      switch (currentProvider) {
        case 'openai':
          modelName = providerConfig.openai?.model;
          break;
        case 'anthropic':
          modelName = providerConfig.anthropic?.model;
          break;
        case 'gemini':
          modelName = providerConfig.gemini?.model;
          break;
      }
    }
    
    await chatHistoryLogger.logAssistantMessage(
      convertedResponse.content,
      currentProvider,
      modelName,
      convertedResponse.metadata?.tokenInfo?.totalTokens
    );
    
    return convertedResponse;
  } catch (error) {
    console.error('AI Request Service - Error during analysis:', error);
    await chatHistoryLogger.logSystemMessage(`Analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
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
