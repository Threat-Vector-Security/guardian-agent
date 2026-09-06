import React from 'react';
import { styled, keyframes } from '@mui/material/styles';
import { Box } from '@mui/material';
import { useSettings } from '../../settings/SettingsContext';

const nodeHover = keyframes`
  0% { 
    transform: scale(1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
  100% { 
    transform: scale(1.05);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3), 0 0 20px rgba(25, 118, 210, 0.4);
  }
`;

const nodeConnect = keyframes`
  0% { 
    box-shadow: 0 0 0 0 rgba(25, 118, 210, 0.7);
  }
  70% { 
    box-shadow: 0 0 0 10px rgba(25, 118, 210, 0);
  }
  100% { 
    box-shadow: 0 0 0 0 rgba(25, 118, 210, 0);
  }
`;

/* Removed to prevent selection flashing
const nodeSelect = keyframes`
  0%, 100% { 
    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.5);
  }
  50% { 
    box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.8);
  }
`; */

const threatGlow = keyframes`
  0%, 100% { 
    box-shadow: 0 0 10px rgba(244, 67, 54, 0.3);
    border-color: rgba(244, 67, 54, 0.5);
  }
  50% { 
    box-shadow: 0 0 20px rgba(244, 67, 54, 0.6);
    border-color: rgba(244, 67, 54, 0.8);
  }
`;

const secureGlow = keyframes`
  0%, 100% { 
    box-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
    border-color: rgba(76, 175, 80, 0.5);
  }
  50% { 
    box-shadow: 0 0 20px rgba(76, 175, 80, 0.6);
    border-color: rgba(76, 175, 80, 0.8);
  }
`;

const dataFlow = keyframes`
  0% { 
    background-position: 0% 50%;
  }
  100% { 
    background-position: 100% 50%;
  }
`;

interface NodeEffectsProps {
  children: React.ReactNode;
  nodeType?: 'normal' | 'threat' | 'secure' | 'selected' | 'connecting';
  isHovered?: boolean;
  isSelected?: boolean;
  threatLevel?: 'low' | 'medium' | 'high' | 'critical';
  className?: string;
}

const EffectWrapper = styled(Box)<{
  nodeType: string;
  isHovered: boolean;
  isSelected: boolean;
  threatLevel: string;
  effectsEnabled: boolean;
  animationsEnabled: boolean;
}>`
  position: relative;
  transition: all 0.3s ease;
  border-radius: 8px;
  
  ${({ nodeType, isHovered, isSelected, threatLevel, effectsEnabled, animationsEnabled }) => {
    if (!effectsEnabled || !animationsEnabled) return '';
    
    let styles = '';
    
    // Hover effects
    if (isHovered) {
      styles += `
        animation: ${nodeHover} 0.3s ease forwards;
        z-index: 10;
      `;
    }
    
    // Selection effects - use only box-shadow, no animation to prevent conflicts
    if (isSelected) {
      styles += `
        box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.6);
        transition: box-shadow 0.15s ease;
      `;
    }
    
    // Node type specific effects
    switch (nodeType) {
      case 'threat':
        styles += `
          animation: ${threatGlow} 2s infinite;
        `;
        break;
      case 'secure':
        styles += `
          animation: ${secureGlow} 3s infinite;
        `;
        break;
      case 'connecting':
        styles += `
          animation: ${nodeConnect} 1s infinite;
        `;
        break;
    }
    
    // Threat level specific styling
    if (threatLevel && threatLevel !== 'low') {
      const intensity = {
        medium: '0.3',
        high: '0.5',
        critical: '0.8'
      }[threatLevel] || '0.3';
      
      styles += `
        &::before {
          content: '';
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          background: linear-gradient(45deg, 
            rgba(244, 67, 54, ${intensity}), 
            rgba(255, 152, 0, ${intensity}),
            rgba(244, 67, 54, ${intensity})
          );
          background-size: 400% 400%;
          animation: ${dataFlow} 3s ease infinite;
          border-radius: 10px;
          z-index: -1;
        }
      `;
    }
    
    return styles;
  }}
`;

export const NodeEffects: React.FC<NodeEffectsProps> = ({
  children,
  nodeType = 'normal',
  isHovered = false,
  isSelected = false,
  threatLevel = 'low',
  className
}) => {
  const { settings } = useSettings();
  const effectsEnabled = settings.effects?.enabled ?? true;
  const animationsEnabled = settings.effects?.animations ?? true;

  return (
    <EffectWrapper
      className={className}
      nodeType={nodeType}
      isHovered={isHovered}
      isSelected={isSelected}
      threatLevel={threatLevel}
      effectsEnabled={effectsEnabled}
      animationsEnabled={animationsEnabled}
    >
      {children}
    </EffectWrapper>
  );
};

interface ConnectionTrailProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  active?: boolean;
}

const trailFlow = keyframes`
  0% { stroke-dashoffset: 20; }
  100% { stroke-dashoffset: 0; }
`;

export const ConnectionTrail: React.FC<ConnectionTrailProps> = ({
  startX,
  startY,
  endX,
  endY,
  active = true
}) => {
  const { settings } = useSettings();
  const effectsEnabled = settings.effects?.enabled ?? true;
  const animationsEnabled = settings.effects?.animations ?? true;

  if (!effectsEnabled || !active) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5
      }}
    >
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke="rgba(25, 118, 210, 0.6)"
        strokeWidth="2"
        strokeDasharray="5,5"
        style={{
          animation: animationsEnabled ? `${trailFlow} 1s linear infinite` : 'none'
        }}
      />
    </svg>
  );
};

interface NotificationBadgeProps {
  count: number;
  type?: 'info' | 'warning' | 'error' | 'success';
  animated?: boolean;
}

const badgeBounce = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
`;

const BadgeContainer = styled(Box)<{ 
  type: string; 
  animated: boolean; 
  effectsEnabled: boolean; 
}>`
  position: absolute;
  top: -8px;
  right: -8px;
  min-width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  color: white;
  z-index: 10;
  
  ${({ type, animated, effectsEnabled }) => {
    const colors = {
      info: '#2196f3',
      warning: '#ff9800',
      error: '#f44336',
      success: '#4caf50'
    };
    
    let styles = `background-color: ${colors[type as keyof typeof colors]};`;
    
    if (effectsEnabled && animated) {
      styles += `
        animation: ${badgeBounce} 1s ease infinite;
      `;
    }
    
    return styles;
  }}
`;

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  type = 'info',
  animated = true
}) => {
  const { settings } = useSettings();
  const effectsEnabled = settings.effects?.enabled ?? true;

  if (count <= 0) return null;

  return (
    <BadgeContainer
      type={type}
      animated={animated}
      effectsEnabled={effectsEnabled}
    >
      {count > 99 ? '99+' : count}
    </BadgeContainer>
  );
};

interface FloatingLabelProps {
  text: string;
  visible: boolean;
  x: number;
  y: number;
}

const labelFadeIn = keyframes`
  from { 
    opacity: 0; 
    transform: translateY(10px); 
  }
  to { 
    opacity: 1; 
    transform: translateY(0); 
  }
`;

const LabelContainer = styled(Box)<{ visible: boolean; effectsEnabled: boolean }>`
  position: absolute;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 1000;
  
  ${({ visible, effectsEnabled }) => {
    if (!visible) return 'display: none;';
    
    return effectsEnabled ? `
      animation: ${labelFadeIn} 0.2s ease;
    ` : '';
  }}
`;

export const FloatingLabel: React.FC<FloatingLabelProps> = ({
  text,
  visible,
  x,
  y
}) => {
  const { settings } = useSettings();
  const effectsEnabled = settings.effects?.enabled ?? true;

  return (
    <LabelContainer
      visible={visible}
      effectsEnabled={effectsEnabled}
      style={{ left: x, top: y }}
    >
      {text}
    </LabelContainer>
  );
};