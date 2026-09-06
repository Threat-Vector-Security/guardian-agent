/**
 * OpenAI LLM provider.
 *
 * Wraps the openai SDK with direct mapping to unified types.
 */

import OpenAI from 'openai';
import type {
  LLMProvider,
  ChatMessage,
  ChatResponse,
  ChatChunk,
  ChatOptions,
  ModelInfo,
  ToolCall,
} from './types.js';
import type { LLMConfig } from '../config/types.js';
import { getProviderTypeMetadata } from './provider-metadata.js';

export class OpenAIProvider implements LLMProvider {
  readonly name: string;
  private client: OpenAI;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private topP: number | undefined;
  private reasoningEffort: 'minimal' | 'low' | 'medium' | 'high' | undefined;
  private reasoningSummary: 'auto' | 'concise' | 'detailed' | 'none' | undefined;
  private reasoningBudgetTokens: number | undefined;
  private verbosity: 'low' | 'medium' | 'high' | undefined;
  private parallelToolCalls: boolean | undefined;
  private toolChoice: 'auto' | 'none' | 'required' | undefined;
  private providerLabel: string;
  private baseUrl: string | undefined;

  constructor(config: LLMConfig, providerName?: string) {
    this.name = providerName ?? 'openai';
    this.providerLabel = getProviderTypeMetadata(this.name)?.displayName ?? this.name;
    this.baseUrl = config.baseUrl;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: this.baseUrl,
      timeout: config.timeoutMs ?? 120_000,
    });
    this.model = config.model;
    this.maxTokens = config.maxTokens ?? 4096;
    this.temperature = config.temperature ?? 0.7;
    this.topP = config.topP;
    this.reasoningEffort = config.reasoning?.effort;
    this.reasoningSummary = config.reasoning?.summary;
    this.reasoningBudgetTokens = config.reasoning?.budgetTokens;
    this.verbosity = config.verbosity;
    this.parallelToolCalls = config.parallelToolCalls;
    this.toolChoice = config.toolChoice;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    let params = this.buildChatParams(messages, options, false, false);
    let response: OpenAI.ChatCompletion;
    try {
      response = await this.client.chat.completions.create(params, { signal: options?.signal });
    } catch (err) {
      if (shouldRetryWithMaxCompletionTokens(err)) {
        params = this.buildChatParams(messages, options, false, true);
        try {
          response = await this.client.chat.completions.create(params, { signal: options?.signal });
        } catch (retryErr) {
          const strippedParams = stripOptionalCapabilityParams(params, retryErr);
          if (strippedParams) {
            try {
              response = await this.client.chat.completions.create(strippedParams, { signal: options?.signal });
            } catch (strippedErr) {
              throw wrapOpenAIError(strippedErr, {
                model: strippedParams.model as string,
                providerLabel: this.providerLabel,
                baseUrl: this.baseUrl,
              });
            }
          } else {
            throw wrapOpenAIError(retryErr, {
              model: params.model as string,
              providerLabel: this.providerLabel,
              baseUrl: this.baseUrl,
            });
          }
        }
      } else {
        const strippedParams = stripOptionalCapabilityParams(params, err);
        if (strippedParams) {
          try {
            response = await this.client.chat.completions.create(strippedParams, { signal: options?.signal });
            params = strippedParams;
          } catch (retryErr) {
            throw wrapOpenAIError(retryErr, {
              model: strippedParams.model as string,
              providerLabel: this.providerLabel,
              baseUrl: this.baseUrl,
            });
          }
        } else {
          throw wrapOpenAIError(err, {
            model: params.model as string,
            providerLabel: this.providerLabel,
            baseUrl: this.baseUrl,
          });
        }
      }
    }
    const choice = response.choices[0];

    const toolCalls = choice?.message.tool_calls
      ?.filter((tc): tc is Extract<typeof tc, { type: 'function' }> => tc.type === 'function')
      .map((tc): ToolCall => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

    return {
      content: choice?.message.content ?? '',
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      model: response.model,
      finishReason: mapFinishReason(choice?.finish_reason),
      ...(choice?.finish_reason ? { providerFinishReason: choice.finish_reason } : {}),
    };
  }

  async *stream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<ChatChunk> {
    let params = this.buildChatParams(messages, options, true, false);
    let stream: AsyncIterable<OpenAI.ChatCompletionChunk>;
    try {
      stream = await this.client.chat.completions.create(params);
    } catch (err) {
      if (shouldRetryWithMaxCompletionTokens(err)) {
        params = this.buildChatParams(messages, options, true, true);
        try {
          stream = await this.client.chat.completions.create(params);
        } catch (retryErr) {
          const strippedParams = stripOptionalCapabilityParams(params, retryErr);
          if (strippedParams) {
            try {
              stream = await this.client.chat.completions.create(strippedParams);
            } catch (strippedErr) {
              throw wrapOpenAIError(strippedErr, {
                model: strippedParams.model as string,
                providerLabel: this.providerLabel,
                baseUrl: this.baseUrl,
              });
            }
          } else {
            throw wrapOpenAIError(retryErr, {
              model: params.model as string,
              providerLabel: this.providerLabel,
              baseUrl: this.baseUrl,
            });
          }
        }
      } else {
        const strippedParams = stripOptionalCapabilityParams(params, err);
        if (strippedParams) {
          try {
            stream = await this.client.chat.completions.create(strippedParams);
            params = strippedParams;
          } catch (retryErr) {
            throw wrapOpenAIError(retryErr, {
              model: strippedParams.model as string,
              providerLabel: this.providerLabel,
              baseUrl: this.baseUrl,
            });
          }
        } else {
          throw wrapOpenAIError(err, {
            model: params.model as string,
            providerLabel: this.providerLabel,
            baseUrl: this.baseUrl,
          });
        }
      }
    }

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      const isLast = chunk.choices[0]?.finish_reason !== null && chunk.choices[0]?.finish_reason !== undefined;

      yield {
        content: delta?.content ?? '',
        done: isLast,
        usage: chunk.usage
          ? {
              promptTokens: chunk.usage.prompt_tokens,
              completionTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            }
          : undefined,
      };

      if (isLast) return;
    }
  }

  async listModels(options?: { signal?: AbortSignal; limit?: number }): Promise<ModelInfo[]> {
    try {
      const list = await this.client.models.list(options?.signal ? { signal: options.signal } : undefined);
      const models: ModelInfo[] = [];
      for await (const model of list) {
        const record = model as unknown as Record<string, unknown>;
        const capabilities = readStringArray(record, 'capabilities');
        const supportedParameters = readStringArray(record, 'supported_parameters');
        const contextWindow = readContextWindow(record);
        models.push({
          id: model.id,
          name: readString(record, 'name') ?? model.id,
          provider: this.name,
          ...(contextWindow ? { contextWindow } : {}),
          ...(capabilities.length > 0 ? { capabilities } : {}),
          ...(Object.prototype.hasOwnProperty.call(record, 'supported_parameters') ? { supportedParameters } : {}),
        });
        if (models.length >= (options?.limit ?? 1000)) break;
      }
      return models;
    } catch (err) {
      throw wrapOpenAIError(err, {
        operation: 'models',
        providerLabel: this.providerLabel,
        baseUrl: this.baseUrl,
      });
    }
  }

  private buildChatParams(
    messages: ChatMessage[],
    options: ChatOptions | undefined,
    stream: false,
    useMaxCompletionTokens: boolean,
  ): OpenAI.ChatCompletionCreateParamsNonStreaming;
  private buildChatParams(
    messages: ChatMessage[],
    options: ChatOptions | undefined,
    stream: true,
    useMaxCompletionTokens: boolean,
  ): OpenAI.ChatCompletionCreateParamsStreaming;
  private buildChatParams(
    messages: ChatMessage[],
    options: ChatOptions | undefined,
    stream: boolean,
    useMaxCompletionTokens: boolean,
  ): OpenAI.ChatCompletionCreateParamsNonStreaming | OpenAI.ChatCompletionCreateParamsStreaming {
    const selectedModel = options?.model ?? this.model;
    const params = {
      model: selectedModel,
      temperature: options?.temperature ?? this.temperature,
      messages: messages.map(toOpenAIMessage),
      ...(stream
        ? {
            stream: true as const,
            stream_options: { include_usage: true },
          }
        : {}),
      ...(useMaxCompletionTokens
        ? { max_completion_tokens: options?.maxTokens ?? this.maxTokens }
        : { max_tokens: options?.maxTokens ?? this.maxTokens }),
    } satisfies Record<string, unknown>;

    const topP = options?.topP ?? this.topP;
    if (typeof topP === 'number') {
      Object.assign(params, { top_p: topP });
    }

    const reasoningEffort = options?.reasoningEffort ?? this.reasoningEffort;
    if (reasoningEffort && shouldSendOpenAIReasoningEffort(this.name, selectedModel)) {
      Object.assign(params, { reasoning_effort: reasoningEffort });
    }

    const reasoningSummary = options?.reasoningSummary ?? this.reasoningSummary;
    const reasoningBudgetTokens = options?.reasoningBudgetTokens ?? this.reasoningBudgetTokens;
    const reasoning = buildReasoningOptions(reasoningSummary, reasoningBudgetTokens);
    if (reasoning) {
      Object.assign(params, { reasoning });
    }

    const verbosity = options?.verbosity ?? this.verbosity;
    if (verbosity && shouldSendOpenAIVerbosity(this.name, selectedModel)) {
      Object.assign(params, { verbosity });
    }

    if (this.shouldUseOpenRouterAutoFallback(selectedModel)) {
      Object.assign(params, {
        models: [selectedModel, 'openrouter/auto'],
        route: 'fallback' as const,
      });
    }

    if (options?.tools?.length) {
      Object.assign(params, {
        tools: options.tools.map(t => ({
          type: 'function' as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
      });
      const parallelToolCalls = options?.parallelToolCalls ?? this.parallelToolCalls;
      if (typeof parallelToolCalls === 'boolean') {
        Object.assign(params, { parallel_tool_calls: parallelToolCalls });
      }
      const toolChoice = options?.toolChoice ?? this.toolChoice;
      if (toolChoice) {
        Object.assign(params, {
          tool_choice: toolChoice === 'required' ? 'required' : toolChoice,
        });
      }
    }

    if (options?.responseFormat?.type === 'json_object') {
      Object.assign(params, {
        response_format: { type: 'json_object' as const },
      });
    } else if (options?.responseFormat?.type === 'json_schema') {
      Object.assign(params, {
        response_format: {
          type: 'json_schema' as const,
          json_schema: {
            name: options.responseFormat.name,
            schema: options.responseFormat.schema,
            strict: true,
          },
        },
      });
    }

    return stream
      ? params as OpenAI.ChatCompletionCreateParamsStreaming
      : params as OpenAI.ChatCompletionCreateParamsNonStreaming;
  }

  private shouldUseOpenRouterAutoFallback(selectedModel: string): boolean {
    return this.name === 'openrouter' && selectedModel.trim().toLowerCase() !== 'openrouter/auto';
  }
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
    : [];
}

function readContextWindow(record: Record<string, unknown>): number | undefined {
  for (const key of ['context_window', 'contextWindow', 'context_length', 'contextLength']) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return undefined;
}

function toOpenAIMessage(msg: ChatMessage): OpenAI.ChatCompletionMessageParam {
  if (msg.role === 'tool') {
    return {
      role: 'tool',
      content: msg.content,
      tool_call_id: msg.toolCallId ?? '',
    };
  }
  if (msg.role === 'assistant' && msg.toolCalls?.length) {
    return {
      role: 'assistant',
      content: msg.content || null,
      tool_calls: msg.toolCalls.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: tc.arguments },
      })),
    };
  }
  return { role: msg.role, content: msg.content } as OpenAI.ChatCompletionMessageParam;
}

function mapFinishReason(reason?: string | null): ChatResponse['finishReason'] {
  switch (reason) {
    case 'stop': return 'stop';
    case 'tool_calls': return 'tool_calls';
    case 'length': return 'length';
    default: return 'stop';
  }
}

function shouldRetryWithMaxCompletionTokens(err: unknown): boolean {
  const status = (err as { status?: number })?.status ?? 0;
  const raw = err instanceof Error ? err.message : String(err);
  return status === 400
    && /max_tokens/i.test(raw)
    && /max_completion_tokens/i.test(raw);
}

const OPTIONAL_OPENAI_CAPABILITY_PARAMS = [
  'reasoning',
  'reasoning_effort',
  'verbosity',
  'parallel_tool_calls',
  'tool_choice',
] as const;

function buildReasoningOptions(
  summary: 'auto' | 'concise' | 'detailed' | 'none' | undefined,
  budgetTokens: number | undefined,
): Record<string, unknown> | undefined {
  const options: Record<string, unknown> = {};
  if (summary) {
    options.summary = summary;
  }
  if (typeof budgetTokens === 'number' && Number.isFinite(budgetTokens) && budgetTokens > 0) {
    options.max_tokens = Math.floor(budgetTokens);
  }
  return Object.keys(options).length > 0 ? options : undefined;
}

function stripOptionalCapabilityParams<T extends object>(
  params: T,
  err: unknown,
): T | null {
  const status = (err as { status?: number })?.status ?? 0;
  if (status !== 400) return null;
  const structured = err && typeof err === 'object' ? err as Record<string, unknown> : {};
  const detail = structured.error && typeof structured.error === 'object' ? structured.error as Record<string, unknown> : {};
  const parameter = structured.param ?? detail.param;
  const code = structured.code ?? detail.code;
  if (parameter === 'temperature' || parameter === 'top_p') {
    if (!['unsupported_parameter', 'unsupported_value'].includes(String(code)) || !Object.hasOwn(params, parameter)) return null;
    const next = { ...params } as Record<string, unknown>;
    delete next[parameter];
    return next as T;
  }
  const raw = err instanceof Error ? err.message : String(err);
  if (!/unsupported|unknown|invalid/i.test(raw)) return null;
  const paramsRecord = params as Record<string, unknown>;
  const unsupported = OPTIONAL_OPENAI_CAPABILITY_PARAMS.filter((param) => (
    Object.prototype.hasOwnProperty.call(paramsRecord, param)
    && raw.toLowerCase().includes(param.toLowerCase())
  ));
  if (unsupported.length === 0) return null;
  const next = { ...params } as Record<string, unknown>;
  for (const param of OPTIONAL_OPENAI_CAPABILITY_PARAMS) {
    delete next[param];
  }
  return next as T;
}

function shouldSendOpenAIReasoningEffort(providerName: string, model: string): boolean {
  if (providerName !== 'openai') return true;
  const normalized = model.trim().toLowerCase();
  return /^(?:o\d(?:-|$)|gpt-5(?:[.-]|$)|gpt-4\.1(?:[.-]|$))/.test(normalized);
}

function shouldSendOpenAIVerbosity(providerName: string, model: string): boolean {
  if (providerName !== 'openai') return true;
  return /^gpt-5(?:[.-]|$)/i.test(model.trim());
}

/** Wrap OpenAI-compatible SDK errors into user-friendly messages. */
function wrapOpenAIError(err: unknown, context: {
  model?: string;
  operation?: 'chat' | 'models';
  providerLabel: string;
  baseUrl?: string;
}): Error {
  const status = (err as { status?: number })?.status ?? 0;
  const raw = err instanceof Error ? err.message : String(err);
  const provider = context.providerLabel;
  const operationLabel = context.operation === 'models' ? 'load models from' : 'reach';
  const providerLocation = context.baseUrl ? ` at ${context.baseUrl}` : '';
  const structured = err && typeof err === 'object' ? err as Record<string, unknown> : {};
  const detail = structured.error && typeof structured.error === 'object' ? structured.error as Record<string, unknown> : {};
  const cause = structured.cause && typeof structured.cause === 'object' ? structured.cause as Record<string, unknown> : {};
  const code = structured.code ?? detail.code ?? cause.code;
  const param = structured.param ?? detail.param;
  const safeCodes = ['insufficient_quota', 'rate_limit_exceeded', 'unsupported_parameter', 'unsupported_value', 'context_length_exceeded', 'model_not_found', 'invalid_api_key', 'billing_hard_limit_reached', 'usage_limit_reached', 'invalid_request_error', 'permission_denied', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET'];
  const safeParams = ['temperature', 'max_tokens', 'max_completion_tokens', 'max_output_tokens', 'response_format', 'reasoning_effort', 'top_p', 'model', 'messages', 'tools', 'stream'];
  const metadata = { status, ...(typeof code === 'string' && safeCodes.includes(code) ? { code } : {}), ...(typeof param === 'string' && safeParams.includes(param) ? { param } : {}), ...(['APIConnectionError', 'APIConnectionTimeoutError'].includes(String(structured.name)) ? { name: structured.name } : {}) };

  if (
    status === 404
    || raw.includes('model_not_found')
    || raw.includes('does not exist')
    || /model not found/i.test(raw)
  ) {
    return Object.assign(
      new Error(
        context.model
          ? `Model "${context.model}" is not available on ${provider}. Choose a different model in Configuration > Providers.`
          : `Could not load models from ${provider}. Check the configured model family and API access.`,
      ),
      metadata,
    );
  }
  if (status === 401) {
    return Object.assign(
      new Error(`${provider} API key is invalid or expired. Update it in Configuration > Providers.`),
      metadata,
    );
  }
  if (status === 403) {
    return Object.assign(
      new Error(
        context.model
          ? `Access denied for model "${context.model}" on ${provider}. Your account may not include this model.`
          : `Access denied while loading models from ${provider}. Check that the API key has access to this account.`,
      ),
      metadata,
    );
  }
  if (status === 429) {
    return Object.assign(
      new Error(`${provider} rate limit exceeded or quota depleted. Check the account limits for this provider.`),
      metadata,
    );
  }
  if (status === 503 || raw.includes('overloaded')) {
    return Object.assign(
      new Error(`${provider} API is currently overloaded. Please try again shortly.`),
      metadata,
    );
  }
  if (/fetch failed|connection error|ECONNREFUSED|ENOTFOUND|network/i.test(raw)) {
    return Object.assign(
      new Error(`Could not ${operationLabel} ${provider}${providerLocation}. Check the base URL, network access, and API status.`),
      metadata,
    );
  }
  return err instanceof Error ? err : new Error(raw);
}
