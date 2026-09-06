import React, { useState, useEffect } from 'react';
import { 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Box,
  Typography,
  Paper,
  styled,
  CircularProgress,
  useTheme,
  Tabs,
  Tab,
  IconButton
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  Info as InfoIcon,
  CenterFocusStrong as CenterIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { 
  SecurityEdge, 
  DataClassification,
  securityZones,
  SecurityZone
} from '../types/SecurityTypes';
import Draggable from 'react-draggable';
import { isEdgeLabelDuplicate, getSuggestedUniqueLabel } from '../utils/labelUtils';
import { materialIconMappings } from '../utils/materialIconMappings';
import { generateEdgeCode } from '../utils/edgeIndexing';
import '../styles/EdgeEditor.css';

interface EdgeEditorProps {
  edge: SecurityEdge;
  onSave: (updatedEdge: SecurityEdge) => void;
  onClose: () => void;
  isAnalysisPanelOpen?: boolean;
  isCompactViewport?: boolean;
  leftPanelWidth?: number;
  allNodes?: any[];
  allEdges?: SecurityEdge[];
  onAnalyzeEdge?: (edgeId: string) => Promise<void>;
  isFloating?: boolean;
  onDropdownStateChange?: (isOpen: boolean) => void;
  onCenterOnEdge?: () => void;
}

const PaperComponent = React.memo(function PaperComponent(props: any) {
  return (
    <Draggable
      handle=".draggable-header"
      bounds="parent"
      cancel={'[class*="MuiDialogContent-root"]'}
    >
      <Paper {...props} />
    </Draggable>
  );
});

const StyledDialog = styled(Dialog)<{ analysisPanelOpen?: boolean; compactViewport?: boolean; leftPanelWidth?: number }>(({ theme, compactViewport, leftPanelWidth }) => ({
  '& .MuiDialog-paper': {
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    width: compactViewport ? '100vw' : 'min(520px, calc(100vw - 32px))',
    maxWidth: compactViewport ? '100vw' : 'min(520px, calc(100vw - 32px))',
    height: compactViewport ? '100dvh' : 'min(85dvh, 900px)',
    maxHeight: compactViewport ? '100dvh' : 'min(85dvh, 900px)',
    margin: '0',
    overflow: 'hidden', // Changed to hidden so DialogContent can handle scrolling
    border: `1px solid ${theme.colors.border}`,
    borderRadius: compactViewport ? '0' : '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    // Position dialog at top-left of canvas, next to NodeToolbox
    position: 'fixed',
    left: compactViewport ? '0' : `${Math.max(16, Math.round(leftPanelWidth ?? 0) + 8)}px`,
    top: compactViewport ? '0' : '72px', // AppBar height + spacing
    transform: 'none',
    display: 'flex',
    flexDirection: 'column'
  },
  '& .MuiDialogTitle-root': {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textPrimary,
  },
  '& .MuiDialogContent-root': {
    backgroundColor: theme.colors.surface,
    overflow: 'auto', // Enable scrolling in content area
    padding: '24px',
    '&::-webkit-scrollbar': {
      width: '8px',
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: theme.colors.surface,
      borderRadius: '4px',
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: theme.colors.border,
      borderRadius: '4px',
      '&:hover': {
        backgroundColor: theme.colors.textSecondary,
      }
    }
  },
  '& .MuiDialogActions-root': {
    backgroundColor: theme.colors.surface,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  '& .MuiTextField-root .MuiInputBase-input': {
    color: theme.colors.textPrimary,
  },
  '& .MuiTextField-root .MuiInputLabel-root': {
    color: theme.colors.textSecondary,
  },
  '& .MuiTextField-root .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: theme.colors.border,
    },
    '&:hover fieldset': {
      borderColor: theme.colors.primary,
    },
  },
  '& .MuiSelect-root': {
    color: theme.colors.textPrimary,
  },
  '& .MuiSelect-icon': {
    color: theme.colors.textSecondary,
  },
  '& .MuiFormLabel-root': {
    color: theme.colors.textSecondary,
  },
}));

const EdgeEditor: React.FC<EdgeEditorProps> = ({
  edge,
  onSave,
  onClose,
  isAnalysisPanelOpen = false,
  isCompactViewport = false,
  leftPanelWidth = 0,
  allNodes = [],
  allEdges = [],
  onAnalyzeEdge,
  isFloating = false,
  onDropdownStateChange,
  onCenterOnEdge
}) => {
  const theme = useTheme();
  const [editedEdge, setEditedEdge] = useState<SecurityEdge>({
    ...edge,
    data: edge.data || {}
  });
  
  // Track dropdown open state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // Notify parent when dropdown state changes
  useEffect(() => {
    if (onDropdownStateChange) {
      onDropdownStateChange(dropdownOpen);
    }
  }, [dropdownOpen, onDropdownStateChange]);
  
  // Validation states
  const [labelError, setLabelError] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);
  // const [hasValidated, setHasValidated] = useState(false); // Not currently used
  
  // Tab state
  const [activeTab, setActiveTab] = useState(0);
  
  
  // Update editedEdge when the edge prop changes (e.g., after analysis)
  useEffect(() => {
    setEditedEdge({
      ...edge,
      data: edge.data || {}
    });
  }, [edge]);
  
  // Validate label uniqueness using labelUtils
  const validateLabel = async (label: string) => {
    if (!label || !label.trim()) {
      setLabelError('Label is required');
      return false;
    }

    setIsValidating(true);
    setLabelError('');

    try {
      // Use labelUtils for direct validation
      const isDuplicate = isEdgeLabelDuplicate(label, allEdges, edge.id);
      
      if (isDuplicate) {
        const suggestedLabel = getSuggestedUniqueLabel(
          label,
          (testLabel) => isEdgeLabelDuplicate(testLabel, allEdges, edge.id)
        );
        setLabelError(`Label "${label}" already exists. Suggested: "${suggestedLabel}"`);
        return false;
      }

      setLabelError('');
      return true;
    } catch (error) {
      console.error('Validation error:', error);
      setLabelError('');
      return true; // Don't block on validation errors
    } finally {
      setIsValidating(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    // Trigger validation for label changes (debounced) while still updating state
    if (field === 'data.label') {
      setTimeout(() => validateLabel(value), 500);
      // validate label with debounce but ensure update proceeds
    }

    setEditedEdge(prev => {
      let newEdge;
      if (field.startsWith('data.')) {
        // Handle nested data properties
        const dataField = field.replace('data.', '');
        newEdge = {
          ...prev,
          data: {
            ...prev.data,
            [dataField]: value
          }
        };
      } else {
        // Handle top-level properties like 'zone'
        newEdge = {
          ...prev,
          data: {
            ...prev.data,
            [field]: value
          }
        };
      }
      
      // Debug log for port range changes
      if (field === 'data.portRange') {
        console.log('EdgeEditor: Port range changed:', {
          field,
          value,
          newData: newEdge.data
        });
      }
      
      return newEdge;
    });
  };
  
  const handleSaveClick = async () => {
    // Validate label before saving
    const isValid = await validateLabel(editedEdge.data?.label || '');
    if (isValid) {
      console.log('EdgeEditor: Saving edge with data:', {
        id: editedEdge.id,
        data: editedEdge.data,
        portRange: editedEdge.data?.portRange
      });
      onSave(editedEdge);
      // Don't close the editor on save
    }
  };
  


  const dataClassifications: { value: DataClassification; description: string }[] = [
    { value: 'Public', description: 'Anyone can access this data' },
    { value: 'Internal', description: 'For internal use within organization' },
    { value: 'Sensitive', description: 'Requires special handling and protection' },
    { value: 'Confidential', description: 'Highest level of protection required' }
  ];

  // const securityZones: SecurityZone[] = [ // Not currently used
  //   'Internet',
  //   'DMZ',
  //   'Trusted',
  //   'Restricted',
  //   'OT',
  //   'Cloud',
  //   'Development',
  //   'Production'
  // ]; // End of commented securityZones

  // Find source and target nodes
  const sourceNode = allNodes.find(node => node.id === edge.source);
  const targetNode = allNodes.find(node => node.id === edge.target);

  // Helper function to get node index code from node data
  const getNodeIndexCode = (node: any) => {
    if (!node) return 'unknown';
    // Use the existing index code from the node's data
    return node.data?.indexCode || 'unknown';
  };

  // Helper function to get icon for a node type
  const getNodeIcon = (nodeType?: string) => {
    if (!nodeType || !materialIconMappings[nodeType]) {
      return null;
    }
    const iconComponent = materialIconMappings[nodeType].icon;
    if (!iconComponent) return null;
    
    return React.createElement(iconComponent, {
      sx: {
        fontSize: 20,
        color: theme.colors.primary
      }
    });
  };

  const edgeIndexCode = (edge.data as any)?.indexCode || generateEdgeCode(edge, allNodes);

  // Extract content rendering for reuse
  const renderContent = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', maxWidth: '100%', minWidth: 0 }}>
            {/* Connection Information Box */}
            <Box sx={{ 
              p: 2, 
              bgcolor: theme.colors.surfaceHover, 
              borderRadius: 1,
              border: `1px solid ${theme.colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <InfoIcon sx={{ color: theme.colors.primary, fontSize: 20 }} />
                <Typography variant="caption" sx={{ color: theme.colors.textSecondary }}>
                  Connection Information
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center' }}>
                <Box sx={{ textAlign: 'center' }}>
                  {sourceNode?.type && getNodeIcon(sourceNode.type) && (
                    <Box sx={{ mb: 0.5 }}>
                      {getNodeIcon(sourceNode.type)}
                    </Box>
                  )}
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    {sourceNode?.data?.label || edge.source}
                  </Typography>
                  <Typography variant="caption" sx={{ color: theme.colors.textSecondary, display: 'block' }}>
                    {sourceNode?.type || 'unknown'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: theme.colors.info, fontFamily: 'monospace' }}>
                    {getNodeIndexCode(sourceNode)}
                  </Typography>
                </Box>
                <ArrowForwardIcon sx={{ color: theme.colors.textSecondary, fontSize: 20, mx: 1 }} />
                <Box sx={{ textAlign: 'center' }}>
                  {targetNode?.type && getNodeIcon(targetNode.type) && (
                    <Box sx={{ mb: 0.5 }}>
                      {getNodeIcon(targetNode.type)}
                    </Box>
                  )}
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    {targetNode?.data?.label || edge.target}
                  </Typography>
                  <Typography variant="caption" sx={{ color: theme.colors.textSecondary, display: 'block' }}>
                    {targetNode?.type || 'unknown'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: theme.colors.info, fontFamily: 'monospace' }}>
                    {getNodeIndexCode(targetNode)}
                  </Typography>
                </Box>
              </Box>
            </Box>

        {/* Edge ID field showing the index code */}
        <TextField
            size="small"
            label="ID"
            value={edgeIndexCode}
            InputProps={{
              readOnly: true,
            }}
            disabled
            sx={{ 
              marginTop: '16px',
              '& .MuiInputBase-input': { 
                color: theme.colors.textSecondary,
                fontFamily: 'monospace',
                fontSize: '0.875rem'
              },
              '& .MuiInputLabel-root': { color: theme.colors.textSecondary },
              '& .Mui-disabled': {
                WebkitTextFillColor: theme.colors.textSecondary,
              }
            }}
        />

        <TextField
            size="small"
            label="Label"
            value={editedEdge.data?.label || ''}
            onChange={(e) => handleChange('data.label', e.target.value)}
            placeholder="e.g., API Connection, Database Link"
            error={!!labelError}
            helperText={labelError || (isValidating ? 'Validating...' : '')}
            InputProps={{
              endAdornment: isValidating ? (
                <CircularProgress size={20} sx={{ ml: 1 }} />
              ) : null
            }}
            />

          <FormControl size="small" fullWidth>
            <InputLabel>
              Security Zone
            </InputLabel>
            <Select
              value={editedEdge.data.zoneMode === 'inherit' || !editedEdge.data.zone ? '__inherit' : editedEdge.data.zone}
              inputProps={{ 'aria-label': 'Security Zone' }}
              onChange={(e) => setEditedEdge(previous => ({ ...previous, data: { ...previous.data, zoneMode: e.target.value === '__inherit' ? 'inherit' : 'override', zone: e.target.value === '__inherit' ? undefined : e.target.value as SecurityZone } }))}
              label="Security Zone"
              onOpen={() => setDropdownOpen(true)}
              onClose={() => setDropdownOpen(false)}
              MenuProps={{
                disablePortal: !isFloating,
                PaperProps: {
                  sx: {
                    maxHeight: 300,
                    zIndex: isFloating ? 1301 : 9999
                  }
                }
              }}
              sx={{}}
            >
              <MenuItem value="__inherit">Automatic (source security zone)</MenuItem>
              {securityZones.map((zone: SecurityZone) => (
                <MenuItem key={zone} value={zone} sx={{ whiteSpace: 'normal' }}>
                  {zone.replace(/([A-Z])/g, ' $1').trim()} Zone
                </MenuItem>
              ))}
            </Select>
          </FormControl>


          <FormControl size="small" fullWidth>
            <InputLabel>
              Data Classification
            </InputLabel>
            <Select
              value={editedEdge.data?.dataClassification || ''}
              onChange={(e) => handleChange('data.dataClassification', e.target.value)}
              label="Data Classification"
              onOpen={() => setDropdownOpen(true)}
              onClose={() => setDropdownOpen(false)}
              MenuProps={{
                disablePortal: !isFloating,
                PaperProps: {
                  sx: {
                    maxHeight: 300,
                    zIndex: isFloating ? 1301 : 9999
                  }
                }
              }}
              sx={{}}
            >
              {dataClassifications.map(({ value, description }) => (
                <MenuItem key={value} value={value}>
                  <Box>
                    <Typography>{value}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="Protocol"
            value={editedEdge.data?.protocol || ''}
            onChange={(e) => handleChange('data.protocol', e.target.value)}
            placeholder="e.g., HTTPS, TCP, UDP"
            sx={{}}
          />

          <TextField
            size="small"
            label="Encryption"
            value={editedEdge.data?.encryption || ''}
            onChange={(e) => handleChange('data.encryption', e.target.value)}
            placeholder="e.g., TLS 1.3, SSH"
            sx={{}}
          />

          <TextField
            size="small"
            label="Port Range"
            value={editedEdge.data?.portRange || ''}
            onChange={(e) => handleChange('data.portRange', e.target.value)}
            placeholder="e.g., 443, 8080-8090"
            sx={{}}
          />
          
          <TextField
            size="small"
            label="Bandwidth"
            value={editedEdge.data?.bandwidth || ''}
            onChange={(e) => handleChange('data.bandwidth', e.target.value)}
            placeholder="e.g., 100 Mbps, 1 Gbps"
            sx={{}}
          />
          
          <TextField
            size="small"
            label="Latency"
            value={editedEdge.data?.latency || ''}
            onChange={(e) => handleChange('data.latency', e.target.value)}
            placeholder="e.g., 10ms, < 5ms"
            sx={{}}
          />
          
          <FormControl size="small" fullWidth>
            <InputLabel>Redundancy</InputLabel>
            <Select
              value={editedEdge.data?.redundancy !== undefined ? String(editedEdge.data.redundancy) : ''}
              onChange={(e) => handleChange('data.redundancy', e.target.value === 'true')}
              label="Redundancy"
              onOpen={() => setDropdownOpen(true)}
              onClose={() => setDropdownOpen(false)}
              MenuProps={{
                disablePortal: !isFloating,
                PaperProps: {
                  sx: {
                    maxHeight: 200,
                    zIndex: isFloating ? 1301 : 9999,
                    minWidth: '180px',
                    bgcolor: theme.colors.surface,
                    border: `1px solid ${theme.colors.border}`,
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                  }
                }
              }}
              sx={{}}
            >
              <MenuItem value="">Not specified</MenuItem>
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="Security Controls"
            value={editedEdge.data?.securityControls?.join(', ') || ''}
            onChange={(e) => handleChange('data.securityControls', e.target.value.split(',').map(c => c.trim()))}
            placeholder="e.g., Encryption, Authentication, Access Control"
            sx={{}}
          />

          <TextField
            size="small"
            label="Description"
            value={editedEdge.data?.description || ''}
            onChange={(e) => handleChange('data.description', e.target.value)}
            placeholder="Describe the purpose and security requirements of this connection"
            multiline
            rows={3}
            sx={{}}
          />
    </Box>
  );

  // If floating mode, render without Dialog wrapper
  if (isFloating) {
    return (
      <Box 
        className={`edge-editor-floating ${dropdownOpen ? 'dropdown-open' : ''}`}
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          height: 'min(calc(100dvh - 100px), 760px)',
          maxHeight: 'calc(100dvh - 100px)',
          backgroundColor: theme.colors.surface,
          color: theme.colors.textPrimary,
          position: 'relative', // Important for dropdown positioning
          zIndex: 1000, // Same as floating panel
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          borderRadius: '12px',
          border: `1px solid ${theme.colors.border}`,
          boxSizing: 'border-box'
        }}>
        <Tabs 
          value={activeTab} 
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ 
            borderBottom: `1px solid ${theme.colors.border}`,
            flexShrink: 0, // Prevent tabs from shrinking
            '& .MuiTab-root': {
              minHeight: 36,
              fontSize: '0.875rem',
              textTransform: 'none',
              minWidth: 'auto',
              px: 2,
              color: theme.colors.textSecondary,
              '&.Mui-selected': {
                color: theme.colors.primary
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: theme.colors.primary
            }
          }}
        >
          <Tab label="Properties" />
        </Tabs>
        
        <Box className="edge-editor-floating-actions">
          {onCenterOnEdge && (
            <Button 
              onClick={onCenterOnEdge}
              variant="outlined"
              size="small"
              startIcon={<CenterIcon />}
              sx={{ 
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-textPrimary)',
                '&:hover': {
                  borderColor: 'var(--theme-primary)',
                  backgroundColor: 'var(--theme-surfaceHover)'
                }
              }}
            >
              Center on Edge
            </Button>
          )}
          <Button 
            onClick={onClose}
            variant="outlined"
            size="small"
            sx={{ 
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-textPrimary)',
              '&:hover': {
                borderColor: 'var(--theme-primary)',
                backgroundColor: 'var(--theme-surfaceHover)'
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveClick} 
            variant="contained"
            color="primary"
            size="small"
            disabled={isValidating || !!labelError}
            sx={{
              backgroundColor: 'var(--theme-primary)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'var(--theme-primary)',
                opacity: 0.9,
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(var(--theme-primary-rgb), 0.3)'
              },
              '&:disabled': {
                backgroundColor: 'var(--theme-surfaceHover)',
                color: 'var(--theme-textSecondary)'
              }
            }}
          >
            {isValidating ? 'Validating...' : 'Save'}
          </Button>
        </Box>
        
        <Box className="edge-editor-floating-content">
          {activeTab === 0 && renderContent()}
        </Box>
      </Box>
    );
  }

  // Original Dialog mode
  return (
    <StyledDialog
      open={true}
      onClose={onClose}
      PaperComponent={isCompactViewport ? undefined : PaperComponent}
      aria-labelledby="draggable-dialog-title"
      analysisPanelOpen={isAnalysisPanelOpen}
      compactViewport={isCompactViewport}
      leftPanelWidth={leftPanelWidth}
      hideBackdrop={!isCompactViewport}
      fullScreen={isCompactViewport}
    >
      <DialogTitle 
        className={isCompactViewport ? undefined : 'draggable-header'}
        sx={{
          cursor: isCompactViewport ? 'default' : 'move',
          padding: isCompactViewport ? '8px 12px 0px 12px' : '8px 16px 0px 16px',
          fontSize: '1rem',
          minHeight: '32px'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="inherit" sx={{ fontWeight: 600 }}>
            Edit Connection
          </Typography>
          <IconButton
            onClick={onClose}
            size="small"
            aria-label="Close Edge Editor"
            sx={{
              color: theme.colors.textSecondary,
              '&:hover': {
                backgroundColor: theme.colors.surfaceHover,
                color: theme.colors.textPrimary
              }
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <Tabs 
        value={activeTab} 
        onChange={(_, newValue) => setActiveTab(newValue)}
        sx={{ 
          borderBottom: `1px solid ${theme.colors.border}`,
          '& .MuiTab-root': {
            minHeight: 36,
            fontSize: '0.875rem',
            textTransform: 'none',
            minWidth: 'auto',
            px: 2,
            color: theme.colors.textSecondary,
            '&.Mui-selected': {
              color: theme.colors.primary
            }
          },
          '& .MuiTabs-indicator': {
            backgroundColor: theme.colors.primary
          }
        }}
      >
        <Tab label="Properties" />
      </Tabs>

      <DialogContent sx={{ 
        padding: '16px', 
        paddingTop: '16px', 
        marginTop: '5px',
        overflow: 'auto !important',
        flex: 1, // Make content area flexible
        minHeight: 0, // Important for proper flex behavior
        display: 'flex',
        flexDirection: 'column',
        '&::-webkit-scrollbar': {
          width: '10px',
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: 'rgba(0,0,0,0.1)',
          borderRadius: '5px',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(0,0,0,0.3)',
          borderRadius: '5px',
          '&:hover': {
            backgroundColor: 'rgba(0,0,0,0.5)',
          }
        }
      }}>
        {/* Properties Tab */}
        {activeTab === 0 && renderContent()}
      </DialogContent>

      <DialogActions sx={{ 
        padding: isCompactViewport ? '8px 12px' : '8px 16px',
        flexShrink: 0, // Prevent actions from shrinking
        backgroundColor: theme.colors.surface,
        borderTop: `1px solid ${theme.colors.border}`,
        flexWrap: 'wrap',
        gap: 1
      }}>
        {onCenterOnEdge && (
          <Button 
            onClick={onCenterOnEdge}
            color="inherit"
            startIcon={<CenterIcon />}
          >
            Center on Edge
          </Button>
        )}
        <Button 
          onClick={onClose}
          color="inherit"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSaveClick} 
          variant="contained"
          color="primary"
          disabled={isValidating || !!labelError}
        >
          {isValidating ? 'Validating...' : 'Save'}
        </Button>
      </DialogActions>
    </StyledDialog>
  );
};

// Custom comparison function for React.memo
// Only re-render if edge data changes or dialog visibility changes
const areEqual = (prevProps: EdgeEditorProps, nextProps: EdgeEditorProps) => {
  return (
    prevProps.edge.id === nextProps.edge.id &&
    JSON.stringify(prevProps.edge.data) === JSON.stringify(nextProps.edge.data) &&
    prevProps.isAnalysisPanelOpen === nextProps.isAnalysisPanelOpen &&
    prevProps.isCompactViewport === nextProps.isCompactViewport &&
    prevProps.leftPanelWidth === nextProps.leftPanelWidth
  );
};

export default React.memo(EdgeEditor, areEqual);
