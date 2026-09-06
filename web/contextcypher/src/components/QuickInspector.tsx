import React, { useState, useEffect, useRef } from 'react';
import {
  Paper,
  Typography,
  Box,
  Button,
  Chip,
  Divider,
  Fade,
  Drawer,
  useTheme,
  styled,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Lock as LockIcon,
  Warning as WarningIcon,
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import { SecurityNode, SecurityEdge, SecurityEdgeData, SecurityNodeData, SecurityZoneNodeData, isSecurityZoneNode } from '../types/SecurityTypes';
import { getNodeIcon } from '../utils/iconUtils';
import { generateEdgeCode } from '../utils/edgeIndexing';
import { useManualAnalysis } from '../contexts/ManualAnalysisContext';
import useViewportLayout from '../hooks/useViewportLayout';

interface QuickInspectorProps {
  item: SecurityNode | SecurityEdge | null;
  position: { x: number; y: number };
  onClose: () => void;
  onOpenFullEditor?: () => void;
  onOpenManualFindings?: (item: SecurityNode | SecurityEdge | null) => void;
  visible: boolean;
  onInspectorMouseEnter?: () => void;
  onInspectorMouseLeave?: () => void;
  allNodes?: SecurityNode[];
}

const InspectorContainer = styled(Paper)(({ theme }) => ({
  position: 'absolute',
  backgroundColor: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: '8px',
  padding: '12px',
  width: '420px',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
  zIndex: 2000,
  pointerEvents: 'auto',
  transition: 'opacity 0.2s ease',
  userSelect: 'none',
  display: 'flex',
  flexDirection: 'column',
}));

const InspectorHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '8px',
  gap: '8px'
}));

const PropertyRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '4px 0',
  fontSize: '0.875rem',
  '& .property-label': {
    color: theme.colors.textSecondary,
    fontWeight: 500,
    minWidth: '100px'
  },
  '& .property-value': {
    color: theme.colors.textPrimary,
    textAlign: 'right',
    flex: 1,
    marginLeft: '8px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  }
}));

const ContentBox = styled(Box)({
  flex: 1,
  overflowY: 'auto',
  maxHeight: '70vh',
  paddingRight: '8px',
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '3px',
  },
});

const QuickInspector: React.FC<QuickInspectorProps> = ({
  item,
  position,
  onClose,
  onOpenFullEditor,
  onOpenManualFindings,
  visible,
  onInspectorMouseEnter,
  onInspectorMouseLeave,
  allNodes = []
}) => {
  const theme = useTheme();
  const { viewportTier } = useViewportLayout();
  const isPhoneViewport = viewportTier === 'xs' || viewportTier === 'sm';
  const isTabletViewport = viewportTier === 'md';
  const isBottomSheetViewport = isPhoneViewport || isTabletViewport;
  const {
    getFindingsForNode,
    getFindingsForEdge,
    getFindingsForZone
  } = useManualAnalysis();
  const containerRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  
  // Force re-render when item changes
  useEffect(() => {
    if (item) {
      // Force re-render when data changes by updating state
      setAdjustedPosition(prev => ({ ...prev }));
    }
  }, [item]);

  // Adjust position to keep inspector within viewport and offset to the right
  useEffect(() => {
    if (!containerRef.current || !visible) return;
    if (isBottomSheetViewport) return;

    const rect = containerRef.current.getBoundingClientRect();
    const padding = 20;
    const rightOffset = 100; // Offset to avoid control points
    let newX = position.x + rightOffset;
    let newY = position.y;

    // Adjust horizontal position if it goes off screen
    if (newX + rect.width + padding > window.innerWidth) {
      // If offsetting right would go off screen, try left side instead
      newX = position.x - rect.width - padding;
    }

    // Adjust vertical position
    if (position.y + rect.height + padding > window.innerHeight) {
      newY = window.innerHeight - rect.height - padding;
    }

    setAdjustedPosition({ x: newX, y: newY });
  }, [isBottomSheetViewport, position, visible]);

  if (!item || !visible) return null;

  const isEdge = 'source' in item && 'target' in item;
  const isNode = !isEdge && 'data' in item && 'type' in item;
  const isZone = isNode && isSecurityZoneNode(item as SecurityNode);
  const manualFindings = (() => {
    if (!item) return [];
    if (isEdge) return getFindingsForEdge(item.id);
    if (isZone) return getFindingsForZone(item.id);
    if (isNode) return getFindingsForNode(item.id);
    return [];
  })();

  // Get icon for nodes
  const nodeIcon = isNode && !isZone ? getNodeIcon((item as SecurityNode).type) : null;

  // Render node content
  const renderNodeContent = (node: SecurityNode) => {
    const data = node.data;
    const isZoneNode = isSecurityZoneNode(node);
    const hasThreats = !isZoneNode && 'securityContext' in data && data.securityContext && typeof data.securityContext === 'object' && 'threats' in data.securityContext && Array.isArray(data.securityContext.threats) && data.securityContext.threats.length > 0;

    const nodeIndexCode = (node.data as any)?.indexCode || node.id;

    return (
      <>
        <PropertyRow>
          <span className="property-label">Type:</span>
          <span className="property-value">{node.type}</span>
        </PropertyRow>
        
        <PropertyRow>
          <span className="property-label">ID:</span>
          <span className="property-value" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
            {nodeIndexCode}
          </span>
        </PropertyRow>
        
        {!isZone && (
          <>
            <PropertyRow>
              <span className="property-label">Zone:</span>
              <Chip 
                label={'zone' in data ? (String((data as any).zone) || 'Not set') : 'Not set'} 
                size="small" 
                sx={{ 
                  height: '20px',
                  fontSize: '0.75rem',
                  backgroundColor: theme.colors.primaryLight,
                  color: theme.colors.primary
                }}
              />
            </PropertyRow>
            
            {/* Security level removed - no longer part of the data model */}
            
            <PropertyRow>
              <span className="property-label">Classification:</span>
              <span className="property-value">{'dataClassification' in data ? data.dataClassification || 'Not set' : 'Not set'}</span>
            </PropertyRow>
          </>
        )}
        
        {isZone && 'zoneType' in data && (
          <PropertyRow>
            <span className="property-label">Zone Type:</span>
            <span className="property-value">{String(data.zoneType)}</span>
          </PropertyRow>
        )}
        
        {'vendor' in data && data.vendor && (
          <PropertyRow>
            <span className="property-label">Vendor:</span>
            <span className="property-value">{String(data.vendor)}</span>
          </PropertyRow>
        )}
        
        {'product' in data && data.product && (
          <PropertyRow>
            <span className="property-label">Product:</span>
            <span className="property-value">{String(data.product)}</span>
          </PropertyRow>
        )}
        
        {'version' in data && data.version && (
          <PropertyRow>
            <span className="property-label">Version:</span>
            <span className="property-value">{data.version}</span>
          </PropertyRow>
        )}
        
        {'technology' in data && data.technology && (
          <PropertyRow>
            <span className="property-label">Technology:</span>
            <span className="property-value">{data.technology}</span>
          </PropertyRow>
        )}
        
        {'patchLevel' in data && data.patchLevel && (
          <PropertyRow>
            <span className="property-label">Patch Level:</span>
            <span className="property-value">{data.patchLevel}</span>
          </PropertyRow>
        )}
        
        {'protocols' in data && data.protocols && data.protocols.length > 0 && (
          <PropertyRow>
            <span className="property-label">Protocols:</span>
            <span className="property-value">{data.protocols.join(', ')}</span>
          </PropertyRow>
        )}
        
        {'securityControls' in data && data.securityControls && data.securityControls.length > 0 && (
          <PropertyRow>
            <span className="property-label">Security Controls:</span>
            <span className="property-value">{data.securityControls.join(', ')}</span>
          </PropertyRow>
        )}
        
        {'components' in data && data.components && Array.isArray(data.components) && data.components.length > 0 && (
          <PropertyRow>
            <span className="property-label">Components:</span>
            <span className="property-value">
              {(data.components as any[]).map((c: any) => `${c.name}:${c.version}`).join(', ')}
            </span>
          </PropertyRow>
        )}
        
        {'metadata' in data && data.metadata && Object.keys(data.metadata).length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" sx={{ color: theme.colors.textSecondary, fontWeight: 600 }}>
              Metadata:
            </Typography>
            {data.metadata && typeof data.metadata === 'object' && Object.entries(data.metadata).map(([key, value]) => (
              <PropertyRow key={key}>
                <span className="property-label">{key}:</span>
                <span className="property-value">{String(value)}</span>
              </PropertyRow>
            ))}
          </>
        )}
        
        {hasThreats && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <WarningIcon sx={{ color: theme.colors.warning, fontSize: '1rem' }} />
              <Typography variant="caption" sx={{ color: theme.colors.warning }}>
                {!isZoneNode && 'securityContext' in data && data.securityContext && typeof data.securityContext === 'object' && 'threats' in data.securityContext && Array.isArray(data.securityContext.threats) ? data.securityContext.threats.length : 0} threats identified
              </Typography>
            </Box>
          </>
        )}
        
        {'description' in data && data.description && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" sx={{ color: theme.colors.textSecondary }}>
              {data.description}
            </Typography>
          </>
        )}
      </>
    );
  };

  // Render edge content
  const renderEdgeContent = (edge: SecurityEdge) => {
    const data = edge.data as SecurityEdgeData || {};
    const hasThreats = 'securityContext' in data && data.securityContext && typeof data.securityContext === 'object' && 'threats' in data.securityContext && Array.isArray(data.securityContext.threats) && data.securityContext.threats.length > 0;
    
    const edgeIndexCode = (edge.data as any)?.indexCode || (allNodes.length > 0 ? generateEdgeCode(edge, allNodes) : edge.id);
    
    return (
      <>
        <PropertyRow>
          <span className="property-label">ID:</span>
          <span className="property-value" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
            {edgeIndexCode}
          </span>
        </PropertyRow>
        
        <PropertyRow>
          <span className="property-label">Source:</span>
          <span className="property-value">{edge.source}</span>
        </PropertyRow>
        
        <PropertyRow>
          <span className="property-label">Target:</span>
          <span className="property-value">{edge.target}</span>
        </PropertyRow>
        
        {edge.sourceHandle && (
          <PropertyRow>
            <span className="property-label">Source Handle:</span>
            <span className="property-value">{edge.sourceHandle}</span>
          </PropertyRow>
        )}
        
        {edge.targetHandle && (
          <PropertyRow>
            <span className="property-label">Target Handle:</span>
            <span className="property-value">{edge.targetHandle}</span>
          </PropertyRow>
        )}

        {/* Edge Label */}
        {'label' in data && (
          <PropertyRow>
            <span className="property-label">Label:</span>
            <span className="property-value">{data.label || 'Not set'}</span>
          </PropertyRow>
        )}
 
        <PropertyRow>
          <span className="property-label">Zone:</span>
          <span className="property-value">{'zone' in data ? data.zone || 'Not set' : 'Not set'}</span>
        </PropertyRow>
        
        <PropertyRow>
          <span className="property-label">Protocol:</span>
          <span className="property-value">{'protocol' in data ? data.protocol || 'Not set' : 'Not set'}</span>
        </PropertyRow>
        
        <PropertyRow>
          <span className="property-label">Encryption:</span>
          <span className="property-value">{'encryption' in data ? data.encryption || 'Not set' : 'Not set'}</span>
        </PropertyRow>
        
        {/* Security level removed - no longer part of the data model */}
        
        <PropertyRow>
          <span className="property-label">Classification:</span>
          <span className="property-value">{'dataClassification' in data ? data.dataClassification || 'Public' : 'Public'}</span>
        </PropertyRow>
        
        <PropertyRow>
          <span className="property-label">Port Range:</span>
          <span className="property-value">{'portRange' in data ? data.portRange || 'Not specified' : 'Not specified'}</span>
        </PropertyRow>
        
        <PropertyRow>
          <span className="property-label">Bandwidth:</span>
          <span className="property-value">{'bandwidth' in data ? data.bandwidth || 'Not specified' : 'Not specified'}</span>
        </PropertyRow>
        
        <PropertyRow>
          <span className="property-label">Latency:</span>
          <span className="property-value">{'latency' in data ? data.latency || 'Not specified' : 'Not specified'}</span>
        </PropertyRow>
        
        <PropertyRow>
          <span className="property-label">Redundancy:</span>
          <span className="property-value">{'redundancy' in data && data.redundancy !== undefined ? (data.redundancy ? 'Yes' : 'No') : 'Not specified'}</span>
        </PropertyRow>
        
        <PropertyRow>
          <span className="property-label">Security Controls:</span>
          <span className="property-value">
            {'securityControls' in data && data.securityControls && Array.isArray(data.securityControls) && data.securityControls.length > 0 
              ? data.securityControls.join(', ') 
              : 'None specified'}
          </span>
        </PropertyRow>
        
        {/* Show any additional fields that might exist in data, similar to nodes */}
        {Object.entries(data).map(([key, value]) => {
          const displayedFields = [
            'label', 'zone', 'protocol', 'encryption', 
            'dataClassification', 'portRange', 'bandwidth', 'latency', 
            'redundancy', 'securityControls', 'description', 'additionalContext', 
            'securityContext', 'metadata'
          ];
          if (displayedFields.includes(key) || !value) {
            return null;
          }
          
          return (
            <PropertyRow key={key}>
              <span className="property-label">{key}:</span>
              <span className="property-value">
                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
              </span>
            </PropertyRow>
          );
        })}
        
        {'metadata' in data && data.metadata && Object.keys(data.metadata).length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" sx={{ color: theme.colors.textSecondary, fontWeight: 600 }}>
              Metadata:
            </Typography>
            {data.metadata && typeof data.metadata === 'object' && Object.entries(data.metadata).map(([key, value]) => (
              <PropertyRow key={key}>
                <span className="property-label">{key}:</span>
                <span className="property-value">{String(value)}</span>
              </PropertyRow>
            ))}
          </>
        )}
        
        {hasThreats && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <WarningIcon sx={{ color: theme.colors.warning, fontSize: '1rem' }} />
              <Typography variant="caption" sx={{ color: theme.colors.warning }}>
                {'securityContext' in data && data.securityContext && typeof data.securityContext === 'object' && 'threats' in data.securityContext && Array.isArray(data.securityContext.threats) ? data.securityContext.threats.length : 0} threats identified
              </Typography>
            </Box>
          </>
        )}
        
        {'description' in data && data.description && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" sx={{ color: theme.colors.textSecondary }}>
              {data.description}
            </Typography>
          </>
        )}
      </>
    );
  };

  const inspectorContent = (
    <>
      <InspectorHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          {isNode && nodeIcon && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {React.cloneElement(nodeIcon, {
                sx: { fontSize: 20, color: theme.colors.primary }
              })}
            </Box>
          )}
          {isEdge && (
            <LockIcon sx={{ fontSize: 20, color: theme.colors.primary }} />
          )}
          <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
            {isNode ? (item as SecurityNode).data.label : (item as SecurityEdge).data?.label || 'Connection'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {onOpenFullEditor && (
            <Tooltip title="Open in editor">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFullEditor();
                }}
                sx={{
                  color: theme.colors.textSecondary,
                  '&:hover': { color: theme.colors.primary }
                }}
              >
                <OpenInNewIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="Close">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              sx={{
                color: theme.colors.textSecondary,
                '&:hover': { color: theme.colors.error }
              }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </InspectorHeader>

      <Divider />

      <ContentBox sx={{ maxHeight: isBottomSheetViewport ? 'none' : '70vh' }}>
        {isNode ? renderNodeContent(item as SecurityNode) : renderEdgeContent(item as SecurityEdge)}
        {manualFindings.length > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <WarningIcon sx={{ fontSize: 18, color: theme.colors.warning }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Rule Based Findings (Non-AI)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {manualFindings.slice(0, 3).map((finding) => (
                <Typography key={finding.id} variant="body2" sx={{ color: theme.colors.textSecondary }}>
                  {finding.title}
                </Typography>
              ))}
            </Box>
            {onOpenManualFindings && (
              <Box sx={{ mt: 1.5 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenManualFindings(item);
                  }}
                >
                  Open Rule Based Findings (Non-AI)
                </Button>
              </Box>
            )}
          </>
        )}
      </ContentBox>
    </>
  );

  if (isBottomSheetViewport) {
    const isFullScreenSheet = viewportTier === 'xs';
    const sheetMaxHeight = viewportTier === 'sm' ? '72dvh' : '78dvh';

    return (
      <Drawer
        anchor="bottom"
        open={visible}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            borderTopLeftRadius: isFullScreenSheet ? 0 : '14px',
            borderTopRightRadius: isFullScreenSheet ? 0 : '14px',
            maxHeight: isFullScreenSheet ? '100dvh' : sheetMaxHeight,
            height: isFullScreenSheet ? '100dvh' : 'auto'
          }
        }}
      >
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{
            backgroundColor: theme.colors.surface,
            borderTop: `1px solid ${theme.colors.border}`,
            color: theme.colors.textPrimary,
            px: viewportTier === 'md' ? 2 : 1.5,
            pb: viewportTier === 'md' ? 2 : 1.5,
            pt: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: isFullScreenSheet ? '100dvh' : 'auto'
          }}
        >
          {inspectorContent}
        </Box>
      </Drawer>
    );
  }

  return (
    <Fade in={visible} timeout={200}>
      <InspectorContainer
        onMouseEnter={onInspectorMouseEnter}
        onMouseLeave={onInspectorMouseLeave}
        ref={containerRef}
        elevation={4}
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {inspectorContent}
      </InspectorContainer>
    </Fade>
  );
};

export default QuickInspector;
