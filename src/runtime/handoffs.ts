export interface AgentHandoffContract {
  id: string;
  sourceAgentId: string;
  targetAgentId: string;
  allowedCapabilities: string[];
  contextMode: 'full' | 'summary_only' | 'user_only';
  preserveTaint: boolean;
  requireApproval: boolean;
}

export interface AgentHandoffPayload {
  content: string;
  summary?: string;
  taintReasons?: string[];
}

export function applyHandoffContract(
  contract: AgentHandoffContract,
  payload: AgentHandoffPayload,
): AgentHandoffPayload {
  const content = contract.contextMode === 'summary_only'
    ? (payload.summary?.trim() || payload.content.trim())
    : contract.contextMode === 'user_only'
      ? payload.content.trim()
      : payload.content;
  return {
    content,
    summary: payload.summary,
    taintReasons: contract.preserveTaint ? payload.taintReasons : undefined,
  };
}
