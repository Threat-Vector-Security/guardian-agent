// src/services/__tests__/DiagramSanitizer.test.ts
import { 
  DiagramData,
  SecurityNode,
  SecurityEdge,
  SecurityZone,
  SecurityNodeData,
  SecurityZoneNodeData,
  isSecurityZoneNode,
  DataClassification
} from '../../types/SecurityTypes';
import { DiagramSanitizer, SanitizationResult } from '../ClientDiagramSanitizer';

// Silence console output in tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

// Test utilities
const getSecurityNodeData = (node: SecurityNode): SecurityNodeData => {
  if (isSecurityZoneNode(node)) {
    throw new Error('Expected SecurityNodeData but got SecurityZoneNodeData');
  }
  // For DFD nodes which have optional zone, cast to SecurityNodeData
  if (node.type.startsWith('dfd')) {
    throw new Error('Expected SecurityNodeData but got DFD node data');
  }
  return node.data as SecurityNodeData;
};

describe('DiagramSanitizer', () => {
  const testAppNode: SecurityNode = {
    id: '1',
    type: 'application',
    position: { x: 100, y: 100 },
    data: {
      label: 'Acme Corp Server',
      description: 'Internal server at 192.168.1.1',
      // securityLevel removed - no longer part of the data model
      zone: 'DMZ' as SecurityZone,
      protocols: ['HTTPS'],
      vendor: 'Acme Technologies',
      version: '2.1.0',
      dataClassification: 'Sensitive' as DataClassification,
      category: 'infrastructure'
    } as SecurityNodeData
  };

  const testEdge: SecurityEdge = {
    id: 'e1',
    source: '1',
    target: '2',
    type: 'securityEdge',
    data: {
      label: 'HTTPS Connection',
      protocol: 'HTTPS',
      description: 'Internal connection on port 5432',
      // securityLevel removed - no longer part of the data model
    }
  };

  const testDiagram: DiagramData = {
    nodes: [testAppNode],
    edges: [testEdge]
  };

  describe('sanitize', () => {
    it('should sanitize sensitive data while preserving technical details', () => {
      const result = DiagramSanitizer.sanitize(testDiagram);
      
      const sanitizedNode = result.nodes[0];
      expect(getSecurityNodeData(sanitizedNode).label).toContain('COMPANY');
      expect(getSecurityNodeData(sanitizedNode).description).toContain('x.x.x.x');
      expect(getSecurityNodeData(sanitizedNode).version).toBe('2.1.0'); // Version preserved
      
      const sanitizedEdge = result.edges[0];
      expect(sanitizedEdge.data.description).toContain('port 5432'); // Port number preserved
    });

    it('should handle empty diagram', () => {
      const result = DiagramSanitizer.sanitize({ nodes: [], edges: [] });
      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
      expect(result.metadata.status).toBe('sanitized');
    });

    it('should handle undefined data', () => {
      const result = DiagramSanitizer.sanitize(undefined);
      expect(result.metadata.status).toBe('sanitized');
      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });
  });

  describe('validateBeforeTransit', () => {
    it('should validate valid diagram', () => {
      const isValid = DiagramSanitizer.validateBeforeTransit(testDiagram);
      expect(isValid).toBe(true);
    });

    it('should fail validation for invalid nodes', () => {
      const invalidDiagram: DiagramData = {
        nodes: [{
          ...testAppNode,
          data: null as any
        }],
        edges: []
      };

      const isValid = DiagramSanitizer.validateBeforeTransit(invalidDiagram);
      expect(isValid).toBe(false);
    });
  });
});