import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import yaml from 'js-yaml';
import { createOllamaHarnessChatResponse } from './ollama-harness-provider.mjs';

const HARNESS_USER_ID = 'harness';
const HARNESS_CHANNEL = 'web';
const HARNESS_SURFACE_ID = 'web-guardian-chat';

const HARNESS_PORT = 3012;
const HARNESS_TOKEN = `test-web-gmail-${Date.now()}`;
const BASE_URL = `http://127.0.0.1:${HARNESS_PORT}`;
const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-web-gmail-'));
const CONFIG_PATH = path.join(TEMP_DIR, 'config.yaml');
const GWS_STUB_PATH = path.join(TEMP_DIR, 'gws');
const LOG_FILE = path.join(TEMP_DIR, 'guardian.log');
const ERR_FILE = path.join(TEMP_DIR, 'guardian.err.log');

let appProcess;

function request(method, requestPath, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE_URL}${requestPath}`, {
      method,
      headers: {
        Authorization: `Bearer ${HARNESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function readCurrentPendingAction(userId = 'harness', channel = 'web', surfaceId = 'web-guardian-chat') {
  const qs = new URLSearchParams({ userId, channel, surfaceId });
  return request('GET', `/api/chat/pending-action?${qs.toString()}`);
}

function getPendingApprovalSummaries(response) {
  const pendingActionApprovals = response?.metadata?.pendingAction?.blocker?.approvalSummaries;
  if (Array.isArray(pendingActionApprovals)) {
    return pendingActionApprovals;
  }
  return Array.isArray(response?.metadata?.pendingApprovals)
    ? response.metadata.pendingApprovals
    : [];
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    try {
      const response = await request('GET', '/health');
      if (response?.status === 'ok') {
        return;
      }
    } catch {
      // keep polling until the app is ready
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('GuardianAgent did not become healthy within 180 seconds.');
}

async function waitForProcessExit(processHandle, timeoutMs = 2000) {
  if (!processHandle || processHandle.exitCode !== null || processHandle.signalCode !== null) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, timeoutMs);
    processHandle.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function removeTempDirWithRetry(dir) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes(error?.code) || attempt === 7) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
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
    model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: finishReason,
      },
    ],
    usage: {
      prompt_tokens: 1,
      completion_tokens: 1,
      total_tokens: 2,
    },
  };
}

function buildRouteIntentDecision(latestUser) {
  if (latestUser.includes('alexanderkenley@gmail.com') && latestUser.includes('subject is test')) {
    return {
      route: 'email_task',
      operation: 'send',
      confidence: 'high',
      summary: 'Send a Gmail message.',
      turnRelation: 'new_request',
      resolution: 'ready',
      emailProvider: 'gws',
      missingFields: [],
    };
  }
  return {
    route: 'general_assistant',
    operation: 'unknown',
    confidence: 'low',
    summary: 'Unexpected harness prompt.',
    turnRelation: 'new_request',
    resolution: 'ready',
    missingFields: [],
  };
}

async function startFakeProvider() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const isOllamaNativeChat = req.method === 'POST' && url.pathname === '/api/chat';
    const isOpenAiCompatChat = req.method === 'POST' && url.pathname === '/v1/chat/completions';

    if (req.method === 'GET' && url.pathname === '/api/tags') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models: [{ name: 'web-gmail-harness-model', size: 1 }] }));
      return;
    }

    if (isOllamaNativeChat || isOpenAiCompatChat) {
      const parsed = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => {
          data += chunk;
        });
        req.on('end', () => {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (error) {
            reject(error);
          }
        });
        req.on('error', reject);
      });
      const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
      const tools = Array.isArray(parsed.tools)
        ? parsed.tools.map((tool) => String(tool?.function?.name ?? tool?.name ?? '')).filter(Boolean)
        : [];
      const latestUser = String([...messages].reverse().find((message) => message.role === 'user')?.content ?? '');
      const sendResponse = ({ model, content = '', finishReason = 'stop', toolCalls }) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(
          isOllamaNativeChat
            ? createOllamaHarnessChatResponse({
                model,
                content,
                doneReason: finishReason,
                toolCalls,
              })
            : createChatCompletionResponse({
                model,
                content,
                finishReason,
                toolCalls,
              }),
        ));
      };
      const decision = buildRouteIntentDecision(latestUser);

      if (tools.includes('route_intent')) {
        sendResponse({
          model: 'web-gmail-harness-model',
          finishReason: 'tool_calls',
          toolCalls: [
            {
              id: 'web-gmail-route-intent-1',
              name: 'route_intent',
              arguments: JSON.stringify(decision),
            },
          ],
        });
        return;
      }

      if (latestUser.includes('Classify this request.')) {
        sendResponse({
          model: 'web-gmail-harness-model',
          content: JSON.stringify(decision),
        });
        return;
      }

      if (latestUser.includes('alexanderkenley@gmail.com') && latestUser.includes('subject is test')) {
        sendResponse({
          model: 'web-gmail-harness-model',
          content: JSON.stringify(decision),
        });
        return;
      }

      sendResponse({
        model: 'web-gmail-harness-model',
        content: JSON.stringify(decision),
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start fake provider');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

function writeStubGws() {
  const script = `#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ge 2 && "$1" == "auth" && "$2" == "status" ]]; then
  echo '{"auth_method":"stub"}'
  exit 0
fi

if [[ "$#" -ge 4 && "$1" == "gmail" && "$2" == "users" && "$3" == "messages" && "$4" == "send" ]]; then
  echo '{"id":"stub-message-1","labelIds":["SENT"]}'
  exit 0
fi

echo '{"error":{"message":"Unhandled gws stub call"}}'
exit 1
`;

  fs.writeFileSync(GWS_STUB_PATH, script, { mode: 0o755 });
}

function writeHarnessConfig() {
  const providerBaseUrl = process.env.WEB_GMAIL_HARNESS_BASE_URL;
  if (!providerBaseUrl) {
    throw new Error('WEB_GMAIL_HARNESS_BASE_URL is required');
  }
  const merged = {
    llm: {
      local: {
        provider: 'ollama',
        baseUrl: providerBaseUrl,
        model: 'web-gmail-harness-model',
      },
    },
    defaultProvider: 'local',
    channels: {
      cli: {
        enabled: false,
      },
      web: {
        enabled: true,
        host: '127.0.0.1',
        port: HARNESS_PORT,
        authToken: HARNESS_TOKEN,
      },
    },
    assistant: {
      identity: {
        mode: 'single_user',
        primaryUserId: 'harness',
      },
      setup: {
        completed: true,
      },
      tools: {
        enabled: true,
        policyMode: 'approve_by_policy',
        mcp: {
          enabled: true,
          managedProviders: {
            gws: {
              enabled: true,
              command: GWS_STUB_PATH.replace(/\\/g, '/'),
              services: ['gmail'],
            },
          },
        },
      },
    },
    guardian: {
      enabled: true,
    },
  };

  fs.writeFileSync(CONFIG_PATH, yaml.dump(merged, { lineWidth: -1, noRefs: true }));
}

async function run() {
  const preserveArtifacts = process.env.HARNESS_KEEP_TMP === '1';
  writeStubGws();
  const provider = await startFakeProvider();
  try {
    process.env.WEB_GMAIL_HARNESS_BASE_URL = provider.baseUrl;
    writeHarnessConfig();

    console.log('[web-gmail] Starting GuardianAgent...');
    let completed = false;
    let exitInfo = null;
    appProcess = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts', CONFIG_PATH], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: TEMP_DIR,
        USERPROFILE: TEMP_DIR,
        XDG_CONFIG_HOME: TEMP_DIR,
        XDG_DATA_HOME: TEMP_DIR,
        XDG_CACHE_HOME: TEMP_DIR,
      },
    });
    appProcess.once('exit', (code, signal) => {
      exitInfo = { code, signal };
    });
    appProcess.stdout.pipe(fs.createWriteStream(LOG_FILE));
    appProcess.stderr.pipe(fs.createWriteStream(ERR_FILE));

    await waitForHealth();
    console.log('[web-gmail] App is healthy');

    await request('POST', '/api/tools/policy', {
      mode: 'approve_by_policy',
      sandbox: {
        allowedPaths: ['.'],
        allowedCommands: ['node'],
        allowedDomains: ['gmail.googleapis.com'],
      },
    });

    const prompt = 'send to alexanderkenley@gmail.com subject is test, body testicles123';
    const first = await request('POST', '/api/message', {
      content: prompt,
      userId: HARNESS_USER_ID,
      channel: HARNESS_CHANNEL,
      surfaceId: HARNESS_SURFACE_ID,
    });

    if (typeof first?.content !== 'string') {
      throw new Error(`Expected chat content from /api/message, got: ${JSON.stringify(first)}`);
    }
    if (first.content.includes('No LLM provider configured')) {
      throw new Error('Harness needs a configured LLM provider. Set up ~/.guardianagent/config.yaml or a local Ollama model.');
    }

    const firstPending = getPendingApprovalSummaries(first);
    assert.ok(firstPending[0]?.id, `Expected structured pending approval metadata: ${JSON.stringify(first)}`);
    assert.equal(first.metadata?.pendingAction?.blocker?.kind, 'approval', `Expected canonical pendingAction metadata on Gmail blocked response: ${JSON.stringify(first)}`);
    const currentPending = await readCurrentPendingAction();
    assert.equal(currentPending?.pendingAction?.blocker?.kind, 'approval', `Expected Gmail pending action from current-pending endpoint: ${JSON.stringify(currentPending)}`);
    assert.equal(currentPending.pendingAction.blocker.approvalSummaries?.[0]?.id, firstPending[0].id);

    const approvalId = firstPending[0].id;
    console.log(`[web-gmail] Approving ${approvalId}`);

    const decision = await request('POST', '/api/tools/approvals/decision', {
      approvalId,
      decision: 'approved',
      actor: 'web-user',
      userId: HARNESS_USER_ID,
      channel: HARNESS_CHANNEL,
      surfaceId: HARNESS_SURFACE_ID,
    });

    assert.equal(decision.success, true, 'approval decision should succeed');
    assert.equal(decision.continueConversation, false, 'direct Gmail approvals should not force a bogus continuation');
    assert.match(decision.displayMessage || '', /I sent the Gmail message\./, 'web UI should get an immediate direct-tool confirmation');
    const clearedPending = await readCurrentPendingAction();
    assert.equal(clearedPending?.pendingAction ?? null, null, `Did not expect Gmail pending action after approval: ${JSON.stringify(clearedPending)}`);

    completed = true;
    console.log('[web-gmail] PASS: Gmail Web UI approval flow returned immediate confirmation without continuation.');

    return { preserveArtifacts, completed, exitInfo };
  } finally {
    await provider.close();
  }
}

run().then((state) => {
  if (!state.completed && state.exitInfo) {
    console.error(`[web-gmail] GuardianAgent exited before completion: code=${state.exitInfo.code ?? 'null'} signal=${state.exitInfo.signal ?? 'null'}`);
  }
}).catch((error) => {
  console.error('[web-gmail] FAIL:', error instanceof Error ? error.message : String(error));
  if (process.env.HARNESS_KEEP_TMP === '1') {
    console.error(`[web-gmail] Preserved artifacts at ${TEMP_DIR}`);
  }
  process.exitCode = 1;
}).finally(async () => {
  if (appProcess && !appProcess.killed) {
    appProcess.kill();
    await waitForProcessExit(appProcess);
  }
  if (process.exitCode !== 1 || process.env.HARNESS_KEEP_TMP !== '1') {
    await removeTempDirWithRetry(TEMP_DIR);
  }
});
