import { normalizeOperation, normalizeRoute } from './normalization.js';
import type { IntentGatewayDecision, IntentGatewayRepairContext } from './types.js';

export function repairIntentGatewayRoute(
  route: IntentGatewayDecision['route'],
  turnRelation: IntentGatewayDecision['turnRelation'],
  repairContext: IntentGatewayRepairContext | undefined,
): IntentGatewayDecision['route'] {
  if (turnRelation === 'clarification_answer' || turnRelation === 'correction') {
    const pendingRoute = normalizeRoute(repairContext?.pendingAction?.route);
    if (pendingRoute !== 'unknown') {
      return pendingRoute;
    }
  }
  return route;
}

export function repairIntentGatewayOperation(
  operation: IntentGatewayDecision['operation'],
  route: IntentGatewayDecision['route'],
  turnRelation: IntentGatewayDecision['turnRelation'],
  repairContext: IntentGatewayRepairContext | undefined,
): IntentGatewayDecision['operation'] {
  if (turnRelation === 'clarification_answer' || turnRelation === 'correction') {
    const pendingAction = repairContext?.pendingAction;
    if (!pendingAction) {
      return operation;
    }
    const pendingRoute = normalizeRoute(pendingAction.route);
    const pendingOperation = normalizeOperation(pendingAction.operation);
    if (pendingRoute === route && pendingOperation !== 'unknown') {
      return pendingOperation;
    }
  }
  return operation;
}
