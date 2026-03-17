import type { SkillStatus } from '../skills/types.js';

const SKILL_INVENTORY_PATTERNS = [
  /\bwhat skills do you have\b/i,
  /\bwhat skills are (?:available|loaded|enabled)\b/i,
  /\bwhich skills do you have\b/i,
  /\b(?:list|show)(?: me)? (?:your|the)? skills\b/i,
  /^\/skills(?:\s+list)?$/i,
];

export function isSkillInventoryQuery(content: string): boolean {
  const text = content.trim();
  if (!text) return false;
  return SKILL_INVENTORY_PATTERNS.some((pattern) => pattern.test(text));
}

export function formatSkillInventoryResponse(statuses: readonly SkillStatus[]): string {
  if (statuses.length === 0) {
    return 'No skills are currently loaded.';
  }

  const enabled = statuses.filter((status) => status.enabled);
  const disabled = statuses.filter((status) => !status.enabled);
  const lines: string[] = [];

  if (enabled.length > 0) {
    lines.push(`Enabled skills (${enabled.length}):`);
    for (const skill of enabled) {
      lines.push(`- ${skill.name} (${skill.id})`);
    }
  } else {
    lines.push('No skills are currently enabled.');
  }

  if (disabled.length > 0) {
    lines.push('');
    lines.push(`Disabled skills (${disabled.length}):`);
    for (const skill of disabled) {
      lines.push(`- ${skill.name} (${skill.id})`);
    }
  }

  return lines.join('\n');
}
