/**
 * Native Microsoft 365 API service.
 *
 * Calls Microsoft Graph via HTTPS with OAuth 2.0 PKCE.
 * Single base URL (graph.microsoft.com/v1.0), consistent OData patterns.
 *
 * Spec: docs/design/MICROSOFT-365-INTEGRATION-DESIGN.md
 */

import { createLogger } from '../util/logging.js';
import type { MicrosoftAuth } from './microsoft-auth.js';
import { GRAPH_API_BASE } from './types.js';
import type { MicrosoftExecuteParams, MicrosoftResult } from './types.js';

const log = createLogger('microsoft-service');

const DEFAULT_TIMEOUT = 30_000;
const MAX_PAGES = 20;

/**
 * Curated schema reference for Microsoft Graph endpoints.
 * OData $metadata is XML and verbose, so we ship a curated JSON reference instead.
 */
const GRAPH_SCHEMA: Record<string, Record<string, unknown>> = {
  'mail.messages.list': {
    method: 'GET',
    path: '/me/messages',
    params: ['$filter', '$select', '$top', '$skip', '$orderby', '$count', '$search'],
    description: 'List messages in the signed-in user\'s mailbox.',
    example: { resource: 'me/messages', method: 'list', params: { $top: 10, $select: 'subject,from,receivedDateTime' } },
  },
  'mail.messages.get': {
    method: 'GET',
    path: '/me/messages/{id}',
    params: ['$select', '$expand'],
    description: 'Get a specific message by ID.',
    example: { resource: 'me/messages', method: 'get', id: 'MESSAGE_ID' },
  },
  'mail.messages.create': {
    method: 'POST',
    path: '/me/messages',
    body: ['subject', 'body', 'toRecipients', 'ccRecipients', 'bccRecipients', 'importance'],
    description: 'Create a draft message.',
    example: { resource: 'me/messages', method: 'create', json: { subject: 'Hello', body: { contentType: 'Text', content: 'Body' }, toRecipients: [{ emailAddress: { address: 'user@example.com' } }] } },
  },
  'mail.messages.update': {
    method: 'PATCH',
    path: '/me/messages/{id}',
    body: ['subject', 'body', 'toRecipients', 'categories', 'isRead'],
    description: 'Update a draft message or message properties.',
  },
  'mail.messages.delete': {
    method: 'DELETE',
    path: '/me/messages/{id}',
    description: 'Delete a message (moves to Deleted Items).',
  },
  'mail.messages.send': {
    method: 'POST',
    path: '/me/messages/{id}/send',
    description: 'Send a draft message.',
  },
  'mail.sendMail': {
    method: 'POST',
    path: '/me/sendMail',
    body: ['message', 'saveToSentItems'],
    description: 'Send a new email directly (not from draft).',
    example: { resource: 'me/sendMail', method: 'create', json: { message: { subject: 'Hello', body: { contentType: 'Text', content: 'Body' }, toRecipients: [{ emailAddress: { address: 'user@example.com' } }] } } },
  },
  'mail.mailFolders.list': {
    method: 'GET',
    path: '/me/mailFolders',
    description: 'List mail folders.',
  },
  'calendar.events.list': {
    method: 'GET',
    path: '/me/events',
    params: ['$filter', '$select', '$top', '$skip', '$orderby', 'startDateTime', 'endDateTime'],
    description: 'List events in the user\'s default calendar.',
    example: { resource: 'me/events', method: 'list', params: { $top: 10, $select: 'subject,start,end,location' } },
  },
  'calendar.events.get': {
    method: 'GET',
    path: '/me/events/{id}',
    description: 'Get a specific calendar event.',
  },
  'calendar.events.create': {
    method: 'POST',
    path: '/me/events',
    body: ['subject', 'body', 'start', 'end', 'location', 'attendees', 'isAllDay', 'recurrence', 'isOnlineMeeting'],
    description: 'Create a new calendar event.',
    example: { resource: 'me/events', method: 'create', json: { subject: 'Meeting', start: { dateTime: '2026-03-20T10:00:00', timeZone: 'UTC' }, end: { dateTime: '2026-03-20T10:30:00', timeZone: 'UTC' } } },
  },
  'calendar.events.update': {
    method: 'PATCH',
    path: '/me/events/{id}',
    body: ['subject', 'body', 'start', 'end', 'location', 'attendees'],
    description: 'Update a calendar event.',
  },
  'calendar.events.delete': {
    method: 'DELETE',
    path: '/me/events/{id}',
    description: 'Delete a calendar event.',
  },
  'calendar.calendarView': {
    method: 'GET',
    path: '/me/calendarView',
    params: ['startDateTime', 'endDateTime', '$select', '$top', '$filter'],
    description: 'Get calendar view (occurrences of recurring events expanded) within a date range.',
    example: { resource: 'me/calendarView', method: 'list', params: { startDateTime: '2026-03-01T00:00:00Z', endDateTime: '2026-03-31T23:59:59Z' } },
  },
  'onedrive.root.children': {
    method: 'GET',
    path: '/me/drive/root/children',
    params: ['$select', '$top', '$filter', '$orderby'],
    description: 'List files and folders in OneDrive root.',
    example: { resource: 'me/drive/root/children', method: 'list' },
  },
  'onedrive.items.get': {
    method: 'GET',
    path: '/me/drive/items/{id}',
    description: 'Get a drive item by ID.',
  },
  'onedrive.items.search': {
    method: 'GET',
    path: '/me/drive/root/search(q=\'{query}\')',
    params: ['$select', '$top'],
    description: 'Search OneDrive for files matching a query.',
    example: { resource: 'me/drive/root/search(q=\'report\')', method: 'list' },
  },
  'onedrive.items.create': {
    method: 'PUT',
    path: '/me/drive/root:/{filename}:/content',
    description: 'Upload a small file to OneDrive root.',
  },
  'onedrive.items.delete': {
    method: 'DELETE',
    path: '/me/drive/items/{id}',
    description: 'Delete a drive item.',
  },
  'contacts.list': {
    method: 'GET',
    path: '/me/contacts',
    params: ['$filter', '$select', '$top', '$skip', '$orderby', '$search'],
    description: 'List contacts.',
    example: { resource: 'me/contacts', method: 'list', params: { $top: 10, $select: 'displayName,emailAddresses' } },
  },
  'contacts.get': {
    method: 'GET',
    path: '/me/contacts/{id}',
    description: 'Get a specific contact.',
  },
  'contacts.create': {
    method: 'POST',
    path: '/me/contacts',
    body: ['givenName', 'surname', 'emailAddresses', 'businessPhones', 'companyName', 'jobTitle'],
    description: 'Create a new contact.',
  },
  'contacts.update': {
    method: 'PATCH',
    path: '/me/contacts/{id}',
    description: 'Update a contact.',
  },
  'contacts.delete': {
    method: 'DELETE',
    path: '/me/contacts/{id}',
    description: 'Delete a contact.',
  },
  'user.me': {
    method: 'GET',
    path: '/me',
    params: ['$select'],
    description: 'Get the signed-in user\'s profile.',
    example: { resource: 'me', method: 'get', params: { $select: 'displayName,mail,userPrincipalName' } },
  },
};

export interface MicrosoftServiceConfig {
  /** Enabled services. */
  services?: string[];
  /** Request timeout in ms. */
  timeoutMs?: number;
}

export class MicrosoftService {
  private readonly auth: MicrosoftAuth;
  private readonly services: Set<string>;
  private readonly timeoutMs: number;

  constructor(auth: MicrosoftAuth, config?: MicrosoftServiceConfig) {
    this.auth = auth;
    this.timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT;
    this.services = new Set(
      config?.services?.length
        ? config.services.map((s) => s.trim().toLowerCase())
        : ['mail', 'calendar', 'onedrive', 'contacts'],
    );
  }

  /** Check if a service is enabled. */
  isServiceEnabled(service: string): boolean {
    return this.services.has(service.toLowerCase());
  }

  /** Get list of enabled services. */
  getEnabledServices(): string[] {
    return [...this.services];
  }

  /** Check if the user is authenticated. */
  isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  /** Get an active access token (refreshes if needed). */
  async getAccessToken(): Promise<string> {
    return this.auth.getAccessToken();
  }

  /**
   * High-level helper to send an Outlook message directly (not from draft).
   * Uses the /me/sendMail endpoint with a JSON body (cleaner than Gmail's RFC822).
   */
  async sendOutlookMessage(message: { to: string; subject: string; body: string }): Promise<MicrosoftResult> {
    try {
      const accessToken = await this.getAccessToken();
      const url = `${GRAPH_API_BASE}/me/sendMail`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: message.subject,
            body: { contentType: 'Text', content: message.body },
            toRecipients: [{ emailAddress: { address: message.to } }],
          },
        }),
      });

      // sendMail returns 202 Accepted with no body on success.
      if (response.status === 202 || response.ok) {
        return { success: true, data: { status: 'sent', to: message.to } };
      }

      const data = await response.json() as any;
      return { success: false, error: data.error?.message || response.statusText };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * High-level helper to create an Outlook draft message.
   */
  async createOutlookDraft(message: { to: string; subject: string; body: string }): Promise<MicrosoftResult> {
    return this.execute({
      service: 'mail',
      resource: 'me/messages',
      method: 'create',
      json: {
        subject: message.subject,
        body: { contentType: 'Text', content: message.body },
        toRecipients: [{ emailAddress: { address: message.to } }],
      },
    });
  }

  /**
   * Execute a Microsoft Graph API call.
   */
  async execute(params: MicrosoftExecuteParams): Promise<MicrosoftResult> {
    const { service, resource, method, id } = params;
    const svc = service.toLowerCase();

    if (!this.isServiceEnabled(svc) && svc !== 'user') {
      return {
        success: false,
        error: `Service '${svc}' is not enabled. Enabled services: ${this.getEnabledServices().join(', ')}`,
      };
    }

    try {
      const accessToken = await this.auth.getAccessToken();
      const url = this.buildUrl(resource, id);
      const httpMethod = this.inferHttpMethod(method, params.json);

      // Append OData query parameters.
      if (params.params) {
        for (const [key, value] of Object.entries(params.params)) {
          if (value === undefined || value === null) continue;
          url.searchParams.set(key, String(value));
        }
      }

      log.debug({ service: svc, resource, method, httpMethod, url: url.toString() }, 'Microsoft Graph API call');

      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      };

      let body: string | undefined;
      if (params.json && Object.keys(params.json).length > 0) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(params.json);
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        let result = await this.doFetch(url.toString(), httpMethod, headers, body, controller.signal);

        // Auto-paginate if requested.
        if (params.pageAll && result.success && result.data) {
          result = await this.paginate(result, httpMethod, headers, params.pageLimit);
        }

        return result;
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn({ service: svc, resource, method, err: message }, 'Microsoft Graph API call failed');
      return { success: false, error: message };
    }
  }

  /**
   * Look up API schema for a Graph endpoint.
   * Returns curated endpoint documentation from the built-in reference.
   */
  schema(schemaPath: string): MicrosoftResult {
    const normalized = schemaPath.trim().toLowerCase();

    // Exact match.
    const entry = GRAPH_SCHEMA[normalized];
    if (entry) {
      return { success: true, data: { path: normalized, ...entry } };
    }

    // Prefix search: return all endpoints matching the prefix.
    const matches = Object.entries(GRAPH_SCHEMA)
      .filter(([key]) => key.startsWith(normalized))
      .map(([key, val]) => ({ path: key, ...val }));

    if (matches.length > 0) {
      return { success: true, data: { matches, count: matches.length } };
    }

    // List all available paths.
    return {
      success: true,
      data: {
        message: `No schema found for '${schemaPath}'. Available paths:`,
        paths: Object.keys(GRAPH_SCHEMA),
      },
    };
  }

  // ─── Private ────────────────────────────────────────────

  private buildUrl(resource: string, id?: string): URL {
    // Graph paths use slashes: me/messages, me/events, me/drive/root/children
    let path = resource.trim();

    // If an ID is provided and the path doesn't already contain it, insert it.
    if (id) {
      path += `/${id}`;
    }

    return new URL(`${GRAPH_API_BASE}/${path}`);
  }

  private inferHttpMethod(method: string, json?: Record<string, unknown>): string {
    const lower = method.toLowerCase();
    if (['get', 'list'].includes(lower)) return 'GET';
    if (['delete', 'remove'].includes(lower)) return 'DELETE';
    if (['update', 'patch', 'modify'].includes(lower)) return 'PATCH';
    if (['create', 'send', 'copy', 'move', 'forward', 'reply'].includes(lower)) return 'POST';
    // If there's a body, default to POST; otherwise GET.
    return json && Object.keys(json).length > 0 ? 'POST' : 'GET';
  }

  private async doFetch(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string | undefined,
    signal: AbortSignal,
  ): Promise<MicrosoftResult> {
    const resp = await fetch(url, { method, headers, body, signal });

    // Some Graph endpoints return 204 No Content or 202 Accepted.
    if (resp.status === 204 || resp.status === 202) {
      return { success: true, data: null };
    }

    const text = await resp.text();

    if (!resp.ok) {
      let errorMessage = `HTTP ${resp.status}`;
      try {
        const errJson = JSON.parse(text) as { error?: { message?: string; code?: string } };
        if (errJson.error?.message) errorMessage = `${errJson.error.code || 'Error'}: ${errJson.error.message}`;
      } catch {
        if (text) errorMessage = text;
      }
      return { success: false, error: errorMessage };
    }

    if (!text.trim()) return { success: true, data: null };

    try {
      return { success: true, data: JSON.parse(text) };
    } catch {
      return { success: true, data: text };
    }
  }

  /**
   * Auto-paginate using @odata.nextLink (Graph's consistent pagination mechanism).
   */
  private async paginate(
    firstResult: MicrosoftResult,
    method: string,
    headers: Record<string, string>,
    pageLimit?: number,
  ): Promise<MicrosoftResult> {
    const maxPages = Math.min(pageLimit ?? MAX_PAGES, MAX_PAGES);
    const allItems: unknown[] = [];

    // Graph always returns items in the `value` array.
    const data = firstResult.data;
    if (data && Array.isArray(data.value)) {
      allItems.push(...data.value);
    }

    let nextUrl = data?.['@odata.nextLink'] as string | undefined;
    let pages = 1;

    while (nextUrl && pages < maxPages) {
      const result = await this.doFetch(nextUrl, method, headers, undefined, AbortSignal.timeout(this.timeoutMs));
      if (!result.success) break;

      if (result.data && Array.isArray(result.data.value)) {
        allItems.push(...result.data.value);
      }
      nextUrl = result.data?.['@odata.nextLink'] as string | undefined;
      pages += 1;
    }

    return {
      success: true,
      data: {
        value: allItems,
        totalItems: allItems.length,
        pages,
        truncated: !!nextUrl,
      },
    };
  }
}
