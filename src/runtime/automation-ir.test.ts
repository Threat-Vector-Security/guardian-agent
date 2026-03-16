import { describe, expect, it } from 'vitest';
import { compileAutomationAuthoringIR, compileAutomationAuthoringRequest } from './automation-authoring.js';

describe('AutomationIR authoring', () => {
  it('builds a typed scheduled assistant IR for open-ended recurring work', () => {
    const ir = compileAutomationAuthoringIR(
      'Build a weekday lead research workflow that reads ./companies.csv, researches each company website and public presence, scores fit from 1-5 using a simple B2B SaaS ICP, writes results to ./lead-research-output.csv, and creates ./lead-research-summary.md. Use built-in Guardian tools only. Do not create any shell script, Python script, or code file.',
      { channel: 'web', userId: 'owner' },
    );

    expect(ir).not.toBeNull();
    expect(ir?.primitive).toBe('agent');
    expect(ir?.constraints.builtInToolsOnly).toBe(true);
    expect(ir?.constraints.forbidCodeArtifacts).toBe(true);
    expect(ir?.agent?.operatorRequest).toContain('./companies.csv');
  });

  it('builds a workflow IR for explicit deterministic tool graphs', () => {
    const ir = compileAutomationAuthoringIR(
      'Create a Guardian workflow that runs net_ping and then web_fetch every 15 minutes in sequential mode.',
      { channel: 'web', userId: 'owner' },
    );

    expect(ir).not.toBeNull();
    expect(ir?.primitive).toBe('workflow');
    expect(ir?.workflow?.steps).toHaveLength(2);
    expect(ir?.workflow?.steps[0]?.toolName).toBe('net_ping');
  });

  it('builds a workflow IR for deterministic file instruction workflows', () => {
    const ir = compileAutomationAuthoringIR(
      'Create a sequential Guardian workflow that first reads ./companies.csv, then runs a fixed summarization step, then writes ./lead-research-summary.md.',
      { channel: 'web', userId: 'owner' },
    );

    expect(ir).not.toBeNull();
    expect(ir?.primitive).toBe('workflow');
    expect(ir?.workflow?.steps).toHaveLength(3);
    expect(ir?.workflow?.steps[0]?.toolName).toBe('fs_read');
    expect(ir?.workflow?.steps[1]?.type).toBe('instruction');
    expect(ir?.workflow?.steps[2]?.toolName).toBe('fs_write');
  });

  it('compiles validated IR back into native control-plane mutations', () => {
    const compilation = compileAutomationAuthoringRequest(
      'Create a daily 7:30 AM automation that checks my high-priority inbox, summarizes anything actionable, drafts replies, and asks for approval before sending anything.',
      { channel: 'web', userId: 'owner' },
    );

    expect(compilation).not.toBeNull();
    expect(compilation?.ir.primitive).toBe('agent');
    expect(compilation?.taskCreate?.type).toBe('agent');
    expect(compilation?.taskCreate?.cron).toBe('30 7 * * *');
  });
});
