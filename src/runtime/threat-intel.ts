/**
 * Threat intelligence orchestration for personal-assistant protection.
 *
 * This service is intentionally conservative:
 * - collection and triage can be automated
 * - external response actions remain human-approved by default
 */

import { randomUUID } from 'node:crypto';
import type { ForumConnector, ForumConnectorStatus } from './forum-connector.js';

export type IntelSourceType =
  | 'web'
  | 'news'
  | 'social'
  | 'forum'
  | 'darkweb';

export type IntelContentType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'mixed';

export type IntelSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IntelStatus = 'new' | 'triaged' | 'actioned' | 'dismissed';
export type IntelActionType = 'report' | 'request_takedown' | 'draft_response' | 'publish_response';
export type IntelActionStatus = 'proposed' | 'approved' | 'executed' | 'blocked';
export type IntelResponseMode = 'manual' | 'assisted' | 'autonomous';

export interface ThreatIntelFinding {
  id: string;
  createdAt: number;
  target: string;
  sourceType: IntelSourceType;
  contentType: IntelContentType;
  severity: IntelSeverity;
  confidence: number;
  summary: string;
  url?: string;
  status: IntelStatus;
  labels: string[];
  provenance?: ThreatIntelFindingProvenance;
  evidence?: ThreatIntelFindingEvidence[];
}

export interface ThreatIntelFindingProvenance {
  provider: string;
  query: string;
  title?: string;
  snippet?: string;
}

export interface ThreatIntelFindingEvidence {
  kind: 'search_result' | 'page_excerpt' | 'provider_answer';
  content: string;
  title?: string;
  url?: string;
}

export interface ThreatIntelAction {
  id: string;
  findingId: string;
  createdAt: number;
  type: IntelActionType;
  status: IntelActionStatus;
  requiresApproval: boolean;
  rationale: string;
  targetUrl?: string;
  draftText?: string;
}

export interface ThreatIntelSummary {
  enabled: boolean;
  lastScanAt?: number;
  watchlistCount: number;
  darkwebEnabled: boolean;
  responseMode: IntelResponseMode;
  forumConnectors: ForumConnectorStatus[];
  findings: {
    total: number;
    new: number;
    highOrCritical: number;
  };
}

export interface ThreatIntelPlanItem {
  phase: string;
  objective: string;
  deliverables: string[];
}

export interface ThreatIntelPlan {
  title: string;
  principles: string[];
  phases: ThreatIntelPlanItem[];
}

export interface ThreatIntelScanInput {
  query?: string;
  includeDarkWeb?: boolean;
  sources?: IntelSourceType[];
}

export interface ThreatIntelSourceScanInput {
  targets: string[];
  includeDarkWeb: boolean;
  now: number;
}

export interface ThreatIntelSourceFinding {
  target: string;
  sourceType: IntelSourceType;
  contentType: IntelContentType;
  severity: IntelSeverity;
  confidence: number;
  summary: string;
  url?: string;
  labels: string[];
  provenance?: ThreatIntelFindingProvenance;
  evidence?: ThreatIntelFindingEvidence[];
}

export interface ThreatIntelSourceScanResult {
  sourceType: IntelSourceType;
  scanned: boolean;
  findings: ThreatIntelSourceFinding[];
  unavailableReason?: string;
}

export interface ThreatIntelSourceScanner {
  readonly sourceType: Exclude<IntelSourceType, 'forum'>;
  scan(input: ThreatIntelSourceScanInput): Promise<ThreatIntelSourceScanResult>;
}

export interface ThreatIntelServiceOptions {
  enabled: boolean;
  allowDarkWeb: boolean;
  responseMode: IntelResponseMode;
  watchlist: string[];
  forumConnectors?: ForumConnector[];
  sourceScanners?: Partial<Record<Exclude<IntelSourceType, 'forum'>, ThreatIntelSourceScanner>>;
  now?: () => number;
}

const DEFAULT_PLAN: ThreatIntelPlan = {
  title: 'Guardian Agent Threat Intel Operating Plan',
  principles: [
    'Protect users with evidence-based monitoring, not speculation.',
    'Prioritize identity abuse and deepfake risk by severity and confidence.',
    'Keep active response human-approved by default.',
    'Log every response decision for auditability.',
  ],
  phases: [
    {
      phase: 'Phase 1 - Discover',
      objective: 'Continuously monitor configured targets across open sources.',
      deliverables: [
        'Watchlist collection jobs',
        'Deepfake / impersonation classification',
        'Finding queue with severity + confidence',
      ],
    },
    {
      phase: 'Phase 2 - Triage',
      objective: 'Reduce false positives and focus analyst time.',
      deliverables: [
        'Rule-based prioritization',
        'Source reliability scoring',
        'Analyst status workflows (triaged/dismissed/actioned)',
      ],
    },
    {
      phase: 'Phase 3 - Respond',
      objective: 'Generate safe, policy-compliant countermeasures.',
      deliverables: [
        'Takedown/report templates',
        'Forum/social response drafts',
        'Human approval gate before publishing',
      ],
    },
    {
      phase: 'Phase 4 - Learn',
      objective: 'Improve coverage and response outcomes over time.',
      deliverables: [
        'Precision/recall feedback loop',
        'Response success metrics',
        'Playbook versioning per threat category',
      ],
    },
  ],
};

/**
 * In-memory threat intelligence service.
 *
 * Collection connectors (web/news/forum/darkweb) are intentionally abstracted so
 * production implementations can swap in compliant data providers.
 */
export class ThreatIntelService {
  private readonly enabled: boolean;
  private readonly allowDarkWeb: boolean;
  private responseMode: IntelResponseMode;
  private readonly now: () => number;
  private readonly forumConnectors: ForumConnector[];
  private readonly sourceScanners: Partial<Record<Exclude<IntelSourceType, 'forum'>, ThreatIntelSourceScanner>>;
  private readonly watchlist = new Set<string>();
  private readonly findings: ThreatIntelFinding[] = [];
  private readonly actions: ThreatIntelAction[] = [];
  private lastScanAt?: number;

  constructor(options: ThreatIntelServiceOptions) {
    this.enabled = options.enabled;
    this.allowDarkWeb = options.allowDarkWeb;
    this.responseMode = options.responseMode;
    this.now = options.now ?? Date.now;
    this.forumConnectors = options.forumConnectors ?? [];
    this.sourceScanners = options.sourceScanners ?? {};
    for (const target of options.watchlist) {
      const normalized = normalizeTarget(target);
      if (normalized) this.watchlist.add(normalized);
    }
  }

  getPlan(): ThreatIntelPlan {
    return DEFAULT_PLAN;
  }

  getSummary(): ThreatIntelSummary {
    const newFindings = this.findings.filter((f) => f.status === 'new').length;
    const highOrCritical = this.findings.filter((f) => f.severity === 'high' || f.severity === 'critical').length;
    return {
      enabled: this.enabled,
      lastScanAt: this.lastScanAt,
      watchlistCount: this.watchlist.size,
      darkwebEnabled: this.allowDarkWeb,
      responseMode: this.responseMode,
      forumConnectors: this.forumConnectors.map((connector) => connector.status()),
      findings: {
        total: this.findings.length,
        new: newFindings,
        highOrCritical,
      },
    };
  }

  listWatchlist(): string[] {
    return [...this.watchlist.values()];
  }

  addWatchTarget(target: string): { success: boolean; message: string } {
    const normalized = normalizeTarget(target);
    if (!normalized) {
      return { success: false, message: 'Target cannot be empty.' };
    }
    if (this.watchlist.has(normalized)) {
      return { success: false, message: `Target '${normalized}' is already on watchlist.` };
    }
    this.watchlist.add(normalized);
    return { success: true, message: `Added '${normalized}' to watchlist.` };
  }

  removeWatchTarget(target: string): { success: boolean; message: string } {
    const normalized = normalizeTarget(target);
    if (!normalized) {
      return { success: false, message: 'Target cannot be empty.' };
    }
    const removed = this.watchlist.delete(normalized);
    if (!removed) {
      return { success: false, message: `Target '${normalized}' was not found.` };
    }
    return { success: true, message: `Removed '${normalized}' from watchlist.` };
  }

  setResponseMode(mode: IntelResponseMode): { success: boolean; message: string } {
    this.responseMode = mode;
    if (mode === 'autonomous') {
      return {
        success: true,
        message: 'Response mode set to autonomous. Human approval is still required for publish actions.',
      };
    }
    return { success: true, message: `Response mode set to ${mode}.` };
  }

  async scan(input: ThreatIntelScanInput = {}): Promise<{
    success: boolean;
    message: string;
    findings: ThreatIntelFinding[];
  }> {
    if (!this.enabled) {
      return { success: false, message: 'Threat intel is disabled.', findings: [] };
    }

    const query = input.query ? normalizeTarget(input.query) : undefined;
    const targets = query ? [query] : this.listWatchlist();
    if (targets.length === 0) {
      return {
        success: false,
        message: 'No watch targets configured. Add targets with /intel watch add <target>.',
        findings: [],
      };
    }

    const includeDarkWeb = !!input.includeDarkWeb && this.allowDarkWeb;
    const scanSources = buildSources(input.sources, includeDarkWeb);
    const scanTime = this.now();
    const created: ThreatIntelFinding[] = [];
    const unavailable: string[] = [];
    let scannedSources = 0;

    for (const sourceType of scanSources) {
      if (sourceType === 'forum') {
        const forumResult = await this.scanForumSources(targets, scanTime);
        if (forumResult.scanned) scannedSources += 1;
        if (forumResult.unavailableReason) {
          unavailable.push(`forum (${forumResult.unavailableReason})`);
        }
        if (forumResult.findings.length > 0) {
          this.findings.unshift(...forumResult.findings);
          created.push(...forumResult.findings);
        }
        continue;
      }

      const scanner = this.sourceScanners[sourceType];
      if (!scanner) {
        unavailable.push(`${sourceType} (No local connector configured.)`);
        continue;
      }

      const result = await scanner.scan({
        targets,
        includeDarkWeb,
        now: scanTime,
      });
      if (result.scanned) scannedSources += 1;
      if (result.unavailableReason) {
        unavailable.push(`${sourceType} (${result.unavailableReason})`);
      }
      if (result.findings.length === 0) continue;

      const stored = result.findings.map((finding) => this.createFindingRecord(finding, scanTime));
      this.findings.unshift(...stored);
      created.push(...stored);
    }

    this.lastScanAt = scanTime;
    if (scannedSources === 0) {
      const unavailableText = unavailable.length > 0
        ? ` ${unavailable.join(' ')}`
        : '';
      return {
        success: false,
        message: `No local threat-intel sources were available for this scan.${unavailableText}`.trim(),
        findings: [],
      };
    }

    const unavailableText = unavailable.length > 0
      ? ` ${unavailable.length} source(s) unavailable: ${unavailable.join('; ')}.`
      : '';
    return {
      success: true,
      message: `Scan completed across ${scannedSources} source(s) for ${targets.length} target(s) and produced ${created.length} finding(s).${unavailableText}`,
      findings: created,
    };
  }

  listFindings(limit = 50, status?: IntelStatus): ThreatIntelFinding[] {
    const filtered = status
      ? this.findings.filter((finding) => finding.status === status)
      : this.findings;
    return filtered.slice(0, Math.max(1, limit));
  }

  getFinding(id: string): ThreatIntelFinding | null {
    return this.findings.find((finding) => finding.id === id) ?? null;
  }

  updateFindingStatus(id: string, status: IntelStatus): { success: boolean; message: string } {
    const finding = this.findings.find((item) => item.id === id);
    if (!finding) return { success: false, message: `Finding '${id}' not found.` };
    finding.status = status;
    return { success: true, message: `Finding '${id}' marked ${status}.` };
  }

  draftAction(findingId: string, type: IntelActionType): { success: boolean; action?: ThreatIntelAction; message: string } {
    const finding = this.getFinding(findingId);
    if (!finding) {
      return { success: false, message: `Finding '${findingId}' not found.` };
    }

    if (type === 'publish_response' && finding.sourceType === 'forum') {
      const blockingConnector = this.forumConnectors.find(
        (connector) => finding.labels.includes(connector.id) && !connector.allowsActivePublishing(),
      );
      if (blockingConnector) {
        return {
          success: false,
          message: `Publish response blocked for hostile forum '${blockingConnector.id}'. Use draft_response with human approval.`,
        };
      }
    }

    const requiresApproval = type === 'publish_response' || type === 'request_takedown' || type === 'report';
    const action: ThreatIntelAction = {
      id: randomUUID(),
      findingId,
      createdAt: this.now(),
      type,
      status: 'proposed',
      requiresApproval,
      rationale: `Proposed ${type} for ${finding.target} (${finding.severity}).`,
      targetUrl: finding.url,
      draftText: type.includes('response')
        ? `Potential response draft for target '${finding.target}': This content appears misleading or harmful. Please review sources and verify authenticity before sharing.`
        : undefined,
    };
    this.actions.unshift(action);
    return { success: true, action, message: `Action '${type}' drafted.` };
  }

  listActions(limit = 50): ThreatIntelAction[] {
    return this.actions.slice(0, Math.max(1, limit));
  }

  private createFindingRecord(sourceFinding: ThreatIntelSourceFinding, createdAt: number): ThreatIntelFinding {
    return {
      id: randomUUID(),
      createdAt,
      target: sourceFinding.target,
      sourceType: sourceFinding.sourceType,
      contentType: sourceFinding.contentType,
      severity: sourceFinding.severity,
      confidence: sourceFinding.confidence,
      summary: sourceFinding.summary,
      url: sourceFinding.url,
      status: 'new',
      labels: sourceFinding.labels,
      provenance: sourceFinding.provenance,
      evidence: sourceFinding.evidence,
    };
  }

  private async scanForumSources(targets: string[], createdAt: number): Promise<{
    scanned: boolean;
    findings: ThreatIntelFinding[];
    unavailableReason?: string;
  }> {
    if (this.forumConnectors.length === 0) {
      return {
        scanned: false,
        findings: [],
        unavailableReason: 'No forum connectors configured.',
      };
    }

    const created: ThreatIntelFinding[] = [];
    const dedupe = new Set<string>();
    const errors: string[] = [];
    let scanned = false;

    for (const connector of this.forumConnectors) {
      try {
        const findings = await connector.scan(targets);
        scanned = true;
        for (const connectorFinding of findings) {
          const target = normalizeTarget(connectorFinding.target);
          const severity = connectorFinding.severity ?? classifySeverity(target, 'forum');
          const confidence = connectorFinding.confidence ?? classifyConfidence(target, 'forum');
          const key = `${target}|${connectorFinding.url ?? ''}|${connectorFinding.summary}`;
          if (dedupe.has(key)) continue;
          dedupe.add(key);

          const labels = new Set<string>([
            ...buildLabels(target, 'forum'),
            connector.id,
            ...(connectorFinding.labels ?? []),
          ]);

          created.push({
            id: randomUUID(),
            createdAt,
            target,
            sourceType: 'forum',
            contentType: connectorFinding.contentType ?? inferContentType(connectorFinding.summary),
            severity,
            confidence,
            summary: connectorFinding.summary,
            url: connectorFinding.url,
            status: 'new',
            labels: [...labels],
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${connector.id}: ${message}`);
      }
    }

    return {
      scanned,
      findings: created,
      unavailableReason: !scanned && errors.length > 0 ? errors.join('; ') : undefined,
    };
  }
}

function normalizeTarget(target: string): string {
  return target.trim().toLowerCase();
}

function buildSources(explicitSources: IntelSourceType[] | undefined, includeDarkWeb: boolean): IntelSourceType[] {
  const base: IntelSourceType[] = explicitSources && explicitSources.length > 0
    ? [...new Set(explicitSources)]
    : ['web', 'news', 'social', 'forum'];
  if (includeDarkWeb && !base.includes('darkweb')) {
    base.push('darkweb');
  }
  return base;
}

function inferContentType(target: string): IntelContentType {
  if (target.includes('image') || target.includes('photo') || target.includes('deepfake')) {
    return 'image';
  }
  if (target.includes('video')) return 'video';
  if (target.includes('voice') || target.includes('audio')) return 'audio';
  return 'text';
}

function classifySeverity(target: string, source: IntelSourceType): IntelSeverity {
  const highRiskTerms = ['deepfake', 'impersonation', 'leak', 'dox', 'fraud', 'scam', 'extortion'];
  const criticalTerms = ['sexual', 'ncII', 'revenge', 'blackmail'];
  if (criticalTerms.some((term) => target.includes(term))) return 'critical';
  if (highRiskTerms.some((term) => target.includes(term))) return source === 'darkweb' ? 'critical' : 'high';
  if (source === 'darkweb') return 'high';
  if (source === 'social' || source === 'forum') return 'medium';
  return 'low';
}

function classifyConfidence(target: string, source: IntelSourceType): number {
  let score = 0.45;
  if (source === 'news' || source === 'web') score += 0.2;
  if (source === 'darkweb') score -= 0.1;
  if (target.includes('deepfake') || target.includes('impersonation')) score += 0.2;
  return Math.max(0.1, Math.min(0.99, Number(score.toFixed(2))));
}

function buildLabels(target: string, source: IntelSourceType): string[] {
  const labels = ['monitoring', source];
  if (target.includes('deepfake')) labels.push('deepfake');
  if (target.includes('impersonation')) labels.push('impersonation');
  if (target.includes('scam') || target.includes('fraud')) labels.push('fraud');
  return labels;
}
