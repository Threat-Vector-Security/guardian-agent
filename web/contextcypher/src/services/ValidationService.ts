// ValidationService.ts
import { SecurityNode, SecurityEdge } from '../types/SecurityTypes';

interface ValidationResponse {
  valid: boolean;
  message: string;
  conflictingNode?: {
    id: string;
    type: string;
    zone: string;
    code: string;
  };
  conflictingEdge?: {
    id: string;
    source: string;
    target: string;
  };
}

interface Diagram {
  nodes: SecurityNode[];
  edges: SecurityEdge[];
}

class ValidationService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = window.location.origin;
  }

  async validateNodeLabel(
    label: string, 
    type: string, 
    currentNodeId: string | null,
    diagram: Diagram
  ): Promise<ValidationResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/diagram/validate-label`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          label,
          type,
          currentNodeId,
          diagram
        }),
      });

      if (!response.ok) {
        throw new Error(`Validation failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Label validation error:', error);
      return {
        valid: true, // Default to valid on error to not block user
        message: 'Validation check failed - proceeding without validation'
      };
    }
  }

  async validateEdgeLabel(
    label: string,
    currentEdgeId: string | null,
    diagram: Diagram
  ): Promise<ValidationResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/diagram/validate-edge-label`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          label,
          currentEdgeId,
          diagram
        }),
      });

      if (!response.ok) {
        throw new Error(`Validation failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Edge label validation error:', error);
      return {
        valid: true, // Default to valid on error to not block user
        message: 'Validation check failed - proceeding without validation'
      };
    }
  }
}

export const validationService = new ValidationService();