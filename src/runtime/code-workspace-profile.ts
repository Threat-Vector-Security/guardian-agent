import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const MAX_READ_BYTES = 20_000;
const README_CANDIDATES = ['README.md', 'README', 'readme.md', 'readme'];
const MANIFEST_CANDIDATES = [
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  'nx.json',
  'vite.config.ts',
  'vite.config.js',
  'tsconfig.json',
  'jsconfig.json',
  'pyproject.toml',
  'requirements.txt',
  'Cargo.toml',
  'go.mod',
  'composer.json',
  'Gemfile',
  'mix.exs',
  'pom.xml',
  'Dockerfile',
];
const ENTRY_HINT_CANDIDATES = [
  'src',
  'app',
  'apps',
  'packages',
  'services',
  'server',
  'client',
  'frontend',
  'backend',
  'api',
  'web',
  'cmd',
];

export interface CodeWorkspaceProfile {
  repoName: string;
  repoKind: string;
  summary: string;
  stack: string[];
  manifests: string[];
  inspectedFiles: string[];
  topLevelEntries: string[];
  entryHints: string[];
  lastIndexedAt: number;
}

function readTextIfExists(path: string, maxBytes = MAX_READ_BYTES): string {
  if (!existsSync(path)) return '';
  try {
    return readFileSync(path, 'utf-8').slice(0, maxBytes);
  } catch {
    return '';
  }
}

function listTopLevelEntries(root: string): string[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => (
        entry.isDirectory()
        || entry.isFile()
        || entry.isSymbolicLink()
      ))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right))
      .slice(0, 20);
  } catch {
    return [];
  }
}

function findExistingFiles(root: string, candidates: string[]): string[] {
  return candidates.filter((name) => existsSync(join(root, name)));
}

function firstNonEmptyLine(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? '';
}

function extractReadmeSummary(readme: string): { title: string; summary: string } {
  if (!readme.trim()) return { title: '', summary: '' };
  const lines = readme.split(/\r?\n/);
  const titleLine = lines.find((line) => /^#\s+/.test(line.trim()))?.trim() ?? '';
  const title = titleLine.replace(/^#\s+/, '').trim();

  const bodyLines = lines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !/^[-*`]/.test(line));
  const summary = bodyLines.slice(0, 3).join(' ').replace(/\s+/g, ' ').trim();
  return { title, summary };
}

function parseJsonObject(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseTomlValue(text: string, key: string): string {
  const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*["']([^"'\\n]+)["']`, 'm'));
  return match?.[1]?.trim() ?? '';
}

function detectStack(manifests: string[], topLevelEntries: string[], packageJson: Record<string, unknown>): string[] {
  const stack = new Set<string>();
  const packageDeps = {
    ...(packageJson.dependencies && typeof packageJson.dependencies === 'object' ? packageJson.dependencies as Record<string, unknown> : {}),
    ...(packageJson.devDependencies && typeof packageJson.devDependencies === 'object' ? packageJson.devDependencies as Record<string, unknown> : {}),
  };
  const packageDepNames = Object.keys(packageDeps);

  if (manifests.includes('package.json')) stack.add('Node.js');
  if (manifests.includes('tsconfig.json') || packageDepNames.includes('typescript')) stack.add('TypeScript');
  if (packageDepNames.includes('next')) stack.add('Next.js');
  if (packageDepNames.includes('react')) stack.add('React');
  if (packageDepNames.includes('vite') || manifests.includes('vite.config.ts') || manifests.includes('vite.config.js')) stack.add('Vite');
  if (packageDepNames.includes('vue')) stack.add('Vue');
  if (packageDepNames.includes('svelte')) stack.add('Svelte');
  if (packageDepNames.includes('@nestjs/core')) stack.add('NestJS');
  if (packageDepNames.includes('express')) stack.add('Express');
  if (packageDepNames.includes('electron')) stack.add('Electron');
  if (manifests.includes('pyproject.toml') || manifests.includes('requirements.txt')) stack.add('Python');
  if (manifests.includes('Cargo.toml')) stack.add('Rust');
  if (manifests.includes('go.mod')) stack.add('Go');
  if (topLevelEntries.some((entry) => entry.endsWith('.sln') || entry.endsWith('.csproj'))) stack.add('.NET');
  if (manifests.includes('composer.json')) stack.add('PHP');
  if (manifests.includes('Gemfile')) stack.add('Ruby');
  if (manifests.includes('Dockerfile')) stack.add('Docker');
  if (topLevelEntries.includes('.github')) stack.add('GitHub Actions');

  return [...stack];
}

function detectRepoKind(topLevelEntries: string[], manifests: string[], stack: string[], packageJson: Record<string, unknown>): string {
  const packageJsonWorkspaces = Array.isArray(packageJson.workspaces)
    ? packageJson.workspaces
    : [];
  if (packageJsonWorkspaces.length > 0 || manifests.includes('pnpm-workspace.yaml') || manifests.includes('turbo.json') || manifests.includes('nx.json') || topLevelEntries.includes('packages')) {
    return 'monorepo';
  }
  if (stack.includes('Next.js') || stack.includes('React') || stack.includes('Vue') || topLevelEntries.includes('app') || topLevelEntries.includes('src')) {
    return 'application';
  }
  if (topLevelEntries.includes('lib') || topLevelEntries.includes('packages')) {
    return 'library';
  }
  if (topLevelEntries.includes('server') || topLevelEntries.includes('api') || topLevelEntries.includes('services')) {
    return 'service';
  }
  return 'project';
}

function detectEntryHints(root: string, topLevelEntries: string[], manifests: string[], packageJson: Record<string, unknown>): string[] {
  const hints = new Set<string>();
  for (const candidate of ENTRY_HINT_CANDIDATES) {
    if (topLevelEntries.includes(candidate)) hints.add(candidate);
  }

  const scripts = packageJson.scripts && typeof packageJson.scripts === 'object'
    ? packageJson.scripts as Record<string, unknown>
    : {};
  for (const name of ['dev', 'start', 'build', 'test', 'lint']) {
    if (typeof scripts[name] === 'string' && String(scripts[name]).trim()) {
      hints.add(`script:${name}`);
    }
  }

  for (const fileName of ['main.ts', 'main.tsx', 'index.ts', 'index.tsx', 'main.py', 'manage.py', 'main.go']) {
    if (existsSync(join(root, fileName)) || existsSync(join(root, 'src', fileName)) || existsSync(join(root, 'app', fileName))) {
      hints.add(fileName);
    }
  }

  if (manifests.includes('Cargo.toml')) hints.add('Cargo.toml');
  if (manifests.includes('go.mod')) hints.add('go.mod');
  if (manifests.includes('pyproject.toml')) hints.add('pyproject.toml');

  return [...hints].slice(0, 12);
}

function buildSummary(profile: {
  repoName: string;
  repoKind: string;
  stack: string[];
  readmeSummary: string;
  manifests: string[];
  entryHints: string[];
  topLevelEntries: string[];
}): string {
  const parts: string[] = [];
  const stackLabel = profile.stack.length > 0 ? profile.stack.join(', ') : 'unknown stack';
  parts.push(`${profile.repoName} looks like a ${profile.repoKind} using ${stackLabel}.`);
  if (profile.readmeSummary) {
    parts.push(`README says: ${profile.readmeSummary}`);
  }
  if (profile.manifests.length > 0) {
    parts.push(`Key manifests: ${profile.manifests.join(', ')}.`);
  }
  if (profile.entryHints.length > 0) {
    parts.push(`Likely entry/focus points: ${profile.entryHints.join(', ')}.`);
  } else if (profile.topLevelEntries.length > 0) {
    parts.push(`Top-level entries: ${profile.topLevelEntries.join(', ')}.`);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function inspectCodeWorkspaceSync(workspaceRoot: string, now = Date.now()): CodeWorkspaceProfile {
  const topLevelEntries = listTopLevelEntries(workspaceRoot);
  const manifests = findExistingFiles(workspaceRoot, MANIFEST_CANDIDATES);
  const readmeName = README_CANDIDATES.find((name) => existsSync(join(workspaceRoot, name))) ?? '';
  const readmeText = readmeName ? readTextIfExists(join(workspaceRoot, readmeName)) : '';
  const readmeMeta = extractReadmeSummary(readmeText);
  const packageJsonText = manifests.includes('package.json') ? readTextIfExists(join(workspaceRoot, 'package.json')) : '';
  const packageJson = packageJsonText ? parseJsonObject(packageJsonText) : {};
  const pyprojectText = manifests.includes('pyproject.toml') ? readTextIfExists(join(workspaceRoot, 'pyproject.toml')) : '';
  const cargoText = manifests.includes('Cargo.toml') ? readTextIfExists(join(workspaceRoot, 'Cargo.toml')) : '';
  const goModText = manifests.includes('go.mod') ? readTextIfExists(join(workspaceRoot, 'go.mod')) : '';

  const repoName = (
    (typeof packageJson.name === 'string' && packageJson.name.trim())
    || parseTomlValue(pyprojectText, 'name')
    || parseTomlValue(cargoText, 'name')
    || firstNonEmptyLine(goModText).replace(/^module\s+/, '').trim()
    || readmeMeta.title
    || basename(workspaceRoot)
  ).trim();

  const stack = detectStack(manifests, topLevelEntries, packageJson);
  const repoKind = detectRepoKind(topLevelEntries, manifests, stack, packageJson);
  const entryHints = detectEntryHints(workspaceRoot, topLevelEntries, manifests, packageJson);
  const inspectedFiles = [
    ...(readmeName ? [readmeName] : []),
    ...manifests,
  ];
  const summary = buildSummary({
    repoName,
    repoKind,
    stack,
    readmeSummary: readmeMeta.summary
      || (typeof packageJson.description === 'string' ? packageJson.description.trim() : '')
      || parseTomlValue(pyprojectText, 'description')
      || parseTomlValue(cargoText, 'description'),
    manifests,
    entryHints,
    topLevelEntries,
  });

  return {
    repoName,
    repoKind,
    summary,
    stack,
    manifests,
    inspectedFiles,
    topLevelEntries,
    entryHints,
    lastIndexedAt: now,
  };
}
