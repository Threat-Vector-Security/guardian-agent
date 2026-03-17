import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function requestJson(baseUrl, token, method, pathname, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${baseUrl}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function requestJsonNoAuth(url, method, body, timeoutMs = 2_500) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      method,
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname + parsed.search,
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch {
          resolve(data);
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error(`Timed out connecting to ${url}`)));
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function getFreePort() {
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Failed to allocate free port');
  }
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  return address.port;
}

async function waitForHealth(baseUrl) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const health = await requestJson(baseUrl, 'unused', 'GET', '/health');
      if (health?.status === 'ok') {
        return;
      }
    } catch {
      // Retry until ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('GuardianAgent did not become healthy within 30 seconds.');
}

function createChatCompletionResponse({ model, content = '', finishReason = 'stop', toolCalls }) {
  const message = {
    role: 'assistant',
    content,
  };
  if (toolCalls?.length) {
    message.tool_calls = toolCalls.map((toolCall) => ({
      id: toolCall.id,
      type: 'function',
      function: {
        name: toolCall.name,
        arguments: toolCall.arguments,
      },
    }));
  }
  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message,
      finish_reason: finishReason,
    }],
    usage: {
      prompt_tokens: 1,
      completion_tokens: 1,
      total_tokens: 2,
    },
  };
}

function parseHarnessOptions() {
  const args = new Set(process.argv.slice(2));
  return {
    useRealOllama: args.has('--use-ollama') || process.env.HARNESS_USE_REAL_OLLAMA === '1',
    ollamaBaseUrl: process.env.HARNESS_OLLAMA_BASE_URL?.trim() || '',
    ollamaModel: process.env.HARNESS_OLLAMA_MODEL?.trim() || '',
    wslHostIp: process.env.HARNESS_WSL_HOST_IP?.trim() || '',
    ollamaBin: process.env.HARNESS_OLLAMA_BIN?.trim() || '',
    autostartLocalOllama: process.env.HARNESS_AUTOSTART_LOCAL_OLLAMA !== '0',
  };
}

function collectOllamaBaseUrlCandidates(options) {
  const candidates = [];
  const push = (value) => {
    const trimmed = value?.trim();
    if (!trimmed || candidates.includes(trimmed)) return;
    candidates.push(trimmed.replace(/\/$/, ''));
  };

  push(options.ollamaBaseUrl);
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

async function canReachOllama(candidate) {
  const result = await requestJsonNoAuth(`${candidate}/api/tags`, 'GET', undefined);
  const models = Array.isArray(result?.models) ? result.models : [];
  return models;
}

async function maybeStartLocalOllama(options, candidate) {
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

  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-coding-ollama-'));
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
      if (processHandle.exitCode !== null) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  await shutdown();
  throw new Error(`Failed to autostart local Ollama at ${candidate}. See ${logPath}`);
}

async function startFakeProvider(workspaceRoot, scenarioLog) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (req.method === 'GET' && url.pathname === '/api/tags') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models: [{ name: 'coding-harness-model', size: 1 }] }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
      const parsed = await readJsonBody(req);
      const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
      const tools = Array.isArray(parsed.tools)
        ? parsed.tools.map((tool) => String(tool?.function?.name ?? '')).filter(Boolean)
        : [];
      const toolMessages = messages.filter((message) => message.role === 'tool');
      const latestUser = String([...messages].reverse().find((message) => message.role === 'user')?.content ?? '');

      scenarioLog.push({
        latestUser,
        tools,
        toolMessages: toolMessages.map((message) => String(message.content ?? '')),
      });

      if (latestUser.includes('[Code Workspace Context]') && latestUser.includes('answerValue')) {
        if (toolMessages.length === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(createChatCompletionResponse({
            model: 'coding-harness-model',
            finishReason: 'tool_calls',
            toolCalls: [{
              id: 'code-find-tools',
              name: 'find_tools',
              arguments: JSON.stringify({
                query: 'coding code edit create git diff test build lint symbol',
                maxResults: 10,
              }),
            }],
          })));
          return;
        }

        if (toolMessages.length === 1) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(createChatCompletionResponse({
            model: 'coding-harness-model',
            finishReason: 'tool_calls',
            toolCalls: [{
              id: 'code-symbol-search',
              name: 'code_symbol_search',
              arguments: JSON.stringify({
                path: workspaceRoot,
                query: 'answerValue',
                mode: 'auto',
                maxResults: 5,
              }),
            }],
          })));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(createChatCompletionResponse({
          model: 'coding-harness-model',
          content: 'I found `answerValue` in `src/example.ts` inside the active coding workspace.',
        })));
        return;
      }

      if (latestUser.includes('[Code Workspace Context]') && /git status/i.test(latestUser)) {
        if (toolMessages.length === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(createChatCompletionResponse({
            model: 'coding-harness-model',
            finishReason: 'tool_calls',
            toolCalls: [{
              id: 'code-git-status',
              name: 'shell_safe',
              arguments: JSON.stringify({
                command: 'git status --short',
                cwd: workspaceRoot,
              }),
            }],
          })));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(createChatCompletionResponse({
          model: 'coding-harness-model',
          content: 'Git status ran inside the active coding workspace.',
        })));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(createChatCompletionResponse({
        model: 'coding-harness-model',
        content: 'Coding harness default response.',
      })));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start fake provider');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    model: 'coding-harness-model',
    mode: 'fake',
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

async function resolveHarnessProvider(options, workspaceRoot, scenarioLog) {
  if (!options.useRealOllama) {
    return startFakeProvider(workspaceRoot, scenarioLog);
  }

  const candidates = collectOllamaBaseUrlCandidates(options);
  const errors = [];
  let localOllama = null;
  for (const candidate of candidates) {
    try {
      let models;
      try {
        models = await canReachOllama(candidate);
      } catch (error) {
        if (!localOllama) {
          localOllama = await maybeStartLocalOllama(options, candidate);
          if (localOllama) {
            models = await canReachOllama(candidate);
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
      const resolvedModel = options.ollamaModel || models[0]?.name;
      if (!resolvedModel) {
        throw new Error(`No models available at ${candidate}. Set HARNESS_OLLAMA_MODEL or pull a model first.`);
      }
      return {
        baseUrl: candidate,
        model: resolvedModel,
        mode: 'real_ollama',
        async close() {
          if (localOllama) {
            await localOllama.close();
          }
        },
      };
    } catch (error) {
      errors.push(`${candidate} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(
    [
      'Real Ollama mode was requested, but no reachable Ollama endpoint was found.',
      'Set HARNESS_OLLAMA_BASE_URL to a reachable endpoint or install Ollama locally in WSL so the harness can autostart it on 127.0.0.1:11434.',
      'If you intend to reach Windows-hosted Ollama from WSL, expose it on the Windows host IP and allow it through the firewall.',
      `Tried: ${errors.join(' | ')}`,
    ].join(' '),
  );
}

function setupGitWorkspace(workspaceRoot) {
  const git = (args) => {
    const result = spawnSync('git', args, { cwd: workspaceRoot, encoding: 'utf-8' });
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
    }
  };

  git(['init']);
  git(['config', 'user.email', 'coding-harness@example.com']);
  git(['config', 'user.name', 'Coding Harness']);
  git(['add', '.']);
  git(['commit', '-m', 'Initial harness commit']);
}

async function runHarness() {
  const options = parseHarnessOptions();
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const harnessPort = await getFreePort();
  const harnessToken = `coding-harness-${Date.now()}`;
  const baseUrl = `http://127.0.0.1:${harnessPort}`;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-coding-harness-'));
  const workspaceRoot = path.join(tmpDir, 'workspace');
  const configPath = path.join(tmpDir, 'config.yaml');
  const logPath = path.join(tmpDir, 'guardian.log');
  const scenarioLog = [];

  fs.mkdirSync(path.join(workspaceRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(workspaceRoot, 'src', 'example.ts'), [
    'export function getAnswer() {',
    '  const answerValue = 41;',
    '  return answerValue;',
    '}',
    '',
  ].join('\n'));
  setupGitWorkspace(workspaceRoot);

  const provider = await resolveHarnessProvider(options, workspaceRoot, scenarioLog);
  const config = `
llm:
  local:
    provider: ollama
    baseUrl: ${provider.baseUrl}
    model: ${provider.model}
defaultProvider: local
channels:
  cli:
    enabled: false
  web:
    enabled: true
    host: 127.0.0.1
    port: ${harnessPort}
    authToken: "${harnessToken}"
assistant:
  identity:
    mode: single_user
    primaryUserId: harness
  setup:
    completed: true
  tools:
    enabled: true
    policyMode: approve_by_policy
    allowedPaths:
      - ${workspaceRoot}
    allowedCommands:
      - pwd
      - echo
    agentPolicyUpdates:
      allowedPaths: true
      allowedCommands: false
      allowedDomains: false
runtime:
  agentIsolation:
    enabled: false
guardian:
  enabled: true
`;
  fs.writeFileSync(configPath, config);

  let appProcess;
  try {
    appProcess = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts', configPath], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = fs.createWriteStream(logPath);
    const stderr = fs.createWriteStream(`${logPath}.err`);
    appProcess.stdout.pipe(stdout);
    appProcess.stderr.pipe(stderr);

    await waitForHealth(baseUrl);

    const agents = await requestJson(baseUrl, harnessToken, 'GET', '/api/agents');
    assert.ok(Array.isArray(agents) && agents.length > 0, `Expected /api/agents to return agents: ${JSON.stringify(agents)}`);

    const toolState = await requestJson(baseUrl, harnessToken, 'GET', '/api/tools?limit=20');
    const toolNames = Array.isArray(toolState?.tools) ? toolState.tools.map((tool) => tool.name) : [];
    assert.ok(toolNames.includes('code_edit'), 'Expected code_edit in tool catalog');
    assert.ok(toolNames.includes('code_symbol_search'), 'Expected code_symbol_search in tool catalog');
    const codeSessionMetadata = {
      codeContext: {
        workspaceRoot,
        sessionId: 'web-code-harness',
      },
    };

    const codeEditPending = await requestJson(baseUrl, harnessToken, 'POST', '/api/tools/run', {
      toolName: 'code_edit',
      args: {
        path: path.join(workspaceRoot, 'src', 'example.ts'),
        oldString: 'const answerValue = 41;',
        newString: 'const answerValue = 42;',
      },
      origin: 'web',
      userId: 'web-code-harness',
      channel: 'web',
    });
    assert.equal(codeEditPending.status, 'pending_approval');
    assert.ok(codeEditPending.approvalId, `Expected approvalId from code_edit: ${JSON.stringify(codeEditPending)}`);

    const pendingApprovals = await requestJson(
      baseUrl,
      harnessToken,
      'GET',
      '/api/tools/approvals/pending?userId=web-code-harness&channel=web&limit=10',
    );
    assert.ok(Array.isArray(pendingApprovals) && pendingApprovals.length > 0, 'Expected pending approvals for code session');
    assert.equal(pendingApprovals[0].toolName, 'code_edit');
    assert.equal(pendingApprovals[0].id, codeEditPending.approvalId);

    const codeEditDecision = await requestJson(baseUrl, harnessToken, 'POST', '/api/tools/approvals/decision', {
      approvalId: codeEditPending.approvalId,
      decision: 'approved',
      actor: 'web-code-harness',
    });
    assert.equal(codeEditDecision.success, true);
    assert.match(fs.readFileSync(path.join(workspaceRoot, 'src', 'example.ts'), 'utf-8'), /answerValue = 42/);

    const codeShellPending = await requestJson(baseUrl, harnessToken, 'POST', '/api/tools/run', {
      toolName: 'shell_safe',
      args: {
        command: 'git init nested-repo',
        cwd: workspaceRoot,
      },
      origin: 'web',
      userId: 'web-code-harness',
      channel: 'web',
      metadata: codeSessionMetadata,
    });
    assert.equal(codeShellPending.success, false);
    assert.equal(codeShellPending.status, 'pending_approval');
    assert.ok(codeShellPending.approvalId, `Expected approvalId from shell_safe git init: ${JSON.stringify(codeShellPending)}`);

    const codeShellDecision = await requestJson(baseUrl, harnessToken, 'POST', '/api/tools/approvals/decision', {
      approvalId: codeShellPending.approvalId,
      decision: 'approved',
      actor: 'web-code-harness',
    });
    assert.equal(codeShellDecision.success, true, `Expected approved shell_safe continuation to succeed: ${JSON.stringify(codeShellDecision)}`);
    assert.equal(fs.existsSync(path.join(workspaceRoot, 'nested-repo', '.git')), true);

    const blockedShellEscape = await requestJson(baseUrl, harnessToken, 'POST', '/api/tools/run', {
      toolName: 'shell_safe',
      args: {
        command: 'git -C /tmp status',
        cwd: workspaceRoot,
      },
      origin: 'web',
      userId: 'web-code-harness',
      channel: 'web',
      metadata: codeSessionMetadata,
    });
    assert.equal(blockedShellEscape.success, false);
    assert.equal(blockedShellEscape.status, 'failed');
    assert.match(String(blockedShellEscape.message ?? ''), /denied path|Coding Assistant|blocked/i);

    const autonomousPolicy = await requestJson(baseUrl, harnessToken, 'POST', '/api/tools/policy', {
      mode: 'autonomous',
      sandbox: {
        allowedPaths: [workspaceRoot],
        allowedCommands: ['pwd', 'echo'],
      },
    });
    assert.equal(autonomousPolicy.success, true);

    const codeCreate = await requestJson(baseUrl, harnessToken, 'POST', '/api/tools/run', {
      toolName: 'code_create',
      args: {
        path: path.join(workspaceRoot, 'src', 'generated.ts'),
        content: 'export const generatedValue = 7;\n',
      },
      origin: 'web',
      userId: 'web-code-harness',
      channel: 'web',
    });
    assert.equal(codeCreate.success, true);
    assert.equal(fs.existsSync(path.join(workspaceRoot, 'src', 'generated.ts')), true);

    const codeSearch = await requestJson(baseUrl, harnessToken, 'POST', '/api/tools/run', {
      toolName: 'code_symbol_search',
      args: {
        path: workspaceRoot,
        query: 'answerValue',
        mode: 'auto',
        maxResults: 5,
      },
      origin: 'web',
      userId: 'web-code-harness',
      channel: 'web',
    });
    assert.equal(codeSearch.success, true);
    assert.ok(Array.isArray(codeSearch.output?.matches) && codeSearch.output.matches.some((match) => match.relativePath === 'src/example.ts'));

    const codeDiff = await requestJson(baseUrl, harnessToken, 'POST', '/api/tools/run', {
      toolName: 'code_git_diff',
      args: {
        cwd: workspaceRoot,
        path: 'src/example.ts',
      },
      origin: 'web',
      userId: 'web-code-harness',
      channel: 'web',
      metadata: codeSessionMetadata,
    });
    assert.equal(codeDiff.success, true);
    assert.match(String(codeDiff.output?.stdout ?? ''), /answerValue = 42/);

    const toolsStateBeforeMessage = await requestJson(baseUrl, harnessToken, 'GET', '/api/tools?limit=40');
    const previousJobIds = new Set(
      (Array.isArray(toolsStateBeforeMessage?.jobs) ? toolsStateBeforeMessage.jobs : [])
        .map((job) => job?.id)
        .filter(Boolean),
    );

    const messageResponse = await requestJson(baseUrl, harnessToken, 'POST', '/api/message', {
      content: [
        '[Code Workspace Context]',
        `workspaceRoot: ${workspaceRoot}`,
        `selectedFile: ${path.join(workspaceRoot, 'src', 'example.ts')}`,
        'activeTerminal: Agent',
        'Use coding tools when appropriate. If coding tools are not visible, call find_tools with query "coding code edit create git diff test build lint symbol".',
        `When running shell commands, use cwd="${workspaceRoot}".`,
        '',
        'Search the workspace for answerValue and tell me where it is defined.',
      ].join('\n'),
      userId: 'web-code-harness',
      channel: 'web',
      metadata: codeSessionMetadata,
    });
    assert.ok(String(messageResponse.content ?? '').trim().length > 0, `Expected non-empty coding response: ${JSON.stringify(messageResponse)}`);
    if (provider.mode === 'fake') {
      assert.match(String(messageResponse.content ?? ''), /answerValue/);
      assert.match(String(messageResponse.content ?? ''), /src\/example\.ts/);
    }

    const toolsStateAfter = await requestJson(baseUrl, harnessToken, 'GET', '/api/tools?limit=40');
    const recentJobs = Array.isArray(toolsStateAfter?.jobs) ? toolsStateAfter.jobs : [];
    const newJobs = recentJobs.filter((job) => job?.id && !previousJobIds.has(job.id));

    if (provider.mode === 'fake') {
      assert.ok(newJobs.some((job) => job.toolName === 'find_tools'), 'Expected find_tools job from coding message flow');
      assert.ok(newJobs.some((job) => job.toolName === 'code_symbol_search'), 'Expected code_symbol_search job from coding message flow');
      const toolListsSeen = scenarioLog.map((entry) => entry.tools);
      assert.ok(toolListsSeen.some((tools) => tools.includes('find_tools')), 'Expected find_tools in model tool lists');
    } else {
      const acceptableToolNames = new Set(['find_tools', 'code_symbol_search', 'fs_search', 'fs_read', 'shell_safe']);
      assert.ok(
        newJobs.some((job) => acceptableToolNames.has(job.toolName)),
        `Expected a coding search/read tool call from the real-model message flow, got ${JSON.stringify(newJobs)}`,
      );
    }

    const toolsStateBeforeGitMessage = await requestJson(baseUrl, harnessToken, 'GET', '/api/tools?limit=40');
    const previousGitMessageJobIds = new Set(
      (Array.isArray(toolsStateBeforeGitMessage?.jobs) ? toolsStateBeforeGitMessage.jobs : [])
        .map((job) => job?.id)
        .filter(Boolean),
    );

    const gitStatusResponse = await requestJson(baseUrl, harnessToken, 'POST', '/api/message', {
      content: [
        '[Code Workspace Context]',
        `workspaceRoot: ${workspaceRoot}`,
        `selectedFile: ${path.join(workspaceRoot, 'src', 'example.ts')}`,
        '',
        'Run git status for this coding workspace and summarize it briefly.',
      ].join('\n'),
      userId: 'web-code-harness',
      channel: 'web',
      metadata: codeSessionMetadata,
    });
    assert.ok(String(gitStatusResponse.content ?? '').trim().length > 0, `Expected non-empty git status response: ${JSON.stringify(gitStatusResponse)}`);

    const toolsStateAfterGitMessage = await requestJson(baseUrl, harnessToken, 'GET', '/api/tools?limit=40');
    const newGitJobs = (Array.isArray(toolsStateAfterGitMessage?.jobs) ? toolsStateAfterGitMessage.jobs : [])
      .filter((job) => job?.id && !previousGitMessageJobIds.has(job.id));

    if (provider.mode === 'fake') {
      assert.ok(newGitJobs.some((job) => job.toolName === 'shell_safe'), 'Expected shell_safe job from git status coding message flow');
      assert.match(String(gitStatusResponse.content ?? ''), /Git status/i);
    }

    console.log(`PASS coding assistant harness (${provider.mode})`);
  } finally {
    if (appProcess && !appProcess.killed) {
      appProcess.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!appProcess.killed) {
        appProcess.kill('SIGKILL');
      }
    }
    await provider.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runHarness()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('FAIL coding assistant harness');
    console.error(err);
    process.exit(1);
  });
