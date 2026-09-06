import {
  SecurityNode,
  SecurityEdge,
  isSecurityZoneNode
} from '../types/SecurityTypes';
import { DiagramData } from '../types/AnalysisTypes';

interface SanitizationPattern {
  type: 'sensitive' | 'technical' | 'business';
  pattern: RegExp;
  replacement: string;
}

interface SanitizationConfig {
  patterns?: SanitizationPattern[];
  preservedProperties?: string[];
}

export interface SanitizationResult {
  nodes: SecurityNode[];
  edges: SecurityEdge[];
  metadata: {
    timestamp: Date;
    status: 'sanitized' | 'failed';
    preservedProperties: string[];
    replacements: Array<{
      type: string;
      count: number;
    }>;
    message?: string;
    isSanitized?: boolean;
  };
}

export class DiagramSanitizer {
  private static readonly defaultPatterns: SanitizationPattern[] = [
    {
      type: 'sensitive',
      pattern: /(?:\d{1,3}\.){3}\d{1,3}/g,      // IP addresses
      replacement: 'x.x.x.x'
    },
    {
      type: 'sensitive',
      pattern: /[\w.-]+@[\w.-]+\.\w+/g,         // Email addresses
      replacement: '[EMAIL]'
    },
    {
      type: 'business',
      pattern: /(?:acme|technologies|corp)/gi,   // Company names
      replacement: 'COMPANY'
    },
    {
      type: 'sensitive',
      pattern: /password\d*/gi,                  // Passwords
      replacement: '[REDACTED]'
    },
    {
      type: 'sensitive',
      pattern: /api[_-]?key[_-]?\w*/gi,         // API keys
      replacement: '[REDACTED]'
    },
    {
      type: 'sensitive',
      pattern: /sk-[A-Za-z0-9]{16,}/g,           // OpenAI-style secret keys
      replacement: '[REDACTED]'
    },
    {
      type: 'sensitive',
      pattern: /AKIA[0-9A-Z]{16}/g,             // AWS access key id
      replacement: '[REDACTED]'
    },
    {
      type: 'sensitive',
      pattern: /[A-Za-z0-9+\/]{40,}/g,          // Generic base64-like long token (≥40 chars)
      replacement: '[REDACTED]'
    }
  ];
  

  private static readonly preservedProperties = [
    // 'securityLevel', - removed from the data model
    'zone',
    'zoneType',
    'protocols',
    'securityControls',
    'dataClassification'
  ];

  static sanitize(
    diagram?: DiagramData,
    config?: SanitizationConfig
  ): SanitizationResult {
    console.log('=== Starting Sanitization ===', {
      originalNodes: diagram?.nodes.map((n: SecurityNode) => ({
        id: n.id,
        type: n.type,
        dataKeys: n.data ? Object.keys(n.data) : [],
        securityProperties: {
          // level: n.data?.securityLevel, - removed from the data model
          zone: 'zone' in n.data ? n.data.zone : undefined,
          classification: n.data?.dataClassification
        }
      })),
      originalEdges: diagram?.edges.map((e: SecurityEdge) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        dataKeys: e.data ? Object.keys(e.data) : []
      }))
    });

    // Handle undefined or null diagram
    if (!diagram || !diagram.nodes || !diagram.edges) {
      return {
        nodes: [],
        edges: [],
        metadata: {
          timestamp: new Date(),
          status: 'sanitized',
          preservedProperties: [],
          replacements: [],
          message: 'No diagram provided',
          isSanitized: true
        }
      };
    }

    const patterns = config?.patterns || this.defaultPatterns;
    const preserved = config?.preservedProperties || this.preservedProperties;
    const replacementCounts = new Map<string, number>();

    try {
      const sanitizedNodes = diagram.nodes.map((node: SecurityNode) => 
        this.sanitizeNode(node, patterns, replacementCounts)
      );

      const sanitizedEdges = diagram.edges.map((edge: SecurityEdge) =>
        this.sanitizeEdge(edge, patterns, replacementCounts)
      );

      // Validate before creating result
      if (!this.validateBeforeTransit({ nodes: sanitizedNodes, edges: sanitizedEdges })) {
        throw new Error('Sanitization validation failed');
      }

      const result: SanitizationResult = {
        nodes: sanitizedNodes,
        edges: sanitizedEdges,
        metadata: {
          timestamp: new Date(),
          status: 'sanitized',
          preservedProperties: preserved,
          replacements: Array.from(replacementCounts.entries()).map(([type, count]) => ({
            type,
            count
          })),
          message: 'Sanitization successful',
          isSanitized: true
        }
      };

      console.log('=== Sanitization Complete ===', {
        sanitizedNodes: sanitizedNodes.map((n: SecurityNode) => ({
          id: n.id,
          type: n.type,
          dataKeys: n.data ? Object.keys(n.data) : [],
          securityProperties: {
            // level: n.data?.securityLevel, - removed from the data model
            zone: 'zone' in n.data ? n.data.zone : undefined,
            classification: n.data?.dataClassification
          }
        })),
        sanitizedEdges: sanitizedEdges.map((e: SecurityEdge) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          dataKeys: e.data ? Object.keys(e.data) : []
        }))
      });

      return result;

    } catch (error) {
      console.error('Sanitization failed:', error);
      return {
        nodes: [],
        edges: [],
        metadata: {
          timestamp: new Date(),
          status: 'failed',
          preservedProperties: [],
          replacements: [],
          message: error instanceof Error ? error.message : 'Unknown sanitization error',
          isSanitized: false
        }
      };
    }
  }

  static sanitizeContextText(text: string): string {
    if (!text) return '';
  
    const counts = new Map<string, number>();
  
    console.log('Sanitizing context text, length:', text.length);
  
    try {
      const sanitized = this.sanitizeText(text, this.defaultPatterns, counts);
      
      console.log('Context sanitization completed:', {
        originalLength: text.length,
        sanitizedLength: sanitized.length,
        replacements: Array.from(counts.entries())
      });
  
      return sanitized;
    } catch (error) {
      console.error('Context sanitization failed:', error);
      return ''; // Return empty string on error
    }
  }

  private static sanitizeNode(
    node: SecurityNode,
    patterns: SanitizationPattern[],
    counts: Map<string, number>
  ): SecurityNode {
    if (isSecurityZoneNode(node)) {
      return {
        ...node,
        data: {
          ...node.data,
          label: this.sanitizeText(node.data.label, patterns, counts),
          description: this.sanitizeText(node.data.description, patterns, counts),
          zoneType: node.data.zoneType
        }
      };
    }

    // Handle DFD nodes
    if (node.type === 'dfdActor' || node.type === 'dfdProcess' || node.type === 'dfdDataStore' || node.type === 'dfdTrustBoundary') {
      const baseData: any = {
        label: this.sanitizeText(node.data.label, patterns, counts),
        description: this.sanitizeText(node.data.description, patterns, counts),
        zone: node.data.zone,
        dataClassification: node.data.dataClassification,
        protocols: node.data.protocols,
        securityControls: node.data.securityControls,
        technology: node.data.technology
      };

      // Add type-specific properties
      if ('actorType' in node.data) baseData.actorType = node.data.actorType;
      if ('processType' in node.data) baseData.processType = node.data.processType;
      if ('storeType' in node.data) baseData.storeType = node.data.storeType;
      if ('boundaryType' in node.data) baseData.boundaryType = node.data.boundaryType;

      return {
        ...node,
        data: baseData
      };
    }

    return {
      ...node,
      data: {
        ...node.data,
        label: this.sanitizeText(node.data.label, patterns, counts),
        description: this.sanitizeText(node.data.description, patterns, counts),
        vendor: this.sanitizeText(node.data.vendor, patterns, counts),
        product: this.sanitizeText(node.data.product, patterns, counts),
        version: this.sanitizeText(node.data.version, patterns, counts),
        technology: this.sanitizeText(node.data.technology, patterns, counts),
        zone: node.data.zone,
        // securityLevel removed - no longer part of the data model
        dataClassification: node.data.dataClassification,
        protocols: node.data.protocols, // Array of strings - preserve as-is
        securityControls: node.data.securityControls, // Array of strings - preserve as-is
        components: node.data.components, // Array of objects - preserve as-is
        icon: node.data.icon // Preserve icon reference
      }
    };
  }

  private static sanitizeEdge(
    edge: SecurityEdge,
    patterns: SanitizationPattern[],
    counts: Map<string, number>
  ): SecurityEdge {
    return {
      ...edge,
      data: {
        ...edge.data,
        label: edge.data.label 
          ? this.sanitizeText(edge.data.label, patterns, counts)
          : undefined,
        description: edge.data.description
          ? this.sanitizeText(edge.data.description, patterns, counts)
          : undefined,
        protocol: edge.data.protocol,
        encryption: edge.data.encryption,
        // securityLevel removed - no longer part of the data model
      }
    };
  }

  private static sanitizeText(
    text: string | undefined | null,
    patterns: SanitizationPattern[],
    counts: Map<string, number>
  ): string {
    if (!text) return '';

    return patterns.reduce((sanitized, { type, pattern, replacement }) => {
      const matches = sanitized.match(pattern)?.length || 0;
      if (matches > 0) {
        counts.set(type, (counts.get(type) || 0) + matches);
      }
      return sanitized.replace(pattern, replacement);
    }, text);
  }

  static validateBeforeTransit(diagram: DiagramData): boolean {
    try {
      // Handle empty diagram case
      if (!diagram.nodes || !diagram.edges) {
        return true;
      }

      const hasInvalidNodes = diagram.nodes.some((node: SecurityNode) => {
        if (!node.data) return true;
        if (!node.id || !node.data.label) return true;
        return false;
      });

      const hasInvalidEdges = diagram.edges.some((edge: SecurityEdge) => {
        if (!edge.data) return true;
        if (!edge.id || !edge.source || !edge.target) return true;
        return false;
      });

      return !hasInvalidNodes && !hasInvalidEdges;
    } catch (error) {
      console.error('Transit validation error:', error);
      return false;
    }
  }
}