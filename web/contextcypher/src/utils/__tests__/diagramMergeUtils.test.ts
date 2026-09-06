/**
 * Unit tests for diagram merge utilities
 * Tests ID collision prevention, diagram merging, and validation
 */

import {
  generateImportPrefix,
  prefixDiagramIds,
  mergeDiagrams,
  validateMergedDiagram
} from '../diagramMergeUtils';
import { ExampleSystem } from '../../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge } from '../../types/SecurityTypes';

describe('diagramMergeUtils', () => {

  describe('generateImportPrefix', () => {
    it('should generate unique prefix with source and timestamp', async () => {
      const prefix1 = generateImportPrefix('AWS');
      // Wait 10ms to ensure different base36 timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      const prefix2 = generateImportPrefix('AWS');

      expect(prefix1).toMatch(/^aws_[a-z0-9]+_$/);
      expect(prefix2).toMatch(/^aws_[a-z0-9]+_$/);
      expect(prefix1).not.toBe(prefix2); // Different timestamps
    });

    it('should sanitize source name', () => {
      const prefix = generateImportPrefix('My-Cloud-Import!@#');
      expect(prefix).toMatch(/^myclo_[a-z0-9]+_$/); // Only first 5 chars, sanitized
    });

    it('should handle short source names', () => {
      const prefix = generateImportPrefix('GCP');
      expect(prefix).toMatch(/^gcp_[a-z0-9]+_$/);
    });
  });

  describe('prefixDiagramIds', () => {
    it('should prefix all node IDs', () => {
      const diagram: ExampleSystem = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'Cloud Infrastructure',
        primaryZone: 'Internal',
        dataClassification: 'Internal',
        nodes: [
          {
            id: 'node-1',
            type: 'server',
            position: { x: 0, y: 0 },
            data: { label: 'Server 1', zone: 'Internal', dataClassification: 'Internal' }
          },
          {
            id: 'node-2',
            type: 'database',
            position: { x: 100, y: 0 },
            data: { label: 'DB 1', zone: 'Internal', dataClassification: 'Internal' }
          }
        ] as SecurityNode[],
        edges: []
      };

      const prefixed = prefixDiagramIds(diagram, 'test_');

      expect(prefixed.nodes[0].id).toBe('test_node-1');
      expect(prefixed.nodes[1].id).toBe('test_node-2');
    });

    it('should prefix parentId if present', () => {
      const diagram: ExampleSystem = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'Cloud Infrastructure',
        primaryZone: 'Internal',
        dataClassification: 'Internal',
        nodes: [
          {
            id: 'parent',
            type: 'securityZone',
            position: { x: 0, y: 0 },
            data: { label: 'Zone', zone: 'Internal', dataClassification: 'Internal' }
          },
          {
            id: 'child',
            type: 'server',
            position: { x: 10, y: 10 },
            data: { label: 'Server', zone: 'Internal', dataClassification: 'Internal' },
            parentId: 'parent'
          }
        ] as SecurityNode[],
        edges: []
      };

      const prefixed = prefixDiagramIds(diagram, 'test_');

      expect(prefixed.nodes[1].parentId).toBe('test_parent');
    });

    it('should prefix edge IDs and update source/target', () => {
      const diagram: ExampleSystem = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'Cloud Infrastructure',
        primaryZone: 'Internal',
        dataClassification: 'Internal',
        nodes: [
          {
            id: 'node-1',
            type: 'server',
            position: { x: 0, y: 0 },
            data: { label: 'Server', zone: 'Internal', dataClassification: 'Internal' }
          },
          {
            id: 'node-2',
            type: 'database',
            position: { x: 100, y: 0 },
            data: { label: 'DB', zone: 'Internal', dataClassification: 'Internal' }
          }
        ] as SecurityNode[],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'node-2',
            type: 'securityEdge',
            data: {
              label: 'Connection',
              zone: 'Internal',
              dataClassification: 'Internal',
              protocol: 'HTTPS',
              portRange: '443'
            }
          }
        ] as SecurityEdge[]
      };

      const prefixed = prefixDiagramIds(diagram, 'pre_');

      expect(prefixed.edges[0].id).toBe('pre_edge-1');
      expect(prefixed.edges[0].source).toBe('pre_node-1');
      expect(prefixed.edges[0].target).toBe('pre_node-2');
    });
  });

  describe('mergeDiagrams', () => {
    const existingDiagram: ExampleSystem = {
      id: 'existing',
      name: 'Existing Diagram',
      description: 'Original',
      category: 'Cloud Infrastructure',
      primaryZone: 'Internal',
      dataClassification: 'Internal',
      customContext: 'Original context',
      nodes: [
        {
          id: 'existing-node',
          type: 'server',
          position: { x: 100, y: 100 },
          data: { label: 'Existing Server', zone: 'Internal', dataClassification: 'Internal' }
        }
      ] as SecurityNode[],
      edges: []
    };

    const importedDiagram: ExampleSystem = {
      id: 'imported',
      name: 'Imported Diagram',
      description: 'Imported',
      category: 'Cloud Infrastructure',
      primaryZone: 'Internal',
      dataClassification: 'Internal',
      customContext: 'Imported context',
      nodes: [
        {
          id: 'imported-node',
          type: 'database',
          position: { x: 0, y: 0 },
          data: { label: 'Imported DB', zone: 'Internal', dataClassification: 'Internal' }
        }
      ] as SecurityNode[],
      edges: []
    };

    it('should merge nodes from both diagrams', () => {
      const merged = mergeDiagrams(existingDiagram, importedDiagram, 'TestSource');

      expect(merged.nodes.length).toBe(2);
      expect(merged.nodes.some(n => n.id === 'existing-node')).toBe(true);
      expect(merged.nodes.some(n => n.id.includes('imported-node'))).toBe(true);
    });

    it('should offset imported nodes layout', () => {
      const merged = mergeDiagrams(existingDiagram, importedDiagram, 'TestSource');

      const importedNode = merged.nodes.find(n => n.id.includes('imported-node'));
      expect(importedNode?.position.x).toBeGreaterThan(existingDiagram.nodes[0].position.x);
    });

    it('should merge custom context', () => {
      const merged = mergeDiagrams(existingDiagram, importedDiagram, 'TestSource');

      expect(merged.customContext).toContain('Original context');
      expect(merged.customContext).toContain('Imported from TestSource');
      expect(merged.customContext).toContain('Imported context');
    });

    it('should preserve existing diagram metadata', () => {
      const merged = mergeDiagrams(existingDiagram, importedDiagram, 'TestSource');

      expect(merged.name).toBe('Existing Diagram');
      expect(merged.description).toContain('merged with TestSource');
    });

    it('should handle diagrams with edges', () => {
      const diagramWithEdges: ExampleSystem = {
        ...importedDiagram,
        nodes: [
          {
            id: 'n1',
            type: 'server',
            position: { x: 0, y: 0 },
            data: { label: 'S1', zone: 'Internal', dataClassification: 'Internal' }
          },
          {
            id: 'n2',
            type: 'database',
            position: { x: 100, y: 0 },
            data: { label: 'DB', zone: 'Internal', dataClassification: 'Internal' }
          }
        ] as SecurityNode[],
        edges: [
          {
            id: 'e1',
            source: 'n1',
            target: 'n2',
            type: 'securityEdge',
            data: {
              label: 'Conn',
              zone: 'Internal',
              dataClassification: 'Internal',
              protocol: 'TCP',
              portRange: '3306'
            }
          }
        ] as SecurityEdge[]
      };

      const merged = mergeDiagrams(existingDiagram, diagramWithEdges, 'TestSource');

      expect(merged.edges.length).toBe(1);
      const edge = merged.edges[0];
      expect(edge.source).toContain('n1');
      expect(edge.target).toContain('n2');
    });
  });

  describe('validateMergedDiagram', () => {
    it('should return no warnings for valid diagram', () => {
      const validDiagram: ExampleSystem = {
        id: 'valid',
        name: 'Valid',
        description: 'Valid',
        category: 'Cloud Infrastructure',
        primaryZone: 'Internal',
        dataClassification: 'Internal',
        nodes: [
          {
            id: 'node-1',
            type: 'server',
            position: { x: 0, y: 0 },
            data: { label: 'Server', zone: 'Internal', dataClassification: 'Internal' }
          }
        ] as SecurityNode[],
        edges: []
      };

      const warnings = validateMergedDiagram(validDiagram);
      expect(warnings).toHaveLength(0);
    });

    it('should detect duplicate node IDs', () => {
      const invalidDiagram: ExampleSystem = {
        id: 'invalid',
        name: 'Invalid',
        description: 'Invalid',
        category: 'Cloud Infrastructure',
        primaryZone: 'Internal',
        dataClassification: 'Internal',
        nodes: [
          {
            id: 'duplicate',
            type: 'server',
            position: { x: 0, y: 0 },
            data: { label: 'S1', zone: 'Internal', dataClassification: 'Internal' }
          },
          {
            id: 'duplicate',
            type: 'database',
            position: { x: 100, y: 0 },
            data: { label: 'DB', zone: 'Internal', dataClassification: 'Internal' }
          }
        ] as SecurityNode[],
        edges: []
      };

      const warnings = validateMergedDiagram(invalidDiagram);
      expect(warnings.some(w => w.includes('Duplicate node ID'))).toBe(true);
    });

    it('should detect orphaned edges', () => {
      const invalidDiagram: ExampleSystem = {
        id: 'invalid',
        name: 'Invalid',
        description: 'Invalid',
        category: 'Cloud Infrastructure',
        primaryZone: 'Internal',
        dataClassification: 'Internal',
        nodes: [
          {
            id: 'node-1',
            type: 'server',
            position: { x: 0, y: 0 },
            data: { label: 'Server', zone: 'Internal', dataClassification: 'Internal' }
          }
        ] as SecurityNode[],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'missing-node',
            type: 'securityEdge',
            data: {
              label: 'Conn',
              zone: 'Internal',
              dataClassification: 'Internal',
              protocol: 'TCP',
              portRange: '80'
            }
          }
        ] as SecurityEdge[]
      };

      const warnings = validateMergedDiagram(invalidDiagram);
      expect(warnings.some(w => w.includes('missing target node'))).toBe(true);
    });

    it('should detect duplicate edge IDs', () => {
      const invalidDiagram: ExampleSystem = {
        id: 'invalid',
        name: 'Invalid',
        description: 'Invalid',
        category: 'Cloud Infrastructure',
        primaryZone: 'Internal',
        dataClassification: 'Internal',
        nodes: [
          {
            id: 'n1',
            type: 'server',
            position: { x: 0, y: 0 },
            data: { label: 'S1', zone: 'Internal', dataClassification: 'Internal' }
          },
          {
            id: 'n2',
            type: 'database',
            position: { x: 100, y: 0 },
            data: { label: 'DB', zone: 'Internal', dataClassification: 'Internal' }
          }
        ] as SecurityNode[],
        edges: [
          {
            id: 'dup-edge',
            source: 'n1',
            target: 'n2',
            type: 'securityEdge',
            data: {
              label: 'C1',
              zone: 'Internal',
              dataClassification: 'Internal',
              protocol: 'TCP',
              portRange: '80'
            }
          },
          {
            id: 'dup-edge',
            source: 'n1',
            target: 'n2',
            type: 'securityEdge',
            data: {
              label: 'C2',
              zone: 'Internal',
              dataClassification: 'Internal',
              protocol: 'TCP',
              portRange: '443'
            }
          }
        ] as SecurityEdge[]
      };

      const warnings = validateMergedDiagram(invalidDiagram);
      expect(warnings.some(w => w.includes('Duplicate edge ID'))).toBe(true);
    });
  });
});

export {};
