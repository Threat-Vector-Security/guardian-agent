//defaultSettings.ts
import { AppSettings } from '../types/SettingsTypes';

export const defaultSettings: AppSettings = {
  api: {
    llmMode: 'local',
    provider: 'local',
    localLLM: {
      baseUrl: 'http://127.0.0.1:11434',
      model: 'llama3.1:8b',
      temperature: 0.2,
      maxTokens: 16384,
      contextWindow: 8192,
    },
    providerConfig: {
      openai: {
        organizationId: '',
        model: 'gpt-4o-2024-08-06'
      },
      anthropic: {
        model: 'claude-sonnet-4-20250514'
      },
      gemini: {
        projectId: '',
        model: 'gemini-2.5-pro'
      }
    }
  },
  theme: 'dark',
  customTheme: undefined,
  responseMode: 'streaming',
  autosave: {
    enabled: true,
    intervalMinutes: 15
  },
  license: {
    accepted: false,
    version: '1.0.0'
  },
  effects: {
    enabled: true,
    particles: false,
    animations: true,
    neon: false,
    glitch: false,
    matrix: false
  },
  chatHistoryLogging: {
    enabled: false, // Will be enabled automatically for Pro users
    logFilePath: '',
    userHasSetPreference: false // Track if user has explicitly chosen
  },
  chatWebSearch: {
    enabled: false,  // Will be enabled automatically when Pro + Anthropic
    maxSearches: 5,  // Less than threat analysis since chat is more exploratory
    domainCategories: ['vulnerabilityDatabases', 'threatIntelligence', 'securityNews']  // Include news for chat context
  },
  sanitization: {
    enabled: false,
    showNotices: true
  },
  threatAnalysisLogging: {
    enabled: false,
    logFilePath: '',
    includeFullContext: true,
    includeNodeData: true,
    includeAnalysisSettings: true,
    logLevel: 'verbose' as const,
    userHasSetPreference: false
  },
  snapToGrid: true, // Enable snap to grid by default
  themeAwareNodeColors: false,
  // smartContext removed - context optimization is always enabled
  useFloatingWindows: true, // Use floating windows by default
  edgeStyle: 'smoothstep', // Default to smoothstep edges (can be 'smoothstep', 'linear', or 'bezier')
  edgeMode: 'floating', // Default to floating edges (can be 'floating' or 'fixed')
  threatAnalysis: {
    mode: 'manual',
    batchLimit: 10,
    // analyzeRelationships & includeAttackPaths removed – always enabled
    warnOnHighTokenUsage: true,
    highTokenThreshold: 0.8,
    targetedModeEnabled: false,
    webSearch: {
      enabled: true,  // Enabled by default for better threat detection
      maxSearchesPerComponent: 3,
      maxSearchesPerAnalysis: 10,
      domainCategories: ['vulnerabilityDatabases', 'threatIntelligence', 'securityVendors']  // Include security vendor advisories by default
    }
  },
  secOps: {
    enabled: false,
    features: {
      atpMapping: true,
      ttpCoverage: true,
      detectionGaps: true,
      huntingQueries: false
    },
    analysisDepth: 'standard',
    threatIntel: {
      localSources: [],
      externalFeeds: {
        enabled: false,
        urls: []
      }
    }
  },
  secureStorage: {
    enabled: true // Enable secure API key storage by default
  },
  // Node Display Settings
  nodeDisplayMode: 'icon' as const,
  debugPanelEnabled: false,
  onboarding: {
    showInitialDiagramPrompt: true,
    tutorialCompleted: false
  },
  recentDiagramFiles: []
}; 
