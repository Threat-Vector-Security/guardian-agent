import { normalizeIntentGatewayRepairText } from './text.js';

export function looksLikeContextDependentPromptSelectionTurn(request: string): boolean {
  const normalized = request.trim().toLowerCase();
  if (!normalized || normalized.length > 64) return false;
  return /^(?:yes|yeah|yep|no|nope|ok|okay|sure|actually|instead|use\b|switch\b|continue\b|resume\b|retry\b|again\b|same\b|that\b|those\b|it\b|them\b|this\b)/.test(normalized)
    || /\b(?:that|those|it|them|same\s+(?:one|workspace|session)|again)\b/.test(normalized);
}

export function looksLikeStandaloneGreetingTurn(request: string | undefined): boolean {
  const normalized = normalizeIntentGatewayRepairText(request);
  if (!normalized || normalized.length > 48) return false;
  return /^(?:hi|hello|hey|hiya|howdy|greetings|good\s+(?:morning|afternoon|evening))(?:[.!?]+)?$/.test(normalized);
}

export function isExplicitComplexPlanningRequest(content: string | undefined): boolean {
  const normalized = normalizeIntentGatewayRepairText(content);
  if (!normalized) return false;
  return /\buse (?:your|the) complex[- ]planning path\b/.test(normalized)
    || /\b(?:your|the)\s+complex[- ]planning path\b[^.!?\n]{0,40}\bfor this request\b/.test(normalized)
    || /\b(?:route|send) (?:this|it|the request)?\s*(?:through|to) (?:your |the )?complex[- ]planning path\b/.test(normalized)
    || /\b(?:use|run|route|handle|take)\b[^.!?\n]{0,80}\b(?:dag planner|dag path|planner path)\b/.test(normalized);
}

export function isExplicitCodingExecutionRequest(content: string | undefined): boolean {
  const normalized = normalizeIntentGatewayRepairText(content);
  if (!normalized) return false;
  
  const hasCodingTool = /\b(npm|pnpm|yarn|bun|pip|pip3|python|python3|go|cargo|rustc|javac|make|cmake|git|docker|kubectl)\b/i.test(normalized);
  const hasCodingCommand = /\b(install|run|test|build|deploy|ci|add|remove|update|status|diff|commit|push|pull)\b/i.test(normalized);
  
  // Also match "run [anything] in [path]" which is almost always a task
  // Ensure we don't match across sentences by excluding period/newline
  const isRunInPath = /\brun\s+[^.!?\n]+?\s+in\s+[^.!?\n]+?\b/i.test(normalized);
  
  return (hasCodingTool && hasCodingCommand) || isRunInPath;
}
