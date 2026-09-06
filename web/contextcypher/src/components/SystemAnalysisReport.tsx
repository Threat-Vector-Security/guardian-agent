// src/components/SystemAnalysisReport.tsx
import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  useTheme,
  Badge,
  Typography,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import {
  Assessment,
  Security,
  Route,
  Lightbulb,
  Shield,
  GpsFixed,
  Warning,
} from '@mui/icons-material';
import useViewportLayout from '../hooks/useViewportLayout';

// Import the tab components
import SystemOverviewTab from './SystemOverviewTab';
import ComponentAnalysisTab from './ComponentAnalysisTab';
import AttackPathsTab from './AttackPathsTab';
import RecommendationsTab from './RecommendationsTab';
import MitreTechniquesTab from './MitreTechniquesTab';

interface SystemAnalysisReportProps {
  systemAnalysis: {
    systemOverview?: any;
    componentThreats?: Record<string, any[]>;
    analyzedComponents?: Array<{
      nodeId: string;
      nodeLabel: string;
      indexCode: string;
      threatsCount: number;
      vulnerabilitiesCount: number;
      hasAnalysis: boolean;
    }>;
    attackPaths?: any[];
    vulnerabilities?: any[];
    recommendations?: any[];
    ttpSummary?: Record<string, any>;
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
  onComponentClick: (componentId: string) => void;
  nodes: any[];
  edges: any[];
  expandAll?: boolean; // For PDF export
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
  compact?: boolean;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, compact = false }) => {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`analysis-tabpanel-${index}`}
      aria-labelledby={`analysis-tab-${index}`}
      sx={{
        animation: value === index ? 'fadeIn 0.3s ease-in' : 'none',
        '@keyframes fadeIn': {
          from: { opacity: 0, transform: 'translateY(10px)' },
          to: { opacity: 1, transform: 'translateY(0)' }
        }
      }}
    >
      {value === index && <Box sx={{ pt: compact ? 2 : 3, pb: compact ? 1.5 : 2 }}>{children}</Box>}
    </Box>
  );
};

const SystemAnalysisReport: React.FC<SystemAnalysisReportProps> = ({
  systemAnalysis,
  onComponentClick,
  nodes,
  edges,
  expandAll = false,
}) => {
  const theme = useTheme();
  const { viewportTier } = useViewportLayout();
  const isCompactViewport = viewportTier === 'xs' || viewportTier === 'sm';
  const [activeTab, setActiveTab] = useState(0);

  // Calculate counts for badges
  const counts = React.useMemo(() => {
    // Use analyzedComponents if available, otherwise fall back to componentThreats
    const analyzedComponentCount = systemAnalysis.analyzedComponents 
      ? systemAnalysis.analyzedComponents.length
      : systemAnalysis.componentThreats 
        ? Object.keys(systemAnalysis.componentThreats).filter(componentId => {
            // Only count if it's a node (not an edge) and not a security zone
            const node = nodes.find(n => n.id === componentId);
            return node && node.type !== 'securityZone';
          }).length
        : 0;
    
    const threatCount = systemAnalysis.componentThreats 
      ? Object.values(systemAnalysis.componentThreats).flat().length 
      : 0;
    const attackPathCount = systemAnalysis.attackPaths?.length || 0;
    const recommendationCount = systemAnalysis.recommendations?.length || 0;
    const mitreCount = systemAnalysis.ttpSummary 
      ? Object.keys(systemAnalysis.ttpSummary).length 
      : 0;

    return {
      components: analyzedComponentCount,
      threats: threatCount,
      attackPaths: attackPathCount,
      recommendations: recommendationCount,
      mitre: mitreCount,
    };
  }, [systemAnalysis, nodes]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const startTime = performance.now();
    console.log('[SystemAnalysisReport] Props:', {
      systemAnalysis: systemAnalysis ? Object.keys(systemAnalysis) : null,
      nodesCount: nodes.length,
      edgesCount: edges.length,
      expandAll,
      hasOverview: !!systemAnalysis?.systemOverview,
      componentThreatsCount: systemAnalysis?.componentThreats ? Object.keys(systemAnalysis.componentThreats).length : 0,
      threatsTotal: counts.threats,
      attackPathsCount: counts.attackPaths,
      vulnerabilitiesCount: systemAnalysis?.vulnerabilities?.length || 0,
      recommendationsCount: counts.recommendations,
      activeTab
    });
    return () => {
      console.log(`[SystemAnalysisReport] Tab render time: ${(performance.now() - startTime).toFixed(2)}ms`);
    };
  }, [systemAnalysis, nodes, edges, expandAll, activeTab, counts]);

  if (!systemAnalysis) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">No analysis data available</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Targeted Analysis Banner */}
      {systemAnalysis.isTargetedAnalysis && systemAnalysis.targetedAnalysis && (
        <Alert 
          severity="info" 
          icon={<GpsFixed sx={{ fontSize: 28 }} />}
          sx={{ 
            mb: 2, 
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(33, 150, 243, 0.1)' : 'rgba(33, 150, 243, 0.05)',
            border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(33, 150, 243, 0.3)' : 'rgba(33, 150, 243, 0.2)'}`,
            borderRadius: 2,
            '& .MuiAlert-icon': {
              color: theme.palette.info.main,
              padding: '8px 0',
            },
            '& .MuiAlert-message': {
              width: '100%',
              padding: '4px 0',
            }
          }}
        >
          <Stack spacing={1}>
            <Typography variant="subtitle1" fontWeight="bold">
              Targeted Threat Analysis
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start' }}>
              {systemAnalysis.targetedAnalysis.threatActors && (
                <Chip 
                  label={`Threat Actor: ${systemAnalysis.targetedAnalysis.threatActors.split(',')[0].trim()}`} 
                  size="small" 
                  color="error"
                  variant="filled"
                  sx={{ 
                    fontWeight: 500,
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)',
                    color: theme.palette.error.main,
                    border: `1px solid ${theme.palette.error.main}`,
                    maxWidth: '100%',
                    '& .MuiChip-label': {
                      px: 1.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    },
                  }}
                />
              )}
              {systemAnalysis.targetedAnalysis.focusAreas && (
                <Chip 
                  label={`Focus: ${systemAnalysis.targetedAnalysis.focusAreas.split(',')[0].trim()}`} 
                  size="small" 
                  color="primary"
                  variant="filled"
                  sx={{ 
                    fontWeight: 500,
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(33, 150, 243, 0.2)' : 'rgba(33, 150, 243, 0.1)',
                    color: theme.palette.primary.main,
                    border: `1px solid ${theme.palette.primary.main}`,
                    maxWidth: '100%',
                    '& .MuiChip-label': {
                      px: 1.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    },
                  }}
                />
              )}
              {systemAnalysis.targetedAnalysis.ttps && (
                <Chip 
                  label={`TTPs: ${systemAnalysis.targetedAnalysis.ttps.split(',').length} techniques`} 
                  size="small" 
                  color="warning"
                  variant="filled"
                  sx={{ 
                    fontWeight: 500,
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.2)' : 'rgba(255, 152, 0, 0.1)',
                    color: theme.palette.warning.main,
                    border: `1px solid ${theme.palette.warning.main}`,
                    maxWidth: '100%',
                    '& .MuiChip-label': {
                      px: 1.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    },
                  }}
                />
              )}
            </Box>
            {systemAnalysis.targetedAnalysis.scenarioDescription && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {systemAnalysis.targetedAnalysis.scenarioDescription}
              </Typography>
            )}
          </Stack>
        </Alert>
      )}

      {/* Tab Navigation */}
      <Paper
        elevation={0}
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          border: '1px solid',
          borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : theme.palette.divider,
          borderRadius: '8px 8px 0 0',
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : theme.palette.grey[50],
          px: 1,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="analysis report tabs"
          variant={isCompactViewport ? 'scrollable' : 'fullWidth'}
          scrollButtons={isCompactViewport ? 'auto' : false}
          allowScrollButtonsMobile
          sx={{
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
            '& .MuiTab-root': {
              minHeight: isCompactViewport ? 52 : 64,
              minWidth: isCompactViewport ? 124 : 'auto',
              textTransform: 'none',
              fontSize: isCompactViewport ? '0.8rem' : '0.875rem',
              fontWeight: 500,
              px: isCompactViewport ? 1.25 : 1,
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
              '& .MuiBadge-root': {
                marginRight: 0.5,
                '& .MuiBadge-badge': {
                  fontSize: '0.7rem',
                  height: 18,
                  minWidth: 18,
                  transition: 'transform 0.2s ease',
                },
              },
              '&.Mui-selected': {
                '& .MuiBadge-badge': {
                  transform: 'scale(1.1)',
                },
              },
              '& svg': {
                fontSize: isCompactViewport ? '1.15rem' : '1.3rem',
                marginBottom: isCompactViewport ? '2px !important' : '4px !important',
              },
            },
          }}
        >
          <Tab
            icon={<Assessment />}
            label={isCompactViewport ? 'Overview' : 'System Overview'}
            id="analysis-tab-0"
            aria-controls="analysis-tabpanel-0"
            sx={{ gap: 1 }}
          />
          <Tab
            icon={
              <Badge 
                badgeContent={counts.components} 
                color="primary" 
                max={99}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <Security />
              </Badge>
            }
            label="Components"
            id="analysis-tab-1"
            aria-controls="analysis-tabpanel-1"
            sx={{ gap: 1 }}
          />
          <Tab
            icon={
              <Badge 
                badgeContent={counts.attackPaths} 
                color="error" 
                max={99}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <Route />
              </Badge>
            }
            label={isCompactViewport ? 'Paths' : 'Attack Paths'}
            id="analysis-tab-2"
            aria-controls="analysis-tabpanel-2"
            sx={{ gap: 1 }}
          />
          <Tab
            icon={
              <Badge 
                badgeContent={counts.recommendations} 
                color="info" 
                max={99}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <Lightbulb />
              </Badge>
            }
            label={isCompactViewport ? 'Recs' : 'Recommendations'}
            id="analysis-tab-3"
            aria-controls="analysis-tabpanel-3"
            sx={{ gap: 1 }}
          />
          <Tab
            icon={
              <Badge 
                badgeContent={counts.mitre} 
                color="secondary" 
                max={99}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <Shield />
              </Badge>
            }
            label={isCompactViewport ? 'MITRE' : 'MITRE ATT&CK'}
            id="analysis-tab-4"
            aria-controls="analysis-tabpanel-4"
            sx={{ gap: 1 }}
          />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box sx={{
        backgroundColor: theme.palette.background.default,
        maxWidth: '100%',
        overflowX: 'hidden',
        border: '1px solid',
        borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : theme.palette.divider,
        borderTop: 0,
        borderRadius: '0 0 8px 8px',
        px: isCompactViewport ? 1.5 : 3,
        pb: 2,
      }}>
        <TabPanel value={activeTab} index={0} compact={isCompactViewport}>
          <SystemOverviewTab
            systemAnalysis={systemAnalysis}
            nodes={nodes}
            edges={edges}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1} compact={isCompactViewport}>
          <ComponentAnalysisTab
            systemAnalysis={systemAnalysis}
            onComponentClick={onComponentClick}
            nodes={nodes}
            expandAll={expandAll}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={2} compact={isCompactViewport}>
          <AttackPathsTab
            systemAnalysis={systemAnalysis}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={3} compact={isCompactViewport}>
          <RecommendationsTab
            systemAnalysis={systemAnalysis}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={4} compact={isCompactViewport}>
          <MitreTechniquesTab
            systemAnalysis={systemAnalysis}
          />
        </TabPanel>
      </Box>
    </Box>
  );
};

export default SystemAnalysisReport;
