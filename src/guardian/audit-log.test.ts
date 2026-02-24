import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLog } from './audit-log.js';
import type { AuditEvent } from './audit-log.js';

describe('AuditLog', () => {
  let auditLog: AuditLog;

  beforeEach(() => {
    auditLog = new AuditLog(100);
  });

  describe('record', () => {
    it('should record an event and assign id + timestamp', () => {
      const event = auditLog.record({
        type: 'action_denied',
        severity: 'warn',
        agentId: 'test-agent',
        controller: 'CapabilityController',
        details: { reason: 'no write_files' },
      });

      expect(event.id).toMatch(/^audit-/);
      expect(event.timestamp).toBeGreaterThan(0);
      expect(event.type).toBe('action_denied');
      expect(event.severity).toBe('warn');
      expect(event.agentId).toBe('test-agent');
      expect(auditLog.size).toBe(1);
    });

    it('should evict oldest events when ring buffer is full', () => {
      const log = new AuditLog(5);

      for (let i = 0; i < 10; i++) {
        log.record({
          type: 'action_allowed',
          severity: 'info',
          agentId: `agent-${i}`,
          details: { index: i },
        });
      }

      expect(log.size).toBe(5);
      const all = log.getAll();
      // Should have the last 5 events (indices 5-9)
      expect((all[0].details as Record<string, unknown>)['index']).toBe(5);
      expect((all[4].details as Record<string, unknown>)['index']).toBe(9);
    });

    it('should include optional fields', () => {
      const event = auditLog.record({
        type: 'secret_detected',
        severity: 'critical',
        agentId: 'agent-1',
        userId: 'user-1',
        channel: 'telegram',
        controller: 'SecretScanController',
        details: { pattern: 'AWS Access Key' },
      });

      expect(event.userId).toBe('user-1');
      expect(event.channel).toBe('telegram');
    });
  });

  describe('query', () => {
    beforeEach(() => {
      auditLog.record({ type: 'action_denied', severity: 'warn', agentId: 'agent-1', controller: 'Cap', details: {} });
      auditLog.record({ type: 'secret_detected', severity: 'critical', agentId: 'agent-1', details: {} });
      auditLog.record({ type: 'action_allowed', severity: 'info', agentId: 'agent-2', details: {} });
      auditLog.record({ type: 'action_denied', severity: 'warn', agentId: 'agent-2', controller: 'Cap', details: {} });
      auditLog.record({ type: 'rate_limited', severity: 'warn', agentId: 'agent-1', controller: 'RL', details: {} });
    });

    it('should filter by type', () => {
      const results = auditLog.query({ type: 'action_denied' });
      expect(results.length).toBe(2);
    });

    it('should filter by agentId', () => {
      const results = auditLog.query({ agentId: 'agent-1' });
      expect(results.length).toBe(3);
    });

    it('should filter by severity', () => {
      const results = auditLog.query({ severity: 'critical' });
      expect(results.length).toBe(1);
      expect(results[0].type).toBe('secret_detected');
    });

    it('should filter by time window', () => {
      const now = Date.now();
      const results = auditLog.query({ after: now - 1000, before: now + 1000 });
      expect(results.length).toBe(5);
    });

    it('should respect limit', () => {
      const results = auditLog.query({ limit: 2 });
      expect(results.length).toBe(2);
    });

    it('should combine filters', () => {
      const results = auditLog.query({ type: 'action_denied', agentId: 'agent-1' });
      expect(results.length).toBe(1);
    });
  });

  describe('getRecentEvents', () => {
    it('should return the N most recent events', () => {
      for (let i = 0; i < 10; i++) {
        auditLog.record({ type: 'action_allowed', severity: 'info', agentId: `a-${i}`, details: {} });
      }

      const recent = auditLog.getRecentEvents(3);
      expect(recent.length).toBe(3);
      expect(recent[0].agentId).toBe('a-7');
      expect(recent[2].agentId).toBe('a-9');
    });
  });

  describe('getSummary', () => {
    it('should produce correct summary counts', () => {
      auditLog.record({ type: 'action_denied', severity: 'warn', agentId: 'a1', controller: 'Cap', details: {} });
      auditLog.record({ type: 'action_denied', severity: 'warn', agentId: 'a1', controller: 'Cap', details: {} });
      auditLog.record({ type: 'secret_detected', severity: 'critical', agentId: 'a2', controller: 'Secret', details: {} });
      auditLog.record({ type: 'action_allowed', severity: 'info', agentId: 'a1', details: {} });
      auditLog.record({ type: 'rate_limited', severity: 'warn', agentId: 'a2', controller: 'RL', details: {} });

      const summary = auditLog.getSummary(60_000);

      expect(summary.totalEvents).toBe(5);
      expect(summary.byType['action_denied']).toBe(2);
      expect(summary.byType['secret_detected']).toBe(1);
      expect(summary.bySeverity.warn).toBe(3);
      expect(summary.bySeverity.critical).toBe(1);
      expect(summary.bySeverity.info).toBe(1);

      // Top denied agents
      expect(summary.topDeniedAgents[0].agentId).toBe('a1');
      expect(summary.topDeniedAgents[0].count).toBe(2);

      // Top controllers
      expect(summary.topControllers.length).toBeGreaterThan(0);
    });

    it('should return empty summary for no events', () => {
      const summary = auditLog.getSummary(60_000);
      expect(summary.totalEvents).toBe(0);
      expect(summary.bySeverity).toEqual({ info: 0, warn: 0, critical: 0 });
    });
  });

  describe('clear', () => {
    it('should remove all events', () => {
      auditLog.record({ type: 'action_allowed', severity: 'info', agentId: 'a1', details: {} });
      expect(auditLog.size).toBe(1);
      auditLog.clear();
      expect(auditLog.size).toBe(0);
    });
  });
});
