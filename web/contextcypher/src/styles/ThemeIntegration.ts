// ThemeIntegration.ts - Helper to convert Theme colors to CSS variables for Tailwind
import { Theme } from './Theme';

// Convert hex to RGB values for alpha support
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '0, 0, 0';
}

export function applyThemeToCSS(theme: Theme) {
  const root = document.documentElement;
  
  // Apply theme colors as CSS variables
  root.style.setProperty('--theme-primary', theme.colors.primary || '#00D4FF');
  root.style.setProperty('--theme-secondary', theme.colors.secondary || '#FF00FF');
  root.style.setProperty('--theme-background', theme.colors.background || '#0a0a0a');
  root.style.setProperty('--theme-surface', theme.colors.surface || '#1a1a1a');
  root.style.setProperty('--theme-surfaceHover', theme.colors.surfaceHover || '#2a2a2a');
  root.style.setProperty('--theme-border', theme.colors.border || '#2a2a2a');
  root.style.setProperty('--theme-textPrimary', theme.colors.textPrimary || '#ffffff');
  root.style.setProperty('--theme-textSecondary', theme.colors.textSecondary || '#a0a0a0');
  root.style.setProperty('--theme-nodeBg', theme.colors.nodeBg || '#1a1a1a');
  root.style.setProperty('--theme-info', theme.colors.info || '#2196f3');
  root.style.setProperty('--theme-success', theme.colors.success || '#4caf50');
  root.style.setProperty('--theme-warning', theme.colors.warning || '#ff9800');
  root.style.setProperty('--theme-error', theme.colors.error || '#f44336');
  
  // RGB values for alpha support
  root.style.setProperty('--theme-primary-rgb', hexToRgb(theme.colors.primary || '#00D4FF'));
  root.style.setProperty('--theme-secondary-rgb', hexToRgb(theme.colors.secondary || '#FF00FF'));
  
  // Apply theme class for theme-specific effects
  document.body.className = `theme-${theme.name}`;
  
  // Add streaming class if needed (preserved from existing functionality)
  if (document.body.classList.contains('streaming-active')) {
    document.body.classList.add('streaming-active');
  }
}

// Helper to get contrasting text color
export function getContrastColor(bgColor: string): string {
  // Convert hex to RGB
  const color = bgColor.replace('#', '');
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// Helper to generate hover color
export function getHoverColor(color: string, amount: number = 0.1): string {
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  const r = (num >> 16) + Math.round(255 * amount);
  const g = ((num >> 8) & 0x00ff) + Math.round(255 * amount);
  const b = (num & 0x0000ff) + Math.round(255 * amount);
  
  return '#' + (
    (r < 255 ? r : 255) * 0x10000 +
    (g < 255 ? g : 255) * 0x100 +
    (b < 255 ? b : 255)
  ).toString(16).padStart(6, '0');
}