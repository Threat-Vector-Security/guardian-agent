// src/styles/EditorStyles.ts
import { colors } from './Theme';

export const editorStyles = {
  dialog: {
    '& .MuiDialog-paper': {
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      width: '400px', // Wider dialog
      maxHeight: '90vh', // Prevent overflow
      position: 'absolute', // For draggable functionality
      margin: '16px', // Give some space from edges
      overflow: 'visible' // Allow draggable handle to be visible
    }
  },
  dialogTitle: {
    backgroundColor: colors.surfaceHover,
    cursor: 'move', // Indicate draggable
    padding: '12px 16px', // More compact padding
    marginBottom: '8px'
  },
  dialogContent: {
    padding: '16px',
    paddingTop: '8px', // Reduce top padding
    '& .MuiFormControl-root': {
      marginBottom: '12px' // Reduce space between fields
    }
  },
  dialogActions: {
    padding: '8px 16px', // More compact padding
    backgroundColor: colors.surface,
    borderTop: `1px solid ${colors.border}`
  },
  formField: {
    '& .MuiInputBase-input': { 
      color: colors.textPrimary 
    },
    '& .MuiInputLabel-root': { 
      color: colors.textSecondary 
    },
    '& .MuiSelect-icon': { 
      color: colors.textSecondary 
    }
  },
  description: {
    fontSize: '12px',
    color: colors.textSecondary,
    marginTop: '-8px',
    marginBottom: '4px'
  },
  actionButton: {
    '&.MuiButton-root': {
      backgroundColor: '#1565C0 !important',  // One shade lighter blue
      opacity: 0.9,
      color: '#fff !important',
      '&:hover': {
        backgroundColor: '#1565C0 !important',
        opacity: 1,
        filter: 'brightness(1.1)'
      }
    }
  }
};