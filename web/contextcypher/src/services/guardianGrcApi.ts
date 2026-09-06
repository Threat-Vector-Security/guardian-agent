/** ContextCypher GRC import/catalogue workflows, executed locally without sending files to a server. */
import { readXlsxRows } from './guardianXlsx';
import type { GrcControlSet, GrcSoaEntry, SoaScopeType } from '../types/GrcTypes';

const MAX_TEXT = 8 * 1024 * 1024;
const MAX_ROWS = 20_000;
type RecordData = Record<string, unknown>;
interface ControlRow { controlId: string; title: string; description?: string; family?: string; tags?: string[]; sourceRow?: number }
interface ImportPayload { name: string; version?: string; format: 'csv' | 'xlsx'; csvText?: string; xlsxBase64?: string; scopeType?: string; scopeId?: string }
export interface FrameworkCatalogEntry {
  frameworkKey: string; name: string; version: string; releaseDate: string; releaseDateLabel: string;
  description: string; controlCount: number; sourceOrg: string; category: 'compliance' | 'threat' | 'government';
  supportsSelectiveLoad: boolean; hasBaseControlsOnlyOption: boolean; baseControlCount?: number; dataFileAvailable: boolean;
}
const string = (value: unknown): string => typeof value === 'string' ? value : '';
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
const records = (value: unknown): RecordData[] => Array.isArray(value) ? value.filter((v): v is RecordData => !!v && typeof v === 'object' && !Array.isArray(v)) : [];
const slug = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const header = (value: string): string => slug(value).replace(/-/g, ' ');

export function parseDelimitedRows(text: string): string[][] {
  if (typeof text !== 'string' || text.length > MAX_TEXT) throw new Error('Import must be text smaller than 8 MiB.');
  const input = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const first = input.split('\n').find(line => line.trim()) || '';
  // Ignore separators inside quoted headings when detecting CSV/TSV dialects.
  const counts = new Map([',', '\t', ';', '|'].map(c => [c, 0]));
  let quoted = false;
  for (let i = 0; i < first.length; i++) {
    if (first[i] === '"') { if (quoted && first[i + 1] === '"') i++; else quoted = !quoted; }
    else if (!quoted && counts.has(first[i])) counts.set(first[i], counts.get(first[i])! + 1);
  }
  const delimiter = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = []; let row: string[] = []; let field = ''; quoted = false;
  const append = () => { if (field.length > 65_536 || row.length >= 256) throw new Error('Import exceeds cell or column limits.'); row.push(field.trim()); field = ''; };
  const finish = () => { append(); if (row.some(Boolean)) rows.push(row); row = []; if (rows.length > MAX_ROWS + 1) throw new Error('Import exceeds 20,000 rows.'); };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') { if (quoted && input[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && c === delimiter) append();
    else if (!quoted && c === '\n') finish();
    else field += c;
  }
  if (quoted) throw new Error('Import contains an unterminated quoted field.');
  if (field.length || row.length) finish();
  return rows;
}

function column(headers: string[], candidates: string[]): number { return headers.findIndex(value => candidates.includes(value)); }
function parseControls(rows: string[][]): ControlRow[] {
  if (!rows.length) return [];
  const headers = rows[0].map(header);
  const id = column(headers, ['control id', 'control', 'id', 'reference', 'control reference']);
  const title = column(headers, ['title', 'name', 'control name', 'statement']);
  const description = column(headers, ['description', 'guidance', 'details']);
  const family = column(headers, ['family', 'domain', 'category']);
  return rows.slice(1).map((row, index) => {
    const controlId = string(row[id < 0 ? 0 : id]).trim();
    return { controlId: controlId || `CONTROL-${index + 1}`, title: string(row[title < 0 ? 1 : title]).trim() || controlId || `Control ${index + 1}`,
      description: string(row[description]).trim() || undefined, family: string(row[family]).trim() || undefined, sourceRow: index + 2 };
  });
}

function parseTier3(text: string) {
  const rows = parseDelimitedRows(text); if (!rows.length) return [];
  const headers = rows[0].map(header);
  const indexes = [column(headers, ['tier 2', 'tier2', 'category', 'risk category', 'domain']), column(headers, ['tier 3', 'tier3', 'risk scenario', 'scenario', 'risk', 'risk name']),
    column(headers, ['description', 'details', 'summary', 'risk statement']), column(headers, ['risk id', 'id']), column(headers, ['cia triad', 'cia']), column(headers, ['impact category', 'impact'])];
  const domains: Record<string, string> = { OT: 'Compromise of OT systems disrupts safe operational visibility and control.', IT: 'Compromise of IT systems exposes sensitive information and business services.', Both: 'Compromise across IT/OT dependencies degrades enterprise trust, response, and resilience.' };
  const seen = new Set<string>();
  return rows.slice(1).flatMap(row => {
    const [rawTier2, rawTier3, description, riskId, cia, impact] = indexes.map(i => string(row[i]).trim());
    const domain = rawTier2.toLowerCase();
    const tier2 = domains[domain === 'ot' || domain.includes('operational technology') ? 'OT' : domain === 'it' || domain.includes('information technology') ? 'IT' : domain === 'both' || domain.includes('it/ot') || domain.includes('ot/it') ? 'Both' : ''] || rawTier2;
    const tier3 = rawTier3 || riskId || string(row[0]).trim(); const key = `${tier2.toLowerCase()}::${tier3.toLowerCase()}`;
    if (!tier3 || seen.has(key)) return []; seen.add(key);
    const tags = [riskId && `risk_id:${riskId.toLowerCase()}`, rawTier2 && `domain:${slug(rawTier2)}`, cia && `cia:${slug(cia)}`, impact && `impact:${slug(impact)}`].filter(Boolean) as string[];
    return [{ tier2: tier2 || undefined, tier3, description: description || [cia && `CIA triad focus: ${cia}`, impact && `Impact category: ${impact}`].filter(Boolean).join(' | ') || undefined, tags: tags.length ? tags : undefined }];
  });
}

export async function getGrcMetadata() { return { success: true, module: 'grc', version: '1.0', features: { riskModelConfig: true, tieredRiskTaxonomy: true, controlSetImport: ['csv', 'xlsx'], reporting: true } }; }
export async function previewTier3Import(csvText: string) { const rows = parseTier3(csvText); return { success: true, preview: rows.slice(0, 20), totalRows: rows.length }; }
export async function importTier3Catalogue(csvText: string) { return { rows: parseTier3(csvText) }; }
async function controlRows(payload: ImportPayload) {
  if (payload.format !== 'csv' && payload.format !== 'xlsx') throw new Error('Unsupported control import format.');
  return parseControls(payload.format === 'xlsx' ? await readXlsxRows(payload.xlsxBase64 || '') : parseDelimitedRows(payload.csvText || ''));
}
export async function previewControlSetImport(payload: ImportPayload) { const controls = await controlRows(payload); return { success: true, name: payload.name, totalControls: controls.length, preview: controls.slice(0, 20) }; }

function assembleControlSet(rows: ControlRow[], name: string, version: string | undefined, sourceType: 'imported' | 'built_in', scopeType = 'system', scopeId = 'system', releaseDate?: string) {
  const validScope = (value: string): value is SoaScopeType => value === 'system' || value === 'diagram' || value === 'assessment' || value === 'asset_group';
  if (!validScope(scopeType)) throw new Error('Invalid control scope.');
  if (!scopeId || scopeId.length > 512 || name.length > 512 || (version?.length || 0) > 128) throw new Error('Invalid control set name, version or scope.');
  const id = `controlset-${crypto.randomUUID()}`; const now = new Date().toISOString();
  const controlSet: GrcControlSet = { id, name, version, sourceType, importedAt: now, importSourceName: name, releaseDate, controls: rows.map((row, i) => ({ ...row, id: `${id}-ctrl-${i + 1}` })) };
  const soaEntries: GrcSoaEntry[] = controlSet.controls.map(control => ({ id: `soa-${crypto.randomUUID()}`, controlSetId: id, controlId: control.controlId, scopeType, scopeId,
    applicability: 'applicable', implementationStatus: 'not_implemented', justification: '', mitigatesRiskIds: [], diagramRefs: [], evidence: [], updatedAt: now }));
  return { success: true, controlSet, soaEntries };
}
export async function importControlSet(payload: ImportPayload) { return assembleControlSet(await controlRows(payload), payload.name || 'Imported Control Set', payload.version, 'imported', payload.scopeType, payload.scopeId); }
export async function importControlSetXlsx(name: string, xlsxBase64: string, version?: string, scopeType?: string, scopeId?: string) { return importControlSet({ name, xlsxBase64, version, scopeType, scopeId, format: 'xlsx' }); }

const definitions = [
  ['nist-800-53', 'NIST SP 800-53', 'Rev 5.1', '2020-09', 'Sep 2020', 'NIST', 'compliance', 'Comprehensive security and privacy controls for information systems.'],
  ['owasp-top-10', 'OWASP Top 10', '2021', '2021-09', 'Sep 2021', 'OWASP', 'compliance', 'Critical web application security risks.'],
  ['mitre-attack-enterprise', 'MITRE ATT&CK Enterprise', 'v14.1', '2023-10', 'Oct 2023', 'MITRE', 'threat', 'Adversarial tactics and techniques for enterprise environments.'],
  ['mitre-attack-ics', 'MITRE ATT&CK ICS', 'v14.1', '2023-10', 'Oct 2023', 'MITRE', 'threat', 'Adversarial techniques targeting industrial control systems.'],
  ['mitre-attack-mobile', 'MITRE ATT&CK Mobile', 'v14.1', '2023-10', 'Oct 2023', 'MITRE', 'threat', 'Adversarial techniques targeting mobile platforms.'],
  ['ism-dec-2025', 'Australian ISM', 'December 2025', '2025-12', 'Dec 2025', 'ASD', 'government', 'Australian Government Information Security Manual.'],
  ['essential-eight', 'Essential Eight', 'October 2024', '2024-10', 'Oct 2024', 'ASD', 'government', 'Eight essential mitigation strategies with maturity levels.'],
] as const;
// Fixed local imports: no user-provided URL, path or network request is used to load frameworks.
const loaders: Record<string, () => Promise<{ default: unknown }>> = {
  'nist-800-53': () => import('../data/security-knowledge-base/nist-800-53-controls.json'),
  'owasp-top-10': () => import('../data/security-knowledge-base/owasp-top-10.json'),
  'mitre-attack-enterprise': () => import('../data/security-knowledge-base/mitre-attack.json'),
  'mitre-attack-ics': () => import('../data/security-knowledge-base/mitre-attack-ics.json'),
  'mitre-attack-mobile': () => import('../data/security-knowledge-base/mitre-attack-mobile.json'),
  'ism-dec-2025': () => import('../data/security-knowledge-base/ism-dec-2025.json'),
  'essential-eight': () => import('../data/security-knowledge-base/essential-eight-oct-2024.json'),
};

function transform(key: string, data: RecordData, selectedFamilies: string[] = [], baseOnly = false): ControlRow[] {
  const selected = new Set(selectedFamilies.map(v => v.toLowerCase()));
  const isSelected = (families: string[]) => !selected.size || families.some(f => selected.has(f.toLowerCase()));
  const source = records(key === 'owasp-top-10' ? data.risks : key.startsWith('mitre-') ? data.techniques : data.controls);
  return source.flatMap(c => {
    let controlId = string(c.id || c.identifier); let title = string(c.name || c.title || c.topic); let description = string(c.description); let family = string(c.family); let tags = strings(c.tags);
    if (key === 'nist-800-53') {
      // Base controls are identified by the control's own ID, not by whether it references enhancements.
      if (baseOnly && controlId.includes('(')) return [];
      description = string(c.controlText); tags = [c.priority ? `priority:${c.priority}` : '', ...strings(c.applicableThreats).map(t => `threat:${t}`)].filter(Boolean);
    } else if (key === 'owasp-top-10') {
      family = 'OWASP Top 10 2021'; description = [description, strings(c.prevention).length ? `Prevention: ${strings(c.prevention).join('; ')}` : ''].filter(Boolean).join(' | ');
      tags = [...strings(c.mitreTechniques).map(t => `mitre:${t}`), ...strings(c.nistControls).map(t => `nist:${t}`)];
    } else if (key.startsWith('mitre-')) {
      const tactics = strings(c.tactics); if (!isSelected(tactics)) return [];
      family = tactics.join(', '); tags = [...strings(c.platforms).map(p => `platform:${p}`), c.severity ? `severity:${c.severity}` : ''].filter(Boolean);
    } else if (key === 'ism-dec-2025' || key === 'essential-eight') {
      if (!isSelected([string(c.guideline)])) return [];
      family = [string(c.guideline), key === 'ism-dec-2025' ? string(c.section) : ''].filter(Boolean).join(' > '); title ||= description.slice(0, 80);
    }
    if (!key.startsWith('mitre-') && key !== 'ism-dec-2025' && key !== 'essential-eight' && !isSelected([family])) return [];
    return [{ controlId, title: title || controlId, description, family, tags }];
  });
}

export async function fetchFrameworkCatalog(): Promise<FrameworkCatalogEntry[]> {
  return Promise.all(definitions.map(async ([frameworkKey, name, version, releaseDate, releaseDateLabel, sourceOrg, category, description]) => {
    const data = (await loaders[frameworkKey]()).default as RecordData;
    return { frameworkKey, name, version, releaseDate, releaseDateLabel, sourceOrg, category, description,
      controlCount: transform(frameworkKey, data).length, supportsSelectiveLoad: !['owasp-top-10', 'essential-eight'].includes(frameworkKey),
      hasBaseControlsOnlyOption: frameworkKey === 'nist-800-53', baseControlCount: frameworkKey === 'nist-800-53' ? transform(frameworkKey, data, [], true).length : undefined, dataFileAvailable: true };
  }));
}
export async function loadBuiltInFramework(payload: { frameworkKey: string; selectedFamilies?: string[]; baseControlsOnly?: boolean; scopeType?: string; scopeId?: string }) {
  const entry = definitions.find(([key]) => key === payload.frameworkKey);
  if (!entry) throw new Error('Framework not found in the local catalogue.');
  if (payload.selectedFamilies && (!Array.isArray(payload.selectedFamilies) || payload.selectedFamilies.length > 256 || payload.selectedFamilies.some(v => typeof v !== 'string' || v.length > 512))) throw new Error('Invalid framework family selection.');
  const data = (await loaders[entry[0]]()).default as RecordData;
  const rows = transform(entry[0], data, payload.selectedFamilies, payload.baseControlsOnly);
  return { ...assembleControlSet(rows, `${entry[1]} ${entry[2]}`, entry[2], 'built_in', payload.scopeType, payload.scopeId, entry[3]), frameworkKey: entry[0], controlCount: rows.length };
}
