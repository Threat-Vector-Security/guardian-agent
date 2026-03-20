/**
 * Per-agent persistent knowledge base with trust-aware metadata.
 *
 * Active reviewed content remains readable as markdown for operator auditability.
 * Trust, provenance, TTL, and quarantine state live in a sidecar JSON index.
 */

import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { ControlPlaneIntegrity } from '../guardian/control-plane-integrity.js';
import { detectInjection, stripInvisibleChars } from '../guardian/input-sanitizer.js';
import { mkdirSecureSync, writeSecureFileSync } from '../util/secure-fs.js';

export type MemorySourceType = 'user' | 'local_tool' | 'remote_tool' | 'system' | 'operator';
export type MemoryTrustLevel = 'trusted' | 'untrusted' | 'reviewed';
export type MemoryStatus = 'active' | 'quarantined' | 'expired' | 'rejected';

/** Configuration for the agent knowledge base. */
export interface AgentMemoryStoreConfig {
  enabled: boolean;
  basePath?: string;
  readOnly: boolean;
  maxContextChars: number;
  maxFileChars: number;
  integrity?: ControlPlaneIntegrity;
  onSecurityEvent?: (event: {
    severity: 'info' | 'warn' | 'critical';
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }) => void;
}

export const DEFAULT_MEMORY_STORE_CONFIG: AgentMemoryStoreConfig = {
  enabled: true,
  readOnly: false,
  maxContextChars: 4000,
  maxFileChars: 20000,
  integrity: undefined,
  onSecurityEvent: undefined,
};

export interface MemoryProvenance {
  toolName?: string;
  domain?: string;
  sessionId?: string;
  requestId?: string;
  taintReasons?: string[];
}

/** A single memory entry with metadata. */
export interface MemoryEntry {
  content: string;
  createdAt: string;
  category?: string;
  sourceType?: MemorySourceType;
  trustLevel?: MemoryTrustLevel;
  status?: MemoryStatus;
  createdByPrincipal?: string;
  expiresAt?: string;
  tags?: string[];
  provenance?: MemoryProvenance;
}

export interface StoredMemoryEntry extends MemoryEntry {
  id: string;
  contentHash: string;
}

interface MemoryIndexFile {
  version: 1;
  entries: StoredMemoryEntry[];
}

const EMPTY_INDEX: MemoryIndexFile = { version: 1, entries: [] };
const MEMORY_CONTEXT_BLOCK_THRESHOLD = 3;

export class AgentMemoryStore {
  private basePath: string;
  private config: AgentMemoryStoreConfig;
  private readonly cache = new Map<string, string>();
  private readonly indexCache = new Map<string, MemoryIndexFile>();

  constructor(config: Partial<AgentMemoryStoreConfig> = {}) {
    this.config = { ...DEFAULT_MEMORY_STORE_CONFIG, ...config };
    this.basePath = this.config.basePath ?? join(homedir(), '.guardianagent', 'memory');

    if (this.config.enabled) {
      mkdirSecureSync(this.basePath);
    }
  }

  private safeAgentId(agentId: string): string {
    return agentId.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /** Resolve the markdown path for an agent's knowledge base. */
  private filePath(agentId: string): string {
    return join(this.basePath, `${this.safeAgentId(agentId)}.md`);
  }

  /** Resolve the sidecar index path for an agent's knowledge base metadata. */
  private indexPath(agentId: string): string {
    return join(this.basePath, `${this.safeAgentId(agentId)}.index.json`);
  }

  private computeContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private emitSecurityEvent(event: {
    severity: 'info' | 'warn' | 'critical';
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }): void {
    this.config.onSecurityEvent?.(event);
  }

  private assertWritable(): void {
    if (this.config.readOnly) {
      throw new Error('Persistent memory is read-only.');
    }
  }

  private readIndex(agentId: string): MemoryIndexFile {
    const cached = this.indexCache.get(agentId);
    if (cached) {
      return this.applyExpiry(agentId, cached);
    }

    const path = this.indexPath(agentId);
    if (!existsSync(path)) {
      this.indexCache.set(agentId, { ...EMPTY_INDEX, entries: [] });
      return { ...EMPTY_INDEX, entries: [] };
    }

    if (this.config.integrity) {
      const verification = this.config.integrity.verifyFileSync(path, {
        adoptUntracked: true,
        updatedBy: 'memory_index_load',
      });
      if (!verification.ok) {
        this.indexCache.delete(agentId);
        this.cache.delete(agentId);
        this.emitSecurityEvent({
          severity: 'critical',
          code: 'memory_index_integrity_violation',
          message: verification.message,
          details: {
            agentId,
            path,
            integrityCode: verification.code,
          },
        });
        return { ...EMPTY_INDEX, entries: [] };
      }
    }

    try {
      const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<MemoryIndexFile>;
      const file: MemoryIndexFile = {
        version: 1,
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      };
      this.indexCache.set(agentId, file);
      return this.applyExpiry(agentId, file);
    } catch {
      const empty = { ...EMPTY_INDEX, entries: [] };
      this.indexCache.set(agentId, empty);
      return empty;
    }
  }

  private writeIndex(agentId: string, index: MemoryIndexFile): void {
    const path = this.indexPath(agentId);
    writeSecureFileSync(path, JSON.stringify(index, null, 2));
    this.config.integrity?.signFileSync(path, 'memory_index_write');
    this.indexCache.set(agentId, index);
  }

  private applyExpiry(agentId: string, index: MemoryIndexFile): MemoryIndexFile {
    if (this.config.readOnly) {
      return index;
    }

    let changed = false;
    const now = Date.now();
    const nextEntries = index.entries.map((entry) => {
      if (entry.status === 'active' && entry.expiresAt) {
        const expiresAt = Date.parse(entry.expiresAt);
        if (Number.isFinite(expiresAt) && expiresAt <= now) {
          changed = true;
          return { ...entry, status: 'expired' as const };
        }
      }
      return entry;
    });

    if (!changed) {
      return index;
    }

    const next = { ...index, entries: nextEntries };
    this.writeIndex(agentId, next);
    this.rebuildMarkdown(agentId, next);
    return next;
  }

  private renderMarkdown(
    agentId: string,
    index: MemoryIndexFile,
    options?: { sanitizeForPrompt?: boolean },
  ): string {
    const sanitizeForPrompt = options?.sanitizeForPrompt === true;
    const lines: string[] = [];
    const grouped = new Map<string, string[]>();

    for (const entry of index.entries) {
      if (entry.status !== 'active') continue;

      const renderedContent = sanitizeForPrompt
        ? this.sanitizeEntryForPrompt(agentId, entry)
        : entry.content;
      if (!renderedContent) continue;

      const heading = sanitizeForPrompt
        ? this.sanitizeHeadingForPrompt(entry.category)
        : entry.category?.trim() || 'General';
      const list = grouped.get(heading) ?? [];
      const trust = entry.trustLevel && entry.trustLevel !== 'trusted'
        ? ` [${entry.trustLevel}]`
        : '';
      list.push(`- ${renderedContent}${trust} _(${entry.createdAt})_`);
      grouped.set(heading, list);
    }

    for (const [heading, entries] of grouped.entries()) {
      if (lines.length > 0) lines.push('');
      lines.push(`## ${heading}`);
      lines.push(...entries);
    }

    return lines.join('\n');
  }

  private rebuildMarkdown(agentId: string, index?: MemoryIndexFile): void {
    const effectiveIndex = index ?? this.readIndex(agentId);
    const content = this.renderMarkdown(agentId, effectiveIndex);
    const path = this.filePath(agentId);
    writeSecureFileSync(path, content);
    this.cache.set(agentId, content);
  }

  private enforceFileBudget(agentId: string, index: MemoryIndexFile): MemoryIndexFile {
    const renderLength = (candidate: MemoryIndexFile): number => this.renderMarkdown(agentId, candidate).length;
    if (renderLength(index) <= this.config.maxFileChars) {
      return index;
    }

    const nextEntries = index.entries.map((entry) => ({ ...entry }));
    let compacted = 0;
    for (let i = nextEntries.length - 1; i > 0 && renderLength({ ...index, entries: nextEntries }) > this.config.maxFileChars; i--) {
      if (nextEntries[i]?.status !== 'active') continue;
      nextEntries[i] = { ...nextEntries[i]!, status: 'expired' };
      compacted++;
    }

    const nextIndex: MemoryIndexFile = { ...index, entries: nextEntries };
    if (renderLength(nextIndex) > this.config.maxFileChars) {
      throw new Error(`Persistent memory exceeds maxFileChars (${this.config.maxFileChars}).`);
    }

    if (compacted > 0) {
      this.emitSecurityEvent({
        severity: 'info',
        code: 'memory_file_budget_compacted',
        message: `Compacted older active entries to respect maxFileChars (${this.config.maxFileChars}).`,
        details: {
          agentId,
          compactedEntries: compacted,
          maxFileChars: this.config.maxFileChars,
        },
      });
    }

    return nextIndex;
  }

  load(agentId: string): string {
    if (!this.config.enabled) return '';

    const indexFileExists = existsSync(this.indexPath(agentId));
    if (indexFileExists) {
      const rendered = this.renderMarkdown(agentId, this.readIndex(agentId), { sanitizeForPrompt: true });
      this.cache.set(agentId, rendered);
      return rendered;
    }

    const cached = this.cache.get(agentId);
    if (cached !== undefined) return cached;

    const path = this.filePath(agentId);
    if (!existsSync(path)) {
      this.cache.set(agentId, '');
      return '';
    }

    try {
      const content = readFileSync(path, 'utf-8');
      this.cache.set(agentId, content);
      return content;
    } catch {
      return '';
    }
  }

  loadForContext(agentId: string): string {
    const indexPath = this.indexPath(agentId);
    const full = existsSync(indexPath)
      ? this.renderMarkdown(agentId, this.readIndex(agentId), { sanitizeForPrompt: true })
      : this.load(agentId);
    if (!full) return '';

    if (full.length <= this.config.maxContextChars) return full;
    return full.slice(0, this.config.maxContextChars) + '\n\n[... knowledge base truncated — use memory_search to find specific facts]';
  }

  save(agentId: string, content: string): void {
    if (!this.config.enabled) return;
    this.assertWritable();

    const path = this.filePath(agentId);
    if (content.length > this.config.maxFileChars) {
      throw new Error(`Persistent memory exceeds maxFileChars (${this.config.maxFileChars}).`);
    }
    writeSecureFileSync(path, content);
    this.cache.set(agentId, content);
  }

  append(agentId: string, entry: MemoryEntry): StoredMemoryEntry {
    if (!this.config.enabled) {
      return {
        id: randomUUID(),
        contentHash: this.computeContentHash(entry.content),
        content: entry.content,
        createdAt: entry.createdAt,
        category: entry.category,
      };
    }
    this.assertWritable();

    const index = this.readIndex(agentId);
    const stored: StoredMemoryEntry = {
      id: randomUUID(),
      content: entry.content,
      createdAt: entry.createdAt,
      category: entry.category,
      sourceType: entry.sourceType ?? 'user',
      trustLevel: entry.trustLevel ?? 'trusted',
      status: entry.status ?? 'active',
      createdByPrincipal: entry.createdByPrincipal,
      expiresAt: entry.expiresAt,
      tags: entry.tags ? [...entry.tags] : undefined,
      provenance: entry.provenance ? { ...entry.provenance } : undefined,
      contentHash: this.computeContentHash(entry.content),
    };

    const nextIndex = this.enforceFileBudget(agentId, {
      ...index,
      entries: [stored, ...index.entries],
    });
    this.writeIndex(agentId, nextIndex);
    this.rebuildMarkdown(agentId, nextIndex);

    return stored;
  }

  appendRaw(agentId: string, text: string): void {
    const createdAt = new Date().toISOString().slice(0, 10);
    this.append(agentId, {
      content: text,
      createdAt,
      category: 'General',
      sourceType: 'system',
      trustLevel: 'trusted',
      status: 'active',
    });
  }

  getEntries(agentId: string, includeInactive = false): StoredMemoryEntry[] {
    const index = this.readIndex(agentId);
    return includeInactive
      ? [...index.entries]
      : index.entries.filter((entry) => entry.status === 'active');
  }

  findEntry(agentId: string, entryId: string): StoredMemoryEntry | undefined {
    return this.readIndex(agentId).entries.find((entry) => entry.id === entryId);
  }

  isEntryActive(agentId: string, entryId: string): boolean {
    return this.findEntry(agentId, entryId)?.status === 'active';
  }

  searchEntries(
    agentId: string,
    query: string,
    options?: { includeInactive?: boolean; limit?: number },
  ): StoredMemoryEntry[] {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    const limit = Math.max(1, Math.min(options?.limit ?? 10, 50));
    const entries = this.getEntries(agentId, options?.includeInactive);

    return entries
      .filter((entry) => {
        const category = entry.category?.toLowerCase() ?? '';
        const tags = Array.isArray(entry.tags) ? entry.tags.join(' ').toLowerCase() : '';
        return entry.content.toLowerCase().includes(normalizedQuery)
          || category.includes(normalizedQuery)
          || tags.includes(normalizedQuery);
      })
      .slice(0, limit)
      .map((entry) => ({ ...entry }));
  }

  search(agentId: string, query: string, options?: { includeInactive?: boolean }): string[] {
    const matchedEntries = this.searchEntries(agentId, query, options);
    if (options?.includeInactive) {
      return matchedEntries.map((entry) => {
        const category = entry.category?.trim() || 'General';
        return `## ${category}\n- [${entry.status}] ${entry.content} _(${entry.createdAt})_`;
      });
    }

    const content = this.load(agentId);
    if (!content) return [];

    const lines = content.split('\n');
    const matches: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(query.trim().toLowerCase())) {
        const start = Math.max(0, i - 1);
        const end = Math.min(lines.length - 1, i + 1);
        matches.push(lines.slice(start, end + 1).join('\n'));
      }
    }
    return matches;
  }

  exists(agentId: string): boolean {
    if (!this.config.enabled) return false;
    if (existsSync(this.indexPath(agentId))) {
      return this.readIndex(agentId).entries.length > 0;
    }
    return existsSync(this.filePath(agentId));
  }

  size(agentId: string): number {
    return this.load(agentId).length;
  }

  isReadOnly(): boolean {
    return this.config.readOnly;
  }

  updateConfig(next: Partial<AgentMemoryStoreConfig>): void {
    const merged = { ...this.config, ...next };
    const nextBasePath = merged.basePath ?? join(homedir(), '.guardianagent', 'memory');
    const basePathChanged = nextBasePath !== this.basePath;
    this.config = merged;
    this.basePath = nextBasePath;

    if (this.config.enabled) {
      mkdirSecureSync(this.basePath);
    }

    if (basePathChanged) {
      this.clearCache();
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.indexCache.clear();
  }

  delete(agentId: string): boolean {
    if (!this.config.enabled) return false;

    try {
      const { unlinkSync } = require('node:fs') as typeof import('node:fs');
      const markdownPath = this.filePath(agentId);
      const indexPath = this.indexPath(agentId);
      if (existsSync(markdownPath)) unlinkSync(markdownPath);
      if (existsSync(indexPath)) unlinkSync(indexPath);
      this.config.integrity?.removeFileSync(indexPath, 'memory_index_delete');
      this.cache.delete(agentId);
      this.indexCache.delete(agentId);
      return true;
    } catch {
      return false;
    }
  }

  listAgents(): string[] {
    if (!this.config.enabled) return [];

    try {
      const { readdirSync } = require('node:fs') as typeof import('node:fs');
      const files = readdirSync(this.basePath) as string[];
      const ids = new Set<string>();
      for (const file of files) {
        if (file.endsWith('.md')) ids.add(file.replace(/\.md$/, ''));
        if (file.endsWith('.index.json')) ids.add(file.replace(/\.index\.json$/, ''));
      }
      return [...ids];
    } catch {
      return [];
    }
  }

  private sanitizeHeadingForPrompt(category?: string): string {
    const cleaned = stripInvisibleChars(category?.trim() || 'General').replace(/\s+/g, ' ').trim();
    if (!cleaned) return 'General';
    const detection = detectInjection(cleaned);
    return detection.score >= MEMORY_CONTEXT_BLOCK_THRESHOLD ? 'General' : cleaned;
  }

  private sanitizeEntryForPrompt(agentId: string, entry: StoredMemoryEntry): string | null {
    const cleaned = stripInvisibleChars(entry.content).trim();
    if (!cleaned) return null;
    const detection = detectInjection(cleaned);
    if (detection.score >= MEMORY_CONTEXT_BLOCK_THRESHOLD) {
      this.emitSecurityEvent({
        severity: 'warn',
        code: 'memory_context_entry_blocked',
        message: 'Blocked suspicious memory entry from prompt context.',
        details: {
          agentId,
          entryId: entry.id,
          category: entry.category,
          score: detection.score,
          signals: detection.signals,
        },
      });
      return null;
    }
    return cleaned;
  }
}
