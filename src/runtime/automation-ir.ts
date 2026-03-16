import type { AssistantConnectorPlaybookStepDefinition } from '../config/types.js';

export type AutomationPrimitive = 'agent' | 'workflow' | 'tool';

export interface AutomationIRSchedule {
  cron: string;
  runOnce: boolean;
  label: string;
  expectedRunsPerDay: number;
}

export interface AutomationIRConstraints {
  nativeOnly: boolean;
  forbidCodeArtifacts: boolean;
  builtInToolsOnly: boolean;
}

export interface AutomationIRWorkflowBody {
  mode: 'sequential' | 'parallel';
  steps: AssistantConnectorPlaybookStepDefinition[];
}

export interface AutomationIRAgentBody {
  target: 'default';
  operatorRequest: string;
}

export interface AutomationIRToolBody {
  target: string;
  args?: Record<string, unknown>;
}

export interface AutomationIRMetadata {
  sourceText: string;
  channel?: string;
  userId?: string;
}

export interface AutomationIR {
  version: 1;
  intent: 'create';
  id: string;
  name: string;
  description: string;
  primitive: AutomationPrimitive;
  schedule?: AutomationIRSchedule;
  constraints: AutomationIRConstraints;
  metadata: AutomationIRMetadata;
  workflow?: AutomationIRWorkflowBody;
  agent?: AutomationIRAgentBody;
  tool?: AutomationIRToolBody;
  repairNotes?: string[];
}

export interface AutomationIRIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface AutomationIRValidationResult {
  ok: boolean;
  issues: AutomationIRIssue[];
}
