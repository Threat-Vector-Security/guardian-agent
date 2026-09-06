/**
 * ContextCypher's open document format, based on src/components/DiagramEditor.tsx
 * and src/types/GrcTypes.ts in ContextCypher (Apache-2.0). Risk scoring below is
 * adapted from its GrcWorkspaceService.ts; see docs/architecture/CONTEXT-MIGRATION.md.
 * This module intentionally preserves unknown data instead of normalizing it away.
 */
import { createHash } from 'node:crypto';

export type ContextJson = null | boolean | number | string | ContextJson[] | ContextDocument;
export interface ContextDocument { [key: string]: ContextJson }
export interface ContextNode extends ContextDocument { id: string }
export interface ContextEdge extends ContextNode { source: string; target: string }
export interface GuardianContextEnvelope {
  format: 'guardian-context';
  version: 1;
  readonly original: Readonly<{ encoding: 'base64'; data: string; sha256: string }>;
  document: ContextDocument;
}
export interface ContextInspection {
  valid: boolean;
  format: 'contextcypher' | 'guardian-context' | 'encrypted' | 'unknown';
  errors: string[];
  warnings: string[];
  nodeCount: number;
  edgeCount: number;
}
export const CONTEXT_LIMITS = Object.freeze({ documentBytes: 16 * 1024 * 1024, importBytes: 64 * 1024 * 1024, depth: 64, values: 300_000, nodes: 20_000, edges: 50_000 });
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const record = (value: unknown): value is ContextDocument => value !== null && typeof value === 'object' && !Array.isArray(value);
const rows = (value: ContextJson | undefined): ContextDocument[] => Array.isArray(value) ? value.filter(record) : [];
const strings = (value: ContextJson | undefined): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const recordsWithIds = (value: ContextJson | undefined): ContextDocument[] => rows(value).filter(item => typeof item.id === 'string' && item.id.length > 0);

/** Validate before cloning: never execute getters or accept non-JSON values. */
function assertJson(input: unknown): asserts input is ContextJson {
  let count = 0;
  const ancestors = new Set<object>();
  function visit(value: unknown, depth: number): void {
    if (++count > CONTEXT_LIMITS.values || depth > CONTEXT_LIMITS.depth) throw new Error('Context document exceeds structural limits.');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (typeof value !== 'object' || value === null) throw new Error('Context document must contain only finite JSON values.');
    if (ancestors.has(value)) throw new Error('Context document must not contain cycles.');
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new Error('Context document must contain only plain objects.');
    if (Object.getOwnPropertySymbols(value).length) throw new Error('Context document must not contain symbol keys.');
    ancestors.add(value);
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (Array.isArray(value) && key === 'length') continue;
      if (FORBIDDEN_KEYS.has(key)) throw new Error('Context document contains an unsafe object key.');
      if (!('value' in descriptor) || !descriptor.enumerable) throw new Error('Context document must not contain accessors or hidden properties.');
      if (Array.isArray(value) && !/^(0|[1-9]\d*)$/.test(key)) throw new Error('Context document contains a non-JSON array property.');
      visit(descriptor.value, depth + 1);
    }
    if (Array.isArray(value) && Object.keys(value).length !== value.length) throw new Error('Context document must not contain sparse arrays.');
    ancestors.delete(value);
  }
  visit(input, 0);
}

function parse(text: string, maxBytes: number): ContextJson {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > maxBytes) throw new Error('Context file exceeds the supported byte limit.');
  let parsed: unknown;
  try { parsed = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text); }
  catch { throw new Error('Context file must be valid JSON. Encrypted or binary files must be exported as plaintext JSON from ContextCypher first.'); }
  assertJson(parsed);
  return parsed;
}

function encrypted(value: ContextDocument): boolean {
  return value.encrypted === true || typeof value.encryptedData === 'string' || typeof value.ciphertext === 'string';
}

function validateDocument(value: unknown): asserts value is ContextDocument {
  assertJson(value);
  if (!record(value)) throw new Error('Context workspace must be a JSON object.');
  if (encrypted(value)) throw new Error('Encrypted workspace import is unsupported. Export a plaintext JSON workspace in ContextCypher; provider credential stores cannot be imported.');
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > CONTEXT_LIMITS.documentBytes) throw new Error('Context document exceeds the supported byte limit.');
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) throw new Error('Context workspace requires nodes and edges arrays (both may be empty).');
  if (value.nodes.length > CONTEXT_LIMITS.nodes || value.edges.length > CONTEXT_LIMITS.edges) throw new Error('Context graph exceeds the supported graph limit.');
  const validateIds = (items: ContextJson[], kind: string): Set<string> => {
    const ids = new Set<string>();
    for (const item of items) {
      if (!record(item) || typeof item.id !== 'string' || !item.id.trim() || item.id.length > 512) throw new Error(`Each ${kind} requires a nonempty string id of at most 512 characters.`);
      if (ids.has(item.id)) throw new Error(`Duplicate ${kind} id in context graph.`);
      ids.add(item.id);
    }
    return ids;
  };
  const nodeIds = validateIds(value.nodes, 'node');
  validateIds(value.edges, 'edge');
  const parents = new Map<string, string>();
  for (const node of value.nodes as ContextNode[]) {
    const parent = node.parentId ?? node.parentNode;
    if (parent !== undefined && (typeof parent !== 'string' || !nodeIds.has(parent) || parent === node.id)) throw new Error('Context node references an invalid parent.');
    if (typeof parent === 'string') parents.set(node.id, parent);
  }
  const settled = new Set<string>();
  for (const id of parents.keys()) {
    const path = new Set<string>();
    let cursor: string | undefined = id;
    while (cursor && !settled.has(cursor)) {
      if (path.has(cursor)) throw new Error('Context node parents contain a cycle.');
      path.add(cursor);
      cursor = parents.get(cursor);
    }
    for (const member of path) settled.add(member);
  }
  for (const edge of value.edges as ContextEdge[]) {
    if (typeof edge.source !== 'string' || typeof edge.target !== 'string' || !nodeIds.has(edge.source) || !nodeIds.has(edge.target)) throw new Error('Context edge references a missing source or target node.');
  }
}

function validateEnvelope(input: unknown): asserts input is GuardianContextEnvelope {
  assertJson(input);
  if (!record(input) || input.format !== 'guardian-context' || input.version !== 1) throw new Error('Unsupported Guardian context envelope version.');
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > CONTEXT_LIMITS.importBytes) throw new Error('Guardian context envelope exceeds the supported byte limit.');
  const original = input.original;
  if (!record(original) || original.encoding !== 'base64' || typeof original.data !== 'string' || typeof original.sha256 !== 'string') throw new Error('Guardian context envelope requires an original base64 file and SHA-256 digest.');
  const bytes = Buffer.from(original.data, 'base64');
  if (bytes.length > CONTEXT_LIMITS.documentBytes || bytes.toString('base64') !== original.data || sha256(bytes) !== original.sha256) throw new Error('Guardian original file failed integrity validation.');
  // The digest detects accidental corruption, not authenticity. Original bytes
  // are immutable inside a stored project; persistence owns that trust boundary.
  validateDocument(parse(bytes.toString('utf8'), CONTEXT_LIMITS.documentBytes));
  validateDocument(input.document);
}

export function inspectContextCypher(input: unknown): ContextInspection {
  const result: ContextInspection = { valid: false, format: 'unknown', errors: [], warnings: [], nodeCount: 0, edgeCount: 0 };
  try {
    assertJson(input);
    if (record(input) && encrypted(input)) { result.format = 'encrypted'; validateDocument(input); }
    if (record(input) && input.format === 'guardian-context') {
      result.format = 'guardian-context';
      validateEnvelope(input);
    } else {
      validateDocument(input);
      result.format = 'contextcypher';
    }
    const doc = result.format === 'guardian-context' ? (input as unknown as GuardianContextEnvelope).document : input as ContextDocument;
    result.nodeCount = (doc.nodes as ContextJson[]).length;
    result.edgeCount = (doc.edges as ContextJson[]).length;
    result.valid = true;
    if (doc.grcWorkspace) result.warnings.push('GRC and assessment data is preserved; cross-diagram references are not verified against other workspaces.');
    result.warnings.push('Imported text and model claims are untrusted context, not security policy or verified evidence.');
  } catch (error) { result.errors.push(error instanceof Error ? error.message : 'Invalid context workspace.'); }
  return result;
}

export function importContextCypher(text: string): GuardianContextEnvelope {
  const value = parse(text, CONTEXT_LIMITS.importBytes);
  if (record(value) && value.format === 'guardian-context') {
    validateEnvelope(value);
    return { ...value, original: Object.freeze(value.original) };
  }
  validateDocument(value);
  const bytes = Buffer.from(text, 'utf8');
  if (bytes.length > CONTEXT_LIMITS.documentBytes) throw new Error('Context file exceeds the supported byte limit.');
  return { format: 'guardian-context', version: 1, original: Object.freeze({ encoding: 'base64', data: bytes.toString('base64'), sha256: sha256(bytes) }), document: value };
}

export function exportContextCypher(envelope: GuardianContextEnvelope, format: 'guardian' | 'contextcypher' | 'original' = 'guardian'): string {
  validateEnvelope(envelope);
  if (format === 'original') return Buffer.from(envelope.original.data, 'base64').toString('utf8');
  if (format !== 'guardian' && format !== 'contextcypher') throw new Error('Unsupported context export format.');
  // Compact output keeps a valid near-limit document reimportable.
  return JSON.stringify(format === 'guardian' ? envelope : envelope.document);
}

export function updateContextDocument(envelope: GuardianContextEnvelope, document: unknown): GuardianContextEnvelope {
  validateEnvelope(envelope);
  validateDocument(document);
  return { ...envelope, original: Object.freeze({ ...envelope.original }), document: JSON.parse(JSON.stringify(document)) as ContextDocument };
}

export function getContextGraph(envelope: GuardianContextEnvelope): { nodes: ContextNode[]; edges: ContextEdge[] } {
  validateEnvelope(envelope);
  return JSON.parse(JSON.stringify({ nodes: envelope.document.nodes, edges: envelope.document.edges })) as { nodes: ContextNode[]; edges: ContextEdge[] };
}

export function updateContextGraph(envelope: GuardianContextEnvelope, graph: { nodes?: ContextNode[]; edges?: ContextEdge[] }): GuardianContextEnvelope {
  assertJson(graph);
  return updateContextDocument(envelope, { ...envelope.document, ...(graph.nodes === undefined ? {} : { nodes: graph.nodes }), ...(graph.edges === undefined ? {} : { edges: graph.edges }) });
}

/** Resolve actual stored links; never invent links using names or model guesses. */
export function getLinkedContext(envelope: GuardianContextEnvelope, query: { nodeId?: string; edgeId?: string; diagramId?: string }): { assets: ContextDocument[]; findings: ContextDocument[]; risks: ContextDocument[]; controls: ContextDocument[] } {
  validateEnvelope(envelope);
  const workspace = record(envelope.document.grcWorkspace) ? envelope.document.grcWorkspace : {};
  const matchesRef = (item: ContextDocument): boolean => rows(item.diagramRefs).some(ref => (!query.diagramId || ref.diagramId === query.diagramId) && (ref.nodeId === query.nodeId && query.nodeId !== undefined || ref.nodeId === query.edgeId && query.edgeId !== undefined));
  const assets = recordsWithIds(workspace.assets).filter(matchesRef);
  const assetIds = new Set(assets.map(item => item.id));
  const findings = recordsWithIds(workspace.findings).filter(item => (query.nodeId !== undefined && strings(item.relatedNodeIds).includes(query.nodeId)) || (query.edgeId !== undefined && strings(item.relatedEdgeIds).includes(query.edgeId)) || strings(item.linkedAssetIds).some(id => assetIds.has(id)));
  const linkedRiskIds = new Set(findings.flatMap(item => strings(item.linkedRiskIds)));
  const findingIds = new Set(findings.map(item => item.id));
  const risks = recordsWithIds(workspace.risks).filter(item => linkedRiskIds.has(item.id as string) || findingIds.has(item.sourceFindingId ?? null) || strings(item.assetIds).some(id => assetIds.has(id)) || rows(item.diagramLinks).some(link => (!query.diagramId || link.diagramId === query.diagramId) && query.nodeId !== undefined && strings(link.nodeIds).includes(query.nodeId)));
  const riskIds = new Set(risks.map(item => item.id));
  const controls = [...recordsWithIds(workspace.implementedControls), ...recordsWithIds(workspace.soaEntries)].filter(item => matchesRef(item) || strings(item.linkedAssetIds).some(id => assetIds.has(id)) || [...strings(item.linkedRiskIds), ...strings(item.mitigatesRiskIds)].some(id => riskIds.has(id)));
  return JSON.parse(JSON.stringify({ assets, findings, risks, controls })) as { assets: ContextDocument[]; findings: ContextDocument[]; risks: ContextDocument[]; controls: ContextDocument[] };
}

/** ContextCypher score = likelihood * impact; explicit bands take precedence.
 * Unknown scale IDs fail instead of being silently scored as zero. This is an
 * on-demand base appetite calculation; scoped appetite rules require a risk.
 */
export function calculateContextRisk(envelope: GuardianContextEnvelope, likelihoodId: string, impactId: string): { likelihoodId: string; impactId: string; rawScore: number; ratingLabel: string; color: string; exceedsAppetite: boolean; riskModelVersion: string } {
  validateEnvelope(envelope);
  const workspace = envelope.document.grcWorkspace;
  if (!record(workspace) || !record(workspace.riskModel)) throw new Error('Workspace has no risk scoring model.');
  const model = workspace.riskModel;
  const scale = (items: ContextJson | undefined, id: string): { value: number; max: number } => {
    const entries = rows(items);
    if (!entries.length || entries.some(item => typeof item.value !== 'number' || !Number.isFinite(item.value) || item.value < 0) || new Set(entries.map(item => item.id)).size !== entries.length) throw new Error('Risk scale is invalid.');
    const selected = entries.find(item => item.id === id);
    if (!selected) throw new Error('Risk scale id does not exist.');
    return { value: selected.value as number, max: entries.reduce((max, item) => Math.max(max, item.value as number), 1) };
  };
  const likelihood = scale(model.likelihoodScale, likelihoodId);
  const impact = scale(model.impactScale, impactId);
  const rawScore = likelihood.value * impact.value;
  const max = likelihood.max * impact.max;
  if (!Number.isFinite(rawScore) || !Number.isFinite(max) || typeof model.appetiteThresholdScore !== 'number' || model.appetiteThresholdScore < 0 || typeof model.version !== 'string') throw new Error('Risk model has invalid scoring parameters.');
  const config = record(workspace.config) ? workspace.config : {};
  const colors = record(config.ratingColors) ? config.ratingColors : {};
  const thresholds = record(config.ratingThresholds) ? config.ratingThresholds : {};
  const fallback = [
    { label: 'Critical', minScoreRatio: thresholds.criticalThreshold ?? 0.75, color: colors.critical ?? '#dc2626' },
    { label: 'High', minScoreRatio: thresholds.highThreshold ?? 0.5, color: colors.high ?? '#ea580c' },
    { label: 'Medium', minScoreRatio: thresholds.mediumThreshold ?? 0.25, color: colors.medium ?? '#d97706' },
    { label: 'Low', minScoreRatio: 0, color: colors.low ?? '#16a34a' },
  ];
  const bands = rows(config.ratingBands).length ? rows(config.ratingBands) : fallback;
  if (bands.some(band => typeof band.minScoreRatio !== 'number' || band.minScoreRatio < 0 || band.minScoreRatio > 1 || typeof band.label !== 'string' || typeof band.color !== 'string')) throw new Error('Risk rating bands are invalid.');
  const ordered = [...bands].sort((a, b) => (b.minScoreRatio as number) - (a.minScoreRatio as number));
  const rating = ordered.find(band => rawScore / max >= (band.minScoreRatio as number)) ?? ordered[ordered.length - 1];
  return { likelihoodId, impactId, rawScore, ratingLabel: rating.label as string, color: rating.color as string, exceedsAppetite: rawScore >= model.appetiteThresholdScore, riskModelVersion: model.version };
}
