import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Drawer,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Alert,
  AlertTitle,
  Divider,
  IconButton,
  InputAdornment,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Tooltip,
  Backdrop,
  CircularProgress,
  FormHelperText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Collapse
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { 
  Close, 
  Visibility, 
  VisibilityOff, 
  Settings, 
  Palette, 
  Favorite,
  Psychology,
  Security,
  Coffee,
  AutoAwesome,
  School,
  PlayCircle,
  Draw,
  Hub,
  Api,
  Storage,
  ArrowForward,
  Info,
  Shield,
  CloudUpload,
  Refresh,
  CheckCircle,
  Warning,
  OpenInNew,
  Lock,
  ContentCopy,
  Restore,
  Check,
  BugReport as Bug,
  InfoOutlined,
  ExpandMore,
  ExpandLess,
  HelpOutline,
  Search as SearchIcon
} from '@mui/icons-material';
import { useSettings } from '../settings/SettingsContext';
import { AIProvider, LLMMode, ThemeMode, ResponseMode, CustomThemeColors } from '../types/SettingsTypes';
import { spacing, transitions, effects, themes, getTheme } from '../styles/Theme';
import { ThemeTransitionOverlay } from './ThemeTransitionOverlay';
import { 
  updateAIProvider, 
  cancelProviderUpdate, 
  isProviderUpdateInProgress 
} from '../services/settingsApi';
import api from '../api';
import { logToDebugPanel } from './DebugPanel';
import { chatHistoryLogger } from '../services/ChatHistoryLogger';
import { getOllamaModelContext } from '../utils/modelConstants';
import { licenseService } from '../services/LicenseService';
import { formatTokenCount } from '../utils/modelConstants';
import GuardianProviderSettings, { type GuardianProviderSettingsHandle } from './GuardianProviderSettings';
import { ColorPickerInput } from './ColorPickerInput';
import { connectionManager as ConnectionManager } from '../services/ConnectionManager';
import { setGlobalContextWindow } from '../utils/tokenEstimator';
import { openExternalLink } from '../utils/linkUtils';
import { isVercelDeployment } from '../utils/vercelDetection';
import useViewportLayout from '../hooks/useViewportLayout';

const StyledDrawer = styled(Drawer)(({ theme }) => ({
  '& .MuiDrawer-paper': {
    width: 'min(480px, 100vw)',
    backgroundColor: theme.colors.background,
    color: theme.colors.textPrimary,
    border: 'none',
    borderLeft: `1px solid ${theme.colors.border}`,
    backgroundImage: 'none',
  },
}));

const DrawerHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: spacing.lg,
  borderBottom: `1px solid ${theme.colors.border}`,
  backgroundColor: theme.colors.surface,
  minHeight: '64px',
}));

const DrawerContent = styled(Box)(({ theme }) => ({
  padding: 0,
  paddingLeft: spacing.md,
  display: 'flex',
  flexDirection: 'column',
  height: 'calc(100% - 113px)', // 64px header + 49px tabs
  overflow: 'hidden',
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    fontSize: '14px',
    transition: transitions.default,
    '& fieldset': {
      borderColor: theme.colors.border,
      borderWidth: '1px',
    },
    '&:hover fieldset': {
      borderColor: theme.colors.primary,
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.colors.primary,
      borderWidth: '2px',
    },
  },
  '& .MuiInputLabel-root': {
    color: theme.colors.textSecondary,
    fontSize: '14px',
    '&.Mui-focused': {
      color: theme.colors.primary,
    },
  },
  '& .MuiFormHelperText-root': {
    color: theme.colors.textSecondary,
    fontSize: '12px',
    marginLeft: '4px',
  },
  '& .MuiInputBase-input::placeholder': {
    color: theme.colors.textSecondary,
    opacity: 0.7,
  },
}));

const StyledFormControl = styled(FormControl)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    fontSize: '14px',
    transition: transitions.default,
    '& fieldset': {
      borderColor: theme.colors.border,
      borderWidth: '1px',
    },
    '&:hover fieldset': {
      borderColor: theme.colors.primary,
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.colors.primary,
      borderWidth: '2px',
    },
  },
  '& .MuiInputLabel-root': {
    color: theme.colors.textSecondary,
    fontSize: '14px',
    '&.Mui-focused': {
      color: theme.colors.primary,
    },
  },
  '& .MuiSelect-select': {
    color: theme.colors.textPrimary,
  },
}));

const StyledSelect = styled(Select)(({ theme }) => ({
  '& .MuiMenuItem-root': {
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
    '&:hover': {
      backgroundColor: theme.colors.surfaceHover,
    },
    '&.Mui-selected': {
      backgroundColor: theme.colors.primaryLight,
      '&:hover': {
        backgroundColor: theme.colors.primaryLight,
      },
    },
  },
}));

const ActionButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.colors.primary,
  color: '#ffffff',
  fontWeight: 600,
  fontSize: '14px',
  padding: `${spacing.md} ${spacing.lg}`,
  borderRadius: '6px',
  textTransform: 'none',
  transition: transitions.default,
  boxShadow: effects.shadow,
  '&:hover': {
    backgroundColor: theme.colors.primary,
    filter: effects.hover,
    boxShadow: `0 6px 12px rgba(0, 0, 0, 0.15)`,
  },
  '&.Mui-disabled': {
    backgroundColor: `${theme.colors.primary}44`,
    color: '#ffffff88',
    boxShadow: 'none',
  },
}));

const StyledAlert = styled(Alert)(({ theme }) => ({
  backgroundColor: theme.colors.surface,
  color: theme.colors.textPrimary,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: '6px',
  '& .MuiAlert-icon': {
    color: theme.colors.warning,
  },
  '& .MuiAlert-message': {
    color: theme.colors.textPrimary,
  },
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  color: theme.colors.textPrimary,
  fontWeight: 600,
  fontSize: '16px',
  marginBottom: spacing.sm,
}));

const SubsectionTitle = styled(Typography)(({ theme }) => ({
  color: theme.colors.textSecondary,
  fontWeight: 500,
  fontSize: '14px',
  marginBottom: spacing.sm,
}));

const TutorialSection = styled(Box)(({ theme }) => ({
  marginBottom: spacing.xl,
  wordWrap: 'break-word',
  overflowWrap: 'break-word',
  width: '100%',
  boxSizing: 'border-box',
  '& h3': {
    color: theme.colors.textPrimary,
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  '& h4': {
    color: theme.colors.textSecondary,
    fontSize: '14px',
    fontWeight: 500,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  '& p': {
    color: theme.colors.textSecondary,
    fontSize: '13px',
    lineHeight: 1.6,
    marginBottom: spacing.sm,
    maxWidth: '100%',
  },
  '& ul, & ol': {
    color: theme.colors.textSecondary,
    fontSize: '13px',
    lineHeight: 1.6,
    marginLeft: spacing.md,
    marginBottom: spacing.md,
    paddingRight: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
  },
  '& li': {
    wordBreak: 'break-word',
    maxWidth: '100%',
  },
  '& code': {
    backgroundColor: theme.colors.surface,
    color: theme.colors.primary,
    padding: '2px 4px',
    borderRadius: '3px',
    fontSize: '11px',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    maxWidth: '100%',
  },
  '& .MuiAlert-root': {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    width: '100%',
    boxSizing: 'border-box',
  }
}));

const ConfigSection = styled(Box)(({ theme }) => ({
  padding: spacing.md,
  backgroundColor: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: '6px',
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.md,
}));

const StyledTabs = styled(Tabs)(({ theme }) => ({
  borderBottom: `1px solid ${theme.colors.border}`,
  backgroundColor: theme.colors.surface,
  paddingLeft: spacing.md,
  '& .MuiTab-root': {
    color: theme.colors.textSecondary,
    fontSize: '12px',
    fontWeight: 500,
    textTransform: 'none',
    minHeight: '44px',
    transition: transitions.default,
    minWidth: 'auto',
    padding: '6px 12px',
    '&:hover': {
      color: theme.colors.primary,
      backgroundColor: theme.colors.surfaceHover,
    },
    '&.Mui-selected': {
      color: theme.colors.primary,
      fontWeight: 600,
    },
  },
  '& .MuiTabs-indicator': {
    backgroundColor: theme.colors.primary,
    height: '3px',
  },
}));


interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  edges?: any[]; // Optional edges from diagram
  onClearEdgeControlPoints?: () => void;
}


// Model capability detection for reasoning support
const REASONING_MODELS = {
  'o1': ['low', 'medium', 'high'],
  'o1-preview': ['low', 'medium', 'high'],
  'o1-mini': ['low', 'medium', 'high'],
  'gpt-5': ['minimal', 'low', 'medium', 'high'],
  'gpt-5-turbo': ['minimal', 'low', 'medium', 'high']
};

const isReasoningModel = (modelName: string): boolean => {
  if (!modelName) return false;
  return Object.keys(REASONING_MODELS).some(model => 
    modelName.toLowerCase().includes(model.toLowerCase())
  );
};

const getReasoningLevelsForModel = (modelName: string): string[] => {
  for (const [model, levels] of Object.entries(REASONING_MODELS)) {
    if (modelName.toLowerCase().includes(model.toLowerCase())) {
      return levels;
    }
  }
  return ['medium'];
};

// Collapsible help component
const CollapsibleHelp: React.FC<{ children: React.ReactNode; defaultText?: string }> = ({ 
  children, 
  defaultText = "Click for guidance" 
}) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <Box>
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          cursor: 'pointer',
          color: 'text.secondary',
          fontSize: '0.875rem',
          mt: 0.5,
          '&:hover': {
            color: 'primary.main'
          }
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <HelpOutline sx={{ fontSize: 16, mr: 0.5 }} />
        <Typography variant="caption">{expanded ? 'Hide guidance' : defaultText}</Typography>
        {expanded ? <ExpandLess sx={{ fontSize: 16, ml: 0.5 }} /> : <ExpandMore sx={{ fontSize: 16, ml: 0.5 }} />}
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ 
          mt: 1, 
          p: 1.5, 
          bgcolor: 'rgba(0, 0, 0, 0.05)', 
          borderRadius: 1,
          fontSize: '0.75rem',
          lineHeight: 1.6
        }}>
          {children}
        </Box>
      </Collapse>
    </Box>
  );
};

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ open, onClose, edges = [], onClearEdgeControlPoints }) => {
  const providerSettingsRef = useRef<GuardianProviderSettingsHandle>(null);
  const settingsContext = useSettings();
  const { 
    settings, 
    updateSettings,
    updateAPISettings, 
    setAPIKey,
    hasAPIKey,
    getAPIKey,
    clearAPIKey,
    clearAllAPIKeys,
    credentials,
    isInitialized
  } = settingsContext;
  
  const currentTheme = React.useMemo(() => getTheme(settings.theme, settings.customTheme), [settings.theme, settings.customTheme]);
  const { viewportTier, panelWidths } = useViewportLayout();
  const isPhoneViewport = viewportTier === 'xs' || viewportTier === 'sm';
  const settingsDrawerWidth = isPhoneViewport ? '100vw' : `${Math.round(panelWidths.analysis)}px`;
  
  // Auto-enable chat logging (only if the user hasn't set a preference)
  useEffect(() => {
    if (!settings.chatHistoryLogging?.enabled &&
        !settings.chatHistoryLogging?.userHasSetPreference) {
      {
        const enableChatLogging = async () => {
          try {
            const defaultPath = await chatHistoryLogger.getDefaultLogPath();
            updateSettings({ 
              chatHistoryLogging: { 
                enabled: true,
                logFilePath: defaultPath,
                userHasSetPreference: false // This is auto-enable, not user choice
              } 
            });
            await chatHistoryLogger.initialize({ enabled: true, logFilePath: defaultPath });
          } catch (e) {
            // Fallback to a safe relative path if default path resolution fails
            const date = new Date().toISOString().split('T')[0];
            const fallbackPath = `AI-Threat-Modeler/chat-history-${date}.log`;
            updateSettings({ 
              chatHistoryLogging: { 
                enabled: true,
                logFilePath: fallbackPath,
                userHasSetPreference: false
              } 
            });
            await chatHistoryLogger.initialize({ enabled: true, logFilePath: fallbackPath });
          }
        };
        enableChatLogging();
      }
    }
  }, [settings.chatHistoryLogging, updateSettings]);
  
  const [activeTab, setActiveTab] = useState(0);
  const [llmMode, setLLMMode] = useState<LLMMode>(
    isVercelDeployment() 
      ? 'public' 
      : (['local', 'public'].includes(settings.api.llmMode) ? settings.api.llmMode : 'local')
  );
  const [activeProvider, setActiveProvider] = useState<AIProvider>(
    isVercelDeployment() && settings.api.provider === 'local' ? 'openai' : settings.api.provider
  );
  const [localLLMConfig, setLocalLLMConfig] = useState({
    baseUrl: settings.api.localLLM.baseUrl,
    model: settings.api.localLLM.model,
    temperature: settings.api.localLLM.temperature,
    maxTokens: settings.api.localLLM.maxTokens,
    contextWindow: settings.api.localLLM.contextWindow || 8192,
    gpuMemoryFraction: settings.api.localLLM.gpuMemoryFraction || 0.9,
    numThreads: settings.api.localLLM.numThreads || 0,
    batchSize: settings.api.localLLM.batchSize || 512,
    // Advanced GPU settings
    gpuOverhead: settings.api.localLLM.gpuOverhead || 1,
    numParallel: settings.api.localLLM.numParallel || 1,
    maxLoadedModels: settings.api.localLLM.maxLoadedModels || 1,
    keepAlive: settings.api.localLLM.keepAlive || '5m',
    gpuLayers: settings.api.localLLM.gpuLayers || -1,
    selectedGPU: settings.api.localLLM.selectedGPU || 'auto'
  });
  const [showThemeTransition, setShowThemeTransition] = useState(false);
  const [pendingTheme, setPendingTheme] = useState<ThemeMode | null>(null);
  
  // Custom theme colors state
  const [customColors, setCustomColors] = useState<CustomThemeColors>({
    background: settings.customTheme?.background || '#1e1e1e',
    surface: settings.customTheme?.surface || '#252526',
    surfaceHover: settings.customTheme?.surfaceHover || '#2d2d2d',
    border: settings.customTheme?.border || 'rgba(255, 255, 255, 0.12)',
    primary: settings.customTheme?.primary || '#1976D2',
    primaryLight: settings.customTheme?.primaryLight || '#1976D220',
    secondary: settings.customTheme?.secondary || '#64B5F6',
    textPrimary: settings.customTheme?.textPrimary || '#d4d4d4',
    textSecondary: settings.customTheme?.textSecondary || '#8a8a8a',
    success: settings.customTheme?.success || '#89d185',
    warning: settings.customTheme?.warning || '#cca700',
    error: settings.customTheme?.error || '#f14c4c',
    info: settings.customTheme?.info || '#17a2b8'
  });
  
  // State for theme import
  const [selectedThemeForImport, setSelectedThemeForImport] = useState<string>('dark');
  const [copyingColors, setCopyingColors] = useState(false);
  
  // Track if error should be persistent (API test failure)
  const [persistentError, setPersistentError] = useState<string | null>(null);


  // Stabilize the transition completion callback to prevent re-renders
  const handleTransitionComplete = useCallback(() => {
    if (pendingTheme) {
      // Hide overlay first to prevent re-render cycles
      setShowThemeTransition(false);
      setPendingTheme(null);
      
      // For custom theme, the settings are already saved, just close
      // For other themes, update the theme
      if (pendingTheme !== 'custom') {
        updateSettings({ theme: pendingTheme });
      }
      
      // Close settings drawer to allow canvas to re-initialize properly
      if (!providerSettingsRef.current?.isDirty()) onClose();
    }
  }, [pendingTheme, updateSettings, onClose]);

  // Sync local state with global settings when they change (e.g., after loading from localStorage)
  useEffect(() => {
    if (isInitialized && !open) { // Only sync when drawer is closed to prevent reverting user changes
      console.log('Syncing SettingsDrawer with loaded settings:', settings.api);
      // Ensure valid llmMode, default to 'public' on Vercel, 'local' otherwise
      const defaultMode = isVercelDeployment() ? 'public' : 'local';
      const validLLMMode = ['local', 'public'].includes(settings.api.llmMode) ? settings.api.llmMode : defaultMode;
      setLLMMode(isVercelDeployment() ? 'public' : validLLMMode);
      
      // On Vercel, ensure we're not using local provider
      if (isVercelDeployment() && settings.api.provider === 'local') {
        setActiveProvider('openai');
      } else {
        setActiveProvider(settings.api.provider);
      }
      setLocalLLMConfig(prev => ({
        ...prev,
        baseUrl: settings.api.localLLM.baseUrl,
        model: settings.api.localLLM.model,
        temperature: settings.api.localLLM.temperature,
        maxTokens: settings.api.localLLM.maxTokens,
        contextWindow: settings.api.localLLM.contextWindow || prev.contextWindow || 8192,
        gpuMemoryFraction: settings.api.localLLM.gpuMemoryFraction || prev.gpuMemoryFraction || 0.9,
        numThreads: settings.api.localLLM.numThreads || prev.numThreads || 0,
        batchSize: settings.api.localLLM.batchSize || prev.batchSize || 512
      }));
      
      // Load model configurations with proper defaults
      const openaiConfig = settings.api.providerConfig?.openai;
      const anthropicConfig = settings.api.providerConfig?.anthropic;
      const geminiConfig = settings.api.providerConfig?.gemini;
      
      setOpenaiModel(openaiConfig?.model || 'gpt-4o-2024-08-06');
      setAnthropicModel(anthropicConfig?.model || 'claude-sonnet-4-20250514');
      setGeminiModel(geminiConfig?.model || 'gemini-2.5-pro');
      
      // Load reasoning levels if configured
      if (openaiConfig?.reasoningEffort) {
        setReasoningLevels(prev => ({
          ...prev,
          openai: openaiConfig.reasoningEffort || 'medium'
        }));
      }
    }
  }, [isInitialized, settings.api, open]);

  // Fetch GPU status when drawer opens and local LLM is selected
  useEffect(() => {
    if (open && llmMode === 'local') {
    }
  }, [open, llmMode]);
  
  // Ephemeral API keys kept separately for each public provider during the session
  const [providerApiKeys, setProviderApiKeys] = useState<Partial<Record<AIProvider, string>>>({
    openai: '',
    anthropic: '',
    gemini: '',
  });
  
  const [showAPIKey, setShowAPIKey] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [projectId, setProjectId] = useState('');
  
  // Track which keys are stored securely
  const [securelyStoredKeys, setSecurelyStoredKeys] = useState<Set<AIProvider>>(new Set());
  
  // Model names for each provider
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-2024-08-06');
  const [anthropicModel, setAnthropicModel] = useState('claude-sonnet-4-20250514');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-pro');
  
  // Reasoning levels for providers that support it
  const [reasoningLevels, setReasoningLevels] = useState({
    openai: 'medium',
    anthropic: 'medium', // Future support
    gemini: null // Not supported
  });
  
  // Load stored API keys when component mounts or credentials change
  useEffect(() => {
    if (isInitialized && credentials && credentials.apiKeys) {
      console.log('[SettingsDrawer] Loading stored API keys from credentials');
      const loadedKeys: Partial<Record<AIProvider, string>> = {};
      
      (['openai', 'anthropic', 'gemini'] as AIProvider[]).forEach(provider => {
        const storedKey = credentials.apiKeys[provider];
        if (storedKey) {
          console.log(`[SettingsDrawer] Found stored key for ${provider}`);
          loadedKeys[provider] = storedKey;
        }
      });
      
      if (Object.keys(loadedKeys).length > 0) {
        setProviderApiKeys(prev => ({ ...prev, ...loadedKeys }));
        setSecurelyStoredKeys(new Set(Object.keys(loadedKeys) as AIProvider[]));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, credentials]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<'test' | 'save' | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; message: string }>({
    type: 'info',
    message: '',
  });
  
  // Timer refs for auto-dismiss
  const statusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasRestoredKeys = useRef<boolean>(false);

  const [appVersion] = useState<string>(licenseService.getVersionInfo().version);
  // Resolved default log path (for helper text display)
  const [defaultLogPath, setDefaultLogPath] = useState<string>('');
  
  // Edge style change tracking
  const [pendingEdgeStyle, setPendingEdgeStyle] = useState<'smoothstep' | 'linear' | 'bezier' | null>(null);
  const [edgeStyleConfirmDialog, setEdgeStyleConfirmDialog] = useState(false);
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const handleCloseConfirmDialog = () => {
    setConfirmDialog(prev => ({ ...prev, open: false }));
  };

  const handleConfirmDialog = () => {
    confirmDialog.onConfirm();
    handleCloseConfirmDialog();
  };
  
  const getEdgeStyleLabel = useCallback((style: 'smoothstep' | 'linear' | 'bezier') => {
    if (style === 'smoothstep') return 'smoothstep (auto-turning)';
    if (style === 'bezier') return 'curved';
    return 'straight';
  }, []);

  const applyEdgeStyleChange = useCallback((newStyle: 'smoothstep' | 'linear' | 'bezier', clearControlPoints: boolean) => {
    if (clearControlPoints && onClearEdgeControlPoints) {
      onClearEdgeControlPoints();
    }

    updateSettings({ edgeStyle: newStyle });
    setStatus({
      type: 'info',
      message: `Edge style changed to ${getEdgeStyleLabel(newStyle)} lines.`
    });
  }, [getEdgeStyleLabel, onClearEdgeControlPoints, updateSettings]);

  // Handler for edge style changes
  const handleEdgeStyleChange = useCallback((newStyle: 'smoothstep' | 'linear' | 'bezier') => {
    // Check if any edges have control points
    const hasControlPoints = edges.some((edge: any) =>
      edge.data?.controlPoints && edge.data.controlPoints.length > 0
    );
    const willRemoveControlPoints = hasControlPoints && newStyle === 'smoothstep';

    if (willRemoveControlPoints && newStyle !== settings.edgeStyle) {
      // Show confirmation dialog
      setPendingEdgeStyle(newStyle);
      setConfirmDialog({
        open: true,
        title: 'Change Edge Style?',
        message: `Warning: Switching from ${getEdgeStyleLabel(settings.edgeStyle)} to ${getEdgeStyleLabel(newStyle)} edges will change the appearance of your diagram.\n\n${willRemoveControlPoints ? 'This will remove existing pivot points and replace them with auto-turning paths.' : 'Edges with control points may look different after the change.'} This action cannot be undone automatically.\n\nDo you want to continue?`,
        confirmText: 'Change Style',
        cancelText: 'Cancel',
        onConfirm: () => {
          applyEdgeStyleChange(newStyle, willRemoveControlPoints);
          setPendingEdgeStyle(null);
        }
      });
    } else {
      // No control points or same style, just update
      applyEdgeStyleChange(newStyle, false);
    }
  }, [applyEdgeStyleChange, edges, getEdgeStyleLabel, settings.edgeStyle]);
  
  // Auto-dismiss status messages after 5 seconds
  useEffect(() => {
    if (status.message && status.type !== null) {
      // Clear any existing timer
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
      
      // Set new timer to clear status after 5 seconds
      statusTimerRef.current = setTimeout(() => {
        setStatus({ type: 'info', message: '' });
      }, 5000);
    }
    
    // Cleanup on unmount
    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, [status.message, status.type]);
  
  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      // Cancel any ongoing provider update when unmounting
      cancelProviderUpdate();
    };
  }, []);
  
  // Cancel provider update when drawer closes
  useEffect(() => {
    if (!open && isProviderUpdateInProgress()) {
      cancelProviderUpdate();
    }
  }, [open]);


  // Resolve app version from package.json or environment

  // Resolve the platform-specific default log path for helper text
  useEffect(() => {
    (async () => {
      try {
        const path = await chatHistoryLogger.getDefaultLogPath();
        setDefaultLogPath(path);
      } catch {
        // noop – will fall back to generic helper text
      }
    })();
  }, []);

  // Listen for subscription status updates

  // Load current API key when provider changes
  useEffect(() => {
    if (llmMode === 'public' && activeProvider !== 'local') {
      // ensure provider key synced from stored value when switching providers
      const existingKey = getAPIKey ? getAPIKey(activeProvider) : undefined;
      setProviderApiKeys(prev => ({ ...prev, [activeProvider]: existingKey || '' }));
      
      // Load provider config (only for public providers)
      if (activeProvider === 'openai') {
        const openaiConfig = settings.api.providerConfig.openai;
        setOrganizationId(openaiConfig?.organizationId || '');
        setOpenaiModel(openaiConfig?.model || 'gpt-4o-2024-08-06');
        // Load reasoning level if configured
        if (openaiConfig?.reasoningEffort) {
          setReasoningLevels(prev => ({
            ...prev,
            openai: openaiConfig.reasoningEffort || 'medium'
          }));
        }
      } else if (activeProvider === 'gemini') {
        const geminiConfig = settings.api.providerConfig.gemini;
        setProjectId(geminiConfig?.projectId || '');
        setGeminiModel(geminiConfig?.model || 'gemini-2.5-pro');
      } else if (activeProvider === 'anthropic') {
        const anthropicConfig = settings.api.providerConfig.anthropic;
        setAnthropicModel(anthropicConfig?.model || 'claude-sonnet-4-20250514');
      }
    } else {
      setProviderApiKeys(prev => ({ ...prev, [activeProvider]: '' }));
    }
  }, [activeProvider, llmMode, settings.api.providerConfig, getAPIKey]);

  // Auto-enable web search when switching to Anthropic
  useEffect(() => {
    if (activeProvider === 'anthropic' && !settings.chatWebSearch?.enabled) {
      console.log('[SettingsDrawer] Enabling web search by default for Anthropic');
      updateSettings({
        chatWebSearch: {
          ...settings.chatWebSearch,
          enabled: true,
          maxSearches: settings.chatWebSearch?.maxSearches || 5,
          domainCategories: settings.chatWebSearch?.domainCategories || ['vulnerabilityDatabases', 'threatIntelligence', 'securityNews']
        }
      });
    }
  }, [activeProvider, settings.chatWebSearch, updateSettings]);

  const handleSaveSettings = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      if (await providerSettingsRef.current?.saveIfDirty()) onClose();
    } finally { setIsLoading(false); }
  };
  const requestClose = () => {
    if (isLoading || isProviderUpdateInProgress()) return;
    if (providerSettingsRef.current?.isDirty()) {
      setConfirmDialog({
        open: true, title: 'Discard unsaved AI settings?',
        message: 'Your model selection and API key have not been applied. Keep editing to retain them, or discard and close.',
        confirmText: 'Discard and close', cancelText: 'Keep editing',
        onConfirm: () => { providerSettingsRef.current?.discard(); onClose(); },
      });
    } else onClose();
  };

  const getProviderName = (provider: AIProvider): string => {
    switch (provider) {
      case 'openai': return 'OpenAI';
      case 'anthropic': return 'Anthropic';
      case 'gemini': return 'Google Gemini';
      case 'local': return 'Local LLM';
      default: return provider;
    }
  };

  const getStatusColor = (type: string | null): string => {
    switch (type) {
      case 'success': return currentTheme.colors.success;
      case 'error': return currentTheme.colors.error;
      case 'warning': return currentTheme.colors.warning;
      case 'info': return currentTheme.colors.info;
      default: return currentTheme.colors.primary;
    }
  };

  // Enhanced error message parsing for better user feedback
  const parseErrorMessage = (error: string): { title: string; details: string; helpText?: string } => {
    const lowerError = error.toLowerCase();
    
    if (lowerError.includes('invalid openai api key')) {
      return {
        title: 'Invalid OpenAI API Key',
        details: error,
        helpText: 'Ensure your API key starts with "sk-" and has access to the required models. You can check your API key at platform.openai.com'
      };
    }
    
    if (lowerError.includes('invalid anthropic api key')) {
      return {
        title: 'Invalid Anthropic API Key',
        details: error,
        helpText: 'Ensure your API key is correct. You can manage your API keys at console.anthropic.com'
      };
    }
    
    if (lowerError.includes('invalid google gemini api key')) {
      return {
        title: 'Invalid Google Gemini API Key',
        details: error,
        helpText: 'Ensure your API key is correct. You can get your API key at makersuite.google.com'
      };
    }
    
    if (lowerError.includes('cannot connect to local llm') || lowerError.includes('cannot connect to ollama')) {
      return {
        title: 'Cannot Connect to Local LLM',
        details: error,
        helpText: 'Make sure Ollama is running: open a command prompt and run "ollama serve". Then verify your model is installed with "ollama list"'
      };
    }
    
    if (lowerError.includes('rate limit') || lowerError.includes('429')) {
      return {
        title: 'Rate Limit Exceeded',
        details: 'Too many requests.',
        helpText: 'This usually resolves itself after a few minutes. Consider upgrading your API plan if this happens frequently.'
      };
    }
    
    if (lowerError.includes('quota') || lowerError.includes('insufficient_quota')) {
      return {
        title: 'API Quota Exceeded',
        details: 'Your account has insufficient credits.',
        helpText: 'Please check your API account balance and add credits if needed.'
      };
    }
    
    return {
      title: 'API Error',
      details: error
    };
  };


  // Handle color changes with real-time updates
  const handleColorChange = (field: keyof CustomThemeColors, value: string) => {
    const newColors = {
      ...customColors,
      [field]: value
    };
    setCustomColors(newColors);
    // Apply changes in real-time
    updateSettings({ customTheme: newColors });
  };

  // Import colors from selected theme
  const handleImportThemeColors = () => {
    const sourceTheme = getTheme(selectedThemeForImport);
    const importedColors: CustomThemeColors = {
      background: sourceTheme.colors.background,
      surface: sourceTheme.colors.surface,
      surfaceHover: sourceTheme.colors.surfaceHover,
      border: sourceTheme.colors.border,
      primary: sourceTheme.colors.primary,
      primaryLight: sourceTheme.colors.primaryLight || `${sourceTheme.colors.primary}20`,
      secondary: sourceTheme.colors.secondary,
      textPrimary: sourceTheme.colors.textPrimary,
      textSecondary: sourceTheme.colors.textSecondary,
      success: sourceTheme.colors.success,
      warning: sourceTheme.colors.warning,
      error: sourceTheme.colors.error,
      info: sourceTheme.colors.info
    };
    
    setCustomColors(importedColors);
    // Apply changes in real-time
    updateSettings({ customTheme: importedColors });
  };

  // Copy all colors to clipboard
  const handleCopyAllColors = async () => {
    try {
      const colorsText = Object.entries(customColors)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      await navigator.clipboard.writeText(colorsText);
      setCopyingColors(true);
      setTimeout(() => setCopyingColors(false), 2000);
    } catch (err) {
      console.error('Failed to copy colors:', err);
    }
  };

  // Reset to default custom theme colors
  const handleResetColors = () => {
    const defaultColors: CustomThemeColors = {
      background: '#1e1e1e',
      surface: '#252526',
      surfaceHover: '#2d2d2d',
      border: 'rgba(255, 255, 255, 0.12)',
      primary: '#1976D2',
      primaryLight: '#1976D220',
      secondary: '#64B5F6',
      textPrimary: '#d4d4d4',
      textSecondary: '#8a8a8a',
      success: '#89d185',
      warning: '#cca700',
      error: '#f14c4c',
      info: '#17a2b8'
    };
    setCustomColors(defaultColors);
    updateSettings({ customTheme: defaultColors });
  };

  const renderGeneralSettings = () => (
    <Box>
      <ConfigSection><GuardianProviderSettings ref={providerSettingsRef} /></ConfigSection>
      <Alert severity="info">AI requests return a completed response. Cancel stops the active model request.</Alert>
      {/* (Security Settings section moved above) */}

      <ConfigSection>
        <SubsectionTitle>Autosave</SubsectionTitle>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.autosave.enabled}
                onChange={(e) => updateSettings({ 
                  autosave: { 
                    ...settings.autosave, 
                    enabled: e.target.checked 
                  } 
                })}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: currentTheme.colors.primary,
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: currentTheme.colors.primary,
                  },
                }}
              />
            }
            label="Enable Autosave"
            sx={{ color: currentTheme.colors.textPrimary }}
          />
          
          {settings.autosave.enabled && (
            <StyledTextField
              label="Interval (minutes)"
              type="number"
              value={settings.autosave.intervalMinutes}
              onChange={(e) => updateSettings({ 
                autosave: { 
                  ...settings.autosave, 
                  intervalMinutes: Math.max(1, parseInt(e.target.value) || 1) 
                } 
              })}
              inputProps={{ min: 1, max: 60, step: 1 }}
              helperText="1-60 minutes"
              sx={{ width: 150 }}
            />
          )}
        </Box>
        
        <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, mt: 1 }}>
          Automatically save your diagram at regular intervals. If no save file exists, you'll be prompted to save.
        </Typography>
      </ConfigSection>

      {/* Chat History Logging */}
      <ConfigSection>
          <SubsectionTitle>Chat History Logging</SubsectionTitle>
          <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, mb: spacing.md }}>
            Automatically log all AI chat messages, complete request context, and system data to a local file. 
            Includes full prompts, diagram data, custom context, and metadata for debugging and record keeping.
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.md, mb: spacing.md }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.chatHistoryLogging?.enabled || false}
                  onChange={async (e) => {
                    const enabled = e.target.checked;
                    if (enabled && !settings.chatHistoryLogging?.logFilePath) {
                      // Initialize with default path
                      const defaultPath = await chatHistoryLogger.getDefaultLogPath();
                      updateSettings({ 
                        chatHistoryLogging: { 
                          enabled,
                          logFilePath: defaultPath,
                          userHasSetPreference: true // User explicitly enabled
                        } 
                      });
                      await chatHistoryLogger.initialize({ enabled, logFilePath: defaultPath });
                    } else {
                      updateSettings({ 
                        chatHistoryLogging: { 
                          ...settings.chatHistoryLogging,
                          enabled,
                          userHasSetPreference: true // User explicitly changed setting
                        } 
                      });
                      chatHistoryLogger.updateOptions({ enabled });
                    }
                  }}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: currentTheme.colors.primary,
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: currentTheme.colors.primary,
                    },
                  }}
                />
              }
              label="Enable Chat History Logging"
              sx={{ color: currentTheme.colors.textPrimary }}
            />
          </Box>

          {settings.chatHistoryLogging?.enabled && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              <StyledTextField
                fullWidth
                label="Log File Path"
                value={settings.chatHistoryLogging?.logFilePath || ''}
                onChange={(e) => {
                  const logFilePath = e.target.value;
                  updateSettings({ 
                    chatHistoryLogging: { 
                      ...settings.chatHistoryLogging,
                      logFilePath,
                      userHasSetPreference: true // User modified the path
                    } 
                  });
                  chatHistoryLogger.updateOptions({ logFilePath });
                }}
                helperText={`Full path to log file. Default: ${defaultLogPath || 'Documents/ContextCypher/chat-history-YYYY-MM-DD.log'}`}
                size="small"
              />
              
              <Button
                variant="outlined"
                onClick={async () => {
                  const success = await chatHistoryLogger.testLogging();
                  setStatus({
                    type: success ? 'success' : 'error',
                    message: success 
                      ? `Test message logged successfully to: ${chatHistoryLogger.getLogFilePath()}`
                      : 'Failed to write test message. Check file permissions and path.'
                  });
                }}
                disabled={!settings.chatHistoryLogging?.enabled}
                sx={{
                  color: currentTheme.colors.textPrimary,
                  borderColor: currentTheme.colors.border,
                  textTransform: 'none',
                  alignSelf: 'flex-start',
                  '&:hover': {
                    borderColor: currentTheme.colors.primary,
                    backgroundColor: currentTheme.colors.surfaceHover,
                  }
                }}
              >
                Test Logging
              </Button>
            </Box>
          )}
          
          <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary }}>
            {settings.chatHistoryLogging?.enabled 
              ? 'All AI conversations, request context, and system data will be logged with timestamps and metadata for troubleshooting and audit trails.'
              : 'Enable to automatically log all AI chat messages, prompts, context data, and system information to a local file. Essential for debugging and compliance.'}
          </Typography>
        </ConfigSection>

      {/* Threat Analysis Logging section removed – now managed exclusively from the Threat Analysis panel */}

      {/* Data Sanitization Filter (Pro) - now in General tab */}
      <ConfigSection>
          <SubsectionTitle>Data Sanitization Filter</SubsectionTitle>
          <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, mb: spacing.md }}>
            When enabled, AI Threat Modeler will automatically replace sensitive information with placeholders before sending data to cloud LLMs. This setting is ignored in Local LLM mode.
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={settings.sanitization?.enabled ?? false}
                onChange={(e) => updateSettings({ sanitization: { enabled: e.target.checked } })}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: currentTheme.colors.primary,
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: currentTheme.colors.primary,
                  },
                }}
              />
            }
            label="Enable Data Sanitization"
            sx={{ color: currentTheme.colors.textPrimary }}
          />
          {settings.sanitization?.enabled && (
            <FormControlLabel
              control={
                <Switch
                  checked={settings.sanitization?.showNotices !== false}
                  onChange={(e) => updateSettings({ sanitization: { ...settings.sanitization, showNotices: e.target.checked } })}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: currentTheme.colors.primary },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: currentTheme.colors.primary }
                  }}
                />
              }
              label="Show Redaction Notices"
              sx={{ color: currentTheme.colors.textSecondary, ml: spacing.lg }}
            />
          )}
        </ConfigSection>

      {/* Chat Web Search - Anthropic only */}
      {
        <ConfigSection>
            <SubsectionTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SearchIcon sx={{ fontSize: 18 }} />
                Chat Web Search
                <Chip label="Anthropic Only" size="small" color="info" sx={{ height: 20, fontSize: '0.7rem' }} />
              </Box>
            </SubsectionTitle>
            <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, mb: spacing.md }}>
              When enabled, the AI assistant can search trusted CTI (Cyber Threat Intelligence) domains for real-time vulnerability data and security advisories during chat conversations.
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.chatWebSearch?.enabled ?? false}
                  onChange={(e) => updateSettings({ 
                    chatWebSearch: { 
                      ...settings.chatWebSearch,
                      enabled: e.target.checked,
                      maxSearches: settings.chatWebSearch?.maxSearches || 5,
                      domainCategories: settings.chatWebSearch?.domainCategories || ['vulnerabilityDatabases', 'threatIntelligence', 'securityNews']
                    } 
                  })}
                  disabled={settings.api.provider !== 'anthropic'}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: currentTheme.colors.primary,
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: currentTheme.colors.primary,
                    },
                  }}
                />
              }
              label={settings.api.provider !== 'anthropic' ? "Enable Chat Web Search (Switch to Anthropic to enable)" : "Enable Chat Web Search"}
              sx={{ color: currentTheme.colors.textPrimary }}
            />
            
            {settings.chatWebSearch?.enabled && (
              <Box sx={{ ml: 3, mt: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 500, color: currentTheme.colors.textSecondary }}>
                  Search Domains Included:
                </Typography>
                
                <Box sx={{ mt: 1, pl: 2 }}>
                  {[
                    { id: 'vulnerabilityDatabases', label: 'Vulnerability DBs', domains: 'NVD, CVE, CWE' },
                    { id: 'threatIntelligence', label: 'Threat Intel', domains: 'MITRE ATT&CK, AlienVault OTX' },
                    { id: 'securityVendors', label: 'Vendor Advisories', domains: 'Microsoft, Google, AWS' },
                    { id: 'exploitDatabases', label: 'Exploit DBs', domains: 'Exploit-DB, Metasploit' },
                    { id: 'securityNews', label: 'Security News', domains: 'BleepingComputer, Dark Reading' },
                    { id: 'cloudProviders', label: 'Cloud Security', domains: 'AWS, Azure, GCP Security Centers' }
                  ].filter(cat => settings.chatWebSearch?.domainCategories?.includes(cat.id)).map((category, index) => (
                    <Box key={category.id} sx={{ mb: 0.5 }}>
                      <Typography variant="caption" sx={{ color: currentTheme.colors.textSecondary, display: 'block' }}>
                        • <strong>{category.label}:</strong> {category.domains}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                
                <Button
                  size="small"
                  variant="text"
                  onClick={() => {
                    const allCategories = ['vulnerabilityDatabases', 'threatIntelligence', 'securityVendors', 'exploitDatabases', 'securityNews', 'cloudProviders'];
                    const currentCategories = settings.chatWebSearch?.domainCategories || [];
                    const hasAll = allCategories.every(cat => currentCategories.includes(cat));
                    
                    updateSettings({
                      chatWebSearch: {
                        ...settings.chatWebSearch,
                        enabled: settings.chatWebSearch?.enabled || false,
                        maxSearches: settings.chatWebSearch?.maxSearches || 5,
                        domainCategories: hasAll ? ['vulnerabilityDatabases', 'threatIntelligence', 'securityNews'] : allCategories
                      }
                    });
                  }}
                  sx={{ mt: 1, color: currentTheme.colors.primary }}
                >
                  {settings.chatWebSearch?.domainCategories?.length === 6 ? 'Use Default Categories' : 'Enable All Categories'}
                </Button>
                
                <Box sx={{ mt: 2 }}>
                  <StyledTextField
                    type="number"
                    label="Max Searches per Chat"
                    value={settings.chatWebSearch?.maxSearches || 5}
                    onChange={(e) => {
                      const value = Math.max(1, Math.min(10, parseInt(e.target.value) || 5));
                      updateSettings({
                        chatWebSearch: {
                          ...settings.chatWebSearch,
                          enabled: settings.chatWebSearch?.enabled || false,
                          domainCategories: settings.chatWebSearch?.domainCategories || ['vulnerabilityDatabases', 'threatIntelligence', 'securityNews'],
                          maxSearches: value
                        }
                      });
                    }}
                    fullWidth
                    size="small"
                    inputProps={{ min: 1, max: 10 }}
                    helperText="Limit searches to control API costs ($10 per 1,000 searches)"
                  />
                </Box>
                
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="caption">
                    Web search will only activate when you ask about specific vulnerabilities, CVEs, or recent threats.
                  </Typography>
                </Alert>
              </Box>
            )}
          </ConfigSection>
      }

    </Box>
  );



  const renderAppearanceSettings = () => {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
        <SectionTitle>Appearance Settings</SectionTitle>

        {/* Theme Selection */}
        <ConfigSection>
          <SubsectionTitle>Theme</SubsectionTitle>
          <StyledFormControl fullWidth sx={{ mb: spacing.md }}>
            <InputLabel>Theme Style</InputLabel>
            <StyledSelect
              value={settings.theme}
              onChange={(e) => {
                const newTheme = e.target.value as ThemeMode;

                if (newTheme === 'custom') {
                  // For custom theme, just update the selection without applying
                  updateSettings({ theme: 'custom' });
                } else if (newTheme !== settings.theme) {
                  // For other themes, apply immediately with transition
                  setPendingTheme(newTheme);
                  setShowThemeTransition(true);
                }
              }}
              label="Theme Style"
            >
              {Object.values(themes).map((theme) => (
                <MenuItem key={theme.name} value={theme.name}>
                  <span>{theme.displayName}</span>
                </MenuItem>
              ))}
            </StyledSelect>
          </StyledFormControl>
          
          <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary }}>
            Choose from different visual themes to customize your experience
          </Typography>
        </ConfigSection>

      {/* Custom Theme Colors */}
      {settings.theme === 'custom' && (
        <ConfigSection>
            <SubsectionTitle>Custom Theme Colors</SubsectionTitle>
            <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, mb: spacing.md }}>
              Create your perfect theme by customizing each color. Click swatches for presets or type hex codes.
            </Typography>
            
            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: spacing.sm, mb: spacing.lg }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={copyingColors ? <Check /> : <ContentCopy />}
                onClick={handleCopyAllColors}
                sx={{
                  color: copyingColors ? currentTheme.colors.success : currentTheme.colors.textSecondary,
                  borderColor: copyingColors ? currentTheme.colors.success : currentTheme.colors.border,
                  textTransform: 'none',
                  fontSize: '0.813rem',
                  '&:hover': {
                    borderColor: currentTheme.colors.primary,
                    backgroundColor: currentTheme.colors.surfaceHover,
                  }
                }}
              >
                {copyingColors ? 'Copied!' : 'Copy All Colors'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Restore />}
                onClick={handleResetColors}
                sx={{
                  color: currentTheme.colors.textSecondary,
                  borderColor: currentTheme.colors.border,
                  textTransform: 'none',
                  fontSize: '0.813rem',
                  '&:hover': {
                    borderColor: currentTheme.colors.warning,
                    backgroundColor: currentTheme.colors.surfaceHover,
                  }
                }}
              >
                Reset to Defaults
              </Button>
            </Box>
          
            {/* Core Colors */}
            <Typography 
              variant="caption" 
              sx={{ 
                color: currentTheme.colors.textSecondary, 
                fontWeight: 600, 
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                display: 'block',
                mb: spacing.sm
              }}
            >
              Core Colors
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md, mb: spacing.lg }}>
              <ColorPickerInput
                label="Background"
                value={customColors.background}
                onChange={(value) => handleColorChange('background', value)}
              />
              <ColorPickerInput
                label="Surface"
                value={customColors.surface}
                onChange={(value) => handleColorChange('surface', value)}
              />
              <ColorPickerInput
                label="Surface Hover"
                value={customColors.surfaceHover}
                onChange={(value) => handleColorChange('surfaceHover', value)}
              />
              <ColorPickerInput
                label="Border"
                value={customColors.border}
                onChange={(value) => handleColorChange('border', value)}
              />
            </Box>

            {/* Theme Colors */}
            <Typography 
              variant="caption" 
              sx={{ 
                color: currentTheme.colors.textSecondary, 
                fontWeight: 600, 
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                display: 'block',
                mb: spacing.sm
              }}
            >
              Theme Colors
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md, mb: spacing.lg }}>
              <ColorPickerInput
                label="Primary"
                value={customColors.primary}
                onChange={(value) => handleColorChange('primary', value)}
              />
              <ColorPickerInput
                label="Primary Light"
                value={customColors.primaryLight}
                onChange={(value) => handleColorChange('primaryLight', value)}
              />
              <ColorPickerInput
                label="Secondary"
                value={customColors.secondary}
                onChange={(value) => handleColorChange('secondary', value)}
              />
            </Box>

            {/* Text Colors */}
            <Typography 
              variant="caption" 
              sx={{ 
                color: currentTheme.colors.textSecondary, 
                fontWeight: 600, 
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                display: 'block',
                mb: spacing.sm
              }}
            >
              Text Colors
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md, mb: spacing.lg }}>
              <ColorPickerInput
                label="Text Primary"
                value={customColors.textPrimary}
                onChange={(value) => handleColorChange('textPrimary', value)}
              />
              <ColorPickerInput
                label="Text Secondary"
                value={customColors.textSecondary}
                onChange={(value) => handleColorChange('textSecondary', value)}
              />
            </Box>

            {/* Status Colors */}
            <Typography 
              variant="caption" 
              sx={{ 
                color: currentTheme.colors.textSecondary, 
                fontWeight: 600, 
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                display: 'block',
                mb: spacing.sm
              }}
            >
              Status Colors
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md, mb: spacing.lg }}>
              <ColorPickerInput
                label="Success"
                value={customColors.success}
                onChange={(value) => handleColorChange('success', value)}
              />
              <ColorPickerInput
                label="Warning"
                value={customColors.warning}
                onChange={(value) => handleColorChange('warning', value)}
              />
              <ColorPickerInput
                label="Error"
                value={customColors.error}
                onChange={(value) => handleColorChange('error', value)}
              />
              <ColorPickerInput
                label="Info"
                value={customColors.info}
                onChange={(value) => handleColorChange('info', value)}
              />
            </Box>
          
            {/* Import from Theme */}
            <Box sx={{ 
              pt: spacing.lg, 
              borderTop: `1px solid ${currentTheme.colors.border}`,
              display: 'flex',
              gap: spacing.md,
              alignItems: 'center'
            }}>
              <Typography variant="caption" sx={{ color: currentTheme.colors.textSecondary, fontWeight: 600 }}>
                Quick Start:
              </Typography>
              <StyledFormControl sx={{ flex: 1 }} size="small">
                <InputLabel>Import colors from theme</InputLabel>
                <StyledSelect
                  value={selectedThemeForImport}
                  onChange={(e) => setSelectedThemeForImport(e.target.value as string)}
                  label="Import colors from theme"
                >
                  {Object.values(themes)
                    .filter(theme => theme.name !== 'custom')
                    .map((theme) => (
                      <MenuItem key={theme.name} value={theme.name}>
                        {theme.displayName}
                      </MenuItem>
                    ))
                  }
                </StyledSelect>
              </StyledFormControl>
              <Button
                variant="contained"
                onClick={handleImportThemeColors}
                sx={{
                  backgroundColor: currentTheme.colors.primary,
                  color: '#ffffff',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.813rem',
                  px: 3,
                  '&:hover': {
                    backgroundColor: currentTheme.colors.primary,
                    filter: 'brightness(1.1)',
                  }
                }}
              >
                Import
              </Button>
            </Box>
          </ConfigSection>
      )}

        {/* Theme-Aware Node Colors */}
        <ConfigSection>
            <SubsectionTitle>Node Color Theming</SubsectionTitle>
            <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, mb: spacing.md }}>
              When enabled, nodes in both the toolbox and canvas will use theme colors for borders, backgrounds, and icons instead of static category-specific colors.
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.themeAwareNodeColors ?? false}
                    onChange={(e) => updateSettings({ themeAwareNodeColors: e.target.checked })}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: currentTheme.colors.primary,
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: currentTheme.colors.primary,
                      },
                    }}
                  />
                }
                label="Use Theme Colors for Nodes"
                sx={{ color: currentTheme.colors.textPrimary }}
              />
            </Box>
            
            <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, mt: spacing.sm }}>
              {settings.themeAwareNodeColors
                ? 'Nodes are using theme colors: primary for borders, surface for backgrounds, and secondary for icons.'
                : 'Nodes are using their default category-specific colors for better visual distinction.'}
            </Typography>
          </ConfigSection>

      {/* Visual Effects - Hidden for now as they are not currently working
      <ConfigSection>
          <SubsectionTitle>Visual Effects</SubsectionTitle>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.effects?.enabled ?? true}
                onChange={(e) => updateSettings({ 
                  effects: { 
                    ...settings.effects,
                    enabled: e.target.checked,
                    // Turn off all individual effects when master toggle is disabled
                    ...(e.target.checked ? {} : {
                      animations: false,
                      particles: false,
                      neon: false,
                      glitch: false,
                      matrix: false
                    })
                  } 
                })}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: currentTheme.colors.primary,
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: currentTheme.colors.primary,
                  },
                }}
              />
            }
            label="Enable Visual Effects"
            sx={{ color: currentTheme.colors.textPrimary }}
          />
          
          {(settings.effects?.enabled ?? true) && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, ml: spacing.lg }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.effects?.animations ?? true}
                    disabled={!(settings.effects?.enabled ?? true)}
                    onChange={(e) => updateSettings({ 
                      effects: { 
                        ...settings.effects,
                        animations: e.target.checked 
                      } 
                    })}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: currentTheme.colors.primary,
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: currentTheme.colors.primary,
                      },
                    }}
                  />
                }
                label="Smooth Animations"
                sx={{ color: currentTheme.colors.textSecondary, fontSize: '14px' }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.effects?.particles ?? false}
                    disabled={!(settings.effects?.enabled ?? true)}
                    onChange={(e) => updateSettings({ 
                      effects: { 
                        ...settings.effects,
                        particles: e.target.checked 
                      } 
                    })}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: currentTheme.colors.primary,
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: currentTheme.colors.primary,
                      },
                    }}
                  />
                }
                label="Particle Effects"
                sx={{ color: currentTheme.colors.textSecondary, fontSize: '14px' }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.effects?.neon ?? false}
                    disabled={!(settings.effects?.enabled ?? true)}
                    onChange={(e) => updateSettings({ 
                      effects: { 
                        ...settings.effects,
                        neon: e.target.checked 
                      } 
                    })}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: currentTheme.colors.primary,
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: currentTheme.colors.primary,
                      },
                    }}
                  />
                }
                label="Neon Glow Effects"
                sx={{ color: currentTheme.colors.textSecondary, fontSize: '14px' }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.effects?.glitch ?? false}
                    disabled={!(settings.effects?.enabled ?? true)}
                    onChange={(e) => updateSettings({ 
                      effects: { 
                        ...settings.effects,
                        glitch: e.target.checked 
                      } 
                    })}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: currentTheme.colors.primary,
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: currentTheme.colors.primary,
                      },
                    }}
                  />
                }
                label="Glitch Effects"
                sx={{ color: currentTheme.colors.textSecondary, fontSize: '14px' }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.effects?.matrix ?? false}
                    disabled={!(settings.effects?.enabled ?? true)}
                    onChange={(e) => updateSettings({ 
                      effects: { 
                        ...settings.effects,
                        matrix: e.target.checked 
                      } 
                    })}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: currentTheme.colors.primary,
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: currentTheme.colors.primary,
                      },
                    }}
                  />
                }
                label="Matrix Rain Effect"
                sx={{ color: currentTheme.colors.textSecondary, fontSize: '14px' }}
              />
            </Box>
          )}
        </Box>
        
        <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, mt: spacing.sm }}>
          {settings.effects?.enabled 
            ? 'Visual effects enhance the interface but can be disabled for better performance or reduced distractions.'
            : 'Visual effects are disabled. Enable them for a more immersive experience.'
          }
        </Typography>
      </ConfigSection>
      */}
      
      {/* Canvas Settings */}
      <ConfigSection>
        <SubsectionTitle>Canvas Settings</SubsectionTitle>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.snapToGrid ?? true}
                onChange={(e) => updateSettings({ snapToGrid: e.target.checked })}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: currentTheme.colors.primary,
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: currentTheme.colors.primary,
                  },
                }}
              />
            }
            label="Snap to Grid"
            sx={{ color: currentTheme.colors.textPrimary }}
          />
        </Box>
        
        <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, mt: 1 }}>
          When enabled, nodes will snap to a 50px grid when moved or dropped on the canvas. This helps keep diagrams organized and aligned.
        </Typography>
        
        <Divider sx={{ my: 2, borderColor: currentTheme.colors.border }} />
        
        <SubsectionTitle>Edge Style</SubsectionTitle>
        <FormControl fullWidth sx={{ mt: 1 }}>
          <StyledSelect
            value={settings.edgeStyle || 'smoothstep'}
            onChange={(e) => handleEdgeStyleChange(e.target.value as 'smoothstep' | 'linear' | 'bezier')}
            displayEmpty
          >
            <MenuItem value="smoothstep">Smoothstep (Auto-turning)</MenuItem>
            <MenuItem value="linear">Linear (Straight Lines)</MenuItem>
            <MenuItem value="bezier">Bezier (Curved Lines)</MenuItem>
          </StyledSelect>
        </FormControl>
        <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, mt: 1 }}>
          Choose between auto-turning smoothstep edges, straight linear edges for a clean technical look, or curved bezier edges for a more organic flow.
        </Typography>
        
        <Divider sx={{ my: 2, borderColor: currentTheme.colors.border }} />
        
        <SubsectionTitle>Edge Connection Mode</SubsectionTitle>
        <FormControl fullWidth sx={{ mt: 1 }}>
          <StyledSelect
            value={settings.edgeMode || 'floating'}
            onChange={(e) => updateSettings({ edgeMode: e.target.value as 'floating' | 'fixed' })}
            displayEmpty
          >
            <MenuItem value="floating">Floating Edges (Dynamic)</MenuItem>
            <MenuItem value="fixed">Fixed Edges (Handle-based)</MenuItem>
          </StyledSelect>
        </FormControl>
        <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, mt: 1 }}>
          Floating edges automatically connect to the nearest point on a node. Fixed edges connect to specific handle positions.
        </Typography>

        <Divider sx={{ my: 2, borderColor: currentTheme.colors.border }} />

        <SubsectionTitle>Node Display Mode</SubsectionTitle>
        <FormControl fullWidth sx={{ mt: 1 }}>
          <StyledSelect
            value={settings.nodeDisplayMode || 'expanded'}
            onChange={(e) => updateSettings({ nodeDisplayMode: e.target.value as 'icon' | 'expanded' })}
            displayEmpty
          >
            <MenuItem value="icon">Icon Only (Compact)</MenuItem>
            <MenuItem value="expanded">Expanded (Traditional)</MenuItem>
          </StyledSelect>
        </FormControl>
        <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, mt: 1 }}>
          Icon-only mode displays nodes as compact icons with labels for a cleaner, more traditional diagramming interface. Expanded mode shows full node details with shapes and badges.
        </Typography>

        <Divider sx={{ my: 2, borderColor: currentTheme.colors.border }} />

        <SubsectionTitle>Debug Panel</SubsectionTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.md, mt: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.debugPanelEnabled ?? false}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  updateSettings({ debugPanelEnabled: enabled });
                  localStorage.setItem('debugPanelVisible', enabled ? 'true' : 'false');
                }}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: currentTheme.colors.primary,
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: currentTheme.colors.primary,
                  },
                }}
              />
            }
            label="Enable Debug Panel"
            sx={{ color: currentTheme.colors.textPrimary }}
          />
        </Box>
        <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, mt: 1 }}>
          Shows the floating Debug Panel (`F12`) for network and AI diagnostics.
        </Typography>
      </ConfigSection>
    </Box>
    );
  };


  const renderLicenseAndSupport = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
      <SectionTitle>Support</SectionTitle>

      {/* Status messages */}
      {status.message && status.type && (
        <StyledAlert
          severity={status.type}
          onClose={() => setStatus({ type: 'info', message: '' })}
          sx={{
            mb: spacing.lg,
            animation: 'fadeIn 0.3s ease-in-out',
            '@keyframes fadeIn': {
              '0%': { opacity: 0, transform: 'translateY(-10px)' },
              '100%': { opacity: 1, transform: 'translateY(0)' }
            }
          }}
        >
          {status.message}
        </StyledAlert>
      )}

      <ConfigSection>
        <SubsectionTitle>Version</SubsectionTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm, mb: spacing.md }}>
          <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary }}>
            Current Version: <strong>{appVersion}</strong>
          </Typography>
        </Box>
      </ConfigSection>

      <ConfigSection>
        <SubsectionTitle>Support Development</SubsectionTitle>
        <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, mb: spacing.md }}>
          ContextCypher is developed by Threat Vector Security Pty Ltd.
          Your support helps fund development and keep the application available.
        </Typography>

        <Box sx={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<Coffee />}
            onClick={() => openExternalLink('https://coff.ee/threatvector')}
            sx={{
              backgroundColor: '#ff5f5f',
              color: '#ffffff',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: '#ff4757',
              }
            }}
          >
            Buy Me a Coffee
          </Button>
        </Box>

        <Typography variant="caption" sx={{ color: currentTheme.colors.textSecondary, mt: 1, display: 'block' }}>
          Even $5 helps! Donations are completely optional and don't affect functionality.
        </Typography>
      </ConfigSection>

      <ConfigSection>
        <SubsectionTitle>About ContextCypher</SubsectionTitle>
        <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, mb: spacing.sm }}>
          Version {licenseService.getVersionInfo().version}
        </Typography>
        <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, mb: spacing.md }}>
          Developed by Threat Vector Security Pty Ltd.
        </Typography>

        <SubsectionTitle>Need Help?</SubsectionTitle>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body2">
            <span style={{ color: currentTheme.colors.textSecondary }}>Email: </span>
            <a
              href="https://threatvectorsecurity.com/contact/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: currentTheme.colors.primary, textDecoration: 'none' }}
            >
              Contact Support
            </a>
          </Typography>
          <Typography variant="body2">
            <span style={{ color: currentTheme.colors.textSecondary }}>Discord: </span>
            <a href="https://discord.gg/Ve7gbf2ytc" target="_blank" rel="noopener noreferrer" style={{ color: currentTheme.colors.primary, textDecoration: 'none' }}>
              Join our community
            </a>
          </Typography>
        </Box>
      </ConfigSection>
    </Box>
  );

  const renderTutorial = () => (
    <TutorialSection>
      <Box sx={{ mb: spacing.lg }}>
        <Typography variant="h5" sx={{ color: currentTheme.colors.textPrimary, fontWeight: 600, mb: 1 }}>
                      Welcome to ContextCypher
        </Typography>
        <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary }}>
          Your AI-powered threat modeling assistant. This guide will help you get started with creating
          diagrams, analyzing threats, and using AI features effectively.
        </Typography>
      </Box>

      {/* AI Configuration */}
      <Box>
        <h3><Api /> AI Configuration</h3>
        {!isVercelDeployment() && (
          <>
            <h4>Local AI (Recommended)</h4>
        <p>For complete offline operation:</p>
        <ol>
          <li>Install Ollama from <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" style={{ color: currentTheme.colors.primary }}>ollama.ai</a> (download the Windows installer)</li>
          <li>After installation, open a command prompt:
            <ul style={{ marginTop: '8px', marginBottom: '8px' }}>
              <li>Press <strong>Windows+R</strong> on your keyboard</li>
              <li>Type <code>cmd</code> in the Run dialog box</li>
              <li>Press <strong>Enter</strong> to open the Command Prompt window</li>
            </ul>
          </li>
          <li>Type the following command and press Enter to download the recommended model:<br/>
            <code>ollama pull llama3.1:8b</code><br/>
            <small style={{ color: currentTheme.colors.textSecondary }}>(This will download ~5GB, may take 5-15 minutes depending on your internet speed)</small>
          </li>
          <li>Once download completes, you can close the command prompt</li>
          <li>In ContextCypher Settings → General, select "Local LLM (Ollama)"</li>
          <li>The model name <code>llama3.1:8b</code> should already be filled in</li>
          <li>Click "Test API" to verify everything is working</li>
        </ol>

        <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
          <Typography variant="body2">
            <strong>Recommended Models:</strong><br/>
            • <strong>Llama 3.1 (Recommended):</strong> <code>llama3.1:8b</code> - Best balance of performance and resource usage<br/>
            &nbsp;&nbsp;- Excellent for both chat and threat analysis<br/>
            &nbsp;&nbsp;- Requires ~5GB disk space and 8GB+ RAM<br/>
            &nbsp;&nbsp;- Faster responses with good analysis quality<br/>
            <br/>
            • <strong>GPT-OSS (Note: Limited support):</strong> <code>gpt-oss:latest</code> - Large context window (32k)<br/>
            &nbsp;&nbsp;- Currently works well for chat analysis<br/>
            &nbsp;&nbsp;- <strong>⚠️ Note:</strong> Threat analysis functionality is limited with this model<br/>
            &nbsp;&nbsp;- Requires ~12GB disk space and 16GB+ RAM<br/>
            <br/>
            <strong>Need help?</strong> If Ollama commands don't work, ensure Ollama is running by typing <code>ollama serve</code> in your command prompt first.
          </Typography>
        </Alert>

        <Alert severity="success" sx={{ mt: 2, mb: 2 }}>
          <Typography variant="body2">
            <strong>🚀 GPU Acceleration & Performance Optimization:</strong><br/>
            <br/>
            <strong>1. Check GPU Status:</strong><br/>
            &nbsp;&nbsp;• Navigate to Settings → Performance Tuning section<br/>
            &nbsp;&nbsp;• Click the refresh icon next to "GPU Acceleration Status"<br/>
            &nbsp;&nbsp;• 🟢 Green = GPU active | 🟡 Yellow = GPU available but not used | 🔵 Blue = CPU only<br/>
            <br/>
            <strong>2. Enable GPU for Better Performance:</strong><br/>
            &nbsp;&nbsp;• If you see yellow status, re-pull your model with GPU layers:<br/>
            &nbsp;&nbsp;&nbsp;&nbsp;<code>ollama pull llama3.1:8b --gpu-layers -1</code><br/>
            &nbsp;&nbsp;• The -1 flag loads all layers on GPU for maximum speed<br/>
            <br/>
            <strong>3. Quick Optimization Guide:</strong><br/>
            &nbsp;&nbsp;• <strong>GPU Memory Fraction:</strong> Keep at 0.9 unless you game/multitask<br/>
            &nbsp;&nbsp;• <strong>Batch Size:</strong> 512 for 8GB GPUs, 1024 for 12GB+<br/>
            &nbsp;&nbsp;• <strong>CPU Threads:</strong> Set to 1-2 when using GPU<br/>
            <br/>
            <strong>4. Advanced GPU Settings:</strong><br/>
            &nbsp;&nbsp;• Expand "Advanced GPU Settings" section for full control<br/>
            &nbsp;&nbsp;• Click the help icon under each setting for detailed guidance<br/>
            &nbsp;&nbsp;• Orange warning box shows environment variables to set<br/>
            &nbsp;&nbsp;• Copy the PowerShell commands and restart Ollama to apply<br/>
            <br/>
            <strong>💡 Pro Tips:</strong><br/>
            &nbsp;&nbsp;• Models run 5-10x faster with GPU acceleration<br/>
            &nbsp;&nbsp;• Watch token/sec speed during generation<br/>
            &nbsp;&nbsp;• Reduce batch size if you get out-of-memory errors<br/>
            &nbsp;&nbsp;• See full GPU guide in docs: Help → GPU Acceleration
          </Typography>
        </Alert>
          </>
        )}

        <h4>Public AI APIs</h4>
        <p>For testing with cloud providers:</p>
        <ul>
          <li><strong>OpenAI:</strong> Get API key from <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer" style={{ color: currentTheme.colors.primary }}>platform.openai.com</a></li>
          <li><strong>Anthropic:</strong> Get API key from <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={{ color: currentTheme.colors.primary }}>console.anthropic.com</a></li>
          <li><strong>Google Gemini:</strong> Get API key from <a href="https://makersuite.google.com" target="_blank" rel="noopener noreferrer" style={{ color: currentTheme.colors.primary }}>makersuite.google.com</a></li>
        </ul>

        <Alert severity="info" sx={{ mt: 2 }}><Typography variant="body2">AI credentials stay in the local Guardian backend’s memory only and must be entered again after it restarts. Remote providers receive the context you submit for analysis. Configure a local model when processing must stay on this workstation.</Typography></Alert>
      </Box>

      {/* Getting Started */}
      <Box>
        <h3><PlayCircle /> Getting Started</h3>
        <h4>Creating Your First Diagram</h4>
        <ol>
          <li>Open the <strong>Node Toolbox</strong> on the left (click TOOLBOX tab if minimized)</li>
          <li>Browse categories like Infrastructure, Applications, Cloud Services, etc.</li>
          <li>Drag and drop nodes onto the canvas to build your system architecture</li>
          <li>Connect nodes by dragging from one node's edge to another</li>
          <li>Double-click any node or connection to add security metadata</li>
        </ol>
        
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Pro Tip:</strong> Start with Security Zones to organize your architecture. 
            Drag zones from the Security Zones category to create network boundaries.
          </Typography>
        </Alert>
      </Box>

      {/* Working with Nodes */}
      <Box>
        <h3><Hub /> Working with Nodes</h3>
        <h4>Adding and Configuring Nodes</h4>
        <p>Each node represents a component in your system architecture:</p>
        <ul>
          <li><strong>Infrastructure:</strong> Servers, routers, firewalls, network devices</li>
          <li><strong>Applications:</strong> Databases, web servers, APIs, services</li>
          <li><strong>Cloud Services:</strong> Cloud-native components, Kubernetes, serverless</li>
          <li><strong>OT/SCADA:</strong> Industrial control systems, PLCs, sensors</li>
          <li><strong>AI/ML:</strong> AI gateways, models, data lakes, ML pipelines</li>
        </ul>

        <h4>Node Security Properties</h4>
        <p>Double-click any node to configure:</p>
        <ul>
          <li><strong>Security Controls:</strong> Authentication, encryption, access controls</li>
          <li><strong>Data Classification:</strong> Sensitivity levels and data types</li>
          <li><strong>Compliance Requirements:</strong> Regulatory standards (GDPR, HIPAA, etc.)</li>
          <li><strong>Custom Properties:</strong> Add any security-relevant metadata</li>
        </ul>
      </Box>

      {/* 3D Security Visualization */}
      {(
        <Box>
          <h3><Hub /> 3D Security Visualization</h3>
          <p>Experience your system architecture in an immersive 3D isometric view:</p>

          <h4>Activating 3D View</h4>
          <ul>
            <li>Click the <strong>3D cube icon</strong> in the top toolbar to switch views</li>
            <li>Your 2D diagram automatically converts to 3D representation</li>
            <li>All nodes, connections, and security zones are rendered in 3D space</li>
          </ul>

          <h4>Navigation Controls</h4>
          <ul>
            <li><strong>Left Mouse:</strong> Rotate camera around the scene</li>
            <li><strong>Right Mouse:</strong> Pan the camera view</li>
            <li><strong>Mouse Wheel:</strong> Zoom in/out</li>
            <li><strong>Double-click Node:</strong> Edit node properties</li>
            <li><strong>Click Node:</strong> Select and view details in inspector</li>
          </ul>

          <h4>Visual Features</h4>
          <ul>
            <li><strong>Dynamic Lighting:</strong> Realistic shadows and ambient lighting</li>
            <li><strong>Zone Visualization:</strong> Security zones appear as translucent 3D regions</li>
            <li><strong>Animated Connections:</strong> Data flows show animated dashed lines</li>
            <li><strong>Node Icons:</strong> Floating icons above each component</li>
            <li><strong>Index Codes:</strong> Component identifiers for easy reference</li>
            <li><strong>Theme Integration:</strong> Colors adapt to your selected theme</li>
          </ul>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Pro Tip:</strong> Use the 3D view during presentations to showcase your architecture
              with an impressive visual perspective that highlights security boundaries and data flows.
            </Typography>
          </Alert>
        </Box>
      )}

      {/* Connections and Data Flows */}
      <Box>
        <h3><ArrowForward /> Connections & Data Flows</h3>
        <h4>Creating Connections</h4>
        <ul>
          <li>Hover over a node to see connection points</li>
          <li>Drag from one node to another to create a connection</li>
          <li>Double-click connections to define data flow properties</li>
        </ul>

        <h4>Connection Security Properties</h4>
        <ul>
          <li><strong>Protocol:</strong> HTTP/HTTPS, TCP, UDP, custom protocols</li>
          <li><strong>Encryption:</strong> TLS versions, encryption algorithms</li>
          <li><strong>Authentication:</strong> API keys, OAuth, certificates</li>
          <li><strong>Data Types:</strong> What information flows through this connection</li>
        </ul>

        <h4>Connection Directionality</h4>
        <p>Connections in threat models represent logical communication channels:</p>
        <ul>
          <li><strong>Direction indicates initiator:</strong> The arrow shows which component initiates the connection</li>
          <li><strong>Bidirectional by nature:</strong> Most protocols (HTTPS, SSH, etc.) inherently support two-way communication</li>
          <li><strong>One connection is sufficient:</strong> No need to create reverse connections for response traffic</li>
          <li><strong>Security focus:</strong> Direction matters for firewall rules, trust boundaries, and attack path analysis</li>
        </ul>
        
        <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
          <Typography variant="body2">
            <strong>Note:</strong> The connection direction (source → target) shows which component can initiate communication. 
            The actual data flow is bidirectional for most protocols. This abstraction reduces visual clutter while maintaining 
            the security-relevant information about trust relationships and access control.
          </Typography>
        </Alert>
      </Box>

      {/* Custom Context and Annotations */}
      <Box>
        <h3><Draw /> Annotations & Context</h3>
        <h4>Drawing Tools</h4>
        <p>Use the drawing toolbar (bottom-right) to add visual annotations:</p>
        <ul>
          <li><strong>Pencil:</strong> Freehand drawing for highlighting areas</li>
          <li><strong>Rectangle:</strong> Box important components</li>
          <li><strong>Circle:</strong> Highlight specific nodes or areas</li>
          <li><strong>Arrow:</strong> Show attack paths or data flows</li>
          <li><strong>Text:</strong> Add notes directly on the diagram</li>
        </ul>

        <h4>Custom Context</h4>
        <p>Click "Custom Context" in the Analysis Panel to add:</p>
        <ul>
          <li>Business context and requirements</li>
          <li>Specific security concerns</li>
          <li>Compliance requirements</li>
          <li>Known vulnerabilities or issues</li>
        </ul>
      </Box>

      {/* AI Diagram Generation */}
      <Box>
        <h3><AutoAwesome /> AI Diagram Generation</h3>
        <p>Generate complete diagrams from text descriptions:</p>
        <ol>
          <li>Click "Generate Diagram with AI" button</li>
          <li>Describe your system in natural language</li>
          <li>AI creates a complete threat model diagram</li>
          <li>Review and customize the generated diagram</li>
        </ol>

        <p><strong>Tips for Local LLMs:</strong> When using smaller local LLMs (like llama3.1:8b), generate diagrams in smaller chunks for better results:</p>
        <ul>
          <li>Start with core components (5-10 nodes)</li>
          <li>Use "Append to existing diagram" option</li>
          <li>Generate additional sections incrementally</li>
          <li>Connect sections manually or with a final AI request</li>
          <li>This approach prevents overloading smaller models with too much context</li>
        </ul>
      </Box>

      {/* AI Threat Analysis */}
      <Box>
        <h3><Security /> AI Threat Analysis</h3>
        <p>Get comprehensive security analysis of your architecture:</p>
        <ol>
          <li>Build your system diagram with nodes and connections</li>
          <li>Add security metadata to nodes and connections</li>
          <li>Click "Analyze Threats" in the Analysis Panel</li>
          <li>The AI will analyze your architecture and identify:</li>
          <ul>
            <li>Potential security vulnerabilities</li>
            <li>STRIDE threats for each component</li>
            <li>Attack vectors and paths</li>
            <li>Recommended mitigations</li>
          </ul>
        </ol>

        <h4>Analysis Results</h4>
        <p>After analysis completes, a comprehensive tabbed report becomes available:</p>
        <ul>
          <li><strong>System Overview</strong> - High-level architecture summary and risk assessment</li>
          <li><strong>Components</strong> - Detailed threats for each component</li>
          <li><strong>Attack Paths</strong> - Potential attack sequences</li>
          <li><strong>Recommendations</strong> - Security improvements</li>
          <li><strong>MITRE ATT&CK</strong> - Mapped techniques and tactics</li>
        </ul>
        <p>Export options: PDF, Text, or HTML format</p>

        <h4>Node-Specific Threats</h4>
        <p>After analysis, threat data populates directly in each node:</p>
        <ul>
          <li>Double-click any analyzed node</li>
          <li>Go to the "Identified Threats" tab</li>
          <li>View STRIDE threats specific to that component</li>
          <li>See associated MITRE techniques</li>
          <li>Review recommended mitigations</li>
        </ul>
      </Box>

      {/* AI-Powered Chat */}
      <Box>
        <h3><Psychology /> AI-Powered Chat</h3>
        <h4>Chatting with AI</h4>
        <p>Use natural language to:</p>
        <ul>
          <li>Ask specific security questions about your architecture</li>
          <li>Request analysis of particular components</li>
          <li>Get recommendations for security improvements</li>
          <li>Generate compliance assessments</li>
        </ul>

        <Alert severity="success" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Example prompts:</strong><br/>
            • "What are the main security risks in this architecture?"<br/>
            • "How can I improve the security of my database connections?"<br/>
            • "Generate a STRIDE analysis for the API gateway"<br/>
            • "What compliance issues might I face with this design?"
          </Typography>
        </Alert>
      </Box>

      {/* Saving and Loading */}
      <Box>
        <h3><Storage /> Saving & Loading</h3>
        <h4>File Management</h4>
        <ul>
          <li><strong>Save:</strong> Saves to the current file (Ctrl+S)</li>
          <li><strong>Save As:</strong> Choose a new location/name</li>
          <li><strong>Load:</strong> Open existing diagram files</li>
          <li><strong>Autosave:</strong> Enable in Settings → General</li>
        </ul>

        <h4>What Gets Saved</h4>
        <ul>
          <li>All nodes and their positions</li>
          <li>Connections and data flows</li>
          <li>Security metadata and properties</li>
          <li>Custom context</li>
          <li>Drawing annotations</li>
        </ul>

        <h4>Chat History Logger</h4>
        <p>Keep a complete audit trail of all AI interactions:</p>
        <ul>
          <li>Enable in Settings → General → Chat History section</li>
          <li>Logs all messages, responses, and full request context</li>
          <li>Saves to Documents/AI-Threat-Modeler folder</li>
          <li>Includes timestamps, model info, and token usage</li>
          <li>Perfect for compliance, debugging, or analysis review</li>
        </ul>

        <h4>Threat Analysis History Logger</h4>
        <p>Automatically save all threat analysis results:</p>
        <ul>
          <li>Enable in Threat Analysis panel settings</li>
          <li>Captures complete analysis reports in JSON format</li>
          <li>Includes all identified threats, MITRE mappings, and recommendations</li>
          <li>Useful for tracking security posture changes over time</li>
        </ul>
      </Box>

      {/* Tips and Best Practices */}
      <Box>
        <h3><Info /> Tips & Best Practices</h3>
        <h4>Effective Threat Modeling</h4>
        <ul>
          <li>Start with high-level architecture before adding details</li>
          <li>Use Security Zones to clearly define trust boundaries</li>
          <li>Document all external interfaces and APIs</li>
          <li>Add data classification to all storage and database nodes</li>
          <li>Include authentication methods for all connections</li>
        </ul>

        <h4>Edge Control Points</h4>
        <p>Control points allow you to create curved or complex edge paths:</p>
        <ul>
          <li><strong>Select Edge:</strong> Click on any edge line or label to select it</li>
          <li><strong>Add Control Point:</strong> With edge selected, click anywhere along the edge to add a control point</li>
          <li><strong>Move Control Point:</strong> Drag control points to reshape the edge path</li>
          <li><strong>Delete Control Point:</strong> Right-click on a control point to remove it</li>
          <li><strong>Edge Styles:</strong> Control points work with Linear (straight) and Bezier (curved) edges. Smoothstep ignores control points.</li>
          <li><strong>Persistence:</strong> Control points are saved with your diagram</li>
        </ul>

        <h4>Keyboard Shortcuts</h4>
        <ul>
          <li><code>Ctrl+C / Cmd+C</code> - Copy selected elements</li>
          <li><code>Ctrl+X / Cmd+X</code> - Cut selected elements</li>
          <li><code>Ctrl+V / Cmd+V</code> - Paste copied/cut elements</li>
          <li><code>Ctrl+Z / Cmd+Z</code> - Undo last action</li>
          <li><code>Ctrl+Y / Cmd+Y</code> or <code>Ctrl+Shift+Z / Cmd+Shift+Z</code> - Redo last action</li>
          <li><code>Delete/Backspace</code> - Delete selected nodes/connections</li>
          <li><code>W</code> - Pan up</li>
          <li><code>A</code> - Pan left</li>
          <li><code>S</code> - Pan down</li>
          <li><code>D</code> - Pan right</li>
          <li><code>Ctrl+Click</code> - Multi-select nodes</li>
          <li><code>Drag</code> - Pan the canvas</li>
          <li><code>Scroll</code> - Zoom in/out</li>
          <li><code>Double-click</code> - Edit properties</li>
          <li><code>F12</code> - Toggle connectivity debug console</li>
        </ul>

        <h4>Mobile Device Users Guide</h4>
        <p>Touch controls are optimized for phones and tablets:</p>
        <ul>
          <li><strong>Pan Canvas:</strong> Drag with one finger</li>
          <li><strong>Zoom:</strong> Use a two-finger pinch gesture</li>
          <li><strong>Select Node or Edge:</strong> Single tap</li>
          <li><strong>Edit Node or Edge:</strong> Tap a selected item again to open its editor</li>
          <li><strong>Multi-Select:</strong> Tap <code>Select</code> in the compact top bar (or use Menu → View → Enable Multi-Select Mode), then drag a selection box. Tap again to return to normal pan mode.</li>
          <li><strong>Panels:</strong> Use Menu → View to show Components or Analysis panels</li>
          <li><strong>Minimap:</strong> Drag the viewport rectangle to move across large diagrams</li>
          <li><strong>3D View:</strong> Touch orbit/pan/zoom gestures are enabled automatically</li>
        </ul>

        <h4>Performance Tips</h4>
        <ul>
          <li>For large diagrams, disable visual effects in Settings → Appearance</li>
          <li>Use streaming mode for faster AI responses</li>
          <li>Close unused panels to maximize canvas space</li>
        </ul>
      </Box>

      {/* Security & Privacy */}
      <Box>
        <h3><Shield /> Security & Privacy</h3>
        <h4>Data Storage</h4>
        <p>Diagrams and settings are stored locally. AI requests send their context to the configured provider:</p>
        <ul>
          <li><strong>Settings & Preferences:</strong> Stored in secure browser local storage</li>
          <li><strong>API Keys:</strong> Kept in Guardian memory until the backend restarts; never saved to disk or browser storage.</li>
          <li><strong>Diagrams:</strong> Saved in Guardian projects, with import and export to local files.</li>
          <li><strong>Chat History:</strong> Stored in browser's IndexedDB (local only)</li>
        </ul>

        <h4>Data Sanitization Filter</h4>
        <p>Protect sensitive information when using public AI providers:</p>
        <ul>
          <li>Enable in Settings → General → Data Sanitization</li>
          <li>Automatically redacts before sending to cloud providers:</li>
          <ul>
            <li>IP addresses (replaced with x.x.x.x)</li>
            <li>Email addresses (replaced with [EMAIL])</li>
            <li>Passwords and API keys (replaced with [REDACTED])</li>
            <li>Company keywords (replaced with COMPANY)</li>
          </ul>
          <li>Only applies to public providers (OpenAI, Anthropic, Gemini)</li>
          <li>Local LLMs receive unredacted data for full analysis</li>
        </ul>

        <h4>Privacy Guarantees</h4>
        <ul>
          <li>No telemetry or usage tracking</li>
          <li>No automatic updates without consent</li>
          <li>No cloud sync unless explicitly using cloud AI providers</li>
          <li>All analysis with local LLMs stays completely offline</li>
        </ul>

        <Alert severity="success" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Offline-First Design:</strong> When using local AI models (Ollama), your diagrams, analysis, and all data remain entirely on your device. Perfect for air-gapped environments and sensitive systems.
          </Typography>
        </Alert>
      </Box>

      {/* Support */}
      <Box>
        <h3><Coffee /> Need Help?</h3>
        <p>For additional support:</p>
        <ul>
          <li>Email: <a href="https://threatvectorsecurity.com/contact/" target="_blank" rel="noopener noreferrer" style={{ color: currentTheme.colors.primary }}>Contact Support</a></li>
          <li>Discord: <a href="https://discord.gg/Ve7gbf2ytc" target="_blank" rel="noopener noreferrer" style={{ color: currentTheme.colors.primary }}>Join our community</a></li>
        </ul>
      </Box>
    </TutorialSection>
  );

  return (
    <>
    <StyledDrawer 
      anchor="right" 
      open={open} 
      onClose={requestClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: settingsDrawerWidth,
          maxWidth: '100vw'
        }
      }}
      ModalProps={{
        disableEnforceFocus: true,
        disableAutoFocus: true,
        keepMounted: true,
        BackdropProps: {
          invisible: false, // Always show backdrop to capture clicks
          sx: {
            backgroundColor: 'transparent', // Make it invisible visually
            // Always capture mouse events
            pointerEvents: 'auto',
          },
          onClick: (e: React.MouseEvent) => {
            // Close drawer on any click
            e.preventDefault();
            e.stopPropagation();
            requestClose();
          },
          onMouseDown: (e: React.MouseEvent) => {
            // Close on any mouse button click
            e.preventDefault();
            e.stopPropagation();
            requestClose();
          },
          onContextMenu: (e: React.MouseEvent) => {
            // Prevent context menu and close drawer
            e.preventDefault();
            e.stopPropagation();
            requestClose();
          },
        },
      }}
    >
      {/* Loading backdrop while saving settings */}
      <Backdrop open={isLoading} sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <CircularProgress color="inherit" />
      </Backdrop>
      <Box sx={{ width: settingsDrawerWidth, maxWidth: '100vw', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <DrawerHeader>
          <Typography variant="h5" sx={{ color: currentTheme.colors.textPrimary, fontWeight: 600 }}>
            Settings
          </Typography>
          <IconButton 
            onClick={requestClose} 
            sx={{ 
              color: currentTheme.colors.textSecondary,
              '&:hover': {
                backgroundColor: currentTheme.colors.surfaceHover,
                color: currentTheme.colors.textPrimary,
              }
            }}
          >
            <Close />
          </IconButton>
        </DrawerHeader>

        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <StyledTabs
            value={activeTab}
            variant={isPhoneViewport ? 'scrollable' : 'standard'}
            scrollButtons={isPhoneViewport ? 'auto' : false}
            allowScrollButtonsMobile={isPhoneViewport}
            onChange={(_, newValue) => {
              setActiveTab(newValue);
            }}
          >
            <Tab icon={<Settings fontSize="small" />} label="General" />
            <Tab icon={<Palette fontSize="small" />} label="Appearance" />
            <Tab icon={<School fontSize="small" />} label="Tutorial" />
            <Tab icon={<Favorite fontSize="small" />} label="Support" />
          </StyledTabs>

          <DrawerContent>
            {(
              <Box sx={{ 
                display: activeTab === 0 ? 'flex' : 'none',
                flexDirection: 'column', 
                height: '100%', 
                overflow: 'hidden',
                padding: spacing.lg,
              }}>
                <Box sx={{ 
                  flex: 1, 
                  overflowY: 'auto', 
                  paddingRight: spacing.sm,
                  '&::-webkit-scrollbar': {
                    width: '8px',
                  },
                  '&::-webkit-scrollbar-track': {
                    backgroundColor: currentTheme.colors.background,
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: currentTheme.colors.border,
                    borderRadius: '4px',
                    '&:hover': {
                      backgroundColor: currentTheme.colors.textSecondary,
                    }
                  }
                }}>
                  {renderGeneralSettings()}
                </Box>
                <Box sx={{ marginTop: spacing.lg, paddingTop: spacing.lg }}>
                  <Divider sx={{ mb: spacing.lg, borderColor: currentTheme.colors.border }} />
                  
                  {/* Only show non-API related status messages here */}
                  {status.message && status.type === 'success' && !status.message.includes('API') && !status.message.includes('LLM') && (
                    <StyledAlert severity="success" sx={{ mb: spacing.md }}>
                      {status.message}
                    </StyledAlert>
                  )}

                  <ActionButton
                    fullWidth
                    onClick={handleSaveSettings}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Saving...' : 'Save Settings and Close'}
                  </ActionButton>
                </Box>
              </Box>
            )}
            {activeTab === 1 && (
              <Box sx={{ 
                height: '100%', 
                overflowY: 'auto',
                padding: spacing.lg,
                paddingRight: spacing.sm,
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: currentTheme.colors.background,
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: currentTheme.colors.border,
                  borderRadius: '4px',
                  '&:hover': {
                    backgroundColor: currentTheme.colors.textSecondary,
                  }
                }
              }}>
                {renderAppearanceSettings()}
              </Box>
            )}
            {activeTab === 2 && (
              <Box sx={{ 
                height: '100%', 
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: spacing.lg,
                paddingRight: spacing.sm,
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: currentTheme.colors.background,
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: currentTheme.colors.border,
                  borderRadius: '4px',
                  '&:hover': {
                    backgroundColor: currentTheme.colors.textSecondary,
                  }
                }
              }}>
                {renderTutorial()}
              </Box>
            )}
            {activeTab === 3 && (
              <Box sx={{ 
                height: '100%', 
                overflowY: 'auto',
                padding: spacing.lg,
                paddingRight: spacing.sm,
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: currentTheme.colors.background,
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: currentTheme.colors.border,
                  borderRadius: '4px',
                  '&:hover': {
                    backgroundColor: currentTheme.colors.textSecondary,
                  }
                }
              }}>
                {renderLicenseAndSupport()}
              </Box>
            )}
          </DrawerContent>
        </Box>
      </Box>

      {/* Custom Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={handleCloseConfirmDialog}
        maxWidth="sm"
        fullWidth
        TransitionProps={{
          style: {
            transitionDuration: '200ms',
          }
        }}
        PaperProps={{
          sx: {
            backgroundColor: currentTheme.colors.surface,
            color: currentTheme.colors.textPrimary,
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            overflow: 'hidden',
            minWidth: 'min(420px, calc(100vw - 24px))',
            maxWidth: 'min(520px, calc(100vw - 24px))',
            transform: 'translateY(0)',
            transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          }
        }}
      >
        <DialogTitle sx={{ 
          backgroundColor: currentTheme.colors.surface,
          color: currentTheme.colors.textPrimary,
          fontSize: '1.25rem',
          fontWeight: 600,
          pb: 1,
          pt: 3,
          px: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          {confirmDialog.title.toLowerCase().includes('deactivate') || confirmDialog.title.toLowerCase().includes('clear') ? (
            <Warning sx={{ color: currentTheme.colors.warning, fontSize: '1.75rem' }} />
          ) : (
            <InfoOutlined sx={{ color: currentTheme.colors.primary, fontSize: '1.75rem' }} />
          )}
          {confirmDialog.title}
        </DialogTitle>
        <DialogContent sx={{ 
          backgroundColor: currentTheme.colors.surface,
          px: 3,
          pb: 2,
          pt: 2,
        }}>
          <DialogContentText sx={{ 
            color: currentTheme.colors.textSecondary,
            whiteSpace: 'pre-line',
            lineHeight: 1.7,
            fontSize: '0.95rem',
            '& strong': {
              color: currentTheme.colors.textPrimary,
              fontWeight: 600,
            }
          }}>
            {confirmDialog.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ 
          backgroundColor: currentTheme.colors.background,
          borderTop: `1px solid ${currentTheme.colors.border}`,
          px: 3,
          py: 2,
          gap: 1.5,
          justifyContent: 'flex-end',
        }}>
          <Button 
            onClick={handleCloseConfirmDialog}
            variant="text"
            sx={{ 
              color: currentTheme.colors.textSecondary,
              fontWeight: 500,
              textTransform: 'none',
              px: 3,
              py: 1,
              fontSize: '0.95rem',
              '&:hover': {
                backgroundColor: currentTheme.colors.surfaceHover,
              }
            }}
          >
            {confirmDialog.cancelText || 'Cancel'}
          </Button>
          <Button 
            onClick={handleConfirmDialog}
            variant="contained"
            sx={{ 
              backgroundColor: currentTheme.colors.primary,
              color: '#ffffff',
              fontWeight: 600,
              textTransform: 'none',
              px: 3,
              py: 1,
              fontSize: '0.95rem',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              '&:hover': {
                backgroundColor: currentTheme.colors.primary,
                filter: 'brightness(1.1)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              }
            }}
          >
            {confirmDialog.confirmText || 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edge Style Change Confirmation Dialog */}
      <Dialog
        open={edgeStyleConfirmDialog}
        onClose={() => {
          setEdgeStyleConfirmDialog(false);
          setPendingEdgeStyle(null);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: currentTheme.colors.surface,
            color: currentTheme.colors.textPrimary,
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          }
        }}
      >
        <DialogTitle sx={{ 
          backgroundColor: currentTheme.colors.surface,
          color: currentTheme.colors.textPrimary,
          fontSize: '1.25rem',
          fontWeight: 600,
          pb: 1,
          pt: 3,
          px: 3,
        }}>
          Change Edge Style?
        </DialogTitle>
        <DialogContent sx={{ 
          backgroundColor: currentTheme.colors.surface,
          px: 3,
          pb: 2,
          pt: 2,
        }}>
          <Typography variant="body2" sx={{ mb: 2, color: currentTheme.colors.textSecondary }}>
            Changing the edge style may alter the visual appearance of your diagram:
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, color: currentTheme.colors.textSecondary }}>
            • <strong>Smoothstep to Linear/Bezier:</strong> Auto-turning paths will switch to straight or curved edges.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: currentTheme.colors.textSecondary }}>
            • <strong>Linear/Bezier to Smoothstep:</strong> Existing pivot points will be removed and replaced with auto-turning paths.
          </Typography>
          <StyledAlert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              You have edges with control points. The visual layout may change significantly.
            </Typography>
          </StyledAlert>
        </DialogContent>
        <DialogActions sx={{
          backgroundColor: currentTheme.colors.surface,
          padding: '16px 24px',
          borderTop: `1px solid ${currentTheme.colors.border}`,
        }}>
          <Button
            onClick={() => {
              setEdgeStyleConfirmDialog(false);
              setPendingEdgeStyle(null);
            }}
            sx={{
              color: currentTheme.colors.textSecondary,
              '&:hover': {
                backgroundColor: currentTheme.colors.surface,
              }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (pendingEdgeStyle) {
                if (pendingEdgeStyle === 'smoothstep' && onClearEdgeControlPoints) {
                  onClearEdgeControlPoints();
                }
                updateSettings({ edgeStyle: pendingEdgeStyle });
                setEdgeStyleConfirmDialog(false);
                setPendingEdgeStyle(null);
              }
            }}
            variant="contained"
            sx={{
              backgroundColor: currentTheme.colors.primary,
              color: '#ffffff',
              '&:hover': {
                backgroundColor: currentTheme.colors.primaryHover,
              }
            }}
          >
            Change Style
          </Button>
        </DialogActions>
      </Dialog>
    </StyledDrawer>


    {/* Theme Transition Overlay */}
    {showThemeTransition && pendingTheme && (
      <ThemeTransitionOverlay
        key={`theme-transition-${pendingTheme}`}
        themeName={pendingTheme}
        onTransitionComplete={handleTransitionComplete}
      />
    )}
  </>
  );
};

export { SettingsDrawer };
