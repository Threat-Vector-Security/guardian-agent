/**
 * Ollama LLM provider.
 *
 * Uses the official Ollama SDK for both local Ollama and direct Ollama Cloud
 * access so both paths share the same native API contract.
 */

import { Ollama } from 'ollama';
import type {
  ChatRequest as OllamaChatRequest,
  ChatResponse as OllamaSdkChatResponse,
  Message as OllamaMessage,
  Options as OllamaOptions,
  Tool as OllamaTool,
  ToolCall as OllamaSdkToolCall,
} from 'ollama';
import type {
  LLMProvider,
  ChatMessage,
  ChatResponse,
  ChatChunk,
  ChatOptions,
  ModelInfo,
  ToolCall,
} from './types.js';
import type { LLMConfig, OllamaOptionsConfig } from '../config/types.js';
import { normalizeOllamaHost } from './provider-metadata.js';
import { createLogger } from '../util/logging.js';

const log = createLogger('llm:ollama');

export class OllamaProvider implements LLMProvider {
  readonly name: string;
  private readonly host: string;
  private readonly model: string;
  private readonly apiKey?: string;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly timeoutMs: number;
  private readonly keepAlive?: string | number;
  private readonly think?: LLMConfig['think'];
  private readonly ollamaOptions?: OllamaOptionsConfig;

  constructor(config: LLMConfig, providerType: 'ollama' | 'ollama_cloud' = 'ollama') {
    this.name = providerType;
    this.host = normalizeOllamaHost(config.baseUrl, providerType);
    this.model = config.model;
    this.apiKey = config.apiKey?.trim() || undefined;
    this.maxTokens = config.maxTokens ?? 2048;
    this.temperature = config.temperature ?? 0.7;
    this.timeoutMs = config.timeoutMs ?? 120_000;
    this.keepAlive = config.keepAlive;
    this.think = config.think;
    this.ollamaOptions = config.ollamaOptions;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const request = this.buildChatRequest(messages, options, false);
    const { client, cleanup } = this.createClient(options?.signal);

    try {
      const response = await client.chat(request);
      return toUnifiedChatResponse(response);
    } catch (err) {
      throw toOllamaError(err, this.name, this.host, request.model);
    } finally {
      cleanup();
    }
  }

  async *stream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<ChatChunk> {
    const request = this.buildChatRequest(messages, options, true);
    const { client, cleanup } = this.createClient(options?.signal);

    try {
      const stream = await client.chat(request);
      for await (const part of stream) {
        yield {
          content: part.message?.content ?? '',
          done: part.done === true,
          usage: part.done ? toUsage(part) : undefined,
        };
      }
    } catch (err) {
      throw toOllamaError(err, this.name, this.host, request.model);
    } finally {
      cleanup();
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const { client, cleanup } = this.createClient();
    try {
      const list = await client.list();
      return list.models.map((model) => ({
        id: model.name,
        name: model.name,
        provider: this.name,
      }));
    } catch (err) {
      log.warn({ err, provider: this.name, host: this.host }, 'Failed to list Ollama models');
      return [];
    } finally {
      cleanup();
    }
  }

  private createClient(signal?: AbortSignal): { client: Ollama; cleanup: () => void } {
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), this.timeoutMs);
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    const requestSignal = signal
      ? anySignal([signal, timeoutController.signal])
      : timeoutController.signal;

    return {
      client: new Ollama({
        host: this.host,
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
        fetch: async (input, init) => {
          const upstreamSignal = init?.signal;
          const mergedSignal = upstreamSignal
            ? anySignal([upstreamSignal, requestSignal])
            : requestSignal;
          const response = await fetch(input, { ...init, signal: mergedSignal });
          return normalizeOllamaSdkErrorResponse(response);
        },
      }),
      cleanup: () => clearTimeout(timeout),
    };
  }

  private buildChatRequest(
    messages: ChatMessage[],
    options: ChatOptions | undefined,
    stream: true,
  ): OllamaChatRequest & { stream: true };
  private buildChatRequest(
    messages: ChatMessage[],
    options: ChatOptions | undefined,
    stream: false,
  ): OllamaChatRequest & { stream?: false };
  private buildChatRequest(
    messages: ChatMessage[],
    options: ChatOptions | undefined,
    stream: boolean,
  ): OllamaChatRequest {
    const requestOptions: Partial<OllamaOptions> = {
      ...(this.ollamaOptions ?? {}),
    };

    const maxTokens = options?.maxTokens ?? this.maxTokens;
    const temperature = options?.temperature ?? this.temperature;

    if (requestOptions.num_predict === undefined) {
      requestOptions.num_predict = maxTokens;
    }
    if (requestOptions.temperature === undefined) {
      requestOptions.temperature = temperature;
    }

    return {
      model: options?.model ?? this.model,
      messages: toOllamaMessages(messages),
      stream,
      ...(options?.responseFormat?.type === 'json_object'
        ? { format: 'json' }
        : options?.responseFormat?.type === 'json_schema'
          ? { format: options.responseFormat.schema }
          : {}),
      ...(options?.tools?.length
        ? {
            tools: options.tools.map(toOllamaTool),
          }
        : {}),
      ...(this.keepAlive !== undefined ? { keep_alive: this.keepAlive } : {}),
      ...(this.think !== undefined ? { think: this.think } : {}),
      ...(Object.keys(requestOptions).length > 0 ? { options: requestOptions } : {}),
    };
  }
}

function toOllamaTool(tool: NonNullable<ChatOptions['tools']>[number]): OllamaTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as OllamaTool['function']['parameters'],
    },
  };
}

async function normalizeOllamaSdkErrorResponse(response: Response): Promise<Response> {
  if (response.ok) {
    return response;
  }

  const defaultMessage = `Error ${response.status}: ${response.statusText}`;
  let message = defaultMessage;

  try {
    const raw = await response.text();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { error?: unknown };
        const parsedMessage = typeof parsed?.error === 'string' ? parsed.error : '';
        message = parsedMessage || raw;
      } catch {
        message = raw;
      }
    }
  } catch {
    // Preserve the SDK's fallback behavior without letting it write to stdout.
  }

  const headers = new Headers(response.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.delete('content-encoding');
  headers.delete('content-length');

  return new Response(JSON.stringify({ error: message }), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function toOllamaMessages(messages: ChatMessage[]): OllamaMessage[] {
  const toolCallNames = new Map<string, string>();

  return messages.map((message): OllamaMessage => {
    if (message.role === 'assistant' && message.toolCalls?.length) {
      for (const toolCall of message.toolCalls) {
        toolCallNames.set(toolCall.id, toolCall.name);
      }
      return {
        role: 'assistant',
        content: message.content || '',
        tool_calls: message.toolCalls.map((toolCall) => ({
          function: {
            name: toolCall.name,
            arguments: parseToolArguments(toolCall.arguments),
          },
        })),
      };
    }

    if (message.role === 'tool') {
      const toolName = message.toolCallId ? toolCallNames.get(message.toolCallId) : undefined;
      return {
        role: 'tool',
        content: message.content,
        ...(toolName ? { tool_name: toolName } : {}),
      };
    }

    return {
      role: message.role,
      content: message.content,
    };
  });
}

function parseToolArguments(input: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(input) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { __raw: input };
  }
}

function toUnifiedChatResponse(response: OllamaSdkChatResponse): ChatResponse {
  const toolCalls = toUnifiedToolCalls(response.message?.tool_calls);
  return {
    content: response.message?.content ?? '',
    toolCalls,
    usage: toUsage(response),
    model: response.model,
    finishReason: mapFinishReason(response.done_reason, toolCalls),
    ...(response.done_reason ? { providerFinishReason: response.done_reason } : {}),
  };
}

function toUnifiedToolCalls(toolCalls: OllamaSdkToolCall[] | undefined): ToolCall[] | undefined {
  if (!toolCalls?.length) return undefined;
  return toolCalls.map((toolCall, index) => ({
    id: `${toolCall.function.name}-${index + 1}`,
    name: toolCall.function.name,
    arguments: JSON.stringify(toolCall.function.arguments ?? {}),
  }));
}

function toUsage(
  response: Pick<OllamaSdkChatResponse, 'prompt_eval_count' | 'eval_count'>,
): ChatResponse['usage'] {
  const promptTokens = response.prompt_eval_count ?? 0;
  const completionTokens = response.eval_count ?? 0;
  const totalTokens = promptTokens + completionTokens;
  if (totalTokens === 0) return undefined;
  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

function mapFinishReason(reason: string | undefined, toolCalls: ToolCall[] | undefined): ChatResponse['finishReason'] {
  if (toolCalls?.length) return 'tool_calls';
  switch (reason) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    default:
      return 'stop';
  }
}

function toOllamaError(
  err: unknown,
  providerType: string,
  host: string,
  model: string,
): Error {
  if (err instanceof Error && err.name === 'AbortError') {
    return err;
  }

  const status = (err as { status_code?: number })?.status_code ?? 0;
  const raw = err instanceof Error ? err.message : String(err ?? 'unknown error');
  const cloud = providerType === 'ollama_cloud';
  const providerLabel = cloud ? 'Ollama Cloud' : 'Ollama';

  if (status === 401) {
    return Object.assign(
      new Error(`${providerLabel} API key is invalid or expired. Update it in Configuration > Providers.`),
      { status },
    );
  }
  if (status === 403) {
    return Object.assign(
      new Error(`Access denied for model "${model}" on ${providerLabel}. Check your account or model entitlement.`),
      { status },
    );
  }
  if (status === 404 || raw.includes('not found')) {
    return Object.assign(
      new Error(`Model "${model}" is not available on ${providerLabel}. Choose a different model in Configuration > Providers.`),
      { status },
    );
  }
  if (status === 429) {
    return Object.assign(
      new Error(`${providerLabel} rate limit exceeded or quota depleted. Please try again shortly.`),
      { status },
    );
  }
  if (status > 0) {
    return Object.assign(
      new Error(`${providerLabel} API error ${status}: ${raw}`),
      { status },
    );
  }

  return new Error(
    cloud
      ? `Could not reach Ollama Cloud at ${host}. Check your network connection and API key. (${raw})`
      : `Could not reach Ollama at ${host}. Check that the local Ollama server is running. (${raw})`,
  );
}

/** Combine multiple AbortSignals into one. */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}
