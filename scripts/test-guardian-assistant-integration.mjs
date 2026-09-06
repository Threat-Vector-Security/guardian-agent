// Real scoped MCP/CLI contract against a running local preview. Diagram content is supplied by the caller.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SecurityClient } from '../dist/security-workspace/client.js';

const [inputFile, administratorFile] = process.argv.slice(2);
if (!inputFile || !administratorFile) throw new Error('Usage: node scripts/test-guardian-assistant-integration.mjs <diagram.json> <preview-admin-token-file>');
const url = process.env.GUARDIAN_UI_URL || 'http://127.0.0.1:3007';
const original = await readFile(inputFile, 'utf8');
const document = JSON.parse(original);
const admin = new SecurityClient(url, (await readFile(administratorFile, 'utf8')).trim());
await admin.loginAdmin();
const grant = await admin.execute('clients.create', { name: 'Codex diagram verification', scopes: ['projects:read', 'projects:write'], expiresInDays: 1 });
const token = grant.token;
assert.equal(typeof token, 'string');
const client = new Client({ name: 'codex-guardian-integration-verification', version: '1.0.0' });
const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('dist/security-main.js'), 'mcp'], env: { SystemRoot: process.env.SystemRoot || '', PATH: process.env.PATH || '', GUARDIAN_URL: url, GUARDIAN_TOKEN: token }, stderr: 'pipe' });
let output;
try {
  await client.connect(transport);
  const tools = await client.listTools();
  assert(tools.tools.some(tool => tool.name === 'guardian_projects_import'));
  assert(!tools.tools.some(tool => /clients|approve|configure/.test(tool.name)));
  const call = async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    assert(!result.isError, JSON.stringify(result.content));
    return JSON.parse(result.content.find(item => item.type === 'text').text);
  };
  const imported = await call('guardian_projects_import', { name: document.systemName, content: original });
  const id = imported.project.id;
  const loaded = await call('guardian_projects_get', { id });
  assert.deepEqual(loaded.project.document, document);
  const updated = structuredClone(document);
  updated.metadata = { ...updated.metadata, integrationVerification: { client: 'Codex via scoped MCP', verified: true } };
  const saved = await call('guardian_projects_update', { id, revision: loaded.project.revision, document: updated });
  assert.equal(saved.project.revision, loaded.project.revision + 1);
  const exported = await call('guardian_projects_export', { id });
  assert.deepEqual(exported.document, updated);
  assert.equal(exported.original, original);
  const stale = await client.callTool({ name: 'guardian_projects_update', arguments: { id, revision: loaded.project.revision, document } });
  assert.equal(stale.isError, true);
  const denied = await client.callTool({ name: 'guardian_clients_create', arguments: { name: 'unauthorized', scopes: ['projects:write'] } });
  assert.equal(denied.isError, true);
  // Exercise the actual CLI process using the same scoped credential, without printing its secret.
  const { stdout } = await promisify(execFileCallback)(process.execPath, [resolve('dist/security-main.js'), 'call', 'projects.get', JSON.stringify({ id })], {
    env: { SystemRoot: process.env.SystemRoot || '', PATH: process.env.PATH || '', GUARDIAN_URL: url, GUARDIAN_TOKEN: token },
    timeout: 15000, windowsHide: true, maxBuffer: 2 * 1024 * 1024,
  });
  const readBack = JSON.parse(stdout);
  assert.deepEqual(readBack.project.document.nodes, document.nodes);
  assert.deepEqual(readBack.project.document.edges, document.edges);
  output = { projectId: id, url: `${url}/#systems?project=${id}`, nodeCount: document.nodes.length, edgeCount: document.edges.length, revision: saved.project.revision, exactNodeAndEdgeData: true, originalPreserved: true, staleRevisionRejected: true, administrativeToolRejected: true };
  await writeFile(resolve('tmp/codex-diagram-verification.json'), JSON.stringify(output, null, 2));
} finally {
  await client.close();
  await admin.execute('clients.revoke', { id: grant.client.id });
}
console.log(JSON.stringify(output, null, 2));
