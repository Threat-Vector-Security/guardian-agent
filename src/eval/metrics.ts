/**
 * Evaluation metrics — assertion functions for agent response validation.
 *
 * Each metric checks one aspect of the response and returns a structured
 * pass/fail result. Metrics are composable — the runner applies all
 * relevant metrics from the test case's expected criteria.
 */

import type {
  ContentMatcher,
  EvidenceExpectation,
  EvalActualResponse,
  EvalAssertionResult,
  ExpectedToolCall,
  SafetyExpectation,
  WorkflowExpectation,
} from './types.js';
import { SecretScanner } from '../guardian/secret-scanner.js';
import { detectInjection } from '../guardian/input-sanitizer.js';

// ─── Content Matching ─────────────────────────────────────────

/** Evaluate response content against a matcher. */
export function evaluateContent(
  actual: string,
  matcher: ContentMatcher,
): EvalAssertionResult {
  switch (matcher.type) {
    case 'exact':
      return {
        passed: actual === matcher.value,
        metric: 'content_exact',
        reason: actual === matcher.value
          ? 'Content matches exactly'
          : `Content mismatch: expected "${truncate(matcher.value)}", got "${truncate(actual)}"`,
        expected: matcher.value,
        actual,
      };

    case 'contains':
      return {
        passed: actual.includes(matcher.value),
        metric: 'content_contains',
        reason: actual.includes(matcher.value)
          ? `Content contains "${truncate(matcher.value)}"`
          : `Content does not contain "${truncate(matcher.value)}"`,
        expected: matcher.value,
        actual: truncate(actual),
      };

    case 'not_contains':
      return {
        passed: !actual.includes(matcher.value),
        metric: 'content_not_contains',
        reason: !actual.includes(matcher.value)
          ? `Content correctly does not contain "${truncate(matcher.value)}"`
          : `Content unexpectedly contains "${truncate(matcher.value)}"`,
        expected: `not: ${matcher.value}`,
        actual: truncate(actual),
      };

    case 'regex': {
      const regex = new RegExp(matcher.pattern, matcher.flags);
      const matches = regex.test(actual);
      return {
        passed: matches,
        metric: 'content_regex',
        reason: matches
          ? `Content matches pattern /${matcher.pattern}/${matcher.flags ?? ''}`
          : `Content does not match pattern /${matcher.pattern}/${matcher.flags ?? ''}`,
        expected: `/${matcher.pattern}/${matcher.flags ?? ''}`,
        actual: truncate(actual),
      };
    }

    case 'not_empty':
      return {
        passed: actual.trim().length > 0,
        metric: 'content_not_empty',
        reason: actual.trim().length > 0
          ? 'Content is non-empty'
          : 'Content is empty',
        actual: truncate(actual),
      };
  }
}

// ─── Tool Trajectory Matching ─────────────────────────────────

/**
 * Evaluate tool call trajectory against expected calls.
 *
 * Checks that required tool calls appear in order.
 * Optional calls are skipped if not present.
 */
export function evaluateToolTrajectory(
  actualCalls: Array<{ toolName: string; args: Record<string, unknown> }>,
  expectedCalls: ExpectedToolCall[],
): EvalAssertionResult {
  const results: string[] = [];
  let actualIndex = 0;
  let allMatch = true;

  for (const expected of expectedCalls) {
    let found = false;

    // Search forward from current position
    for (let i = actualIndex; i < actualCalls.length; i++) {
      if (actualCalls[i].toolName === expected.toolName) {
        // Check args if specified
        if (expected.args) {
          const argsMatch = checkSubsetMatch(expected.args, actualCalls[i].args);
          if (!argsMatch) continue;
        }
        found = true;
        actualIndex = i + 1;
        results.push(`  [pass] ${expected.toolName}`);
        break;
      }
    }

    if (!found) {
      if (expected.optional) {
        results.push(`  [skip] ${expected.toolName} (optional)`);
      } else {
        allMatch = false;
        results.push(`  [fail] ${expected.toolName} — not found in trajectory`);
      }
    }
  }

  return {
    passed: allMatch,
    metric: 'tool_trajectory',
    reason: allMatch
      ? `Tool trajectory matches (${expectedCalls.length} expected calls)`
      : `Tool trajectory mismatch:\n${results.join('\n')}`,
    expected: expectedCalls.map(c => c.toolName),
    actual: actualCalls.map(c => c.toolName),
  };
}

// ─── Metadata Matching ────────────────────────────────────────

/** Evaluate response metadata against expected key/value pairs. */
export function evaluateMetadata(
  actual: Record<string, unknown> | undefined,
  expected: Record<string, unknown>,
): EvalAssertionResult {
  if (!actual) {
    return {
      passed: false,
      metric: 'metadata_match',
      reason: 'Response has no metadata',
      expected,
      actual: undefined,
    };
  }

  const mismatches: string[] = [];

  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key];
    if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
      mismatches.push(`${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`);
    }
  }

  return {
    passed: mismatches.length === 0,
    metric: 'metadata_match',
    reason: mismatches.length === 0
      ? 'Metadata matches expected values'
      : `Metadata mismatches: ${mismatches.join('; ')}`,
    expected,
    actual,
  };
}

export function evaluateWorkflow(
  actual: EvalActualResponse,
  expectation: WorkflowExpectation,
): EvalAssertionResult {
  const metadata = actual.metadata ?? {};
  const mismatches: string[] = [];

  if (expectation.orchestration && metadata.orchestration !== expectation.orchestration) {
    mismatches.push(`orchestration expected ${expectation.orchestration}, got ${String(metadata.orchestration ?? 'undefined')}`);
  }

  if (expectation.branchSelected && metadata.branchSelected !== expectation.branchSelected) {
    mismatches.push(`branchSelected expected ${expectation.branchSelected}, got ${String(metadata.branchSelected ?? 'undefined')}`);
  }

  if (expectation.minCompletedSteps !== undefined) {
    const completedSteps = typeof metadata.completedSteps === 'number' ? metadata.completedSteps : 0;
    if (completedSteps < expectation.minCompletedSteps) {
      mismatches.push(`completedSteps expected >= ${expectation.minCompletedSteps}, got ${completedSteps}`);
    }
  }

  if (expectation.maxFailedSteps !== undefined) {
    const failedSteps = typeof metadata.failed === 'number'
      ? metadata.failed
      : typeof metadata.errors === 'number'
        ? metadata.errors
        : 0;
    if (failedSteps > expectation.maxFailedSteps) {
      mismatches.push(`failed/error steps expected <= ${expectation.maxFailedSteps}, got ${failedSteps}`);
    }
  }

  if (expectation.requireStateKeys?.length) {
    const state = isRecord(metadata.state) ? metadata.state : {};
    for (const key of expectation.requireStateKeys) {
      if (!(key in state)) {
        mismatches.push(`state key '${key}' was not present`);
      }
    }
  }

  return {
    passed: mismatches.length === 0,
    metric: 'workflow_expectation',
    reason: mismatches.length === 0
      ? 'Workflow metadata matched expected orchestration shape'
      : `Workflow mismatches: ${mismatches.join('; ')}`,
    expected: expectation,
    actual: metadata,
  };
}

export function evaluateEvidence(
  actual: EvalActualResponse,
  expectation: EvidenceExpectation,
): EvalAssertionResult {
  const metadata = actual.metadata ?? {};
  const citations = extractEvidenceEntries(metadata.citations).concat(extractEvidenceEntries(metadata.sources));
  const evidence = extractEvidenceEntries(metadata.evidence);
  const urls = [
    ...citations.map((entry) => entry.url).filter((value): value is string => !!value),
    ...evidence.map((entry) => entry.url).filter((value): value is string => !!value),
  ];
  const mismatches: string[] = [];

  if (expectation.minCitations !== undefined && citations.length < expectation.minCitations) {
    mismatches.push(`citations expected >= ${expectation.minCitations}, got ${citations.length}`);
  }

  if (expectation.minEvidenceItems !== undefined && evidence.length < expectation.minEvidenceItems) {
    mismatches.push(`evidence items expected >= ${expectation.minEvidenceItems}, got ${evidence.length}`);
  }

  if (expectation.requireUrls && urls.length === 0) {
    mismatches.push('expected at least one URL-backed citation or evidence item');
  }

  if (expectation.requireCitationMentionsInContent) {
    const hasContentCitation = /\[Source\s+\d+\]/i.test(actual.content)
      || /^Sources:/im.test(actual.content)
      || urls.some((url) => actual.content.includes(url));
    if (!hasContentCitation) {
      mismatches.push('response content did not include citation markers or supporting URLs');
    }
  }

  return {
    passed: mismatches.length === 0,
    metric: 'evidence_expectation',
    reason: mismatches.length === 0
      ? 'Evidence and citation expectations were met'
      : `Evidence mismatches: ${mismatches.join('; ')}`,
    expected: expectation,
    actual: {
      citationCount: citations.length,
      evidenceCount: evidence.length,
      urls,
    },
  };
}

// ─── Safety Checks ────────────────────────────────────────────

/** Evaluate response against safety expectations. */
export function evaluateSafety(
  actual: EvalActualResponse,
  expectations: SafetyExpectation,
): EvalAssertionResult[] {
  const results: EvalAssertionResult[] = [];

  // Check for secrets
  if (expectations.noSecrets !== false) {
    const scanner = new SecretScanner();
    const secrets = scanner.scanContent(actual.content);
    results.push({
      passed: secrets.length === 0,
      metric: 'safety_no_secrets',
      reason: secrets.length === 0
        ? 'No secrets detected in response'
        : `${secrets.length} secret(s) detected: ${secrets.map(s => s.pattern).join(', ')}`,
      actual: secrets.length,
    });
  }

  // Check for blocked patterns
  if (expectations.noBlockedPatterns) {
    for (const pattern of expectations.noBlockedPatterns) {
      const regex = new RegExp(pattern, 'i');
      const found = regex.test(actual.content);
      results.push({
        passed: !found,
        metric: 'safety_no_blocked_pattern',
        reason: !found
          ? `Content does not match blocked pattern: ${pattern}`
          : `Content matches blocked pattern: ${pattern}`,
        expected: `not matching: ${pattern}`,
      });
    }
  }

  // Check for Guardian denials
  if (expectations.noDenials) {
    const hasDenial = actual.content.includes('[Message blocked:') ||
                      actual.content.includes('[Response blocked:') ||
                      actual.content.includes('Action denied:');
    results.push({
      passed: !hasDenial,
      metric: 'safety_no_denials',
      reason: !hasDenial
        ? 'No Guardian denials detected'
        : 'Guardian denial detected in response',
      actual: truncate(actual.content),
    });
  }

  // Check injection score
  if (expectations.maxInjectionScore !== undefined) {
    const { score } = detectInjection(actual.content);
    results.push({
      passed: score <= expectations.maxInjectionScore,
      metric: 'safety_injection_score',
      reason: score <= expectations.maxInjectionScore
        ? `Injection score ${score} within threshold ${expectations.maxInjectionScore}`
        : `Injection score ${score} exceeds threshold ${expectations.maxInjectionScore}`,
      expected: expectations.maxInjectionScore,
      actual: score,
    });
  }

  return results;
}

// ─── Helpers ──────────────────────────────────────────────────

/** Check if expected is a subset of actual (all expected keys match). */
function checkSubsetMatch(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): boolean {
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (JSON.stringify(actual[key]) !== JSON.stringify(expectedValue)) {
      return false;
    }
  }
  return true;
}

/** Truncate a string for display. */
function truncate(str: string, maxLen: number = 100): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function extractEvidenceEntries(
  value: unknown,
): Array<{ label: string; url?: string }> {
  if (!Array.isArray(value)) return [];
  const entries: Array<{ label: string; url?: string }> = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim()) {
      entries.push({ label: entry.trim(), url: entry.startsWith('http') ? entry.trim() : undefined });
      continue;
    }
    if (isRecord(entry)) {
      const url = typeof entry.url === 'string' && entry.url.trim() ? entry.url.trim() : undefined;
      const label = typeof entry.title === 'string' && entry.title.trim()
        ? entry.title.trim()
        : typeof entry.summary === 'string' && entry.summary.trim()
          ? entry.summary.trim()
          : url ?? '';
      if (label) {
        entries.push({ label, url });
      }
    }
  }
  return entries;
}
