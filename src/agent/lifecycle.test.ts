import { describe, it, expect, beforeEach } from 'vitest';
import { LifecycleManager } from './lifecycle.js';
import { AgentState } from './types.js';

describe('LifecycleManager', () => {
  let lifecycle: LifecycleManager;

  beforeEach(() => {
    lifecycle = new LifecycleManager();
  });

  describe('valid transitions', () => {
    const validCases: [AgentState, AgentState][] = [
      [AgentState.Created, AgentState.Ready],
      [AgentState.Created, AgentState.Dead],
      [AgentState.Ready, AgentState.Running],
      [AgentState.Ready, AgentState.Dead],
      [AgentState.Running, AgentState.Idle],
      [AgentState.Running, AgentState.Paused],
      [AgentState.Running, AgentState.Stalled],
      [AgentState.Running, AgentState.Errored],
      [AgentState.Running, AgentState.Dead],
      [AgentState.Idle, AgentState.Running],
      [AgentState.Idle, AgentState.Paused],
      [AgentState.Idle, AgentState.Dead],
      [AgentState.Paused, AgentState.Running],
      [AgentState.Paused, AgentState.Dead],
      [AgentState.Stalled, AgentState.Running],
      [AgentState.Stalled, AgentState.Errored],
      [AgentState.Stalled, AgentState.Dead],
      [AgentState.Errored, AgentState.Ready],
      [AgentState.Errored, AgentState.Dead],
    ];

    for (const [from, to] of validCases) {
      it(`should allow ${from} → ${to}`, () => {
        expect(lifecycle.isValidTransition(from, to)).toBe(true);
        expect(lifecycle.transition('test-agent', from, to)).toBe(to);
      });
    }
  });

  describe('invalid transitions', () => {
    const invalidCases: [AgentState, AgentState][] = [
      [AgentState.Dead, AgentState.Running],
      [AgentState.Dead, AgentState.Ready],
      [AgentState.Dead, AgentState.Created],
      [AgentState.Created, AgentState.Running], // must go through Ready
      [AgentState.Created, AgentState.Idle],
      [AgentState.Ready, AgentState.Idle],
      [AgentState.Idle, AgentState.Errored],
      [AgentState.Errored, AgentState.Running], // must go through Ready
      [AgentState.Paused, AgentState.Errored],
    ];

    for (const [from, to] of invalidCases) {
      it(`should reject ${from} → ${to}`, () => {
        expect(lifecycle.isValidTransition(from, to)).toBe(false);
        expect(() => lifecycle.transition('test-agent', from, to)).toThrow(
          'Invalid state transition',
        );
      });
    }
  });

  describe('transition events', () => {
    it('should emit events on valid transitions', () => {
      const events: unknown[] = [];
      lifecycle.onTransition((e) => events.push(e));

      lifecycle.transition('agent-1', AgentState.Created, AgentState.Ready);

      expect(events.length).toBe(1);
      expect(events[0]).toMatchObject({
        agentId: 'agent-1',
        from: AgentState.Created,
        to: AgentState.Ready,
      });
    });

    it('should not emit events on invalid transitions', () => {
      const events: unknown[] = [];
      lifecycle.onTransition((e) => events.push(e));

      expect(() =>
        lifecycle.transition('agent-1', AgentState.Dead, AgentState.Running),
      ).toThrow();

      expect(events.length).toBe(0);
    });

    it('should support removing listeners', () => {
      const events: unknown[] = [];
      const listener = (e: unknown) => events.push(e);

      lifecycle.onTransition(listener);
      lifecycle.transition('a', AgentState.Created, AgentState.Ready);
      expect(events.length).toBe(1);

      lifecycle.offTransition(listener);
      lifecycle.transition('b', AgentState.Created, AgentState.Ready);
      expect(events.length).toBe(1); // no new events
    });
  });

  describe('validNextStates', () => {
    it('should return valid next states for Running', () => {
      const next = lifecycle.validNextStates(AgentState.Running);
      expect(next).toContain(AgentState.Idle);
      expect(next).toContain(AgentState.Paused);
      expect(next).toContain(AgentState.Stalled);
      expect(next).toContain(AgentState.Errored);
      expect(next).toContain(AgentState.Dead);
    });

    it('should return empty array for Dead', () => {
      const next = lifecycle.validNextStates(AgentState.Dead);
      expect(next).toEqual([]);
    });
  });
});
