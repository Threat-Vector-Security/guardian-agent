/**
 * Tests for CircuitBreaker.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker, classifyError } from './circuit-breaker.js';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start in closed state', () => {
    const breaker = new CircuitBreaker();
    expect(breaker.getState()).toBe('closed');
    expect(breaker.canRequest()).toBe(true);
  });

  it('should open after failure threshold', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3 });

    breaker.recordFailure(new Error('timeout'));
    expect(breaker.getState()).toBe('closed');

    breaker.recordFailure(new Error('timeout'));
    expect(breaker.getState()).toBe('closed');

    breaker.recordFailure(new Error('timeout'));
    expect(breaker.getState()).toBe('open');
    expect(breaker.canRequest()).toBe(false);
  });

  it('should transition to half_open after reset timeout', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 5000 });

    breaker.recordFailure(new Error('timeout'));
    expect(breaker.getState()).toBe('open');

    vi.advanceTimersByTime(5000);
    expect(breaker.getState()).toBe('half_open');
    expect(breaker.canRequest()).toBe(true);
  });

  it('should close from half_open on success', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000, halfOpenSuccesses: 1 });

    breaker.recordFailure(new Error('timeout'));
    vi.advanceTimersByTime(1000);
    expect(breaker.getState()).toBe('half_open');

    breaker.recordSuccess();
    expect(breaker.getState()).toBe('closed');
  });

  it('should reopen from half_open on failure', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000 });

    breaker.recordFailure(new Error('timeout'));
    vi.advanceTimersByTime(1000);
    expect(breaker.getState()).toBe('half_open');

    breaker.recordFailure(new Error('timeout'));
    expect(breaker.getState()).toBe('open');
  });

  it('should reset failure count on success in closed state', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3 });

    breaker.recordFailure(new Error('timeout'));
    breaker.recordFailure(new Error('timeout'));
    breaker.recordSuccess();

    // After success, failure count resets — need 3 more failures
    breaker.recordFailure(new Error('timeout'));
    breaker.recordFailure(new Error('timeout'));
    expect(breaker.getState()).toBe('closed');

    breaker.recordFailure(new Error('timeout'));
    expect(breaker.getState()).toBe('open');
  });

  it('should immediately open on auth errors', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 5 });

    breaker.recordFailure({ status: 401, message: 'Unauthorized' });
    expect(breaker.getState()).toBe('open');
  });

  it('should not count permanent errors toward threshold', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2 });

    breaker.recordFailure(new Error('invalid input'));
    breaker.recordFailure(new Error('bad request'));
    // Permanent errors don't count
    expect(breaker.getState()).toBe('closed');
  });

  it('reset should return to closed state', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 });
    breaker.recordFailure(new Error('timeout'));
    expect(breaker.getState()).toBe('open');

    breaker.reset();
    expect(breaker.getState()).toBe('closed');
    expect(breaker.canRequest()).toBe(true);
  });
});

describe('classifyError', () => {
  it('should classify auth errors', () => {
    expect(classifyError({ status: 401, message: '' })).toBe('auth');
    expect(classifyError({ status: 403, message: '' })).toBe('auth');
    expect(classifyError(new Error('unauthorized'))).toBe('auth');
    expect(classifyError(new Error('Invalid API key'))).toBe('auth');
  });

  it('should classify quota/rate limit errors', () => {
    expect(classifyError({ status: 429, message: '' })).toBe('quota');
    expect(classifyError(new Error('rate limit exceeded'))).toBe('quota');
    expect(classifyError(new Error('too many requests'))).toBe('quota');
  });

  it('should classify timeout errors', () => {
    expect(classifyError({ code: 'ETIMEDOUT', message: '' })).toBe('timeout');
    expect(classifyError(new Error('request timeout'))).toBe('timeout');
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    expect(classifyError(abortError)).toBe('timeout');
  });

  it('should classify transient server errors', () => {
    expect(classifyError({ status: 500, message: '' })).toBe('transient');
    expect(classifyError({ status: 503, message: '' })).toBe('transient');
    expect(classifyError({ code: 'ECONNREFUSED', message: '' })).toBe('transient');
    expect(classifyError(new Error('socket hang up'))).toBe('transient');
  });

  it('should classify unknown errors as permanent', () => {
    expect(classifyError(new Error('invalid input'))).toBe('permanent');
    expect(classifyError(null)).toBe('permanent');
  });
});
