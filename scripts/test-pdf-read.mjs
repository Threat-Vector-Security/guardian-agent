import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function startFakeProvider() {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/api/tags') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models: [{ name: 'pdf-read-harness-model', size: 1 }] }));
      return;
    }

    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'pdf-read-harness-model',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'PDF read harness provider response.' },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 1,
          completion_tokens: 1,
          total_tokens: 2,
        },
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start fake provider');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}

async function getFreePort() {
  const server = http.createServer();
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Failed to allocate a free port');
  }
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

async function requestJson(baseUrl, token, method, pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return text;
  }
}

async function waitForHealth(baseUrl) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const result = await requestJson(baseUrl, 'unused', 'GET', '/health');
      if (result?.status === 'ok') {
        return;
      }
    } catch {
      // Retry until ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('GuardianAgent did not become healthy within 30 seconds.');
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function assertIncludesNormalized(actual, expected, message) {
  assert.ok(
    normalizeText(actual).includes(normalizeText(expected)),
    `${message}: expected "${expected}" in "${String(actual).slice(0, 240)}"`,
  );
}

async function runHarness() {
  const port = await getFreePort();
  const token = `pdf-read-harness-${Date.now()}`;
  const baseUrl = `http://127.0.0.1:${port}`;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-pdf-read-harness-'));
  const configPath = path.join(tempRoot, 'config.yaml');
  const logPath = path.join(tempRoot, 'guardian.log');
  const provider = await startFakeProvider();

  const config = `
llm:
  local:
    provider: ollama
    baseUrl: ${provider.baseUrl}
    model: pdf-read-harness-model
defaultProvider: local
channels:
  cli:
    enabled: false
  web:
    enabled: true
    host: 127.0.0.1
    port: ${port}
    authToken: "${token}"
assistant:
  identity:
    mode: single_user
    primaryUserId: harness
  setup:
    completed: true
  tools:
    enabled: true
    policyMode: autonomous
    allowedPaths:
      - ${projectRoot.replace(/\\/g, '/')}
    allowedCommands:
      - echo
    allowedDomains:
      - localhost
runtime:
  agentIsolation:
    enabled: false
guardian:
  enabled: true
`;

  fs.writeFileSync(configPath, config, 'utf8');

  const expectations = [
    {
      file: path.join(projectRoot, 'docs', 'research', '2603.05344v1.pdf'),
      title: 'Building AI Coding Agents for the Terminal',
      content: 'Scaffolding, Harness, Context Engineering, and Lessons Learned',
    },
    {
      file: path.join(projectRoot, 'docs', 'research', 'CSAagenticsecuritypdf.pdf'),
      title: 'NIST CAISI',
      content: 'Enterprise Compliance Imperative',
    },
    {
      file: path.join(projectRoot, 'docs', 'research', 'NIST.AI.800-4.pdf'),
      title: 'Challenges to the Monitoring of Deployed AI Systems',
      content: 'Trustworthy and Responsible AI',
    },
  ];

  let appProcess;
  let logStream;
  try {
    logStream = fs.createWriteStream(logPath, { flags: 'a' });
    appProcess = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts', configPath], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NO_COLOR: '1',
      },
    });
    appProcess.stdout.pipe(logStream);
    appProcess.stderr.pipe(logStream);

    await waitForHealth(baseUrl);

    for (const expected of expectations) {
      const response = await requestJson(baseUrl, token, 'POST', '/api/tools/run', {
        toolName: 'fs_read',
        args: {
          path: expected.file,
          maxBytes: 4000,
        },
        origin: 'web',
      });

      assert.equal(response?.success, true, `${path.basename(expected.file)} should succeed`);
      assert.equal(response?.output?.mimeType, 'application/pdf', `${path.basename(expected.file)} should report PDF MIME`);
      assert.equal(typeof response?.output?.bytes, 'number', `${path.basename(expected.file)} should include byte count`);
      assert.equal(response?.output?.bytes > 0, true, `${path.basename(expected.file)} should report a positive byte count`);
      assert.equal(response?.output?.truncated, true, `${path.basename(expected.file)} should truncate to preview size`);
      assert.equal(typeof response?.output?.content, 'string', `${path.basename(expected.file)} should include text content`);
      assert.equal(response?.output?.content.length > 0, true, `${path.basename(expected.file)} should include non-empty text content`);
      assertIncludesNormalized(response?.output?.title, expected.title, `${path.basename(expected.file)} title`);
      assertIncludesNormalized(response?.output?.content, expected.content, `${path.basename(expected.file)} content`);
      console.log(`PASS ${path.basename(expected.file)} fs_read PDF extraction`);
    }

    console.log('PASS PDF read integration harness');
  } finally {
    if (appProcess && !appProcess.killed) {
      appProcess.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    logStream?.end();
    await provider.close();
  }
}

runHarness().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`FAIL test-pdf-read: ${message}`);
  process.exitCode = 1;
});
