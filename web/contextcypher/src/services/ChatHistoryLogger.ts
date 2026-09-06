import { saveExport } from '../utils/exportUtils';

/**
 * Chat History Logger Service - Browser Implementation
 * Handles automated logging of chat messages sent and received to/from AI
 */

import { AnalysisContext } from '../types/AnalysisTypes';

export interface ChatLogEntry {
  timestamp: Date;
  type: 'user' | 'assistant' | 'system' | 'request_data' | 'request_summary' | 'cypher_context';
  content: string;
  provider?: string;
  model?: string;
  tokensUsed?: number;
  sessionId?: string;
  contextData?: Record<string, unknown>; // For logging full context and prompts
}

export interface ChatLogOptions {
  logFilePath: string;
  enabled: boolean;
  includeSystemMessages?: boolean;
  includeMetadata?: boolean;
  includeFullContext?: boolean; // For logging complete request context
}

class ChatHistoryLogger {
  private options: ChatLogOptions = {
    logFilePath: '',
    enabled: false,
    includeSystemMessages: true,
    includeMetadata: true,
    includeFullContext: true
  };

  private sessionId: string = this.generateSessionId();
  private sessionLogs: ChatLogEntry[] = [];
  private readonly STORAGE_KEY = 'contextcypher_chat_logs';
  private readonly MAX_STORED_LOGS = 500;

  /**
   * Initialize the logger with options
   */
  async initialize(options: Partial<ChatLogOptions>) {
    try {
      this.options = { ...this.options, ...options };
      
      // If no log file path is provided, use default
      if (!this.options.logFilePath) {
        this.options.logFilePath = await this.getDefaultLogPath();
      }

      // Load existing logs from storage
      this.loadLogsFromStorage();

      console.log('[ChatHistoryLogger] Initialized with options:', {
        ...this.options,
        logFilePath: this.options.logFilePath
      });

      // Log initialization
      if (this.options.enabled) {
        await this.log({
          type: 'system',
          content: `Chat history logging initialized for session ${this.sessionId}`,
          contextData: {
            platform: 'browser',
            options: this.options
          }
        });
      }
    } catch (error) {
      console.error('[ChatHistoryLogger] Failed to initialize:', error);
    }
  }

  /**
   * Configure the logger options
   */
  configure(options: Partial<ChatLogOptions>) {
    this.options = { ...this.options, ...options };
    console.log('[ChatHistoryLogger] Updated configuration:', this.options);
  }

  /**
   * Get the default log path (browser implementation)
   */
  async getDefaultLogPath(): Promise<string> {
    // In browser, we return a descriptive path
    return 'Browser localStorage (contextcypher_chat_logs)';
  }

  /**
   * Get the current platform
   */
  private async getPlatform(): Promise<string> {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('win')) return 'windows';
    if (platform.includes('mac')) return 'darwin';
    if (platform.includes('linux')) return 'linux';
    return 'unknown';
  }

  /**
   * Initialize the log directory (no-op in browser)
   */
  async initializeLogDirectory(): Promise<void> {
    // In browser mode, we use localStorage and memory
    console.log('[ChatHistoryLogger] Browser mode - using localStorage for persistence');
  }

  /**
   * Log a chat entry
   */
  async log(entry: Omit<ChatLogEntry, 'timestamp' | 'sessionId'>): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    // Filter system messages if configured
    if (entry.type === 'system' && !this.options.includeSystemMessages) {
      return;
    }

    const logEntry: ChatLogEntry = {
      ...entry,
      timestamp: new Date(),
      sessionId: this.sessionId
    };

    // Store in memory
    this.sessionLogs.push(logEntry);

    // Keep only recent logs
    if (this.sessionLogs.length > this.MAX_STORED_LOGS) {
      this.sessionLogs = this.sessionLogs.slice(-this.MAX_STORED_LOGS);
    }

    // Console output for debugging
    if (process.env.NODE_ENV === 'development') {
      const truncatedContent = logEntry.content.length > 200 
        ? logEntry.content.substring(0, 200) + '...' 
        : logEntry.content;
      console.log(`[ChatLog] ${logEntry.type}: ${truncatedContent}`);
    }

    // Format and save
    await this.writeLogEntry(logEntry);
  }

  /**
   * Log a user message
   */
  async logUserMessage(content: string, context?: AnalysisContext): Promise<void> {
    await this.log({
      type: 'user',
      content,
      contextData: this.options.includeFullContext && context ? {
        nodeCount: context.diagram?.nodes?.length || 0,
        edgeCount: context.diagram?.edges?.length || 0,
        hasCustomContext: !!context.customContext,
        messageCount: context.messageHistory?.length || 0
      } : undefined
    });
  }

  /**
   * Log an assistant message
   */
  async logAssistantMessage(
    content: string, 
    provider?: string, 
    model?: string, 
    tokensUsed?: number
  ): Promise<void> {
    await this.log({
      type: 'assistant',
      content,
      provider,
      model,
      tokensUsed
    });
  }

  /**
   * Log full request data (for debugging)
   * Can be called with either full data object or just prompt
   */
  async logRequestData(dataOrPrompt: string | {
    provider: string;
    model: string;
    context: AnalysisContext;
    prompt: string;
    systemPrompt?: string;
  }, context?: AnalysisContext, provider?: string, model?: string): Promise<void> {
    // Handle both signatures
    let data: any;
    if (typeof dataOrPrompt === 'string') {
      // Old signature: (prompt, context, provider, model)
      data = {
        prompt: dataOrPrompt,
        context: context || {},
        provider: provider || 'unknown',
        model: model || 'unknown'
      };
    } else {
      // New signature: (data)
      data = dataOrPrompt;
    }
    if (!this.options.includeFullContext) {
      return;
    }

    await this.log({
      type: 'request_data',
      content: 'Full analysis request context',
      provider: data.provider,
      model: data.model,
      contextData: {
        promptLength: data.prompt.length,
        systemPromptLength: data.systemPrompt?.length || 0,
        nodeCount: data.context.diagram?.nodes?.length || 0,
        edgeCount: data.context.diagram?.edges?.length || 0,
        messageCount: data.context.messageHistory?.length || 0,
        hasCustomContext: !!data.context.customContext,
        truncatedPrompt: data.prompt.substring(0, 500) + '...'
      }
    });
  }

  /**
   * Log a request summary
   */
  async logRequestSummary(summary: {
    nodeCount: number;
    edgeCount: number;
    messageCount: number;
    provider: string;
    model: string;
    promptTokens?: number;
    maxTokens?: number;
  }): Promise<void> {
    await this.log({
      type: 'request_summary',
      content: `Analysis request: ${summary.nodeCount} nodes, ${summary.edgeCount} edges, ${summary.messageCount} messages`,
      provider: summary.provider,
      model: summary.model,
      contextData: this.options.includeMetadata ? summary : undefined
    });
  }

  /**
   * Log cypher context
   */
  async logCypherContext(cypher: string, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.options.includeFullContext) {
      return;
    }

    await this.log({
      type: 'cypher_context',
      content: cypher.substring(0, 500) + (cypher.length > 500 ? '...' : ''),
      contextData: {
        cypherLength: cypher.length,
        ...metadata
      }
    });
  }

  /**
   * Format a log entry for output
   */
  private formatLogEntry(entry: ChatLogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const type = entry.type.toUpperCase().padEnd(15);
    
    let formatted = `[${timestamp}] [${entry.sessionId}] [${type}]`;
    
    // Add provider/model info if available
    if (entry.provider || entry.model) {
      formatted += ` [${entry.provider || 'unknown'}/${entry.model || 'unknown'}]`;
    }
    
    // Add token count if available
    if (entry.tokensUsed) {
      formatted += ` [${entry.tokensUsed} tokens]`;
    }
    
    // Add content
    formatted += `\n${entry.content}`;
    
    // Add context data if enabled and present
    if (this.options.includeMetadata && entry.contextData) {
      formatted += `\nContext: ${JSON.stringify(entry.contextData, null, 2)}`;
    }
    
    return formatted + '\n\n';
  }

  // Static property for the timer
  private static saveTimer: NodeJS.Timeout | null = null;

  /**
   * Write a log entry (browser implementation)
   */
  private async writeLogEntry(entry: ChatLogEntry): Promise<void> {
    // Periodically save to storage
    if (!ChatHistoryLogger.saveTimer) {
      ChatHistoryLogger.saveTimer = setTimeout(() => {
        this.saveLogsToStorage();
        ChatHistoryLogger.saveTimer = null;
      }, 5000); // Save every 5 seconds
    }
  }

  /**
   * Generate a session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${crypto.randomUUID()}`;
  }

  /**
   * Start a new session
   */
  startNewSession(): void {
    this.sessionId = this.generateSessionId();
    console.log(`[ChatHistoryLogger] Started new session: ${this.sessionId}`);
    
    if (this.options.enabled) {
      this.log({
        type: 'system',
        content: 'New chat session started'
      });
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Save logs to localStorage
   */
  private saveLogsToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.sessionLogs));
    } catch (error) {
      console.error('[ChatHistoryLogger] Failed to save logs to storage:', error);
    }
  }

  /**
   * Load logs from localStorage
   */
  private loadLogsFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.sessionLogs = JSON.parse(stored, (key, value) => {
          // Convert timestamp strings back to Date objects
          if (key === 'timestamp' && typeof value === 'string') {
            return new Date(value);
          }
          return value;
        });
      }
    } catch (error) {
      console.error('[ChatHistoryLogger] Failed to load logs from storage:', error);
      this.sessionLogs = [];
    }
  }

  /**
   * Export logs as downloadable file
   */
  downloadLogs(): Promise<boolean> {
    const logs = this.sessionLogs.map(log => this.formatLogEntry(log)).join('\n');
    const blob = new Blob([logs], { type: 'text/plain' });
    return saveExport(`chat-history-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`, blob);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.sessionLogs = [];
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Rotate log file (no-op in browser)
   */
  async rotateLogFile(): Promise<boolean> {
    // In browser, we just clear old logs
    if (this.sessionLogs.length > this.MAX_STORED_LOGS) {
      this.sessionLogs = this.sessionLogs.slice(-this.MAX_STORED_LOGS);
      this.saveLogsToStorage();
    }
    return true;
  }
  
  /**
   * Update logger options
   */
  updateOptions(options: Partial<ChatLogOptions>): void {
    this.options = { ...this.options, ...options };
    console.log('[ChatHistoryLogger] Options updated:', this.options);
  }
  
  /**
   * Test logging functionality
   */
  async testLogging(): Promise<boolean> {
    try {
      await this.logUserMessage('Test message from logging test');
      return true;
    } catch (error) {
      console.error('[ChatHistoryLogger] Test logging failed:', error);
      return false;
    }
  }
  
  /**
   * Get current log file path
   */
  getLogFilePath(): string {
    return this.options.logFilePath || 'Browser Storage (localStorage)';
  }
  
  /**
   * Log system message (alias for compatibility)
   */
  async logSystemMessage(message: string): Promise<void> {
    if (!this.options.includeSystemMessages) {
      return;
    }
    
    await this.log({
      type: 'system',
      content: message
    });
  }
}

// Export singleton instance
export const chatHistoryLogger = new ChatHistoryLogger();
