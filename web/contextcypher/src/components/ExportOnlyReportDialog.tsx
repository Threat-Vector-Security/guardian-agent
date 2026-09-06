import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  AlertTitle,
  Box,
  Grid,
  Divider,
  Stack,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Language as LanguageIcon,
  Assessment,
  Warning,
  BugReport,
  Security,
} from '@mui/icons-material';

interface ExportOnlyReportDialogProps {
  open: boolean;
  onClose: () => void;
  systemAnalysis: any;
  onExportPdf: () => void;
  onExportText: () => void;
  onExportHtml: () => void;
  isExporting?: boolean;
  exportProgress?: {
    progress: number;
    status: string;
  };
  metrics: {
    componentCount: number;
    threatCount: number;
    vulnerabilityCount: number;
    attackPathCount: number;
    reportSize: number;
    estimatedRenderTime?: number;
  };
}

export const ExportOnlyReportDialog: React.FC<ExportOnlyReportDialogProps> = ({
  open,
  onClose,
  systemAnalysis,
  onExportPdf,
  onExportText,
  onExportHtml,
  isExporting = false,
  exportProgress,
  metrics,
}) => {
  const getRiskSummary = () => {
    if (!systemAnalysis?.componentThreats) return { extreme: 0, high: 0, medium: 0, low: 0 };
    
    const allThreats = Object.values(systemAnalysis.componentThreats).flat() as any[];
    return {
      extreme: allThreats.filter(t => t.risk === 'Extreme').length,
      high: allThreats.filter(t => t.risk === 'High').length,
      medium: allThreats.filter(t => t.risk === 'Medium').length,
      low: allThreats.filter(t => t.risk === 'Minor' || t.risk === 'Sustainable').length,
    };
  };

  const riskSummary = getRiskSummary();

  return (
    <Dialog open={open} onClose={!isExporting ? onClose : undefined} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Export Analysis Report</Typography>
          {systemAnalysis?.overallRiskAssessment && (
            <Chip
              label={`Overall Risk: ${systemAnalysis.overallRiskAssessment.risk}`}
              color={
                systemAnalysis.overallRiskAssessment.risk === 'Extreme' ? 'error' :
                systemAnalysis.overallRiskAssessment.risk === 'High' ? 'error' :
                systemAnalysis.overallRiskAssessment.risk === 'Medium' ? 'warning' :
                'success'
              }
              size="small"
            />
          )}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 3 }}>
          <AlertTitle>Export-Only Mode Active</AlertTitle>
          Due to the size of your analysis ({(metrics.reportSize / 1024).toFixed(1)} KB), 
          the report is available for export only to ensure optimal performance.
        </Alert>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assessment /> Analysis Summary
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <Security sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="h4">{metrics.componentCount}</Typography>
                <Typography variant="body2" color="text.secondary">Components</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <Warning sx={{ fontSize: 40, color: 'error.main', mb: 1 }} />
                <Typography variant="h4" color="error.main">{metrics.threatCount}</Typography>
                <Typography variant="body2" color="text.secondary">Threats</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <BugReport sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="h4" color="warning.main">{metrics.vulnerabilityCount}</Typography>
                <Typography variant="body2" color="text.secondary">Vulnerabilities</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <Assessment sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                <Typography variant="h4" color="info.main">{metrics.attackPathCount}</Typography>
                <Typography variant="body2" color="text.secondary">Attack Paths</Typography>
              </Box>
            </Grid>
          </Grid>
          
          {(riskSummary.extreme > 0 || riskSummary.high > 0) && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>Risk Distribution:</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {riskSummary.extreme > 0 && (
                  <Chip label={`${riskSummary.extreme} Extreme`} color="error" size="small" />
                )}
                {riskSummary.high > 0 && (
                  <Chip label={`${riskSummary.high} High`} color="error" size="small" variant="outlined" />
                )}
                {riskSummary.medium > 0 && (
                  <Chip label={`${riskSummary.medium} Medium`} color="warning" size="small" />
                )}
                {riskSummary.low > 0 && (
                  <Chip label={`${riskSummary.low} Low`} color="success" size="small" />
                )}
              </Box>
            </Box>
          )}
        </Box>
        
        <Divider sx={{ my: 3 }} />
        
        <Typography variant="h6" gutterBottom>
          Export Options
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Choose your preferred format for viewing and sharing the analysis report:
        </Typography>
        
        {isExporting && exportProgress ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="body1">{exportProgress.status}</Typography>
            {exportProgress.progress > 0 && (
              <Typography variant="body2" color="text.secondary">
                {Math.round(exportProgress.progress)}% complete
              </Typography>
            )}
          </Box>
        ) : (
          <Stack spacing={2}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<LanguageIcon />}
              onClick={onExportHtml}
              size="large"
              sx={{ py: 2 }}
            >
              <Box sx={{ textAlign: 'left', flex: 1 }}>
                <Typography variant="button" display="block">Export as HTML</Typography>
                <Typography variant="caption" color="text.secondary">
                  Best for web viewing - interactive and searchable
                </Typography>
              </Box>
            </Button>
            
          </Stack>
        )}
        
        {metrics.estimatedRenderTime && (
          <Alert severity="warning" sx={{ mt: 3 }}>
            <Typography variant="body2">
              <strong>Note:</strong> Attempting to render this report in the browser would take 
              approximately {metrics.estimatedRenderTime} seconds and may cause performance issues.
            </Typography>
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isExporting}>
          {isExporting ? 'Exporting...' : 'Close'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportOnlyReportDialog;