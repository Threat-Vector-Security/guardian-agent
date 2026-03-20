/**
 * Policy rule loading — reads JSON policy files from disk,
 * validates schema version, and returns parsed rules.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import type { PolicyRule, PolicyFile } from './types.js';
import { POLICY_SCHEMA_VERSION } from './types.js';
import type { ControlPlaneIntegrity } from '../guardian/control-plane-integrity.js';

export interface LoadResult {
  rules: PolicyRule[];
  errors: string[];
  fileCount: number;
}

/**
 * Load all policy rule files from a directory.
 * Recurses one level into subdirectories.
 */
export function loadPolicyFiles(rulesPath: string, integrity?: ControlPlaneIntegrity): LoadResult {
  const rules: PolicyRule[] = [];
  const errors: string[] = [];
  let fileCount = 0;

  if (!existsSync(rulesPath)) {
    return { rules, errors: [`Policy path does not exist: ${rulesPath}`], fileCount: 0 };
  }

  const entries = readdirSync(rulesPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(rulesPath, entry.name);

    if (entry.isDirectory()) {
      // One level of subdirectory
      const subEntries = readdirSync(fullPath, { withFileTypes: true });
      for (const sub of subEntries) {
        if (sub.isFile() && extname(sub.name) === '.json') {
          const result = loadSingleFile(join(fullPath, sub.name), integrity);
          rules.push(...result.rules);
          errors.push(...result.errors);
          fileCount++;
        }
      }
    } else if (entry.isFile() && extname(entry.name) === '.json') {
      const result = loadSingleFile(fullPath, integrity);
      rules.push(...result.rules);
      errors.push(...result.errors);
      fileCount++;
    }
  }

  return { rules, errors, fileCount };
}

/**
 * Load and validate a single policy JSON file.
 */
export function loadSingleFile(filePath: string, integrity?: ControlPlaneIntegrity): { rules: PolicyRule[]; errors: string[] } {
  const errors: string[] = [];
  try {
    if (integrity) {
      const verification = integrity.verifyFileSync(filePath, {
        adoptUntracked: true,
        updatedBy: 'policy_load',
      });
      if (!verification.ok) {
        return { rules: [], errors: [verification.message] };
      }
    }

    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as PolicyFile;

    // Schema version check
    if (parsed.schemaVersion === undefined || parsed.schemaVersion === null) {
      return { rules: [], errors: [`${filePath}: missing schemaVersion`] };
    }
    if (parsed.schemaVersion > POLICY_SCHEMA_VERSION) {
      return {
        rules: [],
        errors: [`${filePath}: schemaVersion ${parsed.schemaVersion} is newer than supported version ${POLICY_SCHEMA_VERSION}. Entire file rejected.`],
      };
    }

    if (!Array.isArray(parsed.rules)) {
      return { rules: [], errors: [`${filePath}: 'rules' must be an array`] };
    }

    const validRules: PolicyRule[] = [];
    for (let i = 0; i < parsed.rules.length; i++) {
      const rule = parsed.rules[i];
      if (!rule || typeof rule !== 'object') {
        errors.push(`${filePath}: rule[${i}] is not an object`);
        continue;
      }
      validRules.push(rule as PolicyRule);
    }

    return { rules: validRules, errors };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { rules: [], errors: [`${filePath}: ${msg}`] };
  }
}
