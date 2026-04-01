import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PrincipalRole } from '../tools/types.js';
import type { DashboardCallbacks } from './web-types.js';
import { readBody, sendJSON } from './web-json.js';

interface RequestPrincipal {
  principalId: string;
  principalRole: PrincipalRole;
}

interface WebAutomationRoutesContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  maxBodyBytes: number;
  dashboard: DashboardCallbacks;
  resolveRequestPrincipal: (req: IncomingMessage) => RequestPrincipal;
  maybeEmitUIInvalidation: (result: unknown, topics: string[], reason: string, path: string) => void;
  requirePrivilegedTicket: (
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    action: 'search.pick-path',
    presented?: string,
  ) => boolean;
  logInternalError: (message: string, err: unknown) => void;
}

type AutomationSaveInput = Parameters<NonNullable<DashboardCallbacks['onAutomationSave']>>[0];
type AutomationDefinitionInput = Parameters<NonNullable<DashboardCallbacks['onAutomationDefinitionSave']>>[1];
type AutomationRunRequest = Parameters<NonNullable<DashboardCallbacks['onAutomationRun']>>[0];

function trimOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function sendBadRequest(res: ServerResponse, err: unknown): void {
  const message = err instanceof Error ? err.message : 'Bad request';
  sendJSON(res, 400, { error: message });
}

export async function handleWebAutomationRoutes(context: WebAutomationRoutesContext): Promise<boolean> {
  const { req, res, url, dashboard } = context;

  if (req.method === 'GET' && url.pathname === '/api/automations/catalog') {
    if (!dashboard.onAutomationCatalog) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    sendJSON(res, 200, dashboard.onAutomationCatalog());
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/automations/history') {
    if (!dashboard.onAutomationRunHistory) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    sendJSON(res, 200, dashboard.onAutomationRunHistory());
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/automations/save') {
    if (!dashboard.onAutomationSave) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    let body = '{}';
    try {
      body = await readBody(req, context.maxBodyBytes);
    } catch (err) {
      sendBadRequest(res, err);
      return true;
    }
    let parsed: AutomationSaveInput;
    try {
      parsed = body ? JSON.parse(body) as AutomationSaveInput : {} as AutomationSaveInput;
    } catch {
      sendJSON(res, 400, { error: 'Invalid JSON' });
      return true;
    }
    const result = dashboard.onAutomationSave(parsed);
    sendJSON(res, 200, result);
    context.maybeEmitUIInvalidation(result, ['automations'], 'automation.saved', url.pathname);
    return true;
  }

  const automationDefinitionMatch = req.method === 'POST'
    ? url.pathname.match(/^\/api\/automations\/([^/]+)\/definition$/)
    : null;
  if (automationDefinitionMatch) {
    if (!dashboard.onAutomationDefinitionSave) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    const automationId = decodeURIComponent(automationDefinitionMatch[1] ?? '').trim();
    if (!automationId) {
      sendJSON(res, 400, { error: 'automationId is required' });
      return true;
    }
    let body = '{}';
    try {
      body = await readBody(req, context.maxBodyBytes);
    } catch (err) {
      sendBadRequest(res, err);
      return true;
    }
    let parsed: AutomationDefinitionInput;
    try {
      parsed = body ? JSON.parse(body) as AutomationDefinitionInput : {} as AutomationDefinitionInput;
    } catch {
      sendJSON(res, 400, { error: 'Invalid JSON' });
      return true;
    }
    const result = dashboard.onAutomationDefinitionSave(automationId, parsed);
    sendJSON(res, 200, result);
    context.maybeEmitUIInvalidation(result, ['automations'], 'automation.definition_saved', url.pathname);
    return true;
  }

  const automationCreateMatch = req.method === 'POST'
    ? url.pathname.match(/^\/api\/automations\/([^/]+)\/create$/)
    : null;
  if (automationCreateMatch) {
    if (!dashboard.onAutomationCreate) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    const automationId = decodeURIComponent(automationCreateMatch[1] ?? '').trim();
    if (!automationId) {
      sendJSON(res, 400, { error: 'automationId is required' });
      return true;
    }
    const result = dashboard.onAutomationCreate(automationId);
    sendJSON(res, 200, result);
    context.maybeEmitUIInvalidation(result, ['automations'], 'automation.created', url.pathname);
    return true;
  }

  const automationRunMatch = req.method === 'POST'
    ? url.pathname.match(/^\/api\/automations\/([^/]+)\/run$/)
    : null;
  if (automationRunMatch) {
    if (!dashboard.onAutomationRun) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    const automationId = decodeURIComponent(automationRunMatch[1] ?? '').trim();
    if (!automationId) {
      sendJSON(res, 400, { error: 'automationId is required' });
      return true;
    }
    let body = '{}';
    try {
      body = await readBody(req, context.maxBodyBytes);
    } catch (err) {
      sendBadRequest(res, err);
      return true;
    }
    let parsed: {
      dryRun?: boolean;
      origin?: 'assistant' | 'cli' | 'web';
      agentId?: string;
      userId?: string;
      channel?: string;
      requestedBy?: string;
    };
    try {
      parsed = body ? JSON.parse(body) as typeof parsed : {};
    } catch {
      sendJSON(res, 400, { error: 'Invalid JSON' });
      return true;
    }
    const result = await dashboard.onAutomationRun({
      automationId,
      dryRun: parsed?.dryRun === true,
      origin: parsed?.origin,
      agentId: trimOptionalString(parsed?.agentId),
      userId: trimOptionalString(parsed?.userId),
      channel: trimOptionalString(parsed?.channel),
      requestedBy: trimOptionalString(parsed?.requestedBy),
    } satisfies AutomationRunRequest);
    sendJSON(res, 200, result);
    context.maybeEmitUIInvalidation(result, ['automations'], 'automation.run', url.pathname);
    return true;
  }

  const automationEnabledMatch = req.method === 'POST'
    ? url.pathname.match(/^\/api\/automations\/([^/]+)\/enabled$/)
    : null;
  if (automationEnabledMatch) {
    if (!dashboard.onAutomationSetEnabled) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    const automationId = decodeURIComponent(automationEnabledMatch[1] ?? '').trim();
    if (!automationId) {
      sendJSON(res, 400, { error: 'automationId is required' });
      return true;
    }
    let body: string;
    try {
      body = await readBody(req, context.maxBodyBytes);
    } catch (err) {
      sendBadRequest(res, err);
      return true;
    }
    let parsed: { enabled?: boolean };
    try {
      parsed = JSON.parse(body) as { enabled?: boolean };
    } catch {
      sendJSON(res, 400, { error: 'Invalid JSON' });
      return true;
    }
    if (typeof parsed.enabled !== 'boolean') {
      sendJSON(res, 400, { error: 'enabled must be a boolean' });
      return true;
    }
    const result = dashboard.onAutomationSetEnabled(automationId, parsed.enabled);
    sendJSON(res, 200, result);
    context.maybeEmitUIInvalidation(result, ['automations'], 'automation.enabled', url.pathname);
    return true;
  }

  const automationDeleteMatch = req.method === 'DELETE'
    ? url.pathname.match(/^\/api\/automations\/([^/]+)$/)
    : null;
  if (automationDeleteMatch) {
    if (!dashboard.onAutomationDelete) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    const automationId = decodeURIComponent(automationDeleteMatch[1] ?? '').trim();
    if (!automationId) {
      sendJSON(res, 400, { error: 'automationId is required' });
      return true;
    }
    const result = dashboard.onAutomationDelete(automationId);
    sendJSON(res, 200, result);
    context.maybeEmitUIInvalidation(result, ['automations'], 'automation.deleted', url.pathname);
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/scheduled-tasks') {
    if (!dashboard.onScheduledTasks) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    sendJSON(res, 200, dashboard.onScheduledTasks());
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/scheduled-tasks/history') {
    if (!dashboard.onScheduledTaskHistory) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    sendJSON(res, 200, dashboard.onScheduledTaskHistory());
    return true;
  }

  const scheduledTaskRunMatch = req.method === 'POST'
    ? url.pathname.match(/^\/api\/scheduled-tasks\/([^/]+)\/run$/)
    : null;
  if (scheduledTaskRunMatch) {
    if (!dashboard.onScheduledTaskRunNow) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    const id = decodeURIComponent(scheduledTaskRunMatch[1] ?? '');
    if (!id) {
      sendJSON(res, 400, { error: 'Task ID required' });
      return true;
    }
    const result = await dashboard.onScheduledTaskRunNow(id);
    sendJSON(res, 200, result);
    context.maybeEmitUIInvalidation(result, ['automations', 'network', 'security'], 'scheduled-task.ran', url.pathname);
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/scheduled-tasks') {
    if (!dashboard.onScheduledTaskCreate) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    let body: string;
    try {
      body = await readBody(req, context.maxBodyBytes);
    } catch (err) {
      sendBadRequest(res, err);
      return true;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body) as Record<string, unknown>;
    } catch {
      sendJSON(res, 400, { error: 'Invalid JSON' });
      return true;
    }
    const principal = context.resolveRequestPrincipal(req);
    const result = dashboard.onScheduledTaskCreate(
      {
        ...parsed,
        principalId: principal.principalId,
        principalRole: principal.principalRole,
      } as Parameters<NonNullable<typeof dashboard.onScheduledTaskCreate>>[0],
    );
    sendJSON(res, 200, result);
    context.maybeEmitUIInvalidation(result, ['automations', 'network'], 'scheduled-task.created', url.pathname);
    return true;
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/scheduled-tasks/')) {
    if (!dashboard.onScheduledTaskUpdate) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    const id = decodeURIComponent(url.pathname.slice('/api/scheduled-tasks/'.length));
    if (!id) {
      sendJSON(res, 400, { error: 'Task ID required' });
      return true;
    }
    let body: string;
    try {
      body = await readBody(req, context.maxBodyBytes);
    } catch (err) {
      sendBadRequest(res, err);
      return true;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body) as Record<string, unknown>;
    } catch {
      sendJSON(res, 400, { error: 'Invalid JSON' });
      return true;
    }
    const principal = context.resolveRequestPrincipal(req);
    const result = dashboard.onScheduledTaskUpdate(
      id,
      {
        ...parsed,
        principalId: principal.principalId,
        principalRole: principal.principalRole,
      } as Parameters<NonNullable<typeof dashboard.onScheduledTaskUpdate>>[1],
    );
    sendJSON(res, 200, result);
    context.maybeEmitUIInvalidation(result, ['automations', 'network'], 'scheduled-task.updated', url.pathname);
    return true;
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/scheduled-tasks/')) {
    if (!dashboard.onScheduledTaskDelete) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    const id = decodeURIComponent(url.pathname.slice('/api/scheduled-tasks/'.length));
    if (!id) {
      sendJSON(res, 400, { error: 'Task ID required' });
      return true;
    }
    const result = dashboard.onScheduledTaskDelete(id);
    sendJSON(res, 200, result);
    context.maybeEmitUIInvalidation(result, ['automations', 'network'], 'scheduled-task.deleted', url.pathname);
    return true;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/scheduled-tasks/')) {
    if (!dashboard.onScheduledTaskGet) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    const id = decodeURIComponent(url.pathname.slice('/api/scheduled-tasks/'.length));
    if (!id) {
      sendJSON(res, 400, { error: 'Task ID required' });
      return true;
    }
    const task = dashboard.onScheduledTaskGet(id);
    if (!task) {
      sendJSON(res, 404, { error: 'Task not found' });
      return true;
    }
    sendJSON(res, 200, task);
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/search/status') {
    if (!dashboard.onSearchStatus) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    sendJSON(res, 200, await dashboard.onSearchStatus());
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/search/sources') {
    if (!dashboard.onSearchSources) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    sendJSON(res, 200, dashboard.onSearchSources());
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/search/sources') {
    if (!dashboard.onSearchSourceAdd) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    let body: string;
    try {
      body = await readBody(req, context.maxBodyBytes);
    } catch (err) {
      sendBadRequest(res, err);
      return true;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body) as Record<string, unknown>;
    } catch {
      sendJSON(res, 400, { error: 'Invalid JSON' });
      return true;
    }
    if (!parsed.id || !parsed.name || !parsed.path || !parsed.type) {
      sendJSON(res, 400, { error: 'id, name, path, and type are required' });
      return true;
    }
    const result = dashboard.onSearchSourceAdd(
      parsed as Parameters<NonNullable<typeof dashboard.onSearchSourceAdd>>[0],
    );
    sendJSON(res, 200, result);
    context.maybeEmitUIInvalidation(result, ['config'], 'search.source.added', url.pathname);
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/search/pick-path') {
    if (!dashboard.onSearchPickPath) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    let body: string;
    try {
      body = await readBody(req, context.maxBodyBytes);
    } catch (err) {
      sendBadRequest(res, err);
      return true;
    }
    let parsed: { kind?: 'directory' | 'file'; ticket?: string };
    try {
      parsed = JSON.parse(body) as { kind?: 'directory' | 'file'; ticket?: string };
    } catch {
      sendJSON(res, 400, { error: 'Invalid JSON' });
      return true;
    }
    if (!context.requirePrivilegedTicket(req, res, url, 'search.pick-path', parsed.ticket)) {
      return true;
    }
    if (parsed.kind !== 'directory' && parsed.kind !== 'file') {
      sendJSON(res, 400, { error: "kind must be 'directory' or 'file'" });
      return true;
    }
    try {
      const result = await dashboard.onSearchPickPath({ kind: parsed.kind });
      sendJSON(res, 200, result);
    } catch (err) {
      context.logInternalError('Search path picker failed', err);
      sendJSON(res, 500, { error: 'Path picker failed' });
    }
    return true;
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/search/sources/')) {
    if (!dashboard.onSearchSourceRemove) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    const id = decodeURIComponent(url.pathname.slice('/api/search/sources/'.length));
    if (!id) {
      sendJSON(res, 400, { error: 'Source ID required' });
      return true;
    }
    const result = dashboard.onSearchSourceRemove(id);
    sendJSON(res, 200, result);
    context.maybeEmitUIInvalidation(result, ['config'], 'search.source.removed', url.pathname);
    return true;
  }

  if (req.method === 'PATCH' && url.pathname.startsWith('/api/search/sources/')) {
    if (!dashboard.onSearchSourceToggle) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    const id = decodeURIComponent(url.pathname.slice('/api/search/sources/'.length));
    if (!id) {
      sendJSON(res, 400, { error: 'Source ID required' });
      return true;
    }
    let body: string;
    try {
      body = await readBody(req, context.maxBodyBytes);
    } catch (err) {
      sendBadRequest(res, err);
      return true;
    }
    let parsed: { enabled?: boolean };
    try {
      parsed = JSON.parse(body) as { enabled?: boolean };
    } catch {
      sendJSON(res, 400, { error: 'Invalid JSON' });
      return true;
    }
    if (typeof parsed.enabled !== 'boolean') {
      sendJSON(res, 400, { error: 'enabled (boolean) is required' });
      return true;
    }
    const result = dashboard.onSearchSourceToggle(id, parsed.enabled);
    sendJSON(res, 200, result);
    context.maybeEmitUIInvalidation(result, ['config'], 'search.source.toggled', url.pathname);
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/search/reindex') {
    if (!dashboard.onSearchReindex) {
      sendJSON(res, 404, { error: 'Not available' });
      return true;
    }
    let collection: string | undefined;
    try {
      const body = await readBody(req, context.maxBodyBytes);
      if (body.trim()) {
        const parsed = JSON.parse(body) as { collection?: string };
        collection = parsed.collection;
      }
    } catch {
      // No body or invalid JSON — reindex all
    }
    const result = await dashboard.onSearchReindex(collection);
    sendJSON(res, 200, result);
    context.maybeEmitUIInvalidation(result, ['config'], 'search.reindex.started', url.pathname);
    return true;
  }

  return false;
}
