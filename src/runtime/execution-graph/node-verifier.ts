import type { ExecutionArtifact } from './graph-artifacts.js';
import {
  buildVerificationResultArtifact,
  type MutationReceiptContent,
  type VerificationCheckRecord,
  type VerificationResultContent,
  type WriteSpecContent,
} from './graph-artifacts.js';

export function buildWriteMutationVerificationArtifact(input: {
  graphId: string;
  nodeId: string;
  artifactId?: string;
  writeSpec: ExecutionArtifact<WriteSpecContent>;
  receipt: ExecutionArtifact<MutationReceiptContent>;
  readBackResult?: Record<string, unknown> | null;
  createdAt: number;
}): ExecutionArtifact<VerificationResultContent> {
  return buildVerificationResultArtifact({
    graphId: input.graphId,
    nodeId: input.nodeId,
    artifactId: input.artifactId,
    subjectArtifactId: input.receipt.artifactId,
    checks: verifyWriteMutationArtifacts(input),
    createdAt: input.createdAt,
  });
}

export function verifyWriteMutationArtifacts(input: {
  writeSpec: ExecutionArtifact<WriteSpecContent>;
  receipt: ExecutionArtifact<MutationReceiptContent>;
  readBackResult?: Record<string, unknown> | null;
}): VerificationCheckRecord[] {
  const checks: VerificationCheckRecord[] = [];

  checks.push({
    name: 'receipt_matches_write_spec',
    status: input.receipt.content.writeSpecArtifactId === input.writeSpec.artifactId
      && input.receipt.content.path === input.writeSpec.content.path
      && input.receipt.content.contentHash === input.writeSpec.content.contentHash
      ? 'passed'
      : 'failed',
    ...(input.receipt.content.writeSpecArtifactId !== input.writeSpec.artifactId
      ? { reason: 'Mutation receipt does not reference the consumed WriteSpec artifact.' }
      : input.receipt.content.path !== input.writeSpec.content.path
        ? { reason: 'Mutation receipt path differs from the WriteSpec path.' }
        : input.receipt.content.contentHash !== input.writeSpec.content.contentHash
          ? { reason: 'Mutation receipt content hash differs from the WriteSpec content hash.' }
          : {}),
  });

  checks.push({
    name: 'tool_receipt_succeeded',
    status: input.receipt.content.success === true && input.receipt.content.status === 'succeeded' ? 'passed' : 'failed',
    ...(input.receipt.content.success === true && input.receipt.content.status === 'succeeded'
      ? {}
      : { reason: input.receipt.content.error || input.receipt.content.message || `Tool status was ${input.receipt.content.status}.` }),
  });

  if (!input.writeSpec.content.append) {
    checks.push({
      name: 'receipt_size_matches_content',
      status: input.receipt.content.size === undefined || input.receipt.content.size === input.writeSpec.content.contentBytes
        ? 'passed'
        : 'failed',
      ...(input.receipt.content.size === undefined || input.receipt.content.size === input.writeSpec.content.contentBytes
        ? {}
        : { reason: `Receipt size ${input.receipt.content.size} did not match WriteSpec byte length ${input.writeSpec.content.contentBytes}.` }),
    });
  } else {
    checks.push({
      name: 'receipt_size_matches_content',
      status: 'skipped',
      reason: 'Append writes cannot infer final file size from the appended content alone.',
    });
  }

  if (input.readBackResult) {
    checks.push(verifyReadBackContent(input.writeSpec, input.readBackResult));
  } else {
    checks.push({
      name: 'readback_content_matches_write_spec',
      status: 'skipped',
      reason: 'No read-back result was supplied.',
    });
  }

  return checks;
}

function verifyReadBackContent(
  writeSpec: ExecutionArtifact<WriteSpecContent>,
  readBackResult: Record<string, unknown>,
): VerificationCheckRecord {
  if (readBackResult.success !== true) {
    return {
      name: 'readback_content_matches_write_spec',
      status: 'failed',
      reason: stringValue(readBackResult.error) || stringValue(readBackResult.message) || 'Read-back tool call failed.',
    };
  }
  const output = recordValue(readBackResult.output);
  if (!output || typeof output.content !== 'string') {
    return {
      name: 'readback_content_matches_write_spec',
      status: 'failed',
      reason: 'Read-back result did not include file content.',
    };
  }
  if (output.truncated === true) {
    return {
      name: 'readback_content_matches_write_spec',
      status: 'failed',
      reason: 'Read-back content was truncated before verification.',
    };
  }
  const matches = writeSpec.content.append
    ? output.content.endsWith(writeSpec.content.content)
    : output.content === writeSpec.content.content;
  return {
    name: 'readback_content_matches_write_spec',
    status: matches ? 'passed' : 'failed',
    ...(matches ? {} : { reason: 'Read-back content did not match the WriteSpec content.' }),
  };
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
