//settingsTypes.ts

export type AIProvider = 'local' | 'openai' | 'anthropic' | 'gemini';

export type LLMMode = 'local' | 'public';

export type ThemeMode = 'threatVector' | 'dark' | 'light' | 'cyberpunk' | 'matrix' | 'hacker' | 'nord' | 'synthwave' |
  'ocean' | 'dracula' | 'solarized' | 'monokai' | 'forest' | 'midnight' | 'redteam' | 'blueteam' |
  'tokyo' | 'gruvbox' | 'github' | 'vscode' | 'terminal' | 'onedark' | 'catppuccin' | 'ayu' | 'palenight' | 'custom';

export type ResponseMode = 'streaming' | 'complete';

export interface LocalLLMSettings {
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  contextWindow?: number; // Total context window size of the model
  // GPU performance settings
  gpuMemoryFraction?: number;
  numThreads?: number;
  batchSize?: number;
  // Advanced GPU settings
  gpuOverhead?: number;
  numParallel?: number;
  maxLoadedModels?: number;
  keepAlive?: string;
  gpuLayers?: number;
  selectedGPU?: string;
}



// PERSISTENT SETTINGS - These get saved to localStorage
export interface APISettings {
  llmMode: LLMMode;
  provider: AIProvider;
  // Local LLM configuration (no API key here)
  localLLM: LocalLLMSettings;
  // Provider preferences (no API keys here)
  providerConfig: {
    openai?: {
      organizationId?: string;
      model?: string;
      reasoningEffort?: string;
    };
    anthropic?: {
      model?: string;
    };
    gemini?: {
      projectId?: string;
      model?: string;
    };
  };
}

// EPHEMERAL SETTINGS - These are NEVER saved, only in memory
export interface APICredentials {
  // Current session API keys (wiped on app close)
  apiKeys: {
    openai?: string;
    anthropic?: string;
    gemini?: string;
    local?: string; // For local LLM auth if needed

  };
  // Track which keys are currently available
  activeKeys: Set<AIProvider>;
}

export interface CustomThemeColors {
  background: string;
  surface: string;
  surfaceHover: string;
  border: string;
  primary: string;
  primaryLight: string;
  secondary: string;
  textPrimary: string;
  textSecondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface OnboardingSettings {
  showInitialDiagramPrompt: boolean;
  tutorialCompleted: boolean;
}

export interface RecentDiagramFile {
  id: string;
  name: string;
  lastOpenedAt: string;
}

export interface AppSettings {
  api: APISettings;
  theme: ThemeMode;
  customTheme?: CustomThemeColors;
  responseMode: ResponseMode;
  autosave: {
    enabled: boolean;
    intervalMinutes: number;
  };
  license: {
    accepted: boolean;
    acceptedDate?: string;
    version: string;
  };
  effects: {
    enabled: boolean;
    particles: boolean;
    animations: boolean;
    neon: boolean;
    glitch: boolean;
    matrix: boolean;
  };
  chatHistoryLogging: {
    enabled: boolean;
    logFilePath: string;
    userHasSetPreference?: boolean; // Track if user has explicitly set their preference
  };
  /**
   * Web search settings for the Analysis Chat feature (Pro only).
   * Allows the AI assistant to search trusted CTI domains for real-time threat intelligence.
   */
  chatWebSearch?: {
    enabled: boolean;
    maxSearches: number;
    domainCategories: string[];
  };
  /**
   * When enabled (Pro only), all user messages, custom context text, and diagram metadata
   * are sanitized to remove IP addresses, emails, API keys, and other sensitive business terms
   * before they are sent to PUBLIC cloud LLM providers. This is ignored in Local LLM mode.
   */
  sanitization: {
    enabled: boolean;
    showNotices?: boolean;
  };
  threatAnalysisLogging: {
    enabled: boolean;
    logFilePath: string;
    includeFullContext: boolean;
    includeNodeData: boolean;
    includeAnalysisSettings: boolean;
    logLevel: 'minimal' | 'standard' | 'verbose';
    userHasSetPreference?: boolean;
  };
  snapToGrid: boolean;
  themeAwareNodeColors: boolean; // Use theme colors for node borders
  // smartContext removed - context optimization is always enabled
  useFloatingWindows: boolean; // Use floating windows instead of modal dialogs
  edgeStyle: 'smoothstep' | 'linear' | 'bezier'; // Edge rendering style
  edgeMode: 'floating' | 'fixed'; // Edge connection mode: floating (dynamic) or fixed (handle-based)
  threatAnalysis: {
    mode: 'manual' | 'semi-auto' | 'full-auto';
    batchLimit: number;
    // Relationships and attack-path analysis are always enabled; flags removed.
    warnOnHighTokenUsage?: boolean;
    highTokenThreshold?: number;
    targetedModeEnabled?: boolean;
    webSearch?: {
      enabled: boolean;
      maxSearchesPerComponent: number;
      maxSearchesPerAnalysis: number;
      domainCategories: string[];  // Which categories to search
    };
  };
  secOps: {
    enabled: boolean;
    features: {
      atpMapping: boolean;
      ttpCoverage: boolean;
      detectionGaps: boolean;
      huntingQueries: boolean;
    };
    analysisDepth: 'standard' | 'deep' | 'custom';
    threatIntel: {
      localSources: string[]; // Paths to local threat intel files
      externalFeeds: {
        enabled: boolean;
        urls: string[];
        apiKeys?: Record<string, string>; // Stored separately in credentials
      };
    };
  };
  secureStorage?: {
    enabled: boolean;
  };
  nodeDisplayMode: 'icon' | 'expanded';
  debugPanelEnabled?: boolean;
  onboarding?: OnboardingSettings;
  recentDiagramFiles?: RecentDiagramFile[];
}

export interface SettingsContextType {
  settings: AppSettings;
  credentials: APICredentials;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  updateAPISettings: (newAPISettings: Partial<APISettings>) => void;

  // Separate methods for handling API keys (memory only)
  setAPIKey: (provider: AIProvider, apiKey: string, additionalData?: { organizationId?: string; projectId?: string }) => Promise<void>;
  clearAPIKey: (provider: AIProvider) => void;
  clearAllAPIKeys: () => void;
  hasAPIKey: (provider: AIProvider) => boolean;
  getAPIKey: (provider: AIProvider) => string | undefined;
  isInitialized: boolean;
}
