import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { URL } from 'node:url';

import { DEFAULT_HARNESS_OLLAMA_MODEL, resolveHarnessOllamaModel } from './ollama-harness-defaults.mjs';

const DEFAULT_CLOUD_CREDENTIAL_REF = 'llm.ollama_cloud.primary';

export function readHarnessOllamaEnvOptions() {
  const harnessApiKey = process.env.HARNESS_OLLAMA_API_KEY?.trim() || '';
  return {
    ollamaBaseUrl: process.env.HARNESS_OLLAMA_BASE_URL?.trim() || '',
    ollamaModel: process.env.HARNESS_OLLAMA_MODEL?.trim() || '',
    ollamaApiKey: harnessApiKey || process.env.OLLAMA_API_KEY?.trim() || '',
    ollamaApiKeyEnv: harnessApiKey ? 'HARNESS_OLLAMA_API_KEY' : 'OLLAMA_API_KEY',
    wslHostIp: process.env.HARNESS_WSL_HOST_IP?.trim() || '',
    ollamaBin: process.env.HARNESS_OLLAMA_BIN?.trim() || '',
    autostartLocalOllama: process.env.HARNESS_AUTOSTART_LOCAL_OLLAMA !== '0',
    bypassLocalModelComplexityGuard: process.env.HARNESS_BYPASS_LOCAL_MODEL_COMPLEXITY_GUARD !== '0',
  };
}

export function normalizeHarnessOllamaBaseUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/$/, '').replace(/\/(?:api|v1)\/?$/i, '');
}

export function isOllamaCloudBaseUrl(candidate) {
  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.trim().toLowerCase();
    return hostname === 'ollama.com' || hostname.endsWith('.ollama.com');
  } catch {
    return false;
  }
}

export function getHarnessProviderConfig(
  provider,
  {
    localProfileName = 'local',
    cloudProfileName = 'managedCloud',
    cloudCredentialRef = DEFAULT_CLOUD_CREDENTIAL_REF,
  } = {},
) {
  const isCloud = provider.providerType === 'ollama_cloud';
  return {
    profileName: isCloud ? cloudProfileName : localProfileName,
    credentialRef: isCloud ? cloudCredentialRef : undefined,
    credentialEnv: isCloud ? provider.credentialEnv || 'OLLAMA_API_KEY' : undefined,
    llmEntry: {
      provider: provider.providerType,
      baseUrl: provider.baseUrl,
      model: provider.model,
      ...(isCloud ? { credentialRef: cloudCredentialRef } : {}),
    },
    credentialRefs: isCloud
      ? {
          [cloudCredentialRef]: {
            source: 'env',
            env: provider.credentialEnv || 'OLLAMA_API_KEY',
          },
        }
      : {},
  };
}

export function createOllamaHarnessChatResponse({
  model,
  content = '',
  doneReason = 'stop',
  toolCalls,
}) {
  return {
    model,
    created_at: new Date().toISOString(),
    message: {
      role: 'assistant',
      content,
      ...(toolCalls?.length
        ? {
            tool_calls: toolCalls.map((toolCall) => ({
              function: {
                name: toolCall.name,
                arguments: parseToolArguments(toolCall.arguments),
              },
            })),
          }
        : {}),
    },
    done: true,
    done_reason: doneReason,
    prompt_eval_count: 1,
    eval_count: 1,
  };
}

function parseToolArguments(input) {
  try {
    return JSON.parse(String(input || '{}'));
  } catch {
    return { __raw: String(input || '') };
  }
}

function collectOllamaBaseUrlCandidates(options) {
  const explicitBaseUrl = normalizeHarnessOllamaBaseUrl(options.ollamaBaseUrl);
  if (explicitBaseUrl) {
    return [explicitBaseUrl];
  }

  const candidates = [];
  const push = (value) => {
    const normalized = normalizeHarnessOllamaBaseUrl(value);
    if (!normalized || candidates.includes(normalized)) return;
    candidates.push(normalized);
  };

  push('http://127.0.0.1:11434');
  push('http://localhost:11434');
  push(options.wslHostIp ? `http://${options.wslHostIp}:11434` : '');

  try {
    const resolv = fs.readFileSync('/etc/resolv.conf', 'utf-8');
    const match = resolv.match(/^nameserver\s+([0-9.]+)\s*$/m);
    if (match?.[1]) {
      push(`http://${match[1]}:11434`);
    }
  } catch {
    // Ignore.
  }

  return candidates;
}

function isLoopbackOllamaUrl(candidate) {
  try {
    const parsed = new URL(candidate);
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

async function requestJsonWithOptionalAuth(url, { method = 'GET', body, timeoutMs = 2_500, apiKey } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    const parsed = text ? safeParseJson(text) : {};
    if (!response.ok) {
      const detail = typeof parsed === 'string'
        ? parsed.replace(/\s+/g, ' ').trim()
        : JSON.stringify(parsed);
      throw new Error(detail ? `HTTP ${response.status}: ${detail}` : `HTTP ${response.status}`);
    }
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function canReachOllama(candidate, apiKey) {
  const result = await requestJsonWithOptionalAuth(
    `${normalizeHarnessOllamaBaseUrl(candidate)}/api/tags`,
    { apiKey },
  );
  return Array.isArray(result?.models) ? result.models : [];
}

async function maybeStartLocalOllama(options, candidate, logPrefix) {
  if (!options.autostartLocalOllama || !isLoopbackOllamaUrl(candidate)) {
    return null;
  }

  const homeDir = os.homedir();
  const binCandidates = [
    options.ollamaBin,
    path.join(homeDir, '.local', 'bin', 'ollama'),
    'ollama',
  ].filter(Boolean);

  let ollamaBin = '';
  for (const candidateBin of binCandidates) {
    try {
      const result = spawn(candidateBin, ['--version'], { stdio: 'ignore' });
      const exitCode = await new Promise((resolve) => {
        result.on('exit', resolve);
        result.on('error', () => resolve(-1));
      });
      if (exitCode === 0) {
        ollamaBin = candidateBin;
        break;
      }
    } catch {
      // Try next candidate.
    }
  }

  if (!ollamaBin) {
    return null;
  }

  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), logPrefix));
  const logPath = path.join(logDir, 'ollama.log');
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  const processHandle = spawn(ollamaBin, ['serve'], {
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NO_COLOR: '1',
    },
  });
  processHandle.stdout.pipe(logStream);
  processHandle.stderr.pipe(logStream);

  const shutdown = async () => {
    if (!processHandle.killed) {
      if (process.platform === 'win32') {
        processHandle.kill('SIGTERM');
      } else {
        process.kill(-processHandle.pid, 'SIGTERM');
      }
    }
    logStream.end();
  };

  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await canReachOllama(candidate);
      return { close: shutdown, logPath };
    } catch {
      if (processHandle.exitCode !== null) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  await shutdown();
  throw new Error(`Failed to autostart local Ollama at ${candidate}. See ${logPath}`);
}

export async function resolveRealOllamaProvider(options, { logPrefix = 'guardian-ollama-' } = {}) {
  const candidates = collectOllamaBaseUrlCandidates(options);
  const errors = [];
  let localOllama = null;

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeHarnessOllamaBaseUrl(candidate);
    const isCloud = isOllamaCloudBaseUrl(normalizedCandidate);
    try {
      if (isCloud && !options.ollamaApiKey) {
        throw new Error('Ollama Cloud requires OLLAMA_API_KEY or HARNESS_OLLAMA_API_KEY.');
      }

      let models;
      try {
        models = await canReachOllama(normalizedCandidate, isCloud ? options.ollamaApiKey : undefined);
      } catch (error) {
        if (!localOllama) {
          localOllama = await maybeStartLocalOllama(options, normalizedCandidate, logPrefix);
          if (localOllama) {
            models = await canReachOllama(normalizedCandidate);
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }

      const resolvedModel = resolveHarnessOllamaModel(options.ollamaModel, models);
      if (!resolvedModel) {
        throw new Error(
          isCloud
            ? `No models available at ${normalizedCandidate}. Verify Ollama Cloud model access or set HARNESS_OLLAMA_MODEL first.`
            : `No models available at ${normalizedCandidate}. Pull ${DEFAULT_HARNESS_OLLAMA_MODEL} or set HARNESS_OLLAMA_MODEL first.`,
        );
      }

      return {
        baseUrl: normalizedCandidate,
        model: resolvedModel,
        mode: 'real_ollama',
        providerType: isCloud ? 'ollama_cloud' : 'ollama',
        credentialEnv: isCloud ? options.ollamaApiKeyEnv || 'OLLAMA_API_KEY' : undefined,
        async close() {
          if (localOllama) {
            await localOllama.close();
          }
        },
      };
    } catch (error) {
      errors.push(`${normalizedCandidate} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(
    [
      'Real Ollama mode was requested, but no reachable Ollama endpoint was found.',
      options.ollamaBaseUrl
        ? 'Verify HARNESS_OLLAMA_BASE_URL points at the exact endpoint you want the harness to use.'
        : 'Set HARNESS_OLLAMA_BASE_URL to a reachable endpoint or install Ollama locally in WSL so the harness can autostart it on 127.0.0.1:11434.',
      'If you intend to reach Windows-hosted Ollama from WSL, expose it on the Windows host IP and allow it through the firewall.',
      'If you intend to use Ollama Cloud, export OLLAMA_API_KEY (or HARNESS_OLLAMA_API_KEY) in the same WSL shell before running the harness.',
      `Tried: ${errors.join(' | ')}`,
    ].join(' '),
  );
}
