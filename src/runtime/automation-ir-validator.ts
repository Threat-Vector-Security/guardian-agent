import Ajv from 'ajv';
import type { AutomationIR, AutomationIRValidationResult } from './automation-ir.js';

const AjvCtor = ((Ajv as unknown as { default?: new (...args: any[]) => any }).default
  ?? (Ajv as unknown as new (...args: any[]) => any));
const ajv = new AjvCtor({ allErrors: true, strict: false, allowUnionTypes: true });

const automationIrSchema = {
  type: 'object',
  required: ['version', 'intent', 'id', 'name', 'description', 'primitive', 'constraints', 'metadata'],
  additionalProperties: false,
  properties: {
    version: { const: 1 },
    intent: { const: 'create' },
    id: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    description: { type: 'string', minLength: 1 },
    primitive: { enum: ['agent', 'workflow', 'tool'] },
    schedule: {
      type: 'object',
      required: ['cron', 'runOnce', 'label', 'expectedRunsPerDay'],
      additionalProperties: false,
      properties: {
        cron: { type: 'string', minLength: 1 },
        runOnce: { type: 'boolean' },
        label: { type: 'string', minLength: 1 },
        expectedRunsPerDay: { type: 'number', minimum: 1 },
      },
    },
    constraints: {
      type: 'object',
      required: ['nativeOnly', 'forbidCodeArtifacts', 'builtInToolsOnly'],
      additionalProperties: false,
      properties: {
        nativeOnly: { type: 'boolean' },
        forbidCodeArtifacts: { type: 'boolean' },
        builtInToolsOnly: { type: 'boolean' },
      },
    },
    metadata: {
      type: 'object',
      required: ['sourceText'],
      additionalProperties: false,
      properties: {
        sourceText: { type: 'string', minLength: 1 },
        channel: { type: 'string' },
        userId: { type: 'string' },
      },
    },
    workflow: {
      type: 'object',
      required: ['mode', 'steps'],
      additionalProperties: false,
      properties: {
        mode: { enum: ['sequential', 'parallel'] },
        steps: { type: 'array', minItems: 1 },
      },
    },
    agent: {
      type: 'object',
      required: ['target', 'operatorRequest'],
      additionalProperties: false,
      properties: {
        target: { const: 'default' },
        operatorRequest: { type: 'string', minLength: 1 },
      },
    },
    tool: {
      type: 'object',
      required: ['target'],
      additionalProperties: false,
      properties: {
        target: { type: 'string', minLength: 1 },
        args: { type: 'object' },
      },
    },
    repairNotes: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} as const;

const validateSchema = ajv.compile(automationIrSchema);

export function validateAutomationIR(ir: AutomationIR): AutomationIRValidationResult {
  const issues: AutomationIRValidationResult['issues'] = [];

  const validSchema = validateSchema(ir);
  if (!validSchema) {
    for (const error of validateSchema.errors ?? []) {
      issues.push({
        path: error.instancePath || '/',
        message: error.message ?? 'Invalid AutomationIR.',
        severity: 'error',
      });
    }
  }

  if (ir.primitive === 'workflow') {
    if (!ir.workflow?.steps?.length) {
      issues.push({
        path: '/workflow/steps',
        message: 'Workflow automations require at least one step.',
        severity: 'error',
      });
    }
  }

  if (ir.primitive === 'agent') {
    if (!ir.schedule?.cron) {
      issues.push({
        path: '/schedule',
        message: 'Scheduled assistant automations require a schedule.',
        severity: 'error',
      });
    }
    if (!ir.agent?.operatorRequest?.trim()) {
      issues.push({
        path: '/agent/operatorRequest',
        message: 'Scheduled assistant automations require an operator request.',
        severity: 'error',
      });
    }
  }

  if (ir.constraints.forbidCodeArtifacts && ir.primitive === 'tool') {
    issues.push({
      path: '/primitive',
      message: 'Tool-only automations cannot satisfy a no-code-artifacts constraint safely.',
      severity: 'error',
    });
  }

  if (ir.constraints.builtInToolsOnly && ir.workflow?.steps) {
    for (const step of ir.workflow.steps) {
      if (step.toolName === 'shell_safe' || step.toolName === 'code_create') {
        issues.push({
          path: `/workflow/steps/${step.id}`,
          message: `Step '${step.id}' violates the built-in-tools-only constraint.`,
          severity: 'error',
        });
      }
    }
  }

  return {
    ok: !issues.some((issue) => issue.severity === 'error'),
    issues,
  };
}
