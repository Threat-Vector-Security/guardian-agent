import React, { useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useTheme } from '@mui/material/styles';
import { Cable } from '@mui/icons-material';
import { colors, nodeDefaults, getTheme } from '../../styles/Theme';
import { SecurityNodeData, SecurityNodeType } from '../../types/SecurityTypes';
import { useSettings } from '../../settings/SettingsContext';
import { materialIconMappings } from '../../utils/materialIconMappings';
import { deserializeIcon } from '../../utils/iconSerialization';
import '../../styles/ModernStyles.css';

interface SecurityNodeProps {
  id: string;
  data: SecurityNodeData;
  selected: boolean;
  color: string;
  type: SecurityNodeType;
}

// Memoize style generators outside component
const getNodeStyle = (color: string, selected: boolean, bgColor: string, textColor: string) => ({
  borderColor: selected ? `${color}CC` : color,
  backgroundColor: bgColor,
  color: textColor,
  boxShadow: selected ? `0 0 20px ${color}66` : 'none',
  borderWidth: selected ? '2px' : '1px',
  transition: 'all 0.2s ease'
});

const getHandleStyle = (color: string, selected: boolean) => ({
  background: selected ? `${color}CC` : color,
  border: 'none',
  width: '10px',
  height: '10px',
  borderRadius: '50%',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'auto' as const,
});

// Deep comparison function for data
const arePropsEqual = (prevProps: SecurityNodeProps, nextProps: SecurityNodeProps) => {
  // Fast path: check references first
  if (prevProps === nextProps) return true;
  
  // Check simple props
  if (
    prevProps.id !== nextProps.id ||
    prevProps.selected !== nextProps.selected ||
    prevProps.color !== nextProps.color ||
    prevProps.type !== nextProps.type
  ) {
    return false;
  }
  
  // Check data object (most likely to change)
  const prevData = prevProps.data;
  const nextData = nextProps.data;
  
  if (prevData === nextData) return true;
  
  // Deep comparison of data fields that affect rendering
  return (
    prevData.label === nextData.label &&
    prevData.zone === nextData.zone &&
    prevData.icon === nextData.icon &&
    prevData.customIcon === nextData.customIcon &&
    prevData.ipAddress === nextData.ipAddress &&
    prevData.ports === nextData.ports &&
    prevData.protocol === nextData.protocol &&
    prevData.dataClassification === nextData.dataClassification &&
    prevData.tags === nextData.tags &&
    prevData.additionalContext === nextData.additionalContext
  );
};

export const OptimizedSecurityNode = React.memo(({ 
  id: nodeId, 
  data, 
  selected, 
  color, 
  type 
}: SecurityNodeProps) => {
  const theme = useTheme();
  const { settings } = useSettings();
  const currentTheme = getTheme(settings.theme, settings.customTheme);
  
  // Memoize color calculations
  const { nodeColor, nodeBgColor, zoneColor } = useMemo(() => {
    const nc = settings.themeAwareNodeColors ? currentTheme.colors.primary : color;
    const nbg = settings.themeAwareNodeColors ? currentTheme.colors.surface : currentTheme.colors.nodeBg;
    const zc = data.zone ? colors.zoneColors[data.zone] : nc;
    return { nodeColor: nc, nodeBgColor: nbg, zoneColor: zc };
  }, [settings.themeAwareNodeColors, currentTheme.colors.primary, currentTheme.colors.surface, 
      currentTheme.colors.nodeBg, color, data.zone]);

  // Memoize code generation
  const code = useMemo(() => {
    let nodeIndex = 1;
    const nodeIdMatch = nodeId.match(/\d+$/);
    if (nodeIdMatch) {
      nodeIndex = parseInt(nodeIdMatch[0], 10);
    } else {
      nodeIndex = nodeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 999 + 1;
    }
    const typeCode = type.substring(0,3).toUpperCase();
    const zoneCode = (data.zone || 'none').substring(0,3).toUpperCase();
    return `${typeCode}-${zoneCode}-${String(nodeIndex).padStart(3,'0')}`;
  }, [nodeId, type, data.zone]);

  // Memoize node style
  const nodeStyle = useMemo(() => 
    getNodeStyle(nodeColor, selected, nodeBgColor, currentTheme.colors.textPrimary),
    [nodeColor, selected, nodeBgColor, currentTheme.colors.textPrimary]
  );

  // Memoize handle style
  const handleStyle = useMemo(() => 
    getHandleStyle(zoneColor, selected),
    [zoneColor, selected]
  );

  // Memoize icon component
  const IconComponent = useMemo(() => {
    if (data.customIcon) {
      return deserializeIcon(data.customIcon, type);
    }
    const iconName = data.icon || type;
    const iconConfig = materialIconMappings[iconName] || materialIconMappings.generic;
    return iconConfig.icon;
  }, [data.customIcon, data.icon, type]);

  return (
    <div 
      className={`modern-node ${selected ? 'selected' : ''}`}
      style={{
        ...nodeStyle,
        position: 'relative',
        padding: nodeDefaults.padding
      }}>
      {/* Handles */}
      <Handle 
        type="target" 
        position={Position.Top}
        id="top"
        className="modern-handle"
        style={{...handleStyle, left: '50%', top: -6}}
      />
      <Handle 
        type="source" 
        position={Position.Top}
        id="top"
        className="modern-handle"
        style={{...handleStyle, left: '50%', top: -6}}
      >
        <Cable
          sx={{
            fontSize: '10px',
            color: '#ffffff',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}
        />
      </Handle>
  
      <Handle 
        type="target" 
        position={Position.Right}
        id="right"
        className="modern-handle"
        style={{...handleStyle, top: '50%', right: -6}}
      />
      <Handle 
        type="source" 
        position={Position.Right}
        id="right"
        className="modern-handle"
        style={{...handleStyle, top: '50%', right: -6}}
      >
        <Cable
          sx={{
            fontSize: '10px',
            color: '#ffffff',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}
        />
      </Handle>
  
      <Handle 
        type="target" 
        position={Position.Bottom}
        id="bottom"
        className="modern-handle"
        style={{...handleStyle, left: '50%', bottom: -6}}
      />
      <Handle 
        type="source" 
        position={Position.Bottom}
        id="bottom"
        className="modern-handle"
        style={{...handleStyle, left: '50%', bottom: -6}}
      >
        <Cable
          sx={{
            fontSize: '10px',
            color: '#ffffff',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}
        />
      </Handle>
  
      <Handle 
        type="target" 
        position={Position.Left}
        id="left"
        className="modern-handle"
        style={{...handleStyle, top: '50%', left: -6}}
      />
      <Handle 
        type="source" 
        position={Position.Left}
        id="left"
        className="modern-handle"
        style={{...handleStyle, top: '50%', left: -6}}
      >
        <Cable
          sx={{
            fontSize: '10px',
            color: '#ffffff',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}
        />
      </Handle>
      
      <div className="modern-node-content">
        <div className="modern-node-header" style={{ borderBottomColor: zoneColor }}>
          <span className="modern-node-code" style={{ color: zoneColor }}>{code}</span>
        </div>
        
        <div className="modern-node-body">
          <>
            <div className="modern-node-icon-wrapper">
              {IconComponent && <IconComponent className="modern-node-icon" style={{ color: nodeColor }} />}
            </div>
            <div className="modern-node-label" style={{ marginTop: '4px' }}>
              {data.label || 'Unnamed'}
            </div>
            
            {/* Additional info */}
            {(data.ipAddress || data.ports || data.protocol) && (
              <div className="modern-node-details">
                <>
                  {data.ipAddress && typeof data.ipAddress === 'string' && (
                    <div className="modern-node-detail">{data.ipAddress}</div>
                  )}
                  {data.ports && (
                    <div className="modern-node-detail">Ports: {String(data.ports)}</div>
                  )}
                  {data.protocol && typeof data.protocol === 'string' && (
                    <div className="modern-node-detail">{data.protocol}</div>
                  )}
                </>
              </div>
            )}
            
            {/* Tags */}
            {data.tags && Array.isArray(data.tags) && data.tags.length > 0 && (
              <div className="modern-node-tags">
                {(data.tags as string[]).map((tag, index) => (
                  <span key={index} className="modern-node-tag" style={{ backgroundColor: `${zoneColor}20`, color: zoneColor }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </>
        </div>
      </div>
    </div>
  );
}, arePropsEqual);

OptimizedSecurityNode.displayName = 'OptimizedSecurityNode';