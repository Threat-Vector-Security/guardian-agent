import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PrincipalRole } from '../tools/types.js';
import type { MessageCallback } from './types.js';
import type { DashboardCallbacks, SSEEvent } from './web-types.js';
import { readJsonBody, sendJSON } from './web-json.js';

interface RequestPrincipal {
  principalId: string;
  principalRole: PrincipalRole;
}

interface RequestErrorDetails {
  statusCode: number;
  error: string;
  errorCode?: string;
}

interface WebChatRoutesContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  maxBodyBytes: number;
  dashboard: DashboardCallbacks;
  onMessage: MessageCallback | null;
  resolveRequestPrincipal: (req: IncomingMessage) => RequestPrincipal;
  getRequestErrorDetails: (err: unknown) => RequestErrorDetails | null;
  logInternalError: (message: string, err: unknown) => void;
  maybeEmitUIInvalidation: (result: unknown, topics: string[], reason: string, path: string) => void;
  emitSSE: (event: SSEEvent) => void;
  generateMessageId: () => string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function trimOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function sendBadRequestError(res: ServerResponse, err: unknown): void {
  const message = err instanceof Error ? err.message : 'Bad request';
  const status = message.includes('too large') ? 413 : 400;
  sendJSON(res, status, { error: message });
}

export async function handleWebChatRoutes(context: WebChatRoutesContext): Promise<boolean> {
  const { req, res, url, dashboard } = context;

  if (req.method === 'POST' && url.pathname === '/api/message/stream') {
    if (!dashboard.onStreamDispatch) {
      sendJSON(res, 404, { error: 'Streaming not available' });
      return true;
    }

    try {
      const parsed = await readJsonBody<{
        content?: unknown;
        userId?: string;
        agentId?: unknown;
        requestId?: unknown;
        surfaceId?: unknown;
        channel?: string;
        metadata?: Record<string, unknown>;
      }>(req, context.maxBodyBytes);

      const content = asNonEmptyString(parsed.content);
      const agentId = trimOptionalString(parsed.agentId);
      const requestId = trimOptionalString(parsed.requestId);
      if (!content) {
        sendJSON(res, 400, { error: 'content is required' });
        return true;
      }

      try {
        const principal = context.resolveRequestPrincipal(req);
        const result = await dashboard.onStreamDispatch(
          agentId,
          {
            requestId,
            content,
            userId: parsed.userId,
            surfaceId: trimOptionalString(parsed.surfaceId),
            principalId: principal.principalId,
            principalRole: principal.principalRole,
            channel: parsed.channel ?? 'web',
            metadata: asRecord(parsed.metadata),
          },
          context.emitSSE,
        );
        sendJSON(res, 200, result);
      } catch (err) {
        const requestError = context.getRequestErrorDetails(err);
        if (requestError) {
          sendJSON(res, requestError.statusCode, {
            error: requestError.error,
            ...(requestError.errorCode ? { errorCode: requestError.errorCode } : {}),
          });
          return true;
        }
        context.logInternalError('Stream dispatch failed', err);
        sendJSON(res, 500, { error: 'Stream dispatch error' });
      }
      return true;
    } catch (err) {
      sendBadRequestError(res, err);
      return true;
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/message') {
    try {
      const parsed = await readJsonBody<{
        content?: unknown;
        userId?: string;
        agentId?: unknown;
        requestId?: unknown;
        surfaceId?: unknown;
        channel?: string;
        metadata?: Record<string, unknown>;
      }>(req, context.maxBodyBytes);

      const content = asNonEmptyString(parsed.content);
      const agentId = trimOptionalString(parsed.agentId);
      const requestId = trimOptionalString(parsed.requestId);
      if (!content) {
        sendJSON(res, 400, { error: 'content is required' });
        return true;
      }

      if (agentId && dashboard.onDispatch) {
        try {
          const principal = context.resolveRequestPrincipal(req);
          const response = await dashboard.onDispatch(agentId, {
            content,
            userId: parsed.userId,
            surfaceId: trimOptionalString(parsed.surfaceId),
            principalId: principal.principalId,
            principalRole: principal.principalRole,
            channel: parsed.channel ?? 'web',
            metadata: asRecord(parsed.metadata),
          }, undefined, requestId ? { requestId } : undefined);
          sendJSON(res, 200, response);
        } catch (err) {
          const requestError = context.getRequestErrorDetails(err);
          if (requestError) {
            sendJSON(res, requestError.statusCode, {
              error: requestError.error,
              ...(requestError.errorCode ? { errorCode: requestError.errorCode } : {}),
            });
            return true;
          }
          context.logInternalError('Message dispatch failed', err);
          const detail = err instanceof Error ? err.message : String(err);
          sendJSON(res, 500, { error: `Dispatch error: ${detail}` });
        }
        return true;
      }

      if (!context.onMessage) {
        sendJSON(res, 503, { error: 'No message handler registered' });
        return true;
      }

      try {
        const principal = context.resolveRequestPrincipal(req);
        const response = await context.onMessage({
          id: context.generateMessageId(),
          userId: parsed.userId ?? 'web-user',
          surfaceId: trimOptionalString(parsed.surfaceId),
          principalId: principal.principalId,
          principalRole: principal.principalRole,
          channel: parsed.channel ?? 'web',
          content,
          metadata: asRecord(parsed.metadata),
          timestamp: Date.now(),
        });
        sendJSON(res, 200, response);
      } catch (err) {
        const requestError = context.getRequestErrorDetails(err);
        if (requestError) {
          sendJSON(res, requestError.statusCode, {
            error: requestError.error,
            ...(requestError.errorCode ? { errorCode: requestError.errorCode } : {}),
          });
          return true;
        }
        context.logInternalError('Message dispatch failed', err);
        const detail = err instanceof Error ? err.message : String(err);
        sendJSON(res, 500, { error: `Dispatch error: ${detail}` });
      }
      return true;
    } catch (err) {
      sendBadRequestError(res, err);
      return true;
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/conversations/reset') {
    if (!dashboard.onConversationReset) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }

    try {
      const parsed = await readJsonBody<{ agentId?: string; userId?: string; channel?: string }>(req, context.maxBodyBytes);
      if (!parsed.agentId) {
        sendJSON(res, 400, { error: 'agentId is required' });
        return true;
      }
      try {
        const result = await dashboard.onConversationReset({
          agentId: parsed.agentId,
          userId: parsed.userId ?? 'web-user',
          channel: parsed.channel ?? 'web',
        });
        sendJSON(res, 200, result);
        context.maybeEmitUIInvalidation(result, ['dashboard'], 'conversation.reset', url.pathname);
      } catch (err) {
        context.logInternalError('Conversation reset failed', err);
        sendJSON(res, 500, { error: 'Reset failed' });
      }
      return true;
    } catch (err) {
      sendBadRequestError(res, err);
      return true;
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/conversations/sessions') {
    if (!dashboard.onConversationSessions) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    const userId = url.searchParams.get('userId') ?? 'web-user';
    const channel = url.searchParams.get('channel') ?? 'web';
    const agentId = url.searchParams.get('agentId') ?? undefined;

    sendJSON(res, 200, dashboard.onConversationSessions({ userId, channel, agentId }));
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/conversations/session') {
    if (!dashboard.onConversationUseSession) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }

    try {
      const parsed = await readJsonBody<{ agentId?: string; userId?: string; channel?: string; sessionId?: string }>(req, context.maxBodyBytes);
      if (!parsed.agentId || !parsed.sessionId) {
        sendJSON(res, 400, { error: 'agentId and sessionId are required' });
        return true;
      }
      const result = dashboard.onConversationUseSession({
        agentId: parsed.agentId,
        userId: parsed.userId ?? 'web-user',
        channel: parsed.channel ?? 'web',
        sessionId: parsed.sessionId,
      });
      sendJSON(res, 200, result);
      context.maybeEmitUIInvalidation(result, ['dashboard'], 'conversation.session.selected', url.pathname);
      return true;
    } catch (err) {
      sendBadRequestError(res, err);
      return true;
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/quick-actions/run') {
    if (!dashboard.onQuickActionRun) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }

    try {
      const parsed = await readJsonBody<{ actionId?: string; details?: string; agentId?: string; userId?: string; channel?: string }>(req, context.maxBodyBytes);
      if (!parsed.actionId || !parsed.agentId) {
        sendJSON(res, 400, { error: 'actionId and agentId are required' });
        return true;
      }
      try {
        const result = await dashboard.onQuickActionRun({
          actionId: parsed.actionId,
          details: parsed.details ?? '',
          agentId: parsed.agentId,
          userId: parsed.userId ?? 'web-user',
          channel: parsed.channel ?? 'web',
        });
        sendJSON(res, 200, result);
      } catch (err) {
        context.logInternalError('Quick action failed', err);
        sendJSON(res, 500, { error: 'Quick action failed' });
      }
      return true;
    } catch (err) {
      sendBadRequestError(res, err);
      return true;
    }
  }

  return false;
}
