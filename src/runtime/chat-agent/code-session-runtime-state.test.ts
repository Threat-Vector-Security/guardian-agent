import { describe, expect, it, vi } from 'vitest';

import type { CodeSessionRecord } from '../code-sessions.js';
import {
  extractPlannedWorkflowType,
  formatCodePlanSummary,
  syncCodeSessionRuntimeState,
} from './code-session-runtime-state.js';

function makeSession(): CodeSessionRecord {
  return {
    id: 'session-1',
    ownerUserId: 'owner',
    title: 'Repo',
    workspaceRoot: 'S:/repo',
    resolvedRoot: 'S:/repo',
    agentId: 'chat',
    status: 'active',
    attachmentPolicy: 'explicit_only',
    createdAt: 1,
    updatedAt: 1,
    lastActivityAt: 1,
    conversationUserId: 'owner',
    conversationChannel: 'web',
    uiState: {
      currentDirectory: null,
      selectedFilePath: null,
      showDiff: false,
      expandedDirs: [],
      terminalCollapsed: false,
      terminalTabs: [],
    },
    workState: {
      focusSummary: 'Fix the repo tests.',
      planSummary: 'Existing plan.',
      compactedSummary: 'Existing compacted summary.',
      compactedSummaryUpdatedAt: 10,
      workspaceProfile: null,
      workspaceTrust: null,
      workspaceTrustReview: null,
      workspaceMap: null,
      workingSet: null,
      activeSkills: [],
      pendingApprovals: [],
      recentJobs: [],
      changedFiles: [],
      verification: [],
      managedSandboxes: [],
      workflow: null,
    },
  };
}

describe('code session runtime state', () => {
  const codePlanResult = {
    toolName: 'code_plan',
    result: {
      output: {
        goal: 'Repair flaky approval tests.',
        workflow: {
          type: 'bug_fix',
          label: 'Bug fix',
        },
        plan: ['Inspect failing tests', 'Patch helper ownership'],
        verification: ['Run focused Vitest'],
        execution: {
          isolation: {
            level: 'remote_recommended',
            backendKind: 'daytona',
            profileId: 'GPT-OSS120B',
            candidateOperations: ['npm test'],
            reason: 'Exercise repo commands safely.',
          },
        },
      },
    },
  };

  it('formats code plan tool output for the session plan summary', () => {
    expect(formatCodePlanSummary([codePlanResult])).toContain('Goal: Repair flaky approval tests.');
    expect(formatCodePlanSummary([codePlanResult])).toContain('Workflow: Bug fix');
    expect(formatCodePlanSummary([codePlanResult])).toContain('- Inspect failing tests');
    expect(formatCodePlanSummary([codePlanResult])).toContain('- Backend: daytona');
  });

  it('extracts planned workflow type from code plan output', () => {
    expect(extractPlannedWorkflowType([codePlanResult])).toBe('bug_fix');
    expect(extractPlannedWorkflowType([{ toolName: 'code_plan', result: { output: { workflow: { type: 'unknown' } } } }])).toBeNull();
  });

  it('projects approvals, jobs, skills, compacted context, and workflow into the code session store', () => {
    const updateSession = vi.fn();
    const session = makeSession();

    syncCodeSessionRuntimeState({
      codeSessionStore: { updateSession },
      tools: {
        listPendingApprovalsForCodeSession: () => [],
        getApprovalSummaries: () => new Map([
          ['approval-1', {
            toolName: 'fs_write',
            argsPreview: 'tmp/output.txt',
            actionLabel: 'write file',
          }],
        ]),
        listJobsForCodeSession: () => [],
        listJobs: () => [{
          id: 'job-1',
          toolName: 'code_plan',
          risk: 'low',
          origin: 'assistant',
          userId: 'owner',
          channel: 'web',
          argsPreview: 'plan',
          status: 'running',
          createdAt: 20,
          requiresApproval: false,
        }],
        getRemoteExecutionTargets: () => [],
      },
      session,
      conversationUserId: 'owner',
      conversationChannel: 'web',
      activeSkills: [{ id: 'skill-a' }],
      lastToolRoundResults: [codePlanResult],
      runtimeState: {
        contextAssembly: {
          summary: 'assembled',
          detail: 'assembled',
          memoryScope: 'global',
          knowledgeBaseLoaded: false,
          activeSkillCount: 1,
          compactedSummaryPreview: 'New compacted summary.',
        },
      },
      getPendingApprovals: () => ({ ids: ['approval-1'] }),
      now: () => 42,
    });

    expect(updateSession).toHaveBeenCalledOnce();
    const update = updateSession.mock.calls[0][0];
    expect(update.status).toBe('awaiting_approval');
    expect(update.workState.planSummary).toContain('Goal: Repair flaky approval tests.');
    expect(update.workState.compactedSummary).toBe('New compacted summary.');
    expect(update.workState.compactedSummaryUpdatedAt).toBe(42);
    expect(update.workState.activeSkills).toEqual(['skill-a']);
    expect(update.workState.pendingApprovals).toEqual([{
      id: 'approval-1',
      toolName: 'fs_write',
      argsPreview: 'tmp/output.txt',
      actionLabel: 'write file',
    }]);
    expect(update.workState.recentJobs).toEqual([expect.objectContaining({
      id: 'job-1',
      status: 'running',
    })]);
    expect(update.workState.workflow?.type).toBe('bug_fix');
  });
});
