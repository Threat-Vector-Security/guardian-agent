//settings.ts
import { AppSettings } from '../types/SettingsTypes';
import { defaultSettings as importedDefaultSettings } from './defaultSettings';

const shouldDebugLog = process.env.NODE_ENV !== 'production';
const debugLog = (...args: unknown[]) => {
  if (shouldDebugLog) {
    console.log(...args);
  }
};

const summarizeSettingsForDebug = (settings?: Partial<AppSettings> | null) => ({
  hasSettings: !!settings,
  provider: settings?.api?.provider,
  llmMode: settings?.api?.llmMode,
  theme: settings?.theme,
  recentDiagramCount: settings?.recentDiagramFiles?.length || 0
});

// Use the imported default settings to ensure consistency
export const defaultSettings = importedDefaultSettings;

// Load settings from localStorage
export const loadSettings = (): AppSettings => {
  const savedSettings = localStorage.getItem('settings');
  
  debugLog('Loading settings from localStorage');
  
  if (!savedSettings) {
    debugLog('No saved settings found; using defaults', summarizeSettingsForDebug(defaultSettings));
    return defaultSettings;
  }
  
  // Parse saved settings
  const parsedSettings = JSON.parse(savedSettings) as Partial<AppSettings>;
  debugLog('Parsed settings summary:', summarizeSettingsForDebug(parsedSettings));
  
  // Migrate old bundled AI settings to local LLM
  if (parsedSettings.api) {
    const legacyMode = parsedSettings.api.llmMode as string;
    if (legacyMode === 'bundled-ai' || legacyMode === 'bundled') {
      debugLog('Migrating old bundled AI settings to local LLM');
      parsedSettings.api.llmMode = 'local';
      parsedSettings.api.provider = 'local';
    }
  }
  
  // Ensure all required properties exist by merging with default settings
  const mergedSettings = {
    ...defaultSettings,
    ...parsedSettings,
    // Ensure nested objects are properly merged
    api: {
      ...defaultSettings.api,
      ...(parsedSettings.api || {}),

      localLLM: {
        ...defaultSettings.api.localLLM,
        ...(parsedSettings.api?.localLLM || {})
      },
      providerConfig: {
        ...defaultSettings.api.providerConfig,
        ...(parsedSettings.api?.providerConfig || {}),
        // Deep merge provider configurations
        openai: {
          ...defaultSettings.api.providerConfig.openai,
          ...(parsedSettings.api?.providerConfig?.openai || {})
        },
        anthropic: {
          ...defaultSettings.api.providerConfig.anthropic,
          ...(parsedSettings.api?.providerConfig?.anthropic || {})
        },
        gemini: {
          ...defaultSettings.api.providerConfig.gemini,
          ...(parsedSettings.api?.providerConfig?.gemini || {})
        }
      }
    },
    // Deep merge other nested objects
    autosave: {
      ...defaultSettings.autosave,
      ...(parsedSettings.autosave || {})
    },
    license: {
      ...defaultSettings.license,
      ...(parsedSettings.license || {})
    },
    effects: {
      ...defaultSettings.effects,
      ...(parsedSettings.effects || {})
    },
    chatHistoryLogging: {
      ...defaultSettings.chatHistoryLogging,
      ...(parsedSettings.chatHistoryLogging || {}),
      // Ensure userHasSetPreference defaults to false for existing users
      userHasSetPreference: parsedSettings.chatHistoryLogging?.userHasSetPreference ?? false
    },
    threatAnalysis: {
      ...defaultSettings.threatAnalysis,
      ...(parsedSettings.threatAnalysis || {})
    },
    secOps: {
      ...defaultSettings.secOps,
      ...(parsedSettings.secOps || {}),
      features: {
        ...defaultSettings.secOps.features,
        ...(parsedSettings.secOps?.features || {})
      },
      threatIntel: {
        ...defaultSettings.secOps.threatIntel,
        ...(parsedSettings.secOps?.threatIntel || {}),
        externalFeeds: {
          ...defaultSettings.secOps.threatIntel.externalFeeds,
          ...(parsedSettings.secOps?.threatIntel?.externalFeeds || {})
        }
      }
    },
    // Handle custom theme
    customTheme: parsedSettings.customTheme || defaultSettings.customTheme,
    // Handle snap to grid
    snapToGrid: parsedSettings.snapToGrid ?? defaultSettings.snapToGrid,
    onboarding: {
      showInitialDiagramPrompt:
        parsedSettings.onboarding?.showInitialDiagramPrompt ??
        defaultSettings.onboarding?.showInitialDiagramPrompt ??
        true,
      tutorialCompleted:
        parsedSettings.onboarding?.tutorialCompleted ??
        defaultSettings.onboarding?.tutorialCompleted ??
        false
    },
    recentDiagramFiles: Array.isArray(parsedSettings.recentDiagramFiles)
      ? parsedSettings.recentDiagramFiles
        .filter((entry: any) => entry && typeof entry.id === 'string' && typeof entry.name === 'string')
        .map((entry: any) => ({
          id: entry.id,
          name: entry.name,
          lastOpenedAt: typeof entry.lastOpenedAt === 'string' ? entry.lastOpenedAt : new Date().toISOString()
        }))
      : (defaultSettings.recentDiagramFiles || [])
  };
  
  debugLog('Final merged settings summary:', summarizeSettingsForDebug(mergedSettings));
  return mergedSettings;
};

// Build an allow-listed settings payload so credentials never reach localStorage.
export const buildPersistedSettings = (settings: AppSettings): AppSettings => {
  const providerConfig = settings.api.providerConfig || {};

  return {
    api: {
      llmMode: settings.api.llmMode,
      provider: settings.api.provider,
      localLLM: {
        baseUrl: settings.api.localLLM.baseUrl,
        model: settings.api.localLLM.model,
        temperature: settings.api.localLLM.temperature,
        maxTokens: settings.api.localLLM.maxTokens,
        ...(settings.api.localLLM.contextWindow !== undefined ? { contextWindow: settings.api.localLLM.contextWindow } : {}),
        ...(settings.api.localLLM.gpuMemoryFraction !== undefined ? { gpuMemoryFraction: settings.api.localLLM.gpuMemoryFraction } : {}),
        ...(settings.api.localLLM.numThreads !== undefined ? { numThreads: settings.api.localLLM.numThreads } : {}),
        ...(settings.api.localLLM.batchSize !== undefined ? { batchSize: settings.api.localLLM.batchSize } : {}),
        ...(settings.api.localLLM.gpuOverhead !== undefined ? { gpuOverhead: settings.api.localLLM.gpuOverhead } : {}),
        ...(settings.api.localLLM.numParallel !== undefined ? { numParallel: settings.api.localLLM.numParallel } : {}),
        ...(settings.api.localLLM.maxLoadedModels !== undefined ? { maxLoadedModels: settings.api.localLLM.maxLoadedModels } : {}),
        ...(settings.api.localLLM.keepAlive !== undefined ? { keepAlive: settings.api.localLLM.keepAlive } : {}),
        ...(settings.api.localLLM.gpuLayers !== undefined ? { gpuLayers: settings.api.localLLM.gpuLayers } : {}),
        ...(settings.api.localLLM.selectedGPU !== undefined ? { selectedGPU: settings.api.localLLM.selectedGPU } : {})
      },
      providerConfig: {
        ...(providerConfig.openai ? {
          openai: {
            organizationId: providerConfig.openai.organizationId,
            model: providerConfig.openai.model,
            reasoningEffort: providerConfig.openai.reasoningEffort
          }
        } : {}),
        ...(providerConfig.anthropic ? {
          anthropic: {
            model: providerConfig.anthropic.model
          }
        } : {}),
        ...(providerConfig.gemini ? {
          gemini: {
            projectId: providerConfig.gemini.projectId,
            model: providerConfig.gemini.model
          }
        } : {})
      }
    },
    theme: settings.theme,
    customTheme: settings.customTheme,
    responseMode: settings.responseMode,
    autosave: {
      enabled: settings.autosave.enabled,
      intervalMinutes: settings.autosave.intervalMinutes
    },
    license: {
      accepted: settings.license.accepted,
      acceptedDate: settings.license.acceptedDate,
      version: settings.license.version
    },
    effects: {
      enabled: settings.effects.enabled,
      particles: settings.effects.particles,
      animations: settings.effects.animations,
      neon: settings.effects.neon,
      glitch: settings.effects.glitch,
      matrix: settings.effects.matrix
    },
    chatHistoryLogging: {
      enabled: settings.chatHistoryLogging.enabled,
      logFilePath: settings.chatHistoryLogging.logFilePath,
      userHasSetPreference: settings.chatHistoryLogging.userHasSetPreference
    },
    chatWebSearch: settings.chatWebSearch ? {
      enabled: settings.chatWebSearch.enabled,
      maxSearches: settings.chatWebSearch.maxSearches,
      domainCategories: [...settings.chatWebSearch.domainCategories]
    } : undefined,
    sanitization: {
      enabled: settings.sanitization.enabled,
      showNotices: settings.sanitization.showNotices
    },
    threatAnalysisLogging: {
      enabled: settings.threatAnalysisLogging.enabled,
      logFilePath: settings.threatAnalysisLogging.logFilePath,
      includeFullContext: settings.threatAnalysisLogging.includeFullContext,
      includeNodeData: settings.threatAnalysisLogging.includeNodeData,
      includeAnalysisSettings: settings.threatAnalysisLogging.includeAnalysisSettings,
      logLevel: settings.threatAnalysisLogging.logLevel,
      userHasSetPreference: settings.threatAnalysisLogging.userHasSetPreference
    },
    snapToGrid: settings.snapToGrid,
    themeAwareNodeColors: settings.themeAwareNodeColors,
    useFloatingWindows: settings.useFloatingWindows,
    edgeStyle: settings.edgeStyle,
    edgeMode: settings.edgeMode,
    threatAnalysis: {
      mode: settings.threatAnalysis.mode,
      batchLimit: settings.threatAnalysis.batchLimit,
      warnOnHighTokenUsage: settings.threatAnalysis.warnOnHighTokenUsage,
      highTokenThreshold: settings.threatAnalysis.highTokenThreshold,
      targetedModeEnabled: settings.threatAnalysis.targetedModeEnabled,
      webSearch: settings.threatAnalysis.webSearch ? {
        enabled: settings.threatAnalysis.webSearch.enabled,
        maxSearchesPerComponent: settings.threatAnalysis.webSearch.maxSearchesPerComponent,
        maxSearchesPerAnalysis: settings.threatAnalysis.webSearch.maxSearchesPerAnalysis,
        domainCategories: [...settings.threatAnalysis.webSearch.domainCategories]
      } : undefined
    },
    secOps: {
      enabled: settings.secOps.enabled,
      features: {
        atpMapping: settings.secOps.features.atpMapping,
        ttpCoverage: settings.secOps.features.ttpCoverage,
        detectionGaps: settings.secOps.features.detectionGaps,
        huntingQueries: settings.secOps.features.huntingQueries
      },
      analysisDepth: settings.secOps.analysisDepth,
      threatIntel: {
        localSources: [...settings.secOps.threatIntel.localSources],
        externalFeeds: {
          enabled: settings.secOps.threatIntel.externalFeeds.enabled,
          urls: [...settings.secOps.threatIntel.externalFeeds.urls]
        }
      }
    },
    secureStorage: settings.secureStorage ? {
      enabled: settings.secureStorage.enabled
    } : undefined,
    nodeDisplayMode: settings.nodeDisplayMode,
    debugPanelEnabled: settings.debugPanelEnabled,
    onboarding: settings.onboarding ? {
      showInitialDiagramPrompt: settings.onboarding.showInitialDiagramPrompt,
      tutorialCompleted: settings.onboarding.tutorialCompleted
    } : undefined,
    recentDiagramFiles: settings.recentDiagramFiles?.map((entry) => ({
      id: entry.id,
      name: entry.name,
      lastOpenedAt: entry.lastOpenedAt
    }))
  };
};

// Save settings to localStorage
export const saveSettings = (settings: AppSettings): void => {
  const persistedSettings = buildPersistedSettings(settings);
  debugLog('Saving settings to localStorage');
  localStorage.setItem('settings', JSON.stringify(persistedSettings));
};
