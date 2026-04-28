import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { BrokerClient, toBrokerTransportChatOptions } from './broker-client.js';
import type { ChatOptions } from '../llm/types.js';
import type { ToolExecutionRequest } from '../tools/types.js';

describe('toBrokerTransportChatOptions', () => {
  it('strips runtime-only abort signals before broker JSON-RPC transport', () => {
    const controller = new AbortController();
    const options: ChatOptions = {
      model: 'glm-5.1',
      maxTokens: 256,
      temperature: 0,
      responseFormat: { type: 'json_object' },
      tools: [{
        name: 'fs_read',
        description: 'Read a file.',
        parameters: { type: 'object' },
      }],
      signal: controller.signal,
    };

    const transportOptions = toBrokerTransportChatOptions(options);

    expect(transportOptions).toEqual({
      model: 'glm-5.1',
      maxTokens: 256,
      temperature: 0,
      responseFormat: { type: 'json_object' },
      tools: [{
        name: 'fs_read',
        description: 'Read a file.',
        parameters: { type: 'object' },
      }],
    });
    expect(Object.prototype.hasOwnProperty.call(transportOptions, 'signal')).toBe(false);
    expect(options.signal).toBe(controller.signal);
  });
});

describe('BrokerClient tool calls', () => {
  it('allows brokered tool calls to run beyond the lightweight request timeout', async () => {
    vi.useFakeTimers();
    try {
      const brokerToClient = new PassThrough();
      const clientToBroker = new PassThrough();
      const requestChunks: string[] = [];
      clientToBroker.on('data', (chunk) => {
        requestChunks.push(String(chunk));
      });
      const client = new BrokerClient({
        inputStream: brokerToClient,
        outputStream: clientToBroker,
        capabilityToken: 'capability-token',
      });

      const pending = client.callTool({
        toolName: 'fs_search',
        args: { query: 'runLiveToolLoopController', mode: 'content' },
      } as ToolExecutionRequest);

      await vi.advanceTimersByTimeAsync(31_000);

      const request = JSON.parse(requestChunks.join('').trim()) as { id: string };
      brokerToClient.write(`${JSON.stringify({
        jsonrpc: '2.0',
        id: request.id,
        result: {
          success: true,
          status: 'succeeded',
          jobId: 'job-1',
          message: 'ok',
          output: { matches: [{ path: 'src/runtime/chat-agent/live-tool-loop-controller.ts' }] },
        },
      })}\n`);

      await expect(pending).resolves.toMatchObject({
        success: true,
        status: 'succeeded',
        jobId: 'job-1',
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
