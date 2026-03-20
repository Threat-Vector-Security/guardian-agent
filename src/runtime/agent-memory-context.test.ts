import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { AgentMemoryStore } from './agent-memory-store.js';

const createdDirs: string[] = [];

afterEach(() => {
  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeStore(maxContextChars = 180) {
  const basePath = join(tmpdir(), `guardianagent-memory-context-${randomUUID()}`);
  createdDirs.push(basePath);
  return new AgentMemoryStore({
    enabled: true,
    basePath,
    readOnly: false,
    maxContextChars,
    maxFileChars: 5000,
  });
}

describe('AgentMemoryStore context packing', () => {
  it('derives a short summary for long entries when one is not provided', () => {
    const store = makeStore();
    const stored = store.append('agent1', {
      content: 'The parser refactor should stay split into scanner, token stream, and error recovery layers so the importer can share the same AST contract without inheriting the legacy fallback path. '.repeat(3),
      createdAt: '2026-03-20',
      category: 'Decisions',
    });

    expect(stored.summary).toBeTruthy();
    expect(stored.summary!.length).toBeLessThanOrEqual(200);
  });

  it('packs prompt context entry-by-entry instead of slicing through a long memory', () => {
    const store = makeStore(170);
    store.append('agent1', {
      content: 'User prefers concise status updates.',
      createdAt: '2026-03-20',
      category: 'Preferences',
    });
    store.append('agent1', {
      content: 'The importer overhaul includes a long implementation note with parser checkpoints, schema migration reminders, retry edge cases, release sequencing, and verification details that should not be cut off mid-sentence when prompt context is trimmed.'.repeat(2),
      summary: 'Importer overhaul note covering checkpoints, migration, retries, and verification.',
      createdAt: '2026-03-20',
      category: 'Project Notes',
    });

    const context = store.loadForContext('agent1');

    expect(context.length).toBeLessThanOrEqual(170);
    expect(context).toContain('Importer overhaul note covering checkpoints, migration, retries, and verification.');
    expect(context).not.toContain('should not be cut off mid-sentence');
    expect(context).not.toContain('[... knowledge base truncated');
  });
});
