/**
 * Output guardian — scans and redacts secrets from outbound content.
 *
 * Layer 2 defense: intercepts LLM responses, agent outputs, and event
 * payloads before they reach users. Redacts detected secrets instead
 * of blocking entirely, so users get useful responses.
 */

import { SecretScanner } from './secret-scanner.js';
import type { SecretMatch } from './secret-scanner.js';

/** Result of scanning outbound content. */
export interface ScanResult {
  /** Whether content is clean (no secrets found). */
  clean: boolean;
  /** Detected secrets. */
  secrets: SecretMatch[];
  /** Content with secrets redacted (if any found). */
  sanitized: string;
}

/**
 * Output guardian for scanning and redacting secrets in outbound content.
 *
 * Reuses SecretScanner for pattern matching, but adds redaction logic.
 * Replaces detected secrets with '[REDACTED]' markers.
 */
export class OutputGuardian {
  private scanner: SecretScanner;

  constructor(additionalPatterns?: string[]) {
    this.scanner = new SecretScanner(additionalPatterns);
  }

  /** Scan outbound content. Returns cleaned content + any detected secrets. */
  scanResponse(content: string): ScanResult {
    const secrets = this.scanner.scanContent(content);
    if (secrets.length === 0) {
      return { clean: true, secrets: [], sanitized: content };
    }

    // Redact secrets from response using rawMatch
    // Sort by offset descending to replace from end first (preserves earlier offsets)
    const sorted = [...secrets].sort((a, b) => b.offset - a.offset);
    let sanitized = content;
    for (const secret of sorted) {
      const before = sanitized.slice(0, secret.offset);
      const after = sanitized.slice(secret.offset + secret.rawMatch.length);
      sanitized = before + '[REDACTED]' + after;
    }

    return { clean: false, secrets, sanitized };
  }

  /** Scan a serialized event payload for secrets. */
  scanPayload(payload: unknown): SecretMatch[] {
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return this.scanner.scanContent(serialized);
  }

  /** Scan arbitrary content string for secrets. */
  scanContent(content: string): SecretMatch[] {
    return this.scanner.scanContent(content);
  }
}
