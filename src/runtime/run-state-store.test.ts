import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonFileRunStateStore } from './run-state-store.js';
import type { GraphRunCheckpoint } from './graph-types.js';

describe('JsonFileRunStateStore', () => {
  it('persists and reloads graph checkpoints', () => {
    const dir = mkdtempSync(join(tmpdir(), 'guardian-run-state-'));
    try {
      const persistPath = join(dir, 'playbook-run-state.json');
      const store = new JsonFileRunStateStore<{ stepId: string }>({
        persistPath,
        maxEntries: 10,
      });
      const checkpoint: GraphRunCheckpoint<{ stepId: string }> = {
        runId: 'run-1',
        graphId: 'graph-1',
        graphName: 'Graph 1',
        status: 'awaiting_approval',
        createdAt: 1,
        updatedAt: 2,
        currentNodeId: 'step-1',
        nextNodeId: 'step-2',
        completedNodeIds: ['start', 'step-1'],
        pendingApprovalIds: ['approval-1'],
        results: [{ stepId: 'step-1' }],
        events: [],
        resumeContext: {
          playbookId: 'playbook-1',
          origin: 'web',
        },
      };

      store.save(checkpoint);

      const reloaded = new JsonFileRunStateStore<{ stepId: string }>({
        persistPath,
        maxEntries: 10,
      });

      expect(reloaded.get('run-1')).toEqual(checkpoint);
      expect(reloaded.list(5)).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
