import type { AssistantMaintenanceConfig } from '../config/types.js';
import type { AgentMemoryStore } from './agent-memory-store.js';
import type { CodeSessionRecord, CodeSessionStore } from './code-sessions.js';
import type { MemoryMutationService, MemoryMutationTarget, MemoryScopeHygieneResult } from './memory-mutation-service.js';
import { createLogger } from '../util/logging.js';

const log = createLogger('automated-maintenance');

export interface AutomatedMaintenanceActivitySnapshot {
  queuedCount: number;
  runningCount: number;
  lastActivityAt?: number;
}

export interface AutomatedMaintenanceScopeResult {
  scope: 'global' | 'code_session';
  scopeId: string;
  changed: boolean;
  reviewedEntries: number;
  archivedExactDuplicates: number;
  archivedNearDuplicates: number;
  archivedStaleSystemEntries: number;
}

export interface AutomatedMaintenanceSweepResult {
  startedAt: number;
  completedAt: number;
  executedScopes: AutomatedMaintenanceScopeResult[];
  failedScopes: Array<{
    scope: 'global' | 'code_session';
    scopeId: string;
    error: string;
  }>;
  skippedReason?: 'disabled' | 'already_running' | 'runtime_busy' | 'not_idle' | 'no_due_scopes';
}

export interface AutomatedMaintenanceServiceOptions {
  getConfig: () => AssistantMaintenanceConfig;
  getRuntimeActivity: () => AutomatedMaintenanceActivitySnapshot;
  getPrincipalMemoryScopeId: () => string;
  globalMemoryStore: AgentMemoryStore;
  codeSessionMemoryStore: AgentMemoryStore;
  codeSessionStore: Pick<CodeSessionStore, 'listAllSessions'>;
  memoryMutationService: Pick<MemoryMutationService, 'runMaintenanceForScope'>;
  now?: () => number;
}

interface MaintenanceScopeCandidate {
  target: MemoryMutationTarget;
  dueKey: string;
}

export class AutomatedMaintenanceService {
  private readonly getConfig: () => AssistantMaintenanceConfig;
  private readonly getRuntimeActivity: () => AutomatedMaintenanceActivitySnapshot;
  private readonly getPrincipalMemoryScopeId: () => string;
  private readonly globalMemoryStore: AgentMemoryStore;
  private readonly codeSessionMemoryStore: AgentMemoryStore;
  private readonly codeSessionStore: Pick<CodeSessionStore, 'listAllSessions'>;
  private readonly memoryMutationService: Pick<MemoryMutationService, 'runMaintenanceForScope'>;
  private readonly now: () => number;
  private readonly lastSweepByScope = new Map<string, number>();

  private interval: ReturnType<typeof setInterval> | null = null;
  private sweepRunning = false;

  constructor(options: AutomatedMaintenanceServiceOptions) {
    this.getConfig = options.getConfig;
    this.getRuntimeActivity = options.getRuntimeActivity;
    this.getPrincipalMemoryScopeId = options.getPrincipalMemoryScopeId;
    this.globalMemoryStore = options.globalMemoryStore;
    this.codeSessionMemoryStore = options.codeSessionMemoryStore;
    this.codeSessionStore = options.codeSessionStore;
    this.memoryMutationService = options.memoryMutationService;
    this.now = options.now ?? Date.now;
  }

  start(): ReturnType<typeof setInterval> | null {
    if (this.interval) return this.interval;
    const config = this.getConfig();
    if (!config.enabled) {
      return null;
    }
    this.interval = setInterval(() => {
      void this.runSweep('interval').catch((err) => {
        log.warn({ err: err instanceof Error ? err.message : String(err) }, 'Automated maintenance sweep failed');
      });
    }, Math.max(10_000, config.sweepIntervalMs));
    return this.interval;
  }

  stop(): void {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }

  async runSweep(reason: 'interval' | 'manual' = 'manual'): Promise<AutomatedMaintenanceSweepResult> {
    const startedAt = this.now();
    const config = this.getConfig();
    if (!config.enabled) {
      return this.buildSkippedResult(startedAt, 'disabled');
    }
    if (this.sweepRunning) {
      return this.buildSkippedResult(startedAt, 'already_running');
    }

    const activity = this.getRuntimeActivity();
    if ((activity.runningCount + activity.queuedCount) > 0) {
      return this.buildSkippedResult(startedAt, 'runtime_busy');
    }
    if (activity.lastActivityAt && (startedAt - activity.lastActivityAt) < config.idleAfterMs) {
      return this.buildSkippedResult(startedAt, 'not_idle');
    }

    const candidates = this.collectMemoryHygieneCandidates(startedAt, config);
    if (candidates.length === 0) {
      return this.buildSkippedResult(startedAt, 'no_due_scopes');
    }

    const executedScopes: AutomatedMaintenanceScopeResult[] = [];
    const failedScopes: AutomatedMaintenanceSweepResult['failedScopes'] = [];
    this.sweepRunning = true;

    try {
      for (const candidate of candidates) {
        try {
          const result = this.memoryMutationService.runMaintenanceForScope({
            target: candidate.target,
            maintenanceType: 'idle_sweep',
          });
          executedScopes.push(this.toScopeResult(candidate.target, result));
          this.lastSweepByScope.set(candidate.dueKey, startedAt);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          failedScopes.push({
            scope: candidate.target.scope,
            scopeId: candidate.target.scopeId,
            error: message,
          });
          log.warn({
            scope: candidate.target.scope,
            scopeId: candidate.target.scopeId,
            reason,
            err: message,
          }, 'Automated maintenance skipped a failing scope');
        }
      }
    } finally {
      this.sweepRunning = false;
    }

    return {
      startedAt,
      completedAt: this.now(),
      executedScopes,
      failedScopes,
    };
  }

  private collectMemoryHygieneCandidates(nowMs: number, config: AssistantMaintenanceConfig): MaintenanceScopeCandidate[] {
    const jobConfig = config.jobs.memoryHygiene;
    if (!jobConfig.enabled) {
      return [];
    }

    const principalMemoryScopeId = this.getPrincipalMemoryScopeId();
    const candidates: MaintenanceScopeCandidate[] = [];

    if (
      jobConfig.includeGlobalScope
      && this.globalMemoryStore.isEnabled()
      && !this.globalMemoryStore.isReadOnly()
      && this.globalMemoryStore.getEntries(principalMemoryScopeId, true).length > 0
      && this.isScopeDue(`memory_hygiene:global:${principalMemoryScopeId}`, nowMs, jobConfig.minIntervalMs)
    ) {
      candidates.push({
        target: {
          scope: 'global',
          scopeId: principalMemoryScopeId,
          store: this.globalMemoryStore,
          auditAgentId: principalMemoryScopeId,
        },
        dueKey: `memory_hygiene:global:${principalMemoryScopeId}`,
      });
    }

    if (jobConfig.includeCodeSessions && this.codeSessionMemoryStore.isEnabled() && !this.codeSessionMemoryStore.isReadOnly()) {
      const idleSessions = this.codeSessionStore
        .listAllSessions()
        .filter((session) => this.isIdleCodeSession(session, nowMs, config.idleAfterMs))
        .sort((left, right) => left.lastActivityAt - right.lastActivityAt);

      for (const session of idleSessions) {
        if (candidates.length >= jobConfig.maxScopesPerSweep) break;
        if (this.codeSessionMemoryStore.getEntries(session.id, true).length === 0) continue;
        const dueKey = `memory_hygiene:code_session:${session.id}`;
        if (!this.isScopeDue(dueKey, nowMs, jobConfig.minIntervalMs)) continue;
        candidates.push({
          target: {
            scope: 'code_session',
            scopeId: session.id,
            store: this.codeSessionMemoryStore,
            auditAgentId: principalMemoryScopeId,
          },
          dueKey,
        });
      }
    }

    return candidates.slice(0, jobConfig.maxScopesPerSweep);
  }

  private isIdleCodeSession(session: CodeSessionRecord, nowMs: number, idleAfterMs: number): boolean {
    return session.lastActivityAt > 0 && (nowMs - session.lastActivityAt) >= idleAfterMs;
  }

  private isScopeDue(key: string, nowMs: number, minIntervalMs: number): boolean {
    const lastRunAt = this.lastSweepByScope.get(key);
    return !lastRunAt || (nowMs - lastRunAt) >= minIntervalMs;
  }

  private toScopeResult(target: MemoryMutationTarget, result: MemoryScopeHygieneResult): AutomatedMaintenanceScopeResult {
    return {
      scope: target.scope,
      scopeId: target.scopeId,
      changed: result.changed,
      reviewedEntries: result.reviewedEntries,
      archivedExactDuplicates: result.archivedExactDuplicates,
      archivedNearDuplicates: result.archivedNearDuplicates,
      archivedStaleSystemEntries: result.archivedStaleSystemEntries,
    };
  }

  private buildSkippedResult(
    startedAt: number,
    skippedReason: AutomatedMaintenanceSweepResult['skippedReason'],
  ): AutomatedMaintenanceSweepResult {
    return {
      startedAt,
      completedAt: this.now(),
      executedScopes: [],
      failedScopes: [],
      skippedReason,
    };
  }
}
