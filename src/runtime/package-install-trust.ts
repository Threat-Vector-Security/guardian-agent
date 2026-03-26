import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, extname, posix } from 'node:path';
import { gunzipSync, inflateRawSync } from 'node:zlib';
import { splitCommands, tokenize } from '../guardian/shell-validator.js';

export type PackageInstallTrustState = 'trusted' | 'caution' | 'blocked';
export type PackageInstallFindingSeverity = 'low' | 'medium' | 'high' | 'critical';
export type PackageInstallEcosystem = 'npm' | 'pip';
export type PackageInstallArtifactKind = 'npm_tgz' | 'python_wheel' | 'python_sdist' | 'archive' | 'file';
export type PackageInstallSourceKind = 'registry' | 'direct_url' | 'vcs' | 'local_path' | 'unknown';
export type PackageInstallTargetKind = 'working_directory' | 'explicit_directory' | 'user' | 'global';

export interface PackageInstallNativeProtection {
  provider: 'windows_defender' | 'clamav' | 'native_av';
  status: 'pending' | 'clean' | 'detected' | 'unavailable' | 'error';
  summary: string;
  observedAt: number;
  requestedAt?: number;
  details?: string[];
}

export interface PackageInstallTrustReview {
  acceptedAt: number;
  actor: 'operator';
  reason: string;
}

export interface PackageInstallFinding {
  id: string;
  category: string;
  state: PackageInstallTrustState;
  severity: PackageInstallFindingSeverity;
  title: string;
  summary: string;
  evidence?: Record<string, unknown>;
}

export interface PackageInstallSourceSpec {
  raw: string;
  sourceKind: PackageInstallSourceKind;
  packageName?: string;
  requestedVersion?: string;
}

export interface PackageInstallTarget {
  kind: PackageInstallTargetKind;
  path?: string;
}

export interface PackageInstallCommandInvocation {
  command: string;
  args: string[];
  display: string;
}

export interface ManagedPackageInstallPlan {
  ecosystem: PackageInstallEcosystem;
  manager: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'pip' | 'pip3' | 'python-pip';
  originalCommand: string;
  normalizedCommand: string;
  runnerPrefix: string[];
  action: string;
  packageSpecs: string[];
  sourceSpecs: PackageInstallSourceSpec[];
  installOptionTokens: string[];
  stageOptionTokens: string[];
  installTarget: PackageInstallTarget;
}

export interface ManagedPackageInstallPlanResult {
  success: boolean;
  plan?: ManagedPackageInstallPlan;
  error?: string;
}

export interface PackageInstallInspectedArtifact {
  fileName: string;
  filePath: string;
  artifactKind: PackageInstallArtifactKind;
  packageName?: string;
  packageVersion?: string;
  entryCount: number;
  notableFiles: string[];
  findings: PackageInstallFinding[];
  limitations: string[];
  summary: string;
}

export interface PackageInstallAssessment {
  state: PackageInstallTrustState;
  summary: string;
  findings: PackageInstallFinding[];
  artifacts: PackageInstallInspectedArtifact[];
  limitations: string[];
  fingerprint: string;
}

interface OptionSpec {
  includeInStage: boolean;
  expectsValue?: boolean;
  targetKind?: PackageInstallTargetKind;
}

interface ParsedOptionState {
  installOptionTokens: string[];
  stageOptionTokens: string[];
  packageSpecs: string[];
  installTarget: PackageInstallTarget;
}

interface ArchiveEntry {
  path: string;
  size: number;
  data?: Buffer;
}

const MAX_TEXT_ENTRY_BYTES = 128_000;
const MAX_SCANNED_TEXT_FILES = 60;
const MAX_SCANNED_TEXT_BYTES = 1_000_000;

const NPM_INSTALL_SCRIPTS = new Set(['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'postpack']);
const TEXT_ENTRY_EXTENSIONS = new Set([
  '.cjs',
  '.cmd',
  '.conf',
  '.config',
  '.css',
  '.html',
  '.ini',
  '.js',
  '.json',
  '.jsx',
  '.mjs',
  '.ps1',
  '.py',
  '.rb',
  '.sh',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
  '.toml',
]);
const BINARY_ENTRY_EXTENSIONS = new Set([
  '.dll',
  '.dylib',
  '.exe',
  '.jar',
  '.node',
  '.so',
]);

const NPM_OPTION_SPECS: Record<string, OptionSpec> = {
  '-d': { includeInStage: false },
  '--save-dev': { includeInStage: false },
  '-o': { includeInStage: false },
  '--save-optional': { includeInStage: false },
  '--no-save': { includeInStage: false },
  '-e': { includeInStage: false },
  '--save-exact': { includeInStage: false },
  '-g': { includeInStage: false, targetKind: 'global' },
  '--global': { includeInStage: false, targetKind: 'global' },
  '--prefix': { includeInStage: false, expectsValue: true, targetKind: 'explicit_directory' },
  '--ignore-scripts': { includeInStage: false },
  '--registry': { includeInStage: true, expectsValue: true },
};

const PNPM_OPTION_SPECS: Record<string, OptionSpec> = {
  '-d': { includeInStage: false },
  '--save-dev': { includeInStage: false },
  '-o': { includeInStage: false },
  '--save-optional': { includeInStage: false },
  '--ignore-scripts': { includeInStage: false },
  '-g': { includeInStage: false, targetKind: 'global' },
  '--global': { includeInStage: false, targetKind: 'global' },
  '--prefix': { includeInStage: false, expectsValue: true, targetKind: 'explicit_directory' },
  '--registry': { includeInStage: true, expectsValue: true },
};

const YARN_OPTION_SPECS: Record<string, OptionSpec> = {
  '-d': { includeInStage: false },
  '--dev': { includeInStage: false },
  '-e': { includeInStage: false },
  '--exact': { includeInStage: false },
  '-o': { includeInStage: false },
  '--optional': { includeInStage: false },
  '--ignore-scripts': { includeInStage: false },
  '--registry': { includeInStage: true, expectsValue: true },
};

const BUN_OPTION_SPECS: Record<string, OptionSpec> = {
  '-d': { includeInStage: false },
  '--dev': { includeInStage: false },
  '-o': { includeInStage: false },
  '--optional': { includeInStage: false },
  '--exact': { includeInStage: false },
  '--registry': { includeInStage: true, expectsValue: true },
};

const PIP_OPTION_SPECS: Record<string, OptionSpec> = {
  '--user': { includeInStage: false, targetKind: 'user' },
  '--target': { includeInStage: false, expectsValue: true, targetKind: 'explicit_directory' },
  '-t': { includeInStage: false, expectsValue: true, targetKind: 'explicit_directory' },
  '--prefix': { includeInStage: false, expectsValue: true, targetKind: 'explicit_directory' },
  '--root': { includeInStage: false, expectsValue: true, targetKind: 'explicit_directory' },
  '--no-deps': { includeInStage: true },
  '--upgrade': { includeInStage: false },
  '-u': { includeInStage: false },
  '--pre': { includeInStage: true },
  '--index-url': { includeInStage: true, expectsValue: true },
  '-i': { includeInStage: true, expectsValue: true },
  '--extra-index-url': { includeInStage: true, expectsValue: true },
  '--trusted-host': { includeInStage: true, expectsValue: true },
  '--no-binary': { includeInStage: true, expectsValue: true },
  '--only-binary': { includeInStage: true, expectsValue: true },
};

const BLOCKED_TEXT_PATTERNS = [
  {
    category: 'fetch_pipe_exec',
    title: 'Fetch-and-exec shell pipeline',
    regex: /\b(?:curl|wget)\b[^\n]{0,200}\|\s*(?:bash|sh|zsh|fish)\b/i,
    summary: 'Package content contains a fetch-and-exec shell pipeline.',
  },
  {
    category: 'powershell_inline_exec',
    title: 'Inline PowerShell execution',
    regex: /\b(?:Invoke-WebRequest|Start-BitsTransfer)\b[\s\S]{0,160}\b(?:IEX|Invoke-Expression)\b/i,
    summary: 'Package content contains inline PowerShell download-and-execute behavior.',
  },
  {
    category: 'encoded_exec',
    title: 'Encoded execution chain',
    regex: /\b(?:powershell(?:\.exe)?\s+-e(?:n|nc|ncodedcommand)?|FromBase64String|Buffer\.from\([^)]*base64)\b[\s\S]{0,180}\b(?:eval|Function|exec|spawn|cmd\.exe|\/bin\/sh)\b/i,
    summary: 'Package content combines encoded payload decoding with execution primitives.',
  },
];

const COMMAND_EXEC_PATTERN = /\b(?:child_process\.(?:exec|execFile|spawn)|subprocess\.(?:Popen|run|call)|os\.system|execvp?|spawnvp?)\b/i;
const NETWORK_FETCH_PATTERN = /\b(?:fetch\s*\(|axios\.(?:get|post)|https?\.(?:get|request)\b|urllib\.request\.urlopen|requests\.(?:get|post)\b|Invoke-WebRequest|Start-BitsTransfer)\b/i;

export function isInstallLikePackageManagerCommand(command: string): boolean {
  const normalized = command.trim();
  if (!normalized) return false;
  let tokens: string[] = [];
  try {
    tokens = tokenize(normalized).map((token) => token.toLowerCase());
  } catch {
    return false;
  }
  if (tokens.length === 0) return false;
  const [first, second, third, fourth] = tokens;
  return (
    (first === 'npm' && ['install', 'i', 'ci', 'add', 'exec'].includes(second ?? ''))
    || (first === 'pnpm' && ['install', 'i', 'add', 'dlx', 'exec'].includes(second ?? ''))
    || (first === 'yarn' && ['install', 'add', 'dlx'].includes(second ?? ''))
    || (first === 'bun' && ['install', 'add', 'x'].includes(second ?? ''))
    || ((first === 'pip' || first === 'pip3') && ['install', 'download'].includes(second ?? ''))
    || ((first === 'python' || first === 'python3' || first === 'py') && second === '-m' && third === 'pip' && ['install', 'download'].includes(fourth ?? ''))
    || (first === 'uv' && (
      ['add', 'sync'].includes(second ?? '')
      || (second === 'pip' && ['install', 'sync'].includes(third ?? ''))
      || (second === 'tool' && ['install', 'run'].includes(third ?? ''))
    ))
    || (first === 'cargo' && ['install', 'add'].includes(second ?? ''))
    || (first === 'go' && ['get', 'install'].includes(second ?? ''))
    || (first === 'composer' && ['install', 'require', 'update'].includes(second ?? ''))
    || (first === 'bundle' && second === 'install')
    || (first === 'gem' && second === 'install')
    || (first === 'dotnet' && ['restore', 'add', 'tool'].includes(second ?? ''))
  );
}

export function parseManagedPackageInstallCommand(command: string): ManagedPackageInstallPlanResult {
  const normalized = command.trim();
  if (!normalized) {
    return {
      success: false,
      error: 'command is required',
    };
  }

  let parsed;
  let tokens: string[];
  try {
    tokens = tokenize(normalized);
    if (tokens.includes('$(') || tokens.includes('`')) {
      return {
        success: false,
        error: 'Managed package installs do not allow subshell or command-substitution syntax.',
      };
    }
    parsed = splitCommands(tokens);
  } catch {
    return {
      success: false,
      error: 'The install command could not be parsed safely.',
    };
  }

  if (parsed.length !== 1) {
    return {
      success: false,
      error: 'Managed package installs only support a single direct package-manager command with no chaining or subshells.',
    };
  }
  const entry = parsed[0]!;
  if (entry.redirects.length > 0) {
    return {
      success: false,
      error: 'Managed package installs do not allow shell redirects.',
    };
  }

  const commandName = entry.command.trim().toLowerCase();
  if (commandName === 'npm') {
    return parseNodePlan(normalized, ['npm'], entry.args, 'npm', new Set(['install', 'i', 'add']), NPM_OPTION_SPECS);
  }
  if (commandName === 'pnpm') {
    return parseNodePlan(normalized, ['pnpm'], entry.args, 'pnpm', new Set(['add']), PNPM_OPTION_SPECS);
  }
  if (commandName === 'yarn') {
    return parseNodePlan(normalized, ['yarn'], entry.args, 'yarn', new Set(['add']), YARN_OPTION_SPECS);
  }
  if (commandName === 'bun') {
    return parseNodePlan(normalized, ['bun'], entry.args, 'bun', new Set(['add']), BUN_OPTION_SPECS);
  }
  if (commandName === 'pip' || commandName === 'pip3') {
    return parsePipPlan(normalized, [entry.command], entry.args, commandName === 'pip3' ? 'pip3' : 'pip');
  }
  if ((commandName === 'python' || commandName === 'python3' || commandName === 'py')
    && entry.args[0] === '-m'
    && entry.args[1]?.toLowerCase() === 'pip') {
    return parsePipPlan(normalized, [entry.command, '-m', entry.args[1]], entry.args.slice(2), 'python-pip');
  }

  return {
    success: false,
    error: 'Managed package installs currently support npm/pnpm/yarn/bun add-style commands and pip install.',
  };
}

export function buildManagedPackageStageInvocation(
  plan: ManagedPackageInstallPlan,
  downloadDir: string,
): PackageInstallCommandInvocation {
  if (plan.ecosystem === 'npm') {
    const args = ['pack', '--pack-destination', downloadDir, ...plan.stageOptionTokens, ...plan.packageSpecs];
    return {
      command: 'npm',
      args,
      display: formatCommandDisplay('npm', args),
    };
  }

  const prefixArgs = plan.runnerPrefix.slice(1);
  const args = [...prefixArgs, 'download', '--no-deps', '--dest', downloadDir, ...plan.stageOptionTokens, ...plan.packageSpecs];
  return {
    command: plan.runnerPrefix[0]!,
    args,
    display: formatCommandDisplay(plan.runnerPrefix[0]!, args),
  };
}

export function buildManagedPackageInstallInvocation(
  plan: ManagedPackageInstallPlan,
  artifactPaths: string[],
): PackageInstallCommandInvocation {
  const prefixArgs = plan.runnerPrefix.slice(1);
  const args = [...prefixArgs, plan.action, ...plan.installOptionTokens, ...artifactPaths];
  return {
    command: plan.runnerPrefix[0]!,
    args,
    display: formatCommandDisplay(plan.runnerPrefix[0]!, args),
  };
}

export function buildPackageInstallAssessment(input: {
  plan: ManagedPackageInstallPlan;
  artifacts: PackageInstallInspectedArtifact[];
  nativeProtection?: PackageInstallNativeProtection | null;
}): PackageInstallAssessment {
  const findings = rankFindings(input.artifacts.flatMap((artifact) => artifact.findings));
  const limitations = [...new Set(input.artifacts.flatMap((artifact) => artifact.limitations))];
  const state = deriveState(findings, input.nativeProtection);
  const summary = summarizeAssessment({
    plan: input.plan,
    state,
    findings,
    nativeProtection: input.nativeProtection,
  });
  const fingerprint = sha256Hex(JSON.stringify({
    command: input.plan.normalizedCommand,
    state,
    findings: findings.map((finding) => ({
      category: finding.category,
      state: finding.state,
      title: finding.title,
      summary: finding.summary,
    })),
    artifacts: input.artifacts.map((artifact) => ({
      fileName: artifact.fileName,
      packageName: artifact.packageName,
      packageVersion: artifact.packageVersion,
      artifactKind: artifact.artifactKind,
    })),
    nativeProtection: input.nativeProtection
      ? { provider: input.nativeProtection.provider, status: input.nativeProtection.status, summary: input.nativeProtection.summary }
      : null,
  }));

  return {
    state,
    summary,
    findings,
    artifacts: input.artifacts,
    limitations,
    fingerprint,
  };
}

export async function inspectPackageInstallArtifact(
  filePath: string,
  plan: ManagedPackageInstallPlan,
): Promise<PackageInstallInspectedArtifact> {
  const fileName = basename(filePath);
  const artifactKind = classifyArtifactKind(fileName, plan.ecosystem);
  const findings: PackageInstallFinding[] = [];
  const limitations: string[] = [];

  try {
    const raw = await readFile(filePath);
    const entries = readArchiveEntries(raw, artifactKind);
    const notableFiles = entries.slice(0, 8).map((entry) => entry.path);
    const packageMetadata = artifactKind === 'npm_tgz'
      ? inspectNpmEntries(entries, findings)
      : inspectPythonEntries(entries, artifactKind, findings);

    const genericLimitations = inspectGenericArchiveSignals(entries, findings);
    limitations.push(...genericLimitations);

    return {
      fileName,
      filePath,
      artifactKind,
      packageName: packageMetadata.packageName,
      packageVersion: packageMetadata.packageVersion,
      entryCount: entries.length,
      notableFiles,
      findings,
      limitations,
      summary: summarizeArtifact(fileName, findings, entries.length),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    findings.push(createFinding({
      category: 'inspection_failed',
      state: 'caution',
      severity: 'medium',
      title: 'Static package inspection did not complete',
      summary: `The staged artifact could not be inspected fully: ${message}`,
      evidence: { fileName },
    }));
    limitations.push('Static archive inspection did not complete.');
    return {
      fileName,
      filePath,
      artifactKind,
      entryCount: 0,
      notableFiles: [],
      findings,
      limitations,
      summary: `Inspection was incomplete for ${fileName}.`,
    };
  }
}

export function formatPackageInstallTarget(target: PackageInstallTarget, cwd?: string): string {
  if (target.kind === 'explicit_directory') {
    return target.path ? `explicit target ${target.path}` : 'an explicit target directory';
  }
  if (target.kind === 'user') {
    return 'the user-level environment';
  }
  if (target.kind === 'global') {
    return 'the global system environment';
  }
  return cwd ? `the working directory ${cwd}` : 'the current working directory';
}

function parseNodePlan(
  originalCommand: string,
  runnerPrefix: string[],
  args: string[],
  manager: ManagedPackageInstallPlan['manager'],
  supportedActions: ReadonlySet<string>,
  optionSpecs: Record<string, OptionSpec>,
): ManagedPackageInstallPlanResult {
  const action = (args[0] ?? '').trim().toLowerCase();
  if (!supportedActions.has(action)) {
    return {
      success: false,
      error: `${manager} installs must use one of: ${[...supportedActions].join(', ')}.`,
    };
  }
  const options = parseOptions(args.slice(1), optionSpecs, {
    onSpec: (spec) => classifyPackageSpec(spec, 'npm'),
    unsupportedFlagHelp: `${manager} install flag`,
    requirementsMessage: 'Managed package installs only support explicit public registry package specs in v1.',
  });
  if (!options.success) {
    return options;
  }

  return {
    success: true,
    plan: {
      ecosystem: 'npm',
      manager,
      originalCommand,
      normalizedCommand: normalizeCommand(originalCommand),
      runnerPrefix,
      action: args[0]!,
      packageSpecs: options.plan!.packageSpecs,
      sourceSpecs: options.plan!.packageSpecs.map((spec) => classifyPackageSpec(spec, 'npm')),
      installOptionTokens: options.plan!.installOptionTokens,
      stageOptionTokens: options.plan!.stageOptionTokens,
      installTarget: options.plan!.installTarget,
    },
  };
}

function parsePipPlan(
  originalCommand: string,
  runnerPrefix: string[],
  args: string[],
  manager: ManagedPackageInstallPlan['manager'],
): ManagedPackageInstallPlanResult {
  const action = (args[0] ?? '').trim().toLowerCase();
  if (action !== 'install') {
    return {
      success: false,
      error: 'Managed pip installs currently support pip install only.',
    };
  }

  const options = parseOptions(args.slice(1), PIP_OPTION_SPECS, {
    onSpec: (spec) => classifyPackageSpec(spec, 'pip'),
    unsupportedFlagHelp: 'pip install flag',
    disallowedFlags: [
      '-r',
      '--requirement',
      '-c',
      '--constraint',
      '-e',
      '--editable',
    ],
    requirementsMessage: 'Managed pip installs do not support requirements files, constraints, editable installs, direct URLs, or local paths in v1.',
  });
  if (!options.success) {
    return options;
  }
  if (options.plan!.packageSpecs.some((spec) => spec === '@')) {
    return {
      success: false,
      error: 'Managed pip installs do not support direct-reference URL syntax in v1.',
    };
  }

  return {
    success: true,
    plan: {
      ecosystem: 'pip',
      manager,
      originalCommand,
      normalizedCommand: normalizeCommand(originalCommand),
      runnerPrefix,
      action: args[0]!,
      packageSpecs: options.plan!.packageSpecs,
      sourceSpecs: options.plan!.packageSpecs.map((spec) => classifyPackageSpec(spec, 'pip')),
      installOptionTokens: options.plan!.installOptionTokens,
      stageOptionTokens: options.plan!.stageOptionTokens,
      installTarget: options.plan!.installTarget,
    },
  };
}

function parseOptions(
  tokens: string[],
  optionSpecs: Record<string, OptionSpec>,
  options: {
    onSpec: (spec: string) => PackageInstallSourceSpec;
    unsupportedFlagHelp: string;
    disallowedFlags?: string[];
    requirementsMessage: string;
  },
): ManagedPackageInstallPlanResult {
  const state: ParsedOptionState = {
    installOptionTokens: [],
    stageOptionTokens: [],
    packageSpecs: [],
    installTarget: { kind: 'working_directory' },
  };
  const disallowedFlags = new Set(options.disallowedFlags ?? []);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (token === '--') {
      return {
        success: false,
        error: 'Managed package installs do not support `--` argument forwarding.',
      };
    }
    if (token.startsWith('-')) {
      const rawFlag = token.split('=', 1)[0]!.toLowerCase();
      if (disallowedFlags.has(rawFlag)) {
        return {
          success: false,
          error: options.requirementsMessage,
        };
      }
      const spec = optionSpecs[rawFlag];
      if (!spec) {
        return {
          success: false,
          error: `Unsupported ${options.unsupportedFlagHelp} '${token}'.`,
        };
      }
      if (spec.expectsValue) {
        const inlineValue = token.includes('=') ? token.slice(token.indexOf('=') + 1) : '';
        const value = inlineValue || tokens[index + 1];
        if (!value) {
          return {
            success: false,
            error: `Flag '${token}' requires a value.`,
          };
        }
        if (inlineValue) {
          state.installOptionTokens.push(token);
          if (spec.includeInStage) state.stageOptionTokens.push(token);
        } else {
          state.installOptionTokens.push(token, value);
          if (spec.includeInStage) state.stageOptionTokens.push(token, value);
          index += 1;
        }
        if (spec.targetKind) {
          state.installTarget = { kind: spec.targetKind, path: value };
        }
        continue;
      }

      state.installOptionTokens.push(token);
      if (spec.includeInStage) state.stageOptionTokens.push(token);
      if (spec.targetKind) {
        state.installTarget = { kind: spec.targetKind };
      }
      continue;
    }

    const sourceSpec = options.onSpec(token);
    if (sourceSpec.sourceKind !== 'registry') {
      return {
        success: false,
        error: options.requirementsMessage,
      };
    }
    state.packageSpecs.push(token);
  }

  if (state.packageSpecs.length === 0) {
    return {
      success: false,
      error: options.requirementsMessage,
    };
  }

  return {
    success: true,
    plan: {
      ecosystem: 'npm',
      manager: 'npm',
      originalCommand: '',
      normalizedCommand: '',
      runnerPrefix: [],
      action: '',
      packageSpecs: state.packageSpecs,
      sourceSpecs: [],
      installOptionTokens: state.installOptionTokens,
      stageOptionTokens: state.stageOptionTokens,
      installTarget: state.installTarget,
    },
  };
}

function classifyPackageSpec(rawSpec: string, ecosystem: PackageInstallEcosystem): PackageInstallSourceSpec {
  const raw = rawSpec.trim();
  if (!raw) {
    return { raw: rawSpec, sourceKind: 'unknown' };
  }
  if (raw === '@') {
    return { raw: rawSpec, sourceKind: 'direct_url' };
  }
  if (/^(?:file:|link:|workspace:)/i.test(raw) || looksLikeLocalPath(raw)) {
    return { raw: rawSpec, sourceKind: 'local_path' };
  }
  if (/^(?:https?:|git\+|ssh:|git@|github:|gitlab:|bitbucket:)/i.test(raw) || raw.includes('.git#')) {
    return {
      raw: rawSpec,
      sourceKind: raw.startsWith('http://') || raw.startsWith('https://') ? 'direct_url' : 'vcs',
    };
  }

  if (ecosystem === 'npm') {
    const parsed = parseNpmRegistrySpec(raw);
    return {
      raw: rawSpec,
      sourceKind: parsed ? 'registry' : 'unknown',
      packageName: parsed?.name,
      requestedVersion: parsed?.version,
    };
  }

  const parsed = parsePipRegistrySpec(raw);
  return {
    raw: rawSpec,
    sourceKind: parsed ? 'registry' : 'unknown',
    packageName: parsed?.name,
    requestedVersion: parsed?.version,
  };
}

function parseNpmRegistrySpec(spec: string): { name: string; version?: string } | null {
  if (spec.startsWith('@')) {
    const slashIndex = spec.indexOf('/');
    if (slashIndex <= 1) return null;
    const versionIndex = spec.indexOf('@', slashIndex + 1);
    if (versionIndex === -1) {
      return { name: spec };
    }
    return {
      name: spec.slice(0, versionIndex),
      version: spec.slice(versionIndex + 1) || undefined,
    };
  }

  const versionIndex = spec.indexOf('@');
  if (versionIndex === -1) {
    return { name: spec };
  }
  return {
    name: spec.slice(0, versionIndex),
    version: spec.slice(versionIndex + 1) || undefined,
  };
}

function parsePipRegistrySpec(spec: string): { name: string; version?: string } | null {
  const match = spec.match(/^([A-Za-z0-9_.-]+)(.*)$/);
  if (!match) return null;
  const name = match[1]?.trim();
  if (!name) return null;
  const version = match[2]?.trim() || undefined;
  return { name, version };
}

function looksLikeLocalPath(value: string): boolean {
  return value === '.'
    || value === '..'
    || value.startsWith('./')
    || value.startsWith('../')
    || value.startsWith('/')
    || value.startsWith('\\')
    || value.startsWith('~/')
    || /^[a-zA-Z]:[\\/]/.test(value);
}

function classifyArtifactKind(fileName: string, ecosystem: PackageInstallEcosystem): PackageInstallArtifactKind {
  const lower = fileName.toLowerCase();
  if (ecosystem === 'npm' && (lower.endsWith('.tgz') || lower.endsWith('.tar.gz'))) {
    return 'npm_tgz';
  }
  if (lower.endsWith('.whl')) {
    return 'python_wheel';
  }
  if (lower.endsWith('.tar.gz') || lower.endsWith('.zip') || lower.endsWith('.tar')) {
    return ecosystem === 'pip' ? 'python_sdist' : 'archive';
  }
  return 'file';
}

function readArchiveEntries(buffer: Buffer, kind: PackageInstallArtifactKind): ArchiveEntry[] {
  if (kind === 'npm_tgz' || kind === 'python_sdist' || kind === 'archive') {
    if (kind === 'python_sdist' && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
      return readZipEntries(buffer);
    }
    if (kind === 'archive' && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
      return readZipEntries(buffer);
    }
    return readTarEntries(buffer);
  }
  if (kind === 'python_wheel') {
    return readZipEntries(buffer);
  }
  return [{
    path: 'artifact',
    size: buffer.length,
    data: buffer.length <= MAX_TEXT_ENTRY_BYTES ? buffer : undefined,
  }];
}

function readTarEntries(buffer: Buffer): ArchiveEntry[] {
  const tarBuffer = isGzipBuffer(buffer) ? gunzipSync(buffer) : buffer;
  const entries: ArchiveEntry[] = [];
  let offset = 0;

  while (offset + 512 <= tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512);
    if (header.every((value) => value === 0)) {
      break;
    }
    const rawName = header.toString('utf8', 0, 100).replace(/\0.*$/, '');
    const rawPrefix = header.toString('utf8', 345, 500).replace(/\0.*$/, '');
    const sizeOctal = header.toString('utf8', 124, 136).replace(/\0.*$/, '').trim();
    const size = Number.parseInt(sizeOctal || '0', 8) || 0;
    const typeFlag = header.toString('utf8', 156, 157) || '0';
    const fullName = rawPrefix ? `${rawPrefix}/${rawName}` : rawName;
    const dataOffset = offset + 512;
    const paddedSize = Math.ceil(size / 512) * 512;
    if ((typeFlag === '0' || typeFlag === '\0') && fullName) {
      const data = size > 0 && size <= MAX_TEXT_ENTRY_BYTES
        ? tarBuffer.subarray(dataOffset, dataOffset + size)
        : undefined;
      entries.push({
        path: normalizeArchivePath(fullName),
        size,
        data,
      });
    }
    offset = dataOffset + paddedSize;
  }

  return entries;
}

function readZipEntries(buffer: Buffer): ArchiveEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset === -1) {
    throw new Error('ZIP central directory was not found.');
  }
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  const entries: ArchiveEntry[] = [];
  let offset = centralDirectoryOffset;

  while (offset + 46 <= centralDirectoryEnd && offset + 46 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      break;
    }
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength);
    offset += 46 + fileNameLength + extraLength + commentLength;
    if (!fileName || fileName.endsWith('/')) continue;

    const localSignature = buffer.readUInt32LE(localHeaderOffset);
    if (localSignature !== 0x04034b50) {
      continue;
    }
    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);
    let data: Buffer | undefined;
    if (uncompressedSize <= MAX_TEXT_ENTRY_BYTES) {
      if (compression === 0) {
        data = compressedData;
      } else if (compression === 8) {
        data = inflateRawSync(compressedData);
      }
    }
    entries.push({
      path: normalizeArchivePath(fileName),
      size: uncompressedSize,
      data,
    });
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const signature = 0x06054b50;
  const minimumLength = 22;
  const maxCommentLength = 0xffff;
  const start = Math.max(0, buffer.length - minimumLength - maxCommentLength);
  for (let index = buffer.length - minimumLength; index >= start; index -= 1) {
    if (buffer.readUInt32LE(index) === signature) {
      return index;
    }
  }
  return -1;
}

function inspectNpmEntries(
  entries: ArchiveEntry[],
  findings: PackageInstallFinding[],
): { packageName?: string; packageVersion?: string } {
  const packageJsonEntry = entries.find((entry) => entry.path === 'package/package.json' || entry.path === 'package.json');
  if (!packageJsonEntry?.data) {
    return {};
  }
  try {
    const manifest = JSON.parse(packageJsonEntry.data.toString('utf8')) as Record<string, unknown>;
    const packageName = typeof manifest.name === 'string' ? manifest.name : undefined;
    const packageVersion = typeof manifest.version === 'string' ? manifest.version : undefined;

    const scripts = isRecord(manifest.scripts) ? manifest.scripts : {};
    const installScripts = Object.keys(scripts).filter((key) => NPM_INSTALL_SCRIPTS.has(key));
    if (installScripts.length > 0) {
      findings.push(createFinding({
        category: 'lifecycle_scripts',
        state: 'caution',
        severity: 'high',
        title: 'Install-time lifecycle scripts are present',
        summary: `The package defines install-time lifecycle scripts: ${installScripts.join(', ')}.`,
        evidence: {
          scripts: installScripts,
        },
      }));
    }

    const dependencyCount = countObjectKeys(manifest.dependencies)
      + countObjectKeys(manifest.optionalDependencies)
      + countObjectKeys(manifest.peerDependencies);
    if (dependencyCount > 0) {
      findings.push(createFinding({
        category: 'transitive_dependencies',
        state: 'caution',
        severity: 'medium',
        title: 'Transitive dependency closure is not fully staged in v1',
        summary: `The package declares ${dependencyCount} dependency entries that may still resolve during install.`,
        evidence: {
          dependencyCount,
        },
      }));
    }

    return { packageName, packageVersion };
  } catch (error) {
    findings.push(createFinding({
      category: 'manifest_parse_error',
      state: 'caution',
      severity: 'low',
      title: 'package.json could not be parsed',
      summary: `The package manifest could not be parsed deterministically: ${error instanceof Error ? error.message : String(error)}`,
    }));
    return {};
  }
}

function inspectPythonEntries(
  entries: ArchiveEntry[],
  artifactKind: PackageInstallArtifactKind,
  findings: PackageInstallFinding[],
): { packageName?: string; packageVersion?: string } {
  const metadataEntry = entries.find((entry) => /(?:^|\/)(METADATA|PKG-INFO)$/i.test(entry.path));
  let packageName: string | undefined;
  let packageVersion: string | undefined;

  if (metadataEntry?.data) {
    const metadataText = metadataEntry.data.toString('utf8');
    const nameMatch = metadataText.match(/^Name:\s*(.+)$/im);
    const versionMatch = metadataText.match(/^Version:\s*(.+)$/im);
    packageName = nameMatch?.[1]?.trim() || undefined;
    packageVersion = versionMatch?.[1]?.trim() || undefined;
    const dependencyCount = (metadataText.match(/^Requires-Dist:\s+/gim) ?? []).length;
    if (dependencyCount > 0) {
      findings.push(createFinding({
        category: 'transitive_dependencies',
        state: 'caution',
        severity: 'medium',
        title: 'Transitive dependency closure is not fully staged in v1',
        summary: `The package metadata declares ${dependencyCount} dependency entries that may still resolve during install.`,
        evidence: {
          dependencyCount,
        },
      }));
    }
  }

  const hasSetupPy = entries.some((entry) => /(?:^|\/)setup\.py$/i.test(entry.path));
  const pyprojectEntry = entries.find((entry) => /(?:^|\/)pyproject\.toml$/i.test(entry.path));
  if (artifactKind === 'python_sdist' && (hasSetupPy || pyprojectEntry)) {
    findings.push(createFinding({
      category: 'python_build_hooks',
      state: 'caution',
      severity: 'high',
      title: 'Python source distributions can execute build hooks',
      summary: 'The staged artifact is a source distribution with build metadata that may execute code during install.',
      evidence: {
        setupPy: hasSetupPy,
        pyprojectToml: !!pyprojectEntry,
      },
    }));
  }
  if (pyprojectEntry?.data) {
    const pyprojectText = pyprojectEntry.data.toString('utf8');
    if (/\[build-system\]/i.test(pyprojectText) || /\bbuild-backend\s*=/i.test(pyprojectText)) {
      findings.push(createFinding({
        category: 'python_build_backend',
        state: 'caution',
        severity: 'medium',
        title: 'Custom Python build backend is declared',
        summary: 'The package declares Python build-system metadata that can influence install-time execution.',
      }));
    }
  }

  return { packageName, packageVersion };
}

function inspectGenericArchiveSignals(entries: ArchiveEntry[], findings: PackageInstallFinding[]): string[] {
  const limitations: string[] = [];
  const binaryFiles = entries
    .filter((entry) => isBinaryArchiveEntry(entry))
    .map((entry) => entry.path)
    .slice(0, 6);
  if (binaryFiles.length > 0) {
    findings.push(createFinding({
      category: 'native_binaries',
      state: 'caution',
      severity: 'medium',
      title: 'Native or opaque binaries are present',
      summary: `The package contains native or opaque binaries such as ${binaryFiles.join(', ')}.`,
      evidence: { files: binaryFiles },
    }));
  }

  const textEntries = entries
    .filter((entry) => isTextArchiveEntry(entry))
    .sort((left, right) => priorityForTextPath(left.path) - priorityForTextPath(right.path));
  let scannedFiles = 0;
  let scannedBytes = 0;
  const suspiciousNetworkExecFiles: string[] = [];

  for (const entry of textEntries) {
    if (!entry.data) continue;
    if (scannedFiles >= MAX_SCANNED_TEXT_FILES || scannedBytes >= MAX_SCANNED_TEXT_BYTES) {
      limitations.push('Static text scanning hit the bounded review limit before every text file was inspected.');
      break;
    }
    scannedFiles += 1;
    scannedBytes += entry.data.length;
    const text = entry.data.toString('utf8');

    for (const pattern of BLOCKED_TEXT_PATTERNS) {
      if (pattern.regex.test(text)) {
        findings.push(createFinding({
          category: pattern.category,
          state: 'blocked',
          severity: 'critical',
          title: pattern.title,
          summary: `${pattern.summary} Observed in ${entry.path}.`,
          evidence: { file: entry.path },
        }));
      }
    }

    if (COMMAND_EXEC_PATTERN.test(text) && NETWORK_FETCH_PATTERN.test(text)) {
      suspiciousNetworkExecFiles.push(entry.path);
    }
  }

  if (suspiciousNetworkExecFiles.length > 0) {
    findings.push(createFinding({
      category: 'network_exec_primitives',
      state: 'caution',
      severity: 'high',
      title: 'Package content combines network fetch and execution primitives',
      summary: `Static review observed combined network-fetch and command-execution primitives in ${suspiciousNetworkExecFiles.slice(0, 4).join(', ')}.`,
      evidence: {
        files: suspiciousNetworkExecFiles.slice(0, 6),
      },
    }));
  }

  return limitations;
}

function summarizeArtifact(fileName: string, findings: PackageInstallFinding[], entryCount: number): string {
  const topFinding = findings[0];
  if (topFinding) {
    return `${fileName}: ${topFinding.title}.`;
  }
  return `${fileName}: scanned ${entryCount} archive entries with no deterministic issues in the bounded review.`;
}

function summarizeAssessment(input: {
  plan: ManagedPackageInstallPlan;
  state: PackageInstallTrustState;
  findings: PackageInstallFinding[];
  nativeProtection?: PackageInstallNativeProtection | null;
}): string {
  if (input.nativeProtection?.status === 'detected') {
    return `Blocked before install: native malware scanning reported a detection in the staged artifacts.`;
  }
  const topFinding = rankFindings(input.findings)[0];
  if (input.state === 'blocked') {
    return topFinding
      ? `Blocked before install: ${topFinding.summary}`
      : 'Blocked before install because the staged artifacts exceeded the current trust threshold.';
  }
  if (input.state === 'caution') {
    return topFinding
      ? `Install requires caution review: ${topFinding.summary}`
      : 'Install requires caution review before proceeding.';
  }
  const managerLabel = input.plan.ecosystem === 'npm' ? 'Node package' : 'Python package';
  return `${managerLabel} artifacts passed the current bounded staged checks.`;
}

function deriveState(
  findings: PackageInstallFinding[],
  nativeProtection?: PackageInstallNativeProtection | null,
): PackageInstallTrustState {
  if (nativeProtection?.status === 'detected') {
    return 'blocked';
  }
  if (findings.some((finding) => finding.state === 'blocked')) {
    return 'blocked';
  }
  if (findings.some((finding) => finding.state === 'caution')) {
    return 'caution';
  }
  return 'trusted';
}

function rankFindings(findings: PackageInstallFinding[]): PackageInstallFinding[] {
  return findings.slice().sort((left, right) => {
    const stateDelta = stateRank(right.state) - stateRank(left.state);
    if (stateDelta !== 0) return stateDelta;
    const severityDelta = severityRank(right.severity) - severityRank(left.severity);
    if (severityDelta !== 0) return severityDelta;
    return left.title.localeCompare(right.title);
  });
}

function stateRank(value: PackageInstallTrustState): number {
  switch (value) {
    case 'blocked': return 3;
    case 'caution': return 2;
    default: return 1;
  }
}

function severityRank(value: PackageInstallFindingSeverity): number {
  switch (value) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    default: return 1;
  }
}

function createFinding(input: {
  category: string;
  state: PackageInstallTrustState;
  severity: PackageInstallFindingSeverity;
  title: string;
  summary: string;
  evidence?: Record<string, unknown>;
}): PackageInstallFinding {
  const evidenceString = input.evidence ? JSON.stringify(input.evidence) : '';
  return {
    id: sha256Hex(`${input.category}:${input.state}:${input.title}:${input.summary}:${evidenceString}`).slice(0, 16),
    category: input.category,
    state: input.state,
    severity: input.severity,
    title: input.title,
    summary: input.summary,
    evidence: input.evidence,
  };
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeCommand(command: string): string {
  return command.trim().replace(/\s+/g, ' ');
}

function isGzipBuffer(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

function normalizeArchivePath(value: string): string {
  const normalized = value.replace(/\\/g, '/');
  return posix.normalize(normalized).replace(/^\.?\//, '');
}

function isBinaryArchiveEntry(entry: ArchiveEntry): boolean {
  const lowerExt = extname(entry.path).toLowerCase();
  if (BINARY_ENTRY_EXTENSIONS.has(lowerExt)) return true;
  if (!entry.data) return false;
  return entry.data.includes(0);
}

function isTextArchiveEntry(entry: ArchiveEntry): boolean {
  const lowerExt = extname(entry.path).toLowerCase();
  if (TEXT_ENTRY_EXTENSIONS.has(lowerExt)) {
    return !!entry.data;
  }
  return !!entry.data && !entry.data.includes(0);
}

function priorityForTextPath(pathValue: string): number {
  const lower = pathValue.toLowerCase();
  if (lower.endsWith('package.json') || lower.endsWith('pyproject.toml') || lower.endsWith('setup.py') || lower.endsWith('metadata') || lower.endsWith('pkg-info')) {
    return 0;
  }
  if (lower.includes('/scripts/') || lower.endsWith('.sh') || lower.endsWith('.ps1') || lower.endsWith('.cmd') || lower.endsWith('.bat')) {
    return 1;
  }
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs') || lower.endsWith('.py') || lower.endsWith('.ts')) {
    return 2;
  }
  return 3;
}

function countObjectKeys(value: unknown): number {
  return isRecord(value) ? Object.keys(value).length : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function formatCommandDisplay(command: string, args: string[]): string {
  return [command, ...args].map((value) => (
    /[\s"'\\]/.test(value)
      ? JSON.stringify(value)
      : value
  )).join(' ');
}
