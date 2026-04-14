import { describe, expect, it } from 'vitest';
import {
  repairIntentGatewayOperation,
  repairIntentGatewayRoute,
} from './clarification-resolver.js';
import type { IntentGatewayRepairContext } from './types.js';

describe('clarification-resolver', () => {
  it('pins clarification answers back to the pending personal-assistant route and operation', () => {
    const repairContext: IntentGatewayRepairContext = {
      sourceContent: 'Friday Board Review',
      pendingAction: {
        id: 'pending-routine-name',
        status: 'pending',
        blockerKind: 'clarification',
        route: 'personal_assistant_task',
        operation: 'create',
        prompt: 'What should I call this Second Brain routine?',
        originalRequest: 'Create a review for Board prep every Friday at 4 pm.',
        transferPolicy: 'origin_surface_only',
      },
    };

    const route = repairIntentGatewayRoute(
      'automation_control',
      'update',
      'clarification_answer',
      repairContext,
    );
    const operation = repairIntentGatewayOperation(
      'update',
      route,
      'clarification_answer',
      repairContext,
    );

    expect(route).toBe('personal_assistant_task');
    expect(operation).toBe('create');
  });

  it('repairs remote sandbox requests away from coding_session_control', () => {
    const repairContext: IntentGatewayRepairContext = {
      sourceContent: 'In the Guardian workspace, run `pwd` in the remote sandbox using the Daytona profile for this coding session.',
    };

    const route = repairIntentGatewayRoute(
      'coding_session_control',
      'navigate',
      'new_request',
      repairContext,
    );
    const operation = repairIntentGatewayOperation(
      'navigate',
      route,
      'new_request',
      repairContext,
    );

    expect(route).toBe('coding_task');
    expect(operation).toBe('run');
  });

  it('keeps provider inventory follow-ups in the provider-config lane', () => {
    const repairContext: IntentGatewayRepairContext = {
      sourceContent: 'Show me the configured AI providers and model catalog.',
    };

    const route = repairIntentGatewayRoute(
      'unknown',
      'unknown',
      'new_request',
      repairContext,
    );
    const operation = repairIntentGatewayOperation(
      'unknown',
      route,
      'new_request',
      repairContext,
    );

    expect(route).toBe('general_assistant');
    expect(operation).toBe('inspect');
  });
});
