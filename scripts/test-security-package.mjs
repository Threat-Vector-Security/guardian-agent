import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { preparePackage } from './package-security.mjs';
const run = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), 'guardian-package-check-'));
try {
  const source = join(root, 'source with spaces');
  for (const directory of ['dist/security-workspace', 'web/security/dist/assets', 'web/contextcypher/src/data/security-knowledge-base', 'docs/guides', 'policies']) await mkdir(join(source, directory), { recursive: true });
  const fixture = {
    'package.json': JSON.stringify({ name: 'guardianagent', version: '2.0.0-alpha.1', type: 'module', main: 'dist/security-main.js', dependencies: {}, devDependencies: { example: '1.0.0' }, scripts: { postinstall: 'DO NOT RUN' } }),
    'package-lock.json': JSON.stringify({ name: 'guardianagent', version: '2.0.0-alpha.1', lockfileVersion: 3, packages: { '': { dependencies: {}, devDependencies: { example: '1.0.0' } }, 'node_modules/example': { version: '1.0.0', dev: true } } }),
    'dist/security-main.js': "import './security-workspace/helper.js';\nconsole.log(JSON.stringify(process.argv.slice(2)));",
    'dist/security-workspace/helper.js': 'export const value = 1;',
    'dist/index.js': 'throw new Error("legacy");',
    'dist/security-main.js.map': 'private source paths',
    '.env': 'SECRET',
    'web/security/dist/index.html': '<title>Guardian Agent</title>',
    'web/security/dist/assets/app.js': 'console.log("UI");',
    'LICENSE': 'Apache-2.0',
    'web/contextcypher/NOTICE.md': 'ContextCypher attribution',
    'web/contextcypher/src/data/security-knowledge-base/README.md': 'Dataset attribution; redistribution terms require review.',
    'policies/aws-security-readonly.json': '{"Version":"2012-10-17","Statement":[]}',
    'docs/guides/SECURITY-WORKSPACE.md': 'Operator guide',
    'docs/guides/SECURITY-PACKAGING.md': 'Packaging guide',
  };
  for (const [path, text] of Object.entries(fixture)) await writeFile(join(source, path), text);
  const output = join(root, 'release with spaces');
  const result = await preparePackage(source, output);
  assert(result.copied.includes('dist/security-workspace/helper.js'));
  assert.deepEqual((await readdir(join(output, 'dist'))).sort(), ['security-main.js', 'security-workspace']);
  assert(!(await readdir(output)).includes('.env'));
  const manifest = JSON.parse(await readFile(join(output, 'package.json'), 'utf8'));
  assert.equal(manifest.devDependencies, undefined); assert.equal(manifest.scripts.postinstall, undefined);
  for (const path of ['web/contextcypher/NOTICE.md', 'web/contextcypher/src/data/security-knowledge-base/README.md']) {
    assert(result.copied.includes(path));
    assert(manifest.files.includes(path));
    assert.equal(await readFile(join(output, path), 'utf8'), fixture[path]);
  }
  const lock = JSON.parse(await readFile(join(output, 'npm-shrinkwrap.json'), 'utf8'));
  assert.equal(lock.packages['node_modules/example'], undefined);
  const args = ['--help', '--data-dir', join(root, 'state with spaces')];
  const direct = await run(process.execPath, [join(output, 'guardian-launch.mjs'), ...args], { cwd: tmpdir() });
  assert.deepEqual(JSON.parse(direct.stdout.trim()), ['serve', ...args, '--data-dir', args[2]]);
  let platform;
  if (process.platform === 'win32') {
    // Exercise cmd's real quoting semantics, including a launcher and argument with spaces.
    platform = await run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `""${join(output, 'Guardian.cmd')}" --help --data-dir "${args[2]}""`], { windowsVerbatimArguments: true, cwd: tmpdir() });
  } else {
    platform = await run('/bin/sh', [join(output, 'Guardian.command'), ...args], { cwd: tmpdir() });
  }
  assert.deepEqual(JSON.parse(platform.stdout.trim()), ['serve', ...args, '--data-dir', args[2]]);
  await assert.rejects(preparePackage(source, output), /EEXIST/);
  await writeFile(join(source, 'dist/security-main.js'), "await import(process.env.UNTRUSTED_MODULE);");
  await assert.rejects(preparePackage(source, join(root, 'dynamic')), /Unresolved dynamic dependency/);
  await writeFile(join(source, 'dist/security-main.js'), "import './index.js';");
  await assert.rejects(preparePackage(source, join(root, 'legacy')), /Disallowed runtime module/);
  await writeFile(join(source, 'dist/security-main.js'), "import '../../escape.js';");
  await assert.rejects(preparePackage(source, join(root, 'escape')), /Path escapes/);
  console.log(`Packaging allowlist, production metadata, failure cases and actual ${process.platform} launcher with spaced paths passed.`);
} finally {
  const path = resolve(root);
  if (!path.startsWith(resolve(tmpdir()) + sep + 'guardian-package-check-')) throw new Error('Unsafe test cleanup path');
  await rm(path, { recursive: true, force: true });
}
