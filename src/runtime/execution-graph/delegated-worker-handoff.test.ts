import { describe, expect, it } from 'vitest';
import {
  applyDelegatedFollowUpPolicy,
  buildDelegatedHandoff,
  buildDelegatedInsufficientResultHandoff,
  formatFailedDelegatedMessage,
  normalizeDelegatedWorkerRunClass,
  resolveDelegatedWorkerFollowUpPolicy,
  resolveDelegatedWorkerRunClass,
  resolveDelegatedWorkerLifecycle,
} from './delegated-worker-handoff.js';
import { buildDelegatedExecutionMetadata, buildDelegatedSyntheticEnvelope } from '../execution/metadata.js';
import type { DelegatedTaskContract, VerificationDecision } from '../execution/types.js';

describe('delegated worker handoff graph policy', () => {
  it('owns approval handoff and lifecycle resolution outside WorkerManager', () => {
    const verification: VerificationDecision = {
      decision: 'blocked',
      reasons: ['Approval is required.'],
      retryable: true,
    };
    const metadata = {
      pendingAction: {
        blocker: {
          kind: 'approval',
          prompt: 'Approval required for fs_write.',
          approvalSummaries: [{ id: 'approval-1', toolName: 'fs_write', argsPreview: '{}' }],
        },
      },
    };

    const handoff = buildDelegatedHandoff('Waiting for approval.', metadata, 'short_lived', verification);

    expect(handoff).toMatchObject({
      summary: 'Waiting for approval.',
      unresolvedBlockerKind: 'approval',
      approvalCount: 1,
      runClass: 'short_lived',
      nextAction: 'Resolve the pending approval(s) to continue the delegated run.',
      reportingMode: 'held_for_approval',
    });
    expect(resolveDelegatedWorkerLifecycle(metadata, handoff.unresolvedBlockerKind, verification)).toBe('blocked');
  });

  it('surfaces safe partial progress when delegated work pauses for approval', () => {
    const taskContract = delegatedTaskContract();
    const metadata = {
      ...buildDelegatedExecutionMetadata(buildDelegatedSyntheticEnvelope({
        taskContract,
        runStatus: 'suspended',
        stopReason: 'approval_required',
        operatorSummary: 'Waiting for approval.',
        evidenceReceipts: [{
          receiptId: 'receipt-vercel',
          sourceType: 'tool_call',
          toolName: 'vercel_status',
          status: 'succeeded',
          refs: ['tool:vercel_status'],
          summary: 'raw token should not be surfaced: secret-token',
          startedAt: 1,
          endedAt: 2,
        }, {
          receiptId: 'receipt-whm',
          sourceType: 'tool_call',
          toolName: 'whm_status',
          status: 'failed',
          refs: ['tool:whm_status'],
          summary: 'Unknown cloud profile "1".',
          startedAt: 3,
          endedAt: 4,
        }, {
          receiptId: 'receipt-gmail',
          sourceType: 'tool_call',
          toolName: 'gws',
          status: 'pending_approval',
          refs: ['tool:gws'],
          summary: 'Waiting for approval to run gws - gmail users getprofile.',
          startedAt: 5,
          endedAt: 5,
        }],
      })),
      pendingAction: {
        blocker: {
          kind: 'approval',
          prompt: 'Waiting for approval to run gws - gmail users getprofile.',
          approvalSummaries: [{ id: 'approval-1', toolName: 'gws', argsPreview: 'gmail users getprofile' }],
        },
      },
    };
    const verification: VerificationDecision = {
      decision: 'blocked',
      reasons: ['Waiting for approval to run gws - gmail users getprofile.'],
      retryable: false,
      requiredNextAction: 'Resolve the pending approval(s) to continue the delegated run.',
    };

    const handoff = buildDelegatedHandoff('Waiting for approval to run gws - gmail users getprofile.', metadata, 'short_lived', verification);
    const result = applyDelegatedFollowUpPolicy(
      { content: 'Waiting for approval to run gws - gmail users getprofile.', metadata },
      handoff,
      verification,
    );

    expect(result.content).toContain('Delegated work is paused: approval required.');
    expect(result.content).toContain('Partial progress: 1 succeeded, 1 failed, 1 pending.');
    expect(result.content).toContain('Succeeded tools: vercel_status.');
    expect(result.content).toContain('Failed tools: whm_status.');
    expect(result.content).toContain('Pending tools: gws.');
    expect(result.content).toContain('Resolve the pending approval(s) to continue the delegated run.');
    expect(result.content).not.toContain('secret-token');
    expect(result.metadata?.delegatedHandoff).toEqual(handoff);
  });

  it('renders policy blockers as status-only delegated pauses', () => {
    const verification: VerificationDecision = {
      decision: 'policy_blocked',
      reasons: ['Filesystem path is outside policy.'],
      retryable: false,
      requiredNextAction: 'Choose an allowed workspace path.',
    };
    const handoff = buildDelegatedHandoff('Path blocked.', {}, 'short_lived', verification);
    const result = applyDelegatedFollowUpPolicy({ content: 'Path blocked.', metadata: {} }, handoff, verification);

    expect(result.content).toContain('Delegated work is paused: policy blocker must be resolved.');
    expect(result.content).toContain('Filesystem path is outside policy.');
    expect(result.content).toContain('Choose an allowed workspace path.');
    expect(result.metadata?.delegatedHandoff).toEqual(handoff);
  });

  it('formats insufficient terminal handoffs as failed delegated messages', () => {
    const handoff = buildDelegatedInsufficientResultHandoff({
      failureSummary: 'The answer step was not satisfied.',
      decision: { requiredNextAction: 'Retry answer synthesis from gathered evidence.' },
    });

    expect(handoff.runClass).toBe('short_lived');
    expect(formatFailedDelegatedMessage(handoff)).toBe([
      'Delegated work failed.',
      'The answer step was not satisfied.',
      'Retry answer synthesis from gathered evidence.',
    ].join('\n'));
  });

  it('holds long-running satisfied delegated results for operator follow-up', () => {
    const verification: VerificationDecision = {
      decision: 'satisfied',
      reasons: [],
      retryable: false,
    };
    const handoff = buildDelegatedHandoff('Connector sync completed.', {}, 'long_running', verification);
    const result = applyDelegatedFollowUpPolicy(
      { content: 'Connector sync completed.', metadata: {} },
      handoff,
      verification,
    );

    expect(handoff).toMatchObject({
      reportingMode: 'held_for_operator',
      operatorState: 'pending',
      nextAction: 'Replay or dismiss the held delegated result.',
    });
    expect(result.content).toContain('Delegated work completed and is held for operator review.');
    expect(result.metadata?.delegatedHandoff).toEqual(handoff);
  });

  it('summarizes held completed repo work from verified write evidence when worker text is fragmentary', () => {
    const verification: VerificationDecision = {
      decision: 'satisfied',
      reasons: ['Delegated worker satisfied every required planned step.'],
      retryable: false,
    };
    const taskContract = delegatedTaskContract();
    const metadata = buildDelegatedExecutionMetadata(buildDelegatedSyntheticEnvelope({
      taskContract,
      runStatus: 'completed',
      stopReason: 'end_turn',
      operatorSummary: 'Now the main HTML file with all CSS and JS inline for simplicity:',
      evidenceReceipts: [{
        receiptId: 'receipt-write-index',
        sourceType: 'tool_call',
        toolName: 'fs_write',
        status: 'succeeded',
        refs: ['index.html'],
        summary: 'Wrote index.html.',
        startedAt: 1,
        endedAt: 2,
      }, {
        receiptId: 'receipt-write-package',
        sourceType: 'tool_call',
        toolName: 'fs_write',
        status: 'succeeded',
        refs: ['package.json'],
        summary: 'Wrote package.json.',
        startedAt: 3,
        endedAt: 4,
      }],
    }));

    const handoff = buildDelegatedHandoff(
      'Now the main HTML file with all CSS and JS inline for simplicity:',
      metadata,
      'long_running',
      verification,
    );
    const result = applyDelegatedFollowUpPolicy(
      { content: 'Now the main HTML file with all CSS and JS inline for simplicity:', metadata },
      handoff,
      verification,
    );

    expect(handoff.summary).toBe('Delegated worker completed verified workspace changes: index.html, package.json.');
    expect(result.content).toContain('Delegated worker completed verified workspace changes: index.html, package.json.');
    expect(result.content).not.toContain('Now the main HTML file');
  });

  it('uses delegated result envelopes when summarizing incomplete graph terminals', () => {
    const taskContract = delegatedTaskContract();
    const metadata = buildDelegatedExecutionMetadata(buildDelegatedSyntheticEnvelope({
      taskContract,
      runStatus: 'incomplete',
      stopReason: 'max_rounds',
      operatorSummary: 'Stopped early.',
      stepReceipts: [{
        stepId: 'read',
        status: 'satisfied',
        evidenceReceiptIds: ['receipt-read'],
        summary: 'Read source.',
        startedAt: 1,
        endedAt: 2,
      }, {
        stepId: 'answer',
        status: 'failed',
        evidenceReceiptIds: [],
        summary: 'Answer user.',
        startedAt: 3,
        endedAt: 4,
      }],
    }));

    const handoff = buildDelegatedHandoff('Still working.', metadata, 'short_lived');

    expect(handoff.summary).toBe('Delegated worker stopped before satisfying required steps: answer.');
    expect(resolveDelegatedWorkerLifecycle(metadata, handoff.unresolvedBlockerKind)).toBe('completed');
  });

  it('normalizes unknown delegated run classes conservatively', () => {
    expect(normalizeDelegatedWorkerRunClass('automation_owned')).toBe('automation_owned');
    expect(normalizeDelegatedWorkerRunClass('unexpected')).toBe('short_lived');
  });

  it('resolves delegated run classes from producer context', () => {
    expect(resolveDelegatedWorkerRunClass({
      requestedRunClass: 'long_running',
      originChannel: 'scheduled',
    })).toBe('long_running');
    expect(resolveDelegatedWorkerRunClass({
      originChannel: 'scheduled',
      orchestration: { role: 'coordinator', label: 'Guardian Coordinator' },
    })).toBe('automation_owned');
    expect(resolveDelegatedWorkerRunClass({
      directReasoning: true,
      orchestration: { role: 'coordinator', label: 'Guardian Coordinator' },
    })).toBe('in_invocation');
    expect(resolveDelegatedWorkerRunClass({
      originChannel: 'web',
      codeSessionId: 'code-session-1',
      orchestration: { role: 'implementer', label: 'Workspace Implementer', lenses: ['coding-workspace'] },
    })).toBe('in_invocation');
    expect(resolveDelegatedWorkerRunClass({
      originChannel: 'cli',
      codeSessionId: 'code-session-1',
      orchestration: { role: 'implementer', label: 'Workspace Implementer', lenses: ['coding-workspace'] },
    })).toBe('in_invocation');
    expect(resolveDelegatedWorkerRunClass({
      codeSessionId: 'code-session-1',
      orchestration: { role: 'explorer', label: 'Workspace Explorer', lenses: ['coding-workspace'] },
    })).toBe('long_running');
    expect(resolveDelegatedWorkerRunClass({
      orchestration: { role: 'explorer', label: 'Research Explorer', lenses: ['research'] },
    })).toBe('short_lived');
  });

  it('resolves delegated follow-up policy from lifecycle, blockers, and run class', () => {
    expect(resolveDelegatedWorkerFollowUpPolicy({
      runClass: 'short_lived',
      lifecycle: 'blocked',
      blockerKind: 'approval',
    })).toMatchObject({
      reportingMode: 'held_for_approval',
      nextAction: 'Resolve the pending approval(s) to continue the delegated run.',
    });
    expect(resolveDelegatedWorkerFollowUpPolicy({
      runClass: 'long_running',
      lifecycle: 'completed',
    })).toMatchObject({
      reportingMode: 'held_for_operator',
      operatorState: 'pending',
      nextAction: 'Replay or dismiss the held delegated result.',
    });
    expect(resolveDelegatedWorkerFollowUpPolicy({
      runClass: 'automation_owned',
      lifecycle: 'failed',
      requiredNextAction: 'Inspect the failed sync output.',
    })).toMatchObject({
      reportingMode: 'inline_response',
      nextAction: 'Inspect the failed sync output.',
    });
    expect(resolveDelegatedWorkerFollowUpPolicy({
      runClass: 'long_running',
      lifecycle: 'blocked',
      blockerKind: 'policy_blocked',
      requiredNextAction: 'Choose an allowed workspace path.',
    })).toMatchObject({
      reportingMode: 'status_only',
      nextAction: 'Choose an allowed workspace path.',
    });
  });
});

function delegatedTaskContract(): DelegatedTaskContract {
  return {
    kind: 'repo_inspection',
    route: 'coding_task',
    operation: 'inspect',
    requiresEvidence: true,
    allowsAnswerFirst: false,
    requireExactFileReferences: false,
    plan: {
      planId: 'plan-1',
      steps: [
        { stepId: 'read', kind: 'read', summary: 'Read source.' },
        { stepId: 'answer', kind: 'answer', summary: 'Answer user.' },
      ],
    },
  };
}
