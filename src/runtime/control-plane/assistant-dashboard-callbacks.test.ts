import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_CONFIG, type GuardianAgentConfig } from '../../config/types.js';
import { createAssistantDashboardCallbacks } from './assistant-dashboard-callbacks.js';

function createConfig(): GuardianAgentConfig {
  return structuredClone(DEFAULT_CONFIG) as GuardianAgentConfig;
}

describe('createAssistantDashboardCallbacks', () => {
  it('builds assistant state and returns an unavailable follow-up response without a worker manager', () => {
    const config = createConfig();
    config.defaultProvider = 'primary';

    const callbacks = createAssistantDashboardCallbacks({
      configRef: { current: config },
      runtime: {
        auditLog: {
          query: vi.fn(() => [
            {
              id: 'audit-1',
              timestamp: 100,
              type: 'action_allowed',
              severity: 'info',
              agentId: 'agent-1',
              controller: 'Policy',
              details: { reason: 'approved' },
            },
            {
              id: 'audit-2',
              timestamp: 101,
              type: 'message_received',
              severity: 'info',
              agentId: 'agent-1',
              controller: 'Runtime',
              details: {},
            },
          ]),
        },
        providers: new Map([['primary', {}]]),
        scheduler: {
          getJobs: vi.fn(() => [
            {
              agentId: 'agent-1',
              cron: '*/5 * * * *',
              job: {
                nextRun: () => new Date(5_000),
              },
            },
          ]),
        },
        workerManager: undefined,
      } as never,
      orchestrator: {
        getState: vi.fn(() => ({ activeRequests: [] })),
      } as never,
      intentRoutingTrace: {
        getStatus: vi.fn(() => ({ enabled: true, filePath: '/tmp/intent-routing.jsonl' })),
        listRecent: vi.fn(async () => []),
      } as never,
      jobTracker: {
        getState: vi.fn(() => ({
          summary: { total: 1, running: 1, succeeded: 0, failed: 0, lastStartedAt: 100 },
          jobs: [{
            id: 'job-1',
            type: 'config.apply',
            source: 'manual',
            status: 'running',
            startedAt: 100,
            detail: 'Applying config',
          }],
        })),
      } as never,
      runTimeline: {
        listRuns: vi.fn(() => []),
        getRun: vi.fn(() => null),
      } as never,
      refreshRunTimelineSnapshots: vi.fn(),
    });

    expect(callbacks.onAssistantState?.()).toEqual({
      orchestrator: { activeRequests: [] },
      intentRoutingTrace: { enabled: true, filePath: '/tmp/intent-routing.jsonl' },
      jobs: {
        summary: { total: 1, running: 1, succeeded: 0, failed: 0, lastStartedAt: 100 },
        jobs: [{
          id: 'job-1',
          type: 'config.apply',
          source: 'manual',
          status: 'running',
          startedAt: 100,
          detail: 'Applying config',
          display: {
            originSummary: 'manual',
            outcomeSummary: 'Applying config',
          },
        }],
      },
      lastPolicyDecisions: [{
        id: 'audit-1',
        timestamp: 100,
        type: 'action_allowed',
        severity: 'info',
        agentId: 'agent-1',
        controller: 'Policy',
        reason: 'approved',
      }],
      defaultProvider: 'primary',
      guardianEnabled: true,
      providerCount: 1,
      providers: ['primary'],
      scheduledJobs: [{
        agentId: 'agent-1',
        cron: '*/5 * * * *',
        nextRun: 5_000,
      }],
    });

    expect(callbacks.onAssistantJobFollowUpAction?.({
      jobId: 'job-1',
      action: 'replay',
    })).toEqual({
      success: false,
      message: 'Delegated worker follow-up controls are not available.',
      statusCode: 404,
      errorCode: 'WORKER_MANAGER_UNAVAILABLE',
    });
  });

  it('decorates routing traces with matched run links and refreshes run snapshots for run queries', async () => {
    const refreshRunTimelineSnapshots = vi.fn();
    const runTimelineEntry = {
      summary: {
        runId: 'run-1',
        groupId: 'run-1',
        kind: 'assistant_dispatch',
        status: 'completed',
        title: 'Investigate issue',
        codeSessionId: 'code-1',
        startedAt: 10,
        lastUpdatedAt: 20,
        pendingApprovalCount: 0,
        verificationPendingCount: 0,
        tags: [],
      },
      items: [
        {
          id: 'prepared-item',
          runId: 'run-1',
          timestamp: 10,
          type: 'run_started',
          status: 'info',
          source: 'orchestrator',
          title: 'Prepared request',
        },
        {
          id: 'context-item',
          runId: 'run-1',
          timestamp: 11,
          type: 'note',
          status: 'info',
          source: 'orchestrator',
          title: 'Assembled context',
          contextAssembly: { summary: 'Loaded context' },
        },
      ],
    };
    const callbacks = createAssistantDashboardCallbacks({
      configRef: { current: createConfig() },
      runtime: {
        auditLog: { query: vi.fn(() => []) },
        providers: new Map(),
        scheduler: { getJobs: vi.fn(() => []) },
        workerManager: {
          getJobState: vi.fn(() => ({ summary: { total: 0, running: 0, succeeded: 0, failed: 0 }, jobs: [] })),
          applyJobFollowUpAction: vi.fn(() => ({ success: true, message: 'ok' })),
        },
      } as never,
      orchestrator: {
        getState: vi.fn(() => ({ activeRequests: [] })),
      } as never,
      intentRoutingTrace: {
        getStatus: vi.fn(() => ({ enabled: true, filePath: '/tmp/intent-routing.jsonl' })),
        listRecent: vi.fn(async () => [{
          id: 'trace-1',
          timestamp: 100,
          stage: 'dispatch_response',
          requestId: 'run-1',
        }]),
      } as never,
      jobTracker: {
        getState: vi.fn(() => ({ summary: { total: 0, running: 0, succeeded: 0, failed: 0 }, jobs: [] })),
      } as never,
      runTimeline: {
        listRuns: vi.fn(() => [runTimelineEntry]),
        getRun: vi.fn((runId: string) => (runId === 'run-1' ? runTimelineEntry : null)),
      } as never,
      refreshRunTimelineSnapshots,
    });

    await expect(callbacks.onIntentRoutingTrace?.({ limit: 10 })).resolves.toEqual({
      entries: [{
        id: 'trace-1',
        timestamp: 100,
        stage: 'dispatch_response',
        requestId: 'run-1',
        matchedRun: {
          runId: 'run-1',
          title: 'Investigate issue',
          status: 'completed',
          kind: 'assistant_dispatch',
          href: '#/automations?assistantRunId=run-1',
          codeSessionId: 'code-1',
          codeSessionHref: '#/code?sessionId=code-1&assistantRunId=run-1&assistantRunItemId=context-item',
          focusItemId: 'context-item',
          focusItemTitle: 'Assembled context',
          focusItemHref: '#/automations?assistantRunId=run-1&assistantRunItemId=context-item',
        },
      }],
    });

    expect(callbacks.onAssistantRuns?.({ limit: 10 })).toEqual({
      runs: [runTimelineEntry],
    });
    expect(callbacks.onAssistantRunDetail?.('run-1')).toEqual(runTimelineEntry);
    expect(refreshRunTimelineSnapshots).toHaveBeenCalledTimes(2);
  });
});
