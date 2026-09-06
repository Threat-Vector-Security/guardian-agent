import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  Checkbox,
  Collapse,
  Chip,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Security,
  Computer,
  CloudUpload,
  Info,
  Warning,
  ExpandMore,
  ExpandLess,
  Shield,
  Visibility,
  CheckCircle,
  MergeType,
  SwapHoriz
} from '@mui/icons-material';
import { styled, useTheme } from '@mui/material/styles';
import { useSettings } from '../settings/SettingsContext';

export type ImportMode = 'replace' | 'merge';

export interface ImportOptions {
  method: 'local' | 'ai';
  aiProvider?: string;
  sanitizeData: boolean;
  previewBeforeSend: boolean;
  userConsent: boolean;
  importMode: ImportMode;
}

interface ImportOptionsDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (options: ImportOptions) => void;
  fileName: string;
  fileContent?: string;
  format: string;
}

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    minWidth: '600px',
    maxWidth: '700px',
    borderRadius: '12px',
    border: `1px solid ${theme.colors.border}`,
  },
}));

const OptionCard = styled(Box)(({ theme }) => ({
  backgroundColor: theme.colors.background,
  border: `2px solid transparent`,
  borderRadius: '8px',
  padding: theme.spacing(2.5),
  marginBottom: theme.spacing(2),
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  '&:hover': {
    borderColor: theme.colors.primary + '40',
    backgroundColor: theme.colors.surface,
  },
  '&.selected': {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10',
  },
}));

const FeatureChip = styled(Chip)(({ theme }) => ({
  backgroundColor: theme.colors.primary + '20',
  color: theme.colors.primary,
  fontSize: '0.75rem',
  height: 22,
  marginRight: theme.spacing(0.5),
  '& .MuiChip-icon': {
    fontSize: '0.9rem',
  },
}));

export const ImportOptionsDialog: React.FC<ImportOptionsDialogProps> = ({
  open,
  onClose,
  onConfirm,
  fileName,
  fileContent,
  format
}) => {
  const theme = useTheme();
  const { settings } = useSettings();
  const [options, setOptions] = useState<ImportOptions>({
    method: 'local',
    aiProvider: settings.api.provider,
    sanitizeData: false,
    previewBeforeSend: true,
    userConsent: false,
    importMode: 'replace'
  });
  const [showPreview, setShowPreview] = useState(false);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);

  const handleMethodChange = (method: 'local' | 'ai') => {
    setOptions(prev => ({ ...prev, method, userConsent: false }));
  };

  const handleConfirm = () => {
    if (options.method === 'ai' && !options.userConsent) {
      return; // Don't proceed without consent
    }
    onConfirm(options);
  };

  const aiProviderName = settings.api.provider === 'local' ? 'Local LLM (Ollama)' :
                         settings.api.provider === 'openai' ? 'OpenAI' :
                         settings.api.provider === 'anthropic' ? 'Anthropic Claude' :
                         settings.api.provider === 'gemini' ? 'Google Gemini' : 
                         'Unknown Provider';

  const isOfflineProvider = settings.api.provider === 'local';

  return (
    <StyledDialog open={open} onClose={onClose} maxWidth="md">
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Import Options for {fileName}</Typography>
          <Chip 
            label={format.toUpperCase()} 
            size="small" 
            sx={{ backgroundColor: theme.colors.primary + '20', color: theme.colors.primary }}
          />
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" sx={{ color: theme.colors.textSecondary, mb: 3 }}>
          Choose how to process your {format} diagram for import into ContextCypher format.
        </Typography>

        {/* Import Mode Selection */}
        <Box sx={{ mb: 3, p: 2, backgroundColor: theme.colors.background, borderRadius: 2 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            Import Mode
          </Typography>
          <RadioGroup
            value={options.importMode}
            onChange={(e) => setOptions(prev => ({ ...prev, importMode: e.target.value as ImportMode }))}
            row
          >
            <FormControlLabel
              value="replace"
              control={<Radio />}
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  <SwapHoriz fontSize="small" />
                  <span>Replace - Clear existing diagram</span>
                </Box>
              }
            />
            <FormControlLabel
              value="merge"
              control={<Radio />}
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  <MergeType fontSize="small" />
                  <span>Merge - Add to existing diagram</span>
                </Box>
              }
            />
          </RadioGroup>
          <Typography variant="caption" sx={{ color: theme.colors.textSecondary }}>
            {options.importMode === 'replace'
              ? 'Current diagram will be cleared before importing'
              : 'Imported content will be added to your existing diagram'}
          </Typography>
        </Box>

        {/* Local Parsing Option */}
        <OptionCard 
          className={options.method === 'local' ? 'selected' : ''}
          onClick={() => handleMethodChange('local')}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Computer sx={{ color: theme.colors.primary, mt: 0.5 }} />
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Local Processing
                </Typography>
                <FeatureChip icon={<Shield />} label="Privacy-First" size="small" />
                <FeatureChip icon={<CheckCircle />} label="No Data Sent" size="small" />
              </Box>
              <Typography variant="body2" sx={{ color: theme.colors.textSecondary, mb: 1 }}>
                Process the diagram entirely on your device using pattern-based parsing.
              </Typography>
              <Typography variant="caption" sx={{ color: theme.colors.textSecondary }}>
                ✓ Complete privacy - no data leaves your device<br />
                ✓ Instant processing<br />
                ✗ May miss complex relationships or context<br />
                ✗ Limited to predefined patterns
              </Typography>
            </Box>
            <Radio
              checked={options.method === 'local'}
              color="primary"
              sx={{ mt: -0.5 }}
            />
          </Box>
        </OptionCard>

        {/* AI-Enhanced Option */}
        <OptionCard 
          className={options.method === 'ai' ? 'selected' : ''}
          onClick={() => handleMethodChange('ai')}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <CloudUpload sx={{ color: theme.colors.primary, mt: 0.5 }} />
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  AI-Enhanced Processing
                </Typography>
                <FeatureChip icon={<Security />} label="Intelligent" size="small" />
                {isOfflineProvider && (
                  <FeatureChip icon={<Shield />} label="Local AI" size="small" />
                )}
              </Box>
              <Typography variant="body2" sx={{ color: theme.colors.textSecondary, mb: 1 }}>
                Use {aiProviderName} to understand and convert your diagram with context awareness.
              </Typography>
              <Typography variant="caption" sx={{ color: theme.colors.textSecondary }}>
                ✓ Understands complex relationships and context<br />
                ✓ Intelligently maps components and security zones<br />
                ✓ Handles non-standard formats better<br />
                {isOfflineProvider ? (
                  <>✓ Processed locally with your Ollama instance</>
                ) : (
                  <>✗ Diagram content sent to {aiProviderName}</>
                )}
              </Typography>
            </Box>
            <Radio
              checked={options.method === 'ai'}
              color="primary"
              sx={{ mt: -0.5 }}
            />
          </Box>
        </OptionCard>

        {/* AI Options (shown when AI is selected) */}
        <Collapse in={options.method === 'ai'}>
          <Box sx={{ mt: 3, p: 2, backgroundColor: theme.colors.background, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              AI Processing Options
            </Typography>
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={options.sanitizeData}
                  onChange={(e) => setOptions(prev => ({ ...prev, sanitizeData: e.target.checked }))}
                  size="small"
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Sanitize sensitive data</Typography>
                  <Typography variant="caption" sx={{ color: theme.colors.textSecondary }}>
                    Replace specific names with generic labels before processing
                  </Typography>
                </Box>
              }
              sx={{ mb: 2 }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={options.previewBeforeSend}
                  onChange={(e) => setOptions(prev => ({ ...prev, previewBeforeSend: e.target.checked }))}
                  size="small"
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Preview data before sending</Typography>
                  <Typography variant="caption" sx={{ color: theme.colors.textSecondary }}>
                    Review exactly what will be sent to the AI service
                  </Typography>
                </Box>
              }
              sx={{ mb: 2 }}
            />

            {/* Privacy Notice */}
            <Alert 
              severity={isOfflineProvider ? "info" : "warning"}
              icon={<Info />}
              sx={{ 
                backgroundColor: isOfflineProvider ? theme.colors.info + '15' : theme.colors.warning + '15',
                border: `1px solid ${isOfflineProvider ? theme.colors.info + '30' : theme.colors.warning + '30'}`,
                '& .MuiAlert-icon': {
                  color: isOfflineProvider ? theme.colors.info : theme.colors.warning,
                },
                mb: 2
              }}
            >
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {isOfflineProvider ? 'Local AI Processing' : 'Data Transmission Notice'}
                </Typography>
                <Typography variant="caption">
                  {isOfflineProvider ? (
                    <>Your diagram will be processed by your local Ollama instance. No data leaves your device.</>
                  ) : (
                    <>Your diagram content will be sent to {aiProviderName} for processing. 
                    Make sure this is acceptable for your security requirements.</>
                  )}
                </Typography>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 0.5, 
                    mt: 1, 
                    cursor: 'pointer',
                    color: theme.colors.primary 
                  }}
                  onClick={() => setShowPrivacyDetails(!showPrivacyDetails)}
                >
                  <Typography variant="caption">Privacy details</Typography>
                  {showPrivacyDetails ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                </Box>
              </Box>
            </Alert>

            <Collapse in={showPrivacyDetails}>
              <Box sx={{ 
                p: 2, 
                mb: 2, 
                backgroundColor: theme.colors.surface, 
                borderRadius: 1,
                border: `1px solid ${theme.colors.border}`
              }}>
                <Typography variant="caption" component="div">
                  <strong>What data is sent:</strong><br />
                  • The complete diagram structure and content<br />
                  • Node labels and descriptions<br />
                  • Connection information<br />
                  • Any metadata in the file<br /><br />
                  
                  <strong>What is NOT sent:</strong><br />
                  • Your file name or path<br />
                  • Your ContextCypher license or settings<br />
                  • Other diagrams or application data<br /><br />
                  
                  <strong>Processing:</strong><br />
                  {isOfflineProvider ? (
                    <>• Processed entirely by your local Ollama server<br />
                    • No internet connection required<br />
                    • Data never leaves your machine</>
                  ) : (
                    <>• Sent over encrypted HTTPS to {aiProviderName}<br />
                    • Processed according to their privacy policy<br />
                    • Not stored after processing (based on API usage)</>
                  )}
                </Typography>
              </Box>
            </Collapse>

            {/* Preview Button */}
            {options.previewBeforeSend && fileContent && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<Visibility />}
                onClick={() => setShowPreview(!showPreview)}
                sx={{ mb: 2 }}
              >
                {showPreview ? 'Hide' : 'Show'} Data Preview
              </Button>
            )}

            {/* Data Preview */}
            <Collapse in={showPreview && options.previewBeforeSend}>
              <Box sx={{ 
                p: 2, 
                mb: 2, 
                backgroundColor: theme.colors.background, 
                borderRadius: 1,
                border: `1px solid ${theme.colors.border}`,
                maxHeight: 200,
                overflow: 'auto'
              }}>
                <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                  {options.sanitizeData ? sanitizeContent(fileContent || '') : fileContent?.substring(0, 1000)}
                  {(fileContent?.length || 0) > 1000 && '...'}
                </Typography>
              </Box>
            </Collapse>

            {/* Consent Checkbox */}
            <Divider sx={{ my: 2 }} />
            <FormControlLabel
              control={
                <Checkbox
                  checked={options.userConsent}
                  onChange={(e) => setOptions(prev => ({ ...prev, userConsent: e.target.checked }))}
                  color="primary"
                />
              }
              label={
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  I understand and consent to {isOfflineProvider ? 
                    'processing this diagram with my local AI' : 
                    `sending this diagram to ${aiProviderName} for processing`}
                </Typography>
              }
            />
          </Box>
        </Collapse>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={options.method === 'ai' && !options.userConsent}
        >
          Import with {options.method === 'local' ? 'Local Processing' : 'AI Enhancement'}
        </Button>
      </DialogActions>
    </StyledDialog>
  );
};

// Helper function to sanitize content
function sanitizeContent(content: string): string {
  // Replace specific patterns with generic ones
  return content
    .replace(/\b(?:[A-Z][a-z]+)+(?:Corp|Inc|LLC|Ltd|Company|Services|Systems)\b/g, '[Company Name]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP Address]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[Email]')
    .replace(/\bhttps?:\/\/[^\s]+\b/g, '[URL]')
    .replace(/\b(?:api|app|web|db|cache|auth)-[a-zA-Z0-9-]+\b/gi, (match) => {
      const prefix = match.split('-')[0];
      return `[${prefix}-instance]`;
    });
}