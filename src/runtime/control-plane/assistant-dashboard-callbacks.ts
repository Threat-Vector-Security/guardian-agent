import type { DashboardCallbacks } from '../../channels/web-types.js';
import type { GuardianAgentConfig } from '../../config/types.js';
import {
  buildAssistantJobDisplay,
  mergeAssistantJobStates,
  type AssistantJobTracker,
} from '../assistant-jobs.js';
import type { IntentRoutingTraceLog, IntentRoutingTraceStage } from '../intent-routing-trace.js';
import type { AssistantOrchestrator } from '../orchestrator.js';
import { pickRoutingTraceFocusItem } from '../routing-trace-focus.js';
import type { RunTimelineStore } from '../run-timeline.js';
import type { Runtime } from '../runtime.js';

type AssistantDashboardCallbacks = Pick<
  DashboardCallbacks,
  | 'onAssistantState'
  | 'onAssistantJobFollowUpAction'
  | 'onAssistantRuns'
  | 'onIntentRoutingTrace'
  | 'onAssistantRunDetail'
>;

interface AssistantDashboardCallbackOptions {
  configRef: { current: GuardianAgentConfig };
  runtime: Pick<Runtime, 'auditLog' | 'providers' | 'scheduler' | 'workerManager'>;
  orchestrator: Pick<AssistantOrchestrator, 'getState'>;
  intentRoutingTrace: Pick<IntentRoutingTraceLog, 'getStatus' | 'listRecent'>;
  jobTracker: Pick<AssistantJobTracker, 'getState'>;
  runTimeline: Pick<RunTimelineStore, 'listRuns' | 'getRun'>;
  refreshRunTimelineSnapshots: () => void;
}

const EMPTY_JOB_STATE = {
  summary: { total: 0, running: 0, succeeded: 0, failed: 0, blocked: 0, cancelled: 0 },
  jobs: [],
};

const POLICY_EVENT_TYPES = new Set([
  'action_denied',
  'action_allowed',
  'rate_limited',
  'output_blocked',
  'output_redacted',
]);

function buildMatchedRunHref(
  runId: string,
  kind: import('../run-timeline.js').DashboardRunKind,
  focusItemId?: string,
): string {
  const params = new URLSearchParams({ assistantRunId: runId });
  if (focusItemId) params.set('assistantRunItemId', focusItemId);
  return `${kind === 'automation_run' ? '#/automations' : '#/system'}?${params.toString()}`;
}

function readRoutingTraceTaskRunId(entry: { details?: unknown }): string | undefined {
  if (!entry.details || typeof entry.details !== 'object' || Array.isArray(entry.details)) {
    return undefined;
  }
  const taskRunId = (entry.details as { taskRunId?: unknown }).taskRunId;
  return typeof taskRunId === 'string' && taskRunId.trim().length > 0 ? taskRunId.trim() : undefined;
}

export function createAssistantDashboardCallbacks(
  options: AssistantDashboardCallbackOptions,
): AssistantDashboardCallbacks {
  return {
    onAssistantState: () => {
      const decisions = options.runtime.auditLog
        .query({ limit: 50 })
        .filter((event) => POLICY_EVENT_TYPES.has(event.type))
        .slice(-20)
        .reverse()
        .map((event) => ({
          id: event.id,
          timestamp: event.timestamp,
          type: event.type,
          severity: event.severity,
          agentId: event.agentId,
          controller: event.controller,
          reason: typeof event.details.reason === 'string' ? event.details.reason : undefined,
        }));

      const mergedJobs = mergeAssistantJobStates([
        options.jobTracker.getState(30),
        options.runtime.workerManager?.getJobState(30) ?? EMPTY_JOB_STATE,
      ], 30);
      const jobsWithDisplay = mergedJobs.jobs.map((job) => ({
        ...job,
        display: buildAssistantJobDisplay(job),
      }));

      return {
        orchestrator: options.orchestrator.getState(),
        intentRoutingTrace: options.intentRoutingTrace.getStatus(),
        jobs: {
          ...mergedJobs,
          jobs: jobsWithDisplay,
        },
        lastPolicyDecisions: decisions,
        defaultProvider: options.configRef.current.defaultProvider,
        guardianEnabled: options.configRef.current.guardian.enabled,
        providerCount: options.runtime.providers.size,
        providers: [...options.runtime.providers.keys()],
        scheduledJobs: options.runtime.scheduler.getJobs().map((job) => ({
          agentId: job.agentId,
          cron: job.cron,
          nextRun: job.job.nextRun()?.getTime(),
        })),
      };
    },

    onAssistantJobFollowUpAction: ({ jobId, action }) => {
      if (!options.runtime.workerManager) {
        return {
          success: false,
          message: 'Delegated worker follow-up controls are not available.',
          statusCode: 404,
          errorCode: 'WORKER_MANAGER_UNAVAILABLE',
        };
      }
      return options.runtime.workerManager.applyJobFollowUpAction(jobId, action);
    },

    onAssistantRuns: ({ limit, status, kind, parentRunId, channel, agentId, codeSessionId, continuityKey, activeExecutionRef }) => {
      options.refreshRunTimelineSnapshots();
      return {
        runs: options.runTimeline.listRuns({
          limit,
          ...(status ? { status } : {}),
          ...(kind ? { kind } : {}),
          ...(parentRunId ? { parentRunId } : {}),
          ...(channel ? { channel } : {}),
          ...(agentId ? { agentId } : {}),
          ...(codeSessionId ? { codeSessionId } : {}),
          ...(continuityKey ? { continuityKey } : {}),
          ...(activeExecutionRef ? { activeExecutionRef } : {}),
        }),
      };
    },

    onIntentRoutingTrace: async ({ limit, continuityKey, activeExecutionRef, stage, channel, agentId, userId, requestId }) => ({
      entries: (await options.intentRoutingTrace.listRecent({
        limit,
        ...(continuityKey ? { continuityKey } : {}),
        ...(activeExecutionRef ? { activeExecutionRef } : {}),
        ...(stage ? { stage: stage as IntentRoutingTraceStage } : {}),
        ...(channel ? { channel } : {}),
        ...(agentId ? { agentId } : {}),
        ...(userId ? { userId } : {}),
        ...(requestId ? { requestId } : {}),
      })).map((entry) => {
        const matchedRunId = readRoutingTraceTaskRunId(entry) ?? entry.requestId ?? undefined;
        const matchedRun = matchedRunId ? options.runTimeline.getRun(matchedRunId) : null;
        const codeSessionId = matchedRun?.summary.codeSessionId?.trim();
        const focusItem = matchedRun ? pickRoutingTraceFocusItem(entry, matchedRun) : null;
        return {
          ...entry,
          ...(matchedRun
            ? {
                matchedRun: {
                  runId: matchedRun.summary.runId,
                  title: matchedRun.summary.title,
                  status: matchedRun.summary.status,
                  kind: matchedRun.summary.kind,
                  href: buildMatchedRunHref(matchedRun.summary.runId, matchedRun.summary.kind),
                  ...(codeSessionId ? { codeSessionId } : {}),
                  ...(codeSessionId
                    ? {
                        codeSessionHref: `#/code?sessionId=${encodeURIComponent(codeSessionId)}&assistantRunId=${encodeURIComponent(matchedRun.summary.runId)}${focusItem ? `&assistantRunItemId=${encodeURIComponent(focusItem.itemId)}` : ''}`,
                      }
                    : {}),
                  ...(focusItem ? { focusItemId: focusItem.itemId, focusItemTitle: focusItem.title } : {}),
                  ...(focusItem
                    ? {
                        focusItemHref: buildMatchedRunHref(matchedRun.summary.runId, matchedRun.summary.kind, focusItem.itemId),
                      }
                    : {}),
                },
              }
            : {}),
        };
      }),
    }),

    onAssistantRunDetail: (runId) => {
      options.refreshRunTimelineSnapshots();
      return options.runTimeline.getRun(runId);
    },
  };
}
