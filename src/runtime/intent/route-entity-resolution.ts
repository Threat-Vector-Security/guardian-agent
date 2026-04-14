import {
  cleanInferredSessionTarget,
  extractCodingWorkspaceTarget,
  extractExplicitRemoteExecCommand,
  inferExplicitCodingBackendRequest,
} from './entity-resolvers/coding.js';
import {
  inferEmailProviderFromSource,
  inferMailboxReadModeFromSource,
} from './entity-resolvers/email.js';
import {
  inferCalendarWindowDays,
  inferRoutineEnabledFilter,
  inferSecondBrainPersonalItemType,
  inferSecondBrainQuery,
  normalizePersonalItemType,
} from './entity-resolvers/personal-assistant.js';
import { isExplicitProviderConfigRequest } from './entity-resolvers/provider-config.js';
import {
  normalizeCalendarTarget,
  normalizeCalendarWindowDays,
  normalizeCodingBackend,
  normalizeEmailProvider,
  normalizeMailboxReadMode,
  normalizeUiSurface,
} from './normalization.js';
import { collapseIntentGatewayWhitespace } from './text.js';
import type {
  IntentGatewayDecision,
  IntentGatewayEntities,
  IntentGatewayRepairContext,
} from './types.js';

export function resolveIntentGatewayEntities(
  parsed: Record<string, unknown>,
  repairContext: IntentGatewayRepairContext | undefined,
  route: IntentGatewayDecision['route'],
  operation: IntentGatewayDecision['operation'],
): IntentGatewayEntities {
  const rawSourceContent = collapseIntentGatewayWhitespace(repairContext?.sourceContent ?? '');
  const normalizedSourceContent = rawSourceContent.toLowerCase();
  const providerConfigRequest = isExplicitProviderConfigRequest(rawSourceContent);
  const uiSurface = normalizeUiSurface(parsed.uiSurface)
    ?? (route === 'general_assistant' && providerConfigRequest ? 'config' : undefined);
  const automationName = shouldKeepAutomationEntities(route, uiSurface)
    && typeof parsed.automationName === 'string' && parsed.automationName.trim()
    ? parsed.automationName.trim()
    : undefined;
  const newAutomationName = shouldKeepAutomationEntities(route, uiSurface)
    && typeof parsed.newAutomationName === 'string' && parsed.newAutomationName.trim()
    ? parsed.newAutomationName.trim()
    : undefined;
  const manualOnly = typeof parsed.manualOnly === 'boolean' ? parsed.manualOnly : undefined;
  const scheduled = typeof parsed.scheduled === 'boolean' ? parsed.scheduled : undefined;
  const personalItemType = normalizePersonalItemType(parsed.personalItemType)
    ?? inferSecondBrainPersonalItemType(repairContext, route, operation);
  const enabled = typeof parsed.enabled === 'boolean'
    ? parsed.enabled
    : inferRoutineEnabledFilter(repairContext?.sourceContent, route, operation, personalItemType);
  const urls = Array.isArray(parsed.urls)
    ? parsed.urls
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean)
    : undefined;
  const query = typeof parsed.query === 'string' && parsed.query.trim()
    ? parsed.query.trim()
    : inferSecondBrainQuery(repairContext?.sourceContent, route, operation, personalItemType);
  const inferredCodingBackendRequest = rawSourceContent && route === 'coding_task'
    ? inferExplicitCodingBackendRequest(rawSourceContent, normalizedSourceContent, operation)
    : null;
  const path = typeof parsed.path === 'string' && parsed.path.trim()
    ? parsed.path.trim()
    : undefined;
  const sessionTarget = cleanInferredSessionTarget(
    typeof parsed.sessionTarget === 'string'
      ? parsed.sessionTarget
      : (
        inferredCodingBackendRequest?.sessionTarget
        ?? (
          rawSourceContent && (route === 'coding_task' || route === 'coding_session_control')
            ? extractCodingWorkspaceTarget(rawSourceContent)
            : undefined
        )
      ),
  );
  const emailProvider = normalizeEmailProvider(parsed.emailProvider)
    ?? inferEmailProviderFromSource(rawSourceContent, route, personalItemType);
  const mailboxReadMode = normalizeMailboxReadMode(parsed.mailboxReadMode)
    ?? inferMailboxReadModeFromSource(rawSourceContent, route, operation);
  const calendarTarget = normalizeCalendarTarget(parsed.calendarTarget)
    ?? (route === 'personal_assistant_task' && personalItemType === 'calendar' ? 'local' : undefined);
  const calendarWindowDays = normalizeCalendarWindowDays(parsed.calendarWindowDays)
    ?? inferCalendarWindowDays(repairContext?.sourceContent, route, personalItemType);
  const codingBackend = normalizeCodingBackend(parsed.codingBackend)
    ?? inferredCodingBackendRequest?.codingBackend;
  const codingBackendRequested = typeof parsed.codingBackendRequested === 'boolean'
    ? parsed.codingBackendRequested
    : inferredCodingBackendRequest
      ? true
      : undefined;
  const inferredRemoteExecCommand = rawSourceContent && route === 'coding_task'
    ? extractExplicitRemoteExecCommand(rawSourceContent, normalizedSourceContent, operation)
    : undefined;
  const codingRemoteExecRequested = typeof parsed.codingRemoteExecRequested === 'boolean'
    ? parsed.codingRemoteExecRequested
    : inferredRemoteExecCommand
      ? true
      : undefined;
  const codingRunStatusCheck = typeof parsed.codingRunStatusCheck === 'boolean'
    ? parsed.codingRunStatusCheck
    : undefined;
  const toolName = typeof parsed.toolName === 'string' && parsed.toolName.trim()
    ? parsed.toolName.trim()
    : undefined;
  const profileId = typeof parsed.profileId === 'string' && parsed.profileId.trim()
    ? parsed.profileId.trim()
    : undefined;
  const command = typeof parsed.command === 'string' && parsed.command.trim()
    ? parsed.command.trim()
    : inferredRemoteExecCommand;

  return {
    ...(automationName ? { automationName } : {}),
    ...(newAutomationName ? { newAutomationName } : {}),
    ...(typeof manualOnly === 'boolean' ? { manualOnly } : {}),
    ...(typeof scheduled === 'boolean' ? { scheduled } : {}),
    ...(typeof enabled === 'boolean' ? { enabled } : {}),
    ...(uiSurface ? { uiSurface } : {}),
    ...(urls && urls.length > 0 ? { urls } : {}),
    ...(query ? { query } : {}),
    ...(path ? { path } : {}),
    ...(sessionTarget ? { sessionTarget } : {}),
    ...(emailProvider ? { emailProvider } : {}),
    ...(mailboxReadMode ? { mailboxReadMode } : {}),
    ...(calendarTarget ? { calendarTarget } : {}),
    ...(typeof calendarWindowDays === 'number' ? { calendarWindowDays } : {}),
    ...(personalItemType ? { personalItemType } : {}),
    ...(codingBackend ? { codingBackend } : {}),
    ...(typeof codingBackendRequested === 'boolean' ? { codingBackendRequested } : {}),
    ...(typeof codingRemoteExecRequested === 'boolean' ? { codingRemoteExecRequested } : {}),
    ...(typeof codingRunStatusCheck === 'boolean' ? { codingRunStatusCheck } : {}),
    ...(toolName ? { toolName } : {}),
    ...(profileId ? { profileId } : {}),
    ...(command ? { command } : {}),
  };
}

function shouldKeepAutomationEntities(
  route: IntentGatewayDecision['route'],
  uiSurface: IntentGatewayEntities['uiSurface'] | undefined,
): boolean {
  return route === 'automation_authoring'
    || route === 'automation_control'
    || route === 'automation_output_task'
    || (route === 'ui_control' && uiSurface === 'automations');
}
