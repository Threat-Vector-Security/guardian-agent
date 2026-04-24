import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { OutputGuardian } from '../guardian/output-guardian.js';
import type { Runtime } from '../runtime/runtime.js';
import type { ToolExecutor } from '../tools/executor.js';
import { CapabilityTokenManager } from './capability-token.js';
import { BrokerServer } from './broker-server.js';

describe('BrokerServer', () => {
  it('returns sanitized tool output without nesting the full tool response under output', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const responsePromise = readFirstJsonLine(output);
    const tokenManager = new CapabilityTokenManager();
    const token = tokenManager.mint({
      workerId: 'worker-1',
      sessionId: 'session-1',
      agentId: 'agent-1',
      authorizedBy: 'owner',
      authorizedChannel: 'code-session',
      grantedCapabilities: ['tool.call'],
    });
    const runTool = vi.fn(async () => ({
      success: true,
      status: 'succeeded',
      jobId: 'job-1',
      message: "Tool 'fs_search' completed.",
      output: {
        root: 'S:/Development/GuardianAgent/src',
        query: 'run timeline',
        matches: [{
          relativePath: 'src/runtime/run-timeline.ts',
          matchType: 'content',
          snippet: 'export class RunTimelineStore',
        }],
      },
    }));
    const tools = {
      searchTools: vi.fn(() => []),
      listAlwaysLoadedDefinitions: vi.fn(() => []),
      listCodeSessionEagerToolDefinitions: vi.fn(() => []),
      getToolDefinition: vi.fn(() => ({
        name: 'fs_search',
        description: 'Search files.',
        parameters: { type: 'object' },
        category: 'filesystem',
      })),
      runTool,
      getApprovalSummaries: vi.fn(() => new Map()),
    } as unknown as ToolExecutor;
    const runtime = {
      outputGuardian: new OutputGuardian(undefined, { enabled: false }),
      auditLog: { record: vi.fn() },
    } as unknown as Runtime;

    new BrokerServer({
      tools,
      runtime,
      tokenManager,
      inputStream: input,
      outputStream: output,
      workerId: 'worker-1',
    });

    input.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: 'request-1',
      method: 'tool.call',
      params: {
        capabilityToken: token.id,
        toolName: 'fs_search',
        args: { query: 'run timeline' },
        requestId: 'message-1',
      },
    })}\n`);

    const response = await responsePromise as {
      result?: {
        success?: boolean;
        output?: Record<string, unknown>;
      };
      error?: unknown;
    };

    expect(response.error).toBeUndefined();
    expect(response.result?.success).toBe(true);
    expect(response.result?.output).toMatchObject({
      query: 'run timeline',
      matches: [{
        relativePath: 'src/runtime/run-timeline.ts',
        matchType: 'content',
      }],
    });
    expect(response.result?.output?.output).toBeUndefined();
    expect(runTool).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'fs_search',
      requestId: 'message-1',
      channel: 'code-session',
    }));
  });
});

function readFirstJsonLine(stream: PassThrough): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk: Buffer | string) => {
      buffer += chunk.toString();
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex === -1) return;
      stream.off('data', onData);
      try {
        resolve(JSON.parse(buffer.slice(0, newlineIndex)));
      } catch (error) {
        reject(error);
      }
    };
    stream.on('data', onData);
  });
}
