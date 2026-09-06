/**
 * threatModelExport - v2 report & interchange utilities (plan Phase 5).
 *
 *  - buildThreatModelDocument: canonical, stably-ordered JSON of the whole
 *    threat model (diagram + register + attack paths + scope) for
 *    threat-model-as-code workflows (git-diffable).
 *  - generateDrawioXml: exports the diagram as draw.io / diagrams.net XML so
 *    models round-trip into the tools practitioners already use.
 *  - generateHtmlReport: a self-contained, print-friendly HTML document in the
 *    practitioner "document" style (findings keyed by element ref codes,
 *    attack path walkthroughs, scope & assumptions).
 */

import { SecurityNode, SecurityEdge } from '../types/SecurityTypes';
import { DiagramAttackPath } from '../types/GrcTypes';
import { saveExport } from './exportUtils';

export interface ThreatModelScope {
  description?: string;
  assumptions?: string;
  outOfScope?: string;
}

/* ------------------------------------------------------------------ */
/* Threat-model-as-code (canonical JSON)                               */
/* ------------------------------------------------------------------ */

/** Recursively sort object keys so exports diff cleanly in git. */
const sortKeysDeep = (value: any): any => {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.keys(value).sort().reduce((acc: any, key) => {
      acc[key] = sortKeysDeep(value[key]);
      return acc;
    }, {});
  }
  return value;
};

export const buildThreatModelDocument = (
  systemName: string,
  nodes: SecurityNode[],
  edges: SecurityEdge[],
  attackPaths: DiagramAttackPath[],
  scope?: ThreatModelScope | null
) => {
  const elements = [...nodes]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map(node => {
      const data: any = node.data || {};
      return {
        id: node.id,
        type: node.type,
        refCode: data.indexCode || null,
        label: data.label || null,
        zone: data.zone || null,
        position: node.position,
        findings: Array.isArray(data.securityContext?.threats)
          ? data.securityContext.threats.map((t: any) => ({
              title: t.title,
              type: t.type,
              severity: t.severity,
              category: t.category ?? null,
              status: t.status ?? 'identified',
              description: t.description ?? null,
              mitigation: t.mitigation ?? null,
              mitreAttackId: t.mitreAttackId ?? null,
              cweId: t.cweId ?? null,
              cveId: t.cveId ?? null
            }))
          : []
      };
    });

  const flows = [...edges]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: (edge.data as any)?.label ?? null,
      protocol: (edge.data as any)?.protocol ?? null,
      encryption: (edge.data as any)?.encryption ?? null
    }));

  const paths = [...attackPaths]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map(path => ({
      id: path.id,
      name: path.name,
      strideCategory: path.strideCategory,
      riskLevel: path.riskLevel,
      description: path.description,
      mitreTechniques: path.mitreTechniques ?? [],
      steps: [...(path.steps || [])].sort((a, b) => a.order - b.order)
    }));

  return sortKeysDeep({
    schema: 'contextcypher/threat-model',
    schemaVersion: '2.0',
    name: systemName || 'Untitled System',
    scope: scope || null,
    elements,
    flows,
    attackPaths: paths
  });
};

export const exportThreatModelAsCode = (
  systemName: string,
  nodes: SecurityNode[],
  edges: SecurityEdge[],
  attackPaths: DiagramAttackPath[],
  scope?: ThreatModelScope | null
): string => JSON.stringify(buildThreatModelDocument(systemName, nodes, edges, attackPaths, scope), null, 2);

/* ------------------------------------------------------------------ */
/* draw.io / diagrams.net export                                       */
/* ------------------------------------------------------------------ */

const xmlEscape = (value: string): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const DRAWIO_NODE_SIZES: Record<string, { w: number; h: number }> = {
  dfdActor: { w: 150, h: 64 },
  dfdProcess: { w: 130, h: 90 },
  dfdDataStore: { w: 140, h: 84 },
  dfdTrustBoundary: { w: 260, h: 170 },
  securityZone: { w: 400, h: 280 },
  default: { w: 150, h: 64 }
};

const drawioStyleFor = (node: SecurityNode): string => {
  const ink = '#3A414A';
  switch (node.type as string) {
    case 'dfdProcess':
      return `ellipse;whiteSpace=wrap;html=1;strokeColor=${ink};fillColor=#ffffff;fontSize=12;`;
    case 'dfdDataStore':
      return `shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;strokeColor=${ink};fillColor=#ffffff;size=8;fontSize=12;`;
    case 'dfdTrustBoundary':
      return 'rounded=1;whiteSpace=wrap;html=1;dashed=1;dashPattern=8 8;strokeColor=#5B8DD9;fillColor=#CFE4FF;fillOpacity=35;verticalAlign=top;fontSize=11;fontStyle=1;';
    case 'securityZone':
      return 'rounded=1;whiteSpace=wrap;html=1;dashed=1;strokeColor=#8A9099;fillColor=#B3B3B3;fillOpacity=20;verticalAlign=top;fontSize=11;fontStyle=1;';
    default:
      return `rounded=1;whiteSpace=wrap;html=1;strokeColor=${ink};fillColor=#ffffff;fontSize=12;`;
  }
};

export const generateDrawioXml = (
  systemName: string,
  nodes: SecurityNode[],
  edges: SecurityEdge[]
): string => {
  const cells: string[] = [];

  // Zones and boundaries first so they sit behind elements
  const ordered = [...nodes].sort((a, b) => {
    const rank = (n: SecurityNode) => (n.type === 'securityZone' ? 0 : n.type === 'dfdTrustBoundary' ? 1 : 2);
    return rank(a) - rank(b);
  });

  ordered.forEach(node => {
    const data: any = node.data || {};
    const size = DRAWIO_NODE_SIZES[node.type as string] || DRAWIO_NODE_SIZES.default;
    const width = (node as any).width || (node.style as any)?.width || size.w;
    const height = (node as any).height || (node.style as any)?.height || size.h;
    const label = data.indexCode
      ? `${xmlEscape(String(data.label || node.type))}&lt;br&gt;&lt;b&gt;${xmlEscape(String(data.indexCode))}&lt;/b&gt;`
      : xmlEscape(String(data.label || node.type));
    cells.push(
      `        <mxCell id="${xmlEscape(node.id)}" value="${label}" style="${drawioStyleFor(node)}" vertex="1" parent="1">\n` +
      `          <mxGeometry x="${Math.round(node.position?.x ?? 0)}" y="${Math.round(node.position?.y ?? 0)}" width="${Math.round(Number(width))}" height="${Math.round(Number(height))}" as="geometry" />\n` +
      '        </mxCell>'
    );
  });

  edges.forEach(edge => {
    const data: any = edge.data || {};
    cells.push(
      `        <mxCell id="${xmlEscape(edge.id)}" value="${xmlEscape(data.label || '')}" style="html=1;rounded=1;strokeColor=#3A414A;strokeWidth=1.25;fontSize=11;endArrow=block;" edge="1" parent="1" source="${xmlEscape(edge.source)}" target="${xmlEscape(edge.target)}">\n` +
      '          <mxGeometry relative="1" as="geometry" />\n' +
      '        </mxCell>'
    );
  });

  return (
    '<mxfile host="contextcypher">\n' +
    `  <diagram name="${xmlEscape(systemName || 'Threat Model')}" id="contextcypher-export">\n` +
    '    <mxGraphModel dx="1000" dy="800" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1654" pageHeight="1169" math="0" shadow="0">\n' +
    '      <root>\n' +
    '        <mxCell id="0" />\n' +
    '        <mxCell id="1" parent="0" />\n' +
    cells.join('\n') + '\n' +
    '      </root>\n' +
    '    </mxGraphModel>\n' +
    '  </diagram>\n' +
    '</mxfile>\n'
  );
};

/* ------------------------------------------------------------------ */
/* Document-style HTML report                                          */
/* ------------------------------------------------------------------ */

const htmlEscape = xmlEscape;

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#DC2626',
  high: '#EA580C',
  medium: '#CA8A04',
  low: '#16A34A'
};

export const generateHtmlReport = (
  systemName: string,
  nodes: SecurityNode[],
  edges: SecurityEdge[],
  attackPaths: DiagramAttackPath[],
  scope?: ThreatModelScope | null
): string => {
  const nodeById = new globalThis.Map<string, SecurityNode>();
  nodes.forEach(n => nodeById.set(n.id, n));
  const nodeName = (id: string): string => {
    const n = nodeById.get(id);
    const data: any = n?.data || {};
    return data.indexCode ? `${data.label || n?.type} (${data.indexCode})` : (data.label || n?.type || id);
  };

  interface FindingRow { refCode: string; element: string; severity: string; category: string; title: string; status: string; mitigation: string; }
  const findings: FindingRow[] = [];
  nodes.forEach(node => {
    const data: any = node.data || {};
    (Array.isArray(data.securityContext?.threats) ? data.securityContext.threats : []).forEach((t: any) => {
      findings.push({
        refCode: data.indexCode || '—',
        element: data.label || String(node.type),
        severity: String(t.severity || 'n/a').toLowerCase(),
        category: t.category || '—',
        title: t.title || 'Untitled finding',
        status: t.status || 'identified',
        mitigation: t.mitigation || ''
      });
    });
  });
  const sevRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  findings.sort((a, b) => (sevRank[b.severity] || 0) - (sevRank[a.severity] || 0));

  const sevBadge = (sev: string) =>
    `<span class="sev" style="background:${SEVERITY_COLORS[sev] || '#6B7280'}">${htmlEscape(sev.toUpperCase())}</span>`;

  const findingsRows = findings.map(f =>
    `<tr><td class="ref">${htmlEscape(f.refCode)}</td><td>${htmlEscape(f.element)}</td><td>${sevBadge(f.severity)}</td>` +
    `<td>${htmlEscape(f.category)}</td><td>${htmlEscape(f.title)}</td><td class="status">${htmlEscape(f.status)}</td>` +
    `<td>${htmlEscape(f.mitigation)}</td></tr>`
  ).join('\n');

  const pathsHtml = attackPaths.map(path => {
    const steps = [...(path.steps || [])].sort((a, b) => a.order - b.order);
    const stepList = steps.map(s =>
      `<li>${htmlEscape(nodeName(s.sourceNodeId))} &rarr; ${htmlEscape(nodeName(s.targetNodeId))}` +
      (s.technique ? ` <span class="technique">${htmlEscape(s.technique)}</span>` : '') + '</li>'
    ).join('\n');
    return (
      `<div class="path"><h3>${htmlEscape(path.name)} <span class="risk risk-${htmlEscape(String(path.riskLevel).toLowerCase())}">${htmlEscape(String(path.riskLevel))}</span> <span class="stride">${htmlEscape(String(path.strideCategory))}</span></h3>` +
      `<p>${htmlEscape(path.description || '')}</p>` +
      `<ol>${stepList}</ol></div>`
    );
  }).join('\n');

  const today = new Date().toLocaleDateString();
  const openCount = findings.filter(f => f.status === 'identified').length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${htmlEscape(systemName)} — Threat Model</title>
<style>
  :root { color-scheme: light; }
  body { font-family: Helvetica, Arial, "Segoe UI", Roboto, sans-serif; color: #3A414A; margin: 0; background: #ECECEC; }
  .page { max-width: 900px; margin: 24px auto; background: #fff; padding: 40px 48px; box-shadow: 0 1px 4px rgba(0,0,0,.12); }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 16px; border-bottom: 1.5px solid #999; padding-bottom: 4px; margin-top: 32px; color: #00994D; }
  h3 { font-size: 13px; margin: 16px 0 4px; }
  p, li, td, th { font-size: 12px; line-height: 1.5; }
  .subtitle { color: #6B7280; font-size: 13px; margin-bottom: 16px; }
  table.info td { padding: 2px 12px 2px 0; }
  table.info td:first-child { font-weight: 700; }
  table.findings { border-collapse: collapse; width: 100%; margin-top: 8px; }
  table.findings th, table.findings td { border: 1px solid #D1D5DB; padding: 4px 6px; text-align: left; vertical-align: top; }
  table.findings th { background: #F3F4F6; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; }
  td.ref { font-weight: 700; white-space: nowrap; }
  td.status { text-transform: capitalize; white-space: nowrap; }
  .sev { color: #fff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 3px; }
  .risk { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 3px; color: #fff; background: #6B7280; }
  .risk-critical, .risk-extreme { background: #DC2626; }
  .risk-high { background: #EA580C; }
  .risk-medium { background: #CA8A04; }
  .stride { font-size: 10px; color: #6B7280; font-weight: 400; }
  .technique { font-size: 10px; color: #990099; font-style: italic; }
  .path { border: 1px solid #D1D5DB; border-radius: 6px; padding: 8px 14px; margin: 10px 0; }
  .path ol { margin: 6px 0; padding-left: 20px; }
  pre.scope { white-space: pre-wrap; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px 12px; font-family: inherit; }
  @media print {
    body { background: #fff; }
    .page { box-shadow: none; margin: 0; max-width: none; padding: 0; }
    h2 { break-after: avoid; }
    .path, tr { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="page">
  <h1>${htmlEscape(systemName || 'Untitled System')}</h1>
  <div class="subtitle">Cyber Security Threat Model</div>
  <table class="info">
    <tr><td>Document Type</td><td>Cyber Security Threat Model</td></tr>
    <tr><td>Generated</td><td>${htmlEscape(today)}</td></tr>
    <tr><td>Elements</td><td>${nodes.filter(n => n.type !== 'securityZone').length}</td></tr>
    <tr><td>Findings</td><td>${findings.length} total · ${openCount} open</td></tr>
    <tr><td>Attack Paths</td><td>${attackPaths.length}</td></tr>
  </table>

  ${scope && (scope.description || scope.assumptions || scope.outOfScope) ? `
  <h2>1. Scope &amp; Assumptions</h2>
  ${scope.description ? `<h3>System Description</h3><pre class="scope">${htmlEscape(scope.description)}</pre>` : ''}
  ${scope.assumptions ? `<h3>Assumptions</h3><pre class="scope">${htmlEscape(scope.assumptions)}</pre>` : ''}
  ${scope.outOfScope ? `<h3>Out of Scope</h3><pre class="scope">${htmlEscape(scope.outOfScope)}</pre>` : ''}` : ''}

  <h2>2. Findings Register</h2>
  ${findings.length === 0 ? '<p>No findings recorded.</p>' : `
  <table class="findings">
    <thead><tr><th>Ref</th><th>Element</th><th>Severity</th><th>Category</th><th>Finding</th><th>Status</th><th>Mitigation</th></tr></thead>
    <tbody>
${findingsRows}
    </tbody>
  </table>`}

  <h2>3. Attack Paths</h2>
  ${attackPaths.length === 0 ? '<p>No attack paths recorded.</p>' : pathsHtml}

  <h2>4. Data Flows</h2>
  <table class="findings">
    <thead><tr><th>Flow</th><th>From</th><th>To</th><th>Protocol</th><th>Encryption</th></tr></thead>
    <tbody>
      ${edges.map(e => {
        const d: any = e.data || {};
        return `<tr><td>${htmlEscape(d.label || '—')}</td><td>${htmlEscape(nodeName(e.source))}</td><td>${htmlEscape(nodeName(e.target))}</td><td>${htmlEscape(d.protocol || '—')}</td><td>${htmlEscape(d.encryption || '—')}</td></tr>`;
      }).join('\n')}
    </tbody>
  </table>
</div>
</body>
</html>
`;
};

/* ------------------------------------------------------------------ */
/* Download helper                                                     */
/* ------------------------------------------------------------------ */

export const downloadTextFile = (filename: string, content: string, mimeType: string): Promise<boolean> =>
  saveExport(filename, new Blob([content], { type: mimeType }));
