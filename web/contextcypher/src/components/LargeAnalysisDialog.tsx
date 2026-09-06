import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  Box,
} from '@mui/material';
import { Warning, Speed, GetApp } from '@mui/icons-material';

interface LargeAnalysisDialogProps {
  open: boolean;
  onClose: () => void;
  onViewInApp: () => void;
  onExportOnly: () => void;
  metrics: {
    componentCount: number;
    threatCount: number;
    vulnerabilityCount: number;
    reportSize?: number;
    estimatedRenderTime: number;
  };
}

export const LargeAnalysisDialog: React.FC<LargeAnalysisDialogProps> = ({
  open,
  onClose,
  onViewInApp,
  onExportOnly,
  metrics,
}) => {
  const severity = metrics.componentCount > 30 || metrics.threatCount > 100 ? 'error' : 'warning';
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning sx={{ color: severity === 'error' ? 'error.main' : 'warning.main' }} />
          Large Analysis Detected
        </Box>
      </DialogTitle>
      <DialogContent>
        <Alert severity={severity} sx={{ mb: 3 }}>
          Your analysis contains:
          <Box component="ul" sx={{ mt: 1, mb: 0 }}>
            <li>{metrics.componentCount} components</li>
            <li>{metrics.threatCount} threats</li>
            <li>{metrics.vulnerabilityCount} vulnerabilities</li>
            {metrics.reportSize && (
              <li>{(metrics.reportSize / 1024).toFixed(1)} KB report size</li>
            )}
          </Box>
          Rendering this in the browser may cause performance issues or freezing.
        </Alert>
        
        <Typography variant="body1" paragraph>
          For optimal performance with large analyses, we recommend using the export 
          functions to view the full report in an external application.
        </Typography>
        
        <Box sx={{ 
          p: 2, 
          bgcolor: 'background.paper', 
          border: 1, 
          borderColor: 'divider',
          borderRadius: 1,
          mb: 2 
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Speed color="info" />
            <Typography variant="subtitle2">Performance Impact</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Estimated render time: ~{metrics.estimatedRenderTime} seconds
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Memory usage: High
          </Typography>
          {metrics.estimatedRenderTime > 10 && (
            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
              ⚠️ Your browser may become unresponsive during rendering
            </Typography>
          )}
        </Box>
        
        <Box sx={{ 
          p: 2, 
          bgcolor: 'success.light', 
          borderRadius: 1,
          mb: 2 
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <GetApp />
            <Typography variant="subtitle2">Recommended: Export Only</Typography>
          </Box>
          <Typography variant="body2">
            Export the report as PDF, HTML, or Text for the best viewing experience 
            without performance issues.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button 
          onClick={onExportOnly} 
          variant="contained" 
          color="primary"
          size="large"
          startIcon={<GetApp />}
        >
          Export Only (Recommended)
        </Button>
        <Button 
          onClick={onViewInApp} 
          color="secondary"
          variant="outlined"
        >
          View in App Anyway
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LargeAnalysisDialog;