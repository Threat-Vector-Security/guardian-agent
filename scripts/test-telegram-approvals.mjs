import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { spawnTsx } from './spawn-tsx.mjs';

const scriptPath = fileURLToPath(import.meta.url);
if (!process.execArgv.includes('tsx') && process.env.GUARDIAN_TSX_LOADER_ACTIVE !== '1') {
  const result = spawnSync(process.execPath, ['--import', 'tsx', scriptPath, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, GUARDIAN_TSX_LOADER_ACTIVE: '1' },
  });
  process.exit(result.status ?? 1);
}

let TelegramChannelClass;

async function getTelegramChannelClass() {
  if (!TelegramChannelClass) {
    ({ TelegramChannel: TelegramChannelClass } = await import('../src/channels/telegram.ts'));
  }
  return TelegramChannelClass;
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FAKE_OPENAI_CREDENTIAL_REF = 'llm.openai.fake';
const FAKE_OPENAI_ENV = 'HARNESS_FAKE_OPENAI_KEY';

function createFakeCtx() {
  const replies = [];
  return {
    replies,
    ctx: {
      chat: { id: 1001 },
      from: { id: 2002 },
      async reply(text, extra) {
        replies.push({ text, extra });
        return {};
      },
      async replyWithChatAction() {
        return {};
      },
    },
  };
}

async function runChannelApprovalFlow() {
  const TelegramChannel = await getTelegramChannelClass();
  const decisions = [];
  const dispatches = [];
  const channel = new TelegramChannel({
    botToken: '123:abc',
    async onToolsApprovalDecision({ approvalId, decision }) {
      decisions.push({ approvalId, decision });
      return {
        success: true,
        message: approvalId === 'approval-path-1'
          ? "Tool 'update_tool_policy' completed."
          : "Tool 'fs_write' completed.",
      };
    },
    async onDispatch(agentId, message) {
      dispatches.push({ agentId, ...message });
      if (dispatches.length === 1) {
        return {
          content: 'Waiting for approval to write S:\\Development\\test26.txt.',
          metadata: {
            pendingApprovals: [
              {
                id: 'approval-write-1',
                toolName: 'fs_write',
                argsPreview: '{"path":"S:\\\\Development\\\\test26.txt","content":"This is a test file.","append":false}',
              },
            ],
          },
        };
      }
      return {
        content: 'Done — created `S:\\Development\\test26.txt` with the specified contents.',
      };
    },
  });
  const { ctx, replies } = createFakeCtx();

  await channel.replyWithApprovalSupport(ctx, {
    content: 'Waiting for approval to add S:\\Development to allowed paths.',
    metadata: {
      pendingApprovals: [
        {
          id: 'approval-path-1',
          toolName: 'update_tool_policy',
          argsPreview: '{"action":"add_path","value":"S:\\\\Development"}',
        },
      ],
    },
  }, 'default');

  await channel.handlePendingApprovalInput(ctx, 'approved', '1001:2002', '2002');
  await channel.handlePendingApprovalInput(ctx, 'yes approved', '1001:2002', '2002');

  const output = replies.map((reply) => reply.text).join('\n');

  assert.deepEqual(decisions, [
    { approvalId: 'approval-path-1', decision: 'approved' },
    { approvalId: 'approval-write-1', decision: 'approved' },
  ]);
  assert.equal(dispatches.length, 2);
  assert.match(dispatches[0].content, /\[User approved the pending tool action\(s\)\. Result: update_tool_policy: Approved and executed\]/);
  assert.match(dispatches[0].content, /Please continue with the current request only\. Do not resume older unrelated pending tasks\./);
  assert.match(dispatches[1].content, /\[User approved the pending tool action\(s\)\. Result: fs_write: Approved and executed\]/);
  assert.match(dispatches[1].content, /Please continue with the current request only\. Do not resume older unrelated pending tasks\./);
  assert.match(output, /Waiting for approval to add S:\\Development to allowed paths\./);
  assert.match(output, /Waiting for approval to write S:\\Development\\test26\.txt\./);
  assert.match(output, /Done — created `S:\\Development\\test26\.txt` with the specified contents\./);
  assert.ok(!output.includes("Tool 'fs_write' completed."));
  assert.ok(!output.includes("Tool 'update_tool_policy' completed."));
  assert.ok(!output.includes('I need your approval before proceeding.'));
  assert.ok(!output.toLowerCase().includes('tool is unavailable'));

  console.log('PASS telegram channel approval flow');
}

async function runChannelEmptyFileApprovalFlow() {
  const TelegramChannel = await getTelegramChannelClass();
  const decisions = [];
  const dispatches = [];
  const channel = new TelegramChannel({
    botToken: '123:abc',
    async onToolsApprovalDecision({ approvalId, decision }) {
      decisions.push({ approvalId, decision });
      return {
        success: true,
        message: approvalId === 'approval-path-empty-1'
          ? "Tool 'update_tool_policy' completed."
          : "Tool 'fs_write' completed.",
      };
    },
    async onDispatch(agentId, message) {
      dispatches.push({ agentId, ...message });
      if (dispatches.length === 1) {
        return {
          content: 'Waiting for approval to write S:\\Development\\Test100.',
          metadata: {
            pendingApprovals: [
              {
                id: 'approval-write-empty-1',
                toolName: 'fs_write',
                argsPreview: '{"path":"S:\\\\Development\\\\Test100","content":"","append":false}',
              },
            ],
          },
        };
      }
      return {
        content: 'Done — created `S:\\Development\\Test100` as an empty file.',
      };
    },
  });
  const { ctx, replies } = createFakeCtx();

  await channel.replyWithApprovalSupport(ctx, {
    content: 'Waiting for approval to add S:\\Development to allowed paths.',
    metadata: {
      pendingApprovals: [
        {
          id: 'approval-path-empty-1',
          toolName: 'update_tool_policy',
          argsPreview: '{"action":"add_path","value":"S:\\\\Development"}',
        },
      ],
    },
  }, 'default');

  await channel.handlePendingApprovalInput(ctx, 'approved', '1001:2002', '2002');
  await channel.handlePendingApprovalInput(ctx, 'approved', '1001:2002', '2002');
  await channel.handlePendingApprovalInput(ctx, 'approved', '1001:2002', '2002');

  const output = replies.map((reply) => reply.text).join('\n');

  assert.deepEqual(decisions, [
    { approvalId: 'approval-path-empty-1', decision: 'approved' },
    { approvalId: 'approval-write-empty-1', decision: 'approved' },
  ]);
  assert.equal(dispatches.length, 2);
  assert.match(output, /Waiting for approval to add S:\\Development to allowed paths\./);
  assert.match(output, /Waiting for approval to write S:\\Development\\Test100\./);
  assert.match(output, /Done — created `S:\\Development\\Test100` as an empty file\./);
  assert.match(output, /There are no pending approvals\./);
  assert.ok(!output.includes("Tool 'fs_write' completed."));
  assert.ok(!output.includes("Tool 'update_tool_policy' completed."));
  assert.ok(!output.toLowerCase().includes('tool is unavailable'));

  console.log('PASS telegram empty-file approval flow');
}

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

async function startFakeProvider(kind) {
  const modelName = `${kind}-model`;
  let chatCalls = 0;
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/api/tags') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models: [{ name: modelName, size: 1 }] }));
      return;
    }

    if (req.method === 'GET' && req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        data: [{ id: modelName, object: 'model' }],
      }));
      return;
    }

    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      await readJsonBody(req);
      chatCalls += 1;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (kind === 'local') {
        res.end(JSON.stringify(createChatCompletionResponse({
          model: modelName,
          content: 'I could not generate a final response for that request.',
          finishReason: 'stop',
        })));
        return;
      }

      if (chatCalls === 1) {
        res.end(JSON.stringify(createChatCompletionResponse({
          model: modelName,
          finishReason: 'tool_calls',
          toolCalls: [
            {
              id: 'fallback-tool-1',
              name: 'automation_save',
              arguments: JSON.stringify({
                id: 'minute-net-scans',
                name: 'Minute Net Scans',
                enabled: true,
                kind: 'workflow',
                mode: 'sequential',
                steps: [
                  { id: 'step-1', toolName: 'net_connections' },
                  { id: 'step-2', toolName: 'net_classify' },
                ],
              }),
            },
          ],
        })));
        return;
      }

      res.end(JSON.stringify(createChatCompletionResponse({
        model: modelName,
        content: 'Unexpected extra fallback synthesis round.',
        finishReason: 'stop',
      })));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error(`Failed to start ${kind} fake provider`);
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
    getChatCalls: () => chatCalls,
  };
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

async function getFreePort() {
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Failed to allocate a free port');
  }
  const { port } = address;
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  return port;
}

async function waitForHealth(baseUrl) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const result = await requestJson(baseUrl, 'unused', 'GET', '/health');
      if (result?.status === 'ok') {
        return;
      }
    } catch {
      // Retry until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('GuardianAgent did not become healthy within 30 seconds.');
}

async function runAutomationFallbackHarness() {
  const localProvider = await startFakeProvider('local');
  const externalProvider = await startFakeProvider('external');
  const harnessPort = await getFreePort();
  const harnessToken = `telegram-approval-harness-${Date.now()}`;
  const baseUrl = `http://127.0.0.1:${harnessPort}`;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-telegram-approvals-'));
  const configPath = path.join(tmpDir, 'config.yaml');
  const logPath = path.join(tmpDir, 'guardian.log');

  const config = `
llm:
  local:
    provider: ollama
    baseUrl: ${localProvider.baseUrl}
    model: local-model
  external:
    provider: openai
    baseUrl: ${externalProvider.baseUrl}
    model: external-model
    credentialRef: ${FAKE_OPENAI_CREDENTIAL_REF}
defaultProvider: local
fallbacks:
  - external
qualityFallback: true
channels:
  cli:
    enabled: false
  web:
    enabled: true
    host: 127.0.0.1
    port: ${harnessPort}
    authToken: "${harnessToken}"
assistant:
  credentials:
    refs:
      ${FAKE_OPENAI_CREDENTIAL_REF}:
        source: env
        env: ${FAKE_OPENAI_ENV}
  identity:
    mode: single_user
    primaryUserId: harness
  tools:
    enabled: true
    providerRoutingEnabled: false
runtime:
  agentIsolation:
    enabled: false
guardian:
  enabled: true
`;

  fs.writeFileSync(configPath, config);

  let appProcess;
  try {
    appProcess = spawnTsx('src/index.ts', [configPath], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        [FAKE_OPENAI_ENV]: 'test-key',
      },
    });
    const stdout = fs.createWriteStream(logPath);
    const stderr = fs.createWriteStream(`${logPath}.err`);
    appProcess.stdout.pipe(stdout);
    appProcess.stderr.pipe(stderr);

    await waitForHealth(baseUrl);

    await requestJson(baseUrl, harnessToken, 'POST', '/api/tools/policy', {
      mode: 'approve_each',
    });

    const response = await requestJson(baseUrl, harnessToken, 'POST', '/api/message', {
      content: 'can you set up a automation that does a net connections scan every one minute and after it does the scan it does a net classify scan',
      userId: 'harness',
      channel: 'web',
    });

    const approvalSummaries = Array.isArray(response?.metadata?.pendingApprovals)
      ? response.metadata.pendingApprovals
      : Array.isArray(response?.metadata?.pendingAction?.blocker?.approvalSummaries)
        ? response.metadata.pendingAction.blocker.approvalSummaries
        : [];
    assert.ok(approvalSummaries.length > 0, `Expected pending approval metadata from fallback tool call: ${JSON.stringify(response)}`);
    assert.equal(approvalSummaries[0].toolName, 'automation_save');
    assert.ok(
      /Waiting for approval to save /i.test(String(response.content ?? ''))
      || /blocked work waiting for input or approval/i.test(String(response.content ?? '')),
      `Expected approval-oriented response copy: ${JSON.stringify(response)}`,
    );
    assert.ok(!/automation_save/i.test(String(response.content ?? '')), 'Should not surface the raw automation tool name in approval copy');
    assert.ok(!/I could not generate a final response/i.test(response.content), 'Should not surface degraded fallback copy when approval metadata exists');
    assert.ok(externalProvider.getChatCalls() <= 1, 'Fallback provider should not loop once approval metadata exists');

    console.log('PASS automation fallback approval harness');
  } finally {
    if (appProcess && !appProcess.killed) {
      appProcess.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!appProcess.killed) {
        appProcess.kill('SIGKILL');
      }
    }
    await Promise.allSettled([
      localProvider.close(),
      externalProvider.close(),
    ]);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function run() {
  await runChannelApprovalFlow();
  await runChannelEmptyFileApprovalFlow();
  await runAutomationFallbackHarness();
  process.exit(0);
}

run().catch((err) => {
  console.error('FAIL telegram approvals');
  console.error(err);
  process.exit(1);
});
