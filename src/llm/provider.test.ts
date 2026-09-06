import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFailoverProvider, createProvider, createProviders } from './provider.js';
import { OllamaProvider } from './ollama.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import type { LLMConfig } from '../config/types.js';

describe('createProvider', () => {
  it('should create OllamaProvider for ollama config', () => {
    const config: LLMConfig = { provider: 'ollama', model: 'gpt-oss:120b' };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(OllamaProvider);
    expect(provider.name).toBe('ollama');
  });

  it('should create AnthropicProvider for anthropic config', () => {
    const config: LLMConfig = {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      apiKey: 'sk-test',
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider.name).toBe('anthropic');
  });

  it('should create OpenAIProvider for openai config', () => {
    const config: LLMConfig = {
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-test',
    };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.name).toBe('openai');
  });

  it('should throw for unknown provider', () => {
    const config = { provider: 'unknown', model: 'test' } as LLMConfig;
    expect(() => createProvider(config)).toThrow("Unknown LLM provider: 'unknown'");
  });
});

describe('createProviders', () => {
  it('should create a map of providers from config', () => {
    const configs: Record<string, LLMConfig> = {
      local: { provider: 'ollama', model: 'gpt-oss:120b' },
      cloud: { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' },
    };

    const providers = createProviders(configs);
    expect(providers.size).toBe(2);
    expect(providers.get('local')).toBeInstanceOf(OllamaProvider);
    expect(providers.get('cloud')).toBeInstanceOf(OpenAIProvider);
  });

  it('skips disabled provider profiles', () => {
    const configs: Record<string, LLMConfig> = {
      local: { provider: 'ollama', model: 'gpt-oss:120b' },
      cloud: { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test', enabled: false },
    };

    const providers = createProviders(configs);
    expect(providers.size).toBe(1);
    expect(providers.has('local')).toBe(true);
    expect(providers.has('cloud')).toBe(false);
  });
});

describe('createFailoverProvider', () => {
  it('skips disabled provider profiles in failover order', () => {
    const failover = createFailoverProvider({
      local: { provider: 'ollama', model: 'gpt-oss:120b' },
      cloud: { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test', enabled: false },
    });

    expect(failover.getCircuitStates().map((state) => state.name)).toEqual(['local']);
  });
});

describe('OllamaProvider', () => {
  it('should handle chat API errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {
          'content-type': 'text/plain',
        },
      }),
    ));
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const config: LLMConfig = { provider: 'ollama', model: 'gpt-oss:120b' };
    const provider = createProvider(config);

    await expect(
      provider.chat([{ role: 'user', content: 'hello' }]),
    ).rejects.toThrow('Ollama API error 500');
    expect(consoleLogSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
    consoleLogSpy.mockRestore();
  });

  it('should parse successful chat response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        model: 'gpt-oss:120b',
        created_at: new Date().toISOString(),
        message: { role: 'assistant', content: 'Hello!' },
        done: true,
        done_reason: 'stop',
        total_duration: 1,
        load_duration: 1,
        prompt_eval_count: 10,
        prompt_eval_duration: 1,
        eval_count: 5,
        eval_duration: 1,
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    ));

    const config: LLMConfig = { provider: 'ollama', model: 'gpt-oss:120b' };
    const provider = createProvider(config);
    const response = await provider.chat([{ role: 'user', content: 'hello' }]);

    expect(response.content).toBe('Hello!');
    expect(response.model).toBe('gpt-oss:120b');
    expect(response.finishReason).toBe('stop');
    expect(response.usage?.totalTokens).toBe(15);

    vi.unstubAllGlobals();
  });

  it('passes JSON response format hints through to Ollama-compatible providers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        model: 'gpt-oss:120b',
        created_at: new Date().toISOString(),
        message: { role: 'assistant', content: '{"ok":true}' },
        done: true,
        done_reason: 'stop',
        total_duration: 1,
        load_duration: 1,
        prompt_eval_count: 10,
        prompt_eval_duration: 1,
        eval_count: 5,
        eval_duration: 1,
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const config: LLMConfig = { provider: 'ollama', model: 'gpt-oss:120b' };
    const provider = createProvider(config);

    await provider.chat([{ role: 'user', content: 'Return JSON.' }], {
      responseFormat: { type: 'json_object' },
    });

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'));
    expect(request.format).toBe('json');

    vi.unstubAllGlobals();
  });

  it('retries Ollama chat without think mode when the selected model rejects it', async () => {
    const fetchMock = vi.fn(async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (body.think !== undefined) {
        return new Response(JSON.stringify({
          error: 'thinking is not supported for this model',
        }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        model: 'mistral',
        created_at: new Date().toISOString(),
        message: { role: 'assistant', content: 'Basic path worked.' },
        done: true,
        done_reason: 'stop',
        total_duration: 1,
        load_duration: 1,
        prompt_eval_count: 4,
        prompt_eval_duration: 1,
        eval_count: 5,
        eval_duration: 1,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const config: LLMConfig = { provider: 'ollama', model: 'mistral', think: 'high' };
    const provider = createProvider(config);
    const response = await provider.chat([{ role: 'user', content: 'hello' }]);

    expect(response.content).toBe('Basic path worked.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstRequest = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'));
    const secondRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body ?? '{}'));
    expect(firstRequest.think).toBe('high');
    expect(secondRequest).not.toHaveProperty('think');

    vi.unstubAllGlobals();
  });

  it('should surface a helpful connectivity error when Ollama is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    const config: LLMConfig = { provider: 'ollama', model: 'gpt-oss:120b' };
    const provider = createProvider(config);

    await expect(
      provider.chat([{ role: 'user', content: 'hello' }]),
    ).rejects.toThrow('Could not reach Ollama');

    vi.unstubAllGlobals();
  });

  it('should list models via /api/tags', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        models: [
          { name: 'gpt-oss:120b', size: 1000 },
          { name: 'mistral', size: 2000 },
        ],
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    ));

    const config: LLMConfig = { provider: 'ollama', model: 'gpt-oss:120b' };
    const provider = createProvider(config);
    const models = await provider.listModels();

    expect(models).toHaveLength(2);
    expect(models[0]).toMatchObject({ id: 'gpt-oss:120b', provider: 'ollama' });

    vi.unstubAllGlobals();
  });

  it('enriches Ollama models with live capability metadata from /api/show', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/tags')) {
        return new Response(JSON.stringify({
          models: [
            { name: 'qwen3:32b', size: 1000 },
          ],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/api/show')) {
        return new Response(JSON.stringify({
          capabilities: ['completion', 'thinking'],
          model_info: {
            'qwen3.context_length': 32768,
          },
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 404 });
    }));

    const config: LLMConfig = { provider: 'ollama', model: 'qwen3:32b' };
    const provider = createProvider(config);
    const models = await provider.listModels();

    expect(models[0]).toMatchObject({
      id: 'qwen3:32b',
      provider: 'ollama',
      contextWindow: 32768,
      capabilities: ['completion', 'thinking'],
    });

    vi.unstubAllGlobals();
  });

  it('should return empty list on connection failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const config: LLMConfig = { provider: 'ollama', model: 'gpt-oss:120b' };
    const provider = createProvider(config);
    const models = await provider.listModels();

    expect(models).toEqual([]);

    vi.unstubAllGlobals();
  });
});

describe('AnthropicProvider', () => {
  it('lists current models from the SDK endpoint and obeys its result limit', async () => {
    const config: LLMConfig = {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      apiKey: 'sk-test',
    };
    const provider = createProvider(config);
    const list = vi.fn().mockResolvedValue([{ id: 'server-model-one', display_name: 'Server model' }, { id: 'server-model-two', display_name: 'Second model' }]);
    (provider as any).client = { models: { list } };
    const controller = new AbortController();
    await expect(provider.listModels({ signal: controller.signal, limit: 1 })).resolves.toEqual([{ id: 'server-model-one', name: 'Server model', provider: 'anthropic' }]);
    expect(list).toHaveBeenCalledWith({ limit: 100 }, { signal: controller.signal });
    list.mockRejectedValueOnce(new Error('Unavailable'));
    await expect(provider.listModels()).rejects.toThrow('Unavailable');
  });
});

describe('OpenAIProvider compatibility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves recognized quota diagnostics through the wrapped SDK error', async () => {
    const provider = new OpenAIProvider({ provider: 'openai', model: 'test', apiKey: 'test-key' });
    (provider as any).client = { chat: { completions: { create: vi.fn().mockRejectedValue(Object.assign(new Error('secret-key and user context'), { status: 429, code: 'insufficient_quota', param: 'malicious-secret-param' })) } } };
    try { await provider.chat([{ role: 'user', content: 'Test' }]); throw new Error('Expected provider failure'); }
    catch (error) {
      expect(error).toMatchObject({ status: 429, code: 'insufficient_quota' });
      expect(error).not.toHaveProperty('param');
      expect((error as Error).message).not.toContain('secret-key');
    }
  });

  it.each(['chat', 'stream'] as const)('retries %s max-token then sampling incompatibility without weakening other controls', async mode => {
    const provider = new OpenAIProvider({ provider: 'openai', model: 'test-model', apiKey: 'test-key', temperature: 0.2, topP: 0.9, maxTokens: 1234, parallelToolCalls: false, toolChoice: 'required' });
    const completion = { choices: [{ message: { content: 'Complete' }, finish_reason: 'stop' }], model: 'test-model' };
    const streamed = async function* () { yield { choices: [{ delta: { content: 'Complete' }, finish_reason: 'stop' }], model: 'test-model' }; };
    const create = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("Unsupported parameter: 'max_tokens'. Use 'max_completion_tokens' instead."), { status: 400, code: 'unsupported_parameter', param: 'max_tokens' }))
      .mockRejectedValueOnce(Object.assign(new Error('Unsupported sampling value'), { status: 400, code: 'unsupported_value', param: 'temperature' }))
      .mockResolvedValueOnce(mode === 'chat' ? completion : streamed());
    (provider as any).client = { chat: { completions: { create } } };
    const options = { responseFormat: { type: 'json_schema' as const, name: 'review', schema: { type: 'object', properties: { result: { type: 'string' } }, required: ['result'], additionalProperties: false } }, tools: [{ name: 'inspect', description: 'Inspect', parameters: { type: 'object', properties: {} } }] };
    if (mode === 'chat') expect((await provider.chat([{ role: 'user', content: 'Inspect' }], options)).content).toBe('Complete');
    else { const chunks = []; for await (const chunk of provider.stream([{ role: 'user', content: 'Inspect' }], options)) chunks.push(chunk); expect(chunks[0]?.content).toBe('Complete'); }
    expect(create).toHaveBeenCalledTimes(3);
    const before = create.mock.calls[1][0];
    const after = create.mock.calls[2][0];
    const { temperature: _removed, ...unchanged } = before;
    expect(after).toEqual(unchanged);
    expect(after).toMatchObject({ model: 'test-model', max_completion_tokens: 1234, top_p: 0.9, tool_choice: 'required', parallel_tool_calls: false });
    expect(after).toHaveProperty('response_format');
    expect(after).toHaveProperty('tools');
  });

  it.each(['temperature', 'top_p'])('removes only explicitly unsupported %s and never retries an ordinary validation error', async parameter => {
    const provider = new OpenAIProvider({ provider: 'openai', model: 'test-model', apiKey: 'test-key', temperature: 0.2, topP: 0.8 });
    const create = vi.fn().mockRejectedValueOnce(Object.assign(new Error('Provider rejected request'), { status: 400, error: { code: 'unsupported_parameter', param: parameter } }))
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Accepted' }, finish_reason: 'stop' }], model: 'test-model' });
    (provider as any).client = { chat: { completions: { create } } };
    await provider.chat([{ role: 'user', content: 'Test' }]);
    const before = { ...create.mock.calls[0][0] };
    delete before[parameter];
    expect(create.mock.calls[1][0]).toEqual(before);
    create.mockReset().mockRejectedValue(Object.assign(new Error('Invalid request with temperature and tool_choice'), { status: 400, code: 'invalid_request_error', param: parameter }));
    await expect(provider.chat([{ role: 'user', content: 'Test' }])).rejects.toMatchObject({ status: 400 });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('preserves sampling settings when a compatible provider accepts them', async () => {
    const provider = new OpenAIProvider({ provider: 'openrouter', model: 'account-model', apiKey: 'test-key', temperature: 0.3, topP: 0.7 }, 'openrouter');
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: 'Accepted' }, finish_reason: 'stop' }], model: 'account-model' });
    (provider as any).client = { chat: { completions: { create } } };
    await provider.chat([{ role: 'user', content: 'Test' }]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({ temperature: 0.3, top_p: 0.7 });
  });

  it('retries with max_completion_tokens when max_tokens is rejected by newer OpenAI models', async () => {
    const provider = new OpenAIProvider({
      provider: 'openai',
      model: 'gpt-5.1',
      apiKey: 'sk-test',
    });

    const create = vi.fn()
      .mockRejectedValueOnce(Object.assign(
        new Error("400 Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead."),
        { status: 400 },
      ))
      .mockResolvedValueOnce({
        choices: [
          {
            message: { content: 'Hello from GPT-5.1' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 4,
          total_tokens: 9,
        },
        model: 'gpt-5.1',
      });

    (provider as any).client = {
      chat: {
        completions: {
          create,
        },
      },
      models: {
        list: vi.fn(),
      },
    };

    const response = await provider.chat([{ role: 'user', content: 'Hello?' }]);

    expect(response.content).toBe('Hello from GPT-5.1');
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      model: 'gpt-5.1',
      max_tokens: 4096,
    });
    expect(create.mock.calls[1]?.[0]).toMatchObject({
      model: 'gpt-5.1',
      max_completion_tokens: 4096,
    });
    expect(create.mock.calls[1]?.[0]).not.toHaveProperty('max_tokens');
  });

  it('retries without optional capability settings when an OpenAI-compatible endpoint rejects them', async () => {
    const provider = new OpenAIProvider({
      provider: 'openai',
      model: 'gpt-5.1',
      apiKey: 'sk-test',
      reasoning: { effort: 'high', summary: 'concise', budgetTokens: 1024 },
      verbosity: 'high',
      parallelToolCalls: true,
      toolChoice: 'auto',
    });

    const create = vi.fn()
      .mockRejectedValueOnce(Object.assign(
        new Error("400 Unsupported parameter: 'reasoning_effort' is not supported with this model."),
        { status: 400 },
      ))
      .mockResolvedValueOnce({
        choices: [
          {
            message: { content: 'Basic path worked.' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 4,
          total_tokens: 9,
        },
        model: 'gpt-5.1',
      });

    (provider as any).client = {
      chat: {
        completions: {
          create,
        },
      },
      models: {
        list: vi.fn(),
      },
    };

    const response = await provider.chat([{ role: 'user', content: 'Hello?' }], {
      tools: [{
        name: 'lookup',
        description: 'Look something up.',
        parameters: { type: 'object', properties: {} },
      }],
    });

    expect(response.content).toBe('Basic path worked.');
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      reasoning_effort: 'high',
      reasoning: { summary: 'concise', max_tokens: 1024 },
      verbosity: 'high',
      parallel_tool_calls: true,
      tool_choice: 'auto',
    });
    expect(create.mock.calls[1]?.[0]).not.toHaveProperty('reasoning_effort');
    expect(create.mock.calls[1]?.[0]).not.toHaveProperty('reasoning');
    expect(create.mock.calls[1]?.[0]).not.toHaveProperty('verbosity');
    expect(create.mock.calls[1]?.[0]).not.toHaveProperty('parallel_tool_calls');
    expect(create.mock.calls[1]?.[0]).not.toHaveProperty('tool_choice');
    expect(create.mock.calls[1]?.[0]).toHaveProperty('tools');
  });

  it('sends configured optional capability settings to OpenAI-compatible providers', async () => {
    const provider = new OpenAIProvider({
      provider: 'openrouter',
      model: 'openai/gpt-5.1',
      apiKey: 'or-test',
      baseUrl: 'https://openrouter.ai/api/v1',
      reasoning: { effort: 'high', summary: 'detailed', budgetTokens: 2048 },
      verbosity: 'high',
    }, 'openrouter');

    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: { content: 'ok' },
          finish_reason: 'stop',
        },
      ],
      model: 'openai/gpt-5.1',
    });

    (provider as any).client = {
      chat: {
        completions: {
          create,
        },
      },
      models: {
        list: vi.fn(),
      },
    };

    await provider.chat([{ role: 'user', content: 'Hello?' }]);

    expect(create.mock.calls[0]?.[0]).toMatchObject({
      reasoning_effort: 'high',
      reasoning: { summary: 'detailed', max_tokens: 2048 },
      verbosity: 'high',
    });
  });

  it('passes JSON response format hints through to OpenAI-compatible providers', async () => {
    const provider = new OpenAIProvider({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      apiKey: 'sk-test',
    });

    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: { content: '{"ok":true}' },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 5,
        completion_tokens: 3,
        total_tokens: 8,
      },
      model: 'gpt-4.1-mini',
    });

    (provider as any).client = {
      chat: {
        completions: {
          create,
        },
      },
      models: {
        list: vi.fn(),
      },
    };

    await provider.chat([{ role: 'user', content: 'Return JSON.' }], {
      responseFormat: { type: 'json_object' },
    });

    expect(create.mock.calls[0]?.[0]).toMatchObject({
      response_format: { type: 'json_object' },
    });
  });

  it('adds OpenRouter automatic routing as the fallback for the selected model', async () => {
    const provider = new OpenAIProvider({
      provider: 'openrouter',
      model: 'qwen/qwen3.6-coder',
      apiKey: 'or-test',
      baseUrl: 'https://openrouter.ai/api/v1',
    }, 'openrouter');

    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: { content: 'ok' },
          finish_reason: 'stop',
        },
      ],
      model: 'qwen/qwen3.6-coder',
    });

    (provider as any).client = {
      chat: {
        completions: {
          create,
        },
      },
      models: {
        list: vi.fn(),
      },
    };

    await provider.chat([{ role: 'user', content: 'Hello?' }]);

    expect(create.mock.calls[0]?.[0]).toMatchObject({
      model: 'qwen/qwen3.6-coder',
      models: ['qwen/qwen3.6-coder', 'openrouter/auto'],
      route: 'fallback',
    });
  });

  it('does not duplicate OpenRouter auto when it is the selected model', async () => {
    const provider = new OpenAIProvider({
      provider: 'openrouter',
      model: 'openrouter/auto',
      apiKey: 'or-test',
      baseUrl: 'https://openrouter.ai/api/v1',
    }, 'openrouter');

    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: { content: 'ok' },
          finish_reason: 'stop',
        },
      ],
      model: 'openrouter/auto',
    });

    (provider as any).client = {
      chat: {
        completions: {
          create,
        },
      },
      models: {
        list: vi.fn(),
      },
    };

    await provider.chat([{ role: 'user', content: 'Hello?' }]);

    expect(create.mock.calls[0]?.[0]).toMatchObject({
      model: 'openrouter/auto',
    });
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty('models');
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty('route');
  });

  it('does not add OpenRouter fallback routing to other compatible providers', async () => {
    const provider = new OpenAIProvider({
      provider: 'nvidia',
      model: 'nvidia/llama-3.3-nemotron-super-49b-v1',
      apiKey: 'nv-test',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
    }, 'nvidia');

    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: { content: 'ok' },
          finish_reason: 'stop',
        },
      ],
      model: 'nvidia/llama-3.3-nemotron-super-49b-v1',
    });

    (provider as any).client = {
      chat: {
        completions: {
          create,
        },
      },
      models: {
        list: vi.fn(),
      },
    };

    await provider.chat([{ role: 'user', content: 'Hello?' }]);

    expect(create.mock.calls[0]?.[0]).not.toHaveProperty('models');
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty('route');
  });

  it('maps OpenAI-compatible model catalog metadata into supported parameters', async () => {
    const provider = new OpenAIProvider({
      provider: 'openrouter',
      model: 'openai/gpt-5.1',
      apiKey: 'or-test',
      baseUrl: 'https://openrouter.ai/api/v1',
    }, 'openrouter');

    (provider as any).client = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
      models: {
        list: vi.fn().mockResolvedValue([
          {
            id: 'openai/gpt-5.1',
            name: 'GPT-5.1',
            context_length: 128000,
            supported_parameters: ['temperature', 'top_p', 'reasoning_effort', 'verbosity', 'tool_choice'],
            capabilities: ['tools'],
          },
        ]),
      },
    };

    await expect(provider.listModels()).resolves.toEqual([
      {
        id: 'openai/gpt-5.1',
        name: 'GPT-5.1',
        provider: 'openrouter',
        contextWindow: 128000,
        supportedParameters: ['temperature', 'top_p', 'reasoning_effort', 'verbosity', 'tool_choice'],
        capabilities: ['tools'],
      },
    ]);
  });

  it('surfaces provider-specific model-not-found guidance for xAI', async () => {
    const provider = new OpenAIProvider({
      provider: 'xai',
      model: 'grok-2-latest',
      apiKey: 'xai-test',
      baseUrl: 'https://api.x.ai/v1',
    }, 'xai');

    const create = vi.fn().mockRejectedValue(
      Object.assign(new Error('400 Model not found: grok-2-latest'), { status: 400 }),
    );

    (provider as any).client = {
      chat: {
        completions: {
          create,
        },
      },
      models: {
        list: vi.fn(),
      },
    };

    await expect(
      provider.chat([{ role: 'user', content: 'Hello?' }]),
    ).rejects.toThrow('Model "grok-2-latest" is not available on xAI (Grok)');
  });

  it('throws provider-specific model listing errors instead of silently returning an empty list', async () => {
    const provider = new OpenAIProvider({
      provider: 'xai',
      model: 'grok-4',
      apiKey: 'xai-test',
      baseUrl: 'https://api.x.ai/v1',
    }, 'xai');

    (provider as any).client = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
      models: {
        list: vi.fn().mockRejectedValue(
          Object.assign(new Error('Unauthorized'), { status: 401 }),
        ),
      },
    };

    await expect(provider.listModels()).rejects.toThrow('xAI (Grok) API key is invalid or expired');
  });
});
