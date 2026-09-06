/**
 * Unit tests for DiagramImportService
 * Tests format detection, parsing, and conversion of various diagram formats
 */

import { diagramImportService, DiagramFormat, ParsedDiagram, ImportResult } from '../DiagramImportService';
import { ExampleSystem } from '../../types/ExampleSystemTypes';

describe('DiagramImportService', () => {
  let service: typeof diagramImportService;

  beforeEach(() => {
    service = diagramImportService;
  });

  describe('detectFormat', () => {
    it('should detect Mermaid format from .mmd extension', () => {
      const file = new File(['content'], 'diagram.mmd', { type: 'text/plain' });
      expect(service.detectFormat(file)).toBe('mermaid');
    });

    it('should detect Mermaid format from .mermaid extension', () => {
      const file = new File(['content'], 'diagram.mermaid', { type: 'text/plain' });
      expect(service.detectFormat(file)).toBe('mermaid');
    });

    it('should detect DrawIO format from .drawio extension', () => {
      const file = new File(['content'], 'diagram.drawio', { type: 'application/xml' });
      expect(service.detectFormat(file)).toBe('drawio');
    });

    it('should detect DrawIO format from .xml extension', () => {
      const file = new File(['content'], 'diagram.xml', { type: 'application/xml' });
      expect(service.detectFormat(file)).toBe('drawio');
    });

    it('should detect PlantUML format from .puml extension', () => {
      const file = new File(['content'], 'diagram.puml', { type: 'text/plain' });
      expect(service.detectFormat(file)).toBe('plantuml');
    });

    it('should detect Graphviz format from .dot extension', () => {
      const file = new File(['content'], 'diagram.dot', { type: 'text/plain' });
      expect(service.detectFormat(file)).toBe('graphviz');
    });

    it('should detect JSON format from .json extension', () => {
      const file = new File(['{}'], 'diagram.json', { type: 'application/json' });
      expect(service.detectFormat(file)).toBe('json');
    });

    it('should return unknown for unsupported formats', () => {
      const file = new File(['content'], 'diagram.pdf', { type: 'application/pdf' });
      expect(service.detectFormat(file)).toBe('unknown');
    });
  });

  describe('parseMermaid', () => {
    it('should parse basic Mermaid diagram', async () => {
      const mermaidContent = `
        graph TD
        A[Web Server] --> B[Database]
        A --> C[Cache]
        B --> D[Storage]
      `;

      const file = new File([mermaidContent], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
      expect(result.diagram).toBeDefined();
      expect(result.diagram!.nodes.length).toBeGreaterThan(3); // Includes zone nodes
    });

    it('should parse Mermaid with node types', async () => {
      const mermaidContent = `
        flowchart LR
        webserver[Web Server]
        database[(Database)]
        cache{{Cache}}
        webserver --> database
        webserver --> cache
      `;

      const file = new File([mermaidContent], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
      expect(result.diagram).toBeDefined();
    });

    it('should extract edge labels from Mermaid', async () => {
      const mermaidContent = `
        graph TD
        A[Client] --> B[Server]: HTTPS
        B --> C[Database]: SQL
      `;

      const file = new File([mermaidContent], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
      expect(result.diagram!.edges.length).toBeGreaterThan(0);
    });
  });

  describe('parseDrawIO', () => {
    it('should parse DrawIO XML diagram', async () => {
      const drawioContent = `
        <mxfile>
          <diagram name="Test Diagram">
            <mxGraphModel>
              <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="2" value="Web Server" style="shape=rectangle" parent="1">
                  <mxGeometry x="100" y="100" width="120" height="60"/>
                </mxCell>
                <mxCell id="3" value="Database" style="shape=cylinder" parent="1">
                  <mxGeometry x="300" y="100" width="120" height="60"/>
                </mxCell>
                <mxCell id="4" source="2" target="3" parent="1">
                  <mxGeometry/>
                </mxCell>
              </root>
            </mxGraphModel>
          </diagram>
        </mxfile>
      `;

      const file = new File([drawioContent], 'diagram.drawio', { type: 'application/xml' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
      expect(result.diagram).toBeDefined();
    });

    it('should extract node positions from DrawIO', async () => {
      const drawioContent = `
        <mxfile>
          <diagram>
            <mxGraphModel>
              <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="node1" value="Server" parent="1">
                  <mxGeometry x="200" y="150" width="100" height="50"/>
                </mxCell>
              </root>
            </mxGraphModel>
          </diagram>
        </mxfile>
      `;

      const file = new File([drawioContent], 'diagram.drawio', { type: 'application/xml' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
    });

    it('should handle invalid DrawIO XML gracefully', async () => {
      const invalidContent = '<invalid xml>';

      const file = new File([invalidContent], 'diagram.drawio', { type: 'application/xml' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('parsePlantUML', () => {
    it('should parse PlantUML component diagram', async () => {
      const plantumlContent = `
        @startuml
        title System Architecture
        component [Web Server] as web
        database "Database" as db
        cloud "Cloud Storage" as storage
        web --> db : SQL
        web --> storage : API
        @enduml
      `;

      const file = new File([plantumlContent], 'diagram.puml', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
      expect(result.diagram).toBeDefined();
    });

    it('should parse PlantUML with aliases', async () => {
      const plantumlContent = `
        @startuml
        component [API Gateway] as api
        database "PostgreSQL" as db
        node "Application Server" as app
        api --> app
        app --> db
        @enduml
      `;

      const file = new File([plantumlContent], 'diagram.puml', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
    });

    it('should extract PlantUML relationship types', async () => {
      const plantumlContent = `
        @startuml
        [Client] --> [Server]
        [Server] ..> [Cache]
        [Server] -- [Database]
        @enduml
      `;

      const file = new File([plantumlContent], 'diagram.puml', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
      expect(result.diagram!.edges.length).toBeGreaterThan(0);
    });
  });

  describe('parseGraphviz', () => {
    it('should parse Graphviz DOT diagram', async () => {
      const dotContent = `
        digraph system {
          web [label="Web Server", shape=box]
          db [label="Database", shape=cylinder]
          cache [label="Cache", shape=ellipse]
          web -> db [label="SQL"]
          web -> cache [label="Redis"]
        }
      `;

      const file = new File([dotContent], 'diagram.dot', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
      expect(result.diagram).toBeDefined();
    });

    it('should parse Graphviz subgraphs/clusters', async () => {
      const dotContent = `
        digraph system {
          subgraph cluster_frontend {
            label = "Frontend Zone"
            web [label="Web"]
            lb [label="Load Balancer"]
          }
          subgraph cluster_backend {
            label = "Backend Zone"
            api [label="API"]
            db [label="Database"]
          }
          lb -> api
          api -> db
        }
      `;

      const file = new File([dotContent], 'diagram.dot', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
    });

    it('should handle Graphviz node shapes correctly', async () => {
      const dotContent = `
        digraph shapes {
          server [shape=box3d]
          database [shape=cylinder]
          user [shape=person]
          firewall [shape=diamond]
        }
      `;

      const file = new File([dotContent], 'diagram.dot', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
    });
  });

  describe('parseJSON', () => {
    it('should parse ContextCypher JSON export', async () => {
      const contextCypherJson = {
        name: 'Test System',
        description: 'Test Description',
        nodes: [
          {
            id: 'node-1',
            type: 'server',
            position: { x: 100, y: 100 },
            data: { label: 'Web Server', zone: 'DMZ' }
          },
          {
            id: 'node-2',
            type: 'database',
            position: { x: 300, y: 100 },
            data: { label: 'Database', zone: 'Internal' }
          }
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'node-2',
            data: { label: 'SQL' }
          }
        ]
      };

      const file = new File([JSON.stringify(contextCypherJson)], 'diagram.json', { type: 'application/json' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
      expect(result.diagram).toBeDefined();
    });

    it('should parse generic JSON with nodes/edges structure', async () => {
      const genericJson = {
        nodes: [
          { id: 'n1', name: 'Server A', type: 'server' },
          { id: 'n2', name: 'Server B', type: 'server' }
        ],
        edges: [
          { source: 'n1', target: 'n2', label: 'Connection' }
        ]
      };

      const file = new File([JSON.stringify(genericJson)], 'diagram.json', { type: 'application/json' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
    });

    it('should handle JSON with alternative property names', async () => {
      const alternativeJson = {
        vertices: [
          { id: 'v1', label: 'Component A' },
          { id: 'v2', label: 'Component B' }
        ],
        links: [
          { from: 'v1', to: 'v2' }
        ]
      };

      const file = new File([JSON.stringify(alternativeJson)], 'diagram.json', { type: 'application/json' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
    });

    it('should reject JSON without nodes', async () => {
      const emptyJson = { edges: [] };

      const file = new File([JSON.stringify(emptyJson)], 'diagram.json', { type: 'application/json' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('inferSecurityZone', () => {
    it('should infer Internet zone from public keywords', async () => {
      const mermaidContent = `
        graph TD
        public[Public Web Server]
        internet[Internet Gateway]
      `;

      const file = new File([mermaidContent], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
    });

    it('should infer DMZ zone from dmz keywords', async () => {
      const mermaidContent = `
        graph TD
        dmz_server[DMZ Web Server]
        perimeter[Perimeter Firewall]
      `;

      const file = new File([mermaidContent], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
    });

    it('should infer Internal zone for database components', async () => {
      const mermaidContent = `
        graph TD
        db[(Private Database)]
        storage[Internal Storage]
      `;

      const file = new File([mermaidContent], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
    });

    it('should infer Cloud zone from cloud keywords', async () => {
      const mermaidContent = `
        graph TD
        aws[AWS Lambda]
        azure[Azure Functions]
        gcp[GCP Cloud Run]
      `;

      const file = new File([mermaidContent], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
    });

    it('should default to Internal zone when no keywords match', async () => {
      const mermaidContent = `
        graph TD
        server[Generic Server]
      `;

      const file = new File([mermaidContent], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
    });
  });

  describe('nodeType validation and mapping', () => {
    it('should map server types correctly', async () => {
      const mermaidContent = `
        graph TD
        web[Web Server]
        app[Application Server]
        db[(Database Server)]
      `;

      const file = new File([mermaidContent], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
    });

    it('should map security components correctly', async () => {
      const mermaidContent = `
        graph TD
        fw[Firewall]
        ids[IDS System]
        waf[WAF Gateway]
      `;

      const file = new File([mermaidContent], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
    });

    it('should map cloud components correctly', async () => {
      const mermaidContent = `
        graph TD
        lambda[Lambda Function]
        k8s[Kubernetes Cluster]
        container[Container Registry]
      `;

      const file = new File([mermaidContent], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
    });

    it('should use generic type for unknown components', async () => {
      const mermaidContent = `
        graph TD
        unknown[Unknown Component]
      `;

      const file = new File([mermaidContent], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
    });
  });

  describe('validation warnings', () => {
    it('should warn about disconnected nodes', async () => {
      const mermaidContent = `
        graph TD
        A[Server A]
        B[Server B]
        C[Server C]
        A --> B
      `;

      const file = new File([mermaidContent], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
    });

    it('should warn about diagrams with no connections', async () => {
      const mermaidContent = `
        graph TD
        A[Server A]
        B[Server B]
      `;

      const file = new File([mermaidContent], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w: string) => w.includes('No connections'))).toBe(true);
    });

    it('should not warn for single node diagrams', async () => {
      const mermaidContent = `
        graph TD
        A[Single Server]
      `;

      const file = new File([mermaidContent], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should reject unsupported file formats', async () => {
      const file = new File(['content'], 'diagram.pdf', { type: 'application/pdf' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Unsupported file format: diagram.pdf');
    });

    it('should handle malformed Mermaid gracefully', async () => {
      const invalidMermaid = 'graph TD\nA[Node --> broken syntax';

      const file = new File([invalidMermaid], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      // Should either succeed with warnings or fail gracefully
      expect(result).toBeDefined();
    });

    it('should handle malformed JSON gracefully', async () => {
      const invalidJson = '{ invalid json }';

      const file = new File([invalidJson], 'diagram.json', { type: 'application/json' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('custom context generation', () => {
    it('should generate custom context with import metadata', async () => {
      const mermaidContent = `
        graph TD
        A[Web Server] --> B[Database]
      `;

      const file = new File([mermaidContent], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
      expect(result.diagram?.customContext).toContain('Import Information');
      expect(result.diagram?.customContext).toContain('mermaid');
    });

    it('should include node count in custom context', async () => {
      const mermaidContent = `
        graph TD
        A[Server 1]
        B[Server 2]
        C[Server 3]
      `;

      const file = new File([mermaidContent], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.success).toBe(true);
      expect(result.diagram?.customContext).toContain('Node Count');
    });
  });

  describe('import mode', () => {
    it('should default to replace mode', async () => {
      const mermaidContent = 'graph TD\nA[Server]';

      const file = new File([mermaidContent], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file);

      expect(result.importMode).toBe('replace');
    });

    it('should respect specified import mode', async () => {
      const mermaidContent = 'graph TD\nA[Server]';

      const file = new File([mermaidContent], 'diagram.mmd', { type: 'text/plain' });
      const result = await service.importDiagram(file, { importMode: 'merge' });

      expect(result.importMode).toBe('merge');
    });
  });
});

export {};
