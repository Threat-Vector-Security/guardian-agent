import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  useTheme
} from '@mui/material';
import { SaveAs, Schedule } from '@mui/icons-material';

interface AutosaveConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  intervalMinutes: number;
}

const AutosaveConfirmDialog: React.FC<AutosaveConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  intervalMinutes
}) => {
  const theme = useTheme();
  
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: theme.colors.surface,
          color: theme.colors.textPrimary,
          borderRadius: '12px',
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.15)`
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        backgroundColor: theme.colors.background,
        padding: '16px 24px',
        borderBottom: `1px solid ${theme.colors.border}`
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Schedule sx={{ color: theme.colors.primary }} />
          <Typography variant="h6" sx={{ color: theme.colors.textPrimary, fontWeight: 500 }}>
            Autosave
          </Typography>
        </Box>
        <Chip 
          icon={<Schedule fontSize="small" />} 
          label={`${intervalMinutes} min interval`} 
          size="small"
          sx={{ 
            backgroundColor: `${theme.colors.primary}20`,
            color: theme.colors.textPrimary,
            '& .MuiChip-icon': { color: theme.colors.primary }
          }}
        />
      </DialogTitle>
      
      <DialogContent sx={{ padding: '24px' }}>
        <Typography variant="body1" sx={{ color: theme.colors.textPrimary, mb: 2 }}>
          Your diagram has changes that need to be saved. Would you like to save your work now?
        </Typography>
        <Typography variant="body2" sx={{ color: theme.colors.textSecondary }}>
          This will create a new save file for your diagram.
        </Typography>
      </DialogContent>
      
      <DialogActions sx={{ 
        padding: '16px 24px',
        backgroundColor: theme.colors.background,
        borderTop: `1px solid ${theme.colors.border}`,
        gap: 2
      }}>
        <Button 
          onClick={onClose}
          sx={{ 
            color: theme.colors.textSecondary,
            '&:hover': {
              backgroundColor: theme.colors.surfaceHover
            }
          }}
        >
          Not Now
        </Button>
        <Button 
          onClick={onConfirm}
          variant="contained"
          startIcon={<SaveAs />}
          sx={{ 
            backgroundColor: theme.colors.primary,
            color: theme.colors.background,
            '&:hover': {
              backgroundColor: theme.colors.secondary,
              transform: 'translateY(-1px)',
              boxShadow: `0 4px 12px ${theme.colors.primary}40`
            }
          }}
        >
          Save As...
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AutosaveConfirmDialog; 