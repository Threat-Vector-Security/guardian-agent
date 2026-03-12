import { describe, it, expect } from 'vitest';
import {
  ThreatIntelService,
  type ThreatIntelSourceScanner,
  type ThreatIntelSourceScanInput,
} from './threat-intel.js';
import type { ForumConnector } from './forum-connector.js';

function createScanner(
  sourceType: ThreatIntelSourceScanner['sourceType'],
  handler: (input: ThreatIntelSourceScanInput) => Promise<Awaited<ReturnType<ThreatIntelSourceScanner['scan']>>>,
): ThreatIntelSourceScanner {
  return {
    sourceType,
    scan: handler,
  };
}

describe('ThreatIntelService', () => {
  it('manages watchlist entries with normalization', () => {
    const intel = new ThreatIntelService({
      enabled: true,
      allowDarkWeb: false,
      responseMode: 'assisted',
      watchlist: [],
      now: () => 1000,
    });

    const add = intel.addWatchTarget('  Example User  ');
    expect(add.success).toBe(true);
    expect(intel.listWatchlist()).toEqual(['example user']);

    const duplicate = intel.addWatchTarget('example user');
    expect(duplicate.success).toBe(false);
  });

  it('returns unavailable when no real sources are configured', async () => {
    const intel = new ThreatIntelService({
      enabled: true,
      allowDarkWeb: true,
      responseMode: 'assisted',
      watchlist: ['target'],
      now: () => 2000,
    });

    const result = await intel.scan({ includeDarkWeb: true });
    expect(result.success).toBe(false);
    expect(result.findings).toEqual([]);
    expect(result.message).toContain('No local threat-intel sources were available');
  });

  it('runs scans through injected source scanners and stores provenance', async () => {
    const webScanner = createScanner('web', async ({ targets }) => ({
      sourceType: 'web',
      scanned: true,
      findings: [{
        target: targets[0],
        sourceType: 'web',
        contentType: 'text',
        severity: 'high',
        confidence: 0.82,
        summary: `Detected fraud signal for '${targets[0]}' from web source: Example alert.`,
        url: 'https://example.com/alert',
        labels: ['monitoring', 'web', 'fraud'],
        provenance: {
          provider: 'duckduckgo',
          query: `"${targets[0]}" fraud scam impersonation`,
          title: 'Example alert',
          snippet: 'Target identity theft and fraud report.',
        },
        evidence: [{
          kind: 'search_result',
          content: 'Target identity theft and fraud report.',
          title: 'Example alert',
          url: 'https://example.com/alert',
        }],
      }],
    }));

    const intel = new ThreatIntelService({
      enabled: true,
      allowDarkWeb: true,
      responseMode: 'assisted',
      watchlist: ['target'],
      sourceScanners: { web: webScanner },
      now: () => 2000,
    });

    const result = await intel.scan({ sources: ['web', 'darkweb'] });
    expect(result.success).toBe(true);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.provenance?.provider).toBe('duckduckgo');
    expect(result.findings[0]?.evidence?.[0]?.kind).toBe('search_result');
    expect(intel.getSummary().findings.total).toBe(1);
    expect(result.message).toContain('1 source(s) unavailable');
  });

  it('supports status updates and action drafts for scanner-backed findings', async () => {
    const socialScanner = createScanner('social', async ({ targets }) => ({
      sourceType: 'social',
      scanned: true,
      findings: [{
        target: targets[0],
        sourceType: 'social',
        contentType: 'image',
        severity: 'high',
        confidence: 0.77,
        summary: `Detected impersonation for '${targets[0]}' from social source: Fake profile.`,
        url: 'https://x.com/fake-profile',
        labels: ['monitoring', 'social', 'impersonation', 'social_profile'],
      }],
    }));

    const intel = new ThreatIntelService({
      enabled: true,
      allowDarkWeb: false,
      responseMode: 'manual',
      watchlist: ['deepfake impersonation'],
      sourceScanners: { social: socialScanner },
      now: () => 3000,
    });

    const scan = await intel.scan({ sources: ['social'] });
    const finding = scan.findings[0];
    expect(finding).toBeDefined();

    const status = intel.updateFindingStatus(finding.id, 'triaged');
    expect(status.success).toBe(true);

    const drafted = intel.draftAction(finding.id, 'report');
    expect(drafted.success).toBe(true);
    expect(drafted.action?.requiresApproval).toBe(true);
  });

  it('blocks publish_response for hostile forum connectors without active publishing permission', async () => {
    const forumConnector: ForumConnector = {
      id: 'moltbook',
      sourceType: 'forum',
      allowsActivePublishing: () => false,
      status: () => ({ id: 'moltbook', enabled: true, hostile: true, mode: 'mock' }),
      scan: async (targets) => [
        {
          target: targets[0],
          summary: `Moltbook post about ${targets[0]} with impersonation signals.`,
          url: 'https://moltbook.com/post/1',
          severity: 'high',
          confidence: 0.8,
          labels: ['moltbook', 'hostile_site', 'impersonation'],
        },
      ],
    };

    const intel = new ThreatIntelService({
      enabled: true,
      allowDarkWeb: false,
      responseMode: 'assisted',
      watchlist: ['target-person'],
      forumConnectors: [forumConnector],
      now: () => 4000,
    });

    const scan = await intel.scan({ sources: ['forum'] });
    expect(scan.findings.length).toBe(1);
    const publishDraft = intel.draftAction(scan.findings[0].id, 'publish_response');
    expect(publishDraft.success).toBe(false);
    expect(publishDraft.message).toContain('blocked');
  });
});
