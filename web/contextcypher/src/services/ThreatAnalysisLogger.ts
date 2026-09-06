import { saveExport } from '../utils/exportUtils';

/**
 * Threat Analysis Logger Service - Browser Implementation
 * Handles automated logging of threat analysis operations with full context
 */

import { SecurityNode, SecurityEdge, ThreatData } from '../types/SecurityTypes';

export interface ThreatAnalysisLogEntry {
  timestamp: Date;
  type: 'analysis_start' | 'node_analysis' | 'edge_analysis' | 'analysis_complete' | 'error' | 'context';
  sessionId: string;
  analysisId: string;
  content: string;
  metadata?: {
    nodeId?: string;
    nodeType?: string;
    nodeLabel?: string;
    edgeId?: string;
    edgeLabel?: string;
    zone?: string;
    threatsFound?: number;
    severity?: string;
    duration?: number;
    batchSize?: number;
    mode?: string;
  };
  threats?: ThreatData[];
  fullContext?: {
    node?: SecurityNode;
    edge?: SecurityEdge;
    connectedNodes?: SecurityNode[];
    analysisSettings?: Record<string, unknown>;
    rawAnalysisData?: unknown;
  };
}

export interface ThreatAnalysisLogOptions {
  logFilePath: string;
  enabled: boolean;
  includeFullContext?: boolean;
  includeNodeData?: boolean;
  includeAnalysisSettings?: boolean;
  logLevel?: 'minimal' | 'standard' | 'verbose';
}

class ThreatAnalysisLogger {
  private options: ThreatAnalysisLogOptions = {
    logFilePath: '',
    enabled: false,
    includeFullContext: false,
    includeNodeData: false,
    includeAnalysisSettings: false,
    logLevel: 'standard'
  };
  
  private currentSessionId: string | null = null;
  private analysisCount = 0;
  private sessionLogs: ThreatAnalysisLogEntry[] = [];
  private readonly STORAGE_KEY = 'contextcypher_threat_logs';
  private readonly MAX_STORED_LOGS = 1000;

  /**
   * Initialize the logger with options
   */
  async initialize(options: Partial<ThreatAnalysisLogOptions>): Promise<void> {
    this.configure(options);
    await this.initializeLogDirectory();
    console.log('[ThreatAnalysisLogger] Initialized with options:', {
      ...this.options,
      logFilePath: this.options.logFilePath ? '(set)' : '(not set)'
    });
  }

  /**
   * Check if logging is enabled
   */
  isEnabled(): boolean {
    return this.options.enabled;
  }

  /**
   * Configure the logger options
   */
  configure(options: Partial<ThreatAnalysisLogOptions>): void {
    this.options = { ...this.options, ...options };
    console.log('[ThreatAnalysisLogger] Configured with options:', {
      ...this.options,
      logFilePath: this.options.logFilePath ? '(set)' : '(not set)'
    });
  }

  /**
   * Initialize logging directory (no-op in browser)
   */
  async initializeLogDirectory(): Promise<void> {
    // In browser mode, we use localStorage and memory
    console.log('[ThreatAnalysisLogger] Browser mode - using localStorage for persistence');
    
    // Load existing logs from storage
    this.loadLogsFromStorage();
  }

  /**
   * Start a new analysis session
   */
  startSession(): string {
    this.currentSessionId = `session-${Date.now()}-${crypto.randomUUID()}`;
    this.analysisCount = 0;
    console.log(`[ThreatAnalysisLogger] Started new session: ${this.currentSessionId}`);
    
    this.log({
      type: 'context',
      content: `New threat analysis session started`,
      metadata: {
        mode: 'browser'
      }
    });
    
    return this.currentSessionId;
  }

  /**
   * End the current session
   */
  endSession(): void {
    if (this.currentSessionId) {
      this.log({
        type: 'context',
        content: `Threat analysis session ended. Total analyses: ${this.analysisCount}`,
        metadata: {
          duration: Date.now() - parseInt(this.currentSessionId.split('-')[1])
        }
      });
      
      // Save session logs to storage
      this.saveLogsToStorage();
      
      this.currentSessionId = null;
      this.analysisCount = 0;
    }
  }

  /**
   * Generate a unique analysis ID
   */
  generateAnalysisId(): string {
    this.analysisCount++;
    return `analysis-${this.analysisCount}-${Date.now()}`;
  }

  /**
   * Log an analysis entry
   */
  async log(entry: Omit<ThreatAnalysisLogEntry, 'timestamp' | 'sessionId' | 'analysisId'> & { analysisId?: string }): Promise<void> {
    if (!this.options.enabled) return;

    const logEntry: ThreatAnalysisLogEntry = {
      timestamp: new Date(),
      sessionId: this.currentSessionId || 'no-session',
      analysisId: entry.analysisId || 'no-analysis',
      ...entry
    };

    // Apply log level filtering
    if (this.shouldFilterLog(logEntry)) {
      return;
    }

    // Store in memory
    this.sessionLogs.push(logEntry);

    // Keep only recent logs
    if (this.sessionLogs.length > this.MAX_STORED_LOGS) {
      this.sessionLogs = this.sessionLogs.slice(-this.MAX_STORED_LOGS);
    }

    // Console output for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[ThreatAnalysis] ${logEntry.type}:`, logEntry.content, logEntry.metadata);
    }

    // Format and save
    const formattedLine = this.formatLogEntry(logEntry);
    await this.writeToFile(formattedLine);
  }

  /**
   * Start an analysis (with flexible signature for compatibility)
   */
  async startAnalysis(
    nodeCountOrAnalysisId: string | number, 
    edgeCountOrNodeCount?: number, 
    optionsOrEdgeCount?: number | Record<string, any>
  ): Promise<void> {
    // Handle both signatures
    if (typeof nodeCountOrAnalysisId === 'string') {
      // New signature: (analysisId, nodeCount, edgeCount)
      const analysisId = nodeCountOrAnalysisId;
      const nodeCount = edgeCountOrNodeCount || 0;
      const edgeCount = typeof optionsOrEdgeCount === 'number' ? optionsOrEdgeCount : 0;
      await this.logAnalysisStart(analysisId, nodeCount, edgeCount);
    } else {
      // Old signature: (nodeCount, edgeCount, options)
      const nodeCount = nodeCountOrAnalysisId;
      const edgeCount = edgeCountOrNodeCount || 0;
      const analysisId = this.generateAnalysisId();
      await this.logAnalysisStart(analysisId, nodeCount, edgeCount);
    }
  }

  /**
   * Log the start of an analysis
   */
  async logAnalysisStart(analysisId: string, nodeCount: number, edgeCount: number): Promise<void> {
    await this.log({
      type: 'analysis_start',
      analysisId,
      content: `Starting threat analysis for diagram with ${nodeCount} nodes and ${edgeCount} edges`,
      metadata: {
        batchSize: nodeCount + edgeCount
      }
    });
  }

  /**
   * Log node analysis
   */
  async logNodeAnalysis(
    analysisId: string, 
    node: SecurityNode, 
    threats: ThreatData[], 
    analysisData?: unknown
  ): Promise<void> {
    const entry: Partial<ThreatAnalysisLogEntry> = {
      type: 'node_analysis',
      analysisId,
      content: `Analyzed node "${node.data.label || node.id}" (${node.type}) - Found ${threats.length} threats`,
      metadata: {
        nodeId: node.id,
        nodeType: node.type,
        nodeLabel: node.data.label,
        zone: (node.data as any).zone || undefined,
        threatsFound: threats.length,
        severity: this.calculateHighestSeverity(threats)
      },
      threats: this.options.logLevel === 'verbose' ? threats : undefined
    };

    // Add full context if enabled
    if (this.options.includeFullContext || this.options.includeNodeData) {
      entry.fullContext = {
        node: this.sanitizeNodeData(node),
        rawAnalysisData: this.options.logLevel === 'verbose' ? analysisData : undefined
      };
    }

    await this.log(entry as any);
  }

  /**
   * Log edge analysis
   */
  async logEdgeAnalysis(
    analysisId: string,
    edge: SecurityEdge,
    sourceNode: SecurityNode,
    targetNode: SecurityNode,
    threats: ThreatData[],
    analysisData?: unknown
  ): Promise<void> {
    const entry: Partial<ThreatAnalysisLogEntry> = {
      type: 'edge_analysis',
      analysisId,
      content: `Analyzed connection "${edge.data?.label || edge.id}" from "${sourceNode.data.label}" to "${targetNode.data.label}" - Found ${threats.length} threats`,
      metadata: {
        edgeId: edge.id,
        edgeLabel: edge.data?.label,
        threatsFound: threats.length,
        severity: this.calculateHighestSeverity(threats)
      },
      threats: this.options.logLevel === 'verbose' ? threats : undefined
    };

    // Add full context if enabled
    if (this.options.includeFullContext) {
      entry.fullContext = {
        edge: this.sanitizeEdgeData(edge),
        connectedNodes: [
          this.sanitizeNodeData(sourceNode),
          this.sanitizeNodeData(targetNode)
        ],
        rawAnalysisData: this.options.logLevel === 'verbose' ? analysisData : undefined
      };
    }

    await this.log(entry as any);
  }

  /**
   * Complete an analysis (with flexible signature for compatibility)
   */
  async completeAnalysis(
    analysisIdOrOptions: string | Record<string, any>,
    totalThreats?: number,
    duration?: number
  ): Promise<void> {
    if (typeof analysisIdOrOptions === 'object') {
      // New signature with options object
      const options = analysisIdOrOptions;
      const analysisId = this.generateAnalysisId();
      const threats = options.totalThreats || 0;
      const time = options.duration || 0;
      await this.logAnalysisComplete(analysisId, threats, time);
    } else {
      // Old signature: (analysisId, totalThreats, duration)
      await this.logAnalysisComplete(analysisIdOrOptions, totalThreats || 0, duration || 0);
    }
  }

  /**
   * Log analysis completion
   */
  async logAnalysisComplete(
    analysisId: string, 
    totalThreats: number, 
    duration: number
  ): Promise<void> {
    await this.log({
      type: 'analysis_complete',
      analysisId,
      content: `Threat analysis completed. Total threats found: ${totalThreats}. Duration: ${duration}ms`,
      metadata: {
        threatsFound: totalThreats,
        duration
      }
    });
  }

  /**
   * Log an error (with flexible signature for compatibility)
   */
  async logError(
    errorOrAnalysisId: string | Error,
    contextOrError?: unknown | Error | string,
    additionalContext?: unknown
  ): Promise<void> {
    let analysisId: string;
    let error: Error | string;
    let context: unknown;

    // Handle different call signatures
    if (typeof errorOrAnalysisId === 'string' && (contextOrError instanceof Error || typeof contextOrError === 'string')) {
      // New signature: (analysisId, error, context)
      analysisId = errorOrAnalysisId;
      error = contextOrError;
      context = additionalContext;
    } else if (errorOrAnalysisId instanceof Error || typeof errorOrAnalysisId === 'string') {
      // Old signature: (error, context)
      analysisId = this.generateAnalysisId();
      error = errorOrAnalysisId;
      context = contextOrError;
    } else {
      // Fallback
      analysisId = this.generateAnalysisId();
      error = 'Unknown error';
      context = errorOrAnalysisId;
    }

    await this.log({
      type: 'error',
      analysisId,
      content: `Error during analysis: ${error instanceof Error ? error.message : error}`,
      metadata: {
        severity: 'error'
      },
      fullContext: this.options.logLevel === 'verbose' ? { 
        rawAnalysisData: context 
      } : undefined
    });
  }

  /**
   * Check if a log should be filtered based on log level
   */
  private shouldFilterLog(entry: ThreatAnalysisLogEntry): boolean {
    if (this.options.logLevel === 'minimal') {
      // Only log starts, completes, and errors
      return !['analysis_start', 'analysis_complete', 'error'].includes(entry.type);
    }
    return false;
  }

  /**
   * Format a log entry for file output
   */
  private formatLogEntry(entry: ThreatAnalysisLogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const base = `[${timestamp}] [${entry.sessionId}] [${entry.analysisId}] [${entry.type.toUpperCase()}] ${entry.content}`;
    
    let formatted = base;
    
    // Add metadata if present
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      formatted += `\n  Metadata: ${JSON.stringify(entry.metadata)}`;
    }
    
    // Add threats if verbose
    if (entry.threats && entry.threats.length > 0 && this.options.logLevel === 'verbose') {
      formatted += `\n  Threats: ${JSON.stringify(entry.threats, null, 2)}`;
    }
    
    // Add full context if enabled
    if (entry.fullContext && this.options.includeFullContext) {
      formatted += `\n  Context: ${JSON.stringify(entry.fullContext, null, 2)}`;
    }
    
    return formatted + '\n';
  }

  // Static property for the timer
  private static saveTimer: NodeJS.Timeout | null = null;

  /**
   * Write to file (browser implementation saves to memory/storage)
   */
  private async writeToFile(logLine: string): Promise<void> {
    // In browser mode, we just save to storage periodically
    // The formatted logs are already in sessionLogs
    
    // Periodically save to storage
    if (!ThreatAnalysisLogger.saveTimer) {
      ThreatAnalysisLogger.saveTimer = setTimeout(() => {
        this.saveLogsToStorage();
        ThreatAnalysisLogger.saveTimer = null;
      }, 5000); // Save every 5 seconds
    }
  }

  /**
   * Calculate highest severity from threats
   */
  private calculateHighestSeverity(threats: ThreatData[]): string {
    if (threats.length === 0) return 'none';
    
    const severityOrder = ['critical', 'high', 'medium', 'low'];
    let highest = 'low';
    
    for (const threat of threats) {
      const severity = threat.severity?.toLowerCase() || 'low';
      if (severityOrder.indexOf(severity) < severityOrder.indexOf(highest)) {
        highest = severity;
      }
    }
    
    return highest;
  }

  /**
   * Sanitize node data for logging
   */
  private sanitizeNodeData(node: SecurityNode): any {
    return {
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        label: node.data.label,
        zone: node.data.zone,
        technologies: node.data.technologies,
        // Exclude sensitive data
        apiKey: node.data.apiKey ? '[REDACTED]' : undefined,
        credentials: node.data.credentials ? '[REDACTED]' : undefined
      }
    };
  }

  /**
   * Sanitize edge data for logging
   */
  private sanitizeEdgeData(edge: SecurityEdge): any {
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data ? {
        label: edge.data.label,
        protocol: edge.data.protocol,
        encrypted: edge.data.encrypted
      } : undefined
    };
  }

  /**
   * Get the default log path (browser returns description)
   */
  async getDefaultLogPath(): Promise<string> {
    return 'Browser localStorage (contextcypher_threat_logs)';
  }

  /**
   * Save logs to localStorage
   */
  private saveLogsToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.sessionLogs));
    } catch (error) {
      console.error('[ThreatAnalysisLogger] Failed to save logs to storage:', error);
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
      console.error('[ThreatAnalysisLogger] Failed to load logs from storage:', error);
      this.sessionLogs = [];
    }
  }

  /**
   * Export logs as downloadable file
   */
  downloadLogs(): Promise<boolean> {
    const logs = this.sessionLogs.map(log => this.formatLogEntry(log)).join('\n');
    const blob = new Blob([logs], { type: 'text/plain' });
    return saveExport(`threat-analysis-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`, blob);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.sessionLogs = [];
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

// Export singleton instance
export const threatAnalysisLogger = new ThreatAnalysisLogger();
