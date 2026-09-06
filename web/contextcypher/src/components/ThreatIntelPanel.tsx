// src/components/ThreatIntelPanel.tsx
import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Tooltip,
  useTheme,
  Snackbar,
  Alert,
  FormControlLabel,
  Switch,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  LinearProgress,
  alpha
} from '@mui/material';
import { X, Check, Shield, Upload, Trash2, FileText } from 'lucide-react';
import { useAnalysisContext } from './AnalysisContextProvider';
import { spacing, transitions } from '../styles/Theme';
import { styled } from '@mui/material/styles';
import { threatIntelExtractor, ExtractedThreatIntel } from '../services/ThreatIntelExtractor';
import { DiagramData } from '../types/AnalysisTypes';
import useViewportLayout from '../hooks/useViewportLayout';

interface ThreatIntelPanelProps {
  open: boolean;
  onClose: () => void;
  embedded?: boolean;
}

// Styled components to match AnalysisPanel
const PanelContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  width: '100%',
  backgroundColor: theme.colors.background,
}));

const PanelHeader = styled(Box)(({ theme }) => ({
  padding: spacing.md,
  backgroundColor: theme.colors.surface,
  borderBottom: `1px solid ${theme.colors.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  minHeight: '48px',
}));

const ContentContainer = styled(Box)(({ theme }) => ({
  flex: '1 1 0',
  overflowY: 'auto',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.lg,
  backgroundColor: theme.colors.background,
  minHeight: 0, // Important for proper flex behavior
  '&::-webkit-scrollbar': {
    width: '8px',
  },
  '&::-webkit-scrollbar-track': {
    background: theme.colors.background,
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.colors.border,
    borderRadius: '4px',
    '&:hover': {
      background: theme.colors.surfaceHover,
    },
  },
  WebkitOverflowScrolling: 'touch',
}));

// Removed heavy StyledTextField in favor of EditableTextArea

const ActionButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.colors.primary,
  color: theme.palette.primary.contrastText,
  fontWeight: 600,
  fontSize: '13px',
  padding: `6px 16px`,
  borderRadius: '6px',
  textTransform: 'none',
  transition: transitions.default,
  minWidth: 'auto',
  '&:hover': {
    backgroundColor: theme.colors.primary,
    filter: 'brightness(1.1)',
  },
  '&.Mui-disabled': {
    backgroundColor: `${theme.colors.primary}44`,
    color: `${theme.palette.primary.contrastText}88`,
  },
}));

const SecondaryButton = styled(Button)(({ theme }) => ({
  color: theme.colors.textPrimary,
  borderColor: theme.colors.border,
  fontSize: '13px',
  padding: `6px 16px`,
  borderRadius: '6px',
  textTransform: 'none',
  transition: transitions.default,
  minWidth: 'auto',
  '&:hover': {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceHover,
  },
}));

const FooterContainer = styled(Box)(({ theme }) => ({
  padding: spacing.md,
  borderTop: `1px solid ${theme.colors.border}`,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: spacing.sm,
  backgroundColor: theme.colors.surface,
}));

const InfoBox = styled(Box)(({ theme }) => ({
  backgroundColor: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: '8px',
  padding: spacing.md,
  marginBottom: spacing.md,
}));

// Lightweight editable textarea to avoid heavy MUI TextField overhead with large content
const EditableTextArea = styled('textarea')(({ theme }) => ({
  width: '100%',
  minHeight: '300px',
  padding: '12px',
  borderRadius: '8px',
  border: `1px solid ${theme.colors.border}`,
  backgroundColor: theme.colors.surface,
  color: theme.colors.textPrimary,
  fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
  fontSize: '13px',
  lineHeight: 1.55,
  resize: 'vertical',
  outline: 'none',
  '&:focus': {
    borderColor: theme.colors.primary,
    boxShadow: `0 0 0 2px ${alpha(theme.colors.primary, 0.15)}`,
  },
  '&::-webkit-scrollbar': { width: '8px' },
  '&::-webkit-scrollbar-track': { background: theme.colors.background },
  '&::-webkit-scrollbar-thumb': {
    background: theme.colors.border,
    borderRadius: '4px',
  },
}));

// Helper function to format threat intel for display
const formatThreatIntel = (intel: any): string => {
  if (!intel) return '';

  const sections = [];

  // Format the threat intelligence in a structured way
  if (intel.recentCVEs) {
    sections.push('## Recent CVEs\n' + intel.recentCVEs);
  }

  if (intel.knownIOCs) {
    sections.push('## Known IOCs (Indicators of Compromise)\n' + intel.knownIOCs);
  }

  if (intel.threatActors) {
    sections.push('## Threat Actors\n' + intel.threatActors);
  }

  if (intel.campaignInfo) {
    sections.push('## Campaign Information\n' + intel.campaignInfo);
  }

  if (intel.attackPatterns) {
    sections.push('## Attack Patterns\n' + intel.attackPatterns);
  }

  if (intel.mitigations) {
    sections.push('## Recommended Mitigations\n' + intel.mitigations);
  }

  // Handle CVEs if extracted
  if (intel.cves) {
    sections.push('## Extracted CVEs\n' + intel.cves);
  }

  // Handle raw intel if present
  if (intel.rawIntel) {
    sections.push('## Raw Intelligence Data\n' + intel.rawIntel);
  }

  // Handle any other custom sections
  Object.keys(intel).forEach(key => {
    if (!['recentCVEs', 'knownIOCs', 'threatActors', 'campaignInfo', 'attackPatterns', 'mitigations', 'cves', 'rawIntel'].includes(key)) {
      sections.push(`## ${key}\n${intel[key]}`);
    }
  });

  return sections.join('\n\n');
};

// Helper function to format extracted threat intelligence for display
const formatExtractedIntel = (extractedIntel: ExtractedThreatIntel): string => {
  const sections = [];

  if (extractedIntel.recentCVEs) {
    sections.push(`## Recent CVEs\n${extractedIntel.recentCVEs}`);
  }

  if (extractedIntel.knownIOCs) {
    sections.push(`## Known IOCs\n${extractedIntel.knownIOCs}`);
  }

  if (extractedIntel.campaignInfo) {
    sections.push(`## Campaign Information\n${extractedIntel.campaignInfo}`);
  }

  if (extractedIntel.rawIntelligence) {
    sections.push(`## Raw Threat Intelligence\n${extractedIntel.rawIntelligence}`);
  }

  if (extractedIntel.intelligenceDate) {
    sections.push(`## Intelligence Date\n${extractedIntel.intelligenceDate}`);
  }

  return sections.join('\n\n');
};

// Helper function to parse edited threat intel back to structured format
const parseThreatIntel = (text: string): any => {
  const intel: any = {};

  // First, try to parse structured sections
  const sections = text.split(/^## /m).filter(s => s.trim());

  if (sections.length > 1) {
    // If we have sections, parse them
    sections.forEach(section => {
      const lines = section.split('\n');
      const header = lines[0].trim();
      const content = lines.slice(1).join('\n').trim();

      switch (header) {
        case 'Recent CVEs':
          intel.recentCVEs = content;
          break;
        case 'Known IOCs (Indicators of Compromise)':
          intel.knownIOCs = content;
          break;
        case 'Threat Actors':
          intel.threatActors = content;
          break;
      case 'Campaign Information':
        intel.campaignInfo = content;
        break;
      case 'Attack Patterns':
        intel.attackPatterns = content;
        break;
      case 'Recommended Mitigations':
        intel.mitigations = content;
        break;
      default:
        // Store any other sections generically
        intel[header] = content;
        break;
    }
  });
  } else {
    // If no sections found, treat as raw unstructured data
    // Try to extract some common patterns
    const cvePattern = /CVE-\d{4}-\d{4,}/gi;
    const cves = text.match(cvePattern);
    if (cves && cves.length > 0) {
      intel.cves = cves.join(', ');
    }

    // Store the full text as raw intel
    intel.rawIntel = text;
  }

  return intel;
};

const ThreatIntelPanel: React.FC<ThreatIntelPanelProps> = ({
  open,
  onClose,
  embedded = false
}) => {
  const theme = useTheme();
  const { viewportTier, panelWidths } = useViewportLayout();
  const isPhoneViewport = viewportTier === 'xs' || viewportTier === 'sm';
  const drawerWidth = isPhoneViewport ? '100vw' : `${Math.round(panelWidths.analysis)}px`;
  const { state, setImportedThreatIntel, setProcessedThreatIntel } = useAnalysisContext();
  // Always-editable buffer
  const [intelText, setIntelText] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [showSuccessSnackbar, setShowSuccessSnackbar] = useState(false);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [showImportSuccess, setShowImportSuccess] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importProgress, setImportProgress] = useState({
    stage: '' as 'reading' | 'processing' | 'analyzing' | 'completing',
    method: '' as 'ai' | 'fallback' | 'filtering' | '',
    message: '',
    progress: 0
  });
  // Initialize editor content when context changes
  useEffect(() => {
    const intel = state.importedThreatIntel;
    if (!intel) {
      setIntelText('');
      setIsDirty(false);
      return;
    }
    const newText = intel.raw?.trim()
      ? intel.raw
      : (intel.processed && Object.keys(intel.processed).length > 0)
        ? formatThreatIntel(intel.processed)
        : '';
    setIntelText(newText);
    setIsDirty(false);
  }, [state.importedThreatIntel]);

  // Remove edit mode logic entirely

  const handleSave = () => {
    if (!intelText.trim()) {
      setImportedThreatIntel(null);
      setIsDirty(false);
      setShowSuccessSnackbar(true);
      return;
    }

    // Parse the edited text back to structured format
    const parsedIntel = parseThreatIntel(intelText);

    // Update the threat intel in context
    const updatedIntel = {
      raw: state.importedThreatIntel?.raw || intelText,
      processed: parsedIntel,
      metadata: state.importedThreatIntel?.metadata || {
        totalImported: 1,
        relevantExtracted: Object.keys(parsedIntel).length,
        importDate: new Date().toISOString(),
        source: 'Manual Edit'
      }
    };

    setImportedThreatIntel(updatedIntel);
    setIsDirty(false);
    setShowSuccessSnackbar(true);
  };

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setShowSuccessSnackbar(false);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Open progress dialog
    setImportDialogOpen(true);
    setImportProgress({
      stage: 'reading',
      method: '',
      message: 'Reading file...',
      progress: 10
    });

    try {
      const text = await file.text();

      // Update progress
      setImportProgress({
        stage: 'processing',
        method: '',
        message: 'Parsing threat intelligence format...',
        progress: 30
      });

      // Parse the threat intel using ThreatIntelExtractor
      const parsedIntel = await threatIntelExtractor.parseThreatIntel(text, file.name);

      // Update progress - extracting relevant data
      setImportProgress({
        stage: 'analyzing',
        method: 'filtering',
        message: 'Filtering relevant threats for your system...',
        progress: 60
      });

      // Create diagram data from current context
      const diagramData: DiagramData = {
        nodes: state.currentState?.nodes || [],
        edges: state.currentState?.edges || [],
        metadata: state.currentState?.metadata || {}
      };

      // Extract relevant threat intelligence based on diagram context
      const extractedIntel = await threatIntelExtractor.extractRelevant(
        parsedIntel,
        diagramData,
        {
          maxItems: 100, // Limit to top 100 most relevant items
          timeWindow: 365, // 1 year window
          confidenceThreshold: 0.5 // Only include items with 50%+ relevance
        }
      );

      // Update progress method based on what was actually used
      const extractionMethod = extractedIntel.metadata?.method || extractedIntel.metadata?.extractionMetadata?.method;
      if (extractionMethod === 'direct_ai_processing' || extractionMethod === 'langextract') {
        setImportProgress({
          stage: 'analyzing',
          method: 'ai',
          message: 'AI-powered analysis completed successfully!',
          progress: 90
        });
      } else {
        setImportProgress({
          stage: 'analyzing',
          method: 'fallback',
          message: 'Pattern matching analysis completed.',
          progress: 90
        });
      }

      // Format the extracted intelligence for display
      const formattedIntel = formatExtractedIntel(extractedIntel);

      let finalIntel;
      if (importMode === 'append' && state.importedThreatIntel) {
        // Append mode: merge with existing data
        const existingText = (intelText || '').trim();
        const combinedText = existingText ? existingText + '\n\n' + formattedIntel : formattedIntel;
        const combinedParsed = parseThreatIntel(combinedText);

        finalIntel = {
          raw: text, // Store original raw content
          processed: combinedParsed,
          filtered: formattedIntel, // Store filtered content
          metadata: {
            totalImported: parsedIntel.items.length,
            relevantExtracted: extractedIntel.metadata.relevantExtracted,
            importDate: new Date().toISOString(),
            source: `${state.importedThreatIntel.metadata?.source || 'Previous'} + ${file.name}`,
            format: parsedIntel.format,
            topThreats: extractedIntel.metadata.topThreats,
            matchedComponents: extractedIntel.metadata.matchedComponents
          }
        };

        setIntelText(combinedText);

        // Check for filtering information in extraction metadata
        const extractionMeta = extractedIntel.metadata?.extractionMetadata || {};
        const filterMessage = extractionMeta.message;
        const filterReduction = extractionMeta.filter_reduction;

        let importMsg = `Appended ${extractedIntel.metadata.relevantExtracted} relevant threats from ${parsedIntel.items.length} total items`;

        if (filterMessage) {
          importMsg = `Appended: ${filterMessage}`;
        } else if (filterReduction && filterReduction > 0) {
          importMsg += ` (${filterReduction}% filtered out as irrelevant)`;
        }

        setImportMessage(importMsg);
      } else {
        // Replace mode: replace existing content
        finalIntel = {
          raw: text, // Store original raw content
          processed: parseThreatIntel(formattedIntel),
          filtered: formattedIntel, // Store filtered content
          metadata: {
            totalImported: parsedIntel.items.length,
            relevantExtracted: extractedIntel.metadata.relevantExtracted,
            importDate: new Date().toISOString(),
            source: file.name,
            format: parsedIntel.format,
            topThreats: extractedIntel.metadata.topThreats,
            matchedComponents: extractedIntel.metadata.matchedComponents
          }
        };

        setIntelText(formattedIntel);

        // Check for filtering information in extraction metadata
        const extractionMeta = extractedIntel.metadata?.extractionMetadata || {};
        const filterMessage = extractionMeta.message;
        const filterReduction = extractionMeta.filter_reduction;

        let importMsg = `Imported ${extractedIntel.metadata.relevantExtracted} relevant threats from ${parsedIntel.items.length} total items`;

        if (filterMessage) {
          importMsg = filterMessage;
        } else if (filterReduction && filterReduction > 0) {
          importMsg += ` (${filterReduction}% filtered out as irrelevant)`;
        }

        setImportMessage(importMsg);
      }

      // Update progress to completing
      setImportProgress({
        stage: 'completing',
        method: 'filtering',
        message: `Filtered ${extractedIntel.metadata.relevantExtracted} relevant items from ${parsedIntel.items.length} total`,
        progress: 90
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      // Save directly to context
      setImportedThreatIntel(finalIntel);
      setIsDirty(false);
      setShowImportSuccess(true);

      // Close dialog after a short delay
      setTimeout(() => {
        setImportDialogOpen(false);
      }, 500);

      // Clear the file input
      event.target.value = '';
    } catch (error) {
      console.error('Error importing file:', error);
      setImportMessage('Error importing file');
      setShowImportSuccess(true);
      setImportDialogOpen(false);
    }
  };

  const handleClearIntel = () => {
    setIntelText('');
    setImportedThreatIntel(null);
    setIsDirty(false);
    setImportMessage('Threat intelligence cleared');
    setShowImportSuccess(true);
  };

  const handleCloseImportSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setShowImportSuccess(false);
  };

  // Import Progress Dialog
  const importProgressDialog = (
    <Dialog
      open={importDialogOpen}
      fullScreen={isPhoneViewport}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: theme.colors.surface,
          backgroundImage: 'none',
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Shield size={20} color={theme.colors.primary} />
          <Typography variant="h6">Importing Threat Intelligence</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          <Typography variant="body2" sx={{ mb: 3 }}>
            {importProgress.message}
          </Typography>

          <LinearProgress
            variant="determinate"
            value={importProgress.progress}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: alpha(theme.colors.primary, 0.1),
              '& .MuiLinearProgress-bar': {
                backgroundColor: theme.colors.primary,
                borderRadius: 4,
              }
            }}
          />

          {importProgress.method && (
            <Box sx={{ mt: 2, p: 2, backgroundColor: alpha(theme.colors.info, 0.1), borderRadius: 1 }}>
              <Typography variant="caption" sx={{ color: theme.colors.info }}>
                {importProgress.method === 'ai'
                  ? '🤖 Using AI-powered analysis to intelligently match threats to your system components'
                  : '🔍 Using pattern matching to identify relevant threats based on keywords and CVE numbers'
                }
              </Typography>
            </Box>
          )}

          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} thickness={2} />
            <Typography variant="caption" sx={{ color: theme.colors.textSecondary }}>
              {importProgress.stage === 'reading' && 'Reading and parsing file contents...'}
              {importProgress.stage === 'processing' && 'Extracting threat data from file...'}
              {importProgress.stage === 'analyzing' && 'Analyzing threats for relevance to your system...'}
              {importProgress.stage === 'completing' && 'Finalizing import...'}
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={() => setImportDialogOpen(false)}
          disabled={importProgress.stage !== 'completing'}
          size="small"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );

  const panelContent = (
    <PanelContainer className="threat-intel-panel">
      {/* Header */}
      <PanelHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Shield size={20} style={{ color: theme.colors.primary }} />
          <Typography variant="h6" sx={{ color: theme.colors.textPrimary, fontWeight: 600 }}>
            Threat Intelligence
          </Typography>
        </Box>
        <Tooltip title="Close Threat Intelligence" arrow placement="bottom">
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              color: theme.colors.textSecondary,
              '&:hover': {
                backgroundColor: theme.colors.surfaceHover,
                color: theme.colors.textPrimary,
              }
            }}
          >
            <X size={20} />
          </IconButton>
        </Tooltip>
      </PanelHeader>

      {/* Import Controls */}
      <Box sx={{
        padding: spacing.md,
        backgroundColor: theme.colors.surface,
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
        flexWrap: 'wrap'
      }}>
        <input
          type="file"
          id="threat-intel-file-input"
          accept=".txt,.json,.csv"
          onChange={handleImportFile}
          style={{ display: 'none' }}
        />

        <Tooltip title="Import threat intelligence from file">
          <Button
            component="label"
            htmlFor="threat-intel-file-input"
            variant="outlined"
            startIcon={<Upload size={16} />}
            sx={{
              borderColor: theme.colors.border,
              color: theme.colors.textPrimary,
              textTransform: 'none',
              fontSize: '13px',
              '&:hover': {
                borderColor: theme.colors.primary,
                backgroundColor: theme.colors.surfaceHover,
              }
            }}
          >
            Import from File
          </Button>
        </Tooltip>

        <Tooltip title="Clear all threat intelligence">
          <Button
            onClick={handleClearIntel}
            variant="outlined"
            startIcon={<Trash2 size={16} />}
            sx={{
              borderColor: theme.colors.border,
              color: theme.colors.error,
              textTransform: 'none',
              fontSize: '13px',
              '&:hover': {
                borderColor: theme.colors.error,
                backgroundColor: `${theme.colors.error}08`,
              }
            }}
          >
            Clear All
          </Button>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        <Tooltip
          title={
            importMode === 'append'
              ? "New threat intelligence will be added to existing data without removing anything"
              : "New threat intelligence will completely replace all existing data"
          }
          arrow
        >
          <FormControlLabel
            control={
              <Switch
                checked={importMode === 'append'}
                onChange={(e) => setImportMode(e.target.checked ? 'append' : 'replace')}
                size="small"
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: theme.colors.primary,
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: theme.colors.primary,
                  },
                }}
              />
            }
            label={
              <Typography variant="body2" sx={{ color: theme.colors.textPrimary }}>
                {importMode === 'append' ? 'Append to existing' : 'Replace existing'}
              </Typography>
            }
            sx={{ marginLeft: 0 }}
          />
        </Tooltip>
      </Box>

      {/* Content Area */}
      <ContentContainer>
        {state.importedThreatIntel?.metadata && (
          <InfoBox>
            <Typography variant="caption" sx={{ color: theme.colors.textSecondary }}>
              Source: {state.importedThreatIntel.metadata.source} |
              Format: {state.importedThreatIntel.metadata.format || 'Unknown'} |
              Imported: {new Date(state.importedThreatIntel.metadata.importDate).toLocaleString()}
            </Typography>
            <Typography variant="caption" sx={{ color: theme.colors.textSecondary, display: 'block', mt: 0.5 }}>
              Filtered: {state.importedThreatIntel.metadata.relevantExtracted} relevant threats from {state.importedThreatIntel.metadata.totalImported} total items
              {state.importedThreatIntel.metadata.matchedComponents && (
                <> | Matched: {state.importedThreatIntel.metadata.matchedComponents.join(', ')}</>
              )}
            </Typography>
          </InfoBox>
        )}

        <Box>
          <Typography variant="body2" sx={{
            color: theme.colors.textSecondary,
            marginBottom: spacing.md,
            lineHeight: 1.6
          }}>
            Edit the threat intelligence used for analysis. This is included in the AI context along with your diagram and should be validated for applicability.
          </Typography>

          <EditableTextArea
            value={intelText}
            onChange={(e) => { setIntelText(e.target.value); setIsDirty(true); }}
            placeholder={`## Recent CVEs\nCVE-2024-1234: Critical vulnerability in component X affecting versions < 2.0\n\n## Known IOCs (Indicators of Compromise)\nIP: 192.168.1.100 - Known C2 server\nDomain: malicious-domain.com - Phishing site\nSHA256: abc123... - Malware hash\n\n## Threat Actors\nAPT29 (Cozy Bear) - Active campaigns targeting infrastructure\n\n## Campaign Information\nOperation X targeting financial services using spear phishing\n\n## Attack Patterns\nT1190 - Exploit Public-Facing Application\nT1078 - Valid Accounts\n\n## Recommended Mitigations\n- Patch all systems to latest versions\n- Implement MFA on all accounts\n- Monitor for suspicious login attempts`}
          />
        </Box>
      </ContentContainer>

      {/* Footer */}
      <FooterContainer>
        <SecondaryButton onClick={onClose} variant="outlined">
          Close
        </SecondaryButton>
        <ActionButton
          onClick={handleSave}
          disabled={!isDirty}
          variant="contained"
        >
          Save Changes
        </ActionButton>
      </FooterContainer>
    </PanelContainer>
  );

  // If embedded, return content directly without drawer wrapper
  if (embedded) {
    return (
      <>
        {panelContent}
        <Snackbar
          open={showSuccessSnackbar}
          autoHideDuration={3000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity="success"
            sx={{
              width: '100%',
              backgroundColor: theme.colors.success || '#4caf50',
              color: '#fff',
              '& .MuiAlert-icon': {
                color: '#fff'
              }
            }}
            icon={<Check size={20} />}
          >
            Threat intelligence saved successfully
          </Alert>
        </Snackbar>
        <Snackbar
          open={showImportSuccess}
          autoHideDuration={3000}
          onClose={handleCloseImportSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={handleCloseImportSnackbar}
            severity="success"
            sx={{
              width: '100%',
              backgroundColor: theme.colors.success || '#4caf50',
              color: '#fff',
              '& .MuiAlert-icon': {
                color: '#fff'
              }
            }}
            icon={<FileText size={20} />}
          >
            {importMessage}
          </Alert>
        </Snackbar>
        {importProgressDialog}
      </>
    );
  }

  // Otherwise, render as drawer (for standalone usage)
  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        variant={isPhoneViewport ? 'temporary' : 'persistent'}
        sx={{
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            maxWidth: '100vw',
            backgroundColor: theme.colors.background,
            borderLeft: `1px solid ${theme.colors.border}`,
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        {panelContent}
      </Drawer>
      <Snackbar
        open={showSuccessSnackbar}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity="success"
          sx={{
            width: '100%',
            backgroundColor: theme.colors.success || '#4caf50',
            color: '#fff',
            '& .MuiAlert-icon': {
              color: '#fff'
            }
          }}
          icon={<Check size={20} />}
        >
          Threat intelligence saved successfully
        </Alert>
      </Snackbar>
      <Snackbar
        open={showImportSuccess}
        autoHideDuration={3000}
        onClose={handleCloseImportSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseImportSnackbar}
          severity="success"
          sx={{
            width: '100%',
            backgroundColor: theme.colors.success || '#4caf50',
            color: '#fff',
            '& .MuiAlert-icon': {
              color: '#fff'
            }
          }}
          icon={<FileText size={20} />}
        >
          {importMessage}
        </Alert>
      </Snackbar>
      {importProgressDialog}
    </>
  );
};

export default ThreatIntelPanel;
