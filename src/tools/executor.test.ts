import { mkdirSync, rmSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { ToolExecutor } from './executor.js';

const testDirs: string[] = [];

function createExecutorRoot(): string {
  const root = join(tmpdir(), `guardianagent-tools-${randomUUID()}`);
  mkdirSync(root, { recursive: true });
  testDirs.push(root);
  return root;
}

function createWorkspaceExecutorRoot(): string {
  const root = join(process.cwd(), `.guardianagent-tools-${randomUUID()}`);
  mkdirSync(root, { recursive: true });
  testDirs.push(root);
  return root;
}

function toWindowsPath(pathValue: string): string {
  const mnt = pathValue.match(/^\/mnt\/([a-zA-Z])\/(.*)$/);
  if (mnt) {
    const drive = mnt[1].toUpperCase();
    const rest = mnt[2].replace(/\//g, '\\');
    return `${drive}:\\${rest}`;
  }
  return pathValue.replace(/\//g, '\\');
}

afterEach(() => {
  for (const dir of testDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('ToolExecutor', () => {
  it('lists builtin tools', () => {
    const root = createExecutorRoot();
    const executor = new ToolExecutor({
      enabled: true,
      workspaceRoot: root,
      policyMode: 'approve_by_policy',
      allowedPaths: [root],
      allowedCommands: ['echo'],
      allowedDomains: ['localhost'],
    });

    const names = executor.listToolDefinitions().map((tool) => tool.name);
    expect(names).toContain('fs_read');
    expect(names).toContain('fs_search');
    expect(names).toContain('fs_write');
    expect(names).toContain('shell_safe');
    expect(names).toContain('chrome_job');
    expect(names).toContain('campaign_create');
    expect(names).toContain('campaign_run');
    expect(names).toContain('gmail_send');
  });

  it('requires approval for mutating tools in approve_by_policy mode', async () => {
    const root = createExecutorRoot();
    const executor = new ToolExecutor({
      enabled: true,
      workspaceRoot: root,
      policyMode: 'approve_by_policy',
      allowedPaths: [root],
      allowedCommands: ['echo'],
      allowedDomains: ['localhost'],
    });

    const run = await executor.runTool({
      toolName: 'fs_write',
      args: { path: 'note.txt', content: 'hello' },
      origin: 'cli',
    });
    expect(run.success).toBe(false);
    expect(run.status).toBe('pending_approval');
    expect(run.approvalId).toBeDefined();

    const decided = await executor.decideApproval(run.approvalId!, 'approved', 'tester');
    expect(decided.success).toBe(true);

    const text = await readFile(join(root, 'note.txt'), 'utf-8');
    expect(text).toBe('hello');
  });

  it('executes read-only tools without approval', async () => {
    const root = createExecutorRoot();
    const executor = new ToolExecutor({
      enabled: true,
      workspaceRoot: root,
      policyMode: 'approve_by_policy',
      allowedPaths: [root],
      allowedCommands: ['echo'],
      allowedDomains: ['localhost'],
    });

    const run = await executor.runTool({
      toolName: 'fs_list',
      args: { path: '.' },
      origin: 'web',
    });

    expect(run.success).toBe(true);
    expect(run.status).toBe('succeeded');
    expect(run.output).toBeTruthy();
  });

  it('searches files recursively by name and content', async () => {
    const root = createExecutorRoot();
    mkdirSync(join(root, 'nested', 'docs'), { recursive: true });
    await writeFile(join(root, 'nested', 'docs', 'five-notes.txt'), 'Code GRC checklist', 'utf-8');
    await writeFile(join(root, 'nested', 'docs', 'random.txt'), 'nothing relevant', 'utf-8');

    const executor = new ToolExecutor({
      enabled: true,
      workspaceRoot: root,
      policyMode: 'approve_by_policy',
      allowedPaths: [root],
      allowedCommands: ['echo'],
      allowedDomains: ['localhost'],
    });

    const byName = await executor.runTool({
      toolName: 'fs_search',
      args: { path: '.', query: 'five', mode: 'name' },
      origin: 'web',
    });
    expect(byName.success).toBe(true);
    const byNameOutput = byName.output as { matches: Array<{ relativePath: string; matchType: string }> };
    expect(byNameOutput.matches.some((m) => m.relativePath.endsWith('five-notes.txt') && m.matchType === 'name')).toBe(true);

    const byContent = await executor.runTool({
      toolName: 'fs_search',
      args: { path: '.', query: 'Code GRC', mode: 'content' },
      origin: 'web',
    });
    expect(byContent.success).toBe(true);
    const byContentOutput = byContent.output as { matches: Array<{ relativePath: string; matchType: string; snippet?: string }> };
    const contentMatch = byContentOutput.matches.find((m) => m.relativePath.endsWith('five-notes.txt') && m.matchType === 'content');
    expect(contentMatch).toBeDefined();
    expect(contentMatch?.snippet).toContain('Code GRC');
  });

  it('accepts Windows-style separators in file paths', async () => {
    const root = createExecutorRoot();
    mkdirSync(join(root, 'docs'), { recursive: true });
    await writeFile(join(root, 'docs', 'note.txt'), 'hello backslash path', 'utf-8');

    const executor = new ToolExecutor({
      enabled: true,
      workspaceRoot: root,
      policyMode: 'approve_by_policy',
      allowedPaths: [root],
      allowedCommands: ['echo'],
      allowedDomains: ['localhost'],
    });

    const run = await executor.runTool({
      toolName: 'fs_read',
      args: { path: 'docs\\note.txt' },
      origin: 'web',
    });

    expect(run.success).toBe(true);
    const output = run.output as { content: string };
    expect(output.content).toContain('backslash path');
  });

  it('accepts Windows drive-letter absolute paths in WSL-style runtimes', async () => {
    if (!process.cwd().startsWith('/mnt/')) return;

    const root = createWorkspaceExecutorRoot();
    mkdirSync(join(root, 'docs'), { recursive: true });
    const filePath = join(root, 'docs', 'win-abs.txt');
    await writeFile(filePath, 'absolute windows path', 'utf-8');

    const executor = new ToolExecutor({
      enabled: true,
      workspaceRoot: root,
      policyMode: 'approve_by_policy',
      allowedPaths: [root],
      allowedCommands: ['echo'],
      allowedDomains: ['localhost'],
    });

    const run = await executor.runTool({
      toolName: 'fs_read',
      args: { path: toWindowsPath(filePath) },
      origin: 'web',
    });

    expect(run.success).toBe(true);
    const output = run.output as { content: string };
    expect(output.content).toContain('absolute windows path');
  });

  it('honors explicit deny policy overrides', async () => {
    const root = createExecutorRoot();
    const executor = new ToolExecutor({
      enabled: true,
      workspaceRoot: root,
      policyMode: 'approve_by_policy',
      toolPolicies: { fs_read: 'deny' },
      allowedPaths: [root],
      allowedCommands: ['echo'],
      allowedDomains: ['localhost'],
    });

    const run = await executor.runTool({
      toolName: 'fs_read',
      args: { path: 'missing.txt' },
      origin: 'web',
    });

    expect(run.success).toBe(false);
    expect(run.status).toBe('denied');
  });

  it('discovers contacts from browser page and stores them', async () => {
    const root = createExecutorRoot();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(
      '<html><body>Sales: alice@example.com and bob@example.com</body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html' } },
    )) as typeof fetch;

    try {
      const executor = new ToolExecutor({
        enabled: true,
        workspaceRoot: root,
        policyMode: 'autonomous',
        allowedPaths: [root],
        allowedCommands: ['echo'],
        allowedDomains: ['example.com'],
      });

      const run = await executor.runTool({
        toolName: 'contacts_discover_browser',
        args: { url: 'https://example.com/team' },
        origin: 'web',
      });
      expect(run.success).toBe(true);

      const listed = await executor.runTool({
        toolName: 'contacts_list',
        args: {},
        origin: 'web',
      });
      expect(listed.success).toBe(true);
      const output = listed.output as { count: number };
      expect(output.count).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('runs campaign send behind approval checkpoint', async () => {
    const root = createExecutorRoot();
    const csvPath = join(root, 'contacts.csv');
    await writeFile(csvPath, 'email,name,company,tags\njane@example.com,Jane,Acme,lead', 'utf-8');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(
      JSON.stringify({ id: 'gmail-msg-1' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch;

    try {
      const executor = new ToolExecutor({
        enabled: true,
        workspaceRoot: root,
        policyMode: 'autonomous',
        allowedPaths: [root],
        allowedCommands: ['echo'],
        allowedDomains: ['gmail.googleapis.com'],
      });

      const imported = await executor.runTool({
        toolName: 'contacts_import_csv',
        args: { path: 'contacts.csv' },
        origin: 'cli',
      });
      expect(imported.success).toBe(true);

      const listContacts = await executor.runTool({
        toolName: 'contacts_list',
        args: {},
        origin: 'cli',
      });
      const contactOutput = listContacts.output as { contacts: Array<{ id: string }> };
      const contactId = contactOutput.contacts[0]?.id;
      expect(contactId).toBeDefined();

      const created = await executor.runTool({
        toolName: 'campaign_create',
        args: {
          name: 'Launch',
          subjectTemplate: 'Hello {name}',
          bodyTemplate: 'Welcome {name} at {company}',
          contactIds: [contactId],
        },
        origin: 'cli',
      });
      expect(created.success).toBe(true);
      const campaign = created.output as { id: string };

      const run = await executor.runTool({
        toolName: 'campaign_run',
        args: {
          campaignId: campaign.id,
          accessToken: 'token',
        },
        origin: 'cli',
      });

      expect(run.success).toBe(false);
      expect(run.status).toBe('pending_approval');
      expect(run.approvalId).toBeDefined();

      const approved = await executor.decideApproval(run.approvalId!, 'approved', 'tester');
      expect(approved.success).toBe(true);
      expect(approved.result?.success).toBe(true);
      expect(approved.result?.status).toBe('succeeded');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
