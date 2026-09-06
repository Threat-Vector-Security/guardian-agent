// src/components/AnalysisPanel.tsx
import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  IconButton as MuiIconButton,
  Tooltip,
  alpha,
  useTheme,
  Alert,
  CircularProgress
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Send,
  ChevronUp,
  ChevronDown,
  Info as InfoIcon,
  Shield,
  MessageSquare,
  Loader2,
  AlertCircle,
  Minimize2
} from 'lucide-react';
import { useAnalysisContext } from './AnalysisContextProvider';
import { useSettings } from '../settings/SettingsContext';
import { AnalysisPanelProps, AnalysisResponse, ChatMessage } from '../types/ChatTypes';
import { 
  AnalysisContext, 
  DiagramData
} from '../types/AnalysisTypes';
import CustomContextPanel from './CustomContextPanel';
import ThreatIntelPanel from './ThreatIntelPanel';
import { SaveConfirmationResult } from './GenerateDiagramButton';
import { getTokenBreakdown, chatWithStreaming } from '../services/AIRequestService';
import type { TokenBreakdown } from '../services/AIRequestService';
import { SaveConfirmationDialog } from './SaveConfirmationDialog';
import { connectionManager as ConnectionManager } from '../services/ConnectionManager';
import { getModelInfo, formatTokenCount, getTokenUsageColor } from '../utils/modelConstants';
import { logToDebugPanel } from './DebugPanel';


import { isVercelDeployment } from '../utils/vercelDetection';

interface ExtendedAnalysisPanelProps extends Omit<AnalysisPanelProps, 'messages'> {
  currentDiagram?: DiagramData;
  historyScope?: 'diagram' | 'grc';
  onSendMessage: (
    message: string,
    context?: AnalysisContext
  ) => Promise<AnalysisResponse>;
  contextAugmenter?: (context: AnalysisContext) => AnalysisContext;
  onDiagramGenerated?: (diagram: any, shouldMerge?: boolean) => void;
  onSaveFile?: () => Promise<boolean>;
}

// Interface for the ref methods
export interface AnalysisPanelRef {
  scrollToBottom: () => void;
  openIntelPanel: () => void;
}

type ChatScope = 'diagram' | 'grc';

const getMessageScope = (message: ChatMessage): ChatScope => {
  const scope = message.metadata?.chatScope;
  return scope === 'grc' ? 'grc' : 'diagram';
};

// Styled Components
const PanelContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  width: '100%',
  backgroundColor: theme.colors.background,
  position: 'relative', // Enable absolute positioning for Latest button
  
  // Allow text selection without forcing cursor everywhere
  userSelect: 'text',
  WebkitUserSelect: 'text',
  MozUserSelect: 'text',
  msUserSelect: 'text',
}));

const PanelHeader = styled(Box)(({ theme }) => ({
  padding: '0 16px',
  backgroundColor: theme.colors.surface,
  borderBottom: `1px solid ${theme.colors.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  minHeight: '64px',
  height: '64px',
}));

const MessagesContainer = styled(Box)({
  flexGrow: 1,
  overflow: 'hidden', // Contain the textarea
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  // Height is handled by flex-grow
});

const ReadOnlyTextArea = styled('textarea')(({ theme }) => ({
  flexGrow: 1,
  width: '100%',
  height: '100%',
  padding: '24px',
  boxSizing: 'border-box',
  backgroundColor: theme.colors.background,
  color: theme.colors.textPrimary,
  border: 'none',
  resize: 'none',
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  fontSize: '14px',
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflowY: 'auto', // Make the textarea itself scrollable

  '&:focus': {
    outline: 'none',
  },
  
  '&::-webkit-scrollbar': {
    width: '12px',
  },
  '&::-webkit-scrollbar-track': {
    background: theme.colors.background,
    borderRadius: '6px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.colors.border,
    borderRadius: '6px',
    border: `2px solid ${theme.colors.background}`,
    '&:hover': {
      background: theme.colors.surfaceHover,
    },
    '&:active': {
      background: theme.colors.primary,
    }
  },
  scrollbarWidth: 'thin',
  scrollbarColor: `${theme.colors.border} ${theme.colors.background}`,
}));



const InputContainer = styled(Box)(({ theme }) => ({
  padding: '16px',
  backgroundColor: theme.colors.surface,
  borderTop: `1px solid ${theme.colors.border}`,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.colors.background,
    color: theme.colors.textPrimary,
    '& fieldset': {
      borderColor: theme.colors.border,
    },
    '&:hover fieldset': {
      borderColor: theme.colors.primary,
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.colors.primary,
    },
  },
  '& .MuiInputBase-input::placeholder': {
    color: theme.colors.textSecondary,
    opacity: 1,
  },
}));

const ActionButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.colors.primary,
  color: theme.palette.primary.contrastText,
  '&:hover': {
    backgroundColor: theme.colors.primary,
    opacity: 0.9,
  },
  '&.Mui-disabled': {
    backgroundColor: `${theme.colors.primary}44`,
    color: `${theme.palette.primary.contrastText}88`,
  },
}));


const getContrastText = (hex: string): string => {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? '#000000' : '#ffffff';
};

// Common button styles - add this near the top with other styled components
const StyledActionButton = styled(Button)(({ theme }) => ({
  borderRadius: 4,
  padding: '6px 12px',
  fontSize: '0.875rem',
  textTransform: 'none',
  minWidth: 'unset',
  color: theme.colors.textPrimary,
  border: `1px solid ${theme.colors.border}`,
  '&:hover': {
    backgroundColor: theme.colors.surfaceHover,
  }
}));

const LatestButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.colors.surface,
  color: theme.colors.success,
  border: `2px solid ${theme.colors.success}`,
  borderRadius: '24px',
  padding: '8px 16px',
  fontSize: '0.85rem',
  fontWeight: 700,
  minWidth: 'auto',
  boxShadow: `0 3px 10px ${theme.colors.success}30`,
  '&:hover': {
    backgroundColor: theme.colors.success,
    color: theme.colors.background,
    transform: 'translateY(-2px)',
    boxShadow: `0 6px 16px ${theme.colors.success}40`,
  },
  transition: 'all 0.2s ease-in-out',
}));


const AnalysisPanel = forwardRef<AnalysisPanelRef, ExtendedAnalysisPanelProps>((
  {
    isOpen,
    onToggle,
    onSendMessage,
    isAnalyzing,
    currentDiagram,
    historyScope = 'diagram',
    contextAugmenter,
    onDiagramGenerated,
    onSaveFile,
  },
  ref
) => {
  const theme = useTheme();
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activePanel, setActivePanel] = useState<'chat' | 'context' | 'intel'>('chat');
  const [estimatedTokens, setEstimatedTokens] = useState(0);
  const [tokenBreakdown, setTokenBreakdown] = useState<TokenBreakdown | null>(null);
  const [actualOllamaContext, setActualOllamaContext] = useState<number | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showLatestButton, setShowLatestButton] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [userHasManuallyScrolled, setUserHasManuallyScrolled] = useState(false);
  const [saveDialogResolver, setSaveDialogResolver] = useState<((value: SaveConfirmationResult) => void) | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null);
  const tokenBufferRef = useRef<string[]>([]);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamingContentRef = useRef<string>('');
  const streamingCompleteRef = useRef<boolean>(false);
  
  // Preserve scroll position across panel switches
  const [savedScrollPosition, setSavedScrollPosition] = useState(0);
  const [savedIsAtBottom, setSavedIsAtBottom] = useState(true);

  const [savedShowLatestButton, setSavedShowLatestButton] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({ connected: true, retrying: false });
  
  const { state, addMessage, removeMessage, updateMessage, setMessageHistory } = useAnalysisContext();
  const { settings, hasAPIKey, isInitialized, getAPIKey } = useSettings();
  const [hasAttemptedAutoInit, setHasAttemptedAutoInit] = useState(false);
  const currentChatScope: ChatScope = historyScope;

  const isMessageInScope = useCallback((message: ChatMessage): boolean => {
    return getMessageScope(message) === currentChatScope;
  }, [currentChatScope]);

  const scopedMessageHistory = useMemo(
    () => state.messageHistory.filter(isMessageInScope),
    [state.messageHistory, isMessageInScope]
  );

  const withScope = useCallback((message: ChatMessage): ChatMessage => ({
    ...message,
    metadata: {
      ...(message.metadata || {}),
      chatScope: currentChatScope
    }
  }), [currentChatScope]);

  const addScopedMessage = useCallback((message: ChatMessage) => {
    addMessage(withScope(message));
  }, [addMessage, withScope]);

  const updateScopedMessage = useCallback((message: ChatMessage) => {
    updateMessage(withScope(message));
  }, [updateMessage, withScope]);

  const removeScopedMessageById = useCallback((messageId: string) => {
    const target = state.messageHistory.find(msg => msg.id === messageId);
    if (target && isMessageInScope(target)) {
      removeMessage(messageId);
    }
  }, [state.messageHistory, isMessageInScope, removeMessage]);

  const clearScopedMessages = useCallback(() => {
    const retained = state.messageHistory.filter(msg => !isMessageInScope(msg));
    setMessageHistory(retained);
  }, [state.messageHistory, isMessageInScope, setMessageHistory]);
  
  // NEW: cache metadata of last AI message for header badges (after state is available)
  const lastAIMessageMetadata = useMemo(() => {
    const lastAi = [...scopedMessageHistory].reverse().find(m => ['response','assistant','analysis'].includes(m.type));
    return lastAi?.metadata as any;
  }, [scopedMessageHistory]);
  const isLocalLLM = useMemo(() => isInitialized && settings?.api?.llmMode === 'local', [isInitialized, settings?.api?.llmMode]);

  // Handle save confirmation for diagram generation
  const handleSaveConfirmation = (): Promise<SaveConfirmationResult> => {
    return new Promise((resolve) => {
      setSaveDialogResolver(() => resolve);
      setShowSaveDialog(true);
    });
  };

  const handleSaveDialogSave = async () => {
    try {
      if (onSaveFile) {
        await onSaveFile();
      }
      setShowSaveDialog(false);
      if (saveDialogResolver) {
        saveDialogResolver('continue');
        setSaveDialogResolver(null);
      }
    } catch (error) {
      console.error('Failed to save:', error);
      setShowSaveDialog(false);
      if (saveDialogResolver) {
        saveDialogResolver('cancel');
        setSaveDialogResolver(null);
      }
    }
  };

  const handleSaveDialogSkip = () => {
    setShowSaveDialog(false);
    if (saveDialogResolver) {
      saveDialogResolver('continue');
      setSaveDialogResolver(null);
    }
  };

  const handleSaveDialogAppend = () => {
    setShowSaveDialog(false);
    if (saveDialogResolver) {
      saveDialogResolver('append');
      setSaveDialogResolver(null);
    }
  };

  const handleSaveDialogCancel = () => {
    setShowSaveDialog(false);
    if (saveDialogResolver) {
      saveDialogResolver('cancel');
      setSaveDialogResolver(null);
    }
  };


  // Update estimated tokens when input message or diagram changes
  useEffect(() => {
    // Debounce token estimation to avoid too many API calls while typing
    const timer = setTimeout(() => {
      if (estimateCurrentTokens) {
        estimateCurrentTokens();
      }
    }, 300); // Wait 300ms after user stops typing
    
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMessage, currentDiagram, state.customContext, scopedMessageHistory]);
  
  // Reset auto-init flag when provider changes
  useEffect(() => {
    setHasAttemptedAutoInit(false);
  }, [settings?.api?.provider, settings?.api?.llmMode]);
  
  // Use the context window from settings (which is fetched when settings are saved)
  useEffect(() => {
    if (settings?.api?.provider === 'local') {
      const contextWindow = settings?.api?.localLLM?.contextWindow;
      logToDebugPanel('ai', '🔍 Local LLM context window from settings', {
        contextWindow,
        maxTokens: settings?.api?.localLLM?.maxTokens,
        model: settings?.api?.localLLM?.model,
        hasContextWindow: !!contextWindow
      });
      
      if (contextWindow) {
        setActualOllamaContext(contextWindow);
      } else {
        // If no context window saved, use maxTokens as fallback
        setActualOllamaContext(settings?.api?.localLLM?.maxTokens || null);
      }
    } else {
      setActualOllamaContext(null);
    }
  }, [settings?.api?.provider, settings?.api?.localLLM?.contextWindow, settings?.api?.localLLM?.maxTokens, settings?.api?.localLLM?.model]);


  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const restoreScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle user-initiated scroll interactions
  const handleUserScrollInteraction = useCallback(() => {
    if (isStreaming) {
      console.log('User manually scrolled during streaming in AnalysisPanel - disabling auto-scroll');
      setUserHasManuallyScrolled(true);
      setShowLatestButton(true);
    }
  }, [isStreaming]);

  // When messages change, scroll to the bottom of the textarea if the user is already there.
  useEffect(() => {
    // Only auto-scroll during streaming if user was at bottom and hasn't manually scrolled
    if (activePanel === 'chat' && isAtBottom && isStreaming && !userHasManuallyScrolled) {
      // The timeout gives the DOM a moment to update the scrollHeight after the new message is rendered.
      setTimeout(() => {
        if (textAreaRef.current) {
          textAreaRef.current.scrollTo({
            top: textAreaRef.current.scrollHeight,
            behavior: 'smooth',
          });
        }
      }, 100);
    }
  }, [scopedMessageHistory, activePanel, isAtBottom, isStreaming, userHasManuallyScrolled]);


  // Scroll detection to track if user is at bottom
  const handleScroll = useCallback(() => {
    const container = textAreaRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const atBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 5; // 5px tolerance
    
    setIsAtBottom(atBottom);
    
    // During streaming, only show Latest button if user has manually scrolled
    if (isStreaming) {
      if (userHasManuallyScrolled) {
        setShowLatestButton(!atBottom);
      }
      // If user scrolls back to bottom after manual scroll, allow re-enabling auto-scroll
      if (atBottom && userHasManuallyScrolled) {
        setUserHasManuallyScrolled(false);
        setShowLatestButton(false);
      }
      return;
    }
    
    // Normal behavior when not streaming
    if (atBottom) {
      setShowLatestButton(false);
    } else {
      setShowLatestButton(true);
    }
  }, [isStreaming, userHasManuallyScrolled]);

  // Add scroll and user interaction listeners
  useEffect(() => {
    const container = textAreaRef.current;
    if (!container) return;

    // Handle user-initiated scroll events
    const handleWheel = (e: WheelEvent) => {
      handleUserScrollInteraction();
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Only trigger if clicking in the scrollbar area (right side of container)
      const rect = container.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      
      if (clickX > container.clientWidth) {
        handleUserScrollInteraction();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle keyboard navigation that would cause scrolling
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
        handleUserScrollInteraction();
      }
    };

    // Add all event listeners
    container.addEventListener('scroll', handleScroll);
    container.addEventListener('wheel', handleWheel, { passive: true });
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('keydown', handleKeyDown);
      
      // Clean up timeout on unmount
      if (restoreScrollTimeoutRef.current) {
        clearTimeout(restoreScrollTimeoutRef.current);
      }
    };
  }, [handleScroll, handleUserScrollInteraction]);


  // Subscribe to connection status changes
  useEffect(() => {
    const connectionManager = ConnectionManager;
    const unsubscribe = connectionManager.subscribe((status: any) => {
      setConnectionStatus({
        connected: status.connected,
        retrying: status.retrying
      });
      
    });

    return unsubscribe;
  }, []);

  // Manual scroll functions
  const scrollToTop = () => {
    if (textAreaRef.current) {
      textAreaRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      // User clicked scroll to top - this is manual interaction
      handleUserScrollInteraction();
    }
  };

  const scrollToBottom = useCallback(() => {
    if (textAreaRef.current) {
      textAreaRef.current.scrollTo({ 
        top: textAreaRef.current.scrollHeight, 
        behavior: 'smooth' 
      });
      setShowLatestButton(false);
      // Don't trigger userScroll event for scrollToBottom as this is often used to follow streaming
    }
  }, []);

  // Method to close context/intel panels and return to chat
  const closeContextPanel = useCallback(() => {
    if (activePanel === 'context' || activePanel === 'intel') {
      setActivePanel('chat');
    }
  }, [activePanel]);

  // Method to open intel panel
  const openIntelPanel = useCallback(() => {
    // Save scroll position before switching
    if (textAreaRef.current && activePanel === 'chat') {
      setSavedScrollPosition(textAreaRef.current.scrollTop);
      setSavedIsAtBottom(isAtBottom);
      setSavedShowLatestButton(showLatestButton);
    }
    setActivePanel('intel');
  }, [activePanel, isAtBottom, showLatestButton]);

  // Expose methods through ref
  useImperativeHandle(ref, () => ({
    scrollToBottom,
    closeContextPanel,
    openIntelPanel
  }), [scrollToBottom, closeContextPanel, openIntelPanel]);

  // Function to estimate current token usage
  const estimateCurrentTokens = useCallback(async () => {
    try {
      // Only estimate if we have a message to send
      if (!inputMessage.trim()) {
        setEstimatedTokens(0);
        setTokenBreakdown(null);
        return;
      }
      
      // Don't fetch Ollama context here - use the already fetched value from the effect
      // This prevents API calls on every keystroke
      
      const context: AnalysisContext = {
        diagram: currentDiagram || { nodes: [], edges: [], metadata: {} },
        customContext: state.customContext,
        messageHistory: scopedMessageHistory,
        threatIntel: null,
        metadata: {
          lastModified: new Date(),
          version: process.env.REACT_APP_VERSION,
          systemType: 'default',
          isInitialSystem: true,
          customContext: state.customContext ?? undefined,
        }
      };
      
      const breakdown = getTokenBreakdown(inputMessage, context);
      setEstimatedTokens(breakdown.total);
      setTokenBreakdown(breakdown);
    } catch (error) {
      console.error('Failed to estimate tokens:', error);
      setEstimatedTokens(0);
      setTokenBreakdown(null);
    }
  }, [inputMessage, currentDiagram, state.customContext, scopedMessageHistory]);
  
  const handleEmptyResponseRecovery = async (): Promise<boolean> => {
    setHasAttemptedAutoInit(true);
    addScopedMessage({ id: crypto.randomUUID(), type: 'error',
      content: 'The configured model returned an empty response. Check Guardian AI settings or retry the request.',
      timestamp: new Date() });
    return false;
  };

  // Memoized function to handle sending messages
  const handleSendMessage = useCallback(async (messageContent: string) => {
    if (isGenerating || !messageContent.trim()) return;
    
    // Swarms service enhances local LLM answers but is no longer required for basic chat.
    // We no longer block messages while waiting for Swarms; users can keep chatting.
    
    try {
      setIsGenerating(true);
      setInputMessage('');

      
      // Check if the current provider has an API key configured
      if (!settings || !settings.api) {
        addScopedMessage({
          id: Date.now().toString(),
          type: 'error',
          content: 'No API settings found. Please configure your API keys in the settings panel.',
          timestamp: new Date()
        });
        setIsGenerating(false);
        return;
      }
      
      const { provider } = settings.api;
      
      // Check if API key is available (for public providers)
      if (settings.api.llmMode === 'public' && !hasAPIKey(provider)) {
        addScopedMessage({
          id: Date.now().toString(),
          type: 'error',
          content: `No API key found for ${provider}. Please add your API key in the settings panel.`,
          timestamp: new Date()
        });
        setIsGenerating(false);
        return;
      }
      
      // Generate a unique message ID
      const messageId = `msg-${Date.now()}`;
      
      // Add user message to the chat
      const userMessage: ChatMessage = {
        id: messageId,
        type: 'question',
        content: messageContent,
        timestamp: new Date(),
        tokenInfo: {
          promptTokens: estimatedTokens
        }
      };
      
      addScopedMessage(userMessage);

      // Prepare full context
      const diagramData: DiagramData = state.currentState || currentDiagram || { nodes: [], edges: [], metadata: {} };

      // Include imported threat intelligence context if available
      let threatIntelContext = '';
      const imported = state.importedThreatIntel;
      if (imported?.processed) {
        const intel = imported.processed as any;
        const meta = imported.metadata || {} as any;
        const countLines = (s?: string) => (s ? s.split('\n').filter((l: string) => l.trim()).length : 0);
        const total = Number(meta.totalImported || 0);
        const rel = Number(meta.relevantExtracted || 0);
        const pct = total > 0 ? Math.round((rel / total) * 100) : 0;
        const matched = Array.isArray(meta.matchedComponents) ? meta.matchedComponents.join(', ') : (meta.matchedComponents || 'None');

        threatIntelContext = `=== IMPORTED THREAT INTELLIGENCE ===\n` +
          `Source: ${meta.source || 'Unknown'}\n` +
          `Import Date: ${meta.importDate || new Date().toISOString()}\n` +
          `Total Imported: ${total} items\n` +
          `Relevant Extracted: ${rel} items (${pct}% relevance)\n` +
          `Matched Components: ${matched}\n\n` +
          `RECENT CVEs (${countLines(intel.recentCVEs)} total):\n${intel.recentCVEs || 'None'}\n\n` +
          `KNOWN IOCs (${countLines(intel.knownIOCs)} total):\n${intel.knownIOCs || 'None'}\n\n` +
          `THREAT ACTORS:\n${intel.threatActors || 'None'}\n\n` +
          `CAMPAIGN INFO:\n${intel.campaignInfo || 'None'}\n\n` +
          (intel.attackPatterns ? `ATTACK PATTERNS:\n${intel.attackPatterns}\n\n` : '') +
          (intel.mitigations ? `RECOMMENDED MITIGATIONS:\n${intel.mitigations}\n` : '');
      }

      const context: AnalysisContext = {
        diagram: diagramData,
        customContext: state.customContext,
        messageHistory: scopedMessageHistory,
        threatIntel: null, // This will be enriched by the backend
        additionalContext: threatIntelContext || undefined,
        metadata: {
          lastModified: new Date(),
          version: process.env.REACT_APP_VERSION,
          systemType: 'default',
          isInitialSystem: true,
          customContext: state.customContext ?? undefined,
        }
      };

      const finalContext = contextAugmenter ? contextAugmenter(context) : context;

      // Debug logging to track diagram data sent to AI
      console.log('AnalysisPanel - Sending diagram data to AI:', {
        nodeCount: finalContext.diagram.nodes.length,
        edgeCount: finalContext.diagram.edges.length,
        hasCurrentDiagram: !!currentDiagram,
        hasCurrentState: !!state.currentState,
        usingCurrentState: !!state.currentState,
        messageLength: messageContent.length,
        timestamp: new Date().toISOString(),
        edgeDetails: finalContext.diagram.edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle
        }))
      });

      // Add a loading message
      const loadingMessageId = `loading-${Date.now()}`;
      addScopedMessage({
        id: loadingMessageId,
        type: 'loading',
        content: 'Generating response...',
        timestamp: new Date()
      });

      // Only auto-scroll if user was already at bottom
      if (isAtBottom) {
        setTimeout(() => scrollToBottom(), 100);
      }

      try {
        // Check if streaming is enabled
        if (settings.responseMode === 'streaming') {
          // Streaming mode
          setIsStreaming(true);
          const responseId = `response-${Date.now()}`;
          setStreamingMessageId(responseId);
          
          // Reset manual scroll tracking for new streaming session
          setUserHasManuallyScrolled(false);
          
          // Remove loading message
          removeScopedMessageById(loadingMessageId);
          
          // Add streaming message placeholder
          addScopedMessage({
            id: responseId,
            type: 'response',
            content: '',
            timestamp: new Date()
          });
          
          // Reset buffers for new streaming
          tokenBufferRef.current = [];
          streamingContentRef.current = '';
          streamingCompleteRef.current = false;
          
          // Create abort controller for cancellation
          const controller = new AbortController();
          setCurrentAbortController(controller);
          
          try {
            await chatWithStreaming(
              messageContent,
              finalContext,
              // onToken callback - add to buffer instead of updating directly
              (token: string) => {
                // Check if request was cancelled before processing token
                if (controller.signal.aborted) {
                  return;
                }
                
                // Check if this is a status update
                if (token.startsWith('[STATUS:') && token.endsWith(']')) {
                  // Parse status message format: [STATUS:status_type:message]
                  const statusMatch = token.match(/^\[STATUS:([^:]+):(.+)\]$/);
                  if (statusMatch) {
                    const [, statusType, statusMessage] = statusMatch;
                    
                    // Update the streaming message to show status
                    updateScopedMessage({
                      id: responseId,
                      type: 'response',
                      content: statusMessage,
                      timestamp: new Date(),
                      metadata: {
                        isStatus: true,
                        statusType: statusType
                      }
                    });
                    
                    // Log status to debug panel
                    logToDebugPanel('ai', `⏳ ${statusMessage}`, {
                      statusType: statusType
                    });
                    
                    return; // Don't add status messages to token buffer
                  }
                }
                
                // Add regular token to buffer
                tokenBufferRef.current.push(token);
                
                // Start update interval if not already running
                if (!updateIntervalRef.current) {
                  const UPDATE_INTERVAL = 30; // Update every 30ms for smooth output
                  
                  updateIntervalRef.current = setInterval(() => {
                    if (tokenBufferRef.current.length === 0) {
                      // Check if we should stop the interval
                      if (streamingCompleteRef.current) {
                        clearInterval(updateIntervalRef.current!);
                        updateIntervalRef.current = null;
                      }
                      return;
                    }

                    // Process exactly 1 token at a time for maximum smoothness
                    const token = tokenBufferRef.current.shift();
                    if (token) {
                      streamingContentRef.current += token;

                      // Update the message - this will always work regardless of scroll position
                      updateScopedMessage({
                        id: responseId,
                        type: 'response',
                        content: streamingContentRef.current,
                        timestamp: new Date(),
                        metadata: {
                          isStatus: false  // Clear any status flag when we have actual content
                        }
                      });
                    }
                  }, UPDATE_INTERVAL);
                }
              },
              // onComplete callback - finalize the message
              (response) => {
                // Check if request was cancelled before completing
                if (controller.signal.aborted) {
                  return;
                }
                
                // Mark streaming as complete
                streamingCompleteRef.current = true;
                
                // Don't dump remaining tokens - let the interval process them naturally
                // Just wait for the buffer to empty
                const waitForBufferToEmpty = () => {
                  if (tokenBufferRef.current.length > 0 || updateIntervalRef.current) {
                    // Still have tokens or interval is still running, check again in a bit
                    setTimeout(waitForBufferToEmpty, 100);
                    return;
                  }
                  
                  // Buffer is empty and interval is stopped, now we can finalize
                  finalizeMessage();
                };
                
                const finalizeMessage = async () => {
                  // Clear the interval first
                  if (updateIntervalRef.current) {
                    clearInterval(updateIntervalRef.current);
                    updateIntervalRef.current = null;
                  }
                  
                  // Check for empty streaming response
                  if (!streamingContentRef.current || streamingContentRef.current.trim() === '') {
                    logToDebugPanel('warn', '⚠️ Empty streaming response detected', {
                      provider: settings.api.llmMode === 'local' ? 'local' : settings.api.provider,
                      hasAttemptedAutoInit
                    });
                    
                    // Only attempt recovery if we haven't tried before AND if it's likely a provider initialization issue
                    // For local LLMs, empty responses usually mean the model failed to generate, not that the provider isn't initialized
                    if (!hasAttemptedAutoInit && settings.api.llmMode !== 'local') {
                      const recoverySuccess = await handleEmptyResponseRecovery();
                      if (recoverySuccess) {
                        // Remove the empty message
                        removeScopedMessageById(responseId);
                        // Retry the message
                        logToDebugPanel('ai', '🔄 Retrying message after provider initialization');
                        setIsStreaming(false);
                        setStreamingMessageId(null);
                        setCurrentAbortController(null);
                        // Reset buffers
                        tokenBufferRef.current = [];
                        streamingContentRef.current = '';
                        streamingCompleteRef.current = false;
                        // Retry sending the message
                        await handleSendMessage(messageContent);
                        return;
                      }
                    } else {
                      // For local LLMs or if we've already attempted recovery, show an error instead
                      removeScopedMessageById(responseId);
                      addScopedMessage({
                        id: `error-${Date.now()}`,
                        type: 'error',
                        content: settings.api.llmMode === 'local' 
                          ? 'Local LLM returned an empty response. This may happen if the model is overloaded or the prompt is too complex. Please try again with a simpler prompt.'
                          : 'AI provider returned an empty response. Please check your settings and try again.',
                        timestamp: new Date()
                      });
                      
                      // Clear streaming state
                      setIsStreaming(false);
                      setStreamingMessageId(null);
                      setCurrentAbortController(null);
                      tokenBufferRef.current = [];
                      streamingContentRef.current = '';
                      streamingCompleteRef.current = false;
                    }
                  }
                  
                  const tokenInfo = response.metadata?.tokenInfo || {
                    promptTokens: 0,
                    responseTokens: 0,
                    totalTokens: 0
                  };
                  
                  updateScopedMessage({
                    id: responseId,
                    type: 'response',
                    content: streamingContentRef.current,
                    timestamp: new Date(),
                    metadata: {
                      analysisType: 'full',
                      ...(response.metadata || {})
                    },
                    tokenInfo: tokenInfo
                  });
                  
                  setIsStreaming(false);
                  setStreamingMessageId(null);
                  setCurrentAbortController(null);
                  setUserHasManuallyScrolled(false);
                  
                  // Reset buffers
                  tokenBufferRef.current = [];
                  streamingContentRef.current = '';
                  streamingCompleteRef.current = false;
                  
                  setTimeout(() => scrollToBottom(), 100);
                };
                
                // Start waiting for buffer to empty
                waitForBufferToEmpty();
              },
              // AbortSignal for cancellation
              controller.signal
            );
          } catch (streamError) {
            console.error('Streaming error:', streamError);
            
            // Handle AbortError differently - it means user cancelled
            if (streamError instanceof Error && streamError.name === 'AbortError') {
              console.log('AnalysisPanel: Streaming was aborted by user - partial content preserved');
              // Don't show error message for user-initiated cancellation
              // The cancel button already handled the message update
            } else {
              const errorMessage = streamError instanceof Error ? streamError.message : 'Unknown error';
              
              // Check if error is due to uninitialized provider
              const errorMessageLower = errorMessage.toLowerCase();
              const isProviderError = errorMessageLower.includes('service not available') || 
                                     errorMessageLower.includes('no ai provider') ||
                                     errorMessageLower.includes('provider not configured') ||
                                     errorMessageLower.includes('offline mode');
              
              if (isProviderError && !hasAttemptedAutoInit) {
                logToDebugPanel('ai', '⚠️ Provider not initialized during streaming, attempting auto-initialization', {
                  error: errorMessage
                });
                
                // Remove the failed streaming message
                removeScopedMessageById(responseId);
                
                // Clear streaming state and buffers
                setIsStreaming(false);
                setStreamingMessageId(null);
                setCurrentAbortController(null);
                streamingContentRef.current = '';
                tokenBufferRef.current = [];
                streamingCompleteRef.current = false;
                setUserHasManuallyScrolled(false);
                if (updateIntervalRef.current) {
                  clearInterval(updateIntervalRef.current);
                  updateIntervalRef.current = null;
                }
                
                const recoverySuccess = await handleEmptyResponseRecovery();
                if (recoverySuccess) {
                  // Retry the message
                  logToDebugPanel('ai', '🔄 Retrying message after provider initialization');
                  await handleSendMessage(messageContent);
                  return;
                }
              }
              
              // Remove the failed streaming message for actual errors
              removeScopedMessageById(responseId);
              
              // Add error message
              addScopedMessage({
                id: `error-${Date.now()}`,
                type: 'error',
                content: `Streaming Error: ${errorMessage}`,
                timestamp: new Date()
              });
              
              // Check if it's a network error and trigger reconnection
              if (errorMessageLower.includes('network') || 
                  errorMessageLower.includes('fetch') ||
                  errorMessageLower.includes('connection')) {
                const ConnectionManager = (await import('../services/ConnectionManager')).default;
                ConnectionManager.getInstance().handleConnectionError(streamError instanceof Error ? streamError : new Error(errorMessage));
              }
              
              // Only reset states for actual errors, not for user cancellation
              setIsStreaming(false);
              setStreamingMessageId(null);
              setCurrentAbortController(null);
              setUserHasManuallyScrolled(false);
              
              // Clear interval and buffers
              if (updateIntervalRef.current) {
                clearInterval(updateIntervalRef.current);
                updateIntervalRef.current = null;
              }
              tokenBufferRef.current = [];
              streamingContentRef.current = '';
            }
          }
        } else {
          // Non-streaming mode (original behavior)
          // Capture scroll position before sending message
          const wasAtBottom = isAtBottom;
          
          const response = await onSendMessage(messageContent, finalContext);
          
          // Remove loading message
          removeScopedMessageById(loadingMessageId);
          
          // Add the AI response to the chat
          if (response && response.choices && response.choices.length > 0) {
            const choice = response.choices[0];
            const content = choice.message?.content || '';
            
            // Check for empty non-streaming response
            if (!content || content.trim() === '') {
              logToDebugPanel('warn', '⚠️ Empty response detected', {
                provider: settings.api.llmMode === 'local' ? 'local' : settings.api.provider,
                hasAttemptedAutoInit
              });
              
              // Only attempt recovery for non-local providers
              if (!hasAttemptedAutoInit && settings.api.llmMode !== 'local') {
                const recoverySuccess = await handleEmptyResponseRecovery();
                if (recoverySuccess) {
                  // Retry the message
                  logToDebugPanel('ai', '🔄 Retrying message after provider initialization');
                  await handleSendMessage(messageContent);
                  return;
                }
              } else {
                // For local LLMs, show a more helpful error message
                addScopedMessage({
                  id: `error-${Date.now()}`,
                  type: 'error',
                  content: settings.api.llmMode === 'local' 
                    ? 'Local LLM returned an empty response. This may happen if the model is overloaded or the prompt is too complex. Please try again with a simpler prompt.'
                    : 'AI provider returned an empty response. Please check your settings and try again.',
                  timestamp: new Date()
                });
                return;
              }
            }
            
            // const tokenInfo = response.metadata?.tokenInfo || {
            //   promptTokens: 0,
            //   responseTokens: 0,
            //   totalTokens: 0
            // }; // Not currently used
            
            addScopedMessage({
              id: `response-${Date.now()}`,
              type: 'response',
              content,
              timestamp: new Date(),
              metadata: {
                ...(response.metadata || {})
              }
            });
            
            // Show Latest button if user was not at bottom when the response arrived
            if (!wasAtBottom) {
              setTimeout(() => {
                setShowLatestButton(true);
              }, 100);
            }
          } else {
            throw new Error('Invalid response format from AI provider');
          }
        }
      } catch (error: any) {
        // Similarly, handle the error case by only removing the loading message
        removeScopedMessageById(loadingMessageId);
        
        // Add error message
        addScopedMessage({
          id: `error-${Date.now()}`,
          type: 'error',
          content: `Error: ${error.message || 'Failed to generate response'}`,
          timestamp: new Date()
        });
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      // Check if error is due to uninitialized provider
      const errorMessage = error.message?.toLowerCase() || '';
      const isProviderError = errorMessage.includes('service not available') || 
                             errorMessage.includes('no ai provider') ||
                             errorMessage.includes('provider not configured') ||
                             errorMessage.includes('offline mode');
      
      if (isProviderError && !hasAttemptedAutoInit) {
        logToDebugPanel('ai', '⚠️ Provider not initialized, attempting auto-initialization', {
          error: error.message
        });
        
        const recoverySuccess = await handleEmptyResponseRecovery();
        if (recoverySuccess) {
          // Retry the message
          logToDebugPanel('ai', '🔄 Retrying message after provider initialization');
          await handleSendMessage(messageContent);
          return;
        }
      }
      
      // Add error message to the chat
      addScopedMessage({
        id: `error-${Date.now()}`,
        type: 'error',
        content: `Error: ${error.message || 'An unknown error occurred'}`,
        timestamp: new Date()
      });
    } finally {
      setIsGenerating(false);
    }
  }, [
    isGenerating, 
    addScopedMessage,
    removeScopedMessageById,
    updateScopedMessage,
    onSendMessage, 
    currentDiagram, 
    state.customContext, 
    scopedMessageHistory,
    state.currentState,
    contextAugmenter,
    settings,
    estimatedTokens,
    scrollToBottom,
    isAtBottom,
    hasAPIKey
  ]);





  // Combine messages into a single string for the textarea
  const formattedMessages = scopedMessageHistory.map((msg, index) => {
    const timestamp = msg.timestamp instanceof Date 
      ? msg.timestamp.toLocaleTimeString()
      : new Date(msg.timestamp).toLocaleTimeString();
    
    let sender = 'System';
    if (msg.type === 'question') {
      sender = 'You';
    } else if (msg.type === 'response' || msg.type === 'assistant' || msg.type === 'analysis') {
      const responseMetadata = msg.metadata as any;
      const provider = responseMetadata?.provider || settings?.api?.provider || 'AI';
      const formattedProvider = provider.charAt(0).toUpperCase() + provider.slice(1);
      if (isLocalLLM || provider.toLowerCase().includes('ollama') || provider.toLowerCase().includes('local')) {
        sender = `Local LLM (${formattedProvider})`;
      } else {
        sender = formattedProvider;
      }
    } else if (msg.type === 'error') {
      sender = 'Error';
    }
    
    const separator = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    
    // Check if message is compressed
    const isCompressed = (msg.metadata as any)?.compressed;
    const compressionLevel = (msg.metadata as any)?.compressionLevel;
    const originalMessages = (msg.metadata as any)?.originalMessages;
    
    // Build header with compression info
    let header = `[${sender.toUpperCase()} - ${timestamp}]`;
    if (isCompressed) {
      header += ` [COMPRESSED`;
      if (compressionLevel !== undefined) {
        const levelNames = ['', 'LIGHT', 'MEDIUM', 'HEAVY', 'ULTRA'];
        header += ` - ${levelNames[compressionLevel] || 'UNKNOWN'}`;
      }
      if (originalMessages) {
        header += ` - ${originalMessages} messages`;
      }
      header += `]`;
    }
    header += `\n\n`;
    
    // Handle loading message separately to fit the new format.
    if (msg.type === 'loading') {
      const loadingHeader = `[SYSTEM - ${timestamp}]\n\n`;
      const loadingBody = `Generating response...`;
      return (index > 0 ? `\n${separator}` : '') + loadingHeader + loadingBody;
    }

    const body = `${msg.content}\n`;

    // Add a separator before every message except the very first one.
    return (index > 0 ? `\n${separator}` : '') + header + body;
  }).join('');



  return (
    <PanelContainer 
      className="analysis-panel-content"
      data-testid="analysis-panel"
    >
      <PanelHeader>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          justifyContent: 'space-between',
          gap: 1
        }}>
          {/* Tab Selectors */}
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {/* Chat Tab (default - clicking it closes other panels) */}
            <Tooltip title="Chat with AI" arrow placement="bottom">
              <StyledActionButton
                variant={activePanel === 'chat' ? "contained" : "outlined"}
                onClick={() => {
                  if (activePanel !== 'chat') {
                    // Save current scroll position before switching
                    if (textAreaRef.current) {
                      setSavedScrollPosition(textAreaRef.current.scrollTop);
                      setSavedIsAtBottom(isAtBottom);
                      setSavedShowLatestButton(showLatestButton);
                    }
                    setActivePanel('chat');

                    // Restore scroll position
                    if (restoreScrollTimeoutRef.current) {
                      clearTimeout(restoreScrollTimeoutRef.current);
                    }
                    restoreScrollTimeoutRef.current = setTimeout(() => {
                      if (textAreaRef.current) {
                        textAreaRef.current.scrollTop = savedScrollPosition;
                        setIsAtBottom(savedIsAtBottom);
                        setShowLatestButton(savedShowLatestButton);
                      }
                    }, 50);
                  }
                }}
                className={settings.effects?.neon && activePanel === 'chat' ? 'neon-glow' : ''}
                sx={{
                  backgroundColor: activePanel === 'chat' ? theme.colors.primary : 'transparent',
                  color: activePanel === 'chat' ? getContrastText(theme.colors.primary) : theme.colors.textPrimary,
                  minWidth: 'auto',
                  padding: '6px 12px',
                  '&:hover': {
                    backgroundColor: activePanel === 'chat' ? theme.colors.primary : theme.colors.surfaceHover,
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <MessageSquare size={16} />
                  <Typography variant="body2" sx={{ color: 'inherit' }}>Chat</Typography>
                </Box>
              </StyledActionButton>
            </Tooltip>

            {/* Context Tab */}
            <Tooltip title="System Context" arrow placement="bottom">
              <StyledActionButton
                variant={activePanel === 'context' ? "contained" : "outlined"}
                onClick={() => {
                  if (activePanel === 'context') {
                    // Close context panel - return to chat
                    setActivePanel('chat');

                    // Restore scroll position
                    if (restoreScrollTimeoutRef.current) {
                      clearTimeout(restoreScrollTimeoutRef.current);
                    }
                    restoreScrollTimeoutRef.current = setTimeout(() => {
                      if (textAreaRef.current) {
                        textAreaRef.current.scrollTop = savedScrollPosition;
                        setIsAtBottom(savedIsAtBottom);
                        setShowLatestButton(savedShowLatestButton);
                      }
                    }, 50);
                  } else {
                    // Open context panel
                    if (textAreaRef.current && activePanel === 'chat') {
                      setSavedScrollPosition(textAreaRef.current.scrollTop);
                      setSavedIsAtBottom(isAtBottom);
                      setSavedShowLatestButton(showLatestButton);
                    }
                    setActivePanel('context');
                  }
                }}
                className={settings.effects?.neon && activePanel === 'context' ? 'neon-glow' : ''}
                sx={{
                  backgroundColor: activePanel === 'context' ? theme.colors.primary : 'transparent',
                  color: activePanel === 'context' ? getContrastText(theme.colors.primary) : theme.colors.textPrimary,
                  minWidth: 'auto',
                  padding: '6px 12px',
                  '&:hover': {
                    backgroundColor: activePanel === 'context' ? theme.colors.primary : theme.colors.surfaceHover,
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <InfoIcon size={16} />
                  <Typography variant="body2" sx={{ color: 'inherit' }}>Context</Typography>
                </Box>
              </StyledActionButton>
            </Tooltip>

            {/* Intel Tab */}
            <Tooltip title="Threat Intelligence" arrow placement="bottom">
              <StyledActionButton
                variant={activePanel === 'intel' ? "contained" : "outlined"}
                onClick={() => {
                  if (activePanel === 'intel') {
                    // Close intel panel - return to chat
                    setActivePanel('chat');

                    // Restore scroll position
                    if (restoreScrollTimeoutRef.current) {
                      clearTimeout(restoreScrollTimeoutRef.current);
                    }
                    restoreScrollTimeoutRef.current = setTimeout(() => {
                      if (textAreaRef.current) {
                        textAreaRef.current.scrollTop = savedScrollPosition;
                        setIsAtBottom(savedIsAtBottom);
                        setShowLatestButton(savedShowLatestButton);
                      }
                    }, 50);
                  } else {
                    // Open intel panel
                    if (textAreaRef.current && activePanel === 'chat') {
                      setSavedScrollPosition(textAreaRef.current.scrollTop);
                      setSavedIsAtBottom(isAtBottom);
                      setSavedShowLatestButton(showLatestButton);
                    }
                    setActivePanel('intel');
                  }
                }}
                className={settings.effects?.neon && activePanel === 'intel' ? 'neon-glow' : ''}
                sx={{
                  backgroundColor: activePanel === 'intel' ? theme.colors.primary : 'transparent',
                  color: activePanel === 'intel' ? getContrastText(theme.colors.primary) : theme.colors.textPrimary,
                  minWidth: 'auto',
                  padding: '6px 12px',
                  '&:hover': {
                    backgroundColor: activePanel === 'intel' ? theme.colors.primary : theme.colors.surfaceHover,
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Shield size={16} />
                  <Typography variant="body2" sx={{ color: 'inherit' }}>Intel</Typography>
                </Box>
              </StyledActionButton>
            </Tooltip>
          </Box>

          {/* Right side: Model info + Control Buttons */}
          <Box sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            flexShrink: 0,
            ml: 'auto'
          }}>
            {/* Model info */}
            {(() => {
              const provider = (lastAIMessageMetadata?.provider || settings?.api?.provider || 'local') as string;
              let modelName: string | undefined = lastAIMessageMetadata?.model;

              if (!modelName) {
                if (provider === 'local') {
                  modelName = settings?.api?.localLLM?.model || 'Local LLM';
                } else {
                  const cfg = settings?.api?.providerConfig as any;
                  modelName = cfg?.[provider]?.model || provider;
                }
              }

              return (
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  fontSize: '0.75rem',
                  color: theme.colors.textSecondary,
                }}>
                  {/* Model name — diagnostics only (hidden unless debug panel enabled) */}
                  {(settings?.debugPanelEnabled ?? false) && (
                    <Tooltip title={modelName || 'Unknown Model'} arrow>
                      <Box sx={{
                        fontSize: '0.7rem',
                        opacity: 0.8,
                        maxWidth: '150px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        cursor: 'help',
                      }}>
                        {modelName}
                      </Box>
                    </Tooltip>
                  )}

                  {/* Compaction indicator */}
                  {state.compactionState.isCompacting && (
                    <Tooltip title="Optimizing message history...">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CircularProgress size={12} sx={{ color: theme.colors.info }} />
                      </Box>
                    </Tooltip>
                  )}

                  {/* Compression active badge */}
                  {state.compactionState.tokensSaved > 0 && (
                    <Tooltip title={
                      <Box>
                        <Typography variant="caption">Message History Optimization</Typography>
                        <Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem' }}>
                          • Compression: {Math.round(state.compactionState.compressionRatio * 100)}%
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem' }}>
                          • Tokens saved: {formatTokenCount(state.compactionState.tokensSaved)}
                        </Typography>
                      </Box>
                    }>
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: alpha(theme.colors.success, 0.1),
                        border: `1px solid ${alpha(theme.colors.success, 0.3)}`
                      }}>
                        <Minimize2 size={10} />
                        <Typography variant="caption" sx={{ ml: 0.5, fontSize: '0.65rem' }}>
                          {Math.round(state.compactionState.compressionRatio * 100)}%
                        </Typography>
                      </Box>
                    </Tooltip>
                  )}
                </Box>
              );
            })()}

            {/* Clear History Button */}
            <Tooltip title="Clear chat history (reduces token usage)">
              <StyledActionButton
                onClick={() => {
                  if (window.confirm('Clear chat history for this module? This will reduce token usage but remove previous messages in this panel.')) {
                    clearScopedMessages();
                    // Force re-evaluation of tokens immediately
                    setTimeout(() => estimateCurrentTokens(), 0);
                  }
                }}
                disabled={scopedMessageHistory.length === 0}
                sx={{
                  minWidth: 'auto',
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  color: theme.colors.textSecondary,
                  flexShrink: 0,
                  '&:hover': {
                    color: theme.colors.error,
                    borderColor: theme.colors.error,
                    backgroundColor: `${theme.colors.error}10`
                  }
                }}
              >
                Clear
              </StyledActionButton>
            </Tooltip>
          </Box>
        </Box>
      </PanelHeader>

      {activePanel === 'chat' ? (
        <>
          <MessagesContainer>
            <ReadOnlyTextArea
              ref={textAreaRef}
              value={formattedMessages}
              readOnly
            />
          </MessagesContainer>

          {/* Latest message button - positioned between messages and input */}
          {showLatestButton && !isStreaming && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '8px 16px',
                position: 'relative',
              }}
            >
              <LatestButton
                onClick={scrollToBottom}
                startIcon={<ChevronDown size={16} />}
              >
                Latest
              </LatestButton>
            </Box>
          )}

          {/* Swarms service status alert for local LLM */}
          {connectionStatus.retrying && (
            <Box sx={{ padding: '16px', paddingBottom: 0 }}>
              <Alert 
                severity="error" 
                icon={<AlertCircle size={20} />}
                sx={{
                  backgroundColor: alpha(theme.colors.error, 0.1),
                  color: theme.colors.textPrimary,
                  border: `1px solid ${theme.colors.error}`,
                  '& .MuiAlert-icon': {
                    color: theme.colors.error
                  }
                }}
              >
                <Typography variant="body2">
                  Server connection lost. Reconnecting...
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.8 }}>
                  The server will restart automatically if needed.
                </Typography>
              </Alert>
            </Box>
          )}

          <InputContainer>
            <StyledTextField
              fullWidth
              multiline
              maxRows={3}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={
                isStreaming ? "Streaming response..." : 
                connectionStatus.retrying ? "Server connection lost..." :
                "Ask about security or the diagram..."
              }
              disabled={isAnalyzing || isStreaming || connectionStatus.retrying}
              size="small"
              onKeyDown={(e) => {
                // Only handle Enter key, don't interfere with text selection
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (inputMessage.trim()) {
                    handleSendMessage(inputMessage);
                  }
                }
                // Don't interfere with other keys that might be used for text selection
              }}
              sx={{ 
                '& .MuiOutlinedInput-root': {
                  padding: '6px 8px'
                },
                mb: 0
              }}
            />
            
            {/* Token Usage Display */}
            <Box sx={{ 
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              mb: 0
            }}>
              <Box sx={{ 
                padding: '4px 8px',
                width: '100%',
                maxWidth: '400px',
                textAlign: 'center',
                fontSize: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                {(() => {
                  // Get current model info
                  const provider = settings?.api?.provider || 'local';
                  const modelName = isLocalLLM 
                    ? settings?.api?.localLLM?.model 
                    : (settings?.api?.providerConfig as any)?.[provider]?.model;
                  
                  const modelInfo = getModelInfo(modelName, provider);
                  // Use actual Ollama context if available, otherwise use model defaults
                  const maxTokens = (provider === 'local' && actualOllamaContext) ? actualOllamaContext : modelInfo.maxTokens;
                  const warningThreshold = Math.floor(maxTokens * 0.8);
                  
                  const tokenColor = getTokenUsageColor(estimatedTokens, maxTokens, theme);
                  const percentage = Math.round((estimatedTokens / maxTokens) * 100);
                  const isOverLimit = estimatedTokens > maxTokens;
                  const isWarning = estimatedTokens > warningThreshold;
                  
                  // Check if message history is contributing to tokens
                  const hasMessageHistory = scopedMessageHistory.length > 0;
                  
                  return (
                    <>
                      {/* Persistent token meter is diagnostics: only shown when the
                          debug panel is enabled. Limit warnings below always show. */}
                      {(settings?.debugPanelEnabled ?? false) && (
                      <Tooltip title={
                        <Box sx={{ fontSize: '0.75rem' }}>
                          <div>Model: {modelInfo.model || 'Unknown'} ({provider})</div>
                          {/* Show Ollama context info */}
                          {provider === 'local' && actualOllamaContext && (
                            <div style={{ marginTop: '4px', color: theme.colors.success, fontStyle: 'italic' }}>
                              Ollama context: {formatTokenCount(actualOllamaContext)} tokens
                            </div>
                          )}
                          {provider === 'local' && !actualOllamaContext && modelInfo.maxTokens === 8192 && (
                            <div style={{ marginTop: '4px', color: theme.colors.info, fontStyle: 'italic' }}>
                              Using Ollama default context (8K tokens)
                            </div>
                          )}
                          {provider === 'local' && !actualOllamaContext && modelName?.includes('llama3.1') && modelInfo.maxTokens === 128000 && (
                            <div style={{ marginTop: '4px', color: theme.colors.info, fontStyle: 'italic' }}>
                              Note: Ollama defaults to 8K context unless configured
                            </div>
                          )}
                          {tokenBreakdown && (
                            <>
                              <div style={{ marginTop: '4px' }}>Token breakdown:</div>
                              {tokenBreakdown.userMessage > 0 && <div>• Message: {formatTokenCount(tokenBreakdown.userMessage)} tokens</div>}
                              <div>• System prompt: {formatTokenCount(tokenBreakdown.systemPrompt)} tokens</div>
                              {tokenBreakdown.diagramContext > 0 && <div>• Diagram: {formatTokenCount(tokenBreakdown.diagramContext)} tokens</div>}
                              {tokenBreakdown.customContext > 0 && <div>• Custom context: {formatTokenCount(tokenBreakdown.customContext)} tokens</div>}
                              {tokenBreakdown.messageHistory > 0 && (
                                <div style={{ color: theme.colors.warning }}>
                                  • Message history: {formatTokenCount(tokenBreakdown.messageHistory)} tokens
                                  {state.compactionState.tokensSaved > 0 && (
                                    <span style={{ color: theme.colors.success, marginLeft: '4px' }}>
                                      (saved {formatTokenCount(state.compactionState.tokensSaved)} via compression)
                                    </span>
                                  )}
                                </div>
                              )}
                              <div style={{ marginTop: '4px', borderTop: `1px solid ${theme.colors.border}`, paddingTop: '4px' }}>
                                Total: {formatTokenCount(tokenBreakdown.total)} tokens
                              </div>
                              {tokenBreakdown.messageHistory > 0 && (
                                <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
                                  Click "Clear" to save {formatTokenCount(tokenBreakdown.messageHistory)} tokens
                                </div>
                              )}
                            </>
                          )}
                        </Box>
                      }>
                        <Box sx={{
                          backgroundColor: `${tokenColor}14`,
                          borderRadius: '4px',
                          border: `1px solid ${tokenColor}33`,
                          padding: '4px 8px',
                          color: isOverLimit ? theme.colors.error : (isWarning ? theme.colors.warning : theme.colors.textSecondary),
                          cursor: 'pointer'
                        }}>
                          <Typography variant="caption" sx={{ 
                            fontWeight: isOverLimit || isWarning ? 600 : 400,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            {formatTokenCount(estimatedTokens)} / {formatTokenCount(maxTokens)} tokens ({percentage}%)
                            {hasMessageHistory && (
                              <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                +history
                              </span>
                            )}
                          </Typography>
                        </Box>
                      </Tooltip>
                      )}

                      {/* Warning message when approaching limit */}
                      {isWarning && !isOverLimit && (
                        <Alert 
                          severity="warning" 
                          sx={{ 
                            mt: 1, 
                            py: 0.5,
                            backgroundColor: alpha(theme.colors.warning, 0.1),
                            color: theme.colors.warning,
                            '& .MuiAlert-icon': {
                              color: theme.colors.warning
                            }
                          }}
                        >
                          <Typography variant="caption">
                            Approaching token limit ({percentage}% used). Consider enabling message compaction in settings or using shorter messages.
                          </Typography>
                        </Alert>
                      )}
                      
                      {/* Error message when over limit */}
                      {isOverLimit && (
                        <Typography variant="caption" sx={{ 
                          color: theme.colors.error,
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <AlertCircle size={12} />
                          Exceeds model limit! Response may be truncated.
                        </Typography>
                      )}
                      {!isOverLimit && isWarning && (
                        <Typography variant="caption" sx={{ 
                          color: theme.colors.warning,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <AlertCircle size={12} />
                          Approaching token limit
                        </Typography>
                      )}
                    </>
                  );
                })()}
              </Box>
            </Box>
            
            {/* Send Message Button with Scroll Controls */}
            <Box sx={{ 
              display: 'flex', 
              gap: 1,
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              {isStreaming ? (
                <ActionButton
                  onClick={async () => {
                    // Cancel streaming and preserve partial content
                    if (streamingMessageId) {
                      // Find the streaming message and preserve its partial content
                      const updatedMessages = state.messageHistory.map((msg: ChatMessage) => {
                        if (msg.id === streamingMessageId) {
                          const currentContent = msg.content || '';
                          return {
                            ...msg,
                            content: currentContent ? 
                              currentContent + '\n\n[Response cancelled by user]' : 
                              '[Response cancelled by user]',
                            metadata: {
                              ...msg.metadata,
                              cancelled: true,
                              timestamp: new Date().toISOString()
                            }
                          };
                        }
                        return msg;
                      });
                      
                      setMessageHistory(updatedMessages);
                      
                      // Cancel the AbortController first
                      if (currentAbortController) {
                        currentAbortController.abort();
                      }
                      
                      // Reset streaming state
                      setStreamingMessageId(null);
                      setIsStreaming(false);
                      setCurrentAbortController(null);
                      setUserHasManuallyScrolled(false);
                      
                      // Clear interval and buffers
                      if (updateIntervalRef.current) {
                        clearInterval(updateIntervalRef.current);
                        updateIntervalRef.current = null;
                      }
                      
                      // Clear the buffer without processing - user cancelled
                      tokenBufferRef.current = [];
                      
                      // Update the message with whatever we have so far
                      const currentContent = streamingContentRef.current;
                      
                      // The shared AI request owns backend cancellation through its AbortSignal.
                    }
                  }}
                  sx={{
                    backgroundColor: theme.colors.error,
                    flex: 1,
                    maxWidth: '200px',
                    padding: '8px 16px',
                    minHeight: '36px',
                    '&:hover': {
                      backgroundColor: theme.colors.error,
                      filter: 'brightness(0.9)'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Loader2 size={16} className="loader-icon" />
                    <Typography variant="body2">Cancel Streaming</Typography>
                  </Box>
                </ActionButton>
              ) : (
                <ActionButton
                  onClick={() => {
                    if (inputMessage.trim()) {
                      handleSendMessage(inputMessage);
                    }
                  }}
                  disabled={
                    isAnalyzing || 
                    isGenerating || 
                    !inputMessage.trim() || 
                    connectionStatus.retrying
                  }
                  sx={{
                    flex: 1,
                    maxWidth: '200px',
                    padding: '8px 16px',
                    minHeight: '36px'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {connectionStatus.retrying ? (
                      <CircularProgress size={16} sx={{ color: 'inherit' }} />
                    ) : (
                      <Send size={16} />
                    )}
                    <Typography variant="body2">
                      {connectionStatus.retrying ? 'Waiting...' : 'Send Message'}
                    </Typography>
                  </Box>
                </ActionButton>
              )}
              
              {/* Scroll Control Buttons beside Send button */}
              <Box sx={{ 
                display: 'flex', 
                gap: 0.5,
                flexShrink: 0
              }}>
                <Tooltip title="Scroll to top">
                  <MuiIconButton 
                    onClick={scrollToTop} 
                    size="small"
                    sx={{ 
                      color: theme.colors.textSecondary,
                      '&:hover': {
                        color: theme.colors.primary,
                        backgroundColor: theme.colors.surfaceHover
                      }
                    }}
                  >
                    <ChevronUp size={18} />
                  </MuiIconButton>
                </Tooltip>
                <Tooltip title="Scroll to bottom">
                  <MuiIconButton 
                    onClick={scrollToBottom} 
                    size="small"
                    sx={{ 
                      color: theme.colors.textSecondary,
                      '&:hover': {
                        color: theme.colors.primary,
                        backgroundColor: theme.colors.surfaceHover
                      }
                    }}
                  >
                    <ChevronDown size={18} />
                  </MuiIconButton>
                </Tooltip>
              </Box>
            </Box>
          </InputContainer>
        </>
      ) : activePanel === 'context' ? (
        <CustomContextPanel
          embedded={true}
          open={true}
          onClose={() => {
            // Restore scroll position when returning to chat
            setActivePanel('chat');
            
            // Clear any existing timeout to prevent conflicts
            if (restoreScrollTimeoutRef.current) {
              clearTimeout(restoreScrollTimeoutRef.current);
            }
            
            // Restore scroll position after component mounts
            restoreScrollTimeoutRef.current = setTimeout(() => {
              if (textAreaRef.current) {
                textAreaRef.current.scrollTop = savedScrollPosition;
                setIsAtBottom(savedIsAtBottom);
                setShowLatestButton(savedShowLatestButton);
              }
            }, 50); // Small delay to ensure DOM is ready
          }}
          onDiagramGenerated={onDiagramGenerated}
          onSaveConfirmation={handleSaveConfirmation}
        />
      ) : (
        <ThreatIntelPanel
          embedded={true}
          open={true}
          onClose={() => {
            // Restore scroll position when returning to chat
            setActivePanel('chat');

            // Clear any existing timeout to prevent conflicts
            if (restoreScrollTimeoutRef.current) {
              clearTimeout(restoreScrollTimeoutRef.current);
            }

            // Restore scroll position after component mounts
            restoreScrollTimeoutRef.current = setTimeout(() => {
              if (textAreaRef.current) {
                textAreaRef.current.scrollTop = savedScrollPosition;
                setIsAtBottom(savedIsAtBottom);
                setShowLatestButton(savedShowLatestButton);
              }
            }, 50); // Small delay to ensure DOM is ready
          }}
        />
      )}

      {/* Save Confirmation Dialog */}
      <SaveConfirmationDialog
        open={showSaveDialog}
        onClose={handleSaveDialogCancel}
        onSave={handleSaveDialogSave}
        onSkip={handleSaveDialogSkip}
        onAppend={handleSaveDialogAppend}
        hasUnsavedChanges={true} // You may want to implement actual unsaved changes detection
        currentFileName={undefined} // You may want to pass actual filename if available
        showAppendOption={true} // Always show append option for incremental building
      />
    </PanelContainer>
  );
});

AnalysisPanel.displayName = 'AnalysisPanel';

export default AnalysisPanel;
