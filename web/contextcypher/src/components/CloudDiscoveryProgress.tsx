import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  LinearProgress,
  Typography,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress
} from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Cloud as CloudIcon
} from '@mui/icons-material';
import { CloudDiscoveryProgress as ProgressType } from '../types/CloudTypes';

interface CloudDiscoveryProgressProps {
  open: boolean;
  progress: ProgressType;
  onCancel?: () => void;
  canCancel?: boolean;
}

export const CloudDiscoveryProgress: React.FC<CloudDiscoveryProgressProps> = ({
  open,
  progress,
  onCancel,
  canCancel = true
}) => {
  const getStatusIcon = () => {
    switch (progress.status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'initializing':
      case 'discovering':
      case 'mapping':
        return <CircularProgress size={24} />;
      default:
        return <CloudIcon />;
    }
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      case 'initializing':
        return 'info';
      case 'discovering':
        return 'primary';
      case 'mapping':
        return 'secondary';
      default:
        return 'inherit';
    }
  };

  const getProgressPercentage = () => {
    return progress.percentage || 0;
  };

  return (
    <Dialog open={open} maxWidth="sm" fullWidth disableEscapeKeyDown>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          {getStatusIcon()}
          <span>Cloud Service Discovery</span>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" gutterBottom color={getStatusColor()}>
            {progress.message}
          </Typography>

          <Box sx={{ mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={getProgressPercentage()}
              color={getStatusColor() as any}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {getProgressPercentage()}% Complete
            </Typography>
          </Box>
        </Box>

        {progress.currentRegion && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Current Region: <strong>{progress.currentRegion}</strong>
            </Typography>
          </Box>
        )}

        {progress.discoveredResources !== undefined && progress.totalResources !== undefined && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2">
              Discovered: <strong>{progress.discoveredResources}</strong> of{' '}
              <strong>{progress.totalResources}</strong> resources
            </Typography>
          </Box>
        )}

        {progress.status === 'completed' && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
            <Typography variant="body2" color="success.dark">
              ✅ Discovery completed successfully! {progress.discoveredResources} cloud resources mapped to
              vendor-specific node types.
            </Typography>
          </Box>
        )}

        {progress.status === 'error' && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
            <Typography variant="body2" color="error.dark">
              ❌ Discovery failed. Please check your credentials and try again.
            </Typography>
          </Box>
        )}

        <List dense sx={{ mt: 2 }}>
          <ListItem>
            <ListItemIcon>
              {progress.status === 'initializing' || progress.status === 'discovering' || progress.status === 'mapping' ? (
                <CircularProgress size={20} />
              ) : (
                <CheckCircle color={progress.status === 'completed' ? 'success' : 'disabled'} />
              )}
            </ListItemIcon>
            <ListItemText
              primary="Initialize Discovery"
              secondary={progress.status === 'initializing' ? 'In progress...' : 'Complete'}
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              {progress.status === 'discovering' || progress.status === 'mapping' ? (
                <CircularProgress size={20} />
              ) : (
                <CheckCircle color={['discovering', 'mapping', 'completed'].includes(progress.status) ? 'success' : 'disabled'} />
              )}
            </ListItemIcon>
            <ListItemText
              primary="Discover Resources"
              secondary={
                progress.status === 'discovering'
                  ? 'Scanning cloud infrastructure...'
                  : progress.status === 'mapping' || progress.status === 'completed'
                  ? 'Complete'
                  : 'Pending'
              }
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              {progress.status === 'mapping' ? (
                <CircularProgress size={20} />
              ) : (
                <CheckCircle color={progress.status === 'completed' ? 'success' : 'disabled'} />
              )}
            </ListItemIcon>
            <ListItemText
              primary="Map to Vendor Nodes"
              secondary={
                progress.status === 'mapping'
                  ? 'Converting to vendor-specific node types...'
                  : progress.status === 'completed'
                  ? 'Complete'
                  : 'Pending'
              }
            />
          </ListItem>
        </List>
      </DialogContent>

      <DialogActions>
        {canCancel && progress.status !== 'completed' && progress.status !== 'error' && (
          <Button onClick={onCancel} color="error">
            Cancel
          </Button>
        )}
        {(progress.status === 'completed' || progress.status === 'error') && (
          <Button onClick={onCancel} variant="contained">
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
