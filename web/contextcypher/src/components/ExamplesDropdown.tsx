import React, { useState } from 'react';
import { 
  Button, 
  Menu, 
  MenuItem, 
  Dialog, 
  DialogContent, 
  DialogActions,
  Typography,
  Box,
  useTheme,
  Chip,
  Divider
} from '@mui/material';
import { ChevronDown, Database, Cloud, Shield, Brain, AlertTriangle, FileWarning } from 'lucide-react';
import { ExampleSystem, exampleSystems } from '../data/exampleSystems';
import { transitions } from '../styles/Theme';

interface ExamplesDropdownProps {
  onSelectExample: (example: ExampleSystem) => void;
}

const getExampleIcon = (exampleId: string, primaryColor: string) => {
  const iconProps = { size: 40, strokeWidth: 1.5 };
  
  if (exampleId.includes('azure') || exampleId.includes('cloud')) {
    return <Cloud {...iconProps} color={primaryColor} />;
  } else if (exampleId.includes('enterprise') || exampleId.includes('datacenter')) {
    return <Database {...iconProps} color={primaryColor} />;
  } else if (exampleId.includes('llm') || exampleId.includes('ai')) {
    return <Brain {...iconProps} color={primaryColor} />;
  } else {
    return <Shield {...iconProps} color={primaryColor} />;
  }
};

const getExampleFeatures = (example: ExampleSystem): string[] => {
  const features: string[] = [];
  
  // Count nodes and edges
  if (example.nodes) {
    features.push(`${example.nodes.length} nodes`);
  }
  if (example.edges) {
    features.push(`${example.edges.length} connections`);
  }
  
  // Check for custom context
  if (example.customContext) {
    features.push('Custom context');
  }
  
  // Check for security zones
  const zones = new Set(example.nodes?.map(n => (n.data as any).zone).filter(Boolean));
  if (zones.size > 0) {
    features.push(`${zones.size} security zones`);
  }
  
  // Add category-specific features
  if (example.id.includes('azure')) {
    features.push('Cloud architecture');
  } else if (example.id.includes('enterprise')) {
    features.push('On-premise');
  } else if (example.id.includes('llm')) {
    features.push('AI/ML components');
  }
  
  return features;
};

const ExamplesDropdown: React.FC<ExamplesDropdownProps> = ({ onSelectExample }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedExample, setSelectedExample] = useState<ExampleSystem | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleExampleSelect = (example: ExampleSystem) => {
    setSelectedExample(example);
    setConfirmDialogOpen(true);
    handleClose();
  };

  const handleConfirm = () => {
    if (selectedExample) {
      // The onSelectExample callback will handle setting the custom context
      onSelectExample(selectedExample);
      setConfirmDialogOpen(false);
    }
  };


  return (
    <>
      <Button
        color="inherit"
        onClick={handleClick}
        endIcon={<ChevronDown size={16} />}
        sx={{
          color: theme.colors.textPrimary,
          transition: transitions.default,
          mr: 2,
          fontSize: '14px',
          py: 1,
          px: 2,
          '&:hover': {
            backgroundColor: theme.colors.surfaceHover
          }
        }}
      >
        Examples
      </Button>
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '12px',
            color: theme.colors.textPrimary,
            minWidth: '380px',
            maxWidth: '480px',
            maxHeight: '80vh',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            mt: 1
          }
        }}
      >
        {Object.entries(exampleSystems).map(([category, examples]) => [
          <MenuItem 
            key={`${category}-header`}
            disabled 
            sx={{ 
              background: `linear-gradient(135deg, ${theme.colors.primary}15, ${theme.colors.secondary}10)`,
              color: theme.colors.primary,
              fontWeight: 700,
              fontSize: '13px',
              py: 1.5,
              mx: 1,
              mt: 1,
              mb: 0.5,
              borderRadius: '8px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              borderLeft: `3px solid ${theme.colors.primary}`,
              '&.Mui-disabled': {
                opacity: 1
              }
            }}
          >
            {category}
          </MenuItem>,
          ...examples.map((example) => (
            <MenuItem 
              key={example.id} 
              onClick={() => handleExampleSelect(example)}
              sx={{
                mx: 1,
                mb: 0.5,
                borderRadius: '6px',
                pl: 2,
                pr: 2,
                py: 1.5,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                border: '1px solid transparent',
                '&:hover': {
                  backgroundColor: `${theme.colors.primary}08`,
                  borderColor: `${theme.colors.primary}30`,
                  transform: 'translateY(-1px)',
                  boxShadow: `0 4px 12px ${theme.colors.primary}20`
                }
              }}
            >
              <Box sx={{ width: '100%' }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: theme.colors.textPrimary,
                    fontWeight: 600,
                    mb: 0.5,
                    fontSize: '14px',
                    wordWrap: 'break-word',
                    whiteSpace: 'normal',
                    lineHeight: 1.4,
                    overflowWrap: 'break-word'
                  }}
                >
                  {example.name}
                </Typography>
                
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: theme.colors.textSecondary,
                    display: 'block',
                    lineHeight: 1.4,
                    fontSize: '12px',
                    opacity: 0.85,
                    wordWrap: 'break-word',
                    whiteSpace: 'normal',
                    maxWidth: '100%'
                  }}
                >
                  {example.description}
                </Typography>
              </Box>
            </MenuItem>
          ))
        ]).flat()}
      </Menu>

      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        PaperProps={{
          sx: {
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            color: theme.colors.textPrimary,
            borderRadius: '16px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: `0 20px 60px ${theme.colors.background}80`,
            overflow: 'hidden'
          }
        }}
      >
        {selectedExample && (
          <>
            <Box sx={{
              background: `linear-gradient(135deg, ${theme.colors.primary}15, ${theme.colors.secondary}10)`,
              borderBottom: `1px solid ${theme.colors.border}`,
              p: 3,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: -50,
                right: -50,
                width: 150,
                height: 150,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${theme.colors.primary}20, transparent)`,
              }
            }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, position: 'relative', zIndex: 1 }}>
                {getExampleIcon(selectedExample.id, theme.colors.primary)}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ 
                    fontWeight: 700,
                    color: theme.colors.textPrimary,
                    mb: 0.5
                  }}>
                    {selectedExample.name}
                  </Typography>
                  <Typography variant="body2" sx={{ 
                    color: theme.colors.textSecondary,
                    lineHeight: 1.5
                  }}>
                    {selectedExample.description}
                  </Typography>
                </Box>
              </Box>
            </Box>
            
            <DialogContent sx={{ p: 3 }}>
              <Box sx={{
                background: `${theme.colors.warning}10`,
                border: `1px solid ${theme.colors.warning}30`,
                borderRadius: '12px',
                p: 2,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                mb: 3
              }}>
                <AlertTriangle size={20} color={theme.colors.warning} style={{ flexShrink: 0, marginTop: 2 }} />
                <Box>
                  <Typography variant="body2" sx={{ 
                    fontWeight: 600,
                    color: theme.colors.warning,
                    mb: 0.5
                  }}>
                    Current Work Will Be Lost
                  </Typography>
                  <Typography variant="caption" sx={{ 
                    color: theme.colors.textSecondary,
                    display: 'block',
                    lineHeight: 1.4
                  }}>
                    Loading this example will replace your current diagram. Make sure to save any important work before proceeding.
                  </Typography>
                </Box>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ 
                  color: theme.colors.textSecondary,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'block',
                  mb: 1
                }}>
                  Example includes:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {getExampleFeatures(selectedExample).map((feature, index) => (
                    <Chip
                      key={index}
                      label={feature}
                      size="small"
                      sx={{
                        backgroundColor: `${theme.colors.primary}15`,
                        color: theme.colors.primary,
                        borderRadius: '8px',
                        fontSize: '12px',
                        height: '24px',
                        '& .MuiChip-label': {
                          px: 1.5
                        }
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </DialogContent>
            
            <Divider sx={{ borderColor: theme.colors.border }} />
            
            <DialogActions sx={{ 
              p: 3,
              gap: 1.5,
              justifyContent: 'space-between'
            }}>
              <Button 
                onClick={() => setConfirmDialogOpen(false)}
                size="medium"
                sx={{ 
                  color: theme.colors.textSecondary,
                  borderRadius: '10px',
                  px: 3,
                  py: 1,
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: theme.colors.surfaceHover
                  }
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirm}
                variant="contained"
                size="medium"
                startIcon={<FileWarning size={18} />}
                sx={{ 
                  backgroundColor: theme.colors.primary,
                  borderRadius: '10px',
                  px: 3,
                  py: 1,
                  fontWeight: 600,
                  boxShadow: `0 4px 12px ${theme.colors.primary}30`,
                  '&:hover': {
                    backgroundColor: theme.colors.secondary,
                    transform: 'translateY(-1px)',
                    boxShadow: `0 6px 16px ${theme.colors.primary}40`
                  }
                }}
              >
                Load Example
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
};

export default ExamplesDropdown;