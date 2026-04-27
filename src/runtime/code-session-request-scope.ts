import { posix as posixPath, win32 as win32Path } from 'node:path';

import type { IntentGatewayDecision } from './intent-gateway.js';
import {
  isRawCredentialDisclosureRequest,
  looksLikeSelfContainedDirectAnswerTurn,
} from './intent/request-patterns.js';
import { extractPathHint } from './search-intent.js';

interface RequestedCodeContextLike {
  sessionId?: string;
  workspaceRoot?: string;
}

interface ResolvedCodeSessionLike {
  session: {
    resolvedRoot: string;
  };
  attachment?: {
    channel: string;
    surfaceId: string;
  };
}

interface ShouldAttachCodeSessionForRequestInput {
  content: string;
  channel?: string;
  surfaceId?: string;
  requestedCodeContext?: RequestedCodeContextLike;
  resolvedCodeSession?: ResolvedCodeSessionLike | null;
  gatewayDecision?: Pick<IntentGatewayDecision, 'route' | 'requiresRepoGrounding'> | null;
}

function usesWindowsPath(value: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(value) || value.includes('\\');
}

function isPathInsideRoot(candidatePath: string, rootPath: string): boolean {
  const pathApi = usesWindowsPath(candidatePath) || usesWindowsPath(rootPath)
    ? win32Path
    : posixPath;
  const resolvedCandidate = pathApi.resolve(candidatePath);
  const resolvedRoot = pathApi.resolve(rootPath);
  const relativePath = pathApi.relative(resolvedRoot, resolvedCandidate);
  return relativePath === ''
    || (!relativePath.startsWith('..') && !pathApi.isAbsolute(relativePath));
}

function isSharedAttachment(
  resolvedCodeSession: ResolvedCodeSessionLike | null | undefined,
  channel: string | undefined,
  surfaceId: string | undefined,
): boolean {
  const attachment = resolvedCodeSession?.attachment;
  if (!attachment) return false;
  if (!channel || !surfaceId) return false;
  return attachment.channel !== channel || attachment.surfaceId !== surfaceId;
}

function hasExplicitPathOutsideWorkspace(
  content: string,
  workspaceRoot: string | undefined,
): boolean {
  if (!workspaceRoot) return false;
  const explicitPath = extractPathHint(content);
  if (!explicitPath) return false;
  return !isPathInsideRoot(explicitPath, workspaceRoot);
}

function isSelfContainedNonWorkspaceRequest(content: string): boolean {
  return looksLikeSelfContainedDirectAnswerTurn(content)
    || isRawCredentialDisclosureRequest(content);
}

export function shouldAttachCodeSessionForRequest(
  input: ShouldAttachCodeSessionForRequestInput,
): boolean {
  if (!input.resolvedCodeSession) return false;
  const gatewayDecision = input.gatewayDecision;
  if (gatewayDecision?.route === 'coding_session_control') {
    return false;
  }
  if (input.requestedCodeContext?.sessionId || input.requestedCodeContext?.workspaceRoot) {
    return true;
  }
  if (isSelfContainedNonWorkspaceRequest(input.content)) {
    return false;
  }

  const workspaceRoot = input.resolvedCodeSession.session.resolvedRoot?.trim();
  const sharedAttachment = isSharedAttachment(input.resolvedCodeSession, input.channel, input.surfaceId);
  if (hasExplicitPathOutsideWorkspace(input.content, workspaceRoot)) {
    return false;
  }

  if (!gatewayDecision) {
    return !sharedAttachment;
  }
  if (gatewayDecision.requiresRepoGrounding) {
    return true;
  }
  if (gatewayDecision.route === 'coding_task') {
    return true;
  }
  if (gatewayDecision.route === 'filesystem_task') {
    return true;
  }
  return false;
}
