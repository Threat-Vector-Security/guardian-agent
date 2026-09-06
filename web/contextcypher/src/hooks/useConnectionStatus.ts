// React hook for connection status
import { useEffect, useState } from 'react';
import { connectionManager, ConnectionStatus } from '../services/ConnectionManager';

export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    retrying: false,
    retryCount: 0
  });
  
  useEffect(() => {
    const unsubscribe = connectionManager.subscribe(setStatus);
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  const reconnect = () => {
    connectionManager.reconnect();
  };
  
  return { status, reconnect };
}