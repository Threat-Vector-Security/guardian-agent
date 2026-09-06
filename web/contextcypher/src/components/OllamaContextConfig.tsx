import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Memory, Refresh } from '@mui/icons-material';
import { getOllamaModelContext } from '../utils/modelConstants';
import api from '../api';

const StyledFormControl = styled(FormControl)(({ theme }) => ({
  '& .MuiInputLabel-root': {
    color: theme.colors.textSecondary,
  },
  '& .MuiSelect-root': {
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.colors.border,
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.colors.primary,
  },
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
  },
  '& .MuiInputBase-input': {
    color: theme.colors.textPrimary,
  },
}));

interface OllamaContextConfigProps {
  model: string;
  baseUrl: string;
  onModelChange: (newModel: string) => void;
}

// Common context sizes with RAM requirements
const CONTEXT_PRESETS = [
  { value: 8192, label: '8K (Default)', ram: '~6GB' },
  { value: 16384, label: '16K', ram: '~8GB' },
  { value: 32768, label: '32K', ram: '~12GB' },
  { value: 65536, label: '64K', ram: '~20GB' },
  { value: 131072, label: '128K', ram: '~35GB' },
];

export const OllamaContextConfig: React.FC<OllamaContextConfigProps> = ({
  model,
  baseUrl,
  onModelChange
}) => {
  const [currentContext, setCurrentContext] = useState<number | null>(null);
  const [customContext, setCustomContext] = useState<number>(32768);
  const [newModelName, setNewModelName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info' | null; message: string }>({ 
    type: null, 
    message: '' 
  });
  const [isChecking, setIsChecking] = useState(false);

  // Check current model context
  const checkModelContext = async () => {
    if (!model) return;
    
    setIsChecking(true);
    try {
      const context = await getOllamaModelContext(model);
      setCurrentContext(context);
      setStatus({
        type: 'info',
        message: `Current model is using ${context.toLocaleString()} token context`
      });
    } catch (error) {
      console.error('Failed to check model context:', error);
      setStatus({
        type: 'error',
        message: 'Failed to check model context'
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (model) {
      checkModelContext();
    }
  }, [model]);

  const handleCreateCustomModel = async () => {
    if (!model || !newModelName || !customContext) {
      setStatus({
        type: 'error',
        message: 'Please fill in all fields'
      });
      return;
    }

    setIsCreating(true);
    setStatus({ type: null, message: '' });

    try {
      const { data } = await api.post('/api/ollama/create-custom-model', {
        basedOn: model,
        modelName: newModelName,
        contextSize: customContext
      });

      if (data.success) {
        setStatus({
          type: 'success',
          message: `Created custom model "${newModelName}" with ${customContext.toLocaleString()} token context`
        });
        
        // Switch to the new model
        onModelChange(newModelName);
        
        // Clear the form
        setNewModelName('');
      } else {
        throw new Error(data.error || 'Failed to create custom model');
      }
    } catch (error: any) {
      setStatus({
        type: 'error',
        message: error.message || 'Failed to create custom model'
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Generate suggested model name
  const generateModelName = () => {
    if (!model) return;
    
    const baseModel = model.split(':')[0];
    const contextK = Math.round(customContext / 1024);
    const suggestedName = `${baseModel}:${contextK}k-context`;
    setNewModelName(suggestedName);
  };

  return (
    <Box>
      {/* Current Context Display */}
      <Box sx={{ mb: 3, p: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.05)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Memory sx={{ fontSize: 20 }} />
          <Typography variant="subtitle2">Current Context Size</Typography>
        </Box>
        {isChecking ? (
          <CircularProgress size={20} />
        ) : currentContext ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip 
              label={`${currentContext.toLocaleString()} tokens`} 
              color="primary" 
              size="small" 
            />
            <Button
              size="small"
              startIcon={<Refresh />}
              onClick={checkModelContext}
              sx={{ ml: 'auto' }}
            >
              Refresh
            </Button>
          </Box>
        ) : (
          <Typography variant="body2" color="textSecondary">
            Select a model to check context size
          </Typography>
        )}
      </Box>

      {/* Create Custom Model */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 2 }}>
          Create Custom Context Model
        </Typography>
        
        <StyledFormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Context Size</InputLabel>
          <Select
            value={customContext}
            onChange={(e) => {
              setCustomContext(Number(e.target.value));
              generateModelName();
            }}
            label="Context Size"
          >
            {CONTEXT_PRESETS.map(preset => (
              <MenuItem key={preset.value} value={preset.value}>
                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{preset.label}</span>
                  <Typography variant="caption" color="textSecondary">
                    {preset.ram}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
            <MenuItem value={-1}>Custom...</MenuItem>
          </Select>
        </StyledFormControl>

        {customContext === -1 && (
          <StyledTextField
            fullWidth
            label="Custom Context Size"
            type="number"
            placeholder="e.g., 49152"
            onChange={(e) => {
              const value = parseInt(e.target.value);
              if (value > 0) {
                setCustomContext(value);
                generateModelName();
              }
            }}
            helperText="Enter custom token count (must be positive)"
            sx={{ mb: 2 }}
          />
        )}

        <StyledTextField
          fullWidth
          label="New Model Name"
          value={newModelName}
          onChange={(e) => setNewModelName(e.target.value)}
          placeholder="e.g., llama3.1:32k-context"
          helperText="Name for your custom context model"
          sx={{ mb: 2 }}
        />

        <Button
          fullWidth
          variant="contained"
          onClick={handleCreateCustomModel}
          disabled={!model || !newModelName || !customContext || customContext === -1 || isCreating}
          startIcon={isCreating ? <CircularProgress size={16} /> : <Memory />}
        >
          {isCreating ? 'Creating Model...' : 'Create Custom Model'}
        </Button>
      </Box>

      {/* Status Messages */}
      {status.type && (
        <Alert severity={status.type} sx={{ mt: 2 }}>
          {status.message}
        </Alert>
      )}

      {/* RAM Usage Note */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="body2">
          <strong>Note:</strong> Larger context windows require more RAM. Ensure your system has enough memory for the selected context size. The model will be created based on "{model || 'current model'}".
        </Typography>
      </Alert>
    </Box>
  );
};