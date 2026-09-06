import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  useTheme
} from '@mui/material';
import { AlertTriangle, Save, FileX } from 'lucide-react';
import { spacing } from '../styles/Theme';

interface ImportConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

const ImportConfirmDialog: React.FC<ImportConfirmDialogProps> = ({
  open,
  onClose,
  onSave,
  onDiscard,
  onCancel
}) => {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          backgroundColor: theme.colors.surface,
          borderRadius: '12px',
          border: `1px solid ${theme.colors.border}`,
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.md,
          color: theme.colors.textPrimary,
          fontSize: '1.25rem',
          fontWeight: 600,
          padding: spacing.lg,
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <AlertTriangle size={24} color={theme.colors.warning} />
        Import New Diagram
      </DialogTitle>
      
      <DialogContent sx={{ padding: spacing.lg }}>
        <Typography
          variant="body1"
          sx={{
            color: theme.colors.textPrimary,
            lineHeight: 1.6,
            mb: spacing.md
          }}
        >
          You have unsaved changes in the current diagram. What would you like to do?
        </Typography>
        
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: spacing.md,
          mt: spacing.lg 
        }}>
          <Box sx={{ 
            p: spacing.md, 
            backgroundColor: theme.colors.surfaceHover, 
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`
          }}>
            <Typography variant="body2" sx={{ 
              fontWeight: 600, 
              color: theme.colors.primary,
              mb: spacing.xs
            }}>
              Save and Import
            </Typography>
            <Typography variant="caption" sx={{ color: theme.colors.textSecondary }}>
              Save the current diagram first, then import the new one
            </Typography>
          </Box>
          
          <Box sx={{ 
            p: spacing.md, 
            backgroundColor: theme.colors.surfaceHover, 
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`
          }}>
            <Typography variant="body2" sx={{ 
              fontWeight: 600, 
              color: theme.colors.warning,
              mb: spacing.xs
            }}>
              Discard and Import
            </Typography>
            <Typography variant="caption" sx={{ color: theme.colors.textSecondary }}>
              Discard all changes and import the new diagram
            </Typography>
          </Box>
        </Box>
        
        <Typography
          variant="caption"
          sx={{
            color: theme.colors.textSecondary,
            mt: spacing.lg,
            display: 'block',
            fontStyle: 'italic'
          }}
        >
          Tip: You can also cancel and manually save your work before importing.
        </Typography>
      </DialogContent>
      
      <DialogActions
        sx={{
          padding: spacing.lg,
          borderTop: `1px solid ${theme.colors.border}`,
          gap: spacing.sm,
          justifyContent: 'space-between'
        }}
      >
        <Button
          onClick={onCancel}
          variant="outlined"
          sx={{
            color: theme.colors.textPrimary,
            borderColor: theme.colors.border,
            fontSize: '14px',
            padding: `${spacing.sm} ${spacing.lg}`,
            borderRadius: '6px',
            textTransform: 'none',
            '&:hover': {
              borderColor: theme.colors.primary,
              backgroundColor: theme.colors.surfaceHover,
            },
          }}
        >
          Cancel
        </Button>
        
        <Box sx={{ display: 'flex', gap: spacing.sm }}>
          <Button
            onClick={onDiscard}
            variant="outlined"
            startIcon={<FileX size={18} />}
            sx={{
              color: theme.colors.warning,
              borderColor: theme.colors.warning,
              fontSize: '14px',
              padding: `${spacing.sm} ${spacing.lg}`,
              borderRadius: '6px',
              textTransform: 'none',
              '&:hover': {
                backgroundColor: `${theme.colors.warning}15`,
                borderColor: theme.colors.warning,
              },
            }}
          >
            Discard Changes
          </Button>
          
          <Button
            onClick={onSave}
            variant="contained"
            startIcon={<Save size={18} />}
            sx={{
              backgroundColor: theme.colors.primary,
              color: theme.palette.primary.contrastText,
              fontWeight: 600,
              fontSize: '14px',
              padding: `${spacing.sm} ${spacing.lg}`,
              borderRadius: '6px',
              textTransform: 'none',
              '&:hover': {
                backgroundColor: theme.colors.secondary,
              },
            }}
          >
            Save & Import
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default ImportConfirmDialog;