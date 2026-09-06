import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Alert,
  AlertTitle,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  useTheme,
} from '@mui/material';
import { Assessment, Security, Warning, BugReport, Route, Lightbulb, InfoOutlined } from '@mui/icons-material';
import { getRiskColor } from './grc/grcShared';

interface SystemOverviewTabProps {
  systemAnalysis: {
    systemOverview?: any;
    componentThreats?: Record<string, any[]>;
    attackPaths?: any[];
    vulnerabilities?: any[];
    recommendations?: any[];
    overallRiskAssessment?: {
      likelihood: string;
      impact: string;
      risk: string;
      justification: string;
    };
    targetedAnalysis?: {
      threatActors: string;
      ttps: string;
      vulnerabilities: string;
      focusAreas: string;
      scenarioDescription?: string;
    };
    isTargetedAnalysis?: boolean;
  };
  nodes: any[];
  edges: any[];
}

const SystemOverviewTab: React.FC<SystemOverviewTabProps> = ({
  systemAnalysis,
  nodes,
  edges,
}) => {
  const theme = useTheme();

  // Calculate statistics
  const stats = React.useMemo(() => {
    const componentNodes = nodes.filter(n => n.type !== 'securityZone');
    const totalThreats = systemAnalysis.componentThreats 
      ? Object.values(systemAnalysis.componentThreats).flat().length 
      : 0;
    const totalVulnerabilities = systemAnalysis.vulnerabilities?.length || 0;
    const totalAttackPaths = systemAnalysis.attackPaths?.length || 0;
    const totalRecommendations = systemAnalysis.recommendations?.length || 0;

    // Calculate risk distribution
    const riskDistribution: Record<string, number> = {
      'Extreme': 0,
      'High': 0,
      'Medium': 0,
      'Minor': 0,
      'Sustainable': 0
    };

    if (systemAnalysis.componentThreats) {
      Object.values(systemAnalysis.componentThreats).flat().forEach((threat: any) => {
        if (threat.risk && riskDistribution.hasOwnProperty(threat.risk)) {
          riskDistribution[threat.risk]++;
        }
      });
    }

    return {
      componentCount: componentNodes.length,
      edgeCount: edges.length,
      totalThreats,
      totalVulnerabilities,
      totalAttackPaths,
      totalRecommendations,
      riskDistribution
    };
  }, [systemAnalysis, nodes, edges]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Overall Risk Assessment */}
      {systemAnalysis.overallRiskAssessment && (
        <Alert 
          severity={
            systemAnalysis.overallRiskAssessment.risk === 'Extreme' ? 'error' :
            systemAnalysis.overallRiskAssessment.risk === 'High' ? 'error' :
            systemAnalysis.overallRiskAssessment.risk === 'Medium' ? 'warning' :
            'info'
          }
          sx={{ 
            mb: 2,
            borderRadius: 2,
            border: `1px solid`,
            borderColor: 
              systemAnalysis.overallRiskAssessment.risk === 'Extreme' || systemAnalysis.overallRiskAssessment.risk === 'High' ? 
                theme.palette.error.main :
              systemAnalysis.overallRiskAssessment.risk === 'Medium' ? 
                theme.palette.warning.main :
                theme.palette.info.main,
            '& .MuiAlert-icon': {
              fontSize: '1.75rem',
            }
          }}
        >
          <AlertTitle sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
            Overall System Risk Assessment
          </AlertTitle>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
            <Chip 
              label={`Likelihood: ${systemAnalysis.overallRiskAssessment.likelihood}`} 
              size="small" 
            />
            <Chip 
              label={`Impact: ${systemAnalysis.overallRiskAssessment.impact}`} 
              size="small" 
            />
            <Chip 
              label={`Risk: ${systemAnalysis.overallRiskAssessment.risk}`} 
              size="small" 
              sx={{ 
                backgroundColor: getRiskColor(systemAnalysis.overallRiskAssessment.risk), 
                color: '#fff' 
              }} 
            />
          </Box>
          <Typography variant="body2">
            {systemAnalysis.overallRiskAssessment.justification}
          </Typography>
        </Alert>
      )}

      {/* Targeted Threat Analysis Section */}
      {systemAnalysis.isTargetedAnalysis && systemAnalysis.targetedAnalysis && (
        <Card 
          variant="outlined"
          sx={{ 
            mb: 3,
            borderColor: theme.palette.error.main,
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(244, 67, 54, 0.05)' : 'rgba(244, 67, 54, 0.02)',
          }}
        >
          <CardHeader
            avatar={
              <Security 
                sx={{ 
                  color: theme.palette.error.main,
                  fontSize: '1.5rem'
                }} 
              />
            }
            title="Targeted Threat Analysis"
            titleTypographyProps={{ 
              variant: 'h6',
              fontWeight: 600,
              color: theme.palette.error.main
            }}
            sx={{
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(244, 67, 54, 0.1)' : 'rgba(244, 67, 54, 0.05)',
              '& .MuiCardHeader-avatar': {
                marginRight: 2,
              }
            }}
          />
          <CardContent>
            <Grid container spacing={3}>
              {/* Threat Actors */}
              {systemAnalysis.targetedAnalysis.threatActors && (
                <Grid item xs={12}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      THREAT ACTORS
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      {systemAnalysis.targetedAnalysis.threatActors}
                    </Typography>
                  </Box>
                </Grid>
              )}

              {/* TTPs */}
              {systemAnalysis.targetedAnalysis.ttps && (
                <Grid item xs={12}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      TACTICS, TECHNIQUES, AND PROCEDURES (TTPs)
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {systemAnalysis.targetedAnalysis.ttps.split(',').map((ttp, index) => (
                        <Chip 
                          key={index}
                          label={ttp.trim()} 
                          size="small" 
                          variant="outlined"
                          color="error"
                          sx={{ 
                            borderColor: theme.palette.error.main,
                            '& .MuiChip-label': { 
                              fontSize: '0.8rem',
                              fontFamily: 'monospace'
                            }
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                </Grid>
              )}

              {/* Known Vulnerabilities */}
              {systemAnalysis.targetedAnalysis.vulnerabilities && (
                <Grid item xs={12}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      KNOWN VULNERABILITIES
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      {systemAnalysis.targetedAnalysis.vulnerabilities}
                    </Typography>
                  </Box>
                </Grid>
              )}

              {/* Focus Areas */}
              {systemAnalysis.targetedAnalysis.focusAreas && (
                <Grid item xs={12}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      FOCUS AREAS
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {systemAnalysis.targetedAnalysis.focusAreas.split(',').map((area, index) => (
                        <Chip 
                          key={index}
                          label={area.trim()} 
                          size="small" 
                          color="primary"
                          sx={{ 
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(33, 150, 243, 0.2)' : 'rgba(33, 150, 243, 0.1)',
                            color: theme.palette.primary.main,
                            border: `1px solid ${theme.palette.primary.main}`,
                            '& .MuiChip-label': { px: 1.5 }
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                </Grid>
              )}

              {/* Scenario Description */}
              {systemAnalysis.targetedAnalysis.scenarioDescription && (
                <Grid item xs={12}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      ATTACK SCENARIO
                    </Typography>
                    <Alert 
                      severity="warning" 
                      icon={<Warning />}
                      sx={{ 
                        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.1)' : 'rgba(255, 152, 0, 0.05)',
                        border: `1px solid ${theme.palette.warning.main}`,
                        '& .MuiAlert-message': {
                          width: '100%'
                        }
                      }}
                    >
                      <Typography variant="body2">
                        {systemAnalysis.targetedAnalysis.scenarioDescription}
                      </Typography>
                    </Alert>
                  </Box>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* System Statistics */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card 
            variant="outlined"
            sx={{ 
              height: '100%',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: theme.shadows[4],
              }
            }}
          >
            <CardHeader
              avatar={
                <Assessment 
                  sx={{ 
                    color: theme.palette.primary.main,
                    fontSize: '1.5rem'
                  }} 
                />
              }
              title="System Architecture"
              titleTypographyProps={{ 
                variant: 'h6',
                fontWeight: 600,
                color: theme.palette.text.primary
              }}
              sx={{
                '& .MuiCardHeader-avatar': {
                  marginRight: 2,
                }
              }}
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="h4" color="primary" fontWeight="bold">
                    {stats.componentCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Components
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h4" color="primary" fontWeight="bold">
                    {stats.edgeCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Connections
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card 
            variant="outlined"
            sx={{ 
              height: '100%',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: theme.shadows[4],
              }
            }}
          >
            <CardHeader
              avatar={
                <Security 
                  sx={{ 
                    color: theme.palette.error.main,
                    fontSize: '1.5rem'
                  }} 
                />
              }
              title="Security Analysis Summary"
              titleTypographyProps={{ 
                variant: 'h6',
                fontWeight: 600,
                color: theme.palette.text.primary
              }}
              sx={{
                '& .MuiCardHeader-avatar': {
                  marginRight: 2,
                }
              }}
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Warning color="error" fontSize="small" />
                    <Typography variant="h4" color="error" fontWeight="bold">
                      {stats.totalThreats}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Threats
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <BugReport color="warning" fontSize="small" />
                    <Typography variant="h4" color="warning.main" fontWeight="bold">
                      {stats.totalVulnerabilities}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Vulnerabilities
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Route color="error" fontSize="small" />
                    <Typography variant="h4" color="error" fontWeight="bold">
                      {stats.totalAttackPaths}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Attack Paths
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Lightbulb color="info" fontSize="small" />
                    <Typography variant="h4" color="info.main" fontWeight="bold">
                      {stats.totalRecommendations}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Recommendations
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Risk Distribution */}
      {stats.totalThreats > 0 && (
        <Card variant="outlined">
          <CardHeader
            title="Risk Distribution"
            titleTypographyProps={{ variant: 'h6' }}
          />
          <CardContent>
            <Grid container spacing={2}>
              {Object.entries(stats.riskDistribution).map(([risk, count]) => (
                count > 0 && (
                  <Grid item xs={12} sm={6} md={2.4} key={risk}>
                    <Paper 
                      elevation={0}
                      sx={{ 
                        p: 2, 
                        textAlign: 'center',
                        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : theme.palette.grey[50],
                        border: `1px solid ${theme.palette.divider}`
                      }}
                    >
                      <Typography 
                        variant="h4" 
                        fontWeight="bold"
                        sx={{ color: getRiskColor(risk) }}
                      >
                        {count}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {risk} Risk
                      </Typography>
                    </Paper>
                  </Grid>
                )
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* System Overview Text */}
      {systemAnalysis.systemOverview ? (
        <Card variant="outlined">
          <CardHeader
            avatar={<Assessment />}
            title="System Analysis Overview"
            titleTypographyProps={{ variant: 'h6' }}
          />
          <CardContent>
            {typeof systemAnalysis.systemOverview === 'string' ? (
              <Stack spacing={2}>
                {systemAnalysis.systemOverview.split(/\n\n+/).map((paragraph: string, idx: number) => (
                  <Typography key={idx} variant="body1" sx={{ lineHeight: 1.8 }}>
                    {paragraph.trim()}
                  </Typography>
                ))}
              </Stack>
            ) : (
              <Stack spacing={3}>
                {(systemAnalysis.systemOverview.overview || systemAnalysis.systemOverview.description) && (
                  <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
                    {systemAnalysis.systemOverview.overview || systemAnalysis.systemOverview.description}
                  </Typography>
                )}
                {systemAnalysis.systemOverview.keyFindings && Array.isArray(systemAnalysis.systemOverview.keyFindings) && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                      Key Findings
                    </Typography>
                    <List dense disablePadding>
                      {systemAnalysis.systemOverview.keyFindings.map((finding: string, idx: number) => (
                        <ListItem key={idx} sx={{ pl: 0 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <Warning color="warning" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText primary={finding} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
                {systemAnalysis.systemOverview.criticalComponents && Array.isArray(systemAnalysis.systemOverview.criticalComponents) && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                      Critical Components
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {systemAnalysis.systemOverview.criticalComponents.map((comp: string, idx: number) => (
                        <Chip key={idx} label={comp} size="small" color="error" variant="outlined" />
                      ))}
                    </Box>
                  </Box>
                )}
              </Stack>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ p: 4, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <InfoOutlined sx={{ fontSize: 48, color: 'text.disabled' }} />
              <Typography variant="h6" color="text.secondary">
                No System Overview Available
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ maxWidth: 400 }}>
                The AI analysis did not produce a system overview. Try running the analysis again or check that your diagram has components and connections.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default SystemOverviewTab;