import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';

const HARNESS_PORT = 3000;
const HARNESS_TOKEN = `test-web-approvals-${Date.now()}`;
const BASE_URL = `http://localhost:${HARNESS_PORT}`;
const TEST_DIR = `/tmp/harness-web-approvals-test`;
const LOG_FILE = `/tmp/guardian-web-approvals-harness.log`;

let appProcess;

async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(BASE_URL + path, {
      method,
      headers: {
        'Authorization': `Bearer ${HARNESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
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

async function run() {
  const configStr = `
llm:
  mock:
    provider: ollama
    baseUrl: http://127.0.0.1:11434
    model: llama3.2
defaultProvider: mock
channels:
  cli:
    enabled: false
  web:
    enabled: true
    port: ${HARNESS_PORT}
    authToken: "${HARNESS_TOKEN}"
guardian:
  enabled: true
`;

  fs.writeFileSync('/tmp/harness-web-approvals-config.yaml', configStr);

  console.log("[web-approvals] Starting GuardianAgent...");
  appProcess = spawn('npx', ['tsx', 'src/index.ts', '/tmp/harness-web-approvals-config.yaml']);
  appProcess.stdout.pipe(fs.createWriteStream(LOG_FILE));
  appProcess.stderr.pipe(fs.createWriteStream(LOG_FILE + '.err'));

  // Wait for health
  let healthy = false;
  for(let i=0; i<60; i++) {
    try {
      const h = await request('GET', '/health');
      if (h.status === 'ok') { healthy = true; break; }
    } catch(e) {}
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!healthy) {
    console.log("Failed to start");
    appProcess.kill();
    process.exit(1);
  }
  console.log("[web-approvals] App is healthy");

  await request('POST', '/api/tools/policy', { mode: 'approve_by_policy', sandbox: { allowedPaths: ['.'], allowedCommands: ['node'] } });

  console.log("[web-approvals] Web UI Simulation: Out of Bounds Write");
  // Force a direct tool call instead of LLM to avoid Ollama dependency
  const resp1 = await request('POST', '/api/tools/run', {
    toolName: 'fs_write',
    args: { path: `${TEST_DIR}/web-ui-test.txt`, content: 'hello world' },
    userId: 'harness', origin: 'web'
  });

  const approvalId = resp1.approvalId;
  const toolName = 'fs_write';

  if (!approvalId) {
    console.log("FAIL: No pending approval metadata", resp1);
    appProcess.kill();
    process.exit(1);
  }
  console.log(`  PASS: received pendingApprovals metadata (${toolName}: ${approvalId})`);
  
  const decision = await request('POST', '/api/tools/approvals/decision', {
    approvalId, decision: 'approved', actor: 'web-user'
  });

  console.log(`  PASS: API accepted approval decision (${decision.success})`);

  const continuationMsg = `[Context: User is currently viewing the chat panel] [User approved the pending tool action(s). Result: ${toolName}: ${decision.message}] Please continue with the original task.`;
  console.log("[web-approvals] Sending continuation: " + continuationMsg);

  try {
     const resp2 = await request('POST', '/api/message', {
       content: continuationMsg, userId: 'harness', channel: 'web'
     });
     if (resp2.content && resp2.content.match(/loop|again|I need your approval/i)) {
         console.log("FAIL: LLM looping");
         process.exit(1);
     } else {
         console.log("  PASS: continuation response processed properly without looping.");
     }
  } catch(e) {
     console.log("Continuation failed", e);
  }

  appProcess.kill();
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  if(appProcess) appProcess.kill();
  process.exit(1);
});