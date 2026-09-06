// Connection status indicator component
import React from 'react';
import { Alert, AlertTitle, Box, CircularProgress, Snackbar } from '@mui/material';
import { WifiOff, Wifi } from 'lucide-react';
import { useConnectionStatus } from '../hooks/useConnectionStatus';

export const ConnectionStatus: React.FC = () => {
  const { status } = useConnectionStatus();
  const [showSnackbar, setShowSnackbar] = React.useState(false);
  const [lastConnectedState, setLastConnectedState] = React.useState(status.connected);
  
  // Show snackbar when connection state changes
  React.useEffect(() => {
    if (status.connected !== lastConnectedState) {
      setShowSnackbar(true);
      setLastConnectedState(status.connected);
    }
  }, [status.connected, lastConnectedState]);
  
  if (status.connected && !status.retrying) {
    return null; // Don't show anything when connected
  }
  
  return (
    <>
      {/* Inline alert for disconnected state */}
      {!status.connected && (
        <Box
          sx={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 9999,
            maxWidth: 400
          }}
        >
          <Alert
            severity="error"
            action={
              <CircularProgress size={20} sx={{ ml: 1 }} />
            }
            icon={<WifiOff />}
          >
            <AlertTitle>Server Connection Lost</AlertTitle>
            <>
              Attempting to reconnect... {status.retryCount > 0 && `(Attempt ${status.retryCount})`}
              {status.retryCount > 2 && <br />}
              {status.retryCount > 2 && <small>The server will be restarted automatically if needed.</small>}
            </>
          </Alert>
        </Box>
      )}
      
      {/* Snackbar for connection restored */}
      <Snackbar
        open={showSnackbar && status.connected}
        autoHideDuration={3000}
        onClose={() => setShowSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowSnackbar(false)}
          severity="success"
          icon={<Wifi />}
          sx={{ width: '100%' }}
        >
          Connection restored!
        </Alert>
      </Snackbar>
    </>
  );
};