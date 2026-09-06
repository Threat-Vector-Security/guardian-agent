// src/components/CustomContextPanel.tsx
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
  Alert
} from '@mui/material';
import { X, Check } from 'lucide-react';
import { useAnalysisContext } from './AnalysisContextProvider';
import { CustomContext } from '../types/AnalysisTypes';
import { DiagramSanitizer } from '../services/ClientDiagramSanitizer';
import { GenerateDiagramButton, SaveConfirmationResult } from './GenerateDiagramButton';
import { spacing, transitions } from '../styles/Theme';
import { styled } from '@mui/material/styles';
import useViewportLayout from '../hooks/useViewportLayout';

interface CustomContextPanelProps {
  open: boolean;
  onClose: () => void;
  embedded?: boolean;
  onDiagramGenerated?: (diagram: any, shouldMerge?: boolean) => void;
  onSaveConfirmation?: () => Promise<SaveConfirmationResult>;
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

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    fontSize: '14px',
    lineHeight: 1.6,
    transition: transitions.default,
    '& fieldset': {
      borderColor: theme.colors.border,
      borderWidth: '1px',
    },
    '&:hover fieldset': {
      borderColor: theme.colors.primary,
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.colors.primary,
      borderWidth: '2px',
    },
    '& textarea': {
      minHeight: '300px !important',
    }
  },
  '& .MuiInputBase-input::placeholder': {
    color: theme.colors.textSecondary,
    opacity: 0.7,
  },
}));

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

const CustomContextPanel: React.FC<CustomContextPanelProps> = ({ 
  open, 
  onClose, 
  embedded = false, 
  onDiagramGenerated,
  onSaveConfirmation 
}) => {
  const theme = useTheme();
  const { viewportTier, panelWidths } = useViewportLayout();
  const isPhoneViewport = viewportTier === 'xs' || viewportTier === 'sm';
  const drawerWidth = isPhoneViewport ? '100vw' : `${Math.round(panelWidths.analysis)}px`;
  const { state, setCustomContext } = useAnalysisContext();
  const [contextText, setContextText] = useState(state.customContext?.content || '');
  const [isDirty, setIsDirty] = useState(false);
  const [showSuccessSnackbar, setShowSuccessSnackbar] = useState(false);

  useEffect(() => {
    // Update local state when customContext changes
    // This includes when loading new example systems
    const newContent = state.customContext?.content || '';
    setContextText(newContent);
    setIsDirty(false);
  }, [state.customContext?.content, state.customContext?.timestamp]);

  const handleSave = () => {
    if (!contextText.trim()) {
      setCustomContext(null);
      setIsDirty(false);
      setShowSuccessSnackbar(true);
      return;
    }

    const sanitizedContent = DiagramSanitizer.sanitizeContextText(contextText);
    const newContext: CustomContext = {
      content: contextText,
      sanitizedContent,
      timestamp: new Date()
    };

    setCustomContext(newContext);
    setIsDirty(false);
    setShowSuccessSnackbar(true);
  };

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setShowSuccessSnackbar(false);
  };

  const panelContent = (
    <PanelContainer>
      {/* Header */}
      <PanelHeader>
        <Typography variant="h6" sx={{ color: theme.colors.textPrimary, fontWeight: 600 }}>
          System Context
        </Typography>
        <Tooltip title="Close System Context" arrow placement="bottom">
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

      {/* Content Area */}
      <ContentContainer>
        <Box>
          <Typography variant="body2" sx={{ 
            color: theme.colors.textSecondary, 
            marginBottom: spacing.md,
            lineHeight: 1.6
          }}>
            Add design documents, architecture details, or any additional context that will help the AI provide more accurate threat modeling and security analysis.
          </Typography>
          
          <StyledTextField
            multiline
            fullWidth
            minRows={4}
            value={contextText}
            onChange={(e) => {
              setContextText(e.target.value);
              setIsDirty(true);
            }}
            placeholder="# E-Commerce Platform - TechShop Online&#10;&#10;## System Overview&#10;TechShop is a mid-sized e-commerce platform serving 50,000+ customers with annual revenue of $25M. The system processes online orders, payment transactions, and manages inventory across multiple fulfillment centers. Due to rapid growth, some security shortcuts were taken that need addressing.&#10;&#10;## Architecture Overview&#10;&#10;### Internet Zone (Customer Facing)&#10;- **Cloudflare CDN** - Content delivery and DDoS protection, includes WAF rules&#10;- **Route 53 DNS** - AWS hosted DNS service for techshop.com domain&#10;- **External Users** - Customer web browsers and mobile apps&#10;&#10;### DMZ Zone (Public Services)&#10;- **Application Load Balancer** - AWS ALB distributing traffic to web servers&#10;- **Web Server Cluster** - 3 nginx servers (v1.22.1) serving React frontend&#10;  - Server 1: web-prod-01 (Primary)&#10;  - Server 2: web-prod-02 (Secondary)&#10;  - Server 3: web-prod-03 (Secondary)&#10;- **API Gateway** - Kong Gateway (v3.1.1) for REST API management&#10;&#10;### Internal Zone (Application Logic)&#10;- **Application Server Farm** - 4 Spring Boot servers (Java 17)&#10;  - app-server-01: Order processing service&#10;  - app-server-02: User management service&#10;  - app-server-03: Inventory service&#10;  - app-server-04: Payment processing service&#10;- **Redis Cache Cluster** - 3-node Redis cluster (v7.0.5) for session storage&#10;- **Message Queue** - RabbitMQ cluster (v3.11.2) for async processing&#10;&#10;### Production Zone (Critical Services)&#10;- **Database Primary** - PostgreSQL 14.6 primary database server&#10;- **Database Replica** - PostgreSQL 14.6 read replica for reporting&#10;- **Monitoring Server** - Prometheus v2.40.1 with Grafana v9.3.2 dashboards&#10;&#10;### Restricted Zone (Sensitive Data)&#10;- **Payment Database** - Separate PostgreSQL 15.1 instance for PCI data&#10;- **Vault Server** - HashiCorp Vault v1.12.2 for secrets management&#10;&#10;## Network Security&#10;&#10;### Firewalls&#10;- **Perimeter Firewall** - Fortinet FortiGate 600E (v7.2.3) at internet edge&#10;- **Internal Firewall** - Palo Alto PA-3220 (v10.2.4) between DMZ and Internal zones&#10;&#10;### Security Services&#10;- **WAF** - Cloudflare WAF with OWASP Top 10 rules&#10;- **IDS/IPS** - Suricata v6.0.8 monitoring internal traffic&#10;- **VPN Gateway** - OpenVPN Access Server v2.11.1 for admin access&#10;&#10;## Authentication & Access&#10;- **Admin SSO** - Okta integration for administrative access&#10;- **Customer Auth** - Custom JWT-based authentication with OAuth2&#10;- **Database Access** - Role-based access with individual service accounts&#10;&#10;## Current Security Concerns&#10;Several security issues exist due to rapid scaling:&#10;&#10;1. **Payment Database Location**: The payment database is currently in the Restricted zone but should be in a separate PCI-compliant zone.&#10;2. **Missing Encryption**: Internal API calls between services use HTTP instead of HTTPS.&#10;3. **Backup Security**: Database backups are stored without encryption on the backup server.&#10;&#10;This system represents a typical growing e-commerce platform with common security gaps that would be identified during threat modeling."
          />
        </Box>
      </ContentContainer>

      {/* Footer */}
      <FooterContainer>
        {/* Generate Diagram Button on the left */}
        {onDiagramGenerated && onSaveConfirmation && (
          <Box sx={{ 
            marginRight: 'auto',
            '& button': {
              fontSize: '13px',
              padding: '6px 16px',
              minHeight: 'auto',
              '& .MuiButton-startIcon': {
                marginRight: '6px',
                '& svg': {
                  fontSize: '18px'
                }
              }
            }
          }}>
            <Tooltip title="Generate a diagram from the system context described above" arrow placement="top">
              <span>
                <GenerateDiagramButton
                  contextText={contextText}
                  onDiagramGenerated={onDiagramGenerated}
                  onSaveConfirmation={onSaveConfirmation}
                />
              </span>
            </Tooltip>
          </Box>
        )}
        
        <SecondaryButton onClick={onClose} variant="outlined">
          Cancel
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
            System context saved successfully
          </Alert>
        </Snackbar>
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
          System context saved successfully
        </Alert>
      </Snackbar>
    </>
  );
};

export default CustomContextPanel;
