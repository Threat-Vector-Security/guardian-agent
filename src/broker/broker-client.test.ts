import { describe, expect, it } from 'vitest';
import { toBrokerTransportChatOptions } from './broker-client.js';
import type { ChatOptions } from '../llm/types.js';

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
