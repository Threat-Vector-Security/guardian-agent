// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import React, { useState, forwardRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Divider,
  Tabs,
  Tab,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  TextField,
  FormControlLabel,
  useTheme
} from '@mui/material';
import {
  Security,
  Settings
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useSettings } from '../settings/SettingsContext';
import { getTheme, transitions } from '../styles/Theme';
import { SecurityNode, SecurityEdge } from '../types/SecurityTypes';
import ThreatAnalysisPanel, { ThreatAnalysisPanelRef } from './ThreatAnalysisPanel';



// Styled components
const PanelContainer = styled(Box)(({ theme }) => ({
  height: '100%',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.colors.surface,
  overflow: 'hidden'
}));

const PanelHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  borderBottom: `1px solid ${theme.colors.border}`,
  backgroundColor: theme.colors.surface
}));

const ContentArea = styled(Box)(({ theme }) => ({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
  touchAction: 'pan-y',
  padding: theme.spacing(1.5),
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-track': {
    background: theme.colors.background,
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.colors.border,
    borderRadius: '3px',
    '&:hover': {
      background: theme.colors.surfaceHover,
    },
  },
}));

const CompactCard = styled(Box)(({ theme }) => ({
  backgroundColor: theme.colors.background,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.spacing(0.5),
  padding: theme.spacing(1.5),
  marginBottom: theme.spacing(1),
  transition: transitions.fast,
  '&:hover': {
    borderColor: theme.colors.primary,
  }
}));

interface ThreatAnalysisPanelBaseProps {
  nodes: SecurityNode[];
  edges: SecurityEdge[];
  selectedNodes?: string[];
  onNodesUpdate: (nodes: SecurityNode[]) => void;
  onEdgesUpdate: (edges: SecurityEdge[]) => void;
}

interface ThreatAnalysisMainPanelProps extends ThreatAnalysisPanelBaseProps {
  /**
   * The default (initial) active tab index.
   * 0 = Threat Analysis, 1 = Analysis Settings
   */
  defaultTab?: number;
  onCenterComponent?: (componentId: string) => void;
  onSelectedNodesChange?: (nodeIds: string[]) => void;
  onOpenThreatIntelPanel?: () => void;
}

const ThreatAnalysisMainPanel = forwardRef<ThreatAnalysisPanelRef, ThreatAnalysisMainPanelProps>(({
  nodes,
  edges,
  selectedNodes = [],
  onNodesUpdate,
  onEdgesUpdate,
  defaultTab = 0,
  onCenterComponent,
  onSelectedNodesChange,
  onOpenThreatIntelPanel
}, ref) => {
  // Access settings and updater from SettingsContext
  const { settings, updateSettings } = useSettings();
  const muiTheme = useTheme();
  const theme = getTheme(settings.theme);
  // Inject MUI spacing function into custom theme for compatibility
  (theme as any).spacing = muiTheme.spacing;
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [logStatus, setLogStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync activeTab when defaultTab changes (e.g., if parent wants to programmatically switch)
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  
  const renderAnalysisSettings = () => {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: theme.spacing(2) }}>
        
        
          {/* Automation dropdown, batch limit slider, and local-mode alert removed – analysis is always user-initiated */}
          
          {/* Analyze Component Relationships toggle removed – always enabled */}
          
          {/* Generate Attack Path Analysis toggle removed – always enabled */}
          
          {/* Threat Analysis Logging */}
        {(
          <CompactCard>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Threat Analysis Logging
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={settings.threatAnalysisLogging?.enabled || false}
                  onChange={async (e) => {
                    const enabled = e.target.checked;
                    if (enabled && !settings.threatAnalysisLogging?.logFilePath) {
                      const { threatAnalysisLogger } = await import('../services/ThreatAnalysisLogger');
                      const defaultPath = await threatAnalysisLogger.getDefaultLogPath();
                      updateSettings({ 
                        threatAnalysisLogging: { 
                          ...settings.threatAnalysisLogging,
                          enabled,
                          logFilePath: defaultPath,
                          userHasSetPreference: true
                        } 
                      });
                      await threatAnalysisLogger.initialize({ 
                        ...settings.threatAnalysisLogging,
                        enabled,
                        logFilePath: defaultPath
                      });
                    } else {
                      updateSettings({ 
                        threatAnalysisLogging: { 
                          ...settings.threatAnalysisLogging,
                          enabled,
                          userHasSetPreference: true
                        } 
                      });
                      const { threatAnalysisLogger } = await import('../services/ThreatAnalysisLogger');
                      threatAnalysisLogger.updateOptions({ enabled });
                    }
                  }}
                />
              }
              label="Enable Threat Analysis Logging"
              sx={{ mb: 2 }}
            />
            
            {settings.threatAnalysisLogging?.enabled && (
              <>
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Log Level</InputLabel>
                  <Select
                    value={settings.threatAnalysisLogging?.logLevel || 'verbose'}
                    onChange={async (e) => {
                      const logLevel = e.target.value as 'minimal' | 'standard' | 'verbose';
                      updateSettings({
                        threatAnalysisLogging: {
                          ...settings.threatAnalysisLogging,
                          logLevel
                        }
                      });
                      const { threatAnalysisLogger } = await import('../services/ThreatAnalysisLogger');
                      threatAnalysisLogger.updateOptions({ logLevel });
                    }}
                    label="Log Level"
                  >
                    <MenuItem value="minimal">Minimal - Threats only</MenuItem>
                    <MenuItem value="standard">Standard - Threats and metadata</MenuItem>
                    <MenuItem value="verbose">Verbose - Full context and data</MenuItem>
                  </Select>
                </FormControl>
                
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={settings.threatAnalysisLogging?.includeFullContext ?? true}
                      onChange={async (e) => {
                        updateSettings({
                          threatAnalysisLogging: {
                            ...settings.threatAnalysisLogging,
                            includeFullContext: e.target.checked
                          }
                        });
                        const { threatAnalysisLogger } = await import('../services/ThreatAnalysisLogger');
                        threatAnalysisLogger.updateOptions({ includeFullContext: e.target.checked });
                      }}
                    />
                  }
                  label="Include full analysis context"
                  sx={{ mb: 1 }}
                />
                
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={settings.threatAnalysisLogging?.includeNodeData ?? true}
                      onChange={async (e) => {
                        updateSettings({
                          threatAnalysisLogging: {
                            ...settings.threatAnalysisLogging,
                            includeNodeData: e.target.checked
                          }
                        });
                        const { threatAnalysisLogger } = await import('../services/ThreatAnalysisLogger');
                        threatAnalysisLogger.updateOptions({ includeNodeData: e.target.checked });
                      }}
                    />
                  }
                  label="Include complete node/edge data"
                />
                {/* Log File Path */}
                <TextField
                  fullWidth
                  label="Log File Path"
                  value={settings.threatAnalysisLogging?.logFilePath || ''}
                  onChange={async (e) => {
                    const logFilePath = e.target.value;
                    updateSettings({
                      threatAnalysisLogging: {
                        ...settings.threatAnalysisLogging,
                        logFilePath,
                        userHasSetPreference: true
                      }
                    });
                    const { threatAnalysisLogger } = await import('../services/ThreatAnalysisLogger');
                    threatAnalysisLogger.updateOptions({ logFilePath });
                  }}
                  helperText="Full path to log file. Default: Documents/AI-Threat-Modeler/threat-analysis-YYYY-MM-DD.log"
                  size="small"
                  sx={{ mb: 2 }}
                />

                <Button
                  variant="outlined"
                  onClick={async () => {
                    const { threatAnalysisLogger } = await import('../services/ThreatAnalysisLogger');
                    const success = await threatAnalysisLogger.testLogging();
                    setLogStatus({
                      type: success ? 'success' : 'error',
                      message: success
                        ? `Test entry written to: ${threatAnalysisLogger.getLogFilePath()}`
                        : 'Failed to write test entry. Check path and permissions.'
                    });
                  }}
                  disabled={!settings.threatAnalysisLogging?.enabled}
                  sx={{
                    alignSelf: 'flex-start',
                    textTransform: 'none',
                    mb: 1
                  }}
                >
                  Test Logging
                </Button>

                {logStatus && (
                  <Alert
                    severity={logStatus.type}
                    onClose={() => setLogStatus(null)}
                    sx={{ mt: 1 }}
                  >
                    {logStatus.message}
                  </Alert>
                )}
              </>
            )}
          </CompactCard>
        )}
        
        <Divider sx={{ borderColor: theme.colors.border }} />
        
        {/* SECURITY OPERATIONS SETTINGS REMOVED */}
        
        {/* Context Optimization card removed – always enabled by default */}
      </Box>
    );
  };

  return (
    <PanelContainer>
      <PanelHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Security Analysis
          </Typography>
        </Box>
      </PanelHeader>
      
      <Tabs 
        value={activeTab} 
        onChange={(_, newValue) => setActiveTab(newValue)}
        sx={{ 
          minHeight: 36,
          borderBottom: `1px solid ${theme.colors.border}`,
          '& .MuiTab-root': {
            flex: 1,
            minWidth: 0,
            minHeight: 36,
            fontSize: '0.875rem',
            textTransform: 'none',
            px: 1,
          }
        }}
      >
        <Tab label="AI Threat Analysis" icon={<Security sx={{ fontSize: 16 }} />} iconPosition="start" />
        <Tab label="Analysis Settings" icon={<Settings sx={{ fontSize: 16 }} />} iconPosition="start" />
      </Tabs>
      
      <ContentArea>
        {/* Threat Analysis Tab */}
        {activeTab === 0 && (
          <ThreatAnalysisPanel
            ref={ref}
            nodes={nodes}
            edges={edges}
            selectedNodes={selectedNodes}
            onNodesUpdate={onNodesUpdate}
            onEdgesUpdate={onEdgesUpdate}
            onCenterComponent={onCenterComponent}
            onSelectedNodesChange={onSelectedNodesChange}
            onOpenThreatIntelPanel={onOpenThreatIntelPanel}
          />
        )}
        
        {/* Settings Tab */}
        {activeTab === 1 && (
          <Box sx={{ padding: theme.spacing(1.5) }}>
            {renderAnalysisSettings()}
          </Box>
        )}
      </ContentArea>
    </PanelContainer>
  );
});

ThreatAnalysisMainPanel.displayName = 'ThreatAnalysisMainPanel';

export default ThreatAnalysisMainPanel;
