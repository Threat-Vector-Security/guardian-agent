import { DrawingStyle } from '../types/SecurityTypes';

const STORAGE_KEY = 'contextcypher-drawing-styles';

export interface DrawingStylePresets {
  pencil: DrawingStyle;
  rectangle: DrawingStyle;
  circle: DrawingStyle;
  arrow: DrawingStyle;
  text: DrawingStyle;
}

class DrawingStyleService {
  private static instance: DrawingStyleService;

  private constructor() {}

  static getInstance(): DrawingStyleService {
    if (!DrawingStyleService.instance) {
      DrawingStyleService.instance = new DrawingStyleService();
    }
    return DrawingStyleService.instance;
  }

  // Load saved styles from localStorage
  loadStyles(): Partial<DrawingStylePresets> | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load drawing styles:', error);
    }
    return null;
  }

  // Save styles to localStorage
  saveStyles(styles: Partial<DrawingStylePresets>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(styles));
    } catch (error) {
      console.error('Failed to save drawing styles:', error);
    }
  }

  // Save a single tool's style
  saveToolStyle(tool: keyof DrawingStylePresets, style: DrawingStyle): void {
    const currentStyles = this.loadStyles() || {};
    currentStyles[tool] = style;
    this.saveStyles(currentStyles);
  }

  // Get style for a specific tool
  getToolStyle(tool: keyof DrawingStylePresets): DrawingStyle | null {
    const styles = this.loadStyles();
    return styles?.[tool] || null;
  }

  // Clear all saved styles
  clearStyles(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear drawing styles:', error);
    }
  }
}

export const drawingStyleService = DrawingStyleService.getInstance();