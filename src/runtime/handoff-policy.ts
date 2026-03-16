import type { AgentHandoffContract } from './handoffs.js';

export function validateHandoffContract(contract: AgentHandoffContract): { ok: boolean; message?: string } {
  if (!contract.id.trim()) return { ok: false, message: 'Handoff contract id is required.' };
  if (!contract.sourceAgentId.trim()) return { ok: false, message: 'Source agent id is required.' };
  if (!contract.targetAgentId.trim()) return { ok: false, message: 'Target agent id is required.' };
  if (contract.sourceAgentId === contract.targetAgentId) {
    return { ok: false, message: 'Source and target agents must differ.' };
  }
  if (contract.allowedCapabilities.length === 0) {
    return { ok: false, message: 'Handoff contracts require at least one allowed capability.' };
  }
  return { ok: true };
}
