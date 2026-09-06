import React, { useEffect } from 'react';
import { useSettings } from '../../settings/SettingsContext';
import { getTheme } from '../../styles/Theme';
import { styled, keyframes, css } from '@mui/material/styles';
import { Box } from '@mui/material';

const neonGlow = keyframes`
  0%, 100% { 
    box-shadow: 0 0 1px currentColor;
    filter: brightness(1);
    opacity: 0.4;
  }
  50% { 
    box-shadow: 0 0 2px currentColor;
    filter: brightness(1);
    opacity: 0.6;
  }
`;

const glitchAnimation = keyframes`
  0% { transform: translateX(0); }
  10% { transform: translateX(-2px) scaleY(1.01); }
  20% { transform: translateX(2px) scaleY(0.99); }
  30% { transform: translateX(-1px) scaleY(1.01); }
  40% { transform: translateX(1px) scaleY(0.98); }
  50% { transform: translateX(-2px) scaleY(1.02); }
  60% { transform: translateX(2px) scaleY(0.99); }
  70% { transform: translateX(-1px) scaleY(1.01); }
  80% { transform: translateX(1px) scaleY(0.98); }
  90% { transform: translateX(0) scaleY(1); }
  100% { transform: translateX(0); }
`;

const synthwaveGrid = keyframes`
  0% { background-position: 0 0; }
  100% { background-position: 40px 40px; }
`;


const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
`;

const scanlines = keyframes`
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
`;

interface ThemeEffectsProps {
  children: React.ReactNode;
  className?: string;
}

const EffectsContainer = styled(Box)<{ 
  themeName: string; 
  neonEnabled: boolean; 
  glitchEnabled: boolean;
  effectsEnabled: boolean;
}>`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;

  ${({ themeName, neonEnabled, glitchEnabled, effectsEnabled }) => {
    // EFFECTS PERMANENTLY DISABLED - Always return empty styles
    return '';

    let styles = '';

    // Neon effects when enabled (works with any theme)
    if (neonEnabled) {
      styles += `
        & .neon-text {
          ${css`animation: ${neonGlow} 2s ease-in-out infinite alternate;`}
          text-shadow: 0 0 1px currentColor;
          opacity: 0.8;
        }
        
        & .neon-border {
          ${css`animation: ${neonGlow} 2s ease-in-out infinite alternate;`}
          border: 1px solid currentColor;
        }
        
        & button:hover, & .neon-button {
          ${css`animation: ${neonGlow} 1s ease-in-out infinite alternate;`}
        }
      `;
    }

    // Glitch effects for hacker, cyberpunk, and threatVector themes
    if (glitchEnabled && (themeName === 'hacker' || themeName === 'cyberpunk' || themeName === 'threatVector')) {
      styles += `
        & .glitch-text {
          ${css`animation: ${glitchAnimation} 0.3s infinite;`}
        }
        
        & .glitch-container:hover {
          ${css`animation: ${glitchAnimation} 0.5s infinite;`}
        }
        
        &::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, currentColor, transparent);
          ${css`animation: ${scanlines} 3s linear infinite;`}
          z-index: 1000;
          pointer-events: none;
        }
      `;
    }

    // Synthwave grid background
    if (themeName === 'synthwave') {
      styles += `
        &::after {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: 
            linear-gradient(rgba(255, 0, 110, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 0, 110, 0.1) 1px, transparent 1px);
          background-size: 40px 40px;
          ${css`animation: ${synthwaveGrid} 20s linear infinite;`}
          pointer-events: none;
          z-index: -1;
        }
      `;
    }

    // Matrix background pattern
    if (themeName === 'matrix') {
      styles += `
        &::after {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: 
            radial-gradient(circle at 20% 20%, rgba(0, 255, 0, 0.03) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(0, 255, 0, 0.03) 0%, transparent 50%);
          pointer-events: none;
          z-index: -1;
        }
      `;
    }

    // Threat Vector cyberpunk grid pattern
    if (themeName === 'threatVector') {
      styles += `
        &::after {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: 
            linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px);
          background-size: 50px 50px;
          pointer-events: none;
          z-index: -1;
        }
        
        & .neon-text {
          text-shadow: 
            0 0 10px currentColor,
            0 0 20px currentColor,
            0 0 30px currentColor;
        }
        
        & .neon-border {
          box-shadow:
            0 0 5px #00ffff,
            0 0 10px #00ffff,
            0 0 15px #00ffff,
            0 0 20px #00ffff,
            inset 0 0 5px #00ffff;
        }
      `;
    }

    // Floating animations for elements
    styles += `
      & .float-animation {
        ${css`animation: ${float} 3s ease-in-out infinite;`}
      }
      
      & .pulse-animation {
        ${css`animation: ${pulse} 2s ease-in-out infinite;`}
      }
    `;

    return styles;
  }}
`;

const ScanlineOverlay = styled(Box)<{ active: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
  background: ${({ active }) => active ? `
    linear-gradient(
      transparent 50%, 
      rgba(0, 255, 0, 0.03) 50%, 
      transparent 51%
    )
  ` : 'none'};
  background-size: 100% 4px;
  ${({ active }) => active ? css`animation: ${scanlines} 0.1s linear infinite;` : 'animation: none;'}
  display: ${({ active }) => active ? 'block' : 'none'};
`;

export const ThemeEffects: React.FC<ThemeEffectsProps> = ({ children, className }) => {
  const { settings } = useSettings();
  const theme = getTheme(settings.theme, settings.customTheme);
  
  // EFFECTS PERMANENTLY DISABLED
  const effectsEnabled = false;
  const neonEnabled = false;
  const glitchEnabled = false;
  const matrixEnabled = false;

  // Apply theme-specific CSS variables
  useEffect(() => {
    if (effectsEnabled) {
      const root = document.documentElement;
      root.style.setProperty('--theme-primary', theme.colors.primary);
      root.style.setProperty('--theme-secondary', theme.colors.secondary);
      root.style.setProperty('--theme-background', theme.colors.background);
      root.style.setProperty('--theme-surface', theme.colors.surface);
      root.style.setProperty('--theme-text-primary', theme.colors.textPrimary);
    }
  }, [theme, effectsEnabled]);

  return (
    <EffectsContainer
      className={className}
      themeName={settings.theme}
      neonEnabled={neonEnabled}
      glitchEnabled={glitchEnabled}
      effectsEnabled={effectsEnabled}
    >
      {children}
      
      {/* Matrix-style scanlines for retro terminals - PERMANENTLY DISABLED */}
      <ScanlineOverlay
        active={false}
      />
    </EffectsContainer>
  );
};

// Utility components for applying effects
export const NeonText = styled('span')<{ active?: boolean }>`
  ${({ active = true }) => active ? css`
    animation: ${neonGlow} 2s ease-in-out infinite alternate;
    text-shadow: 0 0 1px currentColor;
    opacity: 0.8;
  ` : ''}
`;

export const GlitchText = styled('span')<{ active?: boolean }>`
  ${({ active = true }) => active ? css`
    animation: ${glitchAnimation} 0.3s infinite;
  ` : ''}
`;

export const FloatingElement = styled(Box)<{ active?: boolean }>`
  ${({ active = true }) => active ? css`
    animation: ${float} 3s ease-in-out infinite;
  ` : ''}
`;

export const PulsingElement = styled(Box)<{ active?: boolean }>`
  ${({ active = true }) => active ? css`
    animation: ${pulse} 2s ease-in-out infinite;
  ` : ''}
`;