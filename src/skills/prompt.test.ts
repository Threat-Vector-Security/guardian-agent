import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SkillRegistry } from './registry.js';
import {
  buildSkillPromptMaterial,
  createSkillPromptMaterialCache,
  formatAvailableSkillsPrompt,
} from './prompt.js';
import type { ResolvedSkill } from './types.js';

const testDirs: string[] = [];

function createSkillRoot(): string {
  const root = join(tmpdir(), `guardianagent-skill-prompt-${randomUUID()}`);
  mkdirSync(root, { recursive: true });
  testDirs.push(root);
  return root;
}

function writeSkill(root: string, skillId: string, config: {
  name: string;
  description: string;
  role?: 'process' | 'domain';
  instruction: string;
  referenceFiles?: Record<string, string>;
  templateFiles?: Record<string, string>;
  scriptFiles?: Record<string, string>;
}): void {
  const skillDir = join(root, skillId);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'skill.json'), JSON.stringify({
    id: skillId,
    name: config.name,
    version: '0.1.0',
    description: config.description,
    role: config.role,
  }), 'utf-8');
  writeFileSync(join(skillDir, 'SKILL.md'), config.instruction, 'utf-8');
  if (config.referenceFiles) {
    const dir = join(skillDir, 'references');
    mkdirSync(dir, { recursive: true });
    for (const [name, content] of Object.entries(config.referenceFiles)) {
      writeFileSync(join(dir, name), content, 'utf-8');
    }
  }
  if (config.templateFiles) {
    const dir = join(skillDir, 'templates');
    mkdirSync(dir, { recursive: true });
    for (const [name, content] of Object.entries(config.templateFiles)) {
      writeFileSync(join(dir, name), content, 'utf-8');
    }
  }
  if (config.scriptFiles) {
    const dir = join(skillDir, 'scripts');
    mkdirSync(dir, { recursive: true });
    for (const [name, content] of Object.entries(config.scriptFiles)) {
      writeFileSync(join(dir, name), content, 'utf-8');
    }
  }
}

function toResolvedSkill(skill: {
  id: string;
  name: string;
  description: string;
  role?: 'process' | 'domain';
  summary: string;
}): ResolvedSkill {
  return {
    ...skill,
    sourcePath: `/skills/${skill.id}/SKILL.md`,
    score: 10,
  };
}

afterEach(() => {
  for (const dir of testDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('formatAvailableSkillsPrompt', () => {
  it('renders an OpenCLAW-style skill catalog with locations', () => {
    const prompt = formatAvailableSkillsPrompt([
      {
        id: 'google-workspace',
        name: 'Google Workspace',
        description: 'Use Google Workspace tools for Gmail, Calendar, Drive, Docs, and Sheets.',
        role: 'domain',
        summary: 'unused in prompt',
        sourcePath: '/app/skills/google-workspace/SKILL.md',
        score: 9,
      },
    ]);

    expect(prompt).toContain('## Skills (mandatory)');
    expect(prompt).toContain('<available_skills>');
    expect(prompt).toContain('<name>Google Workspace</name>');
    expect(prompt).toContain('<description>Use Google Workspace tools for Gmail, Calendar, Drive, Docs, and Sheets.</description>');
    expect(prompt).toContain('<role>domain</role>');
    expect(prompt).toContain('<location>/app/skills/google-workspace/SKILL.md</location>');
    expect(prompt).toContain('Before any reply, clarifying question, or tool call');
    expect(prompt).toContain('read its SKILL.md');
    expect(prompt).toContain('Read at most two SKILL.md files up front');
  });

  it('returns an empty string when there are no resolved skills', () => {
    expect(formatAvailableSkillsPrompt([])).toBe('');
  });
});

describe('buildSkillPromptMaterial', () => {
  it('loads bounded L2 instructions and L3 resources for the most relevant process and domain skills', async () => {
    const root = createSkillRoot();
    writeSkill(root, 'systematic-debugging', {
      name: 'Systematic Debugging',
      description: 'Use for debugging and root-cause work.',
      role: 'process',
      instruction: [
        '# Systematic Debugging',
        '',
        'Start by narrowing the failing boundary.',
        'Read references/root-cause.md when you need the compact checklist.',
      ].join('\n'),
      referenceFiles: {
        'root-cause.md': 'Root cause checklist:\n1. Reproduce.\n2. Isolate.\n3. Verify.',
      },
    });
    writeSkill(root, 'security-triage', {
      name: 'Security Triage',
      description: 'Use for alert investigation and triage.',
      role: 'domain',
      instruction: [
        '# Security Triage',
        '',
        'Lead with impact and confidence.',
        'Use templates/triage-report.md when the user wants a structured triage report.',
      ].join('\n'),
      templateFiles: {
        'triage-report.md': 'Severity:\nImpact:\nEvidence:\nNext steps:',
      },
    });

    const registry = new SkillRegistry();
    await registry.loadFromRoots([root]);

    const result = buildSkillPromptMaterial(registry, {
      skills: [
        toResolvedSkill({
          id: 'systematic-debugging',
          name: 'Systematic Debugging',
          description: 'Use for debugging and root-cause work.',
          role: 'process',
          summary: 'Narrow the failing boundary first.',
        }),
        toResolvedSkill({
          id: 'security-triage',
          name: 'Security Triage',
          description: 'Use for alert investigation and triage.',
          role: 'domain',
          summary: 'Lead with impact and confidence.',
        }),
      ],
      requestText: 'Debug this alerting issue and give me a checklist plus a report template.',
      route: 'security_task',
    }, createSkillPromptMaterialCache());

    expect(result.metadata.instructionSkillIds).toEqual(['systematic-debugging', 'security-triage']);
    expect(result.metadata.resourceSkillIds).toEqual(['security-triage', 'systematic-debugging']);
    expect(result.metadata.loadedResourcePaths).toContain('security-triage:templates/triage-report.md');
    expect(result.metadata.loadedResourcePaths).toContain('systematic-debugging:references/root-cause.md');
    expect(result.additionalSections.some((section) => section.section === 'skill_instructions')).toBe(true);
    expect(result.additionalSections.some((section) => section.section === 'skill_resources')).toBe(true);
  });

  it('reuses a request-local cache across repeated prompt material loads', async () => {
    const root = createSkillRoot();
    writeSkill(root, 'writing-plans', {
      name: 'Writing Plans',
      description: 'Use for implementation planning.',
      role: 'process',
      instruction: '# Writing Plans\n\nUse templates/implementation-plan.md for a durable plan.',
      templateFiles: {
        'implementation-plan.md': 'Goal:\nPlan:\nVerification:',
      },
    });

    const registry = new SkillRegistry();
    await registry.loadFromRoots([root]);
    const cache = createSkillPromptMaterialCache();
    const input = {
      skills: [
        toResolvedSkill({
          id: 'writing-plans',
          name: 'Writing Plans',
          description: 'Use for implementation planning.',
          role: 'process',
          summary: 'Use a durable plan shape.',
        }),
      ],
      requestText: 'Write me a plan template for this change.',
      route: 'coding_task',
    } as const;

    const first = buildSkillPromptMaterial(registry, input, cache);
    const second = buildSkillPromptMaterial(registry, input, cache);

    expect(first.metadata.cacheHits).toEqual([]);
    expect(second.metadata.cacheHits.length).toBeGreaterThan(0);
    expect(second.metadata.cacheHits.some((entry) => entry.includes('writing-plans:instruction'))).toBe(true);
  });

  it('loads the writing-plans template for plan requests without explicit template wording', async () => {
    const root = createSkillRoot();
    writeSkill(root, 'writing-plans', {
      name: 'Writing Plans',
      description: 'Use for implementation planning.',
      role: 'process',
      instruction: '# Writing Plans\n\nUse templates/implementation-plan.md for durable plans.',
      templateFiles: {
        'implementation-plan.md': '# Plan\n\n## Acceptance Gates\n## Existing Checks To Reuse',
      },
    });

    const registry = new SkillRegistry();
    await registry.loadFromRoots([root]);

    const result = buildSkillPromptMaterial(registry, {
      skills: [
        toResolvedSkill({
          id: 'writing-plans',
          name: 'Writing Plans',
          description: 'Use for implementation planning.',
          role: 'process',
          summary: 'Use a durable plan shape.',
        }),
      ],
      requestText: 'Write me an implementation plan for this change.',
    }, createSkillPromptMaterialCache());

    expect(result.metadata.resourceSkillIds).toEqual(['writing-plans']);
    expect(result.metadata.loadedResourcePaths).toContain('writing-plans:templates/implementation-plan.md');
    expect(result.additionalSections.some((section) => section.section === 'skill_resources')).toBe(true);
  });

  it('loads the code-review template for review requests without explicit template wording', async () => {
    const root = createSkillRoot();
    writeSkill(root, 'code-review', {
      name: 'Code Review',
      description: 'Use for diff and patch review.',
      role: 'process',
      instruction: '# Code Review\n\nUse templates/review-findings.md for durable findings.',
      templateFiles: {
        'review-findings.md': '# Findings\n\n## Open Questions\n## Verification Gaps',
      },
    });

    const registry = new SkillRegistry();
    await registry.loadFromRoots([root]);

    const result = buildSkillPromptMaterial(registry, {
      skills: [
        toResolvedSkill({
          id: 'code-review',
          name: 'Code Review',
          description: 'Use for diff and patch review.',
          role: 'process',
          summary: 'Lead with findings.',
        }),
      ],
      requestText: 'Review this patch for regressions and missing tests before merge.',
    }, createSkillPromptMaterialCache());

    expect(result.metadata.resourceSkillIds).toEqual(['code-review']);
    expect(result.metadata.loadedResourcePaths).toContain('code-review:templates/review-findings.md');
    expect(result.additionalSections.some((section) => section.section === 'skill_resources')).toBe(true);
  });

  it('includes bounded reviewed artifact references when they are supplied by the runtime', async () => {
    const root = createSkillRoot();
    writeSkill(root, 'release-notes', {
      name: 'Release Notes',
      description: 'Use for release-note authoring.',
      role: 'domain',
      instruction: '# Release Notes\n\nKeep release notes terse and decision-focused.',
    });

    const registry = new SkillRegistry();
    await registry.loadFromRoots([root]);

    const result = buildSkillPromptMaterial(registry, {
      skills: [
        toResolvedSkill({
          id: 'release-notes',
          name: 'Release Notes',
          description: 'Use for release-note authoring.',
          role: 'domain',
          summary: 'Keep release notes terse and decision-focused.',
        }),
      ],
      requestText: 'Write release notes in the preferred style.',
      artifactReferences: [
        {
          skillId: 'release-notes',
          scope: 'global',
          slug: 'release-notes-style',
          title: 'Release Notes Style',
          sourceClass: 'operator_curated',
          content: 'Release notes should stay terse, decision-focused, and avoid narrative filler.',
          truncated: false,
        },
      ],
      loadOptions: {
        maxArtifactLoads: 1,
      },
    }, createSkillPromptMaterialCache());

    expect(result.metadata.artifactReferences).toEqual([
      {
        skillId: 'release-notes',
        scope: 'global',
        slug: 'release-notes-style',
        title: 'Release Notes Style',
        sourceClass: 'operator_curated',
      },
    ]);
    expect(result.additionalSections.some((section) => section.section === 'skill_artifacts')).toBe(true);
  });
});
