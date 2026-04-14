import { describe, expect, it } from 'vitest';
import { resolveIntentGatewayEntities } from './route-entity-resolution.js';

describe('resolveIntentGatewayEntities', () => {
  it('marks provider inventory requests as config-surface general assistant work', () => {
    expect(resolveIntentGatewayEntities(
      {},
      { sourceContent: 'Show me the configured AI providers and available models.' },
      'general_assistant',
      'inspect',
    )).toMatchObject({
      uiSurface: 'config',
    });
  });

  it('infers mailbox provider and read mode from mailbox requests', () => {
    expect(resolveIntentGatewayEntities(
      {},
      { sourceContent: 'Check my unread Outlook mail.' },
      'email_task',
      'read',
    )).toMatchObject({
      emailProvider: 'm365',
      mailboxReadMode: 'unread',
    });
  });

  it('infers coding backend and workspace target from explicit backend requests', () => {
    expect(resolveIntentGatewayEntities(
      {},
      { sourceContent: 'Use Codex to inspect src/runtime/intent-gateway.ts in the Guardian workspace.' },
      'coding_task',
      'inspect',
    )).toMatchObject({
      codingBackend: 'codex',
      codingBackendRequested: true,
      sessionTarget: 'Guardian',
    });
  });

  it('preserves remote sandbox commands as coding-task entities', () => {
    expect(resolveIntentGatewayEntities(
      {},
      { sourceContent: 'Run npm test in the remote sandbox for the Guardian workspace.' },
      'coding_task',
      'run',
    )).toMatchObject({
      command: 'npm test',
      codingRemoteExecRequested: true,
      sessionTarget: 'Guardian',
    });
  });

  it('infers routine filters for personal-assistant reads', () => {
    expect(resolveIntentGatewayEntities(
      {},
      { sourceContent: 'Show only my disabled routines.' },
      'personal_assistant_task',
      'read',
    )).toMatchObject({
      personalItemType: 'routine',
      enabled: false,
    });
  });
});
