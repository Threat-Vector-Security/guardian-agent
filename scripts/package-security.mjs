import { mkdir, readFile, writeFile, readdir, lstat, copyFile, chmod, realpath } from 'node:fs/promises';
import { resolve, relative, dirname, join, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { isDeepStrictEqual, promisify } from 'node:util';
import ts from 'typescript';

const run = promisify(execFile);
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function within(root, path) {
  const rel = relative(root, path);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`) || resolve(root, rel) !== path) throw new Error(`Path escapes package input: ${path}`);
}
async function regular(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Package input must be a regular file: ${path}`);
}

// Compile-time dependency discovery uses the installed TypeScript parser, never executes app code.
export async function preparePackage(source, destination) {
  source = await realpath(resolve(source)); destination = resolve(destination);
  const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
  if (manifest.main !== 'dist/security-main.js') throw new Error('Refusing to package the legacy assistant');
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$/.test(manifest.version)) throw new Error('Invalid package version');
  await mkdir(destination); // Never overwrite a prior release or delete an existing directory.
  const copied = [];
  async function copy(path) {
    const input = resolve(source, path); within(source, input); within(source, await realpath(input)); await regular(input);
    const output = resolve(destination, path); within(destination, output);
    await mkdir(dirname(output), { recursive: true }); await copyFile(input, output); copied.push(path.replaceAll('\\', '/'));
  }
  const pending = ['dist/security-main.js']; const seen = new Set();
  while (pending.length) {
    const path = pending.pop(); if (seen.has(path)) continue; seen.add(path);
    if (!path.startsWith('dist/') || !path.endsWith('.js') || /(?:^|\/)(?:index|.*\.test)\.js$/.test(path)) throw new Error(`Disallowed runtime module: ${path}`);
    await copy(path);
    const text = await readFile(resolve(source, path), 'utf8');
    const ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    function dependency(value) {
      if (value.startsWith('.')) {
        const target = resolve(source, dirname(path), value); within(resolve(source, 'dist'), target);
        pending.push(relative(source, target).replaceAll('\\', '/'));
      } else if (!value.startsWith('node:')) {
        const name = value.startsWith('@') ? value.split('/').slice(0, 2).join('/') : value.split('/')[0];
        if (!Object.hasOwn(manifest.dependencies ?? {}, name)) throw new Error(`Runtime dependency missing from production manifest: ${name}`);
      }
    }
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) dependency(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        if (node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0])) throw new Error(`Unresolved dynamic dependency in ${path}`);
        dependency(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  async function assets(path) {
    for (const entry of await readdir(join(source, path), { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Symlink in UI distribution');
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) await assets(child);
      else if (/\.(?:html|js|css|svg|png|ico|woff2?)$/.test(entry.name)) await copy(child);
      else throw new Error(`Unexpected UI asset: ${child}`);
    }
  }
  await regular(join(source, 'web/security/dist/index.html'));
  await assets('web/security/dist');
  const notices = ['web/contextcypher/NOTICE.md', 'web/contextcypher/src/data/security-knowledge-base/README.md'];
  for (const path of notices) await copy(path);
  for (const path of ['LICENSE', 'docs/guides/SECURITY-WORKSPACE.md', 'docs/guides/SECURITY-PACKAGING.md', 'policies/aws-security-readonly.json']) await copy(path);
  const production = { ...manifest, scripts: { start: 'node guardian-launch.mjs', init: 'node dist/security-main.js init' }, files: ['dist/', 'web/security/dist/', 'docs/guides/', 'policies/aws-security-readonly.json', 'LICENSE', ...notices, 'guardian-launch.mjs', 'Guardian.cmd', 'Guardian.command', 'npm-shrinkwrap.json'], devDependencies: undefined };
  const lock = JSON.parse(await readFile(join(source, 'package-lock.json'), 'utf8'));
  if (!lock.packages?.['']) throw new Error('A current npm lockfile is required');
  if (!isDeepStrictEqual(lock.packages[''].dependencies, manifest.dependencies)) throw new Error('Production dependencies and lockfile differ; run npm install --package-lock-only first');
  delete lock.packages[''].devDependencies;
  for (const [name, pkg] of Object.entries(lock.packages)) if (name && pkg.dev === true) delete lock.packages[name];
  const launcher = `import { spawnSync } from 'node:child_process';\nimport { existsSync } from 'node:fs';\nimport { homedir } from 'node:os';\nimport { resolve, join } from 'node:path';\nimport { fileURLToPath } from 'node:url';\nconst [major, minor] = process.versions.node.split('.').map(Number);\nif (major < 24 || (major === 24 && minor < 14)) throw new Error('Guardian requires Node.js 24.14.0 or newer');\nconst root = fileURLToPath(new URL('./', import.meta.url));\nconst entry = join(root, 'dist/security-main.js');\nconst args = process.argv.slice(2);\nconst index = args.indexOf('--data-dir');\nif (index >= 0 && !args[index + 1]) throw new Error('--data-dir requires a path');\nconst data = resolve(index >= 0 ? args[index + 1] : process.env.GUARDIAN_SECURITY_HOME || join(homedir(), '.guardianagent/security-v2'));\nconst run = (args) => { const child = spawnSync(process.execPath, [entry, ...args], { stdio: 'inherit', cwd: root }); if (child.error) throw child.error; if (child.status !== 0) process.exit(child.status ?? 1); };\nif (!existsSync(join(data, 'admin-token.txt')) && !args.includes('--help')) run(['init', '--data-dir', data]);\nrun(['serve', ...args, '--data-dir', data]);\n`;
  await writeFile(join(destination, 'package.json'), JSON.stringify(production, null, 2) + '\n');
  await writeFile(join(destination, 'npm-shrinkwrap.json'), JSON.stringify(lock, null, 2) + '\n');
  await writeFile(join(destination, 'guardian-launch.mjs'), launcher);
  await writeFile(join(destination, 'Guardian.cmd'), '@echo off\r\nsetlocal DisableDelayedExpansion\r\nnode "%~dp0guardian-launch.mjs" %*\r\nexit /b %errorlevel%\r\n');
  await writeFile(join(destination, 'Guardian.command'), '#!/bin/sh\nset -eu\ncd -- "$(dirname -- "$0")"\nexec node "./guardian-launch.mjs" "$@"\n');
  await chmod(join(destination, 'Guardian.command'), 0o755); await chmod(join(destination, 'dist/security-main.js'), 0o755);
  return { destination, copied, version: manifest.version };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 24 || (major === 24 && minor < 14)) throw new Error('Packaging requires Node.js 24.14.0 or newer on PATH.');
  const npm = process.env.npm_execpath ?? process.env.GUARDIAN_NPM_CLI;
  if (!npm) throw new Error('Run via npm run package:security');
  await run(process.execPath, [npm, 'run', 'build'], { cwd: repository, timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
  const manifest = JSON.parse(await readFile(join(repository, 'package.json'), 'utf8'));
  const parent = join(repository, 'build/security'); await mkdir(parent, { recursive: true });
  const stage = join(parent, `guardianagent-${manifest.version}-${process.platform}-${process.arch}`);
  await preparePackage(repository, stage);
  await run(process.execPath, [npm, 'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: stage, timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
  await run(process.execPath, ['guardian-launch.mjs', '--help'], { cwd: stage, timeout: 20000 });
  await run(process.execPath, [npm, 'pack', '--ignore-scripts', '--pack-destination', parent], { cwd: stage, timeout: 60000 });
  console.log(`Security distribution ready: ${stage}\nTarball: ${join(parent, `guardianagent-${manifest.version}.tgz`)}\nUnsigned local distribution; no services or runtime installed.`);
}
