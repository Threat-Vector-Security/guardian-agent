// src/components/ClearDiagramDialog.tsx
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  useTheme
} from '@mui/material';
import { AlertTriangle } from 'lucide-react';
import { spacing } from '../styles/Theme';

interface ClearDiagramDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ClearDiagramDialog: React.FC<ClearDiagramDialogProps> = ({
  open,
  onClose,
  onConfirm
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
        Clear Diagram
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
          Are you sure you want to clear the current diagram? This action will:
        </Typography>
        
        <Typography
          component="ul"
          sx={{
            color: theme.colors.textSecondary,
            lineHeight: 1.6,
            pl: spacing.lg,
            mb: 0,
            '& li': {
              mb: spacing.sm
            }
          }}
        >
          <li>Remove all nodes and connections from the canvas</li>
          <li>Clear any custom context information</li>
          <li>Clear the analysis chat history</li>
          <li>Reset the diagram title to "untitled"</li>
        </Typography>
        
        <Typography
          variant="body2"
          sx={{
            color: theme.colors.warning,
            mt: spacing.lg,
            fontWeight: 500
          }}
        >
          This action cannot be undone. Make sure to save your work first if needed.
        </Typography>
      </DialogContent>
      
      <DialogActions
        sx={{
          padding: spacing.lg,
          borderTop: `1px solid ${theme.colors.border}`,
          gap: spacing.sm
        }}
      >
        <Button
          onClick={onClose}
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
        
        <Button
          onClick={onConfirm}
          variant="contained"
          sx={{
            backgroundColor: theme.colors.error,
            color: theme.palette.error.contrastText,
            fontWeight: 600,
            fontSize: '14px',
            padding: `${spacing.sm} ${spacing.lg}`,
            borderRadius: '6px',
            textTransform: 'none',
            '&:hover': {
              backgroundColor: theme.colors.error,
              filter: 'brightness(0.9)',
            },
          }}
        >
          Clear Diagram
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClearDiagramDialog;