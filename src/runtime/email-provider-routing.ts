import { parseScheduledEmailAutomationIntent } from './email-automation-intent.js';
import { parseDirectGmailWriteIntent } from './gmail-compose.js';

const GOOGLE_EMAIL_PROVIDER_PATTERN = /\b(gmail|google workspace|google mail|gws)\b/i;
const MICROSOFT_EMAIL_PROVIDER_PATTERN = /\b(outlook|microsoft 365|office 365|m365)\b/i;

const GENERIC_EMAIL_ACCOUNT_PATTERNS = [
  /\b(?:check|show|list|read|scan|review|summari[sz]e)\b[\s\S]{0,40}\b(?:my\s+)?(?:inbox|emails?|email|mail)\b/i,
  /\b(?:what(?:'s|\s+is)?\s+(?:new|in)\s+(?:my\s+)?(?:inbox|emails?|email|mail)|any\s+new\s+emails?|what\s+(?:new|recent|unread)\s+emails?\s+do\s+i\s+have)\b/i,
  /\b(?:latest|recent|unread|new)\s+(?:my\s+)?(?:emails?|email|mail|inbox)\b/i,
  /\b(?:who\s+sent|summari[sz]e|show)\b[\s\S]{0,30}\b(?:last|latest|recent)\b[\s\S]{0,20}\b(?:emails?|email|mail)\b/i,
  /\b(?:schedule|scheduled|automation|task|remind|reminder)\b[\s\S]{0,60}\b(?:emails?|email|mail)\b/i,
  /\bmy\s+(?:inbox|emails?|email|mail)\b/i,
];

export function getAmbiguousEmailProviderClarification(
  content: string,
  enabledManagedProviders?: ReadonlySet<string>,
): string | null {
  if (!enabledManagedProviders?.has('gws') || !enabledManagedProviders.has('m365')) {
    return null;
  }

  const text = content.trim();
  if (!text) return null;

  if (mentionsSpecificEmailProvider(text)) {
    return null;
  }

  if (!looksLikeMailboxAccountAction(text)) {
    return null;
  }

  return 'I can use either Google Workspace (Gmail) or Microsoft 365 (Outlook) for that email task. Which one do you want me to use?';
}

function mentionsSpecificEmailProvider(text: string): boolean {
  return GOOGLE_EMAIL_PROVIDER_PATTERN.test(text) || MICROSOFT_EMAIL_PROVIDER_PATTERN.test(text);
}

function looksLikeMailboxAccountAction(text: string): boolean {
  if (parseDirectGmailWriteIntent(text)) {
    return true;
  }

  if (parseScheduledEmailAutomationIntent(text)) {
    return true;
  }

  return GENERIC_EMAIL_ACCOUNT_PATTERNS.some((pattern) => pattern.test(text));
}
