/**
 * Types for native Microsoft 365 integration.
 *
 * The native integration uses direct Graph REST API calls with OAuth 2.0 PKCE.
 *
 * Spec: docs/design/MICROSOFT-365-INTEGRATION-DESIGN.md
 */

/** OAuth token pair stored encrypted at rest. */
export interface MicrosoftTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expiry_date: number;
  scope: string;
}

/** Persistent auth state written to secrets.enc.json. */
export interface MicrosoftAuthState {
  tokens?: MicrosoftTokens;
  clientId?: string;
  /** When the user last completed the OAuth flow. */
  authenticatedAt?: number;
}

/** Parameters for a Microsoft Graph API call. */
export interface MicrosoftExecuteParams {
  /** Microsoft 365 service (e.g. 'mail', 'calendar', 'onedrive', 'contacts'). */
  service: string;
  /** Graph resource path (e.g. 'me/messages', 'me/events', 'me/drive/root/children'). */
  resource: string;
  /** API method (e.g. 'list', 'get', 'create', 'update', 'delete', 'send'). */
  method: string;
  /** Resource ID (inserted into path). */
  id?: string;
  /** OData query parameters ($filter, $select, $top, $orderby, etc.). */
  params?: Record<string, unknown>;
  /** Request body as a JSON-serializable object (for POST/PATCH/PUT). */
  json?: Record<string, unknown>;
  /** Output format: json (default), table, yaml, csv. */
  format?: 'json' | 'table' | 'yaml' | 'csv';
  /** Auto-paginate results. */
  pageAll?: boolean;
  /** Max pages when paginating. */
  pageLimit?: number;
}

/** Result from a Microsoft Graph API call. */
export interface MicrosoftResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Maps Microsoft 365 service names to their minimal OAuth scopes.
 * Each service uses the narrowest scope that covers the required operations.
 * `offline_access` is always appended at auth time to receive a refresh_token.
 * `User.Read` is always included for basic profile info.
 */
export const MICROSOFT_SERVICE_SCOPES: Record<string, string[]> = {
  mail: ['Mail.ReadWrite', 'Mail.Send'],
  calendar: ['Calendars.ReadWrite'],
  onedrive: ['Files.ReadWrite'],
  contacts: ['Contacts.ReadWrite'],
  user: ['User.Read'],
};

/** All service names that the native integration supports. */
export const MICROSOFT_SUPPORTED_SERVICES = Object.keys(MICROSOFT_SERVICE_SCOPES);

/** Default services enabled when not configured. */
export const MICROSOFT_DEFAULT_SERVICES = ['mail', 'calendar', 'onedrive', 'contacts'];

/** Default OAuth callback port (different from Google's 18432). */
export const MICROSOFT_DEFAULT_CALLBACK_PORT = 18433;

/** Microsoft login endpoint. Shared with azure-client.ts. */
export const MICROSOFT_LOGIN_BASE = 'https://login.microsoftonline.com';

/** Microsoft Graph API base URL. */
export const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
