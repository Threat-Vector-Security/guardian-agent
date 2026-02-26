/**
 * Tests for AuditPersistence — hash-chained audit log storage.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AuditPersistence } from './audit-persistence.js';
import type { AuditEvent } from './audit-log.js';

function createEvent(overrides?: Partial<AuditEvent>): AuditEvent {
  return {
    id: `test-${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    type: 'action_denied',
    severity: 'warn',
    agentId: 'test-agent',
    details: { reason: 'test' },
    ...overrides,
  };
}

describe('AuditPersistence', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'audit-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should init and create audit directory', async () => {
    const auditDir = join(tmpDir, 'audit');
    const persistence = new AuditPersistence(auditDir);
    await persistence.init();

    // Directory should exist (init created it)
    const tailResult = await persistence.readTail(10);
    expect(tailResult).toEqual([]);
  });

  it('should persist events and maintain hash chain', async () => {
    const persistence = new AuditPersistence(tmpDir);
    await persistence.init();

    const event1 = createEvent({ id: 'evt-1' });
    const event2 = createEvent({ id: 'evt-2' });
    const event3 = createEvent({ id: 'evt-3' });

    await persistence.persist(event1);
    await persistence.persist(event2);
    await persistence.persist(event3);

    const entries = await persistence.readTail(10);
    expect(entries).toHaveLength(3);

    // Check chain linkage
    expect(entries[0].previousHash).toBe('0'.repeat(64));
    expect(entries[1].previousHash).toBe(entries[0].hash);
    expect(entries[2].previousHash).toBe(entries[1].hash);

    // Each hash should be a 64-char hex string
    for (const entry of entries) {
      expect(entry.hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('should pass chain verification on clean file', async () => {
    const persistence = new AuditPersistence(tmpDir);
    await persistence.init();

    await persistence.persist(createEvent({ id: 'evt-1' }));
    await persistence.persist(createEvent({ id: 'evt-2' }));
    await persistence.persist(createEvent({ id: 'evt-3' }));

    const result = await persistence.verifyChain();
    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBe(3);
    expect(result.brokenAt).toBeUndefined();
  });

  it('should detect tampered entry at correct index', async () => {
    const persistence = new AuditPersistence(tmpDir);
    await persistence.init();

    await persistence.persist(createEvent({ id: 'evt-1' }));
    await persistence.persist(createEvent({ id: 'evt-2' }));
    await persistence.persist(createEvent({ id: 'evt-3' }));

    // Tamper with the second line
    const filePath = persistence.getFilePath();
    const content = await readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    const entry = JSON.parse(lines[1]);
    entry.event.agentId = 'tampered-agent';
    lines[1] = JSON.stringify(entry);

    await writeFile(filePath, lines.join('\n') + '\n', 'utf-8');

    const result = await persistence.verifyChain();
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(2);
  });

  it('should handle empty file', async () => {
    const persistence = new AuditPersistence(tmpDir);
    await persistence.init();

    const result = await persistence.verifyChain();
    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBe(0);
  });

  it('should recover lastHash on re-init', async () => {
    // First instance: write events
    const persistence1 = new AuditPersistence(tmpDir);
    await persistence1.init();
    await persistence1.persist(createEvent({ id: 'evt-1' }));
    await persistence1.persist(createEvent({ id: 'evt-2' }));

    // Second instance: re-init from same file
    const persistence2 = new AuditPersistence(tmpDir);
    await persistence2.init();
    await persistence2.persist(createEvent({ id: 'evt-3' }));

    // Chain should be continuous
    const result = await persistence2.verifyChain();
    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBe(3);
  });

  it('should handle concurrent writes via serialized queue', async () => {
    const persistence = new AuditPersistence(tmpDir);
    await persistence.init();

    // Fire off multiple writes concurrently
    const promises = Array.from({ length: 10 }, (_, i) =>
      persistence.persist(createEvent({ id: `evt-${i}` })),
    );

    await Promise.all(promises);

    const entries = await persistence.readTail(20);
    expect(entries).toHaveLength(10);

    // Chain should be valid despite concurrent writes
    const result = await persistence.verifyChain();
    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBe(10);
  });

  it('readTail should return last N entries', async () => {
    const persistence = new AuditPersistence(tmpDir);
    await persistence.init();

    for (let i = 0; i < 5; i++) {
      await persistence.persist(createEvent({ id: `evt-${i}` }));
    }

    const last2 = await persistence.readTail(2);
    expect(last2).toHaveLength(2);
    expect(last2[0].event.id).toBe('evt-3');
    expect(last2[1].event.id).toBe('evt-4');
  });
});
