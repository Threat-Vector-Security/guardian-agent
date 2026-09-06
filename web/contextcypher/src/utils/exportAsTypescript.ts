import { SecurityNode, SecurityEdge, SecurityZone } from '../types/SecurityTypes';
import { DiagramAttackPath } from '../types/GrcTypes';

interface ExportOptions {
  systemName: string;
  nodes: SecurityNode[];
  edges: SecurityEdge[];
  attackPaths?: DiagramAttackPath[];
}

const ZONE_TYPES = new Set([
  'Internet', 'External', 'DMZ', 'Internal', 'Trusted', 'Restricted',
  'Critical', 'OT', 'Development', 'Staging', 'Production', 'Cloud',
  'Guest', 'Compliance', 'Management'
]);

function toVarName(systemName: string): string {
  return systemName
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function indent(level: number): string {
  return '  '.repeat(level);
}

function stringLiteral(val: unknown): string {
  if (val === undefined || val === null) return 'undefined';
  if (typeof val === 'string') return `'${val.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return String(val);
}

function needsZoneCast(val: string): boolean {
  return ZONE_TYPES.has(val);
}

function formatControlPoints(points: Array<{ id: string; x: number; y: number; active?: boolean }>): string {
  if (!points || points.length === 0) return '[]';
  const entries = points.map(cp => {
    const parts = [`id: '${cp.id}'`, `x: ${cp.x}`, `y: ${cp.y}`];
    if (cp.active !== undefined) parts.push(`active: ${cp.active}`);
    return `{ ${parts.join(', ')} }`;
  });
  if (entries.join(', ').length < 100) {
    return `[${entries.join(', ')}]`;
  }
  return `[\n${indent(5)}${entries.join(`,\n${indent(5)}`)}\n${indent(4)}]`;
}

function formatStringArray(arr: string[]): string {
  if (!arr || arr.length === 0) return '[]';
  return `[${arr.map(s => `'${s}'`).join(', ')}]`;
}

function formatComponentArray(arr: Array<{ name: string; version: string }>): string {
  if (!arr || arr.length === 0) return '[]';
  const lines = arr.map(c => `${indent(5)}{ name: '${c.name}', version: '${c.version}' }`);
  return `[\n${lines.join(',\n')}\n${indent(4)}]`;
}

function formatNodeData(data: Record<string, unknown>, isZone: boolean): string {
  const lines: string[] = [];
  const skipKeys = new Set(['icon', 'selected', 'draggable', 'selectable', 'measured', 'shape', 'indexCode']);

  for (const [key, value] of Object.entries(data)) {
    if (skipKeys.has(key)) continue;
    if (value === undefined || value === null) continue;
    if (typeof value === 'function') continue;

    if (key === 'zoneType' && typeof value === 'string' && needsZoneCast(value)) {
      lines.push(`${indent(4)}${key}: '${value}' as SecurityZone`);
    } else if (key === 'zone' && typeof value === 'string' && needsZoneCast(value)) {
      lines.push(`${indent(4)}${key}: '${value}' as SecurityZone`);
    } else if (key === 'securityContext' && typeof value === 'object') {
      const ctx = value as Record<string, string>;
      const inner = Object.entries(ctx)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${indent(5)}${k}: ${stringLiteral(v)}`)
        .join(',\n');
      lines.push(`${indent(4)}${key}: {\n${inner}\n${indent(4)}}`);
    } else if ((key === 'protocols' || key === 'securityControls') && Array.isArray(value)) {
      lines.push(`${indent(4)}${key}: ${formatStringArray(value as string[])}`);
    } else if (key === 'components' && Array.isArray(value)) {
      lines.push(`${indent(4)}${key}: ${formatComponentArray(value as Array<{ name: string; version: string }>)}`);
    } else if (typeof value === 'string') {
      lines.push(`${indent(4)}${key}: ${stringLiteral(value)}`);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${indent(4)}${key}: ${value}`);
    } else if (Array.isArray(value)) {
      lines.push(`${indent(4)}${key}: ${JSON.stringify(value)}`);
    } else if (typeof value === 'object') {
      lines.push(`${indent(4)}${key}: ${JSON.stringify(value)}`);
    }
  }

  return lines.join(',\n');
}

function formatEdgeData(data: Record<string, unknown>): string {
  const lines: string[] = [];
  const skipKeys = new Set(['indexCode']);
  const orderedKeys = ['label', 'protocol', 'encryption', 'securityLevel', 'dataClassification', 'zone', 'animated', 'notes', 'controlPoints'];

  const handled = new Set<string>();
  for (const key of orderedKeys) {
    if (skipKeys.has(key)) continue;
    const value = data[key];
    if (value === undefined || value === null) continue;
    handled.add(key);

    if (key === 'zone' && typeof value === 'string' && needsZoneCast(value)) {
      lines.push(`${indent(4)}${key}: '${value}' as SecurityZone`);
    } else if (key === 'controlPoints' && Array.isArray(value) && value.length > 0) {
      lines.push(`${indent(4)}${key}: ${formatControlPoints(value as Array<{ id: string; x: number; y: number; active?: boolean }>)}`);
    } else if (typeof value === 'string') {
      lines.push(`${indent(4)}${key}: ${stringLiteral(value)}`);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${indent(4)}${key}: ${value}`);
    }
  }

  for (const [key, value] of Object.entries(data)) {
    if (handled.has(key) || skipKeys.has(key)) continue;
    if (value === undefined || value === null) continue;
    if (typeof value === 'function') continue;

    if (typeof value === 'string') {
      lines.push(`${indent(4)}${key}: ${stringLiteral(value)}`);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${indent(4)}${key}: ${value}`);
    } else if (Array.isArray(value) || typeof value === 'object') {
      lines.push(`${indent(4)}${key}: ${JSON.stringify(value)}`);
    }
  }

  return lines.join(',\n');
}

function formatZoneStyle(style: Record<string, unknown>, zoneType: string): string {
  const w = style.width ?? 650;
  const h = style.height ?? 1000;
  const bgKey = zoneType || 'Internal';
  const parts: string[] = [
    `${indent(4)}width: ${w}`,
    `${indent(4)}height: ${h}`,
    `${indent(4)}background: colors.zoneBackgrounds.${bgKey}`,
    `${indent(4)}zIndex: -1`
  ];
  return parts.join(',\n');
}

function formatNode(node: SecurityNode): string {
  const isZone = node.type === 'securityZone';
  const data = (node.data || {}) as Record<string, unknown>;
  const pos = (node as any).position || { x: 0, y: 0 };

  const lines: string[] = [];
  lines.push(`${indent(2)}{`);
  lines.push(`${indent(3)}id: '${node.id}',`);
  lines.push(`${indent(3)}type: '${node.type}',`);
  lines.push(`${indent(3)}position: { x: ${pos.x}, y: ${pos.y} },`);
  lines.push(`${indent(3)}data: {`);
  lines.push(formatNodeData(data, isZone));

  if (isZone && (node as any).style) {
    const style = (node as any).style as Record<string, unknown>;
    const zoneType = (data.zoneType as string) || 'Internal';
    lines.push(`${indent(3)}},`);
    lines.push(`${indent(3)}style: {`);
    lines.push(formatZoneStyle(style, zoneType));
    lines.push(`${indent(3)}}`);
  } else {
    lines.push(`${indent(3)}}`);
  }

  lines.push(`${indent(2)}} as SecurityNode`);
  return lines.join('\n');
}

function formatEdge(edge: SecurityEdge): string {
  const data = (edge.data || {}) as Record<string, unknown>;

  const lines: string[] = [];
  lines.push(`${indent(2)}{`);
  lines.push(`${indent(3)}id: '${edge.id}',`);
  lines.push(`${indent(3)}source: '${edge.source}',`);
  lines.push(`${indent(3)}target: '${edge.target}',`);
  lines.push(`${indent(3)}type: 'securityEdge',`);
  if ((edge as any).sourceHandle) {
    lines.push(`${indent(3)}sourceHandle: '${(edge as any).sourceHandle}',`);
  }
  if ((edge as any).targetHandle) {
    lines.push(`${indent(3)}targetHandle: '${(edge as any).targetHandle}',`);
  }
  lines.push(`${indent(3)}data: {`);
  lines.push(formatEdgeData(data));
  lines.push(`${indent(3)}}`);
  lines.push(`${indent(2)}} as SecurityEdge`);
  return lines.join('\n');
}

function formatAttackPathStep(step: any): string {
  const lines: string[] = [];
  const fields: string[] = [];
  if (step.id) fields.push(`id: '${step.id}'`);
  if (step.order !== undefined) fields.push(`order: ${step.order}`);
  if (step.stepNumber !== undefined) fields.push(`stepNumber: ${step.stepNumber}`);
  if (step.edgeId) fields.push(`edgeId: '${step.edgeId}'`);
  if (step.sourceNodeId) fields.push(`sourceNodeId: '${step.sourceNodeId}'`);
  if (step.targetNodeId) fields.push(`targetNodeId: '${step.targetNodeId}'`);
  if (step.nodeId) fields.push(`nodeId: '${step.nodeId}'`);
  if (step.description) fields.push(`description: ${stringLiteral(step.description)}`);
  if (step.technique) fields.push(`technique: ${stringLiteral(step.technique)}`);
  if (step.strideCategory) fields.push(`strideCategory: '${step.strideCategory}' as StrideCategory`);

  lines.push(`${indent(4)}{`);
  lines.push(fields.map(f => `${indent(5)}${f}`).join(',\n'));
  lines.push(`${indent(4)}}`);
  return lines.join('\n');
}

function formatAttackPath(ap: DiagramAttackPath): string {
  const lines: string[] = [];
  lines.push(`${indent(2)}{`);
  lines.push(`${indent(3)}id: '${ap.id}',`);
  lines.push(`${indent(3)}name: ${stringLiteral(ap.name)},`);
  if (ap.strideCategory) lines.push(`${indent(3)}strideCategory: '${ap.strideCategory}' as StrideCategory,`);
  if (ap.riskLevel) lines.push(`${indent(3)}riskLevel: '${ap.riskLevel}' as AttackPathRiskLevel,`);
  if (ap.description) lines.push(`${indent(3)}description: ${stringLiteral(ap.description)},`);
  if (ap.steps && ap.steps.length > 0) {
    lines.push(`${indent(3)}steps: [`);
    lines.push(ap.steps.map(s => formatAttackPathStep(s)).join(',\n'));
    lines.push(`${indent(3)}],`);
  }
  if (ap.mitreTechniques && ap.mitreTechniques.length > 0) {
    lines.push(`${indent(3)}mitreTechniques: ${formatStringArray(ap.mitreTechniques)},`);
  }
  if (ap.createdAt) lines.push(`${indent(3)}createdAt: '${ap.createdAt}',`);
  if (ap.updatedAt) lines.push(`${indent(3)}updatedAt: '${ap.updatedAt}',`);
  lines.push(`${indent(2)}} as DiagramAttackPath`);
  return lines.join('\n');
}

export function exportDiagramAsTypescript({ systemName, nodes, edges, attackPaths }: ExportOptions): string {
  const varName = toVarName(systemName || 'untitledSystem');
  const hasAttackPaths = attackPaths && attackPaths.length > 0;

  const zoneNodes = nodes.filter(n => n.type === 'securityZone');
  const regularNodes = nodes.filter(n => n.type !== 'securityZone');

  const imports = [
    `import { ExampleSystem } from '../../types/ExampleSystemTypes';`,
    `import { SecurityNode, SecurityEdge, SecurityZone } from '../../types/SecurityTypes';`,
  ];
  if (hasAttackPaths) {
    imports.push(`import { DiagramAttackPath, AttackPathRiskLevel } from '../../types/GrcTypes';`);
    imports.push(`import { StrideCategory } from '../../types/ThreatIntelTypes';`);
  }
  imports.push(`import { colors } from '../../styles/Theme';`);

  const out: string[] = [];
  out.push(imports.join('\n'));
  out.push('');
  out.push(`export const ${varName}: ExampleSystem = {`);
  out.push(`  id: '${systemName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase()}',`);
  out.push(`  name: ${stringLiteral(systemName)},`);
  out.push(`  description: 'TODO: Add description',`);
  out.push(`  category: 'TODO: Set category',`);
  out.push(`  primaryZone: 'Internal',`);
  out.push(`  dataClassification: 'Internal',`);
  out.push(`  customContext: \`TODO: Add custom context\`,`);

  // Nodes
  out.push(`  nodes: [`);
  const nodeBlocks: string[] = [];
  if (zoneNodes.length > 0) {
    nodeBlocks.push(`    // Security Zones\n${zoneNodes.map(n => formatNode(n)).join(',\n')}`);
  }
  if (regularNodes.length > 0) {
    nodeBlocks.push(`    // Nodes\n${regularNodes.map(n => formatNode(n)).join(',\n')}`);
  }
  out.push(nodeBlocks.join(',\n'));
  out.push(`  ],`);

  // Edges
  out.push(`  edges: [`);
  out.push(edges.map(e => formatEdge(e)).join(',\n'));
  out.push(`  ]`);

  // Attack paths
  if (hasAttackPaths) {
    // replace the last line's closing bracket to add comma
    out[out.length - 1] = `  ],`;
    out.push(`  attackPaths: [`);
    out.push(attackPaths!.map(ap => formatAttackPath(ap)).join(',\n'));
    out.push(`  ]`);
  }

  out.push(`};`);
  out.push('');

  return out.join('\n');
}
