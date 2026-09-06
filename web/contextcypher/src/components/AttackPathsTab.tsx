import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Stack,
  Paper,
  Grid,
  useTheme,
  Tooltip,
  Alert,
} from '@mui/material';
import { Route, Timeline, TrendingFlat, DoubleArrow } from '@mui/icons-material';
import { MitreChip } from '../utils/linkUtils';
import { getRiskColor } from './grc/grcShared';

interface AttackPathsTabProps {
  systemAnalysis: {
    attackPaths?: any[];
    ttpSummary?: Record<string, any>;
    targetedAnalysis?: {
      threatActors: string;
      ttps: string;
      vulnerabilities: string;
      focusAreas: string;
      scenarioDescription?: string;
    };
    isTargetedAnalysis?: boolean;
  };
}

const AttackPathsTab: React.FC<AttackPathsTabProps> = ({
  systemAnalysis,
}) => {
  const theme = useTheme();

  const attackPaths = systemAnalysis.attackPaths || [];

  if (attackPaths.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="success">
          <Typography variant="h6" gutterBottom>
            {systemAnalysis.isTargetedAnalysis 
              ? `No Attack Paths Found for ${systemAnalysis.targetedAnalysis?.threatActors?.split(',')[0] || 'Specified Threat Actor'}`
              : 'No Exploitable Attack Paths Identified'}
          </Typography>
          <Typography variant="body2">
            Based on the current analysis, no viable attack paths have been identified that could 
            lead to system compromise. This indicates a strong security posture with proper 
            network segmentation and security controls.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Route /> Attack Paths Analysis
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Identified attack chains and potential exploitation routes through the system
        </Typography>
      </Box>

      {/* Attack Paths */}
      <Stack spacing={3}>
        {attackPaths.map((path: any, index: number) => (
          <Paper 
            key={index}
            elevation={0}
            sx={{ 
              p: 3,
              backgroundColor: theme.palette.mode === 'dark' 
                ? 'rgba(255,255,255,0.02)' 
                : theme.palette.grey[50],
              border: `1px solid ${theme.palette.divider}`,
              borderLeft: `4px solid ${getRiskColor(path.risk)}`,
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateX(4px)',
                boxShadow: theme.shadows[4],
              }
            }}
          >
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Chip 
                label={`Attack Path ${index + 1}`} 
                size="small" 
                sx={{ 
                  backgroundColor: getRiskColor(path.risk), 
                  color: '#fff',
                  fontWeight: 600
                }} 
              />
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                {path.path?.map((node: string, idx: number) => (
                  <React.Fragment key={idx}>
                    <Paper
                      elevation={0}
                      sx={{
                        px: 2,
                        py: 0.75,
                        borderRadius: '20px',
                        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                        border: `1px solid ${theme.palette.divider}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {node}
                      </Typography>
                    </Paper>
                    {idx < (path.path?.length - 1) && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mx: 0.25 }}>
                        <Box sx={{ width: 16, height: 2, backgroundColor: getRiskColor(path.risk) }} />
                        <DoubleArrow sx={{ fontSize: 18, color: getRiskColor(path.risk) }} />
                      </Box>
                    )}
                  </React.Fragment>
                )) || <Typography variant="subtitle1">Unknown Path</Typography>}
              </Box>
            </Box>
            
            {/* Path Description */}
            {path.description && (
              <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.7 }}>
                {path.description}
              </Typography>
            )}
            
            {/* Risk Metrics */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 2, 
                    textAlign: 'center',
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(255,255,255,0.05)' 
                      : 'rgba(0,0,0,0.02)',
                    border: `1px solid ${theme.palette.divider}`
                  }}
                >
                  <Typography variant="caption" color="text.secondary" display="block">
                    Likelihood
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {path.likelihood || 'Unknown'}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 2, 
                    textAlign: 'center',
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(255,255,255,0.05)' 
                      : 'rgba(0,0,0,0.02)',
                    border: `1px solid ${theme.palette.divider}`
                  }}
                >
                  <Typography variant="caption" color="text.secondary" display="block">
                    Impact
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {path.impact || 'Unknown'}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 2, 
                    textAlign: 'center',
                    backgroundColor: getRiskColor(path.risk),
                    color: '#fff'
                  }}
                >
                  <Typography variant="caption" display="block" sx={{ opacity: 0.9 }}>
                    Risk Level
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {path.risk || 'Unknown'}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
            
            {/* Exploited Threats */}
            {path.exploitedThreats && path.exploitedThreats.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  Exploited Threats:
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {path.exploitedThreats.join(', ')}
                </Typography>
              </Box>
            )}
            
            {/* MITRE ATT&CK Techniques */}
            {path.mitreTechniques && path.mitreTechniques.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'block', mb: 2 }}>
                  MITRE ATT&CK Techniques:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {path.mitreTechniques.map((technique: string, idx: number) => {
                    const techniqueDetails = systemAnalysis.ttpSummary?.[technique];
                    return (
                      <Tooltip 
                        key={idx}
                        title={techniqueDetails?.name || technique}
                        arrow
                      >
                        <MitreChip
                          techniqueId={technique}
                          size="small"
                          variant="outlined"
                          color="primary"
                          sx={{ 
                            cursor: techniqueDetails ? 'help' : 'default',
                            '&:hover': techniqueDetails ? {
                              backgroundColor: theme.palette.primary.main,
                              color: theme.palette.primary.contrastText,
                            } : {}
                          }}
                        />
                      </Tooltip>
                    );
                  })}
                </Box>
              </Box>
            )}
            
            {/* Technical References */}
            {(path.nodeCodes || path.edgeCodes) && (
              <Box sx={{ 
                pt: 2, 
                borderTop: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                gap: 4,
                flexWrap: 'wrap'
              }}>
                {path.nodeCodes && path.nodeCodes.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                      Component References:
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      {path.nodeCodes.join(', ')}
                    </Typography>
                  </Box>
                )}
                {path.edgeCodes && path.edgeCodes.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                      Connection References:
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      {path.edgeCodes.join(', ')}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        ))}
      </Stack>

      {/* Summary Card */}
      {attackPaths.length > 0 && (
        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardHeader
            avatar={<Timeline />}
            title="Attack Path Summary"
            titleTypographyProps={{ variant: 'h6' }}
          />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" color="error" fontWeight="bold">
                    {attackPaths.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Attack Paths
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" color="error" fontWeight="bold">
                    {attackPaths.filter(p => p.risk === 'Extreme' || p.risk === 'High').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    High/Extreme Risk Paths
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" color="primary" fontWeight="bold">
                    {new Set(attackPaths.flatMap(p => p.mitreTechniques || [])).size}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Unique MITRE Techniques
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default AttackPathsTab;