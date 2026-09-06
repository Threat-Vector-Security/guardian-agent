//analysis chat
import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import { 
  Box, 
  Button, 
  TextField, 
  CircularProgress,
  IconButton,
  Tooltip,
  Drawer,
  useTheme,
  Snackbar,
  Alert,
  Typography
} from '@mui/material';
import { ChevronRight, ChevronLeft, ChevronDown } from 'lucide-react';
import DOMPurify from 'dompurify';
import { ChatMessage, MessageType } from '../types/ChatTypes';
import { useSettings } from '../settings/SettingsContext';
import { chatWithStreaming } from '../services/AIRequestService';
import { styled } from '@mui/material/styles';

import { isVercelDeployment } from '../utils/vercelDetection';

interface AnalysisChatProps {
  isAnalyzing: boolean;
  messages: ChatMessage[];
  onSendMessage: (message: string) => Promise<void>;  // Changed to expect string
  onRequestAnalysis: () => Promise<void>;
  analysisContext?: any; // Add context for streaming
}

const Message = styled(Box)<{ type: MessageType }>(({ type, theme }) => {
  const isUserMessage = type === 'question';
  
  return {
    p: 2,
    maxWidth: '85%',
    alignSelf: isUserMessage ? 'flex-end' : 'flex-start',
    bgcolor: isUserMessage ? theme.colors.primary : theme.colors.surface,
    color: theme.colors.textPrimary,
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
    position: 'relative',
    '& .timestamp': {
      fontSize: '0.75rem',
      color: isUserMessage ? 'rgba(255,255,255,0.7)' : theme.colors.textSecondary,
      marginTop: '4px'
    }
  };
});

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

// Memoized message component to prevent unnecessary re-renders
const MessageContent = memo(({ 
  msg, 
  isStreaming, 
  streamingId,
  streamingMessageRef,
  settings 
}: { 
  msg: ChatMessage; 
  isStreaming: boolean;
  streamingId: string | null;
  streamingMessageRef: React.MutableRefObject<HTMLDivElement | null>;
  settings: any;
}) => {
  const theme = useTheme();
  
  // Function to convert markdown to HTML for better formatting
  const convertMarkdownToHtml = (text: string): string => {
    if (!text || typeof text !== 'string') return text;
    
    return text
      // Convert headers to HTML
      .replace(/^#{1,6}\s*\*\*(.*?)\*\*\s*$/gm, '<h3 style="margin: 8px 0; font-weight: 600;">$1</h3>')
      .replace(/^#{1,6}\s*(.*?)$/gm, '<h3 style="margin: 8px 0; font-weight: 600;">$1</h3>')
      
      // Convert bold and italic to HTML
      .replace(/\*\*\*(.*?)\*\*\*/g, '<b><i>$1</i></b>') // ***bold italic***
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // **bold**
      .replace(/\*(.*?)\*/g, '<i>$1</i>') // *italic*
      
      // Convert bullet points
      .replace(/^[\s]*[-*+]\s*/gm, '• ')
      
      // Convert line breaks to HTML
      .replace(/\n/g, '<br/>');
  };
  
  // Check if we should use HTML formatting (you can make this a setting)
  const useHtmlFormatting = false; // Set to true to enable HTML formatting
  
  const messageContent = useHtmlFormatting 
    ? convertMarkdownToHtml(msg.content)
    : msg.content;
  
  return (
    <Message type={msg.type}>
      <Box 
        ref={msg.id === streamingId ? streamingMessageRef : null}
        sx={{ 
          whiteSpace: 'pre-wrap', 
          wordBreak: 'break-word',
          minHeight: 'auto'
        }}
      >
        {useHtmlFormatting ? (
          <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(messageContent as string) }} />
        ) : (
          messageContent
        )}
      </Box>
      <Box className="timestamp" sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <span>
          {msg.timestamp instanceof Date 
            ? msg.timestamp.toLocaleTimeString()
            : new Date(msg.timestamp).toLocaleTimeString()}
        </span>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.7rem', opacity: 0.8 }}>
          {(msg.type === 'response' || msg.type === 'analysis' || msg.type === 'assistant') && (
            <span style={{ 
              backgroundColor: 'rgba(0,122,204,0.1)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '0.65rem',
              fontWeight: 500
            }}>
              {(() => {
                // Provider/model details are diagnostics — plain "AI" unless
                // the debug panel is enabled (v2 plan: hide the AI plumbing).
                if (!(settings?.debugPanelEnabled ?? false)) {
                  return 'AI';
                }

                const responseMetadata = msg.metadata as any;
                const provider = responseMetadata?.provider;
                const model = responseMetadata?.model;

                if (provider) {
                  const formattedProvider = provider.charAt(0).toUpperCase() + provider.slice(1);
                  let providerText = model ? `${formattedProvider} (${model})` : formattedProvider;
                  return providerText;
                }

                // Fallback for older messages or different structures
                if (settings?.api?.llmMode === 'local') {
                  return 'Local LLM';
                }
                if (settings?.api?.provider) {
                  return settings.api.provider.charAt(0).toUpperCase() + settings.api.provider.slice(1);
                }

                return 'AI';
              })()}
            </span>
          )}
          {msg.tokenInfo && (settings?.debugPanelEnabled ?? false) && (
            <span>
              {msg.type === 'question' && msg.tokenInfo.promptTokens &&
                `${msg.tokenInfo.promptTokens} tokens`}
              {msg.type === 'response' && msg.tokenInfo.responseTokens &&
                `${msg.tokenInfo.responseTokens} tokens`}
            </span>
          )}
        </Box>
      </Box>
    </Message>
  );
});

const AnalysisChat: React.FC<AnalysisChatProps> = ({ 
  isAnalyzing, 
  onSendMessage, 
  onRequestAnalysis, 
  messages,
  analysisContext 
}) => {
  const theme = useTheme();
  const [inputMessage, setInputMessage] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isMessageSending, setIsMessageSending] = useState(false);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>(messages || []);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showLatestButton, setShowLatestButton] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const { settings } = useSettings();
  const [currentStreamingId, setCurrentStreamingId] = useState<string | null>(null);
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null);
  const [streamingEndTime, setStreamingEndTime] = useState<number | null>(null);
  const [disableAnimations, setDisableAnimations] = useState(false);
  const [sanitizationNotice, setSanitizationNotice] = useState<{type:string;count:number}[]|null>(null);
  const [apiKeyError, setApiKeyError] = useState<{message: string; provider: string} | null>(null);
  const [userWasAtBottomWhenStreamingStarted, setUserWasAtBottomWhenStreamingStarted] = useState(true);
  const [userHasManuallyScrolled, setUserHasManuallyScrolled] = useState(false);

  // Listen for sanitization events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {type:string;count:number}[];
      if (settings.sanitization?.showNotices === false) return;
      console.log('Sanitization notice event:', detail);
      const summary = detail.map((d:any)=>`${d.type}: ${d.count}`).join(', ');
      // push a system message into chat history for visibility
      const noticeMsg: ChatMessage = {
        id: `san_${Date.now()}`,
        content: `Sensitive data was redacted (${summary}). Consider removing it from the diagram or custom context.`,
        type: 'system',
        timestamp: new Date()
      } as any;
      // Only show toast; avoid adding system msg which can be overwritten by parent re-render
      setSanitizationNotice(detail);
    };
    window.addEventListener('sanitization-notice', handler as any);
    return () => window.removeEventListener('sanitization-notice', handler as any);
  }, [settings.sanitization?.showNotices]);
  
  // 📌 Last AI message metadata for header badges
  const lastAIMessageMetadata = useMemo(() => {
    console.log('🐛 All messages:', localMessages.map(m => ({ id: m.id, type: m.type, hasMetadata: !!m.metadata })));
    const lastAi = [...localMessages].reverse().find(m => ['response','assistant','analysis'].includes(m.type));
    console.log('🐛 Last AI message:', lastAi);
    console.log('🐛 Last AI metadata:', lastAi?.metadata);
    return lastAi?.metadata as any;
  }, [localMessages]);
  
  // const messagesEndRef = useRef<HTMLDivElement>(null); // Not currently used
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // const lastScrollPositionRef = useRef<number>(0); // Not currently used
  const tokenBufferRef = useRef<string[]>([]);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamingContentRef = useRef<string>('');
  const streamingMessageRef = useRef<HTMLDivElement | null>(null);
  const [streamingStatus, setStreamingStatus] = useState<{
    status: 'connecting' | 'waiting' | 'generating' | null;
    tokensPerSecond?: number;
    tokenCount?: number;
    startTime?: number;
    firstTokenTime?: number;
  }>({ status: null });
  const performanceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update local messages when prop changes
  useEffect(() => {
    setLocalMessages(messages || []);
  }, [messages]);

  // Disable animations during streaming
  useEffect(() => {
    if (isStreaming) {
      // Add a global class to disable animations
      document.body.classList.add('streaming-active');
      setDisableAnimations(true);
    } else {
      // Remove after a delay to prevent immediate re-animation
      const timeout = setTimeout(() => {
        document.body.classList.remove('streaming-active');
        setDisableAnimations(false);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isStreaming]);

  // Smooth scrolling function with debouncing
  const smoothScrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce scrolling to prevent jitter
    scrollTimeoutRef.current = setTimeout(() => {
      const { scrollHeight, clientHeight, scrollTop } = container;
      const targetScroll = scrollHeight - clientHeight;
      
      // Only scroll if we're not already at the target position
      if (Math.abs(targetScroll - scrollTop) > 1) {
        // Use auto scrolling during streaming to reduce visual jumps
        container.scrollTo({
          top: targetScroll,
          behavior: isStreaming ? 'auto' : 'smooth'
        });
      }
    }, isStreaming ? 200 : 50); // Much longer debounce during streaming
  }, [isStreaming]);

  // Process buffered tokens at a controlled rate
  const processTokenBuffer = useCallback((streamingId: string) => {
    if (tokenBufferRef.current.length === 0) {
      // No more tokens to process, clear the interval
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      return;
    }

    // Check for status messages first
    const allTokens = tokenBufferRef.current.join('');
    const statusMatch = allTokens.match(/\[STATUS:([^\]]+)\]/);
    
    if (statusMatch) {
      const statusMessage = statusMatch[1];
      const statusIndex = allTokens.indexOf(statusMatch[0]);
      
      // Process tokens before the status message
      if (statusIndex > 0) {
        const beforeStatus = allTokens.substring(0, statusIndex);
        streamingContentRef.current += beforeStatus;
      }
      
      // Update status based on message
      if (statusMessage === 'CONNECTING_OLLAMA') {
        setStreamingStatus(prev => ({ 
          ...prev, 
          status: 'connecting',
          startTime: Date.now()
        }));
      } else if (statusMessage === 'WAITING_FOR_MODEL') {
        setStreamingStatus(prev => ({ ...prev, status: 'waiting' }));
      } else if (statusMessage === 'MODEL_RESPONDING') {
        setStreamingStatus(prev => ({ 
          ...prev, 
          status: 'generating',
          firstTokenTime: Date.now(),
          tokenCount: 0
        }));
        
        // Start performance tracking
        if (!performanceIntervalRef.current) {
          performanceIntervalRef.current = setInterval(() => {
            setStreamingStatus(prev => {
              if (prev.firstTokenTime && prev.tokenCount) {
                const elapsedSeconds = (Date.now() - prev.firstTokenTime) / 1000;
                const tokensPerSecond = prev.tokenCount / elapsedSeconds;
                return { ...prev, tokensPerSecond: Math.round(tokensPerSecond * 10) / 10 };
              }
              return prev;
            });
          }, 1000);
        }
      }
      
      // Remove the status message from buffer and continue with remaining tokens
      const afterStatus = allTokens.substring(statusIndex + statusMatch[0].length);
      tokenBufferRef.current = afterStatus ? [afterStatus] : [];
      return;
    }

    // Process a small batch of tokens for smoother updates
    // Adjust this value to control text appearance speed (lower = slower)
    const TOKENS_PER_UPDATE = 3; // Process 3 tokens at a time to reduce update frequency
    const tokensToProcess = Math.min(TOKENS_PER_UPDATE, tokenBufferRef.current.length);
    const tokens = tokenBufferRef.current.splice(0, tokensToProcess);
    const processedText = tokens.join('');
    streamingContentRef.current += processedText;
    
    // Update token count for performance tracking
    if (streamingStatus.status === 'generating') {
      setStreamingStatus(prev => ({ 
        ...prev, 
        tokenCount: (prev.tokenCount || 0) + processedText.length 
      }));
    }
    
    console.log('Processing tokens:', tokensToProcess, 'Remaining in buffer:', tokenBufferRef.current.length);

    // Update DOM directly to avoid React re-render and scroll jumps
    if (streamingMessageRef.current) {
      streamingMessageRef.current.textContent = streamingContentRef.current;
    } else {
      // Fallback to state update if ref not available
      setLocalMessages(prev => 
        prev.map(msg => 
          msg.id === streamingId 
            ? { ...msg, content: streamingContentRef.current }
            : msg
        )
      );
    }

    // Only auto-scroll if user was at bottom when streaming started and hasn't manually scrolled
    // Auto-scroll continues until user actively interacts with scrolling
    if (userWasAtBottomWhenStreamingStarted && !userHasManuallyScrolled && isStreaming) {
      // Use requestAnimationFrame for smooth scrolling that doesn't interfere with rendering
      requestAnimationFrame(() => {
        const container = messagesContainerRef.current;
        if (container) {
          const { scrollHeight, clientHeight } = container;
          container.scrollTop = scrollHeight - clientHeight;
        }
      });
    }
  }, [isAtBottom, smoothScrollToBottom, streamingEndTime, userWasAtBottomWhenStreamingStarted, userHasManuallyScrolled, isStreaming]);

  // Check if user is at bottom when messages change
  useEffect(() => {
    const checkScrollPosition = () => {
      const container = messagesContainerRef.current;
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const atBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 5;
      setIsAtBottom(atBottom);

      // Don't auto-scroll during streaming - let user control their position
    };

    // Check immediately when messages change, but not during active streaming
    if (localMessages.length > 0 && !isStreaming) {
      // Small delay to ensure DOM has updated with new content
      setTimeout(checkScrollPosition, 10);
    }
  }, [localMessages, isStreaming, streamingEndTime]);

  // Handle user-initiated scroll interactions
  const handleUserScrollInteraction = useCallback(() => {
    if (isStreaming) {
      console.log('User manually scrolled during streaming - disabling auto-scroll');
      setUserHasManuallyScrolled(true);
      setUserWasAtBottomWhenStreamingStarted(false);
      setShowLatestButton(true);
    }
  }, [isStreaming]);

  // Scroll detection to track if user is at bottom (only for position tracking)
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
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
        setUserWasAtBottomWhenStreamingStarted(true);
        setShowLatestButton(false);
      }
      return;
    }
    
    // Normal behavior when not streaming
    const now = Date.now();
    const streamingRecentlyEnded = streamingEndTime && (now - streamingEndTime) < 5000;
    
    if (streamingRecentlyEnded) {
      // Don't show Latest button for 5 seconds after streaming ends
      if (showLatestButton) {
        setShowLatestButton(false);
      }
      return;
    }
    
    // Hide latest button when user scrolls to bottom
    if (atBottom) {
      setShowLatestButton(false);
    }
    
    // Show latest button when user scrolls away from bottom
    if (!atBottom && localMessages.length > 0) {
      setShowLatestButton(true);
    }
  }, [isStreaming, localMessages.length, streamingEndTime, userHasManuallyScrolled, showLatestButton]);

  // Add scroll and user interaction listeners
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Handle user-initiated scroll events
    const handleWheel = (e: WheelEvent) => {
      handleUserScrollInteraction();
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Only trigger if clicking in the scrollbar area (right side of container)
      const rect = container.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const scrollbarWidth = container.offsetWidth - container.clientWidth;
      
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

    const handleUserScrollEvent = (e: Event) => {
      // Handle custom userScroll events (e.g., from scroll buttons)
      handleUserScrollInteraction();
    };

    // Add all event listeners
    container.addEventListener('scroll', handleScroll);
    container.addEventListener('wheel', handleWheel, { passive: true });
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('keydown', handleKeyDown);
    container.addEventListener('userScroll', handleUserScrollEvent);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('userScroll', handleUserScrollEvent);
    };
  }, [handleScroll, handleUserScrollInteraction]);

  // Cleanup streaming on unmount
  useEffect(() => {
    return () => {
      if (currentStreamingId) {
        setCurrentStreamingId(null);
      }
      if (currentAbortController) {
        currentAbortController.abort();
        setCurrentAbortController(null);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      // Clear token buffer
      tokenBufferRef.current = [];
      streamingContentRef.current = '';
      streamingMessageRef.current = null;
    };
  }, [currentStreamingId, currentAbortController]);

  // Scroll to bottom function (for manual triggers like Latest button)
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const { scrollHeight, clientHeight } = messagesContainerRef.current;
      messagesContainerRef.current.scrollTo({ 
        top: scrollHeight - clientHeight, 
        behavior: 'smooth' 
      });
      setShowLatestButton(false);
    }
  };

  const addMessage = (message: ChatMessage) => {
    setLocalMessages(prev => [...prev, message]);
  };

  const removeMessage = (messageId: string) => {
    if (!messageId) return; // Guard against undefined messageId
    setLocalMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  const cancelCurrentRequest = async () => {
    const streamingIdToCancel = currentStreamingId;
    const controllerToAbort = currentAbortController;
    
    // Clear the update interval
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
    
    // Process any remaining tokens before cancelling
    if (tokenBufferRef.current.length > 0) {
      const remainingTokens = tokenBufferRef.current.splice(0, tokenBufferRef.current.length);
      streamingContentRef.current += remainingTokens.join('');
    }
    
    // Reset states immediately to unblock UI
    setCurrentStreamingId(null);
    setCurrentAbortController(null);
    setIsMessageSending(false);
    setIsStreaming(false);
    setStreamingEndTime(Date.now()); // Set end time when cancelling
    setUserWasAtBottomWhenStreamingStarted(true); // Reset auto-scroll tracking
    setUserHasManuallyScrolled(false);
    
    // Clear buffers
    tokenBufferRef.current = [];
    streamingContentRef.current = '';
    streamingMessageRef.current = null;
    
    if (streamingIdToCancel) {
      // Keep the partial response but mark it as cancelled
      // Do this BEFORE any server calls to preserve content immediately
      setLocalMessages(prev => {
        const messageToUpdate = prev.find(msg => msg.id === streamingIdToCancel);
        if (!messageToUpdate) {
          console.warn('Message to cancel not found:', streamingIdToCancel);
          return prev;
        }
        
        const currentContent = streamingContentRef.current || messageToUpdate.content || '';
        
        return prev.map(msg => {
          if (msg.id === streamingIdToCancel) {
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
      });
      
      try {
        // Cancel the AbortController first if available
        if (controllerToAbort) {
          controllerToAbort.abort();
        }
        
        // The shared AI request owns backend cancellation through its AbortSignal.
      } catch (error) {
        console.error('Failed to cancel request:', error);
      }
      
      // Only remove loading indicators, keep the partial message
      removeMessage(`loading-${streamingIdToCancel}`);
    }
  };

  // Helper function to detect and handle API key/quota errors
  const handleAPIError = (error: any) => {
    const errorMessage = error.message || error.toString();
    const lowerMsg = errorMessage.toLowerCase();
    
    // Check for quota/API key related errors
    if (lowerMsg.includes('quota_error:') || 
        lowerMsg.includes('quota exceeded') || 
        lowerMsg.includes('api key') ||
        lowerMsg.includes('invalid') ||
        lowerMsg.includes('authentication') ||
        lowerMsg.includes('billing') ||
        lowerMsg.includes('credits')) {
      
      // Extract provider from error or use current provider
      let provider = 'AI provider';
      if (lowerMsg.includes('openai')) provider = 'OpenAI';
      else if (lowerMsg.includes('anthropic')) provider = 'Anthropic';
      else if (lowerMsg.includes('gemini')) provider = 'Gemini';
      else if (settings.api?.provider) {
        provider = settings.api.provider.charAt(0).toUpperCase() + settings.api.provider.slice(1);
      }
      
      // Set API key error notification
      setApiKeyError({
        message: errorMessage.replace(/^(QUOTA_ERROR:|RATE_LIMIT_ERROR:|MODEL_ERROR:)\s*/, ''),
        provider
      });
      
      // Auto-hide after 10 seconds
      setTimeout(() => {
        setApiKeyError(null);
      }, 10000);
      
      // Add system message to chat
      const errorId = `api-error-${Date.now()}`;
      addMessage({
        id: errorId,
        type: 'error',
        content: `🔑 **${provider} API Issue**\n\n${errorMessage.replace(/^(QUOTA_ERROR:|RATE_LIMIT_ERROR:|MODEL_ERROR:)\s*/, '')}\n\n💡 **What to do:**\n• Open Settings (⚙️) → General tab\n• Check your API key and billing status\n• Verify your ${provider} account has available credits\n• Consider switching to Local LLM mode if you have Ollama installed`,
        timestamp: new Date()
      });
      
      return true; // Indicates this was an API key error
    }
    
    return false; // Not an API key error
  };

  const handleSend = async () => {
    if (!inputMessage.trim() || isMessageSending) return;
    
    // Cancel any current streaming request
    if (currentStreamingId) {
      await cancelCurrentRequest();
      // Wait a brief moment for the cancellation to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Reset state for new request
    setIsMessageSending(true);
    
    const messageId = `msg-${Date.now()}`;
    const loadingId = `loading-${messageId}`;
    const streamingId = `streaming-${messageId}`;
    
    try {
      // Add user message immediately
      addMessage({
        id: messageId,
        type: 'question',
        content: inputMessage,
        timestamp: new Date()
      });

      // Clear input
      const messageToSend = inputMessage;
      setInputMessage('');
      
      if (settings.responseMode === 'streaming') {
        // Streaming mode
        setCurrentStreamingId(streamingId);
        setIsStreaming(true);
        setStreamingEndTime(null); // Clear any previous end time
        
        // Capture user's scroll position when streaming starts
        const wasAtBottomWhenStarting = isAtBottom;
        setUserWasAtBottomWhenStreamingStarted(wasAtBottomWhenStarting);
        
        // Reset manual scroll tracking for new streaming session
        setUserHasManuallyScrolled(false);
        
        // If user is not at bottom when streaming starts, show Latest button immediately
        // If they are at bottom, hide it and allow auto-scrolling
        setShowLatestButton(!wasAtBottomWhenStarting);
        
        // Reset token buffer and streaming content
        tokenBufferRef.current = [];
        streamingContentRef.current = '';
        streamingMessageRef.current = null; // Reset ref
        
        // Add streaming message placeholder
        addMessage({
          id: streamingId,
          type: 'response',
          content: '',
          timestamp: new Date()
        });
        
        try {
          // Create abort controller for cancellation
          const controller = new AbortController();
          setCurrentAbortController(controller);
          
          // Listen for cancellation to handle cleanup
          controller.signal.addEventListener('abort', () => {
            console.log('Streaming request aborted by user');
          });
          
          // Use the proper streaming function with context
          await chatWithStreaming(
            messageToSend,
            analysisContext || {
              diagram: null,
              messageHistory: localMessages,
              customContext: null,
              drawings: [],
              threatIntel: null
            },
            // onToken callback
            (token: string) => {
              // Check if request was cancelled before processing token
              if (controller.signal.aborted) {
                return;
              }
              
              // Add tokens to buffer without splitting them
              // This prevents too many small updates
              tokenBufferRef.current.push(token);
              console.log('Token added to buffer:', token, 'Buffer size:', tokenBufferRef.current.length);
              
              // Start update interval if not already running
              if (!updateIntervalRef.current) {
                // Process tokens at a controlled rate for smooth updates
                const UPDATE_INTERVAL = 100; // Slower interval - only update every 100ms
                
                updateIntervalRef.current = setInterval(() => {
                  processTokenBuffer(streamingId);
                }, UPDATE_INTERVAL);
                
                // Don't process immediately - let the interval handle it
              }
            },
            // onComplete callback
            (response) => {
              // Check if request was cancelled before completing
              if (controller.signal.aborted) {
                return;
              }
              
              // Clear the update interval
              if (updateIntervalRef.current) {
                clearInterval(updateIntervalRef.current);
                updateIntervalRef.current = null;
              }
              
              // Process any remaining tokens in the buffer
              while (tokenBufferRef.current.length > 0) {
                const remainingTokens = tokenBufferRef.current.splice(0, tokenBufferRef.current.length);
                streamingContentRef.current += remainingTokens.join('');
              }
              
              // Update final message with complete content and metadata
              setLocalMessages(prev => 
                prev.map(msg => 
                  msg.id === streamingId 
                    ? { 
                        ...msg, 
                        content: streamingContentRef.current,
                        metadata: response.metadata 
                      }
                    : msg
                )
              );
              
              // Reset refs
              tokenBufferRef.current = [];
              streamingContentRef.current = '';
              streamingMessageRef.current = null;
              
              setCurrentStreamingId(null);
              setCurrentAbortController(null);
              setIsMessageSending(false);
              setIsStreaming(false);
              setStreamingEndTime(Date.now());
              
              // Clear performance tracking
              if (performanceIntervalRef.current) {
                clearInterval(performanceIntervalRef.current);
                performanceIntervalRef.current = null;
              }
              setStreamingStatus({ status: null });
              
              // Reset the auto-scroll tracking
              setUserWasAtBottomWhenStreamingStarted(true);
              setUserHasManuallyScrolled(false);
              
              // Check current scroll position and update Latest button accordingly
              setTimeout(() => {
                const container = messagesContainerRef.current;
                if (container) {
                  const { scrollTop, scrollHeight, clientHeight } = container;
                  const atBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 5;
                  setIsAtBottom(atBottom);
                  if (!atBottom) {
                    setShowLatestButton(true);
                  } else {
                    setShowLatestButton(false);
                  }
                }
              }, 100); // Shorter delay, just enough for DOM to update
            },
            // Signal for cancellation
            controller.signal
          );
          
        } catch (streamError) {
          console.error('=== STREAMING ERROR ===', streamError);
          
          // Handle AbortError differently - it means user cancelled
          if (streamError instanceof Error && streamError.name === 'AbortError') {
            console.log('=== ABORT ERROR - NOT RESETTING STATES ===');
            // Don't show error message for user-initiated cancellation
            // The cancelCurrentRequest function already handled the message update
            // Don't reset states here as cancelCurrentRequest already did it
          } else {
            console.log('=== ACTUAL ERROR - RESETTING STATES ===');
            
            // Check if it's an API key/quota error first
            const isAPIError = handleAPIError(streamError);
            
            if (!isAPIError) {
              // Show error message for non-API errors
              const errorMessage = streamError instanceof Error ? streamError.message : 'Failed to fetch';
              addMessage({
                id: `${streamingId}-error`,
                type: 'error',
                content: `Streaming Error: ${errorMessage}`,
                timestamp: new Date()
              });
              
              // Check if it's a network error and trigger reconnection
              if (errorMessage.toLowerCase().includes('network') || 
                  errorMessage.toLowerCase().includes('fetch') ||
                  errorMessage.toLowerCase().includes('connection')) {
                import('../services/ConnectionManager').then(({ default: ConnectionManager }) => {
                  ConnectionManager.getInstance().handleConnectionError(streamError instanceof Error ? streamError : new Error(errorMessage));
                });
              }
            }
            
            // Only remove the streaming message if it's an actual error (not cancellation)
            removeMessage(streamingId);
            
            // Only reset states for actual errors, not for user cancellation
            setCurrentStreamingId(null);
            setCurrentAbortController(null);
            setIsMessageSending(false);
            setIsStreaming(false);
            setUserWasAtBottomWhenStreamingStarted(true);
            setUserHasManuallyScrolled(false);
          }
        }
        
      } else {
        // Non-streaming mode (original behavior)
        addMessage({
          id: loadingId,
          type: 'loading',
          content: 'Generating response...',
          isLoading: true,
          timestamp: new Date()
        });
        
        // Capture scroll position before sending message
        const wasAtBottom = isAtBottom;
        
        // Send message and wait for complete response
        await onSendMessage(messageToSend);
        
        // Remove loading message after response is received
        removeMessage(loadingId);
        setIsMessageSending(false);
        
        // Show Latest button if user was not at bottom when the response arrived
        if (!wasAtBottom) {
          setTimeout(() => {
            setShowLatestButton(true);
          }, 100);
        }
      }
      
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Clean up any streaming state
      if (currentStreamingId) {
        removeMessage(currentStreamingId);
        setCurrentStreamingId(null);
        setCurrentAbortController(null);
        setIsStreaming(false);
        setUserWasAtBottomWhenStreamingStarted(true);
        setUserHasManuallyScrolled(false);
      }
      
      // Check if it's an API key/quota error first
      const isAPIError = handleAPIError(error);
      
      if (!isAPIError) {
        // Add error message for non-API errors
        addMessage({
          id: `${messageId}-error`,
          type: 'error',
          content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
          timestamp: new Date()
        });
      }
      
      setIsMessageSending(false);
    }
  };

  return (
    <>
      <Drawer
        variant="permanent"
        anchor="right"
        open={isPanelOpen}
        sx={{
          width: isPanelOpen ? 400 : 48,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: isPanelOpen ? 400 : 48,
            boxSizing: 'border-box',
            bgcolor: theme.colors.surface,
            border: 'none',
            borderLeft: `1px solid ${theme.colors.border}`,
            transition: 'width 0.3s ease-in-out',
            overflow: 'visible' // Allow the toggle button to be visible when collapsed
          },
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%',
          position: 'relative',
          overflow: 'hidden' // Prevent parent from expanding
        }}>
          {/* Collapsed state toggle - visible when panel is closed */}
          {!isPanelOpen && (
            <Box
              sx={{
                position: 'absolute',
                left: -40, // Position outside the drawer
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 1001,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}
            >
              <Box
                onClick={() => setIsPanelOpen(true)}
                sx={{
                  backgroundColor: theme.colors.surface,
                  border: `1px solid ${theme.colors.border}`,
                  borderRight: 'none',
                  borderRadius: '8px 0 0 8px',
                  padding: '12px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  minHeight: '80px',
                  '&:hover': {
                    backgroundColor: theme.colors.surfaceHover,
                    transform: 'translateX(-2px)',
                    transition: 'all 0.2s ease'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                <ChevronLeft 
                  size={20} 
                  style={{ 
                    color: theme.colors.textPrimary,
                    transform: 'rotate(180deg)' // Point right to indicate opening
                  }} 
                />
                <Box
                  sx={{
                    writingMode: 'vertical-lr',
                    textOrientation: 'mixed',
                    fontSize: '0.75rem',
                    color: theme.colors.textPrimary,
                    fontWeight: 500,
                    letterSpacing: '1px'
                  }}
                >
                  CHAT
                </Box>
              </Box>
            </Box>
          )}

          {/* Header with toggle - visible when panel is open */}
          {isPanelOpen && (
            <Box sx={{ 
              p: 1, 
              borderBottom: `1px solid ${theme.colors.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              <IconButton
                onClick={() => setIsPanelOpen(false)}
                sx={{ 
                  color: theme.colors.textPrimary,
                  '&:hover': {
                    backgroundColor: theme.colors.surfaceHover
                  }
                }}
              >
                <ChevronRight />
              </IconButton>
              <Box sx={{ color: theme.colors.textPrimary, fontWeight: 500 }}>
                Security Analysis
              </Box>
              
              {/* Provider / Swarms badges - DEBUG: Always show */}
              {(() => { console.log('🐛 Rendering badges section'); return true; })() && (
                <Box sx={{ 
                  ml: 'auto', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  fontSize: '0.75rem',
                  color: theme.colors.textSecondary
                }}>
                  {/* Model name */}
                  <Box sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                    {lastAIMessageMetadata?.model || 
                     (lastAIMessageMetadata?.provider === 'local' ? 'Local LLM' : lastAIMessageMetadata?.provider || 'DEBUG')}
                  </Box>
                  
                </Box>
              )}
            </Box>
          )}

          {/* Status bar + Messages area */}
          {isPanelOpen && (
            <Box sx={{ 
              flex: '1 1 auto', 
              display: 'flex', 
              flexDirection: 'column', 
              position: 'relative',
              minHeight: 0,
            }}>

              <Box 
                ref={messagesContainerRef}
                sx={{ 
                  flex: '1 1 auto',
                  minHeight: 0, // Prevent flex from expanding beyond parent
                  overflowX: 'hidden',
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  // Enable smooth scrolling behavior only when not streaming
                  scrollBehavior: isStreaming ? 'auto' : 'smooth',
                  // Disable scroll anchoring to prevent auto-scroll behavior
                  overflowAnchor: 'none',
                  // Add will-change hint for better performance
                  willChange: 'scroll-position',
                  // Prevent content jumping by maintaining stable scroll position
                  '& > *': {
                    // Ensure consistent spacing for messages
                    flexShrink: 0,
                  },
                  // Force scrollbar to always be visible to prevent layout shifts
                  overflowY: 'scroll', // Changed from 'auto' to 'scroll'
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
                  // Ensure scrollbar is always visible and interactive
                  scrollbarWidth: 'thin',
                  scrollbarColor: `${theme.colors.border} ${theme.colors.background}`,
                }}
              >
                {/* Streaming Status Display */}
                {streamingStatus.status && (
                  <Box
                    sx={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 10,
                      backgroundColor: theme.colors.background,
                      borderBottom: `1px solid ${theme.colors.border}`,
                      padding: theme.spacing(1.5),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backdropFilter: 'blur(10px)',
                      background: `${theme.colors.background}ee`,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {streamingStatus.status === 'connecting' && (
                        <>
                          <CircularProgress size={16} sx={{ color: theme.colors.warning }} />
                          <Typography variant="body2" sx={{ color: theme.colors.textSecondary }}>
                            Connecting to Ollama...
                          </Typography>
                        </>
                      )}
                      {streamingStatus.status === 'waiting' && (
                        <>
                          <CircularProgress size={16} sx={{ color: theme.colors.info }} />
                          <Typography variant="body2" sx={{ color: theme.colors.textSecondary }}>
                            Loading model...
                          </Typography>
                        </>
                      )}
                      {streamingStatus.status === 'generating' && (
                        <>
                          <Box sx={{ 
                            width: 8, 
                            height: 8, 
                            borderRadius: '50%', 
                            bgcolor: theme.colors.success,
                            animation: 'streamingPulse 1.5s ease-in-out infinite'
                          }} />
                          <Typography variant="body2" sx={{ color: theme.colors.textPrimary }}>
                            Generating response
                          </Typography>
                        </>
                      )}
                    </Box>
                    
                    {streamingStatus.status === 'generating' && streamingStatus.tokensPerSecond && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="caption" sx={{ color: theme.colors.textSecondary }}>
                          {streamingStatus.tokensPerSecond} tokens/sec
                        </Typography>
                        {streamingStatus.firstTokenTime && streamingStatus.startTime && (
                          <Typography variant="caption" sx={{ color: theme.colors.textSecondary }}>
                            First token: {Math.round((streamingStatus.firstTokenTime - streamingStatus.startTime) / 100) / 10}s
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                )}
                
                {localMessages.map((msg) => (
                  <MessageContent
                    key={msg.id}
                    msg={msg}
                    isStreaming={isStreaming}
                    streamingId={currentStreamingId}
                    streamingMessageRef={streamingMessageRef}
                    settings={settings}
                  />
                ))}
              </Box>
              
              {/* Latest message button - absolutely positioned to avoid layout shifts */}
              {showLatestButton && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10,
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
            </Box>
          )}

          {/* Input area */}
          {isPanelOpen && (
            <Box sx={{ 
              p: 2, 
              borderTop: `1px solid ${theme.colors.border}`,
              bgcolor: theme.colors.surface,
              display: 'flex',
              flexDirection: 'column',
              gap: 1
            }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  multiline
                  maxRows={4}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type your message..."
                  disabled={isAnalyzing || isMessageSending || !!currentStreamingId}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: theme.colors.textPrimary,
                      bgcolor: theme.colors.surface,
                      '& fieldset': {
                        borderColor: theme.colors.border,
                      },
                      '&:hover fieldset': {
                        borderColor: theme.colors.primary,
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: theme.colors.primary,
                      },
                      '& textarea': {
                        overflowY: 'auto !important',
                        '&::-webkit-scrollbar': {
                          width: '8px',
                          display: 'none',
                        },
                        '&:hover::-webkit-scrollbar': {
                          display: 'block',
                        },
                        '&::-webkit-scrollbar-track': {
                          background: theme.colors.background,
                          borderRadius: '4px',
                        },
                        '&::-webkit-scrollbar-thumb': {
                          background: theme.colors.border,
                          borderRadius: '4px',
                          '&:hover': {
                            background: theme.colors.surfaceHover,
                          },
                        },
                      },
                    },
                  }}
                />
                {currentStreamingId ? (
                  <Tooltip title="Cancel streaming response">
                    <span>
                      <Button 
                        variant="outlined"
                        onClick={cancelCurrentRequest}
                        sx={{
                          color: theme.colors.error,
                          borderColor: theme.colors.error,
                          '&:hover': {
                            borderColor: theme.colors.error,
                            bgcolor: `${theme.colors.error}15`,
                          },
                        }}
                      >
                        Cancel
                      </Button>
                    </span>
                  </Tooltip>
                ) : (
                  <Tooltip title="Send message">
                    <span>
                      <Button 
                        variant="contained"
                        onClick={handleSend}
                        disabled={isAnalyzing || isMessageSending || !inputMessage.trim()}
                        sx={{
                          bgcolor: theme.colors.primary,
                          '&:hover': {
                            bgcolor: theme.colors.secondary,
                          },
                          '&.Mui-disabled': {
                            bgcolor: theme.colors.surface,
                            color: theme.colors.textSecondary,
                          },
                        }}
                      >
                        {isMessageSending ? (
                          <CircularProgress size={24} sx={{ color: theme.colors.textSecondary }} />
                        ) : (
                          'Send'
                        )}
                      </Button>
                    </span>
                  </Tooltip>
                )}
              </Box>
              <Tooltip title="Analyze the current diagram">
                <span>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={onRequestAnalysis}
                    disabled={isAnalyzing}
                    sx={{
                      color: theme.colors.textPrimary,
                      borderColor: theme.colors.border,
                      '&:hover': {
                        borderColor: theme.colors.primary,
                        bgcolor: 'rgba(0, 122, 204, 0.08)',
                      },
                      '&.Mui-disabled': {
                        borderColor: theme.colors.border,
                        color: theme.colors.textSecondary,
                      },
                    }}
                  >
                    {isAnalyzing ? (
                      <>
                        <CircularProgress size={20} sx={{ mr: 1, color: theme.colors.textPrimary }} />
                        Analyzing...
                      </>
                    ) : (
                      'Analyze Diagram'
                    )}
                  </Button>
                </span>
              </Tooltip>
            </Box>
          )}
        </Box>
      </Drawer>
      {sanitizationNotice && (
        <Snackbar
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          open={!!sanitizationNotice}
          autoHideDuration={8000}
          onClose={() => setSanitizationNotice(null)}
        >
          <Alert onClose={() => setSanitizationNotice(null)} severity="info" sx={{ width: '100%' }}>
            Sensitive data was redacted: {sanitizationNotice.map((i,idx)=>(`${i.type}: ${i.count}${idx<sanitizationNotice.length-1?', ':''}`))}
          </Alert>
        </Snackbar>
      )}
      
      {/* API Key Error Notification */}
      {apiKeyError && (
        <Snackbar
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          open={!!apiKeyError}
          autoHideDuration={10000}
          onClose={() => setApiKeyError(null)}
        >
          <Alert 
            onClose={() => setApiKeyError(null)} 
            severity="error" 
            sx={{ 
              width: '100%',
              maxWidth: '400px',
              '& .MuiAlert-message': {
                whiteSpace: 'pre-line' // Allow line breaks in the message
              }
            }}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                🔑 {apiKeyError.provider} API Issue
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {apiKeyError.message}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(0,0,0,0.6)' }}>
                💡 Check your API key and billing in Settings → General
              </Typography>
            </Box>
          </Alert>
        </Snackbar>
      )}
    </>
  );
};

export default AnalysisChat;
