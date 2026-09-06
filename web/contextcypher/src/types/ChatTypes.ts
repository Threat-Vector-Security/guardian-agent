// src/types/ChatTypes.ts

import { DiagramData, AnalysisContext } from "./AnalysisTypes";

// Core message types
export type MessageType = 
  | 'question'    // User messages
  | 'response'    // Standard AI responses
  | 'assistant'   // AI assistant messages
  | 'analysis'    // Analysis results
  | 'system'      // System messages
  | 'error'       // Error messages
  | 'loading';    // Loading states

export type MessageRole = 'user' | 'assistant' | 'system';

// Base chat message interface
export interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  tokenInfo?: {
    promptTokens?: number;
    responseTokens?: number;
    totalTokens?: number;
  };
  metadata?: {
    chatScope?: 'diagram' | 'grc';
    analysisType?: 'full' | 'partial';
    severity?: string;
    relatedNodes?: string[];
    relatedEdges?: string[];
    isAnalysis?: boolean;
    cancelled?: boolean;
    timestamp?: string;
    provider?: string;
    isStatus?: boolean;
    statusType?: string;
    tokenInfo?: {
      promptTokens: number;
      responseTokens: number;
      totalTokens: number;
    };
    threatIntelSources?: {
      mitre?: number;
      github?: number;
      alienVault?: number;
      nvd?: number;
    };
  };
}

// API message format
export interface ApiMessage {
  role: MessageRole;
  content: string;
  timestamp?: string;
}

// API response structure
export interface ApiResponse {
  choices: Array<{
    message: {
      content: string;
      role?: MessageRole;
    };
  }>;
  metadata?: {
    provider?: string;
    timestamp?: string;
    tokenInfo?: {
      promptTokens: number;
      responseTokens: number;
      totalTokens: number;
    };
    threatIntelSources?: {
      severity?: string;
      affectedNodes?: string[];
      mitre?: number;
      github?: number;
      alienVault?: number;
      nvd?: number;
    };
    isAnalysis?: boolean;
  };
}

// Analysis-specific response
export interface AnalysisResponse {
  choices: Array<{
    message: {
      content: string;
      role?: string;
    };
  }>;
  metadata?: {
    provider?: string;
    timestamp?: string;
    isAnalysis?: boolean;
    tokenInfo?: {
      promptTokens: number;
      responseTokens: number;
      totalTokens: number;
    };
    threatIntelSources?: {
      mitre?: number;
      github?: number;
      alienVault?: number;
      nvd?: number;
    };
  };
}

// Component Props interfaces
export interface AnalysisPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onSendMessage: (
    message: string,
    context: AnalysisContext
  ) => Promise<AnalysisResponse>;
  onRequestAnalysis: () => Promise<void>;
  isAnalyzing: boolean;
}

export interface ExtendedAnalysisPanelProps extends Omit<AnalysisPanelProps, 'messages'> {
  currentDiagram?: DiagramData;
}

export interface AnalysisChatProps {
  isAnalyzing: boolean;
  onSendMessage: (message: string) => Promise<void>;
  onRequestAnalysis: () => Promise<void>;
  messages: ChatMessage[];
}

// Message validation helper
export const isValidApiResponse = (response: any): response is ApiResponse => {
  return (
    response &&
    Array.isArray(response.choices) &&
    response.choices.length > 0 &&
    response.choices[0].message &&
    typeof response.choices[0].message.content === 'string'
  );
};
