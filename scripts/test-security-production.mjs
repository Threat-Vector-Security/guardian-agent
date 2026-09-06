import { mkdtemp, cp, readFile, rm, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { createServer } from 'node:net';
import { promisify } from 'node:util';

const run = promisify(execFile);
const npmCli = process.env.npm_execpath ?? process.env.GUARDIAN_NPM_CLI;
if (!npmCli) throw new Error('Run through npm run test:production, or set GUARDIAN_NPM_CLI to npm-cli.js.');
const stage = await mkdtemp(join(tmpdir(), 'guardian-production-'));
let child;
let stderr = '';
try {
  const runtimeFiles = (await readdir('dist', { recursive: true })).filter(path => path.endsWith('.js'));
  if (!runtimeFiles.includes('security-main.js') || runtimeFiles.some(path => path === 'index.js' || path.includes('tools') || path.includes('channels'))) throw new Error(`Security build contains an unexpected runtime closure: ${runtimeFiles.length} JavaScript files`);
  await Promise.all(['package.json', 'package-lock.json', 'dist'].map(path => cp(path, join(stage, path), { recursive: true })));
  await mkdir(join(stage, 'web/security'), { recursive: true });
  await cp('web/security/dist', join(stage, 'web/security/dist'), { recursive: true });
  await run(process.execPath, [npmCli, 'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: stage, timeout: 120000, maxBuffer: 2 * 1024 * 1024 });
  await run(process.execPath, ['dist/security-main.js', 'init', '--data-dir', 'state'], { cwd: stage, timeout: 10000 });
  const reservation = createServer();
  await new Promise(done => reservation.listen(0, '127.0.0.1', done));
  const port = reservation.address().port;
  await new Promise(done => reservation.close(done));
  child = spawn(process.execPath, ['dist/security-main.js', 'serve', '--data-dir', 'state', '--port', String(port)], { cwd: stage, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_PATH: '', GUARDIAN_ENTRA_TENANT_ID: '' } });
  child.stdout.resume(); child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-5000); });
  const url = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Production service exited: ${stderr}`);
    try { ready = (await fetch(`${url}/health`)).ok; } catch {}
    if (ready) break;
    await new Promise(done => setTimeout(done, 100));
  }
  if (!ready) throw new Error(`Production service failed to become ready: ${stderr}`);
  const token = (await readFile(join(stage, 'state/admin-token.txt'), 'utf8')).trim();
  const login = await fetch(`${url}/api/v1/session`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: url }, body: JSON.stringify({ token }) });
  if (!login.ok) throw new Error('Production administrator sign-in failed');
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const result = await fetch(`${url}/api/v1/operations`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: url, Cookie: cookie }, body: JSON.stringify({ operation: 'projects.create', input: { name: 'Production packaging check' } }) });
  if (!result.ok || !(await result.json()).result?.project?.id) throw new Error('Production operation failed');
  const page = await fetch(url);
  if (!page.ok || !(await page.text()).includes('Guardian Agent')) throw new Error('Packaged UI unavailable');
  console.log('Production-only clean install, SQLite bootstrap, service startup, administrator session, project mutation and packaged UI passed.');
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise(done => child.once('exit', done));
  }
  const canonical = resolve(stage);
  if (!canonical.startsWith(resolve(tmpdir()) + sep + 'guardian-production-')) throw new Error('Unexpected cleanup path');
  await rm(canonical, { recursive: true, force: true });
}
