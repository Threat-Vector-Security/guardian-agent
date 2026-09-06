// src/services/DrawingAnalyzer.ts

import { Drawing, DrawingStyle, Point } from '../types/AnalysisTypes';
import { SecurityNode } from '../types/SecurityTypes';

export class DrawingAnalyzer {
  static interpretDrawing(
    drawing: Drawing, 
    associatedNode?: SecurityNode
  ): string {
    const style = drawing.style;
    const emphasis = this.getEmphasisLevel(style);
    
    let interpretation = '';
    
    // Interpret color meaning
    if (style.stroke) {
      interpretation += this.interpretColor(style.stroke);
    }
    
    // Interpret line style
    if (style.strokeDasharray) {
      interpretation += this.interpretLineStyle(style.strokeDasharray);
    }
    
    // Interpret opacity as emphasis
    interpretation += this.interpretEmphasis(emphasis);
    
    return interpretation;
  }
  
  private static getEmphasisLevel(style: DrawingStyle): 'high' | 'medium' | 'low' {
    const opacity = style.opacity || 1;
    const strokeWidth = style.strokeWidth || 1;
    
    if (opacity > 0.8 && strokeWidth > 2) return 'high';
    if (opacity > 0.5 && strokeWidth > 1) return 'medium';
    return 'low';
  }
  
  private static interpretColor(color: string): string {
    const colorMeanings: Record<string, string> = {
      '#ff0000': 'indicating critical attention needed',
      '#ffff00': 'highlighting a warning or concern',
      '#00ff00': 'marking a verified or safe area',
      // Add more color interpretations
    };
    
    return colorMeanings[color.toLowerCase()] || '';
  }
  
  private static interpretLineStyle(dashArray: string): string {
    switch (dashArray) {
      case '5,5':
        return 'showing a logical or virtual boundary';
      case '2,2':
        return 'indicating a temporary or proposed relationship';
      case '10,5,2,5':
        return 'highlighting a complex or conditional relationship';
      default:
        return 'showing a direct relationship';
    }
  }
  
  private static interpretEmphasis(level: 'high' | 'medium' | 'low'): string {
    switch (level) {
      case 'high':
        return 'with strong emphasis';
      case 'medium':
        return 'with moderate emphasis';
      case 'low':
        return 'with subtle indication';
    }
  }
} 