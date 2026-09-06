import { createLogger } from '../util/logging.js';
import { getMemoryMutationIntentDeniedMessage, isMemoryMutationToolName } from '../util/memory-intent.js';
import type { ToolExecutor } from '../tools/executor.js';
import type { Runtime } from '../runtime/runtime.js';
import type { CapabilityTokenManager } from './capability-token.js';
import type { CapabilityToken, JsonRpcNotification, JsonRpcRequest, JsonRpcResponse } from './types.js';
import { CapabilityController } from '../guardian/guardian.js';
import { assignProvenance } from './provenance.js';
import type { ToolDefinition, ToolJobRecord, ToolExecutionRequest } from '../tools/types.js';
import { parseToolJobOutputPreview } from '../tools/job-results.js';
import type { ChatMessage, ChatOptions, ChatResponse, LLMProvider } from '../llm/types.js';
import { chatProviderWithTimeout } from '../llm/model-fallback.js';
import { getProviderLocalityFromName } from '../runtime/model-routing-ux.js';
import { stringifyJsonTransport, toJsonTransportValue } from './json-safe.js';

const log = createLogger('broker-server');

export interface BrokerServerOptions {
  tools: ToolExecutor;
  runtime: Runtime;
  tokenManager: CapabilityTokenManager;
  inputStream: NodeJS.ReadableStream;
  outputStream: NodeJS.WritableStream;
  workerId: string;
  onNotification?: (notification: JsonRpcNotification) => void;
}

export class BrokerServer {
  private readonly tools: ToolExecutor;
  private readonly runtime: Runtime;
  private readonly tokenManager: CapabilityTokenManager;
  private readonly inputStream: NodeJS.ReadableStream;
  private readonly outputStream: NodeJS.WritableStream;
  private readonly workerId: string;
  private readonly onNotification?: (notification: JsonRpcNotification) => void;
  private buffer = '';
  private readonly capabilityController = new CapabilityController();
  private readonly outputTrust = new Map<string, { level: 'trusted' | 'low_trust' | 'quarantined'; reasons: string[] }>();

  constructor(options: BrokerServerOptions) {
    this.tools = options.tools;
    this.runtime = options.runtime;
    this.tokenManager = options.tokenManager;
    this.inputStream = options.inputStream;
    this.outputStream = options.outputStream;
    this.workerId = options.workerId;
    this.onNotification = options.onNotification;

    this.inputStream.setEncoding?.('utf8');
    this.inputStream.on('data', (chunk: string | Buffer) => {
      this.handleData(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    });
  }

  sendNotification(method: string, params: Record<string, unknown>): void {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params: toJsonTransportValue(params),
    };
    this.outputStream.write(`${stringifyJsonTransport(notification)}\n`);
  }

  private handleData(data: string): void {
    this.buffer += data;
    while (this.buffer.length > 0) {
      const newlineIndex = this.buffer.indexOf('\n');
      if (newlineIndex === -1) break;

      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line) continue;

      try {
        const message = JSON.parse(line) as JsonRpcRequest | JsonRpcNotification;
        if ('id' in message) {
          void this.handleRequest(message);
        } else if ('method' in message) {
          this.handleNotification(message);
        }
      } catch (error) {
        log.warn({ error: error instanceof Error ? error.message : String(error) }, 'Failed to parse broker message');
      }
    }
  }

  private async handleRequest(request: JsonRpcRequest): Promise<void> {
    const capabilityToken = request.params?.capabilityToken as string | undefined;
    let tokenError: string | null = 'Missing capability token';
    let token = undefined;

    if (capabilityToken) {
      tokenError = this.tokenManager.validateAndUse(capabilityToken, this.workerId);
      token = this.tokenManager.get(capabilityToken);
    }

    if (tokenError || !token) {
      this.sendResponse({
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32000, message: tokenError ?? 'Invalid capability token' },
      });
      return;
    }

    try {
      let result: unknown;

      switch (request.method) {
        case 'tool.search': {
          result = { tools: this.tools.searchTools(String(request.params.query ?? '')).filter((tool) => this.isToolAllowed(token, tool)) };
          break;
        }

        case 'tool.listLoaded': {
          const baseTools = this.tools.listAlwaysLoadedDefinitions();
          const codeContext = token.executionContext?.codeContext;
          const tools = codeContext
            ? [
                ...baseTools,
                ...this.tools.listCodeSessionEagerToolDefinitions().filter((definition) => !baseTools.some((base) => base.name === definition.name)),
              ]
            : baseTools;
          result = { tools: tools.filter((tool) => this.isToolAllowed(token, tool)) };
          break;
        }

        case 'tool.call': {
          const toolName = String(request.params.toolName ?? '');
          const args = isRecord(request.params.args) ? request.params.args : {};
          const context = token.executionContext ?? {};
          const requestId = context.requestId;
          const toolDefinition = this.tools.getToolDefinition(toolName);
          if (!toolDefinition || !this.isToolAllowed(token, toolDefinition)) {
            throw new Error('Tool is outside the capability token category grant');
          }
          const trust = this.outputTrust.get(token.id);

          if (isMemoryMutationToolName(toolName) && context.allowModelMemoryMutation !== true) {
            result = {
              success: false,
              status: 'denied',
              message: getMemoryMutationIntentDeniedMessage(toolName),
            };
            break;
          }

          const executionRequest: ToolExecutionRequest = {
            origin: 'assistant',
            toolName,
            args,
            agentId: token.agentId,
            ...context,
            userId: token.authorizedBy,
            principalId: context.principalId ?? token.authorizedBy,
            principalRole: context.principalRole ?? 'viewer',
            channel: token.authorizedChannel,
            requestId,
            contentTrustLevel: trust?.level ?? context.contentTrustLevel ?? 'trusted',
            taintReasons: [...new Set([...(context.taintReasons ?? []), ...(trust?.reasons ?? [])])],
            derivedFromTaintedContent: context.derivedFromTaintedContent === true || (trust !== undefined && trust.level !== 'trusted'),
            dryRun: request.params.dryRun === true,
            agentContext: {
              checkAction: (action) => {
                const guardedAction = { ...action, agentId: token.agentId, capabilities: token.grantedCapabilities };
                // This mandatory grant check remains active even if a runtime disables other Guardian controllers.
                const capabilityDenied = this.capabilityController.check(guardedAction);
                if (capabilityDenied && !capabilityDenied.allowed) throw new Error(capabilityDenied.reason);
                const admitted = this.runtime.guardian.check(guardedAction);
                if (!admitted.allowed) throw new Error(`Action denied: ${admitted.reason}`);
              },
            },
            ...(request.params.toolContextMode === 'tight' || request.params.toolContextMode === 'standard'
              ? { toolContextMode: request.params.toolContextMode }
              : {}),
          };

          const runResponse = await this.tools.runTool(executionRequest);
          const provenance = assignProvenance(toolName, toolDefinition?.category);
          const providerKind = provenance.source === 'remote' ? 'external' : 'local';
          const rawOutput = runResponse.output;
          const scannedOutput = this.runtime.outputGuardian.scanToolResult(toolName, rawOutput, { providerKind });
          this.retainOutputTrust(token, scannedOutput.trustLevel, scannedOutput.taintReasons);
          const approvalSummary = runResponse.approvalId
            ? this.tools.getApprovalSummaries([runResponse.approvalId]).get(runResponse.approvalId)
            : undefined;

          this.runtime.auditLog.record({
            type: 'broker_action',
            severity: 'info',
            agentId: token.agentId,
            userId: token.authorizedBy,
            channel: token.authorizedChannel,
            details: {
              method: 'tool.call',
              toolName,
              capabilityTokenId: token.id,
              workerId: token.workerId,
              sessionId: token.sessionId,
              provenance,
            },
          });

          result = {
            ...runResponse,
            output: scannedOutput.allowPlannerRawContent
              ? scannedOutput.sanitized
              : {
                quarantined: true,
                trustLevel: scannedOutput.trustLevel,
                taintReasons: scannedOutput.taintReasons,
                preview: typeof (rawOutput as Record<string, unknown> | undefined)?.message === 'string'
                  ? String((rawOutput as Record<string, unknown>).message)
                  : undefined,
              },
            provenance,
            approvalSummary,
            trustLevel: scannedOutput.trustLevel,
            taintReasons: scannedOutput.taintReasons,
          };
          break;
        }

        case 'approval.decide': {
          // Approval decisions are authenticated human/control-plane operations, never worker authority.
          throw new Error('Workers cannot decide approvals; use the authenticated approval control plane');
        }

        case 'approval.result': {
          const approvalId = String(request.params.approvalId ?? '');
          const approvals = this.tools.listApprovals(500);
          const job = this.tools.listJobs(500).find((entry) => entry.approvalId === approvalId && this.ownsJob(token, entry));
          const approval = job ? approvals.find((entry) => entry.id === approvalId && entry.jobId === job.id) : undefined;
          result = {
            found: !!approval,
            status: approval?.status ?? 'not_found',
            decidedBy: approval?.decidedBy,
            jobId: job?.id,
            toolName: job?.toolName,
            message: job?.status === 'succeeded'
              ? (job.resultPreview || 'Executed successfully.')
              : job?.error,
            output: job?.status === 'succeeded'
              ? parseToolJobOutputPreview(job.resultPreview)
              : undefined,
            success: job?.status === 'succeeded',
          };
          break;
        }

        case 'approval.status': {
          const approvalId = String(request.params.approvalId ?? '');
          const approvals = this.tools.listApprovals(500);
          const job = this.tools.listJobs(500).find((entry) => entry.approvalId === approvalId && this.ownsJob(token, entry));
          const approval = job ? approvals.find((entry) => entry.id === approvalId && entry.jobId === job.id) : undefined;
          result = {
            status: approval?.status ?? 'not_found',
            decidedBy: approval?.decidedBy,
          };
          break;
        }

        case 'llm.chat': {
          // Proxy LLM calls through the supervisor so the worker stays network-disabled.
          const chatMessages = Array.isArray(request.params.messages)
            ? request.params.messages as ChatMessage[]
            : [];
          const chatOptions = isRecord(request.params.options)
            ? request.params.options as unknown as ChatOptions
            : undefined;
          const useFallback = request.params.useFallback === true;
          const requestedProviderName = typeof request.params.providerName === 'string' && request.params.providerName.trim()
            ? request.params.providerName.trim()
            : undefined;
          const requestedTimeoutMs = typeof request.params.timeoutMs === 'number' && Number.isFinite(request.params.timeoutMs)
            ? Math.max(1_000, Math.min(600_000, request.params.timeoutMs))
            : undefined;
          const requestedFallbackOrder = Array.isArray(request.params.fallbackProviderOrder)
            ? request.params.fallbackProviderOrder
              .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
              .map((value) => value.trim())
            : [];

          const instance = this.runtime.registry.get(token.agentId);
          const primaryName = instance?.definition.providerName ?? this.runtime.defaultProviderName;
          const preferredProviderName = requestedProviderName ?? primaryName;
          const providerOrder = requestedFallbackOrder.length > 0
            ? [...new Set([
                ...(preferredProviderName ? [preferredProviderName] : []),
                ...requestedFallbackOrder,
              ])]
            : (preferredProviderName ? [preferredProviderName] : []);
          const candidateNames = useFallback
            ? [...new Set([
                ...(requestedFallbackOrder.length > 0 ? requestedFallbackOrder : []),
                ...this.runtime.getProviderNames(),
              ])].filter((name) => name && name !== preferredProviderName)
            : providerOrder;

          let provider: LLMProvider | null = null;
          let providerProfileName: string | null = null;
          let chatResponse: ChatResponse | null = null;
          let lastError: unknown;

          for (const name of candidateNames) {
            const candidateProvider = this.runtime.getProvider(name);
            if (!candidateProvider) continue;
            try {
              chatResponse = await chatProviderWithTimeout({
                provider: candidateProvider,
                providerName: name,
                messages: chatMessages,
                options: chatOptions,
                ...(requestedTimeoutMs ? { timeoutMs: requestedTimeoutMs } : {}),
              });
              provider = candidateProvider;
              providerProfileName = name;
              break;
            } catch (error) {
              lastError = error;
            }
          }

          if (!provider || !chatResponse) {
            if (lastError) {
              throw lastError;
            }
            this.sendResponse({
              jsonrpc: '2.0',
              id: request.id,
              error: { code: -32002, message: 'No LLM provider available for this agent' },
            });
            return;
          }

          result = {
            ...chatResponse,
            providerName: providerProfileName ?? provider.name,
            providerLocality: getProviderLocalityFromName(provider.name),
          };
          break;
        }

        case 'job.list': {
          const userId = token.authorizedBy;
          const channel = token.authorizedChannel;
          const requestId = typeof request.params.requestId === 'string' ? request.params.requestId : undefined;
          const codeSessionId = typeof request.params.codeSessionId === 'string' ? request.params.codeSessionId : undefined;
          const limit = typeof request.params.limit === 'number' && Number.isFinite(request.params.limit)
            ? Math.max(1, Math.min(500, Math.floor(request.params.limit))) : 50;
          const jobs = this.tools.listJobs(limit)
            .filter((job) => (
              this.ownsJob(token, job)
              && job.userId === userId
              && (!channel || job.channel === channel)
              && (!requestId || job.requestId === requestId)
              && (!codeSessionId || job.codeSessionId === codeSessionId)
            ));
          result = {
            jobs: jobs.map(j => ({
              toolName: j.toolName,
              status: j.status,
              argsRedacted: j.argsRedacted,
              completedAt: j.completedAt,
              createdAt: j.createdAt,
              requestId: j.requestId,
              codeSessionId: j.codeSessionId,
            })),
          };
          break;
        }

        default:
          this.sendResponse({
            jsonrpc: '2.0',
            id: request.id,
            error: { code: -32601, message: `Method '${request.method}' not found` },
          });
          return;
      }

      this.sendResponse({ jsonrpc: '2.0', id: request.id, result });
    } catch (error) {
      this.runtime.auditLog?.record({
        type: 'broker_action',
        severity: 'warn',
        agentId: token.agentId,
        userId: token.authorizedBy,
        channel: token.authorizedChannel,
        details: { method: request.method, workerId: token.workerId, outcome: 'denied_or_failed' },
      });
      this.sendResponse({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32001,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private isToolAllowed(token: CapabilityToken, tool: ToolDefinition): boolean {
    return token.allowedToolCategories === undefined
      || (tool.category !== undefined && token.allowedToolCategories.includes(tool.category));
  }

  private ownsJob(token: CapabilityToken, job: ToolJobRecord): boolean {
    return job.userId === token.authorizedBy
      && job.channel === token.authorizedChannel
      && job.agentId === token.agentId
      && job.principalId === (token.executionContext?.principalId ?? token.authorizedBy)
      && job.codeSessionId === token.executionContext?.codeContext?.sessionId;
  }

  private retainOutputTrust(token: CapabilityToken, level: 'trusted' | 'low_trust' | 'quarantined', reasons: string[]): void {
    // Worker-reported trust can never clear taint observed by the supervisor.
    for (const id of this.outputTrust.keys()) {
      if (!this.tokenManager.get(id)) this.outputTrust.delete(id);
    }
    const prior = this.outputTrust.get(token.id);
    const levels = ['trusted', 'low_trust', 'quarantined'] as const;
    const strongest = Math.max(levels.indexOf(prior?.level ?? token.executionContext?.contentTrustLevel ?? 'trusted'), levels.indexOf(level));
    this.outputTrust.set(token.id, { level: levels[strongest], reasons: [...new Set([...(prior?.reasons ?? []), ...reasons])] });
  }

  private handleNotification(notification: JsonRpcNotification): void {
    if (notification.method === 'worker.heartbeat') {
      log.debug({ workerId: this.workerId }, 'Worker heartbeat');
    }
    this.onNotification?.(notification);
  }

  private sendResponse(response: JsonRpcResponse): void {
    this.outputStream.write(`${stringifyJsonTransport(response)}\n`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
