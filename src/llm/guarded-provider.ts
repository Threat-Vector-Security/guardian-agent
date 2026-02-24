/**
 * Guarded LLM Provider — wraps a real LLM provider with security enforcement.
 *
 * Ensures that all LLM interactions go through the Guardian security pipeline:
 * - Scans LLM responses for secrets (output guardian)
 * - Records token usage to BudgetTracker for rate limiting
 * - Logs interactions to AuditLog
 *
 * This makes enforcement mandatory for agents using ctx.llm, closing the
 * gap where agents could bypass checkAction() and directly use the provider.
 */

import type {
  LLMProvider,
  ChatMessage,
  ChatResponse,
  ChatChunk,
  ChatOptions,
  ModelInfo,
} from './types.js';
import type { OutputGuardian } from '../guardian/output-guardian.js';
import type { BudgetTracker } from '../runtime/budget.js';
import type { AuditLog } from '../guardian/audit-log.js';

export interface GuardedProviderOptions {
  /** The underlying LLM provider. */
  provider: LLMProvider;
  /** Agent ID this provider is assigned to. */
  agentId: string;
  /** Output guardian for response scanning. */
  outputGuardian: OutputGuardian;
  /** Budget tracker for token recording. */
  budget: BudgetTracker;
  /** Audit log for security event recording. */
  auditLog: AuditLog;
  /** Whether to redact secrets (true) or block entirely (false). */
  redactSecrets: boolean;
}

/**
 * Wraps an LLM provider with automatic security enforcement.
 *
 * Agents receive this instead of the raw provider, so they can't
 * bypass output scanning or token tracking.
 */
export class GuardedLLMProvider implements LLMProvider {
  readonly name: string;
  private inner: LLMProvider;
  private agentId: string;
  private outputGuardian: OutputGuardian;
  private budget: BudgetTracker;
  private auditLog: AuditLog;
  private redactSecrets: boolean;

  constructor(options: GuardedProviderOptions) {
    this.inner = options.provider;
    this.name = options.provider.name;
    this.agentId = options.agentId;
    this.outputGuardian = options.outputGuardian;
    this.budget = options.budget;
    this.auditLog = options.auditLog;
    this.redactSecrets = options.redactSecrets;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const response = await this.inner.chat(messages, options);

    // Record token usage
    if (response.usage) {
      this.budget.recordTokenUsage(
        this.agentId,
        response.usage.promptTokens,
        response.usage.completionTokens,
      );
    }

    // Scan response for secrets
    const scanResult = this.outputGuardian.scanResponse(response.content);
    if (!scanResult.clean) {
      if (this.redactSecrets) {
        this.auditLog.record({
          type: 'secret_detected',
          severity: 'warn',
          agentId: this.agentId,
          details: {
            source: 'llm_response',
            secretCount: scanResult.secrets.length,
            patterns: scanResult.secrets.map(s => s.pattern),
          },
        });
        response.content = scanResult.sanitized;
      } else {
        this.auditLog.record({
          type: 'secret_detected',
          severity: 'warn',
          agentId: this.agentId,
          details: {
            source: 'llm_response',
            secretCount: scanResult.secrets.length,
            patterns: scanResult.secrets.map(s => s.pattern),
            action: 'blocked',
          },
        });
        throw new Error('LLM response blocked: secrets detected in content');
      }
    }

    return response;
  }

  async *stream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<ChatChunk> {
    // Collect full content to scan at the end
    let fullContent = '';

    for await (const chunk of this.inner.stream(messages, options)) {
      fullContent += chunk.content;

      // Record token usage from final chunk
      if (chunk.usage) {
        this.budget.recordTokenUsage(
          this.agentId,
          chunk.usage.promptTokens,
          chunk.usage.completionTokens,
        );
      }

      // Yield chunks as-is during streaming (scan happens at the end)
      if (!chunk.done) {
        yield chunk;
      } else {
        // Final chunk — scan accumulated content
        const scanResult = this.outputGuardian.scanResponse(fullContent);
        if (!scanResult.clean) {
          this.auditLog.record({
            type: 'secret_detected',
            severity: 'warn',
            agentId: this.agentId,
            details: {
              source: 'llm_stream',
              secretCount: scanResult.secrets.length,
              patterns: scanResult.secrets.map(s => s.pattern),
            },
          });
          // For streaming, we can't un-yield previous chunks, but we log the detection
        }
        yield chunk;
      }
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return this.inner.listModels();
  }
}
