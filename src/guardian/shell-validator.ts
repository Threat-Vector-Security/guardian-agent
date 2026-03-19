/**
 * Shell command tokenizer and validator.
 *
 * POSIX-style shell tokenizer that handles quoting, escaping, and
 * command chaining. Used by ShellCommandController to validate
 * shell commands before execution.
 */

/** A parsed shell command with its arguments. */
export interface ParsedCommand {
  /** The command name (first token). */
  command: string;
  /** All arguments (remaining tokens). */
  args: string[];
  /** Redirect targets (paths after >, >>, <). */
  redirects: string[];
  /** The chain operator that precedes this command (null for first). */
  chainOp: string | null;
}

/** Result of shell command validation. */
export interface ShellValidationResult {
  valid: boolean;
  reason?: string;
  commands: ParsedCommand[];
}

export type ShellExecutionClass =
  | 'direct_binary'
  | 'script_runner'
  | 'interpreter_inline'
  | 'package_launcher'
  | 'build_or_task_runner'
  | 'shell_expression';

const CHAIN_OPS = new Set(['&&', '||', ';', '|']);
const REDIRECT_OPS = new Set(['>', '>>', '<', '2>', '2>>']);
const SHELL_INTERPRETERS = new Set(['sh', 'bash', 'zsh', 'fish', 'dash', 'ksh', 'ash']);
const POWERSHELL_INTERPRETERS = new Set(['pwsh', 'pwsh.exe', 'powershell', 'powershell.exe']);
const PYTHON_INTERPRETERS = new Set(['python', 'python2', 'python3', 'py']);
const NODE_INTERPRETERS = new Set(['node']);
const PHP_INTERPRETERS = new Set(['php']);
const RUBY_INTERPRETERS = new Set(['ruby']);
const PERL_INTERPRETERS = new Set(['perl']);
const DENO_INTERPRETERS = new Set(['deno']);
const PACKAGE_LAUNCHERS = new Set(['npx', 'bunx']);

function normalizeCommandName(command: string): string {
  const trimmed = command.trim().replace(/[\\/]+$/, '');
  if (!trimmed) return '';
  const basename = trimmed.split(/[\\/]/).pop();
  return (basename || trimmed).toLowerCase();
}

function firstArg(cmd: ParsedCommand): string {
  return cmd.args[0]?.toLowerCase() ?? '';
}

function secondArg(cmd: ParsedCommand): string {
  return cmd.args[1]?.toLowerCase() ?? '';
}

function hasSingleDashFlagWithChar(args: string[], char: string): boolean {
  return args.some((arg) => /^-[a-z]+$/i.test(arg) && arg.toLowerCase().includes(char));
}

function hasAnyArg(args: string[], candidates: readonly string[]): boolean {
  const lowerCandidates = new Set(candidates.map((candidate) => candidate.toLowerCase()));
  return args.some((arg) => lowerCandidates.has(arg.toLowerCase()));
}

function hasAnyArgPrefix(args: string[], prefixes: readonly string[]): boolean {
  const normalizedPrefixes = prefixes.map((prefix) => prefix.toLowerCase());
  return args.some((arg) => {
    const lower = arg.toLowerCase();
    return normalizedPrefixes.some((prefix) => lower.startsWith(prefix));
  });
}

function hasNonFlagArg(args: string[]): boolean {
  return args.some((arg) => arg !== '-' && !arg.startsWith('-'));
}

function isShellExpression(cmd: ParsedCommand, commandName: string): boolean {
  if (SHELL_INTERPRETERS.has(commandName)) {
    return hasAnyArg(cmd.args, ['-c', '--command']) || hasSingleDashFlagWithChar(cmd.args, 'c');
  }

  if (POWERSHELL_INTERPRETERS.has(commandName)) {
    return hasAnyArg(cmd.args, ['-c', '-command', '-encodedcommand', '-enc'])
      || hasAnyArgPrefix(cmd.args, ['-command=', '-encodedcommand=']);
  }

  if (commandName === 'cmd' || commandName === 'cmd.exe') {
    return hasAnyArg(cmd.args, ['/c', '/k']);
  }

  return false;
}

function isInterpreterInline(cmd: ParsedCommand, commandName: string): boolean {
  if (PYTHON_INTERPRETERS.has(commandName)) {
    const initialArg = firstArg(cmd);
    return initialArg === '-c' || initialArg === '-';
  }

  if (NODE_INTERPRETERS.has(commandName)) {
    return hasAnyArg(cmd.args, ['-e', '--eval', '-p', '--print'])
      || hasAnyArgPrefix(cmd.args, ['--eval=', '--print=']);
  }

  if (PHP_INTERPRETERS.has(commandName)) {
    return hasAnyArg(cmd.args, ['-r']);
  }

  if (RUBY_INTERPRETERS.has(commandName)) {
    return hasAnyArg(cmd.args, ['-e']);
  }

  if (PERL_INTERPRETERS.has(commandName)) {
    return hasAnyArg(cmd.args, ['-e', '-pe', '-ne']);
  }

  if (DENO_INTERPRETERS.has(commandName)) {
    return firstArg(cmd) === 'eval';
  }

  return false;
}

function isPackageLauncher(cmd: ParsedCommand, commandName: string): boolean {
  if (PACKAGE_LAUNCHERS.has(commandName)) return true;

  const initialArg = firstArg(cmd);
  if (commandName === 'npm') {
    return initialArg === 'exec' || initialArg === 'x';
  }

  if (commandName === 'pnpm' || commandName === 'yarn') {
    return initialArg === 'exec' || initialArg === 'dlx';
  }

  if (commandName === 'bun') {
    return initialArg === 'x';
  }

  if (commandName === 'uv') {
    return initialArg === 'run' || (initialArg === 'tool' && secondArg(cmd) === 'run');
  }

  return false;
}

function isBuildOrTaskRunner(cmd: ParsedCommand, commandName: string): boolean {
  const initialArg = firstArg(cmd);

  if (commandName === 'npm' || commandName === 'pnpm' || commandName === 'yarn') {
    return ['run', 'test', 'start', 'build', 'lint', 'install', 'ci', 'add'].includes(initialArg);
  }

  if (commandName === 'bun') {
    return ['run', 'test', 'install', 'add', 'build'].includes(initialArg);
  }

  if (commandName === 'deno') {
    return ['run', 'test', 'task', 'compile'].includes(initialArg);
  }

  return new Set([
    'pytest',
    'cargo',
    'rustc',
    'go',
    'gofmt',
    'gradle',
    'mvn',
    'dotnet',
    'composer',
    'bundle',
    'gem',
    'make',
    'cmake',
    'pip',
    'pip3',
  ]).has(commandName);
}

function isScriptRunner(cmd: ParsedCommand, commandName: string): boolean {
  if (SHELL_INTERPRETERS.has(commandName) || POWERSHELL_INTERPRETERS.has(commandName)) {
    return hasNonFlagArg(cmd.args);
  }

  if (commandName === 'cmd' || commandName === 'cmd.exe') {
    return cmd.args.length > 0 && !isShellExpression(cmd, commandName);
  }

  if (PYTHON_INTERPRETERS.has(commandName)) {
    const initialArg = firstArg(cmd);
    return initialArg === '-m' || hasNonFlagArg(cmd.args);
  }

  if (NODE_INTERPRETERS.has(commandName)
      || PHP_INTERPRETERS.has(commandName)
      || RUBY_INTERPRETERS.has(commandName)
      || PERL_INTERPRETERS.has(commandName)) {
    return hasNonFlagArg(cmd.args);
  }

  if (DENO_INTERPRETERS.has(commandName)) {
    return firstArg(cmd) === 'run' || hasNonFlagArg(cmd.args);
  }

  return false;
}

function executionIdentityReason(commandName: string, executionClass: ShellExecutionClass): string | undefined {
  switch (executionClass) {
    case 'interpreter_inline':
      return `Command '${commandName}' uses inline interpreter evaluation, which is blocked by execution identity policy.`;
    case 'package_launcher':
      return `Command '${commandName}' uses a package launcher that can route around executable allowlists, which is blocked by execution identity policy.`;
    case 'shell_expression':
      return `Command '${commandName}' uses a shell expression launcher, which is blocked by execution identity policy.`;
    default:
      return undefined;
  }
}

/**
 * Tokenize a shell command string into tokens.
 *
 * Handles:
 * - Single-quoted strings (no escape processing)
 * - Double-quoted strings (backslash escaping)
 * - Backslash escaping outside quotes
 * - Chain operators: &&, ||, ;, |
 * - Redirect operators: >, >>, <, 2>, 2>>
 * - Subshell detection: $(...) and backticks
 */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    // Single quote — no escaping inside
    if (ch === "'") {
      i++;
      while (i < len && input[i] !== "'") {
        current += input[i];
        i++;
      }
      if (i < len) i++; // skip closing quote
      continue;
    }

    // Double quote — backslash escaping
    if (ch === '"') {
      i++;
      while (i < len && input[i] !== '"') {
        // Command substitution is still active inside double quotes.
        if (input[i] === '$' && i + 1 < len && input[i + 1] === '(') {
          if (current) { tokens.push(current); current = ''; }
          tokens.push('$(');
          i += 2;
          continue;
        }
        if (input[i] === '`') {
          if (current) { tokens.push(current); current = ''; }
          tokens.push('`');
          i++;
          continue;
        }
        if (input[i] === '\\' && i + 1 < len) {
          i++;
          current += input[i];
        } else {
          current += input[i];
        }
        i++;
      }
      if (i < len) i++; // skip closing quote
      continue;
    }

    // Backslash escaping outside quotes
    if (ch === '\\' && i + 1 < len) {
      i++;
      current += input[i];
      i++;
      continue;
    }

    // Subshell markers — flag them as special tokens
    if (ch === '$' && i + 1 < len && input[i + 1] === '(') {
      if (current) { tokens.push(current); current = ''; }
      tokens.push('$(');
      i += 2;
      continue;
    }

    if (ch === '`') {
      if (current) { tokens.push(current); current = ''; }
      tokens.push('`');
      i++;
      continue;
    }

    // Chain operators
    if (ch === '&' && i + 1 < len && input[i + 1] === '&') {
      if (current) { tokens.push(current); current = ''; }
      tokens.push('&&');
      i += 2;
      continue;
    }

    if (ch === '|' && i + 1 < len && input[i + 1] === '|') {
      if (current) { tokens.push(current); current = ''; }
      tokens.push('||');
      i += 2;
      continue;
    }

    if (ch === '|') {
      if (current) { tokens.push(current); current = ''; }
      tokens.push('|');
      i++;
      continue;
    }

    if (ch === ';') {
      if (current) { tokens.push(current); current = ''; }
      tokens.push(';');
      i++;
      continue;
    }

    // Redirect operators
    if (ch === '>' || ch === '<') {
      if (current) {
        // Check for 2> / 2>>
        if (ch === '>' && current === '2') {
          current = '';
          if (i + 1 < len && input[i + 1] === '>') {
            tokens.push('2>>');
            i += 2;
          } else {
            tokens.push('2>');
            i++;
          }
          continue;
        }
        tokens.push(current);
        current = '';
      }

      if (ch === '>' && i + 1 < len && input[i + 1] === '>') {
        tokens.push('>>');
        i += 2;
      } else {
        tokens.push(ch);
        i++;
      }
      continue;
    }

    // Whitespace — delimiter
    if (ch === ' ' || ch === '\t') {
      if (current) { tokens.push(current); current = ''; }
      i++;
      continue;
    }

    // Regular character
    current += ch;
    i++;
  }

  if (current) tokens.push(current);

  return tokens;
}

/**
 * Split tokenized input into individual commands by chain operators.
 */
export function splitCommands(tokens: string[]): ParsedCommand[] {
  const commands: ParsedCommand[] = [];
  let currentTokens: string[] = [];
  let chainOp: string | null = null;

  for (const token of tokens) {
    if (CHAIN_OPS.has(token)) {
      if (currentTokens.length > 0) {
        commands.push(parseCommandTokens(currentTokens, chainOp));
      }
      chainOp = token;
      currentTokens = [];
    } else {
      currentTokens.push(token);
    }
  }

  if (currentTokens.length > 0) {
    commands.push(parseCommandTokens(currentTokens, chainOp));
  }

  return commands;
}

/** Parse a single command's tokens into a ParsedCommand. */
function parseCommandTokens(tokens: string[], chainOp: string | null): ParsedCommand {
  const redirects: string[] = [];
  const args: string[] = [];
  let command = '';

  let i = 0;

  // First non-redirect token is the command
  while (i < tokens.length) {
    if (REDIRECT_OPS.has(tokens[i])) {
      // Skip redirect op and capture target
      i++;
      if (i < tokens.length) {
        redirects.push(tokens[i]);
      }
      i++;
      continue;
    }
    if (!command) {
      command = tokens[i];
    } else {
      args.push(tokens[i]);
    }
    i++;
  }

  // Re-scan args for redirect ops embedded in them
  const cleanArgs: string[] = [];
  for (let j = 0; j < args.length; j++) {
    if (REDIRECT_OPS.has(args[j])) {
      if (j + 1 < args.length) {
        redirects.push(args[j + 1]);
        j++;
      }
    } else {
      cleanArgs.push(args[j]);
    }
  }

  return { command, args: cleanArgs, redirects, chainOp };
}

function allowedEntryMatchesCommand(cmd: ParsedCommand, allowedEntry: string): boolean {
  const allowedTokens = tokenize(allowedEntry.trim())
    .filter((token) => !CHAIN_OPS.has(token) && !REDIRECT_OPS.has(token));
  if (allowedTokens.length === 0) return false;

  const [allowedCommand, ...allowedArgs] = allowedTokens;
  if (cmd.command !== allowedCommand) return false;

  // Allow bare command entries (e.g. "git") to match any args.
  if (allowedArgs.length === 0) return true;

  // Allow command+arg prefixes (e.g. "git status" matches "git status -s").
  if (cmd.args.length < allowedArgs.length) return false;
  return allowedArgs.every((arg, idx) => cmd.args[idx] === arg);
}

/**
 * Validate a shell command string against allowed commands and denied paths.
 *
 * @param input - Raw shell command string
 * @param allowedCommands - Allowed command prefixes (e.g., ['git', 'npm'])
 * @param deniedPathChecker - Function that returns true if a path is denied
 * @returns Validation result
 */
export function validateShellCommand(
  input: string,
  allowedCommands: string[],
  deniedPathChecker?: (path: string) => boolean,
): ShellValidationResult {
  // Tokenize
  let tokens: string[];
  try {
    tokens = tokenize(input);
  } catch {
    return { valid: false, reason: 'Failed to parse shell command', commands: [] };
  }

  if (tokens.length === 0) {
    return { valid: false, reason: 'Empty command', commands: [] };
  }

  // Check for subshell markers
  if (tokens.includes('$(') || tokens.includes('`')) {
    return { valid: false, reason: 'Subshell execution not allowed', commands: [] };
  }

  // Split into individual commands
  const commands = splitCommands(tokens);

  if (commands.length === 0) {
    return { valid: false, reason: 'No commands parsed', commands: [] };
  }

  // Validate each command
  for (const cmd of commands) {
    if (!cmd.command) {
      return { valid: false, reason: 'Empty command in chain', commands };
    }

    // Check command against allowed list
    const isAllowed = allowedCommands.some((allowed) =>
      allowedEntryMatchesCommand(cmd, allowed),
    );

    if (!isAllowed) {
      return { valid: false, reason: `Command '${cmd.command}' is not in allowed list`, commands };
    }

    // Check all args and redirects against denied paths
    if (deniedPathChecker) {
      for (const arg of cmd.args) {
        if (deniedPathChecker(arg)) {
          return { valid: false, reason: `Argument '${arg}' references a denied path`, commands };
        }
      }

      for (const redirect of cmd.redirects) {
        if (deniedPathChecker(redirect)) {
          return { valid: false, reason: `Redirect target '${redirect}' references a denied path`, commands };
        }
      }
    }
  }

  return { valid: true, commands };
}

export function classifyParsedCommandExecution(cmd: ParsedCommand): ShellExecutionClass {
  const commandName = normalizeCommandName(cmd.command);

  if (isShellExpression(cmd, commandName)) {
    return 'shell_expression';
  }

  if (isInterpreterInline(cmd, commandName)) {
    return 'interpreter_inline';
  }

  if (isPackageLauncher(cmd, commandName)) {
    return 'package_launcher';
  }

  if (isBuildOrTaskRunner(cmd, commandName)) {
    return 'build_or_task_runner';
  }

  if (isScriptRunner(cmd, commandName)) {
    return 'script_runner';
  }

  return 'direct_binary';
}

export function getExecutionIdentityBlockReason(commands: ParsedCommand[]): string | undefined {
  for (const cmd of commands) {
    const executionClass = classifyParsedCommandExecution(cmd);
    const commandName = normalizeCommandName(cmd.command) || cmd.command;
    const reason = executionIdentityReason(commandName, executionClass);
    if (reason) {
      return reason;
    }
  }

  return undefined;
}
