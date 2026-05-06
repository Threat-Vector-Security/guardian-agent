import { describe, expect, it } from 'vitest';
import { summarizeRoutingLatency } from '../web/public/js/performance-latency.js';

describe('summarizeRoutingLatency', () => {
  it('summarizes recent assistant routing latency samples', () => {
    const summary = summarizeRoutingLatency([
      {
        details: {
          totalDispatchDurationMs: 100,
          runtimeDispatchDurationMs: 70,
          intentGatewayLatencyMs: 20,
        },
      },
      {
        details: {
          totalDispatchDurationMs: 240,
          runtimeDispatchDurationMs: 180,
          intentGatewayLatencyMs: 40,
          fallbackRuntimeDispatchDurationMs: 30,
        },
      },
      {
        details: {
          totalDispatchDurationMs: 360,
          runtimeDispatchDurationMs: 210,
          intentGatewayLatencyMs: 60,
        },
      },
    ]);

    expect(summary).toEqual({
      sampleCount: 3,
      avgTotalMs: 233,
      p95TotalMs: 360,
      maxTotalMs: 360,
      avgRuntimeMs: 153,
      avgGatewayMs: 40,
      fallbackCount: 1,
    });
  });

  it('ignores trace rows without dispatch timing', () => {
    const summary = summarizeRoutingLatency([
      { details: { stage: 'intent_gateway_decision' } },
      { details: { totalDispatchDurationMs: -1 } },
      { details: { totalDispatchDurationMs: Number.NaN } },
    ]);

    expect(summary).toBeNull();
  });

  it('handles samples that do not include optional timing lanes', () => {
    const summary = summarizeRoutingLatency([
      { details: { totalDispatchDurationMs: 125.4 } },
      { details: { totalDispatchDurationMs: 175.6 } },
    ]);

    expect(summary).toEqual({
      sampleCount: 2,
      avgTotalMs: 151,
      p95TotalMs: 176,
      maxTotalMs: 176,
      avgRuntimeMs: null,
      avgGatewayMs: null,
      fallbackCount: 0,
    });
  });
});
