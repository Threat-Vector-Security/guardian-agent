import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IntentRoutingTraceLog } from './intent-routing-trace.js';

describe('IntentRoutingTraceLog', () => {
  it('persists structured routing events and reads the tail', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'guardian-intent-trace-'));
    try {
      const trace = new IntentRoutingTraceLog({
        directory: dir,
        maxFileSizeBytes: 10_000,
      });
      await trace.init();
      trace.record({
        stage: 'gateway_classified',
        userId: 'user-1',
        channel: 'web',
        contentPreview: 'Use Codex to say hello.',
        details: {
          route: 'coding_task',
          codingBackend: 'codex',
        },
      });
      await trace.flush();

      const tail = await trace.readTail(10);
      expect(tail).toHaveLength(1);
      expect(tail[0]).toMatchObject({
        stage: 'gateway_classified',
        userId: 'user-1',
        channel: 'web',
        contentPreview: 'Use Codex to say hello.',
      });
      expect(tail[0]?.details).toMatchObject({
        route: 'coding_task',
        codingBackend: 'codex',
      });

      const status = trace.getStatus();
      expect(status.enabled).toBe(true);
      expect(status.filePath).toContain(dir);
      await expect(stat(status.filePath)).resolves.toBeTruthy();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rotates files and still returns the newest tail entries', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'guardian-intent-trace-'));
    try {
      const trace = new IntentRoutingTraceLog({
        directory: dir,
        maxFileSizeBytes: 250,
        maxFiles: 3,
      });
      await trace.init();

      for (let index = 0; index < 6; index++) {
        trace.record({
          stage: 'tier_routing_decided',
          userId: 'user-1',
          channel: 'web',
          contentPreview: `message ${index}`,
          details: {
            selectedAgentId: index % 2 === 0 ? 'local' : 'external',
            tier: index % 2 === 0 ? 'local' : 'external',
          },
        });
      }
      await trace.flush();

      const tail = await trace.readTail(3);
      expect(tail).toHaveLength(3);
      expect(tail.map((entry) => entry.contentPreview)).toEqual([
        'message 3',
        'message 4',
        'message 5',
      ]);

      await expect(stat(`${trace.getStatus().filePath}.1`)).resolves.toBeTruthy();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('lists recent entries with continuity and execution-ref filters applied', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'guardian-intent-trace-'));
    try {
      const trace = new IntentRoutingTraceLog({
        directory: dir,
        maxFileSizeBytes: 10_000,
      });
      await trace.init();
      trace.record({
        stage: 'gateway_classified',
        userId: 'user-1',
        channel: 'web',
        contentPreview: 'first',
        details: {
          continuityKey: 'continuity-1',
          activeExecutionRefs: ['code_session:Repo Fix'],
        },
      });
      trace.record({
        stage: 'dispatch_response',
        userId: 'user-1',
        channel: 'web',
        contentPreview: 'second',
        details: {
          continuityKey: 'continuity-2',
          activeExecutionRefs: ['pending_action:approval-2'],
        },
      });
      await trace.flush();

      const continuityFiltered = await trace.listRecent({ limit: 10, continuityKey: 'continuity-1' });
      expect(continuityFiltered).toHaveLength(1);
      expect(continuityFiltered[0]?.contentPreview).toBe('first');

      const execFiltered = await trace.listRecent({ limit: 10, activeExecutionRef: 'approval-2' });
      expect(execFiltered).toHaveLength(1);
      expect(execFiltered[0]?.contentPreview).toBe('second');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('lists recent entries with execution identity filters applied', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'guardian-intent-trace-'));
    try {
      const trace = new IntentRoutingTraceLog({
        directory: dir,
        maxFileSizeBytes: 10_000,
      });
      await trace.init();
      trace.record({
        stage: 'delegated_worker_started',
        requestId: 'req-1',
        userId: 'user-1',
        channel: 'web',
        agentId: 'agent-1',
        contentPreview: 'Inspect the repo.',
        details: {
          executionId: 'execution-123',
          taskExecutionId: 'task-456',
          codeSessionId: 'code-session-789',
          pendingActionId: 'approval-999',
        },
      });
      trace.record({
        stage: 'delegated_worker_completed',
        requestId: 'req-2',
        userId: 'user-1',
        channel: 'web',
        agentId: 'agent-1',
        contentPreview: 'Inspect the repo.',
        details: {
          executionId: 'execution-other',
          taskExecutionId: 'task-other',
          codeSessionId: 'code-session-other',
        },
      });
      await trace.flush();

      const executionFiltered = await trace.listRecent({ limit: 10, executionId: 'execution-123' });
      expect(executionFiltered).toHaveLength(1);
      expect(executionFiltered[0]?.requestId).toBe('req-1');

      const taskFiltered = await trace.listRecent({ limit: 10, taskExecutionId: 'task-456' });
      expect(taskFiltered).toHaveLength(1);
      expect(taskFiltered[0]?.requestId).toBe('req-1');

      const codeSessionFiltered = await trace.listRecent({ limit: 10, codeSessionId: 'session-789' });
      expect(codeSessionFiltered).toHaveLength(1);
      expect(codeSessionFiltered[0]?.requestId).toBe('req-1');

      const pendingActionFiltered = await trace.listRecent({ limit: 10, pendingActionId: 'approval-999' });
      expect(pendingActionFiltered).toHaveLength(1);
      expect(pendingActionFiltered[0]?.requestId).toBe('req-1');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('accepts delegated worker stages for filtered reads', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'guardian-intent-trace-'));
    try {
      const trace = new IntentRoutingTraceLog({
        directory: dir,
        maxFileSizeBytes: 10_000,
      });
      await trace.init();
      trace.record({
        stage: 'delegated_worker_started',
        requestId: 'req-delegated',
        userId: 'user-1',
        channel: 'web',
        agentId: 'agent-1',
        contentPreview: 'Do the repo fix.',
        details: {
          agentName: 'Workspace Implementer',
          lifecycle: 'running',
        },
      });
      trace.record({
        stage: 'delegated_worker_completed',
        requestId: 'req-delegated',
        userId: 'user-1',
        channel: 'web',
        agentId: 'agent-1',
        contentPreview: 'Do the repo fix.',
        details: {
          agentName: 'Workspace Implementer',
          lifecycle: 'completed',
        },
      });
      await trace.flush();

      const entries = await trace.listRecent({
        limit: 10,
        requestId: 'req-delegated',
        stage: 'delegated_worker_completed',
      });
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        stage: 'delegated_worker_completed',
        requestId: 'req-delegated',
        details: {
          agentName: 'Workspace Implementer',
          lifecycle: 'completed',
        },
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('redacts sensitive values and raw payloads before persisting trace entries', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'guardian-intent-trace-'));
    try {
      const trace = new IntentRoutingTraceLog({
        directory: dir,
        maxFileSizeBytes: 10_000,
      });
      await trace.init();
      trace.record({
        stage: 'delegated_tool_call_completed',
        requestId: 'req-sensitive',
        userId: 'user-1',
        channel: 'web',
        contentPreview: 'Authorization: Bearer abcdefghijklmnop token=plain-secret',
        details: {
          route: 'complex_planning_task',
          providerName: 'ollama-cloud-tools',
          apiToken: 'raw-token-value',
          nested: {
            result: {
              messages: [
                {
                  from: 'person@example.com',
                  body: 'token=raw-message-secret',
                },
              ],
            },
            password: 'raw-password-value',
          },
          rawOutput: {
            stdout: 'apiKey=raw-output-secret',
          },
        },
      });
      await trace.flush();

      const status = trace.getStatus();
      const persisted = await readFile(status.filePath, 'utf-8');
      expect(persisted).not.toContain('abcdefghijklmnop');
      expect(persisted).not.toContain('plain-secret');
      expect(persisted).not.toContain('raw-token-value');
      expect(persisted).not.toContain('raw-message-secret');
      expect(persisted).not.toContain('raw-password-value');
      expect(persisted).not.toContain('raw-output-secret');

      const tail = await trace.readTail(1);
      expect(tail[0]?.contentPreview).toBe('Authorization: Bearer [REDACTED] token=[REDACTED]');
      expect(tail[0]?.details).toMatchObject({
        route: 'complex_planning_task',
        providerName: 'ollama-cloud-tools',
        apiToken: '[REDACTED]',
        nested: {
          result: {
            redacted: true,
            reason: 'trace_payload_redacted',
            valueType: 'object',
          },
          password: '[REDACTED]',
        },
        rawOutput: {
          redacted: true,
          reason: 'trace_payload_redacted',
          valueType: 'object',
        },
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('sanitizes legacy raw trace rows when reading them back', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'guardian-intent-trace-'));
    try {
      const trace = new IntentRoutingTraceLog({
        directory: dir,
        maxFileSizeBytes: 10_000,
      });
      await trace.init();
      const status = trace.getStatus();
      await writeFile(status.filePath, `${JSON.stringify({
        id: 'route-legacy',
        timestamp: Date.now(),
        stage: 'delegated_tool_call_completed',
        requestId: 'req-legacy',
        contentPreview: 'Bearer legacyBearerToken1234567890',
        details: {
          output: {
            body: 'secret=legacy-secret-value',
          },
          credential: 'legacy-credential-value',
        },
      })}\n`);

      const entries = await trace.listRecent({ requestId: 'req-legacy' });
      expect(entries).toHaveLength(1);
      expect(entries[0]?.contentPreview).toBe('Bearer [REDACTED]');
      expect(entries[0]?.details).toMatchObject({
        output: {
          redacted: true,
          reason: 'trace_payload_redacted',
          valueType: 'object',
        },
        credential: '[REDACTED]',
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
