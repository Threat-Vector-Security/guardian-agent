import {
  buildThreatModelDocument,
  exportThreatModelAsCode,
  generateDrawioXml,
  generateHtmlReport
} from '../threatModelExport';

const nodes: any[] = [
  {
    id: 'n2',
    type: 'dfdProcess',
    position: { x: 100, y: 50 },
    data: {
      label: 'Search Service',
      indexCode: 'P01',
      zone: 'Internal',
      securityContext: {
        threats: [
          {
            title: 'Injection via query parameter',
            type: 'threat',
            severity: 'High',
            category: 'Tampering',
            status: 'identified',
            description: 'Unsanitized input reaches the query engine',
            mitigation: 'Parameterize queries'
          }
        ]
      }
    }
  },
  {
    id: 'n1',
    type: 'dfdActor',
    position: { x: 0, y: 0 },
    data: { label: 'Customer', indexCode: 'A01', zone: 'External' }
  }
];

const edges: any[] = [
  {
    id: 'e1',
    source: 'n1',
    target: 'n2',
    data: { label: 'Search request', protocol: 'HTTPS', encryption: 'TLS 1.3' }
  }
];

const attackPaths: any[] = [
  {
    id: 'p1',
    name: 'Query injection to data exposure',
    strideCategory: 'T',
    riskLevel: 'High',
    description: 'Attacker abuses search input.',
    mitreTechniques: ['T1190'],
    steps: [
      { order: 1, edgeId: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', technique: 'T1190' }
    ],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }
];

describe('threatModelExport', () => {
  it('builds a canonical document with sorted elements and stable keys', () => {
    const doc = buildThreatModelDocument('Smart Search', nodes as any, edges as any, attackPaths as any, {
      description: 'A search app'
    });
    expect(doc.schema).toBe('contextcypher/threat-model');
    expect(doc.name).toBe('Smart Search');
    // Elements sorted by id: n1 before n2
    expect(doc.elements.map((e: any) => e.id)).toEqual(['n1', 'n2']);
    expect(doc.elements[1].refCode).toBe('P01');
    expect(doc.elements[1].findings).toHaveLength(1);
    expect(doc.elements[1].findings[0].status).toBe('identified');
  });

  it('produces deterministic JSON output for identical inputs', () => {
    const a = exportThreatModelAsCode('S', nodes as any, edges as any, attackPaths as any, null);
    const b = exportThreatModelAsCode('S', [...nodes].reverse() as any, edges as any, attackPaths as any, null);
    expect(a).toBe(b);
  });

  it('exports valid-looking draw.io XML with DFD shape styles and escaped labels', () => {
    const xml = generateDrawioXml('Smart & Search', nodes as any, edges as any);
    expect(xml).toContain('<mxfile');
    expect(xml).toContain('Smart &amp; Search');
    expect(xml).toContain('ellipse;whiteSpace=wrap'); // process shape
    expect(xml).toContain('mxCell id="e1"');
    expect(xml).toContain('source="n1" target="n2"');
    expect(xml).toContain('A01');
  });

  it('renders an HTML report with findings register, ref codes and attack paths', () => {
    const html = generateHtmlReport('Smart Search', nodes as any, edges as any, attackPaths as any, {
      description: 'A search app',
      assumptions: 'TLS everywhere',
      outOfScope: ''
    });
    expect(html).toContain('Cyber Security Threat Model');
    expect(html).toContain('Injection via query parameter');
    expect(html).toContain('P01');
    expect(html).toContain('Query injection to data exposure');
    expect(html).toContain('TLS everywhere');
    // Escaping check
    expect(html).not.toContain('<script');
  });
});
