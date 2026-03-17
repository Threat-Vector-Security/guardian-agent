import { describe, expect, it } from 'vitest';
import { formatSkillInventoryResponse, isSkillInventoryQuery } from './skills-query.js';

describe('skills-query', () => {
  it('detects explicit skill inventory questions', () => {
    expect(isSkillInventoryQuery('What skills do you have?')).toBe(true);
    expect(isSkillInventoryQuery('List your skills')).toBe(true);
    expect(isSkillInventoryQuery('/skills list')).toBe(true);
  });

  it('does not treat skill authoring requests as inventory queries', () => {
    expect(isSkillInventoryQuery('Create a skill for Outlook drafting')).toBe(false);
    expect(isSkillInventoryQuery('Use a skill for this task')).toBe(false);
  });

  it('formats enabled and disabled skills clearly', () => {
    const response = formatSkillInventoryResponse([
      {
        id: 'microsoft-365',
        name: 'Microsoft 365',
        version: '0.2.0',
        description: 'Outlook guidance.',
        enabled: true,
        tags: [],
        rootDir: '/skills/microsoft-365',
        sourcePath: '/skills/microsoft-365/SKILL.md',
        risk: 'operational',
        tools: ['m365'],
        requiredCapabilities: [],
      },
      {
        id: 'github',
        name: 'GitHub',
        version: '0.1.0',
        description: 'GitHub workflows.',
        enabled: false,
        tags: [],
        rootDir: '/skills/github',
        sourcePath: '/skills/github/SKILL.md',
        risk: 'informational',
        tools: [],
        requiredCapabilities: [],
      },
    ]);

    expect(response).toContain('Enabled skills (1):');
    expect(response).toContain('Microsoft 365 (microsoft-365)');
    expect(response).toContain('Disabled skills (1):');
    expect(response).toContain('GitHub (github)');
  });
});
