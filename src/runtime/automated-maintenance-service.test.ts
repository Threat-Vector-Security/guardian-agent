import { afterEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { AgentMemoryStore } from './agent-memory-store.js';
import { CodeSessionStore } from './code-sessions.js';
import { MemoryMutationService } from './memory-mutation-service.js';
import { AutomatedMaintenanceService } from './automated-maintenance-service.js';

const createdDirs: string[] = [];

afterEach(() => {
  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeMemoryStore(prefix: string): AgentMemoryStore {
  const basePath = join(tmpdir(), `${prefix}-${randomUUID()}`);
  createdDirs.push(basePath);
  return new AgentMemoryStore({
    enabled: true,
    basePath,
    readOnly: false,
    maxContextChars: 500,
    maxFileChars: 5000,
    maxEntryChars: 4000,
    maxEntriesPerScope: 500,
    maxEmbeddingCacheBytes: 50_000_000,
  });
}

function makeCodeSessionStore(nowRef: { current: number }): CodeSessionStore {
  const sqlitePath = join(tmpdir(), `guardianagent-code-sessions-${randomUUID()}.sqlite`);
  return new CodeSessionStore({
    enabled: false,
    sqlitePath,
    now: () => nowRef.current,
  });
}

describe('AutomatedMaintenanceService', () => {
  it('runs idle-time memory hygiene for the global scope and idle code sessions only', async () => {
    const principalMemoryScopeId = 'agent-1';
    const globalMemoryStore = makeMemoryStore('guardianagent-maint-global');
    const codeSessionMemoryStore = makeMemoryStore('guardianagent-maint-code');
    const nowRef = { current: Date.parse('2026-04-10T12:00:00.000Z') };
    const codeSessionStore = makeCodeSessionStore(nowRef);

    const archivedGlobalDuplicate = globalMemoryStore.append(principalMemoryScopeId, {
      content: '## Context Flush\nobjective:\nGlobal duplicate',
      summary: 'Global duplicate.',
      createdAt: '2026-04-08',
      category: 'Context Flushes',
      sourceType: 'system',
      trustLevel: 'trusted',
      status: 'active',
      tags: ['context_flush'],
      artifact: {
        sourceClass: 'derived',
        kind: 'memory_entry',
        memoryClass: 'collection',
      },
    });
    globalMemoryStore.append(principalMemoryScopeId, {
      content: '## Context Flush\nobjective:\nGlobal duplicate',
      summary: 'Global duplicate.',
      createdAt: '2026-04-09',
      category: 'Context Flushes',
      sourceType: 'system',
      trustLevel: 'trusted',
      status: 'active',
      tags: ['context_flush'],
      artifact: {
        sourceClass: 'derived',
        kind: 'memory_entry',
        memoryClass: 'collection',
      },
    });

    nowRef.current = Date.parse('2026-04-10T09:00:00.000Z');
    const idleSession = codeSessionStore.createSession({
      ownerUserId: 'owner',
      title: 'Idle Repo',
      workspaceRoot: '/repo/idle',
    });
    nowRef.current = Date.parse('2026-04-10T11:55:00.000Z');
    const activeSession = codeSessionStore.createSession({
      ownerUserId: 'owner',
      title: 'Active Repo',
      workspaceRoot: '/repo/active',
    });
    nowRef.current = Date.parse('2026-04-10T12:00:00.000Z');

    const archivedIdleDuplicate = codeSessionMemoryStore.append(idleSession.id, {
      content: '## Context Flush\nobjective:\nIdle duplicate',
      summary: 'Idle duplicate.',
      createdAt: '2026-04-09',
      category: 'Context Flushes',
      sourceType: 'system',
      trustLevel: 'trusted',
      status: 'active',
      tags: ['context_flush'],
      artifact: {
        sourceClass: 'derived',
        kind: 'memory_entry',
        memoryClass: 'collection',
      },
    });
    codeSessionMemoryStore.append(idleSession.id, {
      content: '## Context Flush\nobjective:\nIdle duplicate',
      summary: 'Idle duplicate.',
      createdAt: '2026-04-10',
      category: 'Context Flushes',
      sourceType: 'system',
      trustLevel: 'trusted',
      status: 'active',
      tags: ['context_flush'],
      artifact: {
        sourceClass: 'derived',
        kind: 'memory_entry',
        memoryClass: 'collection',
      },
    });

    codeSessionMemoryStore.append(activeSession.id, {
      content: '## Context Flush\nobjective:\nRecent duplicate',
      summary: 'Recent duplicate.',
      createdAt: '2026-04-09',
      category: 'Context Flushes',
      sourceType: 'system',
      trustLevel: 'trusted',
      status: 'active',
      tags: ['context_flush'],
      artifact: {
        sourceClass: 'derived',
        kind: 'memory_entry',
        memoryClass: 'collection',
      },
    });
    const recentDuplicate = codeSessionMemoryStore.append(activeSession.id, {
      content: '## Context Flush\nobjective:\nRecent duplicate',
      summary: 'Recent duplicate.',
      createdAt: '2026-04-10',
      category: 'Context Flushes',
      sourceType: 'system',
      trustLevel: 'trusted',
      status: 'active',
      tags: ['context_flush'],
      artifact: {
        sourceClass: 'derived',
        kind: 'memory_entry',
        memoryClass: 'collection',
      },
    });

    const memoryMutationService = new MemoryMutationService({
      now: () => nowRef.current,
    });
    const service = new AutomatedMaintenanceService({
      getConfig: () => ({
        enabled: true,
        sweepIntervalMs: 300000,
        idleAfterMs: 1800000,
        jobs: {
          memoryHygiene: {
            enabled: true,
            includeGlobalScope: true,
            includeCodeSessions: true,
            maxScopesPerSweep: 5,
            minIntervalMs: 3600000,
          },
        },
      }),
      getRuntimeActivity: () => ({
        queuedCount: 0,
        runningCount: 0,
        lastActivityAt: Date.parse('2026-04-10T09:30:00.000Z'),
      }),
      getPrincipalMemoryScopeId: () => principalMemoryScopeId,
      globalMemoryStore,
      codeSessionMemoryStore,
      codeSessionStore,
      memoryMutationService,
      now: () => nowRef.current,
    });

    const result = await service.runSweep();

    expect(result.skippedReason).toBeUndefined();
    expect(result.failedScopes).toEqual([]);
    expect(result.executedScopes.map((entry) => [entry.scope, entry.scopeId])).toEqual([
      ['global', principalMemoryScopeId],
      ['code_session', idleSession.id],
    ]);
    expect(globalMemoryStore.findEntry(principalMemoryScopeId, archivedGlobalDuplicate.id)?.status).toBe('archived');
    expect(codeSessionMemoryStore.findEntry(idleSession.id, archivedIdleDuplicate.id)?.status).toBe('archived');
    expect(codeSessionMemoryStore.findEntry(activeSession.id, recentDuplicate.id)?.status).toBe('active');
  });

  it('skips sweeps when the runtime has not been idle long enough', async () => {
    const runMaintenanceForScope = vi.fn();
    const service = new AutomatedMaintenanceService({
      getConfig: () => ({
        enabled: true,
        sweepIntervalMs: 300000,
        idleAfterMs: 60000,
        jobs: {
          memoryHygiene: {
            enabled: true,
            includeGlobalScope: true,
            includeCodeSessions: true,
            maxScopesPerSweep: 4,
            minIntervalMs: 3600000,
          },
        },
      }),
      getRuntimeActivity: () => ({
        queuedCount: 0,
        runningCount: 0,
        lastActivityAt: Date.parse('2026-04-10T11:59:45.000Z'),
      }),
      getPrincipalMemoryScopeId: () => 'agent-1',
      globalMemoryStore: makeMemoryStore('guardianagent-maint-skip-global'),
      codeSessionMemoryStore: makeMemoryStore('guardianagent-maint-skip-code'),
      codeSessionStore: makeCodeSessionStore({ current: Date.parse('2026-04-10T12:00:00.000Z') }),
      memoryMutationService: {
        runMaintenanceForScope,
      },
      now: () => Date.parse('2026-04-10T12:00:00.000Z'),
    });

    const result = await service.runSweep();

    expect(result.skippedReason).toBe('not_idle');
    expect(runMaintenanceForScope).not.toHaveBeenCalled();
  });

  it('respects per-scope cooldowns between idle sweeps', async () => {
    const principalMemoryScopeId = 'agent-1';
    const globalMemoryStore = makeMemoryStore('guardianagent-maint-cooldown-global');
    globalMemoryStore.append(principalMemoryScopeId, {
      content: '## Context Flush\nobjective:\nGlobal duplicate',
      summary: 'Global duplicate.',
      createdAt: '2026-04-08',
      category: 'Context Flushes',
      sourceType: 'system',
      trustLevel: 'trusted',
      status: 'active',
      tags: ['context_flush'],
      artifact: {
        sourceClass: 'derived',
        kind: 'memory_entry',
        memoryClass: 'collection',
      },
    });
    globalMemoryStore.append(principalMemoryScopeId, {
      content: '## Context Flush\nobjective:\nGlobal duplicate',
      summary: 'Global duplicate.',
      createdAt: '2026-04-09',
      category: 'Context Flushes',
      sourceType: 'system',
      trustLevel: 'trusted',
      status: 'active',
      tags: ['context_flush'],
      artifact: {
        sourceClass: 'derived',
        kind: 'memory_entry',
        memoryClass: 'collection',
      },
    });

    const nowRef = { current: Date.parse('2026-04-10T12:00:00.000Z') };
    const service = new AutomatedMaintenanceService({
      getConfig: () => ({
        enabled: true,
        sweepIntervalMs: 300000,
        idleAfterMs: 60000,
        jobs: {
          memoryHygiene: {
            enabled: true,
            includeGlobalScope: true,
            includeCodeSessions: false,
            maxScopesPerSweep: 1,
            minIntervalMs: 3600000,
          },
        },
      }),
      getRuntimeActivity: () => ({
        queuedCount: 0,
        runningCount: 0,
        lastActivityAt: Date.parse('2026-04-10T10:00:00.000Z'),
      }),
      getPrincipalMemoryScopeId: () => principalMemoryScopeId,
      globalMemoryStore,
      codeSessionMemoryStore: makeMemoryStore('guardianagent-maint-cooldown-code'),
      codeSessionStore: makeCodeSessionStore(nowRef),
      memoryMutationService: new MemoryMutationService({
        now: () => nowRef.current,
      }),
      now: () => nowRef.current,
    });

    const first = await service.runSweep();
    nowRef.current += 300000;
    const second = await service.runSweep();

    expect(first.executedScopes).toHaveLength(1);
    expect(second.executedScopes).toHaveLength(0);
    expect(second.skippedReason).toBe('no_due_scopes');
  });
});
