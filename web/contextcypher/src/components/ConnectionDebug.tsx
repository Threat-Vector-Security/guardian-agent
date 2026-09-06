import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import { detectServerPort } from '../utils/portDetection';

interface DebugInfo {
  step: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  timestamp: string;
}

export const ConnectionDebug: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<DebugInfo[]>([]);
  const [isConnecting, setIsConnecting] = useState(true);

  useEffect(() => {
    const addDebugInfo = (step: string, status: 'pending' | 'success' | 'error', message: string) => {
      setDebugInfo(prev => [...prev, {
        step,
        status,
        message,
        timestamp: new Date().toISOString()
      }]);
    };

    const testConnection = async () => {
      addDebugInfo('Init', 'pending', 'Starting connection test...');
      
      // Check environment
      addDebugInfo('Environment', 'success', `NODE_ENV: ${process.env.NODE_ENV}`);
      addDebugInfo('Environment Mode', 'success', 'Browser-based application');
      
      try {
        // Test port detection
        addDebugInfo('Port Detection', 'pending', 'Detecting server port...');
        const serverInfo = await detectServerPort();
        addDebugInfo('Port Detection', 'success', `Server found at ${serverInfo.url}`);
        
        // Test health check
        addDebugInfo('Health Check', 'pending', 'Testing server health...');
        const response = await fetch('/health', {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          addDebugInfo('Health Check', 'success', `Server healthy: ${JSON.stringify(data)}`);
          setIsConnecting(false);
        } else {
          addDebugInfo('Health Check', 'error', `Health check failed: ${response.status}`);
        }
      } catch (error) {
        addDebugInfo('Connection', 'error', `Error: ${error instanceof Error ? error.message : String(error)}`);
        setIsConnecting(false);
      }
    };

    testConnection();
  }, []);

  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        bottom: 20, 
        right: 20, 
        p: 2, 
        maxWidth: 500,
        maxHeight: 400,
        overflow: 'auto',
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: 'white'
      }}
    >
      <Typography variant="h6" gutterBottom>
        Connection Debug {isConnecting && <CircularProgress size={20} sx={{ ml: 1 }} />}
      </Typography>
      {debugInfo.map((info, index) => (
        <Box key={index} sx={{ mb: 1 }}>
          <Typography 
            variant="body2" 
            sx={{ 
              color: info.status === 'error' ? 'red' : 
                     info.status === 'success' ? 'lightgreen' : 
                     'yellow'
            }}
          >
            [{info.timestamp.split('T')[1].split('.')[0]}] {info.step}: {info.message}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
};
