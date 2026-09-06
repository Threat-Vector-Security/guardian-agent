/**
 * DiagramImportService - Converts various diagram formats to ContextCypher format
 * 
 * Supported formats:
 * - Mermaid (.mmd, .mermaid)
 * - DrawIO/Diagrams.net (.drawio, .xml)
 * - PlantUML (.puml, .plantuml)
 * - Lucidchart CSV export (.csv)
 * - Microsoft Visio (.vsdx)
 * - Graphviz DOT (.dot, .gv)
 * - JSON (.json) - Generic JSON or ContextCypher export
 */

import { ExampleSystem, SystemCategory } from '../types/ExampleSystemTypes';
import { SecurityNode, SecurityEdge, SecurityZone, DataClassification, securityZones } from '../types/SecurityTypes';
import { generateSecuritySystem } from '../utils/systemGenerator';
import { connectionManager } from './ConnectionManager';
import { cloudServiceDiscoveryService } from './cloud/CloudServiceDiscoveryService';
import { CloudCredentials, CloudResourceFilters, CloudDiscoveryProgress } from '../types/CloudTypes';
import { isCloudDiscoveryEnabled } from '../utils/environment';
import { getFrontendAppSecret } from '../utils/appSecret';

export type DiagramFormat =
  | 'mermaid'
  | 'drawio'
  | 'plantuml'
  | 'lucidchart'
  | 'visio'
  | 'graphviz'
  | 'json'
  | 'cloud'
  | 'unknown';

export interface ImportResult {
  success: boolean;
  diagram?: ExampleSystem;
  warnings?: string[];
  errors?: string[];
  importMode?: ImportMode;
}

export type ImportMode = 'replace' | 'merge';

export interface ImportOptions {
  method?: 'local' | 'ai';
  aiProvider?: string;
  sanitizeData?: boolean;
  importMode?: ImportMode;
}

export interface ParsedNode {
  id: string;
  label: string;
  type?: string;
  properties?: Record<string, any>;
  x?: number;
  y?: number;
}

export interface ParsedEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  properties?: Record<string, any>;
}

export interface ParsedDiagram {
  nodes: ParsedNode[];
  edges: ParsedEdge[];
  title?: string;
  description?: string;
  metadata?: Record<string, any>;
}

// Node type mapping configuration
const NODE_TYPE_MAPPINGS: Record<string, Record<string, string>> = {
  mermaid: {
    'database': 'database',
    'server': 'server',
    'user': 'user',
    'cloud': 'cloudService',
    'api': 'api',
    'web': 'webServer',
    'app': 'application',
    'firewall': 'firewall',
    'loadbalancer': 'loadBalancer',
    'cache': 'cache'
  },
  drawio: {
    'mxgraph.aws.compute.ec2': 'server',
    'mxgraph.aws.database.rds': 'database',
    'mxgraph.aws.storage.s3': 'storage',
    'mxgraph.azure.compute.vm': 'server',
    'mxgraph.azure.databases.sql_database': 'database',
    'mxgraph.network.firewall': 'firewall',
    'mxgraph.network.load_balancer': 'loadBalancer'
  },
  plantuml: {
    'database': 'database',
    'node': 'server',
    'component': 'application',
    'interface': 'api',
    'cloud': 'cloudService',
    'storage': 'storage',
    'queue': 'messageBroker'
  }
};

// Security zone inference rules
const ZONE_INFERENCE_RULES: Array<{
  pattern: RegExp;
  zone: SecurityZone;
}> = [
  { pattern: /internet|external|public|outside/i, zone: 'Internet' },
  { pattern: /dmz|perimeter/i, zone: 'DMZ' },
  { pattern: /internal|private|inside/i, zone: 'Internal' },
  { pattern: /trusted|secure/i, zone: 'Trusted' },
  { pattern: /restricted|sensitive/i, zone: 'Restricted' },
  { pattern: /critical|core/i, zone: 'Critical' },
  { pattern: /development|dev/i, zone: 'Development' },
  { pattern: /staging|stage|test/i, zone: 'Staging' },
  { pattern: /production|prod/i, zone: 'Production' },
  { pattern: /cloud|aws|azure|gcp/i, zone: 'Cloud' },
  { pattern: /guest|visitor/i, zone: 'Guest' },
  { pattern: /compliance|audit/i, zone: 'Compliance' },
  { pattern: /ot|operational|industrial/i, zone: 'OT' }
];

class DiagramImportService {
  /**
   * Detect diagram format from file extension and content
   */
  detectFormat(file: File): DiagramFormat {
    const fileName = file.name.toLowerCase();
    const extension = fileName.split('.').pop() || '';

    // Check by extension
    if (['mmd', 'mermaid'].includes(extension)) return 'mermaid';
    if (['drawio', 'xml'].includes(extension)) return 'drawio';
    if (['puml', 'plantuml'].includes(extension)) return 'plantuml';
    if (extension === 'csv' && fileName.includes('lucidchart')) return 'lucidchart';
    if (extension === 'vsdx') return 'visio';
    if (['dot', 'gv'].includes(extension)) return 'graphviz';
    if (extension === 'json') return 'json';

    return 'unknown';
  }

  /**
   * Main import method
   */
  async importDiagram(file: File, options?: ImportOptions): Promise<ImportResult> {
    const format = this.detectFormat(file);
    
    if (format === 'unknown') {
      return {
        success: false,
        errors: [`Unsupported file format: ${file.name}`]
      };
    }

    try {
      // Use AI conversion if requested
      if (options?.method === 'ai') {
        const content = await file.text();
        return await this.importWithAI(content, format, options);
      }

      // Default local parsing
      let parsed: ParsedDiagram | null = null;
      
      if (format === 'visio') {
        // Binary format
        const buffer = await file.arrayBuffer();
        parsed = await this.parseVisio(buffer);
      } else {
        // Text-based formats
        const content = await file.text();
        
        switch (format) {
          case 'mermaid':
            parsed = this.parseMermaid(content);
            break;
          case 'drawio':
            parsed = this.parseDrawIO(content);
            break;
          case 'plantuml':
            parsed = this.parsePlantUML(content);
            break;
          case 'lucidchart':
            parsed = this.parseLucidchartCSV(content);
            break;
          case 'graphviz':
            parsed = this.parseGraphviz(content);
            break;
          case 'json':
            parsed = this.parseJSON(content);
            break;
        }
      }

      if (!parsed) {
        return {
          success: false,
          errors: [`Failed to parse ${format} diagram`]
        };
      }

      const diagram = this.convertToSystemDiagram(parsed, format);

      return {
        success: true,
        diagram,
        warnings: this.validateDiagram(diagram),
        importMode: options?.importMode || 'replace'
      };

    } catch (error) {
      return {
        success: false,
        errors: [`Import error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Parse Mermaid diagram
   */
  private parseMermaid(content: string): ParsedDiagram | null {
    const nodes: ParsedNode[] = [];
    const edges: ParsedEdge[] = [];
    const nodeMap = new Map<string, ParsedNode>();

    try {
      const lines = content.split('\n').map(l => l.trim()).filter(l => l);
      let title = '';

      for (const line of lines) {
        // Extract title
        if (line.startsWith('graph') || line.startsWith('flowchart')) {
          const match = line.match(/^(?:graph|flowchart)\s+\w+\s*(.*)$/);
          if (match) title = match[1];
          continue;
        }

        // Skip comments and directives
        if (line.startsWith('%%') || line.startsWith('classDef')) continue;

        // Parse node definitions (id[label] or id(label) or id{label})
        const nodeMatch = line.match(/^(\w+)[\[({]([^\])}\n]+)[\])}](.*)$/);
        if (nodeMatch) {
          const [, id, label, rest] = nodeMatch;
          const node: ParsedNode = {
            id,
            label: label.trim(),
            type: this.inferNodeTypeFromLabel(label)
          };
          
          // Check for inline properties
          if (rest.includes(':::')) {
            const classMatch = rest.match(/:::(\w+)/);
            if (classMatch) {
              node.properties = { class: classMatch[1] };
            }
          }
          
          nodes.push(node);
          nodeMap.set(id, node);
          continue;
        }

        // Parse edges (A --> B or A --- B or A -.-> B etc.)
        const edgeMatch = line.match(/^(\w+)\s*([-\.]+>?)\s*(\w+)(?:\s*:\s*(.+))?$/);
        if (edgeMatch) {
          const [, source, , target, label] = edgeMatch;
          edges.push({
            id: `${source}-${target}`,
            source,
            target,
            label: label?.trim()
          });
        }
      }

      return {
        nodes,
        edges,
        title: title || 'Imported Mermaid Diagram',
        metadata: { format: 'mermaid' }
      };

    } catch (error) {
      console.error('Mermaid parsing error:', error);
      return null;
    }
  }

  /**
   * Parse DrawIO/Diagrams.net XML
   */
  private parseDrawIO(content: string): ParsedDiagram | null {
    const nodes: ParsedNode[] = [];
    const edges: ParsedEdge[] = [];
    let title = 'Imported DrawIO Diagram';

    try {
      // Parse XML content
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(content, 'text/xml');
      
      // Check for parsing errors
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('Invalid XML format');
      }

      // Find diagram name if available
      const diagramElement = xmlDoc.querySelector('diagram');
      if (diagramElement) {
        title = diagramElement.getAttribute('name') || title;
      }

      // Find all cells (both nodes and edges)
      const cells = xmlDoc.querySelectorAll('mxCell');
      const nodeMap = new Map<string, ParsedNode>();
      
      // First pass: identify nodes
      cells.forEach((cell) => {
        const id = cell.getAttribute('id');
        const value = cell.getAttribute('value') || '';
        const style = cell.getAttribute('style') || '';
        const parent = cell.getAttribute('parent');
        
        // Skip the root cells (0 and 1)
        if (id === '0' || id === '1' || !id) return;
        
        // Check if it's a node (has geometry and value)
        const geometry = cell.querySelector('mxGeometry');
        if (geometry && value && parent === '1') {
          const node: ParsedNode = {
            id,
            label: value,
            type: this.inferNodeTypeFromDrawIO(value, style),
            properties: {
              style,
              x: geometry.getAttribute('x') || '0',
              y: geometry.getAttribute('y') || '0',
              width: geometry.getAttribute('width') || '120',
              height: geometry.getAttribute('height') || '60'
            }
          };
          
          nodes.push(node);
          nodeMap.set(id, node);
        }
      });
      
      // Second pass: identify edges
      cells.forEach((cell) => {
        const id = cell.getAttribute('id');
        const source = cell.getAttribute('source');
        const target = cell.getAttribute('target');
        const value = cell.getAttribute('value') || '';
        
        if (id && source && target && nodeMap.has(source) && nodeMap.has(target)) {
          edges.push({
            id,
            source,
            target,
            label: value || undefined
          });
        }
      });

      return nodes.length > 0 ? {
        nodes,
        edges,
        title,
        metadata: { format: 'drawio' }
      } : null;

    } catch (error) {
      console.error('DrawIO parsing error:', error);
      return null;
    }
  }

  /**
   * Infer node type from DrawIO style and value
   */
  private inferNodeTypeFromDrawIO(value: string, style: string): string {
    const lowerValue = value.toLowerCase();
    const lowerStyle = style.toLowerCase();
    
    // Check style attributes
    if (lowerStyle.includes('shape=cylinder') || lowerStyle.includes('database')) {
      return 'database';
    }
    if (lowerStyle.includes('shape=actor')) {
      return 'user';
    }
    if (lowerStyle.includes('shape=cloud')) {
      return 'cloud';
    }
    if (lowerStyle.includes('shape=hexagon')) {
      return 'process';
    }
    
    // Use label inference as fallback
    return this.inferNodeTypeFromLabel(value);
  }

  /**
   * Parse PlantUML diagram
   */
  private parsePlantUML(content: string): ParsedDiagram | null {
    const nodes: ParsedNode[] = [];
    const edges: ParsedEdge[] = [];
    const nodeMap = new Map<string, ParsedNode>();
    let title = 'Imported PlantUML Diagram';

    try {
      const lines = content.split('\n').map(l => l.trim()).filter(l => l);
      
      for (const line of lines) {
        // Skip comments and directives
        if (line.startsWith("'") || line.startsWith('@startuml') || line.startsWith('@enduml')) {
          continue;
        }
        
        // Extract title
        if (line.startsWith('title ')) {
          title = line.substring(6).trim();
          continue;
        }
        
        // Parse component/node definitions
        // Formats: 
        // - component [Label] as Alias
        // - database "Label" as Alias
        // - node Label
        // - [Label]
        const componentMatch = line.match(/^(component|database|node|cloud|interface|package|rectangle|storage|queue|actor|boundary|control|entity)\s+(?:\[([^\]]+)\]|"([^"]+)"|(\w+))\s*(?:as\s+(\w+))?/);
        if (componentMatch) {
          const [, type, label1, label2, label3, alias] = componentMatch;
          const label = label1 || label2 || label3 || '';
          const id = alias || label.toLowerCase().replace(/\s+/g, '-');
          
          const node: ParsedNode = {
            id,
            label,
            type: this.mapPlantUMLType(type),
            properties: { plantUmlType: type }
          };
          
          nodes.push(node);
          nodeMap.set(id, node);
          continue;
        }
        
        // Parse simple component syntax [Label]
        const simpleMatch = line.match(/^\[([^\]]+)\]\s*(?:as\s+(\w+))?/);
        if (simpleMatch) {
          const [, label, alias] = simpleMatch;
          const id = alias || label.toLowerCase().replace(/\s+/g, '-');
          
          const node: ParsedNode = {
            id,
            label,
            type: this.inferNodeTypeFromLabel(label)
          };
          
          nodes.push(node);
          nodeMap.set(id, node);
          continue;
        }
        
        // Parse relationships
        // Formats: A --> B : Label
        //          A -> B
        //          A -- B
        //          A ..> B
        const relationMatch = line.match(/^(\w+|\[[^\]]+\])\s*(<?[-\.]+>?)\s*(\w+|\[[^\]]+\])(?:\s*:\s*(.+))?/);
        if (relationMatch) {
          const [, source, arrow, target, label] = relationMatch;
          
          // Clean up node references
          const sourceId = source.replace(/[\[\]]/g, '').toLowerCase().replace(/\s+/g, '-');
          const targetId = target.replace(/[\[\]]/g, '').toLowerCase().replace(/\s+/g, '-');
          
          // Create nodes if they don't exist
          if (!nodeMap.has(sourceId)) {
            const sourceNode: ParsedNode = {
              id: sourceId,
              label: source.replace(/[\[\]]/g, ''),
              type: 'generic'
            };
            nodes.push(sourceNode);
            nodeMap.set(sourceId, sourceNode);
          }
          
          if (!nodeMap.has(targetId)) {
            const targetNode: ParsedNode = {
              id: targetId,
              label: target.replace(/[\[\]]/g, ''),
              type: 'generic'
            };
            nodes.push(targetNode);
            nodeMap.set(targetId, targetNode);
          }
          
          edges.push({
            id: `${sourceId}-${targetId}`,
            source: sourceId,
            target: targetId,
            label: label?.trim(),
            properties: { arrowType: arrow }
          });
        }
      }
      
      return nodes.length > 0 ? {
        nodes,
        edges,
        title,
        metadata: { format: 'plantuml' }
      } : null;
      
    } catch (error) {
      console.error('PlantUML parsing error:', error);
      return null;
    }
  }

  /**
   * Map PlantUML types to ContextCypher types
   */
  private mapPlantUMLType(plantUmlType: string): string {
    const typeMap: Record<string, string> = {
      'database': 'database',
      'node': 'server',
      'cloud': 'cloud',
      'interface': 'api',
      'storage': 'storage',
      'queue': 'messagequeue',
      'actor': 'user',
      'boundary': 'firewall',
      'component': 'application',
      'package': 'application',
      'rectangle': 'generic'
    };
    
    return typeMap[plantUmlType.toLowerCase()] || 'generic';
  }

  /**
   * Parse Lucidchart CSV export
   */
  private parseLucidchartCSV(content: string): ParsedDiagram | null {
    // TODO: Implement Lucidchart CSV parsing
    console.warn('Lucidchart CSV parsing not yet implemented');
    return null;
  }

  /**
   * Parse Microsoft Visio VSDX
   */
  private async parseVisio(buffer: ArrayBuffer): Promise<ParsedDiagram | null> {
    // TODO: Implement Visio VSDX parsing (requires unzipping and XML parsing)
    console.warn('Visio parsing not yet implemented');
    return null;
  }

  /**
   * Parse Graphviz DOT format
   */
  private parseGraphviz(content: string): ParsedDiagram | null {
    const nodes: ParsedNode[] = [];
    const edges: ParsedEdge[] = [];
    const nodeMap = new Map<string, ParsedNode>();
    let title = 'Imported Graphviz Diagram';

    try {
      // Extract graph name if present
      const graphMatch = content.match(/(?:digraph|graph)\s+(\w+)/);
      if (graphMatch) {
        title = graphMatch[1];
      }

      // Remove comments
      const cleanContent = content
        .split('\n')
        .map(line => {
          const commentIndex = line.indexOf('//');
          return commentIndex >= 0 ? line.substring(0, commentIndex) : line;
        })
        .join('\n')
        .replace(/\/\*[\s\S]*?\*\//g, '');

      // Extract node definitions
      // Format: nodeName [label="Label", shape=box, ...]
      const nodeRegex = /(\w+)\s*\[([^\]]+)\]/g;
      let nodeMatch;
      
      while ((nodeMatch = nodeRegex.exec(cleanContent)) !== null) {
        const [, nodeId, attributes] = nodeMatch;
        
        // Parse attributes
        const attrs = this.parseGraphvizAttributes(attributes);
        const label = attrs.label || nodeId;
        const shape = attrs.shape || 'ellipse';
        
        const node: ParsedNode = {
          id: nodeId,
          label: label.replace(/"/g, ''),
          type: this.inferNodeTypeFromGraphvizShape(shape, label),
          properties: attrs
        };
        
        nodes.push(node);
        nodeMap.set(nodeId, node);
      }

      // Extract edge definitions
      // Formats: A -> B [label="text"]
      //          A -- B
      const edgeRegex = /(\w+)\s*(->|--)\s*(\w+)\s*(?:\[([^\]]+)\])?/g;
      let edgeMatch;
      
      while ((edgeMatch = edgeRegex.exec(cleanContent)) !== null) {
        const [, source, edgeType, target, attributes] = edgeMatch;
        
        // Create nodes if they don't exist
        if (!nodeMap.has(source)) {
          const sourceNode: ParsedNode = {
            id: source,
            label: source,
            type: 'generic'
          };
          nodes.push(sourceNode);
          nodeMap.set(source, sourceNode);
        }
        
        if (!nodeMap.has(target)) {
          const targetNode: ParsedNode = {
            id: target,
            label: target,
            type: 'generic'
          };
          nodes.push(targetNode);
          nodeMap.set(target, targetNode);
        }
        
        // Parse edge attributes
        const attrs = attributes ? this.parseGraphvizAttributes(attributes) : {};
        
        edges.push({
          id: `${source}-${target}`,
          source,
          target,
          label: attrs.label?.replace(/"/g, ''),
          properties: {
            ...attrs,
            directed: edgeType === '->'
          }
        });
      }

      // Extract subgraph/cluster information
      const clusterRegex = /subgraph\s+(cluster_\w+)\s*\{([^}]+)\}/g;
      let clusterMatch;
      
      while ((clusterMatch = clusterRegex.exec(cleanContent)) !== null) {
        const [, clusterId, clusterContent] = clusterMatch;
        
        // Extract cluster label
        const labelMatch = clusterContent.match(/label\s*=\s*"([^"]+)"/);
        const clusterLabel = labelMatch ? labelMatch[1] : clusterId;
        
        // Find nodes in this cluster
        const clusterNodeRegex = /(\w+)\s*(?:\[|;)/g;
        let clusterNodeMatch;
        
        while ((clusterNodeMatch = clusterNodeRegex.exec(clusterContent)) !== null) {
          const nodeId = clusterNodeMatch[1];
          if (nodeId !== 'label' && nodeMap.has(nodeId)) {
            const node = nodeMap.get(nodeId)!;
            node.properties = {
              ...node.properties,
              cluster: clusterId,
              clusterLabel
            };
          }
        }
      }

      return nodes.length > 0 ? {
        nodes,
        edges,
        title,
        metadata: { format: 'graphviz' }
      } : null;

    } catch (error) {
      console.error('Graphviz parsing error:', error);
      return null;
    }
  }

  /**
   * Parse Graphviz attribute string
   */
  private parseGraphvizAttributes(attrString: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    
    // Match key=value pairs
    const attrRegex = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^,\s]+))/g;
    let match;
    
    while ((match = attrRegex.exec(attrString)) !== null) {
      const [, key, quotedValue1, quotedValue2, unquotedValue] = match;
      attrs[key] = quotedValue1 || quotedValue2 || unquotedValue;
    }
    
    return attrs;
  }

  /**
   * Infer node type from Graphviz shape
   */
  private inferNodeTypeFromGraphvizShape(shape: string, label: string): string {
    const shapeMap: Record<string, string> = {
      'cylinder': 'database',
      'box3d': 'server',
      'component': 'application',
      'folder': 'storage',
      'doublecircle': 'loadbalancer',
      'diamond': 'firewall',
      'ellipse': 'generic',
      'box': 'generic',
      'record': 'database',
      'cloud': 'cloud',
      'person': 'user',
      'actor': 'user'
    };
    
    // Check shape first
    const mappedType = shapeMap[shape.toLowerCase()];
    if (mappedType && mappedType !== 'generic') {
      return mappedType;
    }
    
    // Fall back to label inference
    return this.inferNodeTypeFromLabel(label);
  }

  /**
   * Parse JSON format (generic JSON diagram or ContextCypher export)
   */
  private parseJSON(content: string): ParsedDiagram | null {
    try {
      const data = JSON.parse(content);
      
      // Check if it's already in ContextCypher format
      if (data.nodes && data.edges && Array.isArray(data.nodes) && Array.isArray(data.edges)) {
        // Handle ContextCypher format
        const nodes: ParsedNode[] = data.nodes
          .filter((n: any) => n.type !== 'securityZone')
          .map((n: any) => ({
            id: n.id,
            label: n.data?.label || n.label || n.id,
            type: n.type || 'generic',
            x: n.position?.x,
            y: n.position?.y,
            properties: {
              ...n.data,
              originalNode: n
            }
          }));
        
        const edges: ParsedEdge[] = data.edges.map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.data?.label || e.label,
          properties: {
            ...e.data,
            originalEdge: e
          }
        }));
        
        return {
          nodes,
          edges,
          title: data.name || data.title || 'Imported JSON Diagram',
          description: data.description,
          metadata: {
            format: 'json',
            originalFormat: 'contextcypher',
            ...data.metadata
          }
        };
      }
      
      // Handle generic JSON formats
      // Common patterns: { vertices/nodes, edges/links }
      const nodeKeys = ['nodes', 'vertices', 'elements', 'components'];
      const edgeKeys = ['edges', 'links', 'connections', 'relationships'];
      
      let nodes: ParsedNode[] = [];
      let edges: ParsedEdge[] = [];
      
      // Find nodes
      for (const key of nodeKeys) {
        if (data[key] && Array.isArray(data[key])) {
          nodes = data[key].map((n: any) => ({
            id: n.id || n.name || `node-${Math.random().toString(36).substr(2, 9)}`,
            label: n.label || n.name || n.title || n.id || 'Unnamed',
            type: n.type || n.kind || n.category || 'generic',
            x: n.x || n.position?.x || n.pos?.x,
            y: n.y || n.position?.y || n.pos?.y,
            properties: n
          }));
          break;
        }
      }
      
      // Find edges
      for (const key of edgeKeys) {
        if (data[key] && Array.isArray(data[key])) {
          edges = data[key].map((e: any) => ({
            id: e.id || `edge-${Math.random().toString(36).substr(2, 9)}`,
            source: e.source || e.from || e.start,
            target: e.target || e.to || e.end,
            label: e.label || e.name || e.type,
            properties: e
          }));
          break;
        }
      }
      
      // If no standard structure found, try to infer from the data
      if (nodes.length === 0 && edges.length === 0) {
        // Check if it's a flat array of objects
        if (Array.isArray(data)) {
          // Separate nodes and edges based on properties
          nodes = data
            .filter((item: any) => !item.source && !item.from && !item.target && !item.to)
            .map((n: any) => ({
              id: n.id || n.name || `node-${Math.random().toString(36).substr(2, 9)}`,
              label: n.label || n.name || n.title || 'Unnamed',
              type: n.type || 'generic',
              properties: n
            }));
          
          edges = data
            .filter((item: any) => (item.source || item.from) && (item.target || item.to))
            .map((e: any) => ({
              id: e.id || `edge-${Math.random().toString(36).substr(2, 9)}`,
              source: e.source || e.from,
              target: e.target || e.to,
              label: e.label || e.type,
              properties: e
            }));
        }
      }
      
      if (nodes.length === 0) {
        throw new Error('No nodes found in JSON structure');
      }
      
      return {
        nodes,
        edges,
        title: data.name || data.title || data.diagram || 'Imported JSON Diagram',
        description: data.description || data.summary,
        metadata: {
          format: 'json',
          originalStructure: Object.keys(data).join(', ')
        }
      };
      
    } catch (error) {
      console.error('JSON parsing error:', error);
      return null;
    }
  }

  /**
   * Convert parsed diagram to ContextCypher format
   */
  private convertToSystemDiagram(parsed: ParsedDiagram, format: DiagramFormat): ExampleSystem {
    const systemName = parsed.title || 'Imported Diagram';
    
    // First, organize nodes by zone
    const nodesByZone = new Map<string, ParsedNode[]>();
    parsed.nodes.forEach(node => {
      const zone = this.inferSecurityZone(node);
      if (!nodesByZone.has(zone)) {
        nodesByZone.set(zone, []);
      }
      nodesByZone.get(zone)!.push(node);
    });
    
    // Define zone layout constants from SystemGeneratorGuidelines
    const ZONE_WIDTH = 650;
    const ZONE_HEIGHT = 1000;
    const ZONE_SPACING = 170; // Increased for better separation
    const ZONE_START_X = 50;
    const ZONE_START_Y = 50;
    const GRID_SIZE = 50; // 50px grid
    const NODE_WIDTH = 150;
    const NODE_HEIGHT = 100;
    const NODE_SPACING_H = 250; // Horizontal spacing
    const NODE_SPACING_V = 200; // Vertical spacing
    const ZONE_PADDING = 100; // Padding inside zones
    
    // Convert nodes and create zones
    const nodes: SecurityNode[] = [];
    const zoneNodes: SecurityNode[] = [];
    let currentZoneIndex = 0;
    
    nodesByZone.forEach((zoneNodes, zone) => {
      if (zoneNodes.length === 0) return;
      
      // Create zone node
      const zoneX = ZONE_START_X + (currentZoneIndex * (ZONE_WIDTH + ZONE_SPACING));
      const zoneY = ZONE_START_Y;
      
      const zoneNode: SecurityNode = {
        id: `zone-${zone.toLowerCase()}`,
        type: 'securityZone',
        position: { x: zoneX, y: zoneY },
        data: {
          label: zone,
          zoneType: zone,
          description: `${zone} security zone`
        },
        style: {
          width: ZONE_WIDTH,
          height: ZONE_HEIGHT,
          zIndex: -1
        }
      } as SecurityNode;
      
      // Calculate nodes per row to fit within zone
      const maxNodesPerRow = Math.floor((ZONE_WIDTH - 2 * ZONE_PADDING) / NODE_SPACING_H) + 1;
      const nodesPerRow = Math.min(3, maxNodesPerRow);
      
      // Position nodes within zone with proper spacing
      zoneNodes.forEach((node, index) => {
        const row = Math.floor(index / nodesPerRow);
        const col = index % nodesPerRow;
        
        // Position within zone with grid alignment
        const x = zoneX + ZONE_PADDING + (col * NODE_SPACING_H);
        const y = zoneY + ZONE_PADDING + (row * NODE_SPACING_V);
        
        // Align to grid
        const gridAlignedX = Math.round(x / GRID_SIZE) * GRID_SIZE;
        const gridAlignedY = Math.round(y / GRID_SIZE) * GRID_SIZE;
        
        const mappedType = this.mapNodeType(node.type || 'generic', format);
        const nodeType = this.validateNodeType(mappedType);
        
        // Ensure we have all required properties for SecurityNodeData
        const nodeData: any = {
          label: node.label,
          zone,
          dataClassification: (node.properties?.dataClassification as DataClassification) || 'Internal' as DataClassification,
          description: node.properties?.description || '',
          protocols: node.properties?.protocols || [],
          securityControls: node.properties?.securityControls || [],
          // Map NodeEditor fields from properties
          vendor: node.properties?.vendor || '',
          product: node.properties?.product || '',
          version: node.properties?.version || '',
          technology: node.properties?.technology || '',
          patchLevel: node.properties?.patchLevel || '',
          components: node.properties?.components || [],
          // Map additional properties but filter out icon and already mapped fields
          ...Object.fromEntries(
            Object.entries(node.properties || {}).filter(([key]) => 
              !['icon', 'label', 'zone', 'dataClassification', 'description', 'protocols', 
               'securityControls', 'vendor', 'product', 'version', 'technology', 'patchLevel', 'components'].includes(key)
            )
          )
        };
        
        nodes.push({
          id: node.id,
          type: nodeType as any,
          position: { x: gridAlignedX, y: gridAlignedY },
          data: nodeData
        } as SecurityNode);
      });
      
      currentZoneIndex++;
    });

    // Convert edges with proper zone assignment
    const edges: SecurityEdge[] = parsed.edges.map(edge => {
      // Find source and target nodes to determine zones
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      // Determine edge zone based on target (more secure zone)
      let edgeZone = 'Internal' as SecurityZone;
      if (targetNode?.data?.zone) {
        edgeZone = targetNode.data.zone as SecurityZone;
      } else if (sourceNode?.data?.zone) {
        edgeZone = sourceNode.data.zone as SecurityZone;
      }
      
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'securityEdge',
        data: {
          label: edge.label || edge.properties?.label || '',
          zone: edgeZone,
          dataClassification: (edge.properties?.dataClassification as DataClassification) || 'Internal' as DataClassification,
          protocol: edge.properties?.protocol || '',
          encryption: edge.properties?.encryption || '',
          portRange: edge.properties?.portRange || '',
          bandwidth: edge.properties?.bandwidth || '',
          latency: edge.properties?.latency || '',
          redundancy: edge.properties?.redundancy,
          securityControls: edge.properties?.securityControls || [],
          description: edge.properties?.description || '',
          ...Object.fromEntries(
            Object.entries(edge.properties || {}).filter(([key]) => 
              !['icon', 'label', 'zone', 'dataClassification', 'protocol', 'encryption',
               'portRange', 'bandwidth', 'latency', 'redundancy', 'securityControls', 'description'].includes(key)
            )
          )
        }
      } as SecurityEdge;
    });

    // Recreate zone nodes to ensure they're in the correct order
    const finalZoneNodes: SecurityNode[] = [];
    currentZoneIndex = 0;
    nodesByZone.forEach((_, zone) => {
      const zoneX = ZONE_START_X + (currentZoneIndex * (ZONE_WIDTH + ZONE_SPACING));
      const zoneY = ZONE_START_Y;
      
      finalZoneNodes.push({
        id: `zone-${zone.toLowerCase()}`,
        type: 'securityZone',
        position: { x: zoneX, y: zoneY },
        data: {
          label: zone,
          zoneType: zone,
          description: `${zone} security zone`
        },
        style: {
          width: ZONE_WIDTH,
          height: ZONE_HEIGHT,
          zIndex: -1
        }
      } as SecurityNode);
      
      currentZoneIndex++;
    });
    
    return {
      id: `imported-${Date.now()}`,
      name: systemName,
      description: parsed.description || `Imported from ${format} format`,
      category: 'Enterprise Systems' as SystemCategory,
      primaryZone: 'Internal',
      dataClassification: 'Internal',
      customContext: this.generateCustomContext(parsed, format),
      nodes: [...finalZoneNodes, ...nodes],
      edges
    };
  }

  /**
   * Map source node type to ContextCypher node type
   */
  private mapNodeType(sourceType: string, format: DiagramFormat): string {
    const mappings = NODE_TYPE_MAPPINGS[format] || {};
    const mappedType = mappings[sourceType.toLowerCase()];
    
    if (mappedType) return mappedType;
    
    // Try to infer from common patterns
    const typePatterns: Array<[RegExp, string]> = [
      [/database|db|storage/i, 'database'],
      [/server|host|instance/i, 'server'],
      [/user|person|actor/i, 'user'],
      [/api|service|endpoint/i, 'api'],
      [/web|website|portal/i, 'webServer'],
      [/app|application/i, 'application'],
      [/firewall|fw/i, 'firewall'],
      [/load.*balance|lb/i, 'loadBalancer'],
      [/cache|redis|memcache/i, 'cache'],
      [/queue|mq|message/i, 'messageBroker']
    ];
    
    for (let i = 0; i < typePatterns.length; i++) {
      const [pattern, type] = typePatterns[i];
      if (pattern.test(sourceType)) return type;
    }
    
    return 'generic';
  }

  /**
   * Infer security zone from node properties
   */
  private inferSecurityZone(node: ParsedNode): SecurityZone {
    const checkString = `${node.label} ${node.type || ''} ${JSON.stringify(node.properties || {})}`.toLowerCase();
    
    for (let i = 0; i < ZONE_INFERENCE_RULES.length; i++) {
      const rule = ZONE_INFERENCE_RULES[i];
      if (rule.pattern.test(checkString)) {
        return rule.zone;
      }
    }
    
    return 'Internal'; // Default zone
  }

  /**
   * Infer node type from label
   */
  private inferNodeTypeFromLabel(label: string): string {
    const labelLower = label.toLowerCase();
    
    // Infrastructure types
    if (labelLower.includes('server')) return 'server';
    if (labelLower.includes('workstation') || labelLower.includes('desktop')) return 'workstation';
    if (labelLower.includes('laptop')) return 'laptop';
    if (labelLower.includes('endpoint')) return 'endpoint';
    if (labelLower.includes('router')) return 'router';
    if (labelLower.includes('switch')) return 'switch';
    if (labelLower.includes('gateway')) return 'gateway';
    if (labelLower.includes('dns')) return 'dns';
    if (labelLower.includes('dhcp')) return 'dhcp';
    if (labelLower.includes('printer')) return 'printer';
    
    // Application types
    if (labelLower.includes('database') || labelLower.includes('db')) return 'database';
    if (labelLower.includes('api')) return 'api';
    if (labelLower.includes('web')) return 'webServer';
    if (labelLower.includes('app') || labelLower.includes('application')) return 'application';
    if (labelLower.includes('service')) return 'service';
    if (labelLower.includes('cache')) return 'cache';
    if (labelLower.includes('storage')) return 'storage';
    if (labelLower.includes('auth')) return 'authServer';
    if (labelLower.includes('message') || labelLower.includes('broker')) return 'messageBroker';
    if (labelLower.includes('vault')) return 'vault';
    
    // Security types
    if (labelLower.includes('firewall')) return 'firewall';
    if (labelLower.includes('load') && labelLower.includes('balance')) return 'loadBalancer';
    if (labelLower.includes('proxy')) return 'proxy';
    if (labelLower.includes('waf')) return 'waf';
    if (labelLower.includes('ids') || labelLower.includes('intrusion detection')) return 'ids';
    if (labelLower.includes('ips') || labelLower.includes('intrusion prevention')) return 'ips';
    if (labelLower.includes('siem')) return 'siem';
    if (labelLower.includes('vpn')) return 'vpnGateway';
    
    // Cloud types
    if (labelLower.includes('cloud')) return 'cloudService';
    if (labelLower.includes('kubernetes') || labelLower.includes('k8s')) return 'kubernetesService';
    if (labelLower.includes('container')) return 'containerRegistry';
    if (labelLower.includes('function')) return 'functionApp';
    
    // User types
    if (labelLower.includes('user') || labelLower.includes('client') || labelLower.includes('person')) return 'user';
    
    // Default to generic
    return 'generic';
  }

  /**
   * Validate and normalize node type to ensure it exists in our type system
   */
  private validateNodeType(type: string): string {
    // Define all valid node types (excluding DFD nodes which are for manual threat modeling only)
    const validNodeTypes = new Set<string>([
      // Infrastructure types
      'server', 'workstation', 'endpoint', 'desktop', 'laptop', 'tablet', 'smartphone',
      'printer', 'router', 'user', 'switch', 'coreRouter', 'edgeRouter', 'accessPoint',
      'wirelessController', 'gateway', 'modem', 'networkBridge', 'networkHub', 'dns',
      'dhcp', 'ntpServer', 'proxyCache', 'voipPhone', 'pbx', 'sipServer', 'conferenceSystem',
      'san', 'nas', 'storageArray', 'tapeLibrary', 'ups', 'pdu', 'hvac', 'rackServer',
      'bladeServer', 'loadBalancerHw', 'wanOptimizer', 'networkProbe', 'packetBroker',
      'fiberTerminal', 'multiplexer', 'mediaConverter', 'terminalServer', 'cellTower',
      'wirelessBridge', 'meshNode', 'repeater', 'edgeServer', 'fogNode', 'microDatacenter',
      'kvm', 'serialConsole', 'timeClock', 'environmentSensor', 'thinClient',
      'virtualDesktopHost', 'sdwanGateway',
      
      // Security types
      'firewall', 'vpnGateway', 'ids', 'ips', 'waf', 'proxy', 'reverseProxy', 'monitor',
      'siem', 'soar', 'xdr', 'edr', 'ndr', 'casb', 'sase', 'ztna', 'dlp', 'dam', 'pam',
      'hsm', 'kms', 'secretsManager', 'certificateAuthority', 'mfa', 'sso', 'ldap',
      'radiusServer', 'honeypot', 'honeynet', 'deceptionSystem', 'networkTap',
      'packetCapture', 'vulnerabilityScanner', 'patchManagement', 'configManagement',
      'complianceScanner', 'penTestTool', 'staticAnalysis', 'dynamicAnalysis',
      'containerScanner', 'k8sAdmissionController', 'meshProxy', 'apiSecurity',
      'botProtection', 'ddosProtection', 'emailSecurity', 'webFilter', 'sandboxAnalyzer',
      'threatIntelPlatform', 'forensicsStation', 'incidentResponsePlatform', 'backupSystem',
      'disasterRecovery', 'encryptionGateway', 'tokenizer', 'riskAnalytics',
      'identityGovernance', 'cloudSecurityPosture', 'workloadProtection', 'runtimeProtection',
      'supplychainSecurity', 'codeRepository', 'cicdSecurity', 'secretScanner', 'sbom',
      'dependencyScanner', 'infrastructureAsCode', 'policyAsCode', 'cloudAccessBroker',
      'remoteAccessGateway', 'bastionHost', 'jumpServer', 'aiSecurityGateway',
      'quantumKeyDistribution', 'blockchainSecurity', 'otSecurityGateway', 'iotSecurityGateway',
      'physicalAccessControl', 'videoSurveillance', 'securityOrchestrator',
      'applicationDeliveryController', 'identityProvider',
      
      // Application types
      'application', 'database', 'loadBalancer', 'apiGateway', 'webServer', 'authServer',
      'messageBroker', 'api', 'service', 'containerizedService', 'cache', 'storage',
      'vault', 'identity', 'logging', 'kernelModule', 'deviceDriver', 'hypervisor',
      'firmware', 'secureEnclave', 'tpm', 'microcode',
      
      // Cloud types
      'cloudService', 'containerRegistry', 'kubernetesPod', 'kubernetesService',
      'storageAccount', 'functionApp', 'apiManagement', 'cloudLoadBalancer',
      'cloudFirewall', 'cloudDatabase', 'search',
      
      // OT types
      'plc', 'hmi', 'historian', 'rtu', 'sensor', 'actuator', 'scadaServer',
      'industrialFirewall', 'safetySystem', 'industrialNetwork',
      
      // AI types
      'aiModel', 'llmService', 'mlPipeline', 'aiGateway', 'vectorDatabase',
      'modelRegistry', 'inferenceEngine', 'aiWorkbench', 'dataLake', 'featureStore',
      'ai', 'mlInference', 'notebookServer', 'computeCluster', 'modelVault',
      'securityScanner',
      
      // Cybercrime types
      'fraudDetection', 'transactionMonitor', 'antiMalware', 'honeypot', 'threatFeed',
      'sandboxEnv', 'forensicsWorkstation', 'incidentResponse', 'cyberInsurance',
      'fraudAnalytics',
      
      // Privacy types
      'dataClassifier', 'consentManager', 'dataMapper', 'privacyScanner',
      'dataRetention', 'dataAnonymizer', 'gdprCompliance', 'dataBreach',
      'privacyImpact', 'dataSubjectRights',
      
      // AppSec types
      'memoryPool', 'executionContext', 'sessionStore', 'inputBuffer', 'outputBuffer',
      'configManager', 'cryptoModule', 'tokenValidator', 'permissionEngine', 'auditLogger',
      
      // RedTeam types
      'attackBox', 'payloadServer', 'c2Server', 'implant', 'phishingServer',
      'exfilChannel', 'pivotPoint', 'credentialHarvester', 'lateralMovement',
      'persistenceMechanism',
      
      // SecOps types
      'socWorkstation', 'threatHuntingPlatform', 'ctiFeed', 'attackSurfaceMonitor',
      'deceptionToken', 'behaviorAnalytics', 'networkForensics', 'malwareRepository',
      'indicatorStore', 'playbookEngine',
      
      // Generic fallback
      'generic'
    ]);
    
    // Skip DFD node types - they're for manual threat modeling only
    if (type.startsWith('dfd')) {
      console.warn(`DFD node type "${type}" detected during import - converting to generic. DFD nodes are for manual threat modeling only.`);
      return 'generic';
    }
    
    // If the type is valid, return it
    if (validNodeTypes.has(type)) {
      return type;
    }
    
    // Try to infer from the type string
    const inferred = this.inferNodeTypeFromLabel(type);
    if (validNodeTypes.has(inferred)) {
      return inferred;
    }
    
    // Default to generic
    console.warn(`Unknown node type "${type}" - defaulting to generic`);
    return 'generic';
  }


  /**
   * Generate custom context for the imported diagram
   */
  private generateCustomContext(parsed: ParsedDiagram, format: DiagramFormat): string {
    return `# ${parsed.title || 'Imported System'}

## Import Information
- **Source Format**: ${format}
- **Import Date**: ${new Date().toISOString()}
- **Node Count**: ${parsed.nodes.length}
- **Connection Count**: ${parsed.edges.length}

## System Overview
${parsed.description || 'This system was imported from an external diagram format.'}

## Components
${parsed.nodes.map(node => `- **${node.label}**: ${node.type || 'Component'}`).join('\n')}

## Notes
- Security zones have been automatically inferred based on component names and types
- Node types have been mapped to the closest matching ContextCypher types
- Manual review and adjustment may be required for accurate threat modeling
`;
  }

  /**
   * Validate the imported diagram
   */
  private validateDiagram(diagram: ExampleSystem): string[] {
    const warnings: string[] = [];
    
    // Filter out zone nodes from validation
    const nonZoneNodes = diagram.nodes.filter(n => n.type !== 'securityZone');
    
    // Only warn about disconnected nodes if there are edges in the diagram
    if (diagram.edges.length > 0) {
      const connectedNodes = new Set<string>();
      for (const edge of diagram.edges) {
        connectedNodes.add(edge.source);
        connectedNodes.add(edge.target);
      }
      
      const disconnected = nonZoneNodes
        .filter(n => !connectedNodes.has(n.id))
        .map(n => (n.data as any).label);
      
      // Only warn if disconnected nodes represent more than 30% of nodes
      if (disconnected.length > 0 && disconnected.length / nonZoneNodes.length > 0.3) {
        warnings.push(`${disconnected.length} disconnected nodes found. Consider adding connections or reviewing the import.`);
      }
    } else if (nonZoneNodes.length > 1) {
      // Only warn about no connections if there are multiple nodes
      warnings.push('No connections found in the diagram. You may want to add connections manually.');
    }
    
    // Check for missing zones
    const nodesWithoutZones = nonZoneNodes
      .filter(n => !(n.data as any).zone)
      .map(n => (n.data as any).label);
    
    if (nodesWithoutZones.length > 0) {
      warnings.push(`${nodesWithoutZones.length} nodes without security zones. Default zone applied.`);
    }
    
    // Check for missing data classification
    const nodesWithoutClassification = nonZoneNodes
      .filter(n => !(n.data as any).dataClassification)
      .map(n => (n.data as any).label);
    
    if (nodesWithoutClassification.length > 0) {
      warnings.push(`${nodesWithoutClassification.length} nodes without data classification. Default classification applied.`);
    }
    
    return warnings;
  }

  /**
   * Import diagram using AI conversion
   */
  private async importWithAI(
    content: string, 
    format: DiagramFormat, 
    options: ImportOptions
  ): Promise<ImportResult> {
    try {
      // Sanitize content if requested
      const processedContent = options.sanitizeData ? 
        this.sanitizeContent(content) : content;

      // Prepare the AI prompt
      const prompt = this.buildAIConversionPrompt(format, processedContent);

      // Call the AI service through the backend using ConnectionManager
      const serverUrl = await connectionManager.getServerUrl();
      const appSecret = getFrontendAppSecret();
      const response = await fetch(`${serverUrl}/api/convert-diagram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Secret': appSecret
        },
        body: JSON.stringify({
          format,
          content: processedContent,
          prompt,
          provider: options.aiProvider
        })
      });

      if (!response.ok) {
        throw new Error(`AI conversion failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success || result.error) {
        return {
          success: false,
          errors: [`AI conversion error: ${result.error || 'Unknown error'}`]
        };
      }

      // Parse the AI response into our diagram format
      const parsedDiagram = this.parseAIResponse(result.diagram);
      
      if (!parsedDiagram) {
        return {
          success: false,
          errors: ['Failed to parse AI-generated diagram structure']
        };
      }

      const diagram = this.convertToSystemDiagram(parsedDiagram, format);

      return {
        success: true,
        diagram,
        warnings: [
          'Diagram converted using AI - please review for accuracy',
          ...this.validateDiagram(diagram)
        ],
        importMode: options.importMode || 'replace'
      };

    } catch (error) {
      return {
        success: false,
        errors: [`AI conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Sanitize content to remove sensitive information
   */
  private sanitizeContent(content: string): string {
    return content
      .replace(/\b(?:[A-Z][a-z]+)+(?:Corp|Inc|LLC|Ltd|Company|Services|Systems)\b/g, '[Company Name]')
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP Address]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[Email]')
      .replace(/\bhttps?:\/\/[^\s]+\b/g, '[URL]')
      .replace(/\b(?:api|app|web|db|cache|auth)-[a-zA-Z0-9-]+\b/gi, (match) => {
        const prefix = match.split('-')[0];
        return `[${prefix}-instance]`;
      });
  }

  /**
   * Build AI conversion prompt based on format
   */
  private buildAIConversionPrompt(format: DiagramFormat, content: string): string {
    return `Convert the following ${format} diagram into a ContextCypher security-focused diagram format.

Extract all nodes (systems, services, components) and their connections.
Identify security zones (Internet, DMZ, Internal, etc.) based on context.
Detect component types (server, database, firewall, api, etc.).
Preserve all labels, descriptions, and metadata.

Input diagram:
${content}

Output a JSON structure with:
{
  "nodes": [
    {
      "id": "unique_id",
      "label": "node label",
      "type": "detected type",
      "zone": "security zone",
      "properties": {}
    }
  ],
  "edges": [
    {
      "id": "unique_id", 
      "source": "source_node_id",
      "target": "target_node_id",
      "label": "connection label",
      "properties": {}
    }
  ]
}`;
  }

  /**
   * Parse AI response into ParsedDiagram
   */
  private parseAIResponse(aiDiagram: any): ParsedDiagram | null {
    try {
      if (!aiDiagram || !aiDiagram.nodes || !aiDiagram.edges) {
        return null;
      }

      return {
        nodes: aiDiagram.nodes.map((n: any) => ({
          id: n.id || this.generateId(),
          label: n.label || 'Unknown',
          type: n.type,
          properties: {
            ...n.properties,
            zone: n.zone,
            dataClassification: n.dataClassification
          }
        })),
        edges: aiDiagram.edges.map((e: any) => ({
          id: e.id || this.generateId(),
          source: e.source,
          target: e.target,
          label: e.label,
          properties: e.properties
        })),
        title: aiDiagram.title,
        description: aiDiagram.description,
        metadata: aiDiagram.metadata
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return null;
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Import diagram from cloud service discovery
   */
  async importFromCloud(
    credentials: CloudCredentials,
    filters?: CloudResourceFilters,
    onProgress?: (progress: CloudDiscoveryProgress) => void,
    importMode: ImportMode = 'replace'
  ): Promise<ImportResult> {
    if (!isCloudDiscoveryEnabled()) {
      return {
        success: false,
        errors: ['Cloud discovery is currently disabled']
      };
    }

    try {
      const diagram = await cloudServiceDiscoveryService.discoverAndConvert({
        credentials,
        filters,
        onProgress
      });

      if (!diagram) {
        return {
          success: false,
          errors: ['Cloud discovery failed to generate diagram']
        };
      }

      return {
        success: true,
        diagram,
        warnings: this.validateDiagram(diagram),
        importMode
      };

    } catch (error) {
      return {
        success: false,
        errors: [`Cloud import failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Cancel ongoing cloud discovery
   */
  cancelCloudDiscovery(): void {
    cloudServiceDiscoveryService.cancel();
  }

  /**
   * Get cloud resource mapping coverage statistics
   */
  getCloudCoverageStats() {
    return cloudServiceDiscoveryService.getCoverageStats();
  }
}

export const diagramImportService = new DiagramImportService();
