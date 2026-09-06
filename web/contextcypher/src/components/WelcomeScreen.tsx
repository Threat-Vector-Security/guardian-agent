import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  AlertTitle,
  useTheme,
} from '@mui/material';
import {
  Warning,
  Link as LinkIcon
} from '@mui/icons-material';
import { openExternalLink } from '../utils/linkUtils';
import { styled } from '@mui/material/styles';
import useViewportLayout from '../hooks/useViewportLayout';

interface WelcomeScreenProps {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    width: 'min(900px, calc(100vw - 24px))',
    minWidth: 'min(800px, calc(100vw - 24px))',
    maxWidth: 'min(900px, calc(100vw - 24px))',
    maxHeight: '90vh',
    borderRadius: '16px',
    border: `1px solid ${theme.colors.border}`,
    boxShadow: `0 20px 60px ${theme.colors.background}80`,
  },
}));

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  open,
  onAccept,
  onDecline
}) => {
  const theme = useTheme();
  const { viewportTier } = useViewportLayout();
  const isPhoneViewport = viewportTier === 'xs' || viewportTier === 'sm';

  const handleAccept = () => {
    onAccept();
  };

  return (
    <StyledDialog 
      open={open} 
      maxWidth="md" 
      fullWidth
      fullScreen={isPhoneViewport}
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          borderRadius: isPhoneViewport ? 0 : '16px',
          margin: isPhoneViewport ? 0 : 1.5,
          maxHeight: isPhoneViewport ? '100dvh' : '90dvh',
          ...(isPhoneViewport && {
            height: '100dvh',
            display: 'flex',
            flexDirection: 'column'
          })
        }
      }}
    >
      <DialogTitle sx={{ 
        backgroundColor: theme.colors.background, 
        borderBottom: `1px solid ${theme.colors.border}`,
        pb: 2,
        pt: isPhoneViewport ? 2 : 3,
        px: isPhoneViewport ? 2 : 3,
        flexShrink: 0
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant={isPhoneViewport ? 'h5' : 'h4'} sx={{ fontWeight: 700, mb: 1 }}>
            Welcome to ContextCypher
          </Typography>
          <Typography variant={isPhoneViewport ? 'body2' : 'body1'} sx={{ color: theme.colors.textSecondary }}>
            AI-Powered Threat Modeling and Security Analysis Platform
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ 
        p: isPhoneViewport ? 2 : 3,
        pt: 1,
        overflowY: 'auto',
        flex: 1,
        minHeight: 0,
        WebkitOverflowScrolling: 'touch'
      }}>
        {/* Legal Disclaimer */}
        <Alert 
          severity="warning" 
          icon={<Warning />}
          sx={{ 
            mt: '5px',
            mb: isPhoneViewport ? 2 : 3,
            backgroundColor: `${theme.colors.warning}15`,
            border: `2px solid ${theme.colors.warning}50`,
            '& .MuiAlert-icon': {
              color: theme.colors.warning,
            },
            '& .MuiAlert-message': {
              width: '100%',
            }
          }}
        >
          <AlertTitle sx={{ fontWeight: 700, fontSize: isPhoneViewport ? '1rem' : '1.1rem' }}>
            IMPORTANT LEGAL NOTICE - PLEASE READ CAREFULLY
          </AlertTitle>
          <Typography variant="body2" sx={{ mt: 1, mb: 2, fontWeight: 600 }}>
            BY USING CONTEXTCYPHER, YOU ACKNOWLEDGE AND AGREE TO THE FOLLOWING:
          </Typography>
          <Box component="ul" sx={{ 
            m: 0, 
            pl: 2.5,
            '& li': { 
              mb: 1,
              fontSize: isPhoneViewport ? '0.8125rem' : '0.875rem',
              lineHeight: 1.6
            }
          }}>
            <li><strong>NO WARRANTY:</strong> This software is provided "AS IS" without warranty of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.</li>
            <li><strong>AI LIMITATIONS:</strong> Artificial Intelligence can and will make mistakes, hallucinate, provide inaccurate, incomplete, or misleading security analysis. AI-generated content must NEVER be relied upon without thorough human validation and verification.</li>
            <li><strong>NOT A SUBSTITUTE:</strong> This tool does NOT replace professional security expertise, certified security consultants, penetration testers, or formal security assessments. It is intended solely as a supplementary tool.</li>
            <li><strong>USER RESPONSIBILITY:</strong> You are SOLELY responsible for validating, verifying, and implementing any suggestions, analysis, or recommendations provided by this tool. Any actions taken based on this tool's output are at your own risk.</li>
            <li><strong>NO LIABILITY:</strong> To the fullest extent permitted by law, Threat Vector Security Pty Ltd, its officers, employees, contractors, and affiliates shall NOT be liable for any direct, indirect, incidental, special, consequential, or punitive damages arising from your use of this software, including but not limited to security breaches, data loss, or business interruption.</li>
            <li><strong>COMPLIANCE:</strong> You are responsible for ensuring your use of this tool complies with all applicable laws, regulations, industry standards, and organizational policies in your jurisdiction.</li>
            <li><strong>INTELLECTUAL PROPERTY:</strong> All content, features, and functionality are owned by Threat Vector Security Pty Ltd and are protected by international copyright, trademark, and other intellectual property laws.</li>
          </Box>
          <Typography variant="body2" sx={{ mt: 2, mb: 2, fontWeight: 600 }}>
            BY CLICKING "PROCEED" OR USING THIS SOFTWARE, YOU AGREE TO BE BOUND BY OUR:
          </Typography>
          <Box sx={{
            display: 'flex',
            gap: isPhoneViewport ? 1 : 3,
            justifyContent: 'center',
            flexDirection: isPhoneViewport ? 'column' : 'row',
            alignItems: 'center',
            mb: 2,
            '& .MuiButton-root': {
              width: isPhoneViewport ? '100%' : 'auto',
              justifyContent: isPhoneViewport ? 'flex-start' : 'center'
            }
          }}>
            <Button
              size="small"
              startIcon={<LinkIcon />}
              onClick={() => openExternalLink('https://threatvectorsecurity.com/terms/')}
              sx={{ 
                color: theme.colors.primary,
                textDecoration: 'underline',
                '&:hover': {
                  textDecoration: 'underline',
                  backgroundColor: 'transparent'
                }
              }}
            >
              Terms of Service
            </Button>
            <Button
              size="small"
              startIcon={<LinkIcon />}
              onClick={() => openExternalLink('https://threatvectorsecurity.com/privacy/')}
              sx={{ 
                color: theme.colors.primary,
                textDecoration: 'underline',
                '&:hover': {
                  textDecoration: 'underline',
                  backgroundColor: 'transparent'
                }
              }}
            >
              Privacy Policy
            </Button>
          </Box>
          <Typography variant="body2" sx={{ mt: 2, fontWeight: 700, textTransform: 'uppercase' }}>
            IF YOU DO NOT AGREE TO THESE TERMS, DO NOT USE THIS SOFTWARE.
          </Typography>
        </Alert>

        {/* AI Provider Setup Note */}
        <Alert 
          severity="info" 
          sx={{ 
            mb: 3,
            backgroundColor: `${theme.colors.info}15`,
            border: `1px solid ${theme.colors.info}30`,
            '& .MuiAlert-icon': {
              color: theme.colors.info,
            },
          }}
        >
          <Typography variant="body2">
            <strong>AI Setup Required:</strong> Configure your AI provider in Settings after starting.
            Choose Ollama for offline use or add API keys for OpenAI, Anthropic, or Google.
          </Typography>
        </Alert>


      </DialogContent>

      <DialogActions sx={{ 
        p: isPhoneViewport ? 1.5 : 3, 
        pt: isPhoneViewport ? 1.25 : 2,
        backgroundColor: theme.colors.background,
        borderTop: `1px solid ${theme.colors.border}`,
        flexDirection: 'column',
        gap: isPhoneViewport ? 1 : 2,
        flexShrink: 0
      }}>
        <Typography variant="body2" sx={{ 
          textAlign: 'center', 
          color: theme.colors.textSecondary,
          fontSize: '0.875rem',
          display: isPhoneViewport ? 'none' : 'block'
        }}>
          By clicking "Proceed", you acknowledge that you have read and agree to the disclaimer above, our <Button
            size="small"
            onClick={() => window.open('https://threatvectorsecurity.com/terms/', '_blank')}
            sx={{ 
              p: 0,
              minWidth: 'auto',
              color: theme.colors.primary,
              textDecoration: 'underline',
              fontSize: '0.875rem',
              '&:hover': {
                textDecoration: 'underline',
                backgroundColor: 'transparent'
              }
            }}
          >
            Terms of Service
          </Button> and <Button
            size="small"
            onClick={() => window.open('https://threatvectorsecurity.com/privacy/', '_blank')}
            sx={{ 
              p: 0,
              minWidth: 'auto',
              color: theme.colors.primary,
              textDecoration: 'underline',
              fontSize: '0.875rem',
              '&:hover': {
                textDecoration: 'underline',
                backgroundColor: 'transparent'
              }
            }}
          >
            Privacy Policy
          </Button>.
        </Typography>
        
        <Box sx={{
          display: 'flex',
          gap: 2,
          width: isPhoneViewport ? '100%' : 'auto',
          flexDirection: isPhoneViewport ? 'column-reverse' : 'row'
        }}>
          <Button 
            onClick={onDecline}
            variant="outlined"
            sx={{ 
              minWidth: isPhoneViewport ? '100%' : 100,
              color: theme.colors.textSecondary,
              borderColor: theme.colors.textSecondary 
            }}
          >
            Exit
          </Button>
          
          <Button 
            onClick={handleAccept}
            variant="contained"
            sx={{ 
              minWidth: isPhoneViewport ? '100%' : 120,
              fontWeight: 600
            }}
          >
            Proceed
          </Button>
        </Box>
      </DialogActions>
    </StyledDialog>
  );
};

export default WelcomeScreen;
