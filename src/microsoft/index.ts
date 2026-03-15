/**
 * Native Microsoft 365 integration module.
 *
 * Provides direct API access to Outlook Mail, Calendar, OneDrive, and
 * Contacts using OAuth2 PKCE — no external SDK dependency required.
 *
 * The `m365` tool handler in ToolExecutor routes to MicrosoftService (native).
 *
 * Spec: docs/specs/MICROSOFT-365-INTEGRATION-SPEC.md
 */

export { MicrosoftAuth } from './microsoft-auth.js';
export type { MicrosoftAuthConfig } from './microsoft-auth.js';
export { MicrosoftService } from './microsoft-service.js';
export type { MicrosoftServiceConfig } from './microsoft-service.js';
export type {
  MicrosoftTokens,
  MicrosoftAuthState,
  MicrosoftExecuteParams,
  MicrosoftResult,
} from './types.js';
export {
  MICROSOFT_SERVICE_SCOPES,
  MICROSOFT_SUPPORTED_SERVICES,
  MICROSOFT_DEFAULT_SERVICES,
  MICROSOFT_DEFAULT_CALLBACK_PORT,
  MICROSOFT_LOGIN_BASE,
  GRAPH_API_BASE,
} from './types.js';
