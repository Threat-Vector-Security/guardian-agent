import { describe, expect, it } from 'vitest';

import {
  ExecutionStore,
  resolveExecutionIntentContent,
  type ExecutionRecord,
  type ExecutionScope,
} from './executions.js';

function createScope(): ExecutionScope {
  return {
    assistantId: 'assistant',
    userId: 'user-1',
    channel: 'web',
    surfaceId: 'web-guardian-chat',
  };
}

function createStore(nowMs = 1_710_000_000_000): ExecutionStore {
  return new ExecutionStore({
    enabled: false,
    sqlitePath: '/tmp/guardianagent-executions.test.sqlite',
    now: () => nowMs,
  });
}

function createExecution(overrides?: Partial<ExecutionRecord>): ExecutionRecord {
  return {
    executionId: 'exec-1',
    requestId: 'request-1',
    rootExecutionId: 'exec-1',
    scope: createScope(),
    status: 'running',
    intent: {
      route: 'coding_task',
      operation: 'inspect',
      originalUserContent: 'Inspect package.json and summarize this repo.',
    },
    createdAt: 1_710_000_000_000,
    updatedAt: 1_710_000_000_000,
    ...(overrides ?? {}),
  };
}

describe('ExecutionStore', () => {
  it('stores and returns the latest active execution for a scope', () => {
    const store = createStore();
    const record = createExecution();

    store.begin({
      executionId: record.executionId,
      requestId: record.requestId,
      rootExecutionId: record.rootExecutionId,
      scope: record.scope,
      originalUserContent: record.intent.originalUserContent,
      lastUserContent: record.intent.originalUserContent,
      status: record.status,
    });

    const latest = store.findLatestForScope(record.scope, { statuses: ['running', 'blocked'] });

    expect(latest?.executionId).toBe('exec-1');
    expect(resolveExecutionIntentContent(latest)).toBe('Inspect package.json and summarize this repo.');
  });

  it('attaches and clears blocker state on an execution', () => {
    const store = createStore();
    const record = createExecution();
    store.begin({
      executionId: record.executionId,
      requestId: record.requestId,
      rootExecutionId: record.rootExecutionId,
      scope: record.scope,
      originalUserContent: record.intent.originalUserContent,
      lastUserContent: record.intent.originalUserContent,
      status: record.status,
    });

    store.attachBlocker('exec-1', {
      pendingActionId: 'pending-1',
      kind: 'clarification',
      prompt: 'Which backend should I use?',
      field: 'coding_backend',
    });

    expect(store.get('exec-1')).toMatchObject({
      status: 'blocked',
      blocker: {
        pendingActionId: 'pending-1',
        kind: 'clarification',
        field: 'coding_backend',
      },
    });

    store.clearBlocker('exec-1', { status: 'running' });

    expect(store.get('exec-1')).toMatchObject({
      status: 'running',
      blocker: undefined,
    });
  });
});
