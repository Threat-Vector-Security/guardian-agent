import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import DiagramEditor from './components/DiagramEditor';
import GrcModule from './components/grc/GrcModule';
import { AnalysisContextProvider } from './components/AnalysisContextProvider';
import { ManualAnalysisProvider } from './contexts/ManualAnalysisContext';
import { SettingsProvider, useSettings } from './settings/SettingsContext';

import { getTheme } from './styles/Theme';
import ErrorBoundary from './components/ErrorBoundary';
import WelcomeScreen from './components/WelcomeScreen';
import { ThemeEffects, ParticleSystem } from './components/effects';
import { detectServerPort } from './api';
import { ConnectionStatus } from './components/ConnectionStatus';
import { initializeConsoleLogger } from './utils/consoleLogger';
import { DebugPanel } from './components/DebugPanel';
import { getDynamicModelInfo } from './utils/modelConstants';
import { setGlobalContextWindow } from './utils/tokenEstimator';
import { connectionManager } from './services/ConnectionManager';
import { SessionStorageService } from './services/SessionStorageService';
import { ViewStateProvider } from './contexts/ViewStateContext';
import { AppModuleMode, DiagramContextSnapshot, GrcWorkspace } from './types/GrcTypes';
import { createDefaultGrcWorkspace, ensureGrcWorkspace } from './services/GrcWorkspaceService';
import { DiagramFileActions } from './components/grc/GrcModule';
import { createDefaultGrcUiNavigationState, GrcUiNavigationState } from './components/grc/grcShared';

import './config/offline';
import './styles/ThemeAnimations.css';
import { applyThemeToCSS } from './styles/ThemeIntegration';

const shouldEnableConsoleLogger =
  process.env.NODE_ENV === 'development' ||
  (typeof window !== 'undefined' && window.localStorage.getItem('enableConsoleLogger') === 'true');

if (shouldEnableConsoleLogger) {
  initializeConsoleLogger();
}

// Create dynamic Material-UI theme
const createAppTheme = (themeName: string, customTheme?: any) => {
  const currentTheme = getTheme(themeName, customTheme);
  return createTheme({
    palette: {
      mode: themeName === 'light' ? 'light' : 'dark',
      primary: {
        main: currentTheme.colors.primary,
      },
      secondary: {
        main: currentTheme.colors.secondary,
      },
      background: {
        default: currentTheme.colors.background,
        paper: currentTheme.colors.surface,
      },
      text: {
        primary: currentTheme.colors.textPrimary,
        secondary: currentTheme.colors.textSecondary,
      },
      error: {
        main: currentTheme.colors.error,
      },
      warning: {
        main: currentTheme.colors.warning,
      },
      success: {
        main: currentTheme.colors.success,
      },
      info: {
        main: currentTheme.colors.info,
      }
    },
    transitions: {
      duration: {
        shortest: 150,
        shorter: 200,
        short: 250,
        standard: 300,
        complex: 375,
        enteringScreen: 225,
        leavingScreen: 195,
      },
    },
    // Add custom colors to the theme
    colors: currentTheme.colors,
  });
};

console.log('App - Starting in offline mode without authentication');

function AppContent() {
  const { settings, updateSettings, isInitialized } = useSettings();
  const [activeModule, setActiveModule] = useState<AppModuleMode>('diagram');
  const [grcWorkspace, setGrcWorkspace] = useState<GrcWorkspace>(() => createDefaultGrcWorkspace());
  const [grcUiNavigationState, setGrcUiNavigationState] = useState<GrcUiNavigationState>(() => createDefaultGrcUiNavigationState());
  const [diagramSnapshot, setDiagramSnapshot] = useState<DiagramContextSnapshot | null>(null);
  const diagramSnapshotRef = useRef<DiagramContextSnapshot | null>(null);
  const [diagramFileActions, setDiagramFileActions] = useState<DiagramFileActions | null>(null);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);
  const [hasCompletedWelcome, setHasCompletedWelcome] = useState(false);

  const activeModuleRef = useRef<AppModuleMode>('diagram');
  useEffect(() => {
    activeModuleRef.current = activeModule;
  }, [activeModule]);

  const handleModuleSwitch = useCallback((moduleMode: AppModuleMode) => {
    setActiveModule(moduleMode);
    if (moduleMode === 'grc') {
      setDiagramSnapshot(diagramSnapshotRef.current);
    }
  }, []);

  const handleWorkspaceChange = useCallback((nextWorkspace: GrcWorkspace) => {
    setGrcWorkspace(ensureGrcWorkspace(nextWorkspace));
  }, []);

  const handleGrcUiNavigationStateChange = useCallback((updater: (prev: GrcUiNavigationState) => GrcUiNavigationState) => {
    setGrcUiNavigationState(prev => updater(prev));
  }, []);

  const handleWorkspaceLoad = useCallback((loadedWorkspace: unknown) => {
    if (loadedWorkspace === null || loadedWorkspace === undefined) {
      setGrcWorkspace(createDefaultGrcWorkspace());
      return;
    }
    setGrcWorkspace(ensureGrcWorkspace(loadedWorkspace));
  }, []);

  const handleDiagramContextChange = useCallback((snapshot: DiagramContextSnapshot) => {
    diagramSnapshotRef.current = snapshot;
    if (activeModuleRef.current === 'grc') {
      setDiagramSnapshot(snapshot);
    }
  }, []);

  const handleDiagramFileActionsReady = useCallback((actions: DiagramFileActions) => {
    setDiagramFileActions(actions);
  }, []);

  // Clear session storage on app startup to ensure clean state
  useEffect(() => {
    console.log('[App] App started - clearing session storage');
    SessionStorageService.clearUpgradePromptFlag();
  }, []); // Empty dependency array ensures this runs only once on mount


  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const serverInitializedRef = useRef(false);

  useEffect(() => {
    if (serverInitializedRef.current) return;
    serverInitializedRef.current = true;

    const initializeServer = async () => {
      console.log('Initializing browser mode connection...');

      await new Promise(resolve => setTimeout(resolve, 500));

      let portDetected = false;
      let portRetries = 0;
      const maxPortRetries = 5;

      while (!portDetected && portRetries < maxPortRetries) {
        try {
          await detectServerPort();
          portDetected = true;
          console.log('Server port detected successfully');
        } catch (error) {
          portRetries++;
          console.warn(`Port detection attempt ${portRetries} failed:`, error);
          if (portRetries < maxPortRetries) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      if (!portDetected) {
        console.error('Failed to detect server port after multiple attempts');
      }
    };

    initializeServer();

    let handled = false;
    let unsubscribe: () => void = () => {};
    unsubscribe = connectionManager.subscribe(async (status) => {
      if (!status.connected) {
        console.log('[App] Waiting for server connection before initializing token estimator...');
        return;
      }

      if (handled) return;
      handled = true;
      unsubscribe();

      setTimeout(async () => {
        try {
          const s = settingsRef.current;
          const provider = s.api.provider;
          const model = s.api.llmMode === 'local' ? s.api.localLLM.model : (s.api.providerConfig[provider as 'openai' | 'anthropic' | 'gemini'] as any)?.model;
          const info = await getDynamicModelInfo(model, provider);
          setGlobalContextWindow(info.maxInputTokens);
          console.log('[Startup] Context window set for token estimator:', info.maxInputTokens, 'model:', model, 'provider:', provider);
        } catch (e) {
          console.warn('[Startup] Failed to initialize token estimator context window:', e);
        }
      }, 1000);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Wait for persisted settings to load before deciding — otherwise the
    // default (accepted: false) briefly wins and the welcome screen shows on
    // every reload even after the user has accepted.
    if (!isInitialized) return;
    const isFirstRun = localStorage.getItem('ai-threat-modeler-first-run') === null;
    if (isFirstRun || !settings.license.accepted) {
      setShowWelcomeScreen(true);
      localStorage.setItem('hideDebugPanelUntilWelcomeClosed', 'true');
      console.log('[App] Set hideDebugPanelUntilWelcomeClosed flag');
    } else {
      setShowWelcomeScreen(false);
    }
  }, [isInitialized, settings.license.accepted]);

  useEffect(() => {
    const completed = localStorage.getItem('ai-threat-modeler-first-run') === 'completed';
    if (completed && settings.license.accepted && !showWelcomeScreen) {
      setHasCompletedWelcome(true);
    }
  }, [settings.license.accepted, showWelcomeScreen]);


  const handleWelcomeAccept = () => {
    try {
      // Update settings to mark license as accepted
      updateSettings({
        license: {
          ...settings.license,
          accepted: true,
          acceptedDate: new Date().toISOString()
        }
      });
      
      // Mark first run as completed
      localStorage.setItem('ai-threat-modeler-first-run', 'completed');
      localStorage.setItem('ai-threat-modeler-setup-date', new Date().toISOString());
      
      setShowWelcomeScreen(false);
      setHasCompletedWelcome(true);
      localStorage.removeItem('hideDebugPanelUntilWelcomeClosed');
      // Don't force debug panel visible - respect user's saved preference
      // Only set it visible on very first run if no preference exists
      if (localStorage.getItem('debugPanelVisible') === null) {
        localStorage.setItem('debugPanelVisible', 'false'); // Default to hidden
      }
      console.log('[App] Removed hideDebugPanelUntilWelcomeClosed flag, respecting user debug panel preference');
      
      console.log('Welcome screen completed - proceeding with application');
      
      // For free users, we need to wait for any potential license validation to complete
      // This is a bit tricky because license validation might be happening in the background
      console.log('[App] Welcome screen closed, will check for upgrade prompt after license validation');
      
      // Set a flag to indicate we should check for upgrade prompt after license validation
      window.localStorage.setItem('check-upgrade-prompt-after-welcome', 'true');
    } catch (error) {
      console.error('Error accepting welcome screen:', error);
    }
  };

  const handleWelcomeDecline = () => {
    // Exit the application if declined
    // In browser mode, just close the tab/window
    window.close();
  };

  return (
    <>
      <WelcomeScreen
        open={showWelcomeScreen}
        onAccept={handleWelcomeAccept}
        onDecline={handleWelcomeDecline}
      />
      
      <AnalysisContextProvider>
        <ManualAnalysisProvider>
          <ThemeEffects>
            <Box 
              sx={{ 
                height: '100vh',
                width: '100vw',
                backgroundColor: getTheme(settings.theme, settings.customTheme).colors.background,
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              {/* Background particle effects */}
              <ParticleSystem
                type={
                  settings.theme === 'matrix' ? 'matrix' :
                  settings.theme === 'cyberpunk' ? 'cyberpunk' :
                  settings.theme === 'synthwave' ? 'synthwave' : 'matrix'
                }
                active={settings.effects?.particles ?? false}
                intensity={30}
              />
              
              <Box sx={{ height: '100%', width: '100%', display: activeModule === 'diagram' ? 'block' : 'none' }}>
                <DiagramEditor
                  onboardingReady={hasCompletedWelcome}
                  activeModule={activeModule}
                  onSwitchModule={handleModuleSwitch}
                  grcWorkspace={grcWorkspace}
                  onGrcWorkspaceLoad={handleWorkspaceLoad}
                  onDiagramContextChange={handleDiagramContextChange}
                  onFileActionsReady={handleDiagramFileActionsReady}
                />
              </Box>

              {activeModule === 'grc' && (
                <Box sx={{ height: '100%', width: '100%' }}>
                  <GrcModule
                    workspace={grcWorkspace}
                    onWorkspaceChange={handleWorkspaceChange}
                    onSwitchModule={handleModuleSwitch}
                    diagramSnapshot={diagramSnapshot}
                    diagramFileActions={diagramFileActions}
                    uiNavigationState={grcUiNavigationState}
                    onUiNavigationStateChange={handleGrcUiNavigationStateChange}
                  />
                </Box>
              )}
              
              {/* Connection status indicator */}
              <ConnectionStatus />
            </Box>
          </ThemeEffects>
        </ManualAnalysisProvider>
      </AnalysisContextProvider>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <AppWithTheme />
      </SettingsProvider>
    </ErrorBoundary>
  );
}

function AppWithTheme() {
  const { settings, updateSettings } = useSettings();
  const theme = useMemo(() => createAppTheme(settings.theme, settings.customTheme), [settings.theme, settings.customTheme]);
  const shouldRenderDebugPanel =
    process.env.NODE_ENV === 'development' ||
    (settings.debugPanelEnabled ?? false);

  // Apply CSS variables for instant theme switching
  useEffect(() => {
    const currentTheme = getTheme(settings.theme, settings.customTheme);
    applyThemeToCSS(currentTheme);
  }, [settings.theme, settings.customTheme]);

  const handleDebugPanelVisibilityChange = useCallback((visible: boolean) => {
    if ((settings.debugPanelEnabled ?? false) !== visible) {
      updateSettings({ debugPanelEnabled: visible });
    }
  }, [settings.debugPanelEnabled, updateSettings]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ViewStateProvider>
        <AppContent />
        {shouldRenderDebugPanel && <DebugPanel onVisibilityChange={handleDebugPanelVisibilityChange} />}
      </ViewStateProvider>
    </ThemeProvider>
  );
}

export default App;
