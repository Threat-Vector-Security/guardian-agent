/**
 * Lightweight JSON persistence for marketing contacts/campaigns.
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export interface MarketingContact {
  id: string;
  email: string;
  name?: string;
  company?: string;
  tags: string[];
  source?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  subjectTemplate: string;
  bodyTemplate: string;
  contactIds: string[];
  status: 'draft' | 'ready' | 'running' | 'completed';
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  lastRunSummary?: {
    attempted: number;
    sent: number;
    failed: number;
  };
}

export interface CampaignMessageDraft {
  campaignId: string;
  contactId: string;
  email: string;
  subject: string;
  body: string;
}

interface MarketingSendResult {
  contactId: string;
  email: string;
  status: 'sent' | 'failed';
  messageId?: string;
  error?: string;
}

interface MarketingRunRecord {
  id: string;
  campaignId: string;
  contactId: string;
  email: string;
  status: 'sent' | 'failed';
  messageId?: string;
  error?: string;
  timestamp: number;
}

interface MarketingState {
  version: 1;
  contacts: MarketingContact[];
  campaigns: MarketingCampaign[];
  runs: MarketingRunRecord[];
}

export interface ContactSeed {
  email: string;
  name?: string;
  company?: string;
  tags?: string[];
  source?: string;
}

export class MarketingStore {
  private readonly filePath: string;
  private readonly now: () => number;

  constructor(workspaceRoot: string, now: () => number = Date.now) {
    this.filePath = resolve(workspaceRoot, '.guardianagent', 'marketing-state.json');
    this.now = now;
  }

  async listContacts(limit = 100, query?: string, tag?: string): Promise<MarketingContact[]> {
    const state = await this.load();
    const normalizedQuery = (query ?? '').trim().toLowerCase();
    const normalizedTag = (tag ?? '').trim().toLowerCase();
    let rows = state.contacts;

    if (normalizedQuery) {
      rows = rows.filter((contact) => {
        const haystack = `${contact.name ?? ''} ${contact.company ?? ''} ${contact.email}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      });
    }
    if (normalizedTag) {
      rows = rows.filter((contact) => contact.tags.some((item) => item.toLowerCase() === normalizedTag));
    }

    const sorted = [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
    return sorted.slice(0, Math.max(1, Math.min(1000, limit)));
  }

  async upsertContacts(seeds: ContactSeed[]): Promise<{
    added: number;
    updated: number;
    contacts: MarketingContact[];
  }> {
    const state = await this.load();
    const byEmail = new Map<string, MarketingContact>();
    for (const contact of state.contacts) {
      byEmail.set(normalizeEmail(contact.email), contact);
    }

    let added = 0;
    let updated = 0;
    const changed: MarketingContact[] = [];

    for (const seed of seeds) {
      const normalizedEmail = normalizeEmail(seed.email);
      if (!normalizedEmail) continue;

      const now = this.now();
      const existing = byEmail.get(normalizedEmail);
      if (!existing) {
        const created: MarketingContact = {
          id: randomUUID(),
          email: normalizedEmail,
          name: clean(seed.name),
          company: clean(seed.company),
          tags: sanitizeTags(seed.tags),
          source: clean(seed.source),
          createdAt: now,
          updatedAt: now,
        };
        state.contacts.push(created);
        byEmail.set(normalizedEmail, created);
        changed.push(created);
        added += 1;
        continue;
      }

      let touched = false;
      const incomingName = clean(seed.name);
      const incomingCompany = clean(seed.company);
      const incomingSource = clean(seed.source);
      if (incomingName && incomingName !== existing.name) {
        existing.name = incomingName;
        touched = true;
      }
      if (incomingCompany && incomingCompany !== existing.company) {
        existing.company = incomingCompany;
        touched = true;
      }
      if (incomingSource && incomingSource !== existing.source) {
        existing.source = incomingSource;
        touched = true;
      }

      const mergedTags = mergeTags(existing.tags, sanitizeTags(seed.tags));
      if (mergedTags.length !== existing.tags.length) {
        existing.tags = mergedTags;
        touched = true;
      }

      if (touched) {
        existing.updatedAt = now;
        changed.push(existing);
        updated += 1;
      }
    }

    await this.save(state);
    return {
      added,
      updated,
      contacts: changed,
    };
  }

  async listCampaigns(limit = 100): Promise<MarketingCampaign[]> {
    const state = await this.load();
    return [...state.campaigns]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, Math.max(1, Math.min(1000, limit)));
  }

  async createCampaign(input: {
    name: string;
    subjectTemplate: string;
    bodyTemplate: string;
    contactIds?: string[];
  }): Promise<MarketingCampaign> {
    const state = await this.load();
    const now = this.now();
    const filteredContactIds = uniqueNonEmpty(input.contactIds ?? []);
    const campaign: MarketingCampaign = {
      id: randomUUID(),
      name: input.name.trim(),
      subjectTemplate: input.subjectTemplate,
      bodyTemplate: input.bodyTemplate,
      contactIds: filteredContactIds.filter((id) => state.contacts.some((c) => c.id === id)),
      status: filteredContactIds.length > 0 ? 'ready' : 'draft',
      createdAt: now,
      updatedAt: now,
    };
    state.campaigns.push(campaign);
    await this.save(state);
    return campaign;
  }

  async addContactsToCampaign(campaignId: string, contactIds: string[]): Promise<MarketingCampaign> {
    const state = await this.load();
    const campaign = state.campaigns.find((item) => item.id === campaignId);
    if (!campaign) {
      throw new Error(`Campaign '${campaignId}' was not found.`);
    }

    const validContactIds = new Set(state.contacts.map((contact) => contact.id));
    const additions = uniqueNonEmpty(contactIds).filter((id) => validContactIds.has(id));
    if (additions.length === 0) {
      throw new Error('No valid contact IDs were provided.');
    }

    const merged = new Set([...campaign.contactIds, ...additions]);
    campaign.contactIds = [...merged];
    campaign.status = campaign.contactIds.length > 0 ? 'ready' : 'draft';
    campaign.updatedAt = this.now();

    await this.save(state);
    return campaign;
  }

  async buildCampaignDrafts(campaignId: string, limit = 20): Promise<CampaignMessageDraft[]> {
    const state = await this.load();
    const campaign = state.campaigns.find((item) => item.id === campaignId);
    if (!campaign) {
      throw new Error(`Campaign '${campaignId}' was not found.`);
    }
    if (campaign.contactIds.length === 0) {
      return [];
    }

    const byId = new Map(state.contacts.map((contact) => [contact.id, contact]));
    const drafts: CampaignMessageDraft[] = [];
    for (const contactId of campaign.contactIds) {
      const contact = byId.get(contactId);
      if (!contact) continue;
      const context = {
        name: contact.name ?? '',
        company: contact.company ?? '',
        email: contact.email,
      };
      drafts.push({
        campaignId: campaign.id,
        contactId: contact.id,
        email: contact.email,
        subject: applyTemplate(campaign.subjectTemplate, context),
        body: applyTemplate(campaign.bodyTemplate, context),
      });
      if (drafts.length >= Math.max(1, Math.min(500, limit))) break;
    }

    return drafts;
  }

  async recordCampaignRun(
    campaignId: string,
    results: MarketingSendResult[],
  ): Promise<MarketingCampaign> {
    const state = await this.load();
    const campaign = state.campaigns.find((item) => item.id === campaignId);
    if (!campaign) {
      throw new Error(`Campaign '${campaignId}' was not found.`);
    }

    const now = this.now();
    for (const result of results) {
      state.runs.unshift({
        id: randomUUID(),
        campaignId,
        contactId: result.contactId,
        email: result.email,
        status: result.status,
        messageId: result.messageId,
        error: clean(result.error),
        timestamp: now,
      });
    }
    if (state.runs.length > 5000) {
      state.runs.length = 5000;
    }

    const sent = results.filter((item) => item.status === 'sent').length;
    const failed = results.length - sent;
    campaign.lastRunAt = now;
    campaign.lastRunSummary = {
      attempted: results.length,
      sent,
      failed,
    };
    campaign.status = failed === 0 ? 'completed' : 'ready';
    campaign.updatedAt = now;

    await this.save(state);
    return campaign;
  }

  private async load(): Promise<MarketingState> {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<MarketingState>;
      return normalizeState(parsed);
    } catch {
      return {
        version: 1,
        contacts: [],
        campaigns: [],
        runs: [],
      };
    }
  }

  private async save(state: MarketingState): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(state, null, 2), 'utf-8');
  }
}

function normalizeState(input: Partial<MarketingState>): MarketingState {
  const contacts = Array.isArray(input.contacts)
    ? input.contacts.filter((item): item is MarketingContact => !!item && typeof item.email === 'string' && typeof item.id === 'string')
    : [];
  const campaigns = Array.isArray(input.campaigns)
    ? input.campaigns.filter((item): item is MarketingCampaign => !!item && typeof item.id === 'string' && typeof item.name === 'string')
    : [];
  const runs = Array.isArray(input.runs)
    ? input.runs.filter((item): item is MarketingRunRecord => !!item && typeof item.id === 'string')
    : [];

  return {
    version: 1,
    contacts,
    campaigns,
    runs,
  };
}

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!email) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  return email;
}

function sanitizeTags(tags: string[] | undefined): string[] {
  if (!tags || tags.length === 0) return [];
  return uniqueNonEmpty(tags.map((tag) => tag.toLowerCase()));
}

function mergeTags(left: string[], right: string[]): string[] {
  return uniqueNonEmpty([...left, ...right]);
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function clean(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function applyTemplate(template: string, context: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => context[key] ?? '');
}
