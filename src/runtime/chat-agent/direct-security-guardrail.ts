import type { UserMessage } from '../../agent/types.js';
import { isRawCredentialDisclosureRequest } from '../intent/request-patterns.js';
import type { IntentGatewayDecision } from '../intent-gateway.js';

export async function tryDirectSecurityGuardrail(input: {
  message: UserMessage;
  originalUserContent?: string;
  decision?: IntentGatewayDecision | null;
}): Promise<string | null> {
  if (input.decision?.route !== 'security_task') return null;
  const content = input.originalUserContent ?? input.message.content;
  if (!isRawCredentialDisclosureRequest(content)) return null;
  return [
    "I can't save, follow, or execute instructions that require reading protected GuardianAgent configuration, credential stores, tokens, cookies, or API keys and exposing their raw values.",
    '',
    'I can help with a safe alternative: checking whether credential/config files exist, reporting redacted configuration status, or verifying auth/connectivity without printing secrets.',
  ].join('\n');
}
