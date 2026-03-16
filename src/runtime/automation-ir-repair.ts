import type { AutomationIR } from './automation-ir.js';

export function repairAutomationIR(ir: AutomationIR): AutomationIR {
  const repaired: AutomationIR = {
    ...ir,
    constraints: { ...ir.constraints },
    metadata: { ...ir.metadata },
    repairNotes: [...(ir.repairNotes ?? [])],
    schedule: ir.schedule ? { ...ir.schedule } : undefined,
    workflow: ir.workflow
      ? {
          mode: ir.workflow.mode,
          steps: ir.workflow.steps.map((step) => ({
            ...step,
            id: step.id.trim(),
            name: step.name?.trim() || undefined,
            packId: step.packId?.trim() || '',
            toolName: step.toolName?.trim() || '',
            instruction: step.instruction?.trim() || undefined,
          })),
        }
      : undefined,
    agent: ir.agent ? { ...ir.agent } : undefined,
    tool: ir.tool ? { ...ir.tool } : undefined,
  };

  if (repaired.primitive === 'workflow' && (!repaired.workflow || repaired.workflow.steps.length === 0) && repaired.schedule) {
    repaired.primitive = 'agent';
    repaired.agent = {
      target: 'default',
      operatorRequest: repaired.metadata.sourceText,
    };
    repaired.workflow = undefined;
    repaired.repairNotes?.push('Converted invalid empty workflow into a scheduled assistant automation.');
  }

  if (repaired.primitive === 'agent' && !repaired.agent) {
    repaired.agent = {
      target: 'default',
      operatorRequest: repaired.metadata.sourceText,
    };
    repaired.repairNotes?.push('Filled missing scheduled assistant body from source request.');
  }

  if (repaired.constraints.forbidCodeArtifacts && repaired.workflow?.steps) {
    const originalLength = repaired.workflow.steps.length;
    repaired.workflow.steps = repaired.workflow.steps.filter((step) => (
      step.toolName !== 'shell_safe'
      && step.toolName !== 'code_create'
    ));
    if (repaired.workflow.steps.length !== originalLength) {
      repaired.repairNotes?.push('Removed non-native code or shell steps due to no-code-artifacts constraints.');
    }
  }

  if (repaired.workflow?.steps) {
    repaired.workflow.steps = repaired.workflow.steps.map((step, index) => ({
      ...step,
      id: step.id || `step_${index + 1}`,
      type: step.type ?? (step.instruction ? 'instruction' : step.delayMs ? 'delay' : 'tool'),
    }));
  }

  return repaired;
}
