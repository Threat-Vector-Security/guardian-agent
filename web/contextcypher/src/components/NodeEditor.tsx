import React, { useState, useMemo, useEffect } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, Button, Select, MenuItem, 
  FormControl, InputLabel, Paper, useTheme, styled,
  Chip, CircularProgress,
  Tabs, Tab,
  Tooltip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  Assessment as AnalysisIcon,
  CenterFocusStrong as CenterIcon,
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
  Info as InfoIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { 
  SecurityNode, 
  SecurityEdge,
  DataClassification,
  SecurityNodeData,
  SecurityZoneNodeData,
  getZoneDefaults,
  isSecurityZoneNode,
  securityZones,
  SecurityZone,
  DFDActorNodeData,
  DFDProcessNodeData,
  DFDDataStoreNodeData,
  DFDTrustBoundaryNodeData,
  DFDNodeType,
  DFDCategory,
  SecurityNodeType
} from '../types/SecurityTypes';
import Draggable from 'react-draggable';
import { IconSelector } from './IconSelector';
import { ShapeSelector } from './ShapeSelector';

import { getDefaultIconForType } from '../utils/iconUtils';
import { deserializeIcon } from '../utils/iconSerialization';
import { isNodeLabelDuplicate, getSuggestedUniqueLabel } from '../utils/labelUtils';
import { regenerateNodeIndexCode, updateConnectedEdgesIndexCodes } from '../utils/edgeIndexing';
import { getSuggestedDFDTypes, nodeToDFDCategory } from '../utils/dfdCategoryMappings';
import '../styles/ModernStyles.css';
import '../styles/NodeEditor.css';
import { DEFAULT_NODE_SHAPE } from '../types/ShapeTypes';
import { useSettings } from '../settings/SettingsContext';
import { useManualAnalysis } from '../contexts/ManualAnalysisContext';
import { ManualFinding } from '../types/ManualAnalysisTypes';
import { DiagramAttackPath } from '../types/GrcTypes';
import { StrideCategory } from '../types/ThreatIntelTypes';
import { manualRuleCatalog } from '../data/manualRuleCatalog';
import { STRIDE_SHORT, STRIDE_COLORS, createDiagramAttackPath } from '../utils/attackPathUtils';

const STRIDE_APPLICABILITY: Record<string, { key: string; label: string; color: string }[]> = {
  actor: [
    { key: 'S', label: 'Spoofing', color: '#7c3aed' },
    { key: 'R', label: 'Repudiation', color: '#0284c7' },
  ],
  process: [
    { key: 'S', label: 'Spoofing', color: '#7c3aed' },
    { key: 'T', label: 'Tampering', color: '#dc2626' },
    { key: 'R', label: 'Repudiation', color: '#0284c7' },
    { key: 'I', label: 'Info Disclosure', color: '#d97706' },
    { key: 'D', label: 'Denial of Service', color: '#2563eb' },
    { key: 'E', label: 'Elev. of Privilege', color: '#059669' },
  ],
  dataStore: [
    { key: 'T', label: 'Tampering', color: '#dc2626' },
    { key: 'R', label: 'Repudiation', color: '#0284c7' },
    { key: 'I', label: 'Info Disclosure', color: '#d97706' },
    { key: 'D', label: 'Denial of Service', color: '#2563eb' },
  ],
  trustBoundary: [
    { key: 'S', label: 'Spoofing', color: '#7c3aed' },
    { key: 'E', label: 'Elev. of Privilege', color: '#059669' },
  ],
};

const DFD_ELEMENT_LABELS: Record<string, string> = {
  actor: 'External Entity',
  process: 'Process',
  dataStore: 'Data Store',
  trustBoundary: 'Trust Boundary',
};

const resolveFindingStride = (finding: ManualFinding): StrideCategory[] => {
  if (finding.strideCategories && finding.strideCategories.length > 0) {
    return finding.strideCategories;
  }
  return (manualRuleCatalog[finding.ruleId]?.references?.stride as StrideCategory[] | undefined) ?? [];
};

interface NodeEditorProps {
  node: SecurityNode;
  onUpdate: (node: SecurityNode) => void;
  onClose: () => void;
  edges?: SecurityEdge[];
  allNodes?: SecurityNode[];
  onEdgesUpdate?: (edges: SecurityEdge[]) => void;
  isAnalysisPanelOpen?: boolean;
  onAnalyzeNode?: (nodeId: string) => Promise<void>;
  isFloating?: boolean;
  isCompactViewport?: boolean;
  leftPanelWidth?: number;
  onDropdownStateChange?: (isOpen: boolean) => void;
  onCenterOnNode?: () => void;
  onOpenAssessmentForZone?: (zone: string, options?: { openRiskPlan?: boolean }) => void;
  onCreateAttackPath?: (path: DiagramAttackPath) => void;
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
    width: compactViewport ? '100vw' : 'min(560px, calc(100vw - 32px))',
    maxWidth: compactViewport ? '100vw' : 'min(560px, calc(100vw - 32px))',
    height: compactViewport ? '100dvh' : 'min(80dvh, 860px)',
    maxHeight: compactViewport ? '100dvh' : 'min(80dvh, 860px)',
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
    padding: '20px 24px',
    fontSize: '1.1rem',
    fontWeight: 600,
  },
  '& .MuiDialogContent-root': {
    backgroundColor: theme.colors.surface,
    padding: '24px',
    overflow: 'auto', // Enable scrolling in content area
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
    padding: '16px 24px',
    gap: '12px',
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

const NodeEditor: React.FC<NodeEditorProps> = ({
  node,
  onUpdate,
  onClose,
  edges = [],
  allNodes = [],
  onEdgesUpdate,
  isAnalysisPanelOpen = false,
  onAnalyzeNode,
  isFloating = false,
  isCompactViewport = false,
  leftPanelWidth = 0,
  onDropdownStateChange,
  onCenterOnNode,
  onOpenAssessmentForZone,
  onCreateAttackPath
}) => {
  const theme = useTheme();
  const { settings } = useSettings();
  const { getFindingsForNode, getFindingsForEdge, getFindingsForZone } = useManualAnalysis();
  const isZoneNode = isSecurityZoneNode(node);
  const isDFDNode = (node.type as string).startsWith('dfd');
  const defaultDfdCategory = !isDFDNode && !isZoneNode
    ? nodeToDFDCategory[node.type as keyof typeof nodeToDFDCategory] ?? null
    : null;
  const defaultDfdLabel = defaultDfdCategory ? (DFD_ELEMENT_LABELS[defaultDfdCategory] ?? 'None') : 'None';
  // Find all edges connected to this node
  const connectedEdges = useMemo(() => {
    return edges.filter(edge => edge.source === node.id || edge.target === node.id);
  }, [edges, node.id]);

  const ruleBasedFindings = useMemo(() => {
    const seen = new Set<string>();
    const results: { finding: ReturnType<typeof getFindingsForNode>[number]; sourceEdge: SecurityEdge | null }[] = [];

    getFindingsForNode(node.id).forEach(f => {
      if (seen.has(f.id)) return;
      seen.add(f.id);
      results.push({ finding: f, sourceEdge: null });
    });

    connectedEdges.forEach(edge => {
      getFindingsForEdge(edge.id).forEach(f => {
        if (seen.has(f.id)) return;
        seen.add(f.id);
        results.push({ finding: f, sourceEdge: edge });
      });
    });

    if (isZoneNode) {
      getFindingsForZone(node.id).forEach(f => {
        if (seen.has(f.id)) return;
        seen.add(f.id);
        results.push({ finding: f, sourceEdge: null });
      });
    }

    return results;
  }, [getFindingsForNode, getFindingsForEdge, getFindingsForZone, node.id, connectedEdges, isZoneNode]);
  const hasRuleBasedFindings = ruleBasedFindings.length > 0;
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
  const [, setHasValidated] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState(0);
  
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [createdFromFindingIds, setCreatedFromFindingIds] = useState<string[]>([]);

  const handleCreateAttackPath = (finding: ManualFinding) => {
    const resolved = resolveFindingStride(finding);
    const strideCategory: StrideCategory = resolved[0] ?? 'Spoofing';
    const newPath = { ...createDiagramAttackPath(finding.title, strideCategory), description: finding.description };
    onCreateAttackPath?.(newPath);
    setCreatedFromFindingIds(prev => [...prev, finding.id]);
    setTimeout(() => {
      setCreatedFromFindingIds(prev => prev.filter(id => id !== finding.id));
    }, 2000);
  };

  // Then state initialization
  const [editedNode, setEditedNode] = useState<SecurityNode>(() => {
    if (isZoneNode) {
      // For zone nodes, exclude icon
      const { icon, ...zoneData } = node.data as any;
      return {
        ...node,
        data: zoneData
      } as SecurityNode;
    }
    // For regular nodes, include icon from node data or get default
    const nodeType = node.type as SecurityNodeType;
    const existingIcon = (node.data as SecurityNodeData).icon;
    return {
      ...node,
      data: {
        ...node.data,
        icon: deserializeIcon(existingIcon, nodeType) || getDefaultIconForType(nodeType)
      }
    } as SecurityNode;
  });

  const effectiveDfdCategory = !isDFDNode && !isZoneNode
    ? ((editedNode.data.dfdCategory || defaultDfdCategory) as string | null)
    : null;
  const applicableStrideCategories = effectiveDfdCategory ? (STRIDE_APPLICABILITY[effectiveDfdCategory] ?? []) : [];

  const nodeIconValue = (editedNode.data as any)?.icon;
  const fallbackNodeIcon = getDefaultIconForType(node.type as SecurityNodeType);
  const NodeIcon = useMemo(() => {
    if (!nodeIconValue) return fallbackNodeIcon;
    if (typeof nodeIconValue === 'function' ||
        (typeof nodeIconValue === 'object' && nodeIconValue !== null && (nodeIconValue as any).$$typeof)) {
      return nodeIconValue as React.ElementType;
    }
    return deserializeIcon(nodeIconValue, node.type as SecurityNodeType);
  }, [nodeIconValue, node.type, fallbackNodeIcon]);

  // Then getCurrentZoneValue as a separate function
  const getCurrentZoneValue = () => {
    if (isZoneNode) {
      return (editedNode.data as SecurityZoneNodeData).zoneType || '';
    }
    
    // For DFD nodes, zone is optional
    if (isDFDNode) {
      const dfdData = editedNode.data as DFDActorNodeData | DFDProcessNodeData | DFDDataStoreNodeData | DFDTrustBoundaryNodeData;
      return dfdData.zone || '';
    }
    
    return (editedNode.data as SecurityNodeData).zone || '';
  };

  // Update editedNode when the node prop changes (e.g., after analysis)
  useEffect(() => {
    if (isZoneNode) {
      // For zone nodes, exclude icon
      const { icon, ...zoneData } = node.data as any;
      setEditedNode({
        ...node,
        data: zoneData
      });
    } else if (isDFDNode) {
      // For DFD nodes, don't add icon property
      setEditedNode({
        ...node,
        data: node.data
      } as SecurityNode);
    } else {
      // For regular nodes, include icon from node data or get default
      const regularNodeData = node.data as SecurityNodeData;
      setEditedNode({
        ...node,
        data: {
          ...regularNodeData,
          icon: deserializeIcon(regularNodeData.icon, node.type as SecurityNodeType) || getDefaultIconForType(node.type as SecurityNodeType)
        }
      } as SecurityNode);
    }
  }, [node, isZoneNode, isDFDNode, getDefaultIconForType]);

  // Update editedNode when node prop changes (e.g., after analysis)
  useEffect(() => {
    // Only update if the additionalContext has changed (indicating new analysis)
    if (node.data.additionalContext !== editedNode.data.additionalContext) {
      console.log('[NodeEditor] Updating editedNode with new analysis data');
      setEditedNode(prevNode => {
        // Check if it's a security zone node
        if (isSecurityZoneNode(prevNode)) {
          return {
            ...prevNode,
            data: {
              ...prevNode.data,
              additionalContext: node.data.additionalContext
            }
          } as SecurityNode;
        } else {
          // It's a regular security node with securityContext
          return {
            ...prevNode,
            data: {
              ...prevNode.data,
              additionalContext: node.data.additionalContext,
              securityContext: 'securityContext' in node.data ? node.data.securityContext : undefined
            }
          } as SecurityNode;
        }
      });
    }
  }, [node.data.additionalContext, editedNode.data.additionalContext, 'securityContext' in node.data ? node.data.securityContext : undefined]);

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
      const isDuplicate = isNodeLabelDuplicate(label, allNodes, node.id);
      
      if (isDuplicate) {
        const suggestedLabel = getSuggestedUniqueLabel(
          label,
          (testLabel) => isNodeLabelDuplicate(testLabel, allNodes, node.id)
        );
        setLabelError(`Label "${label}" already exists. Suggested: "${suggestedLabel}"`);
        setHasValidated(true);
        return false;
      }

      setLabelError('');
      setHasValidated(true);
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
    // Trigger validation for label changes
    if (field === 'data.label') {
      // Debounce validation
      setTimeout(() => {
        validateLabel(value);
      }, 500);
    }

    setEditedNode(prev => {
      if (isSecurityZoneNode(prev)) {
        // For zone nodes, don't handle icon changes
        if (field === 'data.icon') return prev;
        
        const newData = { ...prev.data };
        if (field.startsWith('data.')) {
          const dataField = field.replace('data.', '');
          (newData as any)[dataField] = value;
        } else {
          (newData as any)[field] = value;
        }
        return {
          ...prev,
          data: newData
        } as SecurityNode;
      } else {
        // For regular and DFD nodes, handle all changes appropriately
        const newData = { ...prev.data };
        if (field === 'data.icon' && !isDFDNode) {
          console.log('NodeEditor: Setting icon:', {
            field,
            value,
            valueType: typeof value,
            currentIcon: newData.icon
          });
          newData.icon = value;
        } else if (field.startsWith('data.')) {
          const dataField = field.replace('data.', '');
          (newData as any)[dataField] = value;
        } else {
          (newData as any)[field] = value;
        }
        return {
          ...prev,
          data: newData
        } as SecurityNode;
      }
    });
  };


  const handleZoneChange = (newZone: SecurityZone | '') => {
    // Handle empty zone for DFD nodes
    if (newZone === '') {
      setEditedNode(prev => {
        const updatedNode = {
          ...prev,
          data: {
            ...prev.data,
            zone: undefined,
            dataClassification: prev.data.dataClassification || 'Public'
          }
        } as SecurityNode;
        onUpdate(updatedNode);
        return updatedNode;
      });
      return;
    }
    
    const zoneDefaults = getZoneDefaults(newZone as SecurityZone);
    
    setEditedNode(prev => {
      if (isSecurityZoneNode(prev)) {
        const updatedZoneNode = {
          ...prev,
          data: {
            ...prev.data,
            zoneType: newZone,
            dataClassification: zoneDefaults.dataClassification
          }
        } as SecurityNode;
        // Immediately update the parent
        onUpdate(updatedZoneNode);
        return updatedZoneNode;
      }
      
      // For regular nodes, regenerate index code when zone changes
      let newIndexCode = prev.data?.indexCode;
      if (allNodes && prev.data?.zone !== newZone) {
        // Zone is changing, regenerate index code
        newIndexCode = regenerateNodeIndexCode(prev, newZone, allNodes);
      }
      
      const updatedNode = {
        ...prev,
        data: {
          ...prev.data,
          zone: newZone,
          dataClassification: zoneDefaults.dataClassification,
          indexCode: newIndexCode
        }
      } as SecurityNode;
      
      // If we have edges and the index code changed, update connected edges
      if (edges && onEdgesUpdate && newIndexCode !== prev.data?.indexCode) {
        const updatedEdges = updateConnectedEdgesIndexCodes(prev.id, edges, [
          ...allNodes.filter(n => n.id !== prev.id),
          updatedNode
        ]);
        onEdgesUpdate(updatedEdges);
      }
      
      // Immediately update the parent with the new node data
      onUpdate(updatedNode);
      
      return updatedNode;
    });
  };


  const dataClassifications: { value: DataClassification; description: string }[] = [
    { value: 'Public', description: 'Anyone can access this data' },
    { value: 'Internal', description: 'For internal use within organization' },
    { value: 'Sensitive', description: 'Requires special handling and protection' },
    { value: 'Confidential', description: 'Highest level of protection required' }
  ];

  const renderZoneOptions = () => {
    // For DFD nodes, zone is optional
    if (isDFDNode) {
      return (
        <FormControl size="small" fullWidth>
          <InputLabel sx={{ color: theme.colors.textSecondary }}>
            Security Zone (Optional)
          </InputLabel>
          <Select
            value={getCurrentZoneValue()}
            onChange={(e) => handleZoneChange(e.target.value as SecurityZone | '')}
            label="Security Zone (Optional)"
            onOpen={() => setDropdownOpen(true)}
            onClose={() => setDropdownOpen(false)}
            MenuProps={{
              disablePortal: !isFloating,
              PaperProps: {
                sx: {
                  maxHeight: 300,
                  zIndex: isFloating ? 1301 : 9999,
                  minWidth: '280px',
                  bgcolor: theme.colors.surface,
                  border: `1px solid ${theme.colors.border}`,
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                }
              },
              anchorOrigin: {
                vertical: 'bottom',
                horizontal: 'left',
              },
              transformOrigin: {
                vertical: 'top',
                horizontal: 'left',
              },
            }}
            sx={{
              color: theme.colors.textPrimary,
              '& .MuiSelect-icon': { color: theme.colors.textSecondary }
            }}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {securityZones.map((zone: SecurityZone) => (
              <MenuItem key={zone} value={zone} sx={{ whiteSpace: 'normal' }}>
                {zone.replace(/([A-Z])/g, ' $1').trim()} Zone
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    }
    
    // Original zone options for non-DFD nodes
    return (
      <FormControl size="small" fullWidth>
        <InputLabel sx={{ color: theme.colors.textSecondary }}>
          Security Zone
        </InputLabel>
        <Select
          value={getCurrentZoneValue()}
          onChange={(e) => handleZoneChange(e.target.value as SecurityZone)}
          label="Security Zone"
          onOpen={() => setDropdownOpen(true)}
          onClose={() => setDropdownOpen(false)}
          MenuProps={{
          disablePortal: !isFloating, // Use portal in floating mode
          PaperProps: {
            sx: {
              maxHeight: 300,
              zIndex: isFloating ? 1301 : 9999, // Slightly higher than base dropdown z-index
              minWidth: '280px',
              bgcolor: theme.colors.surface,
              border: `1px solid ${theme.colors.border}`,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
            }
          },
          anchorOrigin: {
            vertical: 'bottom',
            horizontal: 'left',
          },
          transformOrigin: {
            vertical: 'top',
            horizontal: 'left',
          },
        }}
        sx={{
          color: theme.colors.textPrimary,
          '& .MuiSelect-icon': { color: theme.colors.textSecondary }
        }}
      >
        {securityZones.map((zone: SecurityZone) => (
          <MenuItem key={zone} value={zone} sx={{ whiteSpace: 'normal' }}>
            {zone.replace(/([A-Z])/g, ' $1').trim()} Zone
          </MenuItem>
        ))}
      </Select>
    </FormControl>
    );
  };

  const handleUpdateClick = async () => {
    // Validate label before saving
    const isValid = await validateLabel(editedNode.data?.label || '');
    if (isValid) {
      console.log('NodeEditor: Saving node with icon:', {
        nodeId: editedNode.id,
        nodeType: editedNode.type,
        icon: 'icon' in editedNode.data ? editedNode.data.icon : undefined,
        iconType: 'icon' in editedNode.data ? typeof editedNode.data.icon : 'N/A',
        fullNode: editedNode
      });
      onUpdate(editedNode);
      // Don't close the editor on save
    }
  };
  
  const handleAnalyzeNode = async () => {
    if (!onAnalyzeNode) return;
    
    setIsAnalyzing(true);
    try {
      await onAnalyzeNode(editedNode.id);
      // Note: The updated node data will come through props when the parent updates
    } catch (error) {
      console.error('Failed to analyze node:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const handleClearThreats = () => {
    // Clear any stored analysis context without changing the node type
    setEditedNode(prev => ({
      ...prev,
      data: {
        ...(prev.data as any),
        additionalContext: undefined,
        securityContext: undefined
      }
    }) as SecurityNode);
    // Local state only; user must click Save to persist.
  };

  const currentZoneValue = String(getCurrentZoneValue() || '').trim();

  // Extract tab content rendering to avoid duplication
  const renderTabContent = () => {
    if (activeTab === 0) {
      // Properties Tab
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', maxWidth: '100%', minWidth: 0 }}>
          {/* Zone Node - Simplified Editor */}
          {isZoneNode && (
            <>
              <TextField
                size="small"
                label="Zone Label"
                value={editedNode.data?.label || ''}
                onChange={(e) => handleChange('data.label', e.target.value)}
                placeholder="e.g., Production Environment, DMZ Network"
                helperText="Display name for this security zone"
                sx={{
                  '& .MuiInputBase-input': { color: theme.colors.textPrimary },
                  '& .MuiInputLabel-root': { color: theme.colors.textSecondary }
                }}
              />

              {renderZoneOptions()}

              <TextField
                size="small"
                label="Description"
                multiline
                rows={4}
                value={editedNode.data.description || ''}
                onChange={(e) => handleChange('data.description', e.target.value)}
                placeholder="Describe this zone's purpose, access controls, and security requirements..."
                helperText="Details about this security zone (for visual display only)"
                sx={{
                  '& .MuiInputBase-input': { color: theme.colors.textPrimary },
                  '& .MuiInputLabel-root': { color: theme.colors.textSecondary }
                }}
              />

              <Typography variant="caption" sx={{ color: theme.colors.textSecondary, fontStyle: 'italic', mt: 1 }}>
                Note: Security zone metadata is for visual display purposes only and is not included in threat analysis context.
              </Typography>
            </>
          )}

          {/* Regular Node - Full Editor */}
          {!isZoneNode && (
            <>
              <Box sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'stretch',
                '& > *': { flex: 1 }
              }}>
                <Box className="node-editor-icon-selector">
                  <IconSelector
                    value={(editedNode.data as SecurityNodeData).icon}
                    onChange={(icon) => handleChange('data.icon', icon)}
                    size={0.8}
                  />
                </Box>

                <Box className="node-editor-icon-selector">
                  <ShapeSelector
                    value={(editedNode.data as SecurityNodeData).shape || DEFAULT_NODE_SHAPE}
                    onChange={(shape) => handleChange('data.shape', shape)}
                    size={0.8}
                  />
                </Box>
              </Box>

              {/* Show the node index code as ID */}
              <TextField
                size="small"
                label="ID"
                value={editedNode.data?.indexCode || 'NO-CODE'}
                InputProps={{
                  readOnly: true,
                }}
                disabled
                sx={{
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
            value={editedNode.data?.label || ''}
            onChange={(e) => handleChange('data.label', e.target.value)} 
            placeholder="e.g., Production API Server, Customer Database"
            error={!!labelError}
            helperText={labelError || (isValidating ? 'Validating...' : '')}
            className="node-editor-field"
            InputProps={{
              endAdornment: isValidating ? (
                <CircularProgress size={20} sx={{ ml: 1 }} />
              ) : null
            }}
            sx={{ 
              '& .MuiInputBase-input': { color: theme.colors.textPrimary },
              '& .MuiInputLabel-root': { color: theme.colors.textSecondary }
            }}
          />
          {!isDFDNode && !isZoneNode && (
            <Typography variant="caption" sx={{ color: theme.colors.textSecondary, mt: -1 }}>
              DFD element type: <strong>{defaultDfdLabel}</strong>
            </Typography>
          )}

          {/* DFD Categorization for non-DFD nodes */}
          {!isDFDNode && !isZoneNode && (
            <Accordion
              sx={{
                backgroundColor: theme.colors.surface,
                borderRadius: 1,
                '&:before': { display: 'none' },
                boxShadow: 'none',
                border: `1px solid ${theme.colors.border}`,
                marginTop: '0 !important',
                '& .MuiAccordionSummary-root': {
                  minHeight: 48,
                  '&.Mui-expanded': {
                    minHeight: 48,
                  }
                }
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: theme.colors.textSecondary }} />}
                sx={{
                  '& .MuiAccordionSummary-content': {
                    margin: '12px 0',
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography variant="body2" sx={{ color: theme.colors.textSecondary }}>
                    DFD Element Type
                  </Typography>
                  <Tooltip title="The DFD element type determines which STRIDE threat categories apply. Processes are vulnerable to all 6 STRIDE threats; External Entities only to Spoofing & Repudiation; Data Stores to Tampering, Repudiation, Info Disclosure & DoS. Open the Methodology Guide for full details." arrow>
                    <InfoIcon sx={{ fontSize: 14, color: theme.colors.textSecondary, cursor: 'help' }} />
                  </Tooltip>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>DFD Category</InputLabel>
                  <Select
                    value={editedNode.data.dfdCategory || ''}
                    onChange={(e) => handleChange('data.dfdCategory', e.target.value)}
                    label="DFD Category"
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
                  >
                    <MenuItem value="">None (use default)</MenuItem>
                    <MenuItem value="actor">External Entity</MenuItem>
                    <MenuItem value="process">Process</MenuItem>
                    <MenuItem value="dataStore">Data Store</MenuItem>
                    <MenuItem value="trustBoundary">Trust Boundary</MenuItem>
                  </Select>
                  <Typography variant="caption" sx={{ color: theme.colors.textSecondary, mt: 0.5 }}>
                    Default for this node type: <strong>{defaultDfdLabel}</strong>
                  </Typography>
                </FormControl>
                {effectiveDfdCategory && STRIDE_APPLICABILITY[effectiveDfdCategory] && (
                  <Box sx={{ p: 1.5, borderRadius: 1, border: `1px solid ${theme.colors.border}`, backgroundColor: theme.colors.surfaceHover }}>
                    <Typography variant="caption" sx={{ color: theme.colors.textSecondary, mb: 1, display: 'block', fontWeight: 500 }}>
                      Applicable STRIDE threats for {DFD_ELEMENT_LABELS[effectiveDfdCategory]}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {STRIDE_APPLICABILITY[effectiveDfdCategory].map(s => (
                        <Tooltip key={s.key} title={s.label} arrow>
                          <Chip
                            label={s.key}
                            size="small"
                            sx={{
                              bgcolor: s.color + '22',
                              color: s.color,
                              border: `1px solid ${s.color}66`,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              height: 22,
                              cursor: 'default',
                              '& .MuiChip-label': { px: 0.75 }
                            }}
                          />
                        </Tooltip>
                      ))}
                    </Box>
                  </Box>
                )}
                
                <TextField
                  size="small"
                  label="DFD Type"
                  value={editedNode.data.dfdType || ''}
                  onChange={(e) => handleChange('data.dfdType', e.target.value)}
                  placeholder={(() => {
                    const suggestions = getSuggestedDFDTypes(node.type, editedNode.data.dfdCategory);
                    return suggestions.length > 0 ? `e.g., ${suggestions.slice(0, 2).join(', ')}` : 'Specify the DFD type';
                  })()}
                  helperText="Optional: Specify what kind of actor, process, or data store this represents"
                  sx={{}}
                />
              </AccordionDetails>
            </Accordion>
          )}

          {/* DFD-specific fields */}
          {isDFDNode && (
            <>
              {node.type === 'dfdActor' && (
                <TextField
                  size="small"
                  label="Actor Type"
                  value={(editedNode.data as DFDActorNodeData).actorType || ''}
                  onChange={(e) => handleChange('data.actorType', e.target.value)}
                  placeholder="e.g., Mobile User, Payment Gateway, Admin Console, IoT Sensor"
                  helperText="Define the type of external entity interacting with the system"
                  className="node-editor-field"
                  sx={{ 
                    '& .MuiInputBase-input': { color: theme.colors.textPrimary },
                    '& .MuiInputLabel-root': { color: theme.colors.textSecondary }
                  }}
                />
              )}

              {node.type === 'dfdProcess' && (
                <TextField
                  size="small"
                  label="Process Type"
                  value={(editedNode.data as DFDProcessNodeData).processType || ''}
                  onChange={(e) => handleChange('data.processType', e.target.value)}
                  placeholder="e.g., Auth Service, Order Processing, Data Validator, API Handler"
                  helperText="Describe what kind of processing this component performs"
                  className="node-editor-field"
                  sx={{ 
                    '& .MuiInputBase-input': { color: theme.colors.textPrimary },
                    '& .MuiInputLabel-root': { color: theme.colors.textSecondary }
                  }}
                />
              )}

              {node.type === 'dfdDataStore' && (
                <TextField
                  size="small"
                  label="Storage Type"
                  value={(editedNode.data as DFDDataStoreNodeData).storeType || ''}
                  onChange={(e) => handleChange('data.storeType', e.target.value)}
                  placeholder="e.g., User Database, Session Cache, Log Files, Config Store"
                  helperText="Specify the type of data storage this represents"
                  className="node-editor-field"
                  sx={{ 
                    '& .MuiInputBase-input': { color: theme.colors.textPrimary },
                    '& .MuiInputLabel-root': { color: theme.colors.textSecondary }
                  }}
                />
              )}

              {node.type === 'dfdTrustBoundary' && (
                <TextField
                  size="small"
                  label="Boundary Type"
                  value={(editedNode.data as DFDTrustBoundaryNodeData).boundaryType || ''}
                  onChange={(e) => handleChange('data.boundaryType', e.target.value)}
                  placeholder="e.g., Internet Boundary, Corporate Network, DMZ Perimeter, Container Boundary"
                  helperText="Describe the trust boundary this represents"
                  className="node-editor-field"
                  sx={{ 
                    '& .MuiInputBase-input': { color: theme.colors.textPrimary },
                    '& .MuiInputLabel-root': { color: theme.colors.textSecondary }
                  }}
                />
              )}
            </>
          )}
          
          {renderZoneOptions()}

          {!isZoneNode && !!currentZoneValue && onOpenAssessmentForZone && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Tooltip title="Open the assessment workspace scoped to this security zone." arrow>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => onOpenAssessmentForZone(currentZoneValue)}
                >
                  Open Zone Assessment
                </Button>
              </Tooltip>
              <Tooltip title="Open the Risk Management Plan tab for this zone-scoped assessment." arrow>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => onOpenAssessmentForZone(currentZoneValue, { openRiskPlan: true })}
                >
                  Open Zone SRMP
                </Button>
              </Tooltip>
            </Box>
          )}


          <FormControl size="small" fullWidth>
            <InputLabel>
              Data Classification
            </InputLabel>
            <Select
              value={editedNode.data.dataClassification || ''}
              onChange={(e) => handleChange('data.dataClassification', e.target.value)}
              label="Data Classification"
              onOpen={() => setDropdownOpen(true)}
              onClose={() => setDropdownOpen(false)}
              MenuProps={{
                disablePortal: !isFloating, // Use portal in floating mode
                PaperProps: {
                  sx: {
                    maxHeight: 300,
                    zIndex: isFloating ? 1301 : 9999
                  }
                },
                anchorOrigin: {
                  vertical: 'bottom',
                  horizontal: 'left',
                },
                transformOrigin: {
                  vertical: 'top',
                  horizontal: 'left',
                },
              }}
              sx={{}}
            >
              {dataClassifications.map(({ value, description }) => (
                <MenuItem key={value} value={value} sx={{ whiteSpace: 'normal', py: 1 }}>
                  <Box sx={{ width: '100%' }}>
                    <Typography sx={{ fontWeight: 500 }}>{value}</Typography>
                    <Typography 
                      variant="caption" 
                      color="textSecondary"
                      sx={{ 
                        display: 'block',
                        whiteSpace: 'normal',
                        wordWrap: 'break-word',
                        lineHeight: 1.3,
                        mt: 0.5
                      }}
                    >
                      {description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="Protocols"
            value={editedNode.data.protocols?.join(', ') || ''}
            onChange={(e) => handleChange('data.protocols', e.target.value.split(',').map(p => p.trim()))}
            placeholder="e.g., HTTPS, SSH, TCP/443"
            sx={{}}
          />

          {/* Only show these fields for non-zone nodes */}
          {!isZoneNode && (
            <>
              <TextField
                size="small"
                label="Vendor"
                value={(editedNode.data as SecurityNodeData).vendor || ''}
                onChange={(e) => handleChange('data.vendor', e.target.value)} 
                placeholder="e.g., Cisco, Microsoft, Palo Alto"
                sx={{}}
              />
              <TextField
                size="small"
                label="Product"
                value={(editedNode.data as SecurityNodeData).product || ''}
                onChange={(e) => handleChange('data.product', e.target.value)} 
                placeholder="e.g., ASA, Windows Server, NGFW"
                sx={{}}
              />
              <TextField
                size="small"
                label="Version"
                value={(editedNode.data as SecurityNodeData).version || ''}
                onChange={(e) => handleChange('data.version', e.target.value)} 
                placeholder="e.g., 2.1.0, v3.5"
                sx={{}}
              />
              <TextField
                size="small"
                label="Technology"
                value={(editedNode.data as SecurityNodeData).technology || ''}
                onChange={(e) => handleChange('data.technology', e.target.value)} 
                placeholder="e.g., Java, .NET, Python, Docker"
                sx={{}}
              />
              <TextField
                size="small"
                label="Patch Level"
                value={(editedNode.data as SecurityNodeData).patchLevel || ''}
                onChange={(e) => handleChange('data.patchLevel', e.target.value)}
                placeholder="e.g., 2023.1, SP2"
                sx={{}}
              />
              <TextField
                size="small"
                label="Components"
                value={(editedNode.data as SecurityNodeData).components?.map(c => `${c.name}:${c.version}`).join(', ') || ''}
                onChange={(e) => {
                  const components = e.target.value.split(',').map(comp => {
                    const [name, version] = comp.trim().split(':');
                    return { name: name?.trim() || '', version: version?.trim() || '' };
                  }).filter(c => c.name); // Only keep components with names
                  handleChange('data.components', components);
                }}
                placeholder="e.g., Apache:2.4.41, OpenSSL:1.1.1"
                sx={{}}
              />
            </>
          )}

          <TextField
            size="small"
            label="Security Controls"
            value={editedNode.data.securityControls?.join(', ') || ''}
            onChange={(e) => handleChange('data.securityControls', e.target.value.split(',').map(c => c.trim()))}
            placeholder="e.g., WAF, IPS, Access Control"
            sx={{}}
          />
          
              <TextField
                size="small"
                label="Description"
                multiline
                rows={3}
                value={editedNode.data.description || ''}
                onChange={(e) => handleChange('data.description', e.target.value)}
                placeholder="Describe the purpose, criticality, and any special security requirements"
                sx={{}}
              />

              {/* Handle Remapping Section - Only show in fixed edge mode */}
              {settings.edgeMode === 'fixed' && connectedEdges.length > 0 && onEdgesUpdate && (
                <Box className="edge-remap-section">
                  <Typography variant="subtitle2" sx={{ mb: 1, color: theme.colors.textSecondary }}>
                    Connected Edges - Remap Handles
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {connectedEdges.map((edge) => {
                  const isSource = edge.source === node.id;
                  const otherNode = allNodes.find(n => n.id === (isSource ? edge.target : edge.source));
                  const currentHandle = isSource ? edge.sourceHandle : edge.targetHandle;
                  
                  return (
                    <Box key={edge.id} className="edge-remap-item">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip 
                          label={isSource ? 'Outgoing' : 'Incoming'} 
                          size="small" 
                          color={isSource ? 'primary' : 'secondary'}
                          sx={{ fontSize: '0.75rem' }}
                        />
                        <Typography variant="caption" sx={{ flex: 1 }}>
                          {edge.data?.label || 'Unnamed Connection'}
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: theme.colors.textSecondary }}>
                        {isSource ? 'To: ' : 'From: '}{otherNode?.data?.label || 'Unknown Node'}
                      </Typography>
                      {currentHandle && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                          <Typography variant="caption" sx={{ color: theme.colors.primary, fontWeight: 'medium' }}>
                            Currently connected to:
                          </Typography>
                          <Chip 
                            label={currentHandle.toUpperCase()} 
                            size="small" 
                            sx={{ 
                              height: 20,
                              fontSize: '0.7rem',
                              bgcolor: theme.colors.primaryLight,
                              color: theme.colors.primary,
                              fontWeight: 'bold'
                            }}
                          />
                        </Box>
                      )}
                      <FormControl size="small" fullWidth sx={{ mt: 0.5 }}>
                        <InputLabel sx={{ fontSize: '0.875rem' }}>Handle Position</InputLabel>
                        <Select
                          value={currentHandle || ''}
                          onChange={(e) => {
                            const newHandle = e.target.value;
                            const updatedEdge = {
                              ...edge,
                              [isSource ? 'sourceHandle' : 'targetHandle']: newHandle
                            };
                            // Update this specific edge
                            const updatedEdges = edges.map(e => 
                              e.id === edge.id ? updatedEdge : e
                            );
                            onEdgesUpdate(updatedEdges);
                          }}
                          label="Handle Position"
                          onOpen={() => setDropdownOpen(true)}
                          onClose={() => setDropdownOpen(false)}
                          MenuProps={{
                            disablePortal: !isFloating, // Use portal in floating mode
                            PaperProps: {
                              sx: {
                                maxHeight: 200,
                                zIndex: isFloating ? 1301 : 9999,
                                minWidth: '180px',
                                bgcolor: theme.colors.surface,
                                border: `1px solid ${theme.colors.border}`,
                                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                              }
                            },
                            anchorOrigin: {
                              vertical: 'bottom',
                              horizontal: 'left',
                            },
                            transformOrigin: {
                              vertical: 'top',
                              horizontal: 'left',
                            },
                          }}
                          sx={{ fontSize: '0.875rem' }}
                        >
                          <MenuItem value="top" sx={{ whiteSpace: 'normal' }}>Top</MenuItem>
                          <MenuItem value="right" sx={{ whiteSpace: 'normal' }}>Right</MenuItem>
                          <MenuItem value="bottom" sx={{ whiteSpace: 'normal' }}>Bottom</MenuItem>
                          <MenuItem value="left" sx={{ whiteSpace: 'normal' }}>Left</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  );
                    })}
                  </Box>
                </Box>
              )}
            </>
          )}
        </Box>
      );
    } else if (activeTab === 1) {
      // Rule Based Threats Tab
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
              borderRadius: 1,
              backgroundColor: theme.colors.surfaceHover,
              border: `1px solid ${theme.colors.border}`
            }}
          >
            {NodeIcon && (
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  backgroundColor: theme.colors.surface,
                  border: `1px solid ${theme.colors.border}`
                }}
              >
                {React.createElement(NodeIcon, { sx: { fontSize: 20, color: theme.colors.primary } })}
              </Box>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle2" sx={{ color: theme.colors.textPrimary }}>
                {editedNode.data?.label || editedNode.id}
              </Typography>
              <Typography variant="caption" sx={{ color: theme.colors.textSecondary }}>
                {editedNode.data?.indexCode || editedNode.id}
              </Typography>
            </Box>
          </Box>
          {!isZoneNode && effectiveDfdCategory && applicableStrideCategories.length > 0 && (
            <Box sx={{ p: 1.5, borderRadius: 1, border: `1px solid ${theme.colors.border}`, backgroundColor: theme.colors.surfaceHover }}>
              <Typography variant="caption" sx={{ color: theme.colors.textSecondary, mb: 1, display: 'block', fontWeight: 500 }}>
                STRIDE threats applicable to this {DFD_ELEMENT_LABELS[effectiveDfdCategory] ?? effectiveDfdCategory}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {applicableStrideCategories.map(s => (
                  <Tooltip key={s.key} title={s.label} arrow>
                    <Chip
                      label={s.key}
                      size="small"
                      sx={{
                        bgcolor: s.color + '22',
                        color: s.color,
                        border: `1px solid ${s.color}66`,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        height: 22,
                        cursor: 'default',
                        '& .MuiChip-label': { px: 0.75 }
                      }}
                    />
                  </Tooltip>
                ))}
              </Box>
            </Box>
          )}
          {hasRuleBasedFindings ? (
            ruleBasedFindings.map(({ finding, sourceEdge }) => {
              const resolvedStride = resolveFindingStride(finding);
              const justCreated = createdFromFindingIds.includes(finding.id);
              const edgeLabel = sourceEdge
                ? (sourceEdge.data?.label || null)
                : null;
              const edgeSourceNode = sourceEdge
                ? allNodes.find(n => n.id === sourceEdge.source)
                : null;
              const edgeTargetNode = sourceEdge
                ? allNodes.find(n => n.id === sourceEdge.target)
                : null;
              return (
                <Box
                  key={finding.id}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.75,
                    p: 1.5,
                    borderRadius: 1,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.surface
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <WarningIcon sx={{ color: theme.colors.warning, fontSize: 18 }} />
                    <Typography variant="subtitle2" sx={{ color: theme.colors.textPrimary, flex: 1, minWidth: 0 }}>
                      {finding.title}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    <Chip size="small" label={finding.category.toUpperCase()} sx={{ fontSize: '0.7rem', height: 20 }} />
                    <Chip size="small" variant="outlined" label={finding.ruleId} sx={{ fontSize: '0.7rem', height: 20, fontFamily: 'monospace' }} />
                    {resolvedStride.map(cat => (
                      <Tooltip key={cat} title={cat} arrow>
                        <Chip
                          size="small"
                          label={STRIDE_SHORT[cat]}
                          sx={{
                            bgcolor: STRIDE_COLORS[cat] + '22',
                            color: STRIDE_COLORS[cat],
                            border: `1px solid ${STRIDE_COLORS[cat]}66`,
                            fontSize: '0.7rem', fontWeight: 700, height: 20,
                            '& .MuiChip-label': { px: 0.75 }
                          }}
                        />
                      </Tooltip>
                    ))}
                  </Box>
                  {sourceEdge && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                      <Typography variant="caption" sx={{ color: theme.colors.textSecondary, fontWeight: 500 }}>
                        Connection:
                      </Typography>
                      <Tooltip
                        title={`Edge ID: ${sourceEdge.id}`}
                        arrow
                      >
                        <Chip
                          size="small"
                          variant="outlined"
                          label={
                            edgeLabel
                              ? edgeLabel
                              : edgeSourceNode && edgeTargetNode
                                ? `${edgeSourceNode.data?.label || edgeSourceNode.id} → ${edgeTargetNode.data?.label || edgeTargetNode.id}`
                                : sourceEdge.id
                          }
                          sx={{ fontSize: '0.68rem', height: 18, fontFamily: 'monospace', cursor: 'default' }}
                        />
                      </Tooltip>
                    </Box>
                  )}
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                    {finding.description}
                  </Typography>
                  {finding.recommendations.length > 0 && (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-line', color: theme.colors.textSecondary }}>
                      {finding.recommendations.map((rec, idx) => `${idx + 1}. ${rec}`).join('\n')}
                    </Typography>
                  )}
                  {onCreateAttackPath && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                      <Tooltip
                        title={justCreated
                          ? 'Attack path created — open the Attack Paths panel to edit it'
                          : resolvedStride.length > 0
                            ? `Create attack path (${resolvedStride[0]})`
                            : 'Create attack path'}
                        arrow
                      >
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={justCreated ? undefined : <AddIcon sx={{ fontSize: 14 }} />}
                            onClick={() => handleCreateAttackPath(finding)}
                            disabled={justCreated}
                            sx={{
                              fontSize: '0.7rem',
                              py: 0.25,
                              px: 1,
                              minHeight: 0,
                              height: 24,
                              borderColor: justCreated ? 'success.main' : theme.colors.border,
                              color: justCreated ? 'success.main' : theme.colors.textSecondary,
                              '&:hover': {
                                borderColor: resolvedStride.length > 0 ? STRIDE_COLORS[resolvedStride[0]] : theme.colors.primary,
                                color: resolvedStride.length > 0 ? STRIDE_COLORS[resolvedStride[0]] : theme.colors.primary,
                              }
                            }}
                          >
                            {justCreated ? '✓ Path Created' : 'Create Attack Path'}
                          </Button>
                        </span>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
              );
            })
          ) : (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 200,
              bgcolor: theme.colors.background,
              borderRadius: 1,
              border: `1px dashed ${theme.colors.border}`
            }}>
              <WarningIcon sx={{ fontSize: 48, color: theme.colors.textSecondary, mb: 2 }} />
              <Typography variant="h6" sx={{ color: theme.colors.textSecondary, mb: 1 }}>
                No Security Findings
              </Typography>
              <Typography variant="body2" sx={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
                No rule-based findings apply to this component or its connected edges.
              </Typography>
            </Box>
          )}
        </Box>
      );
    } else if (activeTab === 2) {
      // Identified Threats Tab
      const analyzeDisabled = isAnalyzing || !onAnalyzeNode;
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {editedNode.data.additionalContext ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarningIcon sx={{ color: theme.colors.warning }} />
                  <Typography variant="subtitle2" sx={{ color: theme.colors.textPrimary }}>
                    Auto-Generated Threat Analysis
                  </Typography>
                  {((editedNode.data as SecurityNodeData).securityContext?.threats?.length ?? 0) > 0 && (
                    <Chip 
                      label={`${(editedNode.data as SecurityNodeData).securityContext?.threats?.length ?? 0} threats`}
                      size="small"
                      sx={{ 
                        bgcolor: theme.colors.info,
                        color: 'white',
                        fontSize: '0.7rem'
                      }}
                    />
                  )}
                </Box>
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Tooltip title="Re-analyze this node">
                    <IconButton 
                      size="small" 
                      onClick={handleAnalyzeNode}
                      disabled={analyzeDisabled}
                      sx={{ 
                        color: theme.colors.primary,
                        '&:hover': { bgcolor: theme.colors.surfaceHover }
                      }}
                    >
                      {isAnalyzing ? (
                        <CircularProgress size={16} />
                      ) : (
                        <RefreshIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title="Clear threat analysis">
                    <IconButton 
                      size="small" 
                      onClick={handleClearThreats}
                      sx={{ 
                        color: theme.colors.error,
                        '&:hover': { bgcolor: theme.colors.surfaceHover }
                      }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              
              <Box
                sx={{
                  width: '100%',
                  backgroundColor: theme.colors.surfaceHover,
                  color: theme.colors.textSecondary,
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  padding: '12px',
                  borderRadius: '4px',
                  border: `1px solid ${theme.colors.border}`,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word'
                }}
              >
                {editedNode.data.additionalContext}
              </Box>
              
              <Typography variant="caption" sx={{ color: theme.colors.textSecondary, fontStyle: 'italic' }}>
                This detailed threat analysis is automatically generated during threat analysis and cannot be edited manually.
              </Typography>
            </>
          ) : (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 200,
              bgcolor: theme.colors.background,
              borderRadius: 1,
              border: `1px dashed ${theme.colors.border}`
            }}>
              <WarningIcon sx={{ fontSize: 48, color: theme.colors.textSecondary, mb: 2 }} />
              <Typography variant="h6" sx={{ color: theme.colors.textSecondary, mb: 1 }}>
                No Threats Identified
              </Typography>
              <Typography variant="body2" sx={{ color: theme.colors.textSecondary, textAlign: 'center', mb: 2 }}>
                Run threat analysis to identify potential security threats for this component.
              </Typography>
              
              {onAnalyzeNode && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}>
                  <Button
                    variant="contained"
                    startIcon={isAnalyzing ? <CircularProgress size={16} /> : <AnalysisIcon />}
                    onClick={handleAnalyzeNode}
                    disabled={analyzeDisabled}
                    sx={{
                      bgcolor: theme.colors.primary,
                      color: 'white',
                      textTransform: 'none',
                      '&:hover': {
                        bgcolor: theme.colors.primaryLight
                      },
                      '&:disabled': {
                        bgcolor: theme.colors.surfaceHover,
                        color: theme.colors.textSecondary
                      }
                    }}
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Analyze This Node'}
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Box>
      );
    }
    return null;
  };

  // If floating mode, render without Dialog wrapper
  if (isFloating) {
    return (
      <Box className={`node-editor-floating ${dropdownOpen ? 'dropdown-open' : ''}`}>
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
          <Tab 
            label="Security Findings"
            sx={{
              opacity: hasRuleBasedFindings ? 1 : 0.7
            }}
          />
          <Tab 
            label="Identified Threats (AI)" 
            sx={{
              opacity: editedNode.data.additionalContext ? 1 : 0.7
            }}
          />
        </Tabs>
        
        <Box className="node-editor-floating-actions">
          {onCenterOnNode && (
            <Button 
              onClick={onCenterOnNode}
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
              Center on Node
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
            onClick={handleUpdateClick}
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
        
        <Box className="node-editor-floating-content">
          {renderTabContent()}
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
            Edit {node.type}
          </Typography>
          <IconButton
            onClick={onClose}
            size="small"
            aria-label="Close Node Editor"
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
        <Tab 
          label="Rule Based Threats" 
          sx={{
            opacity: hasRuleBasedFindings ? 1 : 0.7
          }}
        />
        <Tab 
          label="Identified Threats (AI)" 
          sx={{
            opacity: editedNode.data.additionalContext ? 1 : 0.7
          }}
        />
      </Tabs>
  
      <DialogActions
        className="node-editor-actions"
        sx={{
          justifyContent: 'center',
          p: isCompactViewport ? 1.5 : 2,
          borderBottom: `1px solid ${theme.colors.border}`,
          flexWrap: 'wrap',
          gap: 1
        }}
      >
        {onCenterOnNode && (
          <Button 
            onClick={onCenterOnNode}
            variant="outlined"
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
            Center on Node
          </Button>
        )}
        <Button 
          onClick={onClose}
          variant="outlined"
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
          onClick={handleUpdateClick}
          variant="contained"
          color="primary"
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
      </DialogActions>
  
      <DialogContent 
        className="node-editor-content"
        sx={{
          overflow: 'auto !important',
          flex: 1,
          minHeight: 0, // Prevents flex item from overflowing
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
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            }
          }
        }}
      >
        {renderTabContent()}
      </DialogContent>
    </StyledDialog>
  );
}

// Custom comparison function for React.memo
// Only re-render if node data or id changes, or if dialog visibility changes
const areEqual = (prevProps: NodeEditorProps, nextProps: NodeEditorProps) => {
  return (
    prevProps.node.id === nextProps.node.id &&
    JSON.stringify(prevProps.node.data) === JSON.stringify(nextProps.node.data) &&
    prevProps.node.type === nextProps.node.type &&
    prevProps.isAnalysisPanelOpen === nextProps.isAnalysisPanelOpen &&
    prevProps.isCompactViewport === nextProps.isCompactViewport &&
    prevProps.leftPanelWidth === nextProps.leftPanelWidth &&
    // Check if edges related to this node have changed
    JSON.stringify(prevProps.edges?.filter(e => e.source === prevProps.node.id || e.target === prevProps.node.id)) ===
    JSON.stringify(nextProps.edges?.filter(e => e.source === nextProps.node.id || e.target === nextProps.node.id))
  );
};

export default React.memo(NodeEditor, areEqual);  
