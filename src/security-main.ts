#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const command = args[0] ?? 'serve';
const option = (name: string): string | undefined => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const dataDir = resolve(option('--data-dir') ?? process.env['GUARDIAN_SECURITY_HOME'] ?? join(homedir(), '.guardianagent', 'security-v2'));
const root = fileURLToPath(new URL('../', import.meta.url));
async function main(): Promise<void> {
  if (args.includes('--help') || command === 'help') {
    console.log(`Guardian Agent 2 — local security and architecture workspace

guardianagent init [--data-dir PATH]       Create local administrator credential; prints its file path
guardianagent init --rotate-admin         Deliberately rotate root credentials locally; retain previous file
guardianagent serve [--port 3000]          Start the loopback security UI/API; no model required
guardianagent operations                  List this credential's allowed operations as JSON
guardianagent call OPERATION [JSON]       Execute a structured operation; --input-file FILE is supported
guardianagent call OPERATION --admin      Use an explicit administrator session
guardianagent import FILE --name NAME     Import a complete ContextCypher workspace
guardianagent export ID --format FORMAT   Write guardian/contextcypher/original JSON to stdout
guardianagent mcp                         Start scoped MCP over stdio

Set GUARDIAN_TOKEN_FILE (preferred) or GUARDIAN_TOKEN and GUARDIAN_URL for client commands.
The administrator bootstrap file must never be configured as an assistant credential.
`);
    return;
  }
  if (command === 'init') {
    const { SecurityStore } = await import('./security-workspace/store.js');
    const store = new SecurityStore(dataDir);
    try {
      const path = join(dataDir, 'admin-token.txt');
      store.bootstrapAdministrator(path, args.includes('--rotate-admin'));
      console.log(`Administrator credential saved to ${path}. Open the UI and paste its contents to sign in. Keep this file private.`);
    } finally { store.close(); }
    return;
  }
  if (command === 'serve') {
    const port = Number(option('--port') ?? process.env['GUARDIAN_PORT'] ?? 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
    const accountId = process.env['GUARDIAN_AWS_ACCOUNT_ID'];
    const region = process.env['GUARDIAN_AWS_REGION'];
    const profile = process.env['GUARDIAN_AWS_PROFILE'];
    if ((accountId || region || profile) && (!accountId || !region)) throw new Error('AWS integration requires both GUARDIAN_AWS_ACCOUNT_ID and GUARDIAN_AWS_REGION.');
    const [{ SecurityStore }, { SecurityWorkspace }, { SecurityCollectors }, { startSecurityServer }] = await Promise.all([
      import('./security-workspace/store.js'), import('./security-workspace/service.js'),
      import('./security-workspace/collectors.js'), import('./security-workspace/server.js'),
    ]);
    const aws = accountId && region ? new (await import('./security-workspace/aws-security.js')).AwsSecurityIntegration({ accountId, region, ...(profile ? { profile } : {}) }) : undefined;
    const store = new SecurityStore(dataDir);
    if (!store.clients().some(client => client.role === 'admin' && !client.revoked && client.expiresAt > Date.now())) { store.close(); throw new Error('Run guardianagent init before starting the service.'); }
    const collectors = new SecurityCollectors(dataDir);
    await collectors.initialize();
    const tenantId = process.env['GUARDIAN_ENTRA_TENANT_ID'];
    const groups = (key: string) => (process.env[key] ?? '').split(',').map(value => value.trim()).filter(Boolean);
    const entra = tenantId ? new (await import('./security-workspace/entra-oidc.js')).EntraOidc({
      tenantId, clientId: process.env['GUARDIAN_ENTRA_CLIENT_ID'] ?? '', clientSecret: process.env['GUARDIAN_ENTRA_CLIENT_SECRET'],
      redirectUri: `http://127.0.0.1:${port}/api/v1/auth/entra/callback`,
      adminGroupIds: groups('GUARDIAN_ENTRA_ADMIN_GROUPS'), operatorGroupIds: groups('GUARDIAN_ENTRA_OPERATOR_GROUPS'), viewerGroupIds: groups('GUARDIAN_ENTRA_VIEWER_GROUPS'),
    }) : undefined;
    const workspace = new SecurityWorkspace(store, collectors, aws, { entraEnabled: !!entra });
    let running;
    try { running = await startSecurityServer(workspace, { port, webRoot: resolve(root, 'web/security/dist'), entra }); }
    catch (error) { await workspace.close(); store.close(); throw error; }
    console.log(`Guardian Agent security workspace: ${running.origin}\nData directory: ${dataDir}\nPeriodic posture collection is available through Protection. Coverage is partial; see collector status.`);
    let stopping = false;
    workspace.poll();
    const interval = setInterval(() => workspace.poll(), 60000);
    interval.unref();
    const stop = async () => { if (stopping) return; stopping = true; clearInterval(interval); await running.close(); store.close(); };
    process.once('SIGINT', () => { void stop().catch(console.error); });
    process.once('SIGTERM', () => { void stop().catch(console.error); });
    return;
  }
  const { SecurityClient } = await import('./security-workspace/client.js');
  const client = await SecurityClient.fromEnvironment(option('--url'));
  if (command === 'mcp') {
    if (args.includes('--admin')) throw new Error('MCP cannot use administrative sessions');
    const { startSecurityMcp } = await import('./security-workspace/mcp.js');
    await startSecurityMcp(client); return;
  }
  if (args.includes('--admin')) await client.loginAdmin();
  let result: unknown;
  if (command === 'operations') result = await client.operations();
  else if (command === 'call') {
    const op = args[1]; if (!op || op.startsWith('--')) throw new Error('Operation name required');
    const inputFile = option('--input-file');
    const json = inputFile ? await readFile(inputFile, 'utf8') : args[2]?.startsWith('{') ? args[2] : '{}';
    result = await client.execute(op, JSON.parse(json) as Record<string, unknown>);
  } else if (command === 'import') {
    if (!args[1]) throw new Error('File required');
    result = await client.execute('projects.import', { name: option('--name') ?? 'Imported system', content: await readFile(args[1], 'utf8') });
  } else if (command === 'export') {
    const exported = await client.execute('projects.export', { id: args[1] }) as { document: unknown; original: string; guardian: string };
    const format = option('--format') ?? 'guardian';
    if (!['guardian', 'contextcypher', 'original'].includes(format)) throw new Error('Format must be guardian, contextcypher or original');
    process.stdout.write(format === 'original' ? exported.original : format === 'guardian' ? exported.guardian : JSON.stringify(exported.document));
    return;
  } else throw new Error(`Unknown command: ${command}`);
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
