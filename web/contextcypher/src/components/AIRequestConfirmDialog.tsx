import React, { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  Tabs,
  Tab,
  Chip
} from '@mui/material';
import { colors, effects } from '../styles/Theme';
import { InfoOutlined, TokenOutlined, MessageOutlined, DataObjectOutlined } from '@mui/icons-material';
import { getTokenEstimationFromJson } from '../services/AIRequestService';

interface AIRequestConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  requestData: {
    type: 'chat' | 'analyze';
    data: any;
  };
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`request-tabpanel-${index}`}
      aria-labelledby={`request-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const AIRequestConfirmDialog: React.FC<AIRequestConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  requestData
}) => {
  const [tabValue, setTabValue] = React.useState(0);

  // Add logging to track when the dialog opens/closes and what data it receives
  useEffect(() => {
    console.log('AIRequestConfirmDialog - Dialog state changed:', { 
      open, 
      hasRequestData: !!requestData,
      requestType: requestData?.type,
      dataSize: requestData?.data ? JSON.stringify(requestData.data).length : 0
    });
  }, [open, requestData]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Add logging for null data case
  if (!requestData || !requestData.data) {
    console.log('AIRequestConfirmDialog - No request data available');
    return null;
  }

  const { type, data } = requestData;
  const requestType = type === 'chat' ? 'Chat' : 'Analysis';
  
  console.log('AIRequestConfirmDialog - Rendering dialog with type:', requestType);

  // Calculate estimated tokens
  const jsonData = JSON.stringify(data);
  const estimatedTokens = getTokenEstimationFromJson(jsonData);
  
  // Determine max response tokens based on model
  const maxResponseTokens = data.context?.apiProvider === 'gemini' ? 8192 : 
                           data.context?.apiProvider === 'anthropic' ? 16384 : 4096; // Default to OpenAI

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '60vh',
          maxHeight: '80vh',
          backgroundColor: colors.surface,
          color: colors.textPrimary,
          borderRadius: '8px',
          boxShadow: effects.shadow
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        backgroundColor: colors.background,
        padding: '16px 24px',
        borderBottom: `1px solid ${colors.border}`
      }}>
        <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 500 }}>
          Confirm AI {requestType} Request
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Chip 
            icon={<TokenOutlined fontSize="small" />} 
            label={`~${estimatedTokens.toLocaleString()} tokens`} 
            size="small"
            sx={{ 
              backgroundColor: colors.primaryLight,
              color: colors.textPrimary,
              '& .MuiChip-icon': { color: colors.primary }
            }}
          />
          <Chip 
            icon={<InfoOutlined fontSize="small" />} 
            label={`Max response: ${maxResponseTokens.toLocaleString()} tokens`} 
            size="small"
            sx={{ 
              backgroundColor: colors.primaryLight,
              color: colors.textPrimary,
              '& .MuiChip-icon': { color: colors.primary }
            }}
          />
          <Typography variant="caption" color="text.secondary">
            AI Provider: {data.context?.apiProvider || 'Default'}
          </Typography>
        </Box>
      </DialogTitle>
      
      <Paper sx={{ 
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.background
      }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          aria-label="request data tabs"
          sx={{
            '& .MuiTab-root': {
              color: colors.textSecondary,
              '&.Mui-selected': {
                color: colors.primary
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: colors.primary
            }
          }}
        >
          <Tab 
            icon={<DataObjectOutlined fontSize="small" />}
            iconPosition="start"
            label="Request Data" 
            id="request-tab-0" 
            aria-controls="request-tabpanel-0" 
          />
          <Tab 
            icon={<MessageOutlined fontSize="small" />}
            iconPosition="start"
            label="Message" 
            id="request-tab-1" 
            aria-controls="request-tabpanel-1" 
          />
          <Tab 
            label="Diagram Data" 
            id="request-tab-2" 
            aria-controls="request-tabpanel-2" 
          />
          <Tab 
            label="Context" 
            id="request-tab-3" 
            aria-controls="request-tabpanel-3" 
          />
        </Tabs>
      </Paper>
      
      <DialogContent sx={{ 
        backgroundColor: colors.surface,
        padding: 0
      }}>
        <TabPanel value={tabValue} index={0}>
          <Typography variant="body2" gutterBottom sx={{ color: colors.textSecondary }}>
            This is the exact data payload that will be sent to the AI provider:
          </Typography>
          <Box 
            sx={{ 
              maxHeight: '400px', 
              overflow: 'auto',
              bgcolor: colors.background,
              p: 2,
              borderRadius: 1,
              border: '1px solid',
              borderColor: colors.border,
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              color: colors.textPrimary,
              '&::-webkit-scrollbar': {
                width: '8px',
                height: '8px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: `${colors.textSecondary}33`,
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: `${colors.border}33`,
                borderRadius: '4px',
              }
            }}
          >
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </Box>
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <Typography variant="body2" gutterBottom sx={{ color: colors.textSecondary }}>
            Message being sent to AI:
          </Typography>
          <Box 
            sx={{ 
              p: 2,
              borderRadius: 1,
              border: '1px solid',
              borderColor: colors.border,
              bgcolor: colors.background,
              color: colors.textPrimary
            }}
          >
            <Typography variant="body1">
              {type === 'chat' ? data.message : 'Analyze the current system state'}
            </Typography>
          </Box>
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          <Typography variant="body2" gutterBottom sx={{ color: colors.textSecondary }}>
            Diagram data being sent:
          </Typography>
          <Box 
            sx={{ 
              maxHeight: '400px', 
              overflow: 'auto',
              bgcolor: colors.background,
              p: 2,
              borderRadius: 1,
              border: '1px solid',
              borderColor: colors.border,
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              color: colors.textPrimary,
              '&::-webkit-scrollbar': {
                width: '8px',
                height: '8px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: `${colors.textSecondary}33`,
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: `${colors.border}33`,
                borderRadius: '4px',
              }
            }}
          >
            <pre>{JSON.stringify(type === 'chat' ? data.context?.diagram : data.diagram, null, 2)}</pre>
          </Box>
        </TabPanel>
        
        <TabPanel value={tabValue} index={3}>
          <Typography variant="body2" gutterBottom sx={{ color: colors.textSecondary }}>
            Context data being sent:
          </Typography>
          <Box 
            sx={{ 
              maxHeight: '400px', 
              overflow: 'auto',
              bgcolor: colors.background,
              p: 2,
              borderRadius: 1,
              border: '1px solid',
              borderColor: colors.border,
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              color: colors.textPrimary,
              '&::-webkit-scrollbar': {
                width: '8px',
                height: '8px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: `${colors.textSecondary}33`,
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: `${colors.border}33`,
                borderRadius: '4px',
              }
            }}
          >
            <pre>{JSON.stringify(data.context, null, 2)}</pre>
          </Box>
        </TabPanel>
      </DialogContent>
      
      <DialogActions sx={{ 
        px: 3, 
        py: 2, 
        backgroundColor: colors.background,
        borderTop: `1px solid ${colors.border}`
      }}>
        <Typography variant="caption" color={colors.textSecondary} sx={{ flexGrow: 1 }}>
          You can disable this confirmation in Settings
        </Typography>
        <Button 
          onClick={onClose} 
          color="error" 
          variant="outlined"
          sx={{
            borderColor: colors.error,
            color: colors.error,
            '&:hover': {
              backgroundColor: `${colors.error}20`,
              borderColor: colors.error
            }
          }}
        >
          Cancel Request
        </Button>
        <Button 
          onClick={onConfirm} 
          color="primary" 
          variant="contained"
          sx={{
            backgroundColor: colors.primary,
            color: colors.background,
            '&:hover': {
              backgroundColor: `${colors.primary}dd`
            }
          }}
        >
          Send to AI
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AIRequestConfirmDialog;
