import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Paper, Typography, IconButton, Collapse, Tooltip, Chip } from '@mui/material';
import { ChevronUp, ChevronDown, AlertCircle, Trash2, Bug, X } from 'lucide-react';
import { connectionManager, ConnectionStatus } from '../services/ConnectionManager';

interface DebugLog {
  timestamp: string;
  level: 'info' | 'error' | 'warn' | 'network' | 'ai';
  message: string;
  details?: any;
}

// Global debug logger instance
let debugLoggerInstance: ((level: DebugLog['level'], message: string, details?: any) => void) | null = null;

export const logToDebugPanel = (level: DebugLog['level'], message: string, details?: any) => {
  if (debugLoggerInstance) {
    debugLoggerInstance(level, message, details);
  }
};

interface DebugPanelProps {
  onVisibilityChange?: (visible: boolean) => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ onVisibilityChange }) => {
  const [isVisible, setIsVisible] = useState(() => {
    // Default hidden on first run; persist thereafter
    const saved = localStorage.getItem('debugPanelVisible');
    return saved === null ? false : saved === 'true';
  });
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    // Default minimized on first run; persist thereafter
    const saved = localStorage.getItem('debugPanelOpen');
    return saved === null ? false : saved === 'true';
  });
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    retrying: false,
    lastError: undefined,
    retryCount: 0,
    serverUrl: undefined
  });
  const [previousConnectionStatus, setPreviousConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [backendPort, setBackendPort] = useState<number | null>(null);
  const originalConsoleError = useRef<typeof console.error>();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isMouseSelectingRef = useRef<boolean>(false);
  const [stickToBottom, setStickToBottom] = useState<boolean>(true);

  const addLog = useCallback((level: DebugLog['level'], message: string, details?: any) => {
    const newLog: DebugLog = {
      timestamp: new Date().toISOString().split('T')[1].split('.')[0],
      level,
      message,
      details
    };
    setLogs(prev => [...prev.slice(-99), newLog]); // Keep last 100 logs for more context
  }, []);

  useEffect(() => {
    // Set global debug logger instance
    debugLoggerInstance = addLog;

    // Subscribe to connection status with smart filtering
    const unsubscribe = connectionManager.subscribe((status) => {
      // Determine if we should log this status update
      const shouldLog = (() => {
        if (!previousConnectionStatus) return true; // Always log first status
        
        // Always log these important changes:
        if (status.connected !== previousConnectionStatus.connected) return true;
        if (status.lastError !== previousConnectionStatus.lastError) return true;
        if (status.isInitialStartup !== previousConnectionStatus.isInitialStartup) return true;
        
        // During startup, only log retry count changes every 3 attempts
        if (status.isInitialStartup && status.retryCount > 0 && status.retryCount % 3 === 0) return true;
        
        // Skip repetitive "Connection established" when already connected
        if (status.connected && previousConnectionStatus.connected && 
            status.serverUrl === previousConnectionStatus.serverUrl) return false;
        
        // Skip unchanged retry counts when already retrying
        if (status.retrying && previousConnectionStatus.retrying && 
            status.retryCount === previousConnectionStatus.retryCount) return false;
        
        return true; // Default to logging
      })();

      // Update state
      setConnectionStatus(status);
      setPreviousConnectionStatus(status);
      
      // Only log if we should
      if (shouldLog) {
        // More detailed status messages
        let message = '';
        let level: DebugLog['level'] = 'info';
        
        if (status.connected) {
          if (status.isInitialStartup && status.lastError) {
            // During startup, show AI initialization message
            message = `🤖 ${status.lastError}`;
            level = 'info';
          } else if (!previousConnectionStatus?.connected) {
            // Only show connection established when transitioning from disconnected
            message = `✅ Connection established${status.serverUrl ? ` to ${status.serverUrl}` : ''}`;
            level = 'info';
          }
        } else if (status.retrying) {
          if (status.isInitialStartup) {
            // Friendly startup messages
            message = `🚀 ${status.lastError || 'Starting server...'}`;
            level = 'info';
          } else {
            message = `⚠️ Connection retrying (attempt ${status.retryCount}) - ${status.lastError || 'Connection failed'}`;
            level = 'warn';
          }
        } else {
          message = `❌ Connection lost - ${status.lastError || 'Unknown error'}`;
          level = 'error';
        }
        
        // Only add log if we have a message
        if (message) {
          addLog(level, message);
        }
      }
    });

    // DO NOT INTERCEPT fetch or XMLHttpRequest in production - it breaks communication!
    // Instead, we rely on the debug logging added to api.ts and ConnectionManager

    // Intercept console.error for better error tracking
    if (!originalConsoleError.current) {
      originalConsoleError.current = console.error;
      console.error = (...args) => {
        originalConsoleError.current!(...args);
        const errorMessage = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        if (errorMessage.toLowerCase().includes('ai') || 
            errorMessage.toLowerCase().includes('ollama') ||
            errorMessage.toLowerCase().includes('api') ||
            errorMessage.toLowerCase().includes('fetch') ||
            errorMessage.toLowerCase().includes('securestorage') ||
            errorMessage.toLowerCase().includes('stronghold')) {
          addLog('error', `Console Error: ${errorMessage.substring(0, 200)}`);
        }
      };
    }

    // Also intercept console.log for secure storage debugging
    const originalConsoleLog = console.log;
    console.log = (...args) => {
      originalConsoleLog(...args);
      const logMessage = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      if (logMessage.includes('[SecureStorage]') || 
          logMessage.includes('[SettingsContext]') ||
          logMessage.toLowerCase().includes('stronghold') ||
          logMessage.toLowerCase().includes('vault')) {
        addLog('info', logMessage.substring(0, 300));
      }
    };

    // Get backend port from connection manager
    const checkBackendPort = async () => {
      try {
        // In browser mode, get port from connection manager
        const serverUrl = connectionManager.getServerUrl();
        let port = 3002; // Default port
        
        if (serverUrl) {
          try {
            const url = new URL(serverUrl);
            port = parseInt(url.port, 10) || 3002;
          } catch {
            // Use default port if URL parsing fails
          }
        }
        
        // Only log this once on initial check
        if (backendPort === null) {
          addLog('info', `Browser runtime detected. Backend port: ${port}`);
        }
        
        // Only update if port changed
        if (port !== backendPort) {
          setBackendPort(port);
        }

        // Health checks are handled centrally by ConnectionManager; avoid duplicate checks here
      } catch (error) {
        // Fall back silently to 3002 and only log once.
        addLog('error', `Failed to get backend port: ${error}`);
      }
    };

    // F12 keyboard handler
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault();
        setIsVisible(prev => {
          const newValue = !prev;
          localStorage.setItem('debugPanelVisible', String(newValue));
          onVisibilityChange?.(newValue);
          addLog('info', `Debug panel ${newValue ? 'shown' : 'hidden'} with F12`);
          return newValue;
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Initial checks
    addLog('info', 'Debug panel initialized');
    
    // Browser mode detection
    addLog('info', 'Running in browser mode');
    
    addLog('info', `Environment: ${process.env.NODE_ENV}`);
    addLog('info', 'Debug panel hidden by default. Press F12 to show/hide.');
    
    checkBackendPort();

    // Check every 5 minutes (300 seconds) since port rarely changes
    const interval = setInterval(checkBackendPort, 300000);

    return () => {
      unsubscribe();
      clearInterval(interval);
      document.removeEventListener('keydown', handleKeyDown);
      // Note: We don't restore XMLHttpRequest methods as it could break ongoing requests
      if (originalConsoleError.current) {
        console.error = originalConsoleError.current;
      }
      debugLoggerInstance = null;
    };
  }, []);

  // Auto-scroll to bottom when new logs arrive or panel opens
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    // Always stick to bottom on new logs if panel is open
    if (isOpen && stickToBottom && !isMouseSelectingRef.current) {
      const el = scrollContainerRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [logs, isOpen, stickToBottom]);

  const getLevelColor = (level: DebugLog['level']) => {
    switch (level) {
      case 'error': return '#ff6b6b';
      case 'warn': return '#ffd93d';
      case 'info': return '#6bcf7f';
      case 'network': return '#64b5f6';
      case 'ai': return '#ba68c8';
      default: return '#888';
    }
  };

  const getLevelIcon = (level: DebugLog['level']) => {
    switch (level) {
      case 'network': return '🌐';
      case 'ai': return '🤖';
      default: return '';
    }
  };

  // Check for welcome screen flag on each render
  const [hideForWelcome, setHideForWelcome] = useState(
    () => !!localStorage.getItem('hideDebugPanelUntilWelcomeClosed')
  );

  // Listen for storage changes to detect when welcome screen closes
  useEffect(() => {
    const checkFlags = () => {
      // Check welcome screen flag
      const shouldHide = !!localStorage.getItem('hideDebugPanelUntilWelcomeClosed');
      if (shouldHide !== hideForWelcome) {
        addLog('info', `Welcome screen flag changed: ${shouldHide ? 'hiding' : 'showing'} debug panel`);
      }
      setHideForWelcome(shouldHide);

      // Also check visibility flag
      const savedVisible = localStorage.getItem('debugPanelVisible');
      if (savedVisible !== null) {
        const newVisible = savedVisible === 'true';
        if (newVisible !== isVisible) {
          setIsVisible(newVisible);
          onVisibilityChange?.(newVisible);
          addLog('info', `Debug panel visibility changed to: ${newVisible ? 'visible' : 'hidden'}`);
        }
      }
    };

    // Initial check
    checkFlags();

    // Check periodically for changes (since storage events don't fire in same window)
    const interval = setInterval(checkFlags, 500);
    
    // Also listen for storage events from other windows/tabs
    window.addEventListener('storage', checkFlags);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', checkFlags);
    };
  }, [addLog, hideForWelcome, isVisible, onVisibilityChange]);

  // Hide if manually hidden or if welcome screen is open
  if (!isVisible || hideForWelcome) {
    return null;
  }

  const toggleOpen = () => {
    setIsOpen(prev => {
      const next = !prev;
      localStorage.setItem('debugPanelOpen', String(next));
      return next;
    });
  };

  return (
    <Paper
      data-testid="debug-panel"
      className="debug-panel-root"
      sx={{
        position: 'fixed',
        bottom: 20,
        left: { xs: 8, sm: '50%' },
        right: { xs: 8, sm: 'auto' },
        transform: { xs: 'none', sm: 'translateX(-50%)' },
        width: { xs: 'auto', sm: 600 }, // Keep desktop width unchanged; fit mobile viewport
        maxHeight: { xs: '70dvh', sm: 550 },
        zIndex: 1500, // Above diagram (1000) but below floating windows (2000+)
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        color: '#fff',
        fontSize: '12px',
        fontFamily: 'monospace',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        // Force selectable text within the panel (Edge/Chrome dev envs)
        userSelect: 'text',
        WebkitUserSelect: 'text',
        msUserSelect: 'text',
      }}
    >
      <Box 
        sx={{ 
          p: 1, 
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box 
          sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', flex: 1 }}
          onClick={toggleOpen}
        >
          <Bug size={16} color="#888" />
          <AlertCircle size={16} color={connectionStatus.connected ? '#6bcf7f' : connectionStatus.retrying ? '#ffd93d' : '#ff6b6b'} />
          <Typography
            variant="caption"
            sx={{
              fontWeight: 'bold',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: { xs: '0.68rem', sm: '0.75rem' }
            }}
          >
            Debug Console - {
              connectionStatus.isInitialStartup ? (
                connectionStatus.connected ? 'Initializing AI...' :
                connectionStatus.retryCount === 0 ? 'Starting...' :
                connectionStatus.retryCount < 3 ? 'Connecting...' :
                `Starting (${connectionStatus.retryCount})`
              ) : (
                connectionStatus.connected ? 'Connected' : 
                connectionStatus.retrying ? `Reconnecting (${connectionStatus.retryCount})` : 
                'Disconnected'
              )
            }
            {backendPort && ` (Port: ${backendPort})`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <Tooltip title="Clear logs">
            <IconButton 
              size="small" 
              sx={{ color: '#fff', p: { xs: 0.75, sm: 0.5 } }}
              onClick={() => setLogs([])}
            >
              <Trash2 size={14} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Toggle panel visibility (F12)">
            <Chip
              label="F12"
              size="small"
              sx={{ bgcolor: '#333', color: '#ddd', height: 20, display: { xs: 'none', sm: 'inline-flex' } }}
            />
          </Tooltip>
          <Tooltip title={isOpen ? "Collapse" : "Expand"}>
            <IconButton 
              size="small" 
              sx={{ color: '#fff', p: { xs: 0.75, sm: 0.5 } }}
              onClick={toggleOpen}
            >
              {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Close panel (F12 to reopen)">
            <IconButton 
              size="small" 
              sx={{ color: '#fff', p: { xs: 0.9, sm: 0.5 } }}
              onClick={() => {
                setIsVisible(false);
                localStorage.setItem('debugPanelVisible', 'false');
                onVisibilityChange?.(false);
              }}
            >
              <X size={16} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      <Collapse in={isOpen}>
        <Box
          ref={scrollContainerRef}
          onMouseDown={() => { isMouseSelectingRef.current = true; }}
          onMouseUp={() => { isMouseSelectingRef.current = false; }}
          onMouseLeave={() => { isMouseSelectingRef.current = false; }}
          onScroll={(e) => {
            const el = e.currentTarget as HTMLDivElement;
            const nearBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 20;
            setStickToBottom(nearBottom);
          }}
          sx={{ 
            p: 1, 
            maxHeight: 450, 
            overflowY: 'auto',
            userSelect: 'text !important',
            WebkitUserSelect: 'text !important',
            MozUserSelect: 'text !important',
            msUserSelect: 'text !important',
            cursor: 'text',
            '& *': {
              userSelect: 'text !important',
              WebkitUserSelect: 'text !important',
              MozUserSelect: 'text !important',
              msUserSelect: 'text !important',
              cursor: 'text',
            }
          }}
        >
          {connectionStatus.serverUrl && (
            <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1 }}>
              Server URL: {connectionStatus.serverUrl} | Retries: {connectionStatus.retryCount}
            </Typography>
          )}
          {logs.length === 0 ? (
            <Typography variant="caption" sx={{ color: '#666', fontStyle: 'italic' }}>
              No logs yet. Press F12 to toggle this panel.
            </Typography>
          ) : (
            logs.map((log, index) => (
            <Box key={index} sx={{ mb: 0.5 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#666', minWidth: '60px', userSelect: 'text !important' }}>
                  {log.timestamp}
                </Typography>
                <Typography variant="caption" sx={{ color: getLevelColor(log.level), fontWeight: 'bold', minWidth: '60px', userSelect: 'text !important' }}>
                  {getLevelIcon(log.level)} [{log.level.toUpperCase()}]
                </Typography>
                <Typography variant="caption" sx={{ flex: 1, wordBreak: 'break-word', userSelect: 'text !important' }}>
                  {log.message}
                </Typography>
              </Box>
              {log.details && (
                <Box sx={{ ml: '130px', mt: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#999', fontSize: '10px', fontFamily: 'monospace', userSelect: 'text !important' }}>
                    {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : log.details}
                  </Typography>
                </Box>
              )}
            </Box>
          ))
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};
