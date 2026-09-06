/**
 * Generate Diagram Button component for AI-powered diagram generation
 */

import React, { useState, useMemo } from 'react';
import {
  Button,
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  LinearProgress,
  Chip,
  Card,
  CardContent,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio
} from '@mui/material';
import {
  AutoAwesome,
  Save,
  CheckCircle,
  Error as ErrorIcon,
  Close,
  VpnKey,
  Settings as SettingsIcon,
  Architecture,
  AccountTree,
  Merge
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { getTheme, spacing, transitions } from '../styles/Theme';
import { diagramGenerationService } from '../services/DiagramGenerationService';
import { useSettings } from '../settings/SettingsContext';
import { analyzeDiagramContext } from '../api';

type DiagramGenerationType = 'technical' | 'process' | 'hybrid' | 'auto';

const GenerateButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.colors.primary,
  background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
  color: '#ffffff',
  fontWeight: 600,
  fontSize: '14px',
  padding: `${spacing.md} ${spacing.lg}`,
  borderRadius: '8px',
  textTransform: 'none',
  transition: transitions.default,
  border: 'none',
  position: 'relative',
  overflow: 'hidden',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  '&:hover': {
    background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
    filter: 'brightness(1.1)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
    transform: 'translateY(-1px)',
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: '-100%',
    width: '100%',
    height: '100%',
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
    transition: 'left 0.5s ease',
  },
  '&:hover::before': {
    left: '100%',
  },
  '& .MuiButton-startIcon': {
    marginRight: spacing.sm,
    '& svg': {
      fontSize: '20px',
    }
  }
}));

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    backgroundColor: theme.colors.background,
    color: theme.colors.textPrimary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '12px',
  }
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    '& fieldset': {
      borderColor: theme.colors.border,
    },
    '&:hover fieldset': {
      borderColor: theme.colors.primary,
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.colors.primary,
    },
  },
  '& .MuiInputLabel-root': {
    color: theme.colors.textSecondary,
    '&.Mui-focused': {
      color: theme.colors.primary,
    },
  },
}));

const LoadingStep = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: spacing.md,
  padding: spacing.md,
  backgroundColor: theme.colors.surface,
  borderRadius: '8px',
  border: `1px solid ${theme.colors.border}`,
}));

export type SaveConfirmationResult = 'continue' | 'cancel' | 'append';

interface GenerateDiagramButtonProps {
  contextText: string;
  onDiagramGenerated: (diagram: any, shouldMerge?: boolean) => void;
  onSaveConfirmation: () => Promise<SaveConfirmationResult>;
  existingDiagram?: any; // Current diagram for merging
}

type GenerationStep = 'idle' | 'confirming' | 'analyzing' | 'saving' | 'generating' | 'processing' | 'complete' | 'error';

const GenerationTypeCard = styled(Card)(({ theme }) => ({
  cursor: 'pointer',
  border: `2px solid ${theme.colors.border}`,
  transition: transitions.default,
  backgroundColor: theme.colors.surface,
  '&:hover': {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceHover,
  },
  '&.selected': {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}10`,
  }
}));

export const GenerateDiagramButton: React.FC<GenerateDiagramButtonProps> = ({
  contextText,
  onDiagramGenerated,
  onSaveConfirmation,
  existingDiagram
}) => {
  const { settings } = useSettings();
  const currentTheme = useMemo(() => getTheme(settings.theme, settings.customTheme), [settings.theme, settings.customTheme]);
  const [step, setStep] = useState<GenerationStep>('idle');
  const [showDialog, setShowDialog] = useState(false);
  const [systemName, setSystemName] = useState('');
  const [generationType, setGenerationType] = useState<DiagramGenerationType>('auto');
  const [analysisResult, setAnalysisResult] = useState<{
    estimatedNodeCount: number;
    complexity: 'low' | 'medium' | 'high' | 'very-high';
    recommendedMode: 'technical' | 'process' | 'hybrid';
    reasoning: string;
    hasLargeGroups: boolean;
    primarySystemType: 'technical' | 'workflow' | 'mixed';
  } | null>(null);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{ message: string; isApiKeyIssue: boolean; guidance?: string } | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [progressStage, setProgressStage] = useState<string>('');
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [analysisCompleted, setAnalysisCompleted] = useState(false);

  /**
   * Analyze error and return user-friendly message with guidance
   */
  const getErrorDetails = (error: unknown): { message: string; isApiKeyIssue: boolean; guidance?: string } => {
    const errorString = error instanceof Error ? error.message : String(error);
    
    // Check for API key/provider initialization issues
    if (errorString.includes('Provider anthropic not initialized') || 
        errorString.includes('Provider openai not initialized') ||
        errorString.includes('Provider gemini not initialized') ||
        errorString.includes('Please initialize it first') ||
        errorString.includes('API key not found') ||
        errorString.includes('Invalid API key') ||
        errorString.includes('Authentication failed') ||
        errorString.includes('Unauthorized')) {
      
      const provider = settings.api.provider;
      const providerName = provider === 'anthropic' ? 'Anthropic Claude' : 
                          provider === 'openai' ? 'OpenAI' :
                          provider === 'gemini' ? 'Google Gemini' : provider;
      
      return {
        message: `${providerName} API key not configured`,
        isApiKeyIssue: true,
        guidance: `Please configure your ${providerName} API key in Settings → General → API Configuration to use AI diagram generation.`
      };
    }
    
    // Check for timeout issues
    if (errorString.includes('timeout') || 
        errorString.includes('ECONNABORTED') ||
        errorString.includes('exceeded')) {
      return {
        message: 'Request timed out after 10 minutes',
        isApiKeyIssue: false,
        guidance: 'This is an exceptionally large system that exceeded the maximum processing time. This can happen with enterprise-scale systems containing hundreds of components. Please try again - the AI provider may be experiencing high load. If the issue persists, consider reducing the level of detail in your system description.'
      };
    }
    
    // Check for network/connection issues
    if (errorString.includes('Network Error') || 
        errorString.includes('ERR_NETWORK') ||
        errorString.includes('fetch failed') ||
        errorString.includes('Connection refused')) {
      return {
        message: 'Network connection error',
        isApiKeyIssue: false,
        guidance: 'Please check your internet connection and try again. If using a local server, ensure it\'s running on the correct port.'
      };
    }
    
    // Check for rate limiting
    if (errorString.includes('rate limit') || 
        errorString.includes('quota exceeded') ||
        errorString.includes('Too Many Requests')) {
      return {
        message: 'API rate limit exceeded',
        isApiKeyIssue: false,
        guidance: 'You\'ve exceeded the API rate limit for your account. Please wait a few minutes and try again.'
      };
    }
    
    // Generic error handling
    return {
      message: errorString.length > 200 ? errorString.substring(0, 200) + '...' : errorString,
      isApiKeyIssue: false,
      guidance: 'If this problem persists, please check your API configuration in Settings.'
    };
  };

  const handleGenerateClick = () => {
    if (!contextText.trim()) {
      setError('Please provide system context before generating a diagram');
      return;
    }
    
    if (contextText.trim().length < 50) {
      setError('Context is too short. Please provide more detailed system information');
      return;
    }

    // Show confirmation dialog
    setShowDialog(true);
    setStep('confirming');
    setError(null);
    setErrorDetails(null);
    setSystemName('');
    setGenerationType('auto'); // Always default to auto-select
    setAnalysisCompleted(false); // Reset analysis flag
    setAnalysisResult(null); // Clear previous analysis
  };

  // Estimate component count based on context length and content
  const estimateComponentCount = (context: string): number => {
// Count bullet points and dashes which typically indicate components
    const bulletPoints = (context.match(/^[\s]*[-*•]/gm) || []).length;
    const dashItems = (context.match(/\s-\s/g) || []).length;
    
    // Rough estimate: each component description is about 50-100 characters
    const charBasedEstimate = Math.floor(context.length / 75);
    
    // Use the higher of the two estimates
    return Math.max(bulletPoints + dashItems, Math.floor(charBasedEstimate * 0.7));
  };

// Estimate generation time based on context size
  const estimateGenerationTime = (context: string): { min: number; max: number } => {
    const componentCount = estimateComponentCount(context);
    const contextLength = context.length;
    
    // With intelligent grouping, we cap at 50 components max
    const effectiveComponentCount = Math.min(componentCount, 50);
    
    // More accurate estimation based on grouped components
    let baseTime = 10; // Base 10 seconds for small systems
    let perComponentTime = 1.5; // 1.5 seconds per grouped component
    
    // Adjust for context complexity
    if (contextLength > 12000) {
      baseTime = 30; // Large systems need more base time
      perComponentTime = 3.0; // More time per component for complex analysis
    } else if (contextLength > 10000) {
      baseTime = 20;
      perComponentTime = 2.5;
    } else if (contextLength > 5000) {
      baseTime = 15;
      perComponentTime = 2.0;
    }
    
    const estimatedTime = baseTime + (effectiveComponentCount * perComponentTime);
    
    // More realistic estimates with grouping optimization
    return {
      min: Math.floor(Math.min(estimatedTime * 0.8, 180)), // Max 3 minutes
      max: Math.ceil(Math.min(estimatedTime * 1.2, 300))  // Max 5 minutes
    };
  };

  const handleConfirmGenerate = async () => {
    try {
      setError(null);
      setErrorDetails(null);
      
      // If auto mode is selected and we haven't done analysis yet, perform it first
      if (generationType === 'auto' && !analysisCompleted) {
        setStep('analyzing');
        
        try {
          const result = await analyzeDiagramContext(contextText);
          
          if (result.success && result.analysis) {
            setAnalysisResult(result.analysis);
            setGenerationType(result.analysis.recommendedMode);
            setAnalysisCompleted(true);
            setShowAnalysisDialog(true);
            setStep('idle');
            setShowDialog(false); // Close the main dialog
            return; // Exit here, the analysis dialog will handle the rest
          } else {
            throw new Error(result.error || 'Analysis failed');
          }
        } catch (error) {
          console.error('Context analysis failed:', error);
          // Fall back to hybrid mode
          setGenerationType('hybrid');
          setStep('confirming');
          setError('Unable to analyze context. Proceeding with Hybrid mode.');
          // Continue with generation after a brief pause
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // Step 1: Save confirmation
      setStep('saving');
      const confirmationResult = await onSaveConfirmation();
      
      if (confirmationResult === 'cancel') {
        setShowDialog(false);
        setStep('idle');
        return;
      }
      
      // Store whether we're appending
      const isAppending = confirmationResult === 'append';

      // Step 2: Generate diagram
      setStep('generating');
      setGenerationProgress(20);

      // Create abort controller for cancellation
      const controller = new AbortController();
      setAbortController(controller);

      const result = await diagramGenerationService.generateDiagram({
        userContext: contextText,
        systemName: systemName.trim() || undefined,
        aiProvider: settings.api.provider,
        generationType: generationType,
enableMultiPass: true, // Enable validation and improvement passes
        onProgress: (stage: string, progress: number) => {
          // Map the detailed progress to our progress bar
          if (stage === 'Requesting AI' || stage === 'Processing Response') {
            setStep('generating');
          } else if (stage === 'Parsing' || stage === 'Validating' || stage === 'Building') {
            setStep('processing');
          }
          setGenerationProgress(progress);
          setProgressStage(stage);
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate diagram');
      }

      // Step 3: Complete
      setStep('complete');
      setGenerationProgress(100);
      setAbortController(null); // Clean up abort controller

      // Apply the generated diagram
      if (result.diagram) {
        onDiagramGenerated(result.diagram, isAppending);
      }

      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        console.warn('Diagram generation warnings:', result.warnings);
      }

      // Close dialog after brief success display
      setTimeout(() => {
        setShowDialog(false);
        setStep('idle');
        setGenerationProgress(0);
      }, 1500);

    } catch (err: unknown) {
      // Check if it was cancelled
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled - this is already handled by handleCancelGeneration
        return;
      }
      
      setStep('error');
      const details = getErrorDetails(err);
      setError(details.message);
      setErrorDetails(details);
      setGenerationProgress(0);
      setAbortController(null);
    }
  };

  const handleCloseDialog = () => {
    if (step === 'generating' || step === 'processing') {
      // Don't allow closing during generation
      return;
    }
    
    setShowDialog(false);
    setStep('idle');
    setError(null);
    setErrorDetails(null);
    setGenerationProgress(0);
  };

  const handleCancelGeneration = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setStep('error');
    setError('Generation cancelled by user');
    setGenerationProgress(0);
  };

  const getStepIcon = (stepName: GenerationStep) => {
    switch (stepName) {
      case 'analyzing':
        return <CircularProgress size={20} sx={{ color: currentTheme.colors.info }} />;
      case 'saving':
        return <Save sx={{ color: currentTheme.colors.warning }} />;
      case 'generating':
      case 'processing':
        return <CircularProgress size={20} sx={{ color: currentTheme.colors.primary }} />;
      case 'complete':
        return <CheckCircle sx={{ color: currentTheme.colors.success }} />;
      case 'error':
        return <ErrorIcon sx={{ color: currentTheme.colors.error }} />;
      default:
        return <AutoAwesome sx={{ color: currentTheme.colors.primary }} />;
    }
  };

  const getStepLabel = (stepName: GenerationStep) => {
    switch (stepName) {
      case 'analyzing':
        return 'Analyzing context...';
      case 'saving':
        return 'Saving current work...';
      case 'generating':
        return 'Generating diagram with AI...';
      case 'processing':
        return 'Processing and validating...';
      case 'complete':
        return 'Diagram generated successfully!';
      case 'error':
        return 'Generation failed';
      default:
        return 'Ready to generate';
    }
  };

  const isGenerationInProgress = ['analyzing', 'saving', 'generating', 'processing'].includes(step);

  return (
    <>
      <GenerateButton
        startIcon={<AutoAwesome />}
        onClick={handleGenerateClick}
        disabled={!contextText.trim() || contextText.trim().length < 50}
        fullWidth
      >
        Generate Diagram with AI
      </GenerateButton>

      <StyledDialog
        open={showDialog}
        onClose={handleCloseDialog}
        disableEscapeKeyDown={isGenerationInProgress}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderBottom: `1px solid ${currentTheme.colors.border}`,
          pb: spacing.sm
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            <AutoAwesome sx={{ color: currentTheme.colors.primary }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Generate AI Threat Model
            </Typography>
          </Box>
          {!isGenerationInProgress && (
            <Button
              onClick={handleCloseDialog}
              sx={{ minWidth: 'auto', p: spacing.xs, color: currentTheme.colors.textSecondary }}
            >
              <Close />
            </Button>
          )}
        </DialogTitle>

        <DialogContent sx={{ pt: spacing.md }}>
          {step === 'analyzing' && (
            <Box sx={{ textAlign: 'center', py: spacing.lg }}>
              <CircularProgress sx={{ color: currentTheme.colors.primary, mb: spacing.md }} />
              <Typography variant="h6" sx={{ color: currentTheme.colors.textPrimary, mb: spacing.sm }}>
                Analyzing System Context
              </Typography>
              <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary }}>
                AI is analyzing your system description to recommend the best generation mode...
              </Typography>
            </Box>
          )}

          {step === 'confirming' && (
            <Box>
              <Typography variant="body2" sx={{ color: currentTheme.colors.textPrimary, mb: spacing.md }}>
                AI will analyze your system context and generate a complete threat model diagram with security zones, components, and connections.
              </Typography>

              {/* Show warning for local LLM users */}
              {diagramGenerationService.isLocalLLMProvider(settings.api.provider) && (
                <Alert 
                  severity="info" 
                  sx={{ 
                    mb: spacing.md,
                    backgroundColor: currentTheme.colors.surface,
                    border: `1px solid ${currentTheme.colors.info}`,
                    '& .MuiAlert-icon': { color: currentTheme.colors.info }
                  }}
                  icon={<Architecture />}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: spacing.xs }}>
                    Building with Local LLMs
                  </Typography>
                  <Typography variant="body2">
                    For best results with local LLMs, build your diagram in smaller sections. 
                    Generate one subsystem at a time and add it to your existing diagram.
                  </Typography>
                </Alert>
              )}

              {/* Compact System Size Analysis */}
              {estimateComponentCount(contextText) > 50 && (
                <Alert 
                  severity={estimateComponentCount(contextText) > 100 ? "warning" : "info"}
                  sx={{ 
                    backgroundColor: currentTheme.colors.surface,
                    border: `1px solid ${estimateComponentCount(contextText) > 100 ? currentTheme.colors.warning : currentTheme.colors.info}`,
                    mb: spacing.md,
                    '& .MuiAlert-icon': { color: estimateComponentCount(contextText) > 100 ? currentTheme.colors.warning : currentTheme.colors.info }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {estimateComponentCount(contextText) > 100 ? 'Large System' : 'Medium System'} Detected
                        </Typography>
                        <Chip 
                          label={`~${estimateComponentCount(contextText)} components`}
                          size="small"
                          sx={{ 
                            ml: 1,
                            backgroundColor: 'transparent',
                            border: '1px solid',
                            borderColor: estimateComponentCount(contextText) > 100 ? currentTheme.colors.warning : currentTheme.colors.info
                          }}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                        Generation time: {estimateGenerationTime(contextText).min < 60 
                          ? `${estimateGenerationTime(contextText).min}-${estimateGenerationTime(contextText).max} seconds`
                          : `${Math.floor(estimateGenerationTime(contextText).min / 60)}-${Math.ceil(estimateGenerationTime(contextText).max / 60)} minutes`
                        }. AI will intelligently group similar components for optimal performance.
                      </Typography>
                    </Box>
                  </Box>
                </Alert>
              )}

              <StyledTextField
                fullWidth
                label="System Name (Optional)"
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                placeholder="e.g., E-commerce Platform, Banking System..."
                helperText="Leave blank to let AI suggest a name"
                sx={{ mb: spacing.md }}
              />

              {/* Generation Type Selection */}
              <Box sx={{ mb: spacing.md }}>
                <Typography variant="body2" sx={{ color: currentTheme.colors.textPrimary, mb: spacing.sm, fontWeight: 600 }}>
                  Select Generation Type
                </Typography>
                <FormControl component="fieldset" sx={{ width: '100%' }}>
                  <RadioGroup
                    value={generationType}
                    onChange={(e) => setGenerationType(e.target.value as DiagramGenerationType)}
                  >
                    <GenerationTypeCard
                      className={generationType === 'auto' ? 'selected' : ''}
                      onClick={() => setGenerationType('auto')}
                      sx={{ mb: spacing.sm }}
                    >
                      <CardContent sx={{ p: spacing.sm }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
                          <FormControlLabel
                            value="auto"
                            control={<Radio />}
                            label=""
                            sx={{ mt: 0 }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm, mb: spacing.xs }}>
                              <AutoAwesome sx={{ color: currentTheme.colors.primary, fontSize: 20 }} />
                              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: currentTheme.colors.textPrimary }}>
                                Auto-Select (Recommended)
                              </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ color: currentTheme.colors.textSecondary }}>
                              AI analyzes and selects the best mode based on system size and complexity.
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </GenerationTypeCard>

                    <GenerationTypeCard
                      className={generationType === 'technical' ? 'selected' : ''}
                      onClick={() => setGenerationType('technical')}
                      sx={{ mb: spacing.sm }}
                    >
                      <CardContent sx={{ p: spacing.sm }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
                          <FormControlLabel
                            value="technical"
                            control={<Radio />}
                            label=""
                            sx={{ mt: 0 }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm, mb: spacing.xs }}>
                              <Architecture sx={{ color: currentTheme.colors.primary, fontSize: 20 }} />
                              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: currentTheme.colors.textPrimary }}>
                                Technical Architecture
                              </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ color: currentTheme.colors.textSecondary }}>
                              Precise technical modeling with all security zones and components. No grouping.
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </GenerationTypeCard>

                    <GenerationTypeCard
                      className={generationType === 'process' ? 'selected' : ''}
                      onClick={() => setGenerationType('process')}
                      sx={{ mb: spacing.sm }}
                    >
                      <CardContent sx={{ p: spacing.sm }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
                          <FormControlLabel
                            value="process"
                            control={<Radio />}
                            label=""
                            sx={{ mt: 0 }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm, mb: spacing.xs }}>
                              <AccountTree sx={{ color: currentTheme.colors.secondary, fontSize: 20 }} />
                              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: currentTheme.colors.textPrimary }}>
                                Process & Workflow
                              </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ color: currentTheme.colors.textSecondary }}>
                              Aggressive grouping for large workflows (100+ components). Groups similar items.
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </GenerationTypeCard>

                    <GenerationTypeCard
                      className={generationType === 'hybrid' ? 'selected' : ''}
                      onClick={() => setGenerationType('hybrid')}
                    >
                      <CardContent sx={{ p: spacing.sm }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
                          <FormControlLabel
                            value="hybrid"
                            control={<Radio />}
                            label=""
                            sx={{ mt: 0 }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm, mb: spacing.xs }}>
                              <Merge sx={{ color: currentTheme.colors.info, fontSize: 20 }} />
                              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: currentTheme.colors.textPrimary }}>
                                Hybrid Mode
                              </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ color: currentTheme.colors.textSecondary }}>
                              Balanced approach. Groups 3+ similar components while preserving security detail.
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </GenerationTypeCard>
                  </RadioGroup>
                </FormControl>
              </Box>


              {contextText.length > 14500 && (
                <Alert 
                  severity="error"
                  sx={{ 
                    backgroundColor: currentTheme.colors.surface,
                    border: `1px solid ${currentTheme.colors.error}`,
                    mb: spacing.md,
                    '& .MuiAlert-icon': { color: currentTheme.colors.error }
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Approaching Maximum Size Limit
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                    {contextText.length}/15,000 characters ({15000 - contextText.length} remaining)
                  </Typography>
                </Alert>
              )}

              <Alert 
                severity="info" 
                sx={{ 
                  backgroundColor: currentTheme.colors.surface,
                  border: `1px solid ${currentTheme.colors.border}`,
                  '& .MuiAlert-icon': { color: currentTheme.colors.primary }
                }}
              >
                This will create a new diagram. Your current work will be saved first.
              </Alert>
            </Box>
          )}

          {isGenerationInProgress && (
            <Box>
              <Box sx={{ mb: spacing.lg }}>
                <LinearProgress 
                  variant="determinate" 
                  value={generationProgress}
                  sx={{
                    height: '8px',
                    borderRadius: '4px',
                    backgroundColor: currentTheme.colors.surface,
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: currentTheme.colors.primary,
                      borderRadius: '4px',
                    }
                  }}
                />
                <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, mt: spacing.sm, textAlign: 'center' }}>
                  {generationProgress}% complete
                </Typography>
              </Box>

              <LoadingStep>
                {getStepIcon(step)}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" sx={{ color: currentTheme.colors.textPrimary }}>
                    {getStepLabel(step)}
                  </Typography>
                  {progressStage && (
                    <Typography variant="caption" sx={{ color: currentTheme.colors.textSecondary }}>
                      {progressStage}...
                    </Typography>
                  )}
                </Box>
              </LoadingStep>

              {step === 'generating' && (
                <Box sx={{ mt: spacing.md }}>
                  <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, textAlign: 'center' }}>
                    Estimated time: {estimateGenerationTime(contextText).min < 60 
                      ? `${estimateGenerationTime(contextText).min}-${estimateGenerationTime(contextText).max} seconds`
                      : `${Math.floor(estimateGenerationTime(contextText).min / 60)}-${Math.ceil(estimateGenerationTime(contextText).max / 60)} minutes`
                    }
                  </Typography>
                  <Typography variant="caption" sx={{ color: currentTheme.colors.textSecondary, textAlign: 'center', display: 'block', mt: spacing.xs }}>
                    Generating ~{estimateComponentCount(contextText)} components
                    {analysisResult && ` using ${generationType === 'technical' ? 'Technical' : generationType === 'process' ? 'Process' : 'Hybrid'} mode`}
                  </Typography>
                  {contextText.length > 12000 && (
                    <Alert 
                      severity="info" 
                      sx={{ 
                        mt: spacing.md,
                        backgroundColor: currentTheme.colors.surface,
                        border: `1px solid ${currentTheme.colors.info}`,
                        '& .MuiAlert-icon': { color: currentTheme.colors.info }
                      }}
                    >
                      <Typography variant="caption">
                        ℹ️ Large systems like this typically take {Math.floor(estimateGenerationTime(contextText).min / 60)}-{Math.ceil(estimateGenerationTime(contextText).max / 60)} minutes to generate. 
                        Please be patient while the AI processes all components.
                      </Typography>
                    </Alert>
                  )}
                </Box>
              )}
            </Box>
          )}

          {step === 'complete' && (
            <Box sx={{ textAlign: 'center', py: spacing.lg }}>
              <CheckCircle sx={{ color: currentTheme.colors.success, fontSize: 48, mb: spacing.md }} />
              <Typography variant="h6" sx={{ color: currentTheme.colors.textPrimary, mb: spacing.sm }}>
                Diagram Generated Successfully!
              </Typography>
              <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary }}>
                Your new threat model is now loaded and ready for analysis.
              </Typography>
            </Box>
          )}

          {step === 'error' && error && (
            <Alert 
              severity={errorDetails?.isApiKeyIssue ? "warning" : "error"}
              icon={errorDetails?.isApiKeyIssue ? <VpnKey /> : undefined}
              sx={{ 
                backgroundColor: currentTheme.colors.surface,
                border: `1px solid ${errorDetails?.isApiKeyIssue ? currentTheme.colors.warning : currentTheme.colors.error}`,
                '& .MuiAlert-icon': { 
                  color: errorDetails?.isApiKeyIssue ? currentTheme.colors.warning : currentTheme.colors.error 
                }
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: errorDetails?.guidance ? spacing.sm : 0 }}>
                {error}
              </Typography>
              {errorDetails?.guidance && (
                <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, mt: spacing.sm }}>
                  {errorDetails.guidance}
                </Typography>
              )}
              {errorDetails?.isApiKeyIssue && (
                <Box sx={{ mt: spacing.md }}>
                  <Button
                    size="small"
                    startIcon={<SettingsIcon />}
                    onClick={() => {
                      // TODO: Add function to open settings dialog directly to API config section
                      handleCloseDialog();
                    }}
                    sx={{
                      backgroundColor: currentTheme.colors.warning,
                      color: '#ffffff',
                      textTransform: 'none',
                      fontSize: '0.875rem',
                      '&:hover': { 
                        backgroundColor: currentTheme.colors.warning,
                        filter: 'brightness(0.9)'
                      }
                    }}
                  >
                    Configure API Key
                  </Button>
                </Box>
              )}
            </Alert>
          )}
        </DialogContent>

        {(step === 'confirming' || step === 'error' || step === 'generating' || step === 'processing') && (
          <DialogActions sx={{ p: spacing.lg, pt: 0 }}>
            {(step === 'generating' || step === 'processing') ? (
              <Button
                onClick={handleCancelGeneration}
                sx={{ 
                  color: currentTheme.colors.error,
                  textTransform: 'none',
                  fontWeight: 600
                }}
              >
                Cancel Generation
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleCloseDialog}
                  sx={{ color: currentTheme.colors.textSecondary, textTransform: 'none' }}
                >
                  Cancel
                </Button>
                {step === 'confirming' && (
                  <GenerateButton
                    onClick={handleConfirmGenerate}
                    startIcon={<AutoAwesome />}
                  >
                    Generate Diagram
                  </GenerateButton>
                )}
                {step === 'error' && (
                  <Button
                    onClick={() => setStep('confirming')}
                    sx={{ 
                      backgroundColor: currentTheme.colors.primary,
                      color: '#ffffff',
                      textTransform: 'none',
                      '&:hover': { backgroundColor: currentTheme.colors.primary }
                    }}
                  >
                    Try Again
                  </Button>
                )}
              </>
            )}
          </DialogActions>
        )}
      </StyledDialog>

      {/* Analysis Results Dialog */}
      <StyledDialog
        open={showAnalysisDialog}
        onClose={() => setShowAnalysisDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderBottom: `1px solid ${currentTheme.colors.border}`,
          pb: spacing.sm
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            <AutoAwesome sx={{ color: currentTheme.colors.primary }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              AI Analysis Complete
            </Typography>
          </Box>
          <Button
            onClick={() => setShowAnalysisDialog(false)}
            sx={{ minWidth: 'auto', p: spacing.xs, color: currentTheme.colors.textSecondary }}
          >
            <Close />
          </Button>
        </DialogTitle>

        <DialogContent sx={{ pt: spacing.md }}>
          {analysisResult && (
            <Box>
              <Alert
                severity="info"
                sx={{
                  backgroundColor: currentTheme.colors.surface,
                  border: `1px solid ${currentTheme.colors.info}`,
                  mb: spacing.lg,
                  '& .MuiAlert-icon': { color: currentTheme.colors.info }
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, mb: spacing.xs }}>
                  AI Recommendation: {analysisResult.recommendedMode === 'technical' ? 'Technical Architecture' : 
                                     analysisResult.recommendedMode === 'process' ? 'Process & Workflow' : 'Hybrid Mode'}
                </Typography>
                <Typography variant="body2">
                  {analysisResult.reasoning}
                </Typography>
              </Alert>

              <Box sx={{ mb: spacing.lg }}>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: spacing.sm }}>
                  System Analysis
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: currentTheme.colors.textSecondary }}>
                      Estimated Components
                    </Typography>
                    <Typography variant="h6" sx={{ color: currentTheme.colors.textPrimary }}>
                      ~{analysisResult.estimatedNodeCount}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: currentTheme.colors.textSecondary }}>
                      Complexity
                    </Typography>
                    <Chip
                      label={analysisResult.complexity.toUpperCase()}
                      size="small"
                      sx={{
                        mt: spacing.xs,
                        backgroundColor: analysisResult.complexity === 'very-high' ? currentTheme.colors.error :
                                       analysisResult.complexity === 'high' ? currentTheme.colors.warning :
                                       analysisResult.complexity === 'medium' ? currentTheme.colors.info :
                                       currentTheme.colors.success,
                        color: '#ffffff'
                      }}
                    />
                  </Box>
                </Box>
              </Box>

              {/* Allow user to change the recommended mode */}
              <Box sx={{ mb: spacing.lg }}>
                <Typography variant="body2" sx={{ color: currentTheme.colors.textPrimary, mb: spacing.sm, fontWeight: 600 }}>
                  Generation Mode
                </Typography>
                <Typography variant="caption" sx={{ color: currentTheme.colors.textSecondary, display: 'block', mb: spacing.sm }}>
                  You can accept the AI recommendation or choose a different mode:
                </Typography>
                <FormControl component="fieldset" sx={{ width: '100%' }}>
                  <RadioGroup
                    value={generationType}
                    onChange={(e) => setGenerationType(e.target.value as DiagramGenerationType)}
                  >
                    <GenerationTypeCard
                      className={generationType === 'technical' ? 'selected' : ''}
                      onClick={() => setGenerationType('technical')}
                      sx={{ mb: spacing.sm }}
                    >
                      <CardContent sx={{ p: spacing.sm }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
                          <FormControlLabel
                            value="technical"
                            control={<Radio />}
                            label=""
                            sx={{ mt: 0 }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm, mb: spacing.xs }}>
                              <Architecture sx={{ color: currentTheme.colors.primary, fontSize: 20 }} />
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: currentTheme.colors.textPrimary }}>
                                Technical Architecture
                              </Typography>
                              {analysisResult.recommendedMode === 'technical' && (
                                <Chip label="AI Recommended" size="small" color="primary" sx={{ ml: spacing.sm }} />
                              )}
                            </Box>
                            <Typography variant="caption" sx={{ color: currentTheme.colors.textSecondary }}>
                              Precise technical modeling with all security zones and components. No grouping.
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </GenerationTypeCard>

                    <GenerationTypeCard
                      className={generationType === 'process' ? 'selected' : ''}
                      onClick={() => setGenerationType('process')}
                      sx={{ mb: spacing.sm }}
                    >
                      <CardContent sx={{ p: spacing.sm }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
                          <FormControlLabel
                            value="process"
                            control={<Radio />}
                            label=""
                            sx={{ mt: 0 }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm, mb: spacing.xs }}>
                              <AccountTree sx={{ color: currentTheme.colors.secondary, fontSize: 20 }} />
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: currentTheme.colors.textPrimary }}>
                                Process & Workflow
                              </Typography>
                              {analysisResult.recommendedMode === 'process' && (
                                <Chip label="AI Recommended" size="small" color="primary" sx={{ ml: spacing.sm }} />
                              )}
                            </Box>
                            <Typography variant="caption" sx={{ color: currentTheme.colors.textSecondary }}>
                              Aggressive grouping for large workflows (100+ components). Groups similar items.
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </GenerationTypeCard>

                    <GenerationTypeCard
                      className={generationType === 'hybrid' ? 'selected' : ''}
                      onClick={() => setGenerationType('hybrid')}
                    >
                      <CardContent sx={{ p: spacing.sm }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
                          <FormControlLabel
                            value="hybrid"
                            control={<Radio />}
                            label=""
                            sx={{ mt: 0 }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm, mb: spacing.xs }}>
                              <Merge sx={{ color: currentTheme.colors.info, fontSize: 20 }} />
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: currentTheme.colors.textPrimary }}>
                                Hybrid Mode
                              </Typography>
                              {analysisResult.recommendedMode === 'hybrid' && (
                                <Chip label="AI Recommended" size="small" color="primary" sx={{ ml: spacing.sm }} />
                              )}
                            </Box>
                            <Typography variant="caption" sx={{ color: currentTheme.colors.textSecondary }}>
                              Balanced approach. Groups 3+ similar components while preserving security detail.
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </GenerationTypeCard>
                  </RadioGroup>
                </FormControl>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: spacing.lg, pt: 0 }}>
          <Button
            onClick={() => {
              setShowAnalysisDialog(false);
              setGenerationType('hybrid'); // Reset to default manual mode
              setStep('confirming');
            }}
            sx={{ color: currentTheme.colors.textSecondary, textTransform: 'none' }}
          >
            Back to Manual Selection
          </Button>
          <GenerateButton
            onClick={async () => {
              // Close analysis dialog and proceed with generation
              setShowAnalysisDialog(false);
              setShowDialog(true);
              
              try {
                // Step 1: Save confirmation
                setStep('saving');
                const confirmationResult = await onSaveConfirmation();
                
                if (confirmationResult === 'cancel') {
                  setShowDialog(false);
                  setStep('idle');
                  return;
                }
                
                // Store whether we're appending
                const isAppending = confirmationResult === 'append';

                // Step 2: Generate diagram with the user's selected type
                setStep('generating');
                setGenerationProgress(20);

                // Create abort controller for cancellation
                const controller = new AbortController();
                setAbortController(controller);

                const result = await diagramGenerationService.generateDiagram({
                  userContext: contextText,
                  systemName: systemName.trim() || undefined,
                  aiProvider: settings.api.provider,
                  generationType: generationType, // Use the selected generation type
                  enableMultiPass: true,
                  signal: controller.signal,
                  onProgress: (stage: string, progress: number) => {
                    if (stage === 'Requesting AI' || stage === 'Processing Response') {
                      setStep('generating');
                    } else if (stage === 'Parsing' || stage === 'Validating' || stage === 'Building') {
                      setStep('processing');
                    }
                    setGenerationProgress(progress);
                    setProgressStage(stage);
                  }
                });

                if (!result.success) {
                  throw new Error(result.error || 'Failed to generate diagram');
                }

                // Step 3: Complete
                setStep('complete');
                setGenerationProgress(100);
                setAbortController(null);

                // Apply the generated diagram
                if (result.diagram) {
                  onDiagramGenerated(result.diagram, isAppending);
                }

                // Show warnings if any
                if (result.warnings && result.warnings.length > 0) {
                  console.warn('Diagram generation warnings:', result.warnings);
                }

                // Close dialog after brief success display
                setTimeout(() => {
                  setShowDialog(false);
                  setStep('idle');
                  setGenerationProgress(0);
                  setAnalysisCompleted(false); // Reset for next time
                }, 1500);

              } catch (err: unknown) {
                // Check if it was cancelled
                if (err instanceof Error && err.name === 'AbortError') {
                  return;
                }
                
                setStep('error');
                const details = getErrorDetails(err);
                setError(details.message);
                setErrorDetails(details);
                setGenerationProgress(0);
                setAbortController(null);
              }
            }}
            startIcon={<AutoAwesome />}
          >
            Proceed with {generationType === 'technical' ? 'Technical' : generationType === 'process' ? 'Process' : 'Hybrid'} Mode
          </GenerateButton>
        </DialogActions>
      </StyledDialog>
    </>
  );
};