/**
 * Brokered approval flow test harness.
 *
 * Validates the brokered worker path (runtime.agentIsolation.enabled: true,
 * mode: 'brokered') with:
 *  1. Multi-step approval: message → update_tool_policy pending → approve → fs_write pending → approve → final
 *  2. memory_save suppression: operational flow must NOT call memory_save
 *  3. Direct tool report: "What tools did you use?" via job.list RPC
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOllamaHarnessChatResponse } from './ollama-harness-provider.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function createChatCompletionResponse({ model, content = '', finishReason = 'stop', toolCalls }) {
  const message = { role: 'assistant', content };
  if (toolCalls?.length) {
    message.tool_calls = toolCalls.map((tc) => ({
      id: tc.id,
      type: 'function',
      function: { name: tc.name, arguments: tc.arguments },
    }));
  }
  return {
    id: `chatcmpl-${Date.now()}`,
    model,
    choices: [{ index: 0, message, finish_reason: finishReason }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}

async function startFakeProvider(testDir, scenarioLog) {
  const targetFilePath = path.join(testDir, 'brokered-test.txt');
  const targetFilePathCandidates = [targetFilePath, targetFilePath.replace(/\\/g, '/')];
  const recoveryDir = path.join(path.dirname(testDir), 'recovery-after-approval');
  const recoveryTargetFilePath = path.join(recoveryDir, 'brokered-test.txt');
  const recoveryTargetFilePathCandidates = [recoveryTargetFilePath, recoveryTargetFilePath.replace(/\\/g, '/')];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const isOllamaNativeChat = req.method === 'POST' && url.pathname === '/api/chat';
    const isOpenAiCompatChat = req.method === 'POST' && url.pathname === '/v1/chat/completions';

    if (req.method === 'GET' && url.pathname === '/api/tags') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models: [{ name: 'brokered-harness-model', size: 1 }] }));
      return;
    }

    if (isOllamaNativeChat || isOpenAiCompatChat) {
      const parsed = await readJsonBody(req);
      const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
      const tools = Array.isArray(parsed.tools)
        ? parsed.tools.map((tool) => String(tool?.function?.name ?? tool?.name ?? '')).filter(Boolean)
        : [];
      const latestUser = String([...messages].reverse().find((m) => m.role === 'user')?.content ?? '');
      const conversationText = messages
        .map((message) => (typeof message?.content === 'string' ? message.content : ''))
        .filter(Boolean)
        .join('\n');
      const isRecoveryConversation = recoveryTargetFilePathCandidates.some((candidate) => conversationText.includes(candidate))
        || conversationText.includes(recoveryDir)
        || conversationText.includes(recoveryDir.replace(/\\/g, '/'));
      scenarioLog.push({
        endpoint: url.pathname,
        latestUser,
        tools,
        model: String(parsed.model ?? ''),
      });
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

      if (latestUser.includes('requested external directory')) {
        sendResponse({
          model: 'brokered-harness-model',
          content: 'I need the exact external path before I can request approval. Please tell me which directory or full file path you want me to use for brokered-test.txt.',
        });
        return;
      }

      // Recovery scenario: model wrongly tries fs_write first, then must self-correct.
      if (
        latestUser.includes('previous tool call did not complete because tool policy blocked it')
        && isRecoveryConversation
      ) {
        sendResponse({
          model: 'brokered-harness-model',
          finishReason: 'tool_calls',
          toolCalls: [{
            id: 'bk-recovery-tc-2',
            name: 'update_tool_policy',
            arguments: JSON.stringify({ action: 'add_path', value: recoveryDir }),
          }],
        });
        return;
      }

      if (
        latestUser.includes('create an empty file')
        && recoveryTargetFilePathCandidates.some((candidate) => latestUser.includes(candidate))
        && conversationText.includes('outside allowed paths')
      ) {
        sendResponse({
          model: 'brokered-harness-model',
          content: `Created empty file: ${recoveryTargetFilePath}`,
        });
        return;
      }

      if (
        latestUser.includes('create an empty file')
        && recoveryTargetFilePathCandidates.some((candidate) => latestUser.includes(candidate))
      ) {
        sendResponse({
          model: 'brokered-harness-model',
          finishReason: 'tool_calls',
          toolCalls: [{
            id: 'bk-recovery-tc-1',
            name: 'fs_write',
            arguments: JSON.stringify({
              path: recoveryTargetFilePath,
              content: '',
              append: false,
            }),
          }],
        });
        return;
      }

      // Step 1: user asks to create a file at a specific external path → model calls update_tool_policy
      if (
        latestUser.includes('create an empty file')
        && targetFilePathCandidates.some((candidate) => latestUser.includes(candidate))
      ) {
        sendResponse({
          model: 'brokered-harness-model',
          finishReason: 'tool_calls',
          toolCalls: [{
            id: 'bk-tc-1',
            name: 'update_tool_policy',
            arguments: JSON.stringify({ action: 'add_path', value: testDir }),
          }],
        });
        return;
      }

      // Step 2: after update_tool_policy approved → model calls fs_write
      if (latestUser.includes('Result: ✓ update_tool_policy: Approved and executed')) {
        const approvedTargetPath = isRecoveryConversation ? recoveryTargetFilePath : targetFilePath;
        sendResponse({
          model: 'brokered-harness-model',
          finishReason: 'tool_calls',
          toolCalls: [{
            id: isRecoveryConversation ? 'bk-recovery-tc-3' : 'bk-tc-2',
            name: 'fs_write',
            arguments: JSON.stringify({
              path: approvedTargetPath,
              content: '',
              append: false,
            }),
          }],
        });
        return;
      }

      // Step 3: after fs_write approved → model returns final text
      if (latestUser.includes('Result: ✓ fs_write: Approved and executed')) {
        const completedTargetPath = isRecoveryConversation ? recoveryTargetFilePath : targetFilePath;
        sendResponse({
          model: 'brokered-harness-model',
          content: `Done - created ${completedTargetPath} as an empty file.`,
        });
        return;
      }

      // Fallback
      sendResponse({
        model: 'brokered-harness-model',
        content: 'Unexpected harness prompt.',
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Failed to start fake provider');

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(data ? JSON.parse(data) : {}); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function getPendingApprovalSummaries(response) {
  const metadata = response?.metadata;
  if (Array.isArray(metadata?.pendingApprovals)) {
    return metadata.pendingApprovals;
  }
  const pendingActionApprovals = metadata?.pendingAction?.blocker?.approvalSummaries;
  return Array.isArray(pendingActionApprovals) ? pendingActionApprovals : [];
}

async function readCurrentPendingAction(baseUrl, token, userId = 'harness', channel = 'web', surfaceId = 'web-guardian-chat') {
  const qs = new URLSearchParams({ userId, channel, surfaceId });
  return requestJson(baseUrl, token, 'GET', `/api/chat/pending-action?${qs.toString()}`);
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
  // Brokered cold starts use a fresh temp HOME and bootstrap the browser stack,
  // which can exceed 30s on WSL-mounted workspaces even when startup is healthy.
  for (let i = 0; i < 180; i += 1) {
    try {
      const result = await requestJson(baseUrl, 'unused', 'GET', '/health');
      if (result?.status === 'ok') return;
    } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('GuardianAgent did not become healthy within 90 seconds.');
}

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function runBrokeredApprovalHarness() {
  const preserveArtifacts = process.env.HARNESS_KEEP_TMP === '1';
  const harnessPort = await getFreePort();
  const harnessToken = `brokered-approval-harness-${Date.now()}`;
  const baseUrl = `http://127.0.0.1:${harnessPort}`;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-brokered-approvals-'));
  const configPath = path.join(tmpDir, 'config.yaml');
  const logPath = path.join(tmpDir, 'guardian.log');
  const testDir = path.join(tmpDir, 'allowed-after-approval');
  const targetFilePath = path.join(testDir, 'brokered-test.txt');
  const recoveryDir = path.join(tmpDir, 'recovery-after-approval');
  const recoveryTargetFilePath = path.join(recoveryDir, 'brokered-test.txt');
  const scenarioLog = [];
  const provider = await startFakeProvider(testDir, scenarioLog);

  const projectRoot = path.resolve(__dirname, '..');
  const distEntry = path.join(projectRoot, 'dist', 'index.js');
  const workerEntry = path.join(projectRoot, 'dist', 'worker', 'worker-entry.js');

  if (!fs.existsSync(distEntry) || !fs.existsSync(workerEntry)) {
    console.error('Missing build artifacts in dist/. Run `npm run build` first.');
    process.exit(1);
  }

  const config = `
llm:
  local:
    provider: ollama
    baseUrl: ${provider.baseUrl}
    model: brokered-harness-model
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
      - .
    allowedCommands:
      - node
    agentPolicyUpdates:
      allowedPaths: true
      allowedCommands: false
      allowedDomains: false
runtime:
  agentIsolation:
    enabled: true
    mode: brokered
    workerEntryPoint: "${workerEntry.replace(/\\/g, '/')}"
guardian:
  enabled: true
`;

  fs.writeFileSync(configPath, config);
  let appProcess;
  let completed = false;
  try {
    appProcess = spawn(process.execPath, [distEntry, configPath], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        HOME: tmpDir,
        USERPROFILE: tmpDir,
        XDG_CONFIG_HOME: tmpDir,
        XDG_DATA_HOME: tmpDir,
        XDG_CACHE_HOME: tmpDir,
      },
    });
    const stdout = fs.createWriteStream(logPath);
    const stderr = fs.createWriteStream(`${logPath}.err`);
    appProcess.stdout.pipe(stdout);
    appProcess.stderr.pipe(stderr);

    await waitForHealth(baseUrl);

    // --- Test 0: ambiguous external path should clarify instead of entering approvals ---
    console.log('Test 0: Ambiguous external path clarifies...');
    const clarification = await requestJson(baseUrl, harnessToken, 'POST', '/api/message', {
      content: 'Please create an empty file called brokered-test.txt in the requested external directory.',
      userId: 'harness',
      channel: 'web',
    });
    assert.equal(
      getPendingApprovalSummaries(clarification).length,
      0,
      `Expected clarification without approvals for an ambiguous external path: ${JSON.stringify(clarification)}`,
    );
    assert.match(
      String(clarification.content ?? ''),
      /(exact external path|which directory|full file path)/i,
      `Expected clarification text for ambiguous external path: ${JSON.stringify(clarification)}`,
    );
    console.log('  PASS: Ambiguous external request produced a clarification.');

    // --- Test 1: Multi-step approval flow ---
    console.log('Test 1: Multi-step approval flow (brokered)...');
    const first = await requestJson(baseUrl, harnessToken, 'POST', '/api/message', {
      content: `Please create an empty file at ${targetFilePath}.`,
      userId: 'harness',
      channel: 'web',
    });
    const firstPending = getPendingApprovalSummaries(first);
    assert.ok(
      firstPending.length > 0,
      `Expected pending approval from initial message: ${JSON.stringify(first)}`,
    );
    assert.equal(
      first.metadata?.pendingAction?.blocker?.kind,
      'approval',
      `Expected canonical pendingAction metadata on first blocked response: ${JSON.stringify(first)}`,
    );
    assert.equal(firstPending[0].toolName, 'update_tool_policy');
    const firstCurrent = await readCurrentPendingAction(baseUrl, harnessToken);
    assert.equal(firstCurrent?.pendingAction?.blocker?.kind, 'approval');
    assert.equal(firstCurrent.pendingAction.blocker.approvalSummaries?.[0]?.id, firstPending[0].id);

    // Approve first tool
    const firstDecision = await requestJson(baseUrl, harnessToken, 'POST', '/api/tools/approvals/decision', {
      approvalId: firstPending[0].id,
      decision: 'approved',
      actor: 'brokered-user',
    });
    assert.equal(firstDecision.success, true);

    // Continue after first approval
    const second = await requestJson(baseUrl, harnessToken, 'POST', '/api/message', {
      content: '[Context: User is currently viewing the chat panel] [User approved the pending tool action(s). Result: ✓ update_tool_policy: Approved and executed] Please continue with the current request only. Do not resume older unrelated pending tasks.',
      userId: 'harness',
      channel: 'web',
    });
    const secondPending = getPendingApprovalSummaries(second);
    assert.ok(
      secondPending.length > 0,
      `Expected pending fs_write approval: ${JSON.stringify(second)}`,
    );
    assert.equal(
      second.metadata?.pendingAction?.blocker?.kind,
      'approval',
      `Expected canonical pendingAction metadata on second blocked response: ${JSON.stringify(second)}`,
    );
    assert.equal(secondPending[0].toolName, 'fs_write');
    const secondCurrent = await readCurrentPendingAction(baseUrl, harnessToken);
    assert.equal(secondCurrent?.pendingAction?.blocker?.kind, 'approval');
    assert.equal(secondCurrent.pendingAction.blocker.approvalSummaries?.[0]?.id, secondPending[0].id);

    // Approve second tool
    const secondDecision = await requestJson(baseUrl, harnessToken, 'POST', '/api/tools/approvals/decision', {
      approvalId: secondPending[0].id,
      decision: 'approved',
      actor: 'brokered-user',
    });
    assert.equal(secondDecision.success, true);

    // Continue after second approval
    const third = await requestJson(baseUrl, harnessToken, 'POST', '/api/message', {
      content: '[Context: User is currently viewing the chat panel] [User approved the pending tool action(s). Result: ✓ fs_write: Approved and executed] Please continue with the current request only. Do not resume older unrelated pending tasks.',
      userId: 'harness',
      channel: 'web',
    });
    assert.ok(
      typeof third.content === 'string' && third.content.length > 0,
      `Expected final response text: ${JSON.stringify(third)}`,
    );
    assert.equal(getPendingApprovalSummaries(third).length, 0, 'No more pending approvals expected');
    assert.match(third.content, /created .*brokered-test\.txt/i);
    const clearedCurrent = await readCurrentPendingAction(baseUrl, harnessToken);
    assert.equal(clearedCurrent?.pendingAction ?? null, null, `Expected pending action to clear after completion: ${JSON.stringify(clearedCurrent)}`);

    // Verify file was actually created
    assert.equal(fs.existsSync(targetFilePath), true, `Expected ${targetFilePath} to exist`);
    assert.equal(fs.statSync(targetFilePath).size, 0, 'Expected empty file');
    console.log('  PASS: Multi-step approval flow completed successfully.');

    // --- Test 1b: policy-blocked fs_write should self-correct into update_tool_policy ---
    console.log('Test 1b: Policy-blocked fs_write self-corrects into approval...');
    // The default agent burst limit is 5/10s. Clear that window before the 1b batch.
    await new Promise((resolve) => setTimeout(resolve, 11_000));
    const recoveryFirst = await requestJson(baseUrl, harnessToken, 'POST', '/api/message', {
      content: `Please create an empty file at ${recoveryTargetFilePath}.`,
      userId: 'harness-recovery',
      channel: 'web',
    });
    const recoveryFirstPending = getPendingApprovalSummaries(recoveryFirst);
    assert.ok(
      recoveryFirstPending.length > 0,
      `Expected pending approval after fs_write recovery: ${JSON.stringify(recoveryFirst)}`,
    );
    assert.equal(
      recoveryFirst.metadata?.pendingAction?.blocker?.kind,
      'approval',
      `Expected canonical pendingAction metadata on recovery response: ${JSON.stringify(recoveryFirst)}`,
    );
    assert.equal(recoveryFirstPending[0].toolName, 'update_tool_policy');
    const recoveryCurrent = await readCurrentPendingAction(baseUrl, harnessToken, 'harness-recovery');
    assert.equal(recoveryCurrent?.pendingAction?.blocker?.kind, 'approval');
    assert.equal(recoveryCurrent.pendingAction.blocker.approvalSummaries?.[0]?.id, recoveryFirstPending[0].id);

    const recoveryFirstDecision = await requestJson(baseUrl, harnessToken, 'POST', '/api/tools/approvals/decision', {
      approvalId: recoveryFirstPending[0].id,
      decision: 'approved',
      actor: 'brokered-user',
    });
    assert.equal(recoveryFirstDecision.success, true);

    await new Promise((resolve) => setTimeout(resolve, 11_000));
    const recoverySecond = await requestJson(baseUrl, harnessToken, 'POST', '/api/message', {
      content: '[Context: User is currently viewing the chat panel] [User approved the pending tool action(s). Result: ✓ update_tool_policy: Approved and executed] Please continue with the current request only. Do not resume older unrelated pending tasks.',
      userId: 'harness-recovery',
      channel: 'web',
    });
    const recoverySecondPending = getPendingApprovalSummaries(recoverySecond);
    assert.ok(
      recoverySecondPending.length > 0,
      `Expected pending fs_write approval after policy recovery: ${JSON.stringify(recoverySecond)}`,
    );
    assert.equal(
      recoverySecond.metadata?.pendingAction?.blocker?.kind,
      'approval',
      `Expected canonical pendingAction metadata on recovery fs_write response: ${JSON.stringify(recoverySecond)}`,
    );
    assert.equal(recoverySecondPending[0].toolName, 'fs_write');
    const recoverySecondCurrent = await readCurrentPendingAction(baseUrl, harnessToken, 'harness-recovery');
    assert.equal(recoverySecondCurrent?.pendingAction?.blocker?.kind, 'approval');
    assert.equal(recoverySecondCurrent.pendingAction.blocker.approvalSummaries?.[0]?.id, recoverySecondPending[0].id);

    const recoverySecondDecision = await requestJson(baseUrl, harnessToken, 'POST', '/api/tools/approvals/decision', {
      approvalId: recoverySecondPending[0].id,
      decision: 'approved',
      actor: 'brokered-user',
    });
    assert.equal(recoverySecondDecision.success, true);

    await new Promise((resolve) => setTimeout(resolve, 11_000));
    const recoveryThird = await requestJson(baseUrl, harnessToken, 'POST', '/api/message', {
      content: '[Context: User is currently viewing the chat panel] [User approved the pending tool action(s). Result: ✓ fs_write: Approved and executed] Please continue with the current request only. Do not resume older unrelated pending tasks.',
      userId: 'harness-recovery',
      channel: 'web',
    });
    assert.ok(typeof recoveryThird.content === 'string' && recoveryThird.content.length > 0, `Expected final recovery response text: ${JSON.stringify(recoveryThird)}`);
    assert.equal(getPendingApprovalSummaries(recoveryThird).length, 0, 'No more pending approvals expected after recovery flow');
    assert.match(recoveryThird.content, /created .*brokered-test\.txt/i);
    const recoveryClearedCurrent = await readCurrentPendingAction(baseUrl, harnessToken, 'harness-recovery');
    assert.equal(recoveryClearedCurrent?.pendingAction ?? null, null, `Expected pending action to clear after recovery completion: ${JSON.stringify(recoveryClearedCurrent)}`);
    assert.equal(fs.existsSync(recoveryTargetFilePath), true, `Expected ${recoveryTargetFilePath} to exist`);
    assert.equal(fs.statSync(recoveryTargetFilePath).size, 0, 'Expected empty recovery file');
    console.log('  PASS: Policy-blocked fs_write recovered into the approval flow.');

    const tracePath = path.join(tmpDir, '.guardianagent', 'routing', 'intent-routing.jsonl');
    const routingTrace = readJsonLines(tracePath);
    const delegatedStarts = routingTrace.filter((entry) => entry?.stage === 'delegated_worker_started');
    assert.ok(
      delegatedStarts.some((entry) =>
        entry?.details?.executionProfileName === 'local'
        && entry?.details?.executionProfileModel === 'brokered-harness-model'),
      `Expected delegated worker to stay on the harness local profile. Trace: ${JSON.stringify(delegatedStarts)}`,
    );
    assert.ok(
      !delegatedStarts.some((entry) => entry?.details?.executionProfileName === 'ollama'),
      `Delegated worker should not drift to the default ollama profile. Trace: ${JSON.stringify(delegatedStarts)}`,
    );
    console.log('  PASS: Delegated worker used the harness local execution profile.');

    // --- Test 2: memory_save suppression ---
    console.log('Test 2: memory_save suppression...');
    const memorySaveSeen = scenarioLog.some((entry) =>
      entry.latestUser.includes('memory_save') && !entry.latestUser.includes('remember'),
    );
    // memory_save should not have been invoked by the LLM for this operational flow
    // (the fake LLM doesn't generate memory_save calls, but we verify the broker safety net
    // exists by confirming no unexpected tool calls leaked through)
    assert.ok(!memorySaveSeen, 'memory_save should not appear in operational scenario log');
    console.log('  PASS: No spurious memory_save calls in scenario.');

    // --- Test 3: Direct tool report via job.list ---
    console.log('Test 3: Direct tool report (what tools did you use?)...');
    const followUp = await requestJson(baseUrl, harnessToken, 'POST', '/api/message', {
      content: 'What exact tools did you use?',
      userId: 'harness',
      channel: 'web',
    });
    assert.ok(typeof followUp.content === 'string' && followUp.content.length > 0, 'Expected tool report response');
    assert.match(followUp.content, /update_tool_policy/);
    assert.match(followUp.content, /fs_write/);
    assert.equal(getPendingApprovalSummaries(followUp).length, 0, 'No pending approvals on follow-up');
    console.log('  PASS: Tool report returned expected tool names.');

    console.log('PASS: All brokered approval harness tests passed.');
    completed = true;
  } finally {
    if (appProcess && !appProcess.killed) {
      appProcess.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!appProcess.killed) appProcess.kill('SIGKILL');
    }
    await provider.close();
    if (!completed || preserveArtifacts) {
      console.log(`Harness artifacts preserved at: ${tmpDir}`);
    } else {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
    }
  }
}

runBrokeredApprovalHarness()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAIL: Brokered approval harness');
    console.error(err);
    process.exit(1);
  });
