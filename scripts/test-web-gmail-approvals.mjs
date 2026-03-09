import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import yaml from 'js-yaml';

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

async function waitForHealth() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
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
  throw new Error('GuardianAgent did not become healthy within 60 seconds.');
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
  const merged = {
    llm: {
      mock: {
        provider: 'ollama',
        baseUrl: 'http://127.0.0.1:11434',
        model: 'llama3.2',
      },
    },
    defaultProvider: 'mock',
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
  writeStubGws();
  writeHarnessConfig();

  console.log('[web-gmail] Starting GuardianAgent...');
  appProcess = spawn('node', ['--import', 'tsx', 'src/index.ts', CONFIG_PATH], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOME: TEMP_DIR,
      USERPROFILE: TEMP_DIR,
      XDG_CONFIG_HOME: TEMP_DIR,
      XDG_DATA_HOME: TEMP_DIR,
    },
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

  const prompt = 'Can you send a new email to alexanderkenley@gmail.com with subject test and in the body put testicles123';
  const first = await request('POST', '/api/message', {
    content: prompt,
    userId: 'harness',
    channel: 'web',
  });

  if (typeof first?.content !== 'string') {
    throw new Error(`Expected chat content from /api/message, got: ${JSON.stringify(first)}`);
  }
  if (first.content.includes('No LLM provider configured')) {
    throw new Error('Harness needs a configured LLM provider. Set up ~/.guardianagent/config.yaml or a local Ollama model.');
  }

  assert.match(first.content, /subject "test"/i, 'subject parser should stop before the body clause');
  assert.doesNotMatch(first.content, /test and in the/i, 'subject parser should not swallow connector text');
  assert.ok(first.metadata?.pendingApprovals?.[0]?.id, 'expected structured pending approval metadata');

  const approvalId = first.metadata.pendingApprovals[0].id;
  console.log(`[web-gmail] Approving ${approvalId}`);

  const decision = await request('POST', '/api/tools/approvals/decision', {
    approvalId,
    decision: 'approved',
    actor: 'web-user',
  });

  assert.equal(decision.success, true, 'approval decision should succeed');
  assert.equal(decision.continueConversation, false, 'direct Gmail approvals should not force a bogus continuation');
  assert.match(decision.displayMessage || '', /I sent the Gmail message\./, 'web UI should get an immediate direct-tool confirmation');

  console.log('[web-gmail] PASS: Gmail Web UI approval flow returned immediate confirmation without continuation.');
}

run().catch((error) => {
  console.error('[web-gmail] FAIL:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => {
  if (appProcess && !appProcess.killed) {
    appProcess.kill();
  }
});
