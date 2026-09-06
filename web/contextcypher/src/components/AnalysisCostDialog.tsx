import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Alert,
  Chip
} from '@mui/material';
import {
  Token as TokenIcon,
  Timer as TimerIcon,
  Api as ApiIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

interface AnalysisCostDialogProps {
  open: boolean;
  tokens: number;
  passes: number;
  onContinue: () => void;
  onCancel: () => void;
  onClose?: () => void;
  // Enhanced props
  analysisType?: 'selected' | 'entire';
  componentCount?: number;
  provider?: string;
  model?: string;
  estimatedTime?: number;
  isAnalyzing?: boolean;
  progress?: {
    current: number;
    total: number;
    currentComponent?: string;
    timeRemaining?: number;
    phase?: 'node-analysis' | 'system-analysis' | 'enrichment';
  };
  isTargetedAnalysis?: boolean;
  targetedThreatActor?: string;
}

const AnalysisCostDialog: React.FC<AnalysisCostDialogProps> = ({ 
  open, 
  tokens, 
  passes, 
  onContinue, 
  onCancel, 
  onClose,
  analysisType = 'entire',
  componentCount = 0,
  provider = 'local',
  model = '',
  estimatedTime = 0,
  isAnalyzing = false,
  progress,
  isTargetedAnalysis = false,
  targetedThreatActor = ''
}) => {
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)} seconds`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const getProviderWarning = (): string | null => {
    if (provider === 'openai' && tokens > 100000) {
      return 'Large analysis may incur significant costs with OpenAI';
    }
    if (provider === 'anthropic' && tokens > 150000) {
      return 'This analysis will use a significant portion of your Claude token limit';
    }
    if (provider === 'local' && tokens > 8192) {
      return 'Local model may struggle with this many tokens. Consider analyzing in smaller batches.';
    }
    return null;
  };

  const getProviderColor = (): "default" | "primary" | "secondary" => {
    switch (provider) {
      case 'openai': return 'primary';
      case 'anthropic': return 'secondary';
      case 'local': return 'default';
      default: return 'default';
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={isAnalyzing ? undefined : (onClose ?? onCancel)}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={isAnalyzing}
    >
      <DialogTitle>
        {isAnalyzing ? 'Analysis in Progress' : `Confirm ${isTargetedAnalysis ? 'Targeted' : ''} Analysis`}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {/* Provider Info */}
          {provider && (
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Provider:
              </Typography>
              <Chip 
                label={provider.toUpperCase()} 
                size="small" 
                color={getProviderColor()}
              />
              {model && (
                <Typography variant="body2" color="text.secondary">
                  Model: {model}
                </Typography>
              )}
            </Box>
          )}

          {/* Targeted Analysis Alert */}
          {isTargetedAnalysis && !isAnalyzing && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Targeted Threat Analysis Mode</strong>
              </Typography>
              {targetedThreatActor && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Focusing on: {targetedThreatActor}
                </Typography>
              )}
            </Alert>
          )}

          {!isAnalyzing ? (
            <>
              {/* Analysis Summary */}
              {componentCount > 0 && (
                <Typography variant="body1" gutterBottom>
                  You are about to analyze {componentCount} component{componentCount !== 1 ? 's' : ''} 
                  {analysisType === 'entire' ? ' in the entire diagram' : ''}.
                </Typography>
              )}

              {/* Analysis Phases */}
              <Box sx={{ my: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom color="primary">
                  Analysis will proceed in phases:
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Phase 1: Component Analysis"
                      secondary={`Analyze each component individually (${componentCount} components)`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Phase 2: System Analysis"
                      secondary="Identify attack paths and system-wide vulnerabilities"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Phase 3: MITRE Enrichment"
                      secondary="Map threats to MITRE ATT&CK framework"
                    />
                  </ListItem>
                </List>
              </Box>

              {/* Cost Estimates */}
              <List sx={{ my: 2 }}>
                <ListItem>
                  <TokenIcon sx={{ mr: 2, color: 'primary.main' }} />
                  <ListItemText 
                    primary="Estimated Tokens"
                    secondary={`~${formatNumber(tokens)} tokens`}
                  />
                </ListItem>
                <ListItem>
                  <ApiIcon sx={{ mr: 2, color: 'secondary.main' }} />
                  <ListItemText 
                    primary="Analysis Type"
                    secondary="Comprehensive multi-phase analysis"
                  />
                </ListItem>
                {estimatedTime > 0 && (
                  <ListItem>
                    <TimerIcon sx={{ mr: 2, color: 'success.main' }} />
                    <ListItemText 
                      primary="Estimated Time"
                      secondary={formatTime(estimatedTime)}
                    />
                  </ListItem>
                )}
              </List>

              {/* Warning */}
              {getProviderWarning() && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon />
                    {getProviderWarning()}
                  </Box>
                </Alert>
              )}


              <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'text.secondary' }}>
                You can adjust the warning threshold or disable this prompt in Settings → Threat Analysis.
              </Typography>
            </>
          ) : (
            <>
              {/* Progress Display */}
              {progress && (
                <Box sx={{ my: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">
                      {progress.currentComponent || 'Preparing...'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {progress.phase === 'node-analysis' && progress.current < progress.total - 2 
                        ? `Component ${progress.current + 1} of ${progress.total - 2}`
                        : progress.current === progress.total - 2 
                          ? 'Phase 2: System Analysis'
                          : progress.current === progress.total - 1
                            ? 'Phase 3: MITRE Enrichment'
                            : `${progress.current} of ${progress.total}`
                      }
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={(progress.current / progress.total) * 100}
                    sx={{ mb: 2 }}
                  />
                  {progress.timeRemaining !== undefined && (
                    <Typography variant="body2" color="text.secondary" align="center">
                      Estimated time remaining: {formatTime(progress.timeRemaining)}
                    </Typography>
                  )}
                </Box>
              )}

              {/* Completed Components */}
              {progress && progress.current > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <CheckCircleIcon color="success" fontSize="small" />
                    <Typography variant="body2" color="success.main">
                      {progress.phase === 'node-analysis' && progress.current < progress.total - 2 
                        ? `${progress.current} component${progress.current !== 1 ? 's' : ''} analyzed`
                        : progress.current === progress.total - 2 
                          ? 'Component analysis complete, starting system analysis'
                          : progress.current === progress.total - 1
                            ? 'System analysis complete, enriching with MITRE data'
                            : progress.current === progress.total
                              ? 'All analysis complete'
                              : 'Preparing analysis...'
                      }
                    </Typography>
                  </Box>
                </Box>
              )}
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        {!isAnalyzing ? (
          <>
            <Button onClick={onCancel} variant="outlined">Cancel</Button>
            <Button onClick={onContinue} variant="contained" color="primary" autoFocus>
              Proceed
            </Button>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
            Please wait while analysis completes...
          </Typography>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AnalysisCostDialog; 