/**
 * Save Confirmation Dialog for diagram generation
 */

import React, { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  Alert
} from '@mui/material';
import { Save, Warning, Close, Add } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { getTheme, spacing } from '../styles/Theme';
import { useSettings } from '../settings/SettingsContext';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    backgroundColor: theme.colors.background,
    color: theme.colors.textPrimary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '12px',
    minWidth: '400px',
  }
}));

const SaveButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.colors.primary,
  color: theme.colors.background,
  fontWeight: 600,
  textTransform: 'none',
  '&:hover': {
    backgroundColor: theme.colors.primary,
    filter: 'brightness(1.1)',
  }
}));

interface SaveConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  onSkip: () => void;
  onAppend?: () => void;
  hasUnsavedChanges: boolean;
  currentFileName?: string;
  showAppendOption?: boolean;
}

export const SaveConfirmationDialog: React.FC<SaveConfirmationDialogProps> = ({
  open,
  onClose,
  onSave,
  onSkip,
  onAppend,
  hasUnsavedChanges,
  currentFileName,
  showAppendOption = false
}) => {
  const { settings } = useSettings();
  const currentTheme = useMemo(() => getTheme(settings.theme, settings.customTheme), [settings.theme, settings.customTheme]);
  
  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderBottom: `1px solid ${currentTheme.colors.border}`,
        pb: spacing.md
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <Warning sx={{ color: currentTheme.colors.warning }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Save Current Work?
          </Typography>
        </Box>
        <Button
          onClick={onClose}
          sx={{ minWidth: 'auto', p: spacing.xs, color: currentTheme.colors.textSecondary }}
        >
          <Close />
        </Button>
      </DialogTitle>

      <DialogContent sx={{ pt: spacing.lg }}>
        <Typography variant="body1" sx={{ color: currentTheme.colors.textPrimary, mb: spacing.md }}>
          {hasUnsavedChanges 
            ? "You have unsaved changes to your current diagram. Do you want to save them before generating a new diagram?"
            : "Do you want to save your current diagram before generating a new one?"
          }
        </Typography>

        {currentFileName && (
          <Typography variant="body2" sx={{ color: currentTheme.colors.textSecondary, mb: spacing.md }}>
            Current file: <strong>{currentFileName}</strong>
          </Typography>
        )}

        <Alert 
          severity="info" 
          sx={{ 
            backgroundColor: currentTheme.colors.surface,
            border: `1px solid ${currentTheme.colors.border}`,
            '& .MuiAlert-icon': { color: currentTheme.colors.primary }
          }}
        >
          <Typography variant="body2">
            {showAppendOption 
              ? "You can choose to replace your current diagram or add the new content to it."
              : "The new AI-generated diagram will replace your current work. This action cannot be undone."
            }
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ p: spacing.lg, pt: 0, justifyContent: 'space-between' }}>
        <Box>
          <Button
            onClick={onClose}
            sx={{ color: currentTheme.colors.textSecondary, textTransform: 'none' }}
          >
            Cancel
          </Button>
        </Box>
        
        <Box sx={{ display: 'flex', gap: spacing.sm }}>
          {showAppendOption && onAppend && (
            <Button
              onClick={onAppend}
              startIcon={<Add />}
              sx={{ 
                color: currentTheme.colors.success,
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': { backgroundColor: `${currentTheme.colors.success}11` }
              }}
            >
              Add to Existing
            </Button>
          )}
          
          <Button
            onClick={onSkip}
            sx={{ 
              color: currentTheme.colors.warning,
              textTransform: 'none',
              '&:hover': { backgroundColor: `${currentTheme.colors.warning}11` }
            }}
          >
            Continue Without Saving
          </Button>
          
          <SaveButton
            onClick={onSave}
            startIcon={<Save />}
          >
            Save & Continue
          </SaveButton>
        </Box>
      </DialogActions>
    </StyledDialog>
  );
};