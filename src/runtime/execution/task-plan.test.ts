import { describe, expect, it } from 'vitest';
import {
  buildPlannedTask,
  buildStepReceipts,
  computeWorkerRunStatus,
  findAnswerStepId,
  matchPlannedStepForTool,
} from './task-plan.js';
import type { EvidenceReceipt, PlannedTask } from './types.js';

describe('task plan receipt accounting', () => {
  it('uses the final answer receipt to satisfy every answer step in a multi-answer plan', () => {
    const plannedTask: PlannedTask = {
      planId: 'plan:complex_planning_task:run:3',
      allowAdditionalSteps: false,
      steps: [
        {
          stepId: 'step_1',
          kind: 'answer',
          summary: 'Confirm the complex-planning path.',
          required: true,
        },
        {
          stepId: 'step_2',
          kind: 'write',
          summary: 'Write the requested implementation note.',
          expectedToolCategories: ['fs_write'],
          required: true,
          dependsOn: ['step_1'],
        },
        {
          stepId: 'step_3',
          kind: 'answer',
          summary: 'Include the DAG plan summary in the final answer.',
          required: true,
          dependsOn: ['step_2'],
        },
      ],
    };
    const answerReceipt: EvidenceReceipt = {
      receiptId: 'answer:1',
      sourceType: 'model_answer',
      status: 'succeeded',
      refs: [],
      summary: 'I generated and executed a DAG plan.',
      startedAt: 3,
      endedAt: 3,
    };
    const writeReceipt: EvidenceReceipt = {
      receiptId: 'receipt-write-1',
      sourceType: 'tool_call',
      toolName: 'fs_write',
      status: 'succeeded',
      refs: ['tmp/manual-dag-smoke/summary.md'],
      summary: 'Wrote tmp/manual-dag-smoke/summary.md.',
      startedAt: 1,
      endedAt: 2,
    };

    const stepReceipts = buildStepReceipts({
      plannedTask,
      evidenceReceipts: [writeReceipt, answerReceipt],
      toolReceiptStepIds: new Map([[writeReceipt.receiptId, 'step_2']]),
      finalAnswerReceiptId: answerReceipt.receiptId,
    });

    expect(findAnswerStepId(plannedTask)).toBe('step_3');
    expect(stepReceipts).toMatchObject([
      { stepId: 'step_1', status: 'satisfied', evidenceReceiptIds: ['answer:1'] },
      { stepId: 'step_2', status: 'satisfied', evidenceReceiptIds: ['receipt-write-1'] },
      { stepId: 'step_3', status: 'satisfied', evidenceReceiptIds: ['answer:1'] },
    ]);
    expect(computeWorkerRunStatus(plannedTask, stepReceipts, [], 'end_turn')).toBe('completed');
  });

  it('maps repo inspection category steps to read-only repo tools', () => {
    const plannedTask: PlannedTask = {
      planId: 'plan:coding_task:inspect:2',
      allowAdditionalSteps: false,
      steps: [
        {
          stepId: 'step_1',
          kind: 'read',
          summary: 'Inspect the repository for implementation files.',
          expectedToolCategories: ['repo_inspect'],
          required: true,
        },
        {
          stepId: 'step_2',
          kind: 'answer',
          summary: 'Answer with exact implementation files.',
          required: true,
          dependsOn: ['step_1'],
        },
      ],
    };

    expect(matchPlannedStepForTool({
      plannedTask,
      toolName: 'fs_search',
      args: { query: 'direct reasoning graph artifacts' },
    })).toBe('step_1');
    expect(matchPlannedStepForTool({
      plannedTask,
      toolName: 'fs_read',
      args: { path: 'src/runtime/execution-graph/graph-artifacts.ts' },
    })).toBe('step_1');
    expect(matchPlannedStepForTool({
      plannedTask,
      toolName: 'code_symbol_search',
      args: { query: 'SynthesisDraft' },
    })).toBe('step_1');
  });

  it('uses repo inspection category tool receipts to satisfy the planned step', () => {
    const plannedTask: PlannedTask = {
      planId: 'plan:coding_task:inspect:2',
      allowAdditionalSteps: false,
      steps: [
        {
          stepId: 'step_1',
          kind: 'read',
          summary: 'Inspect the repository for implementation files.',
          expectedToolCategories: ['repo_inspect'],
          required: true,
        },
        {
          stepId: 'step_2',
          kind: 'answer',
          summary: 'Answer with exact implementation files.',
          required: true,
          dependsOn: ['step_1'],
        },
      ],
    };
    const searchReceipt: EvidenceReceipt = {
      receiptId: 'receipt-search-1',
      sourceType: 'tool_call',
      toolName: 'fs_search',
      status: 'succeeded',
      refs: ['src/runtime/execution-graph/graph-artifacts.ts'],
      summary: 'Found direct reasoning graph artifact definitions.',
      startedAt: 1,
      endedAt: 2,
    };
    const answerReceipt: EvidenceReceipt = {
      receiptId: 'answer:1',
      sourceType: 'model_answer',
      status: 'succeeded',
      refs: ['src/runtime/execution-graph/graph-artifacts.ts'],
      summary: 'The artifact contracts live in graph-artifacts.ts.',
      startedAt: 3,
      endedAt: 3,
    };

    const stepReceipts = buildStepReceipts({
      plannedTask,
      evidenceReceipts: [searchReceipt, answerReceipt],
      toolReceiptStepIds: new Map([[searchReceipt.receiptId, 'step_1']]),
      finalAnswerReceiptId: answerReceipt.receiptId,
    });

    expect(stepReceipts).toMatchObject([
      { stepId: 'step_1', status: 'satisfied', evidenceReceiptIds: ['receipt-search-1'] },
      { stepId: 'step_2', status: 'satisfied', evidenceReceiptIds: ['answer:1'] },
    ]);
    expect(computeWorkerRunStatus(plannedTask, stepReceipts, [], 'end_turn')).toBe('completed');
  });

  it('maps memory evidence categories to memory search receipts', () => {
    const plannedTask: PlannedTask = {
      planId: 'plan:memory_task:search:2',
      allowAdditionalSteps: false,
      steps: [
        {
          stepId: 'step_1',
          kind: 'read',
          summary: 'Search memory for the requested marker.',
          expectedToolCategories: ['memory'],
          required: true,
        },
        {
          stepId: 'step_2',
          kind: 'answer',
          summary: 'Answer with the matching marker.',
          required: true,
          dependsOn: ['step_1'],
        },
      ],
    };
    const memoryReceipt: EvidenceReceipt = {
      receiptId: 'receipt-memory-1',
      sourceType: 'tool_call',
      toolName: 'memory_search',
      status: 'succeeded',
      refs: ['memory:marker'],
      summary: 'Found the marker in memory.',
      startedAt: 1,
      endedAt: 2,
    };
    const answerReceipt: EvidenceReceipt = {
      receiptId: 'answer:1',
      sourceType: 'model_answer',
      status: 'succeeded',
      refs: ['memory:marker'],
      summary: 'SMOKE-MEM-42801',
      startedAt: 3,
      endedAt: 3,
    };

    expect(matchPlannedStepForTool({
      plannedTask,
      toolName: 'memory_search',
      args: { query: 'SMOKE-MEM-42801' },
    })).toBe('step_1');

    expect(matchPlannedStepForTool({
      plannedTask: {
        ...plannedTask,
        steps: plannedTask.steps.map((step) => step.stepId === 'step_1'
          ? { ...step, expectedToolCategories: ['memory_task'] }
          : step),
      },
      toolName: 'memory_search',
      args: { query: 'SMOKE-MEM-42801' },
    })).toBe('step_1');

    const stepReceipts = buildStepReceipts({
      plannedTask,
      evidenceReceipts: [memoryReceipt, answerReceipt],
      toolReceiptStepIds: new Map([[memoryReceipt.receiptId, 'step_1']]),
      finalAnswerReceiptId: answerReceipt.receiptId,
    });

    expect(stepReceipts).toMatchObject([
      { stepId: 'step_1', status: 'satisfied', evidenceReceiptIds: ['receipt-memory-1'] },
      { stepId: 'step_2', status: 'satisfied', evidenceReceiptIds: ['answer:1'] },
    ]);
    expect(computeWorkerRunStatus(plannedTask, stepReceipts, [], 'end_turn')).toBe('completed');
  });

  it('infers semantic evidence categories for generic general-assistant search steps', () => {
    const plannedTask = buildPlannedTask({
      route: 'general_assistant',
      operation: 'search',
      plannedSteps: [
        {
          kind: 'search',
          summary: 'Search the web for the title of https://example.com.',
          required: true,
        },
        {
          kind: 'search',
          summary: 'Search this repo for runLiveToolLoopController.',
          required: true,
        },
        {
          kind: 'search',
          summary: 'Search memory for SMOKE-MEM-42801.',
          required: true,
        },
        {
          kind: 'answer',
          summary: 'Return three short bullets with what each source found.',
          required: true,
          dependsOn: ['step_1', 'step_2', 'step_3'],
        },
      ],
    }, {
      kind: 'general_answer',
      route: 'general_assistant',
      operation: 'search',
      summary: 'User wants three parallel searches and a bullet summary of results.',
    });

    expect(plannedTask.steps.map((step) => step.expectedToolCategories ?? [])).toEqual([
      ['web'],
      ['repo_inspect'],
      ['memory'],
      [],
    ]);
    expect(matchPlannedStepForTool({
      plannedTask,
      toolName: 'web_fetch',
      args: { url: 'https://example.com' },
    })).toBe('step_1');
    expect(matchPlannedStepForTool({
      plannedTask,
      toolName: 'fs_search',
      args: { query: 'runLiveToolLoopController' },
    })).toBe('step_2');
    expect(matchPlannedStepForTool({
      plannedTask,
      toolName: 'memory_search',
      args: { query: 'SMOKE-MEM-42801' },
    })).toBe('step_3');
  });

  it('allows semantic write steps to be satisfied by Second Brain mutation tools', () => {
    const plannedTask: PlannedTask = {
      planId: 'plan:complex_planning_task:run:2',
      allowAdditionalSteps: false,
      steps: [
        {
          stepId: 'step_1',
          kind: 'write',
          summary: 'Create a local Second Brain calendar appointment.',
          expectedToolCategories: ['write'],
          required: true,
        },
        {
          stepId: 'step_2',
          kind: 'answer',
          summary: 'Confirm the appointment was created.',
          required: true,
          dependsOn: ['step_1'],
        },
      ],
    };

    expect(matchPlannedStepForTool({
      plannedTask,
      toolName: 'second_brain_calendar_upsert',
      args: { title: 'Take Benny to the vet' },
    })).toBe('step_1');
  });

  it('uses model answer receipts to satisfy answer-category planned steps', () => {
    const plannedTask: PlannedTask = {
      planId: 'plan:general_assistant:read:1',
      allowAdditionalSteps: false,
      steps: [
        {
          stepId: 'step_1',
          kind: 'answer',
          summary: 'Answer from the gathered evidence.',
          expectedToolCategories: ['answer'],
          required: true,
        },
      ],
    };
    const answerReceipt: EvidenceReceipt = {
      receiptId: 'answer:grounded-synthesis',
      sourceType: 'model_answer',
      status: 'succeeded',
      refs: [],
      summary: 'Grounded answer.',
      startedAt: 1,
      endedAt: 1,
    };

    const stepReceipts = buildStepReceipts({
      plannedTask,
      evidenceReceipts: [answerReceipt],
      finalAnswerReceiptId: answerReceipt.receiptId,
    });

    expect(stepReceipts).toMatchObject([
      {
        stepId: 'step_1',
        status: 'satisfied',
        evidenceReceiptIds: ['answer:grounded-synthesis'],
      },
    ]);
    expect(computeWorkerRunStatus(plannedTask, stepReceipts, [], 'end_turn')).toBe('completed');
  });
});
