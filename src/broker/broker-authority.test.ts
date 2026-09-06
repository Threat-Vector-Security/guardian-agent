import { PassThrough } from 'node:stream';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { OutputGuardian } from '../guardian/output-guardian.js';
import type { Runtime } from '../runtime/runtime.js';
import { ToolExecutor } from '../tools/executor.js';
import type { ToolDefinition, ToolExecutionRequest, ToolJobRecord } from '../tools/types.js';
import { BrokerServer } from './broker-server.js';
import { CapabilityTokenManager, type TokenMintOptions } from './capability-token.js';
import type { JsonRpcResponse } from './types.js';

const fileTool: ToolDefinition = { name: 'fs_read', description: 'Read', risk: 'read_only', category: 'filesystem', parameters: {} };
const networkTool: ToolDefinition = { name: 'web_fetch', description: 'Fetch', risk: 'read_only', category: 'network', parameters: {} };

function setup(options: Partial<TokenMintOptions> = {}, executor?: ToolExecutor) {
  const input = new PassThrough();
  const output = new PassThrough();
  const tokenManager = new CapabilityTokenManager();
  const token = tokenManager.mint({
    workerId: 'worker', sessionId: 'session', agentId: 'agent', authorizedBy: 'alice', authorizedChannel: 'web',
    grantedCapabilities: ['read_files'],
    executionContext: { principalId: 'alice-principal', principalRole: 'operator', requestId: 'request', codeContext: { workspaceRoot: '/approved', sessionId: 'code' } },
    ...options,
  });
  const runTool = vi.fn(async (request: ToolExecutionRequest) => {
    request.agentContext!.checkAction({ type: 'read_file', params: { path: '/approved/file' } });
    return { success: true, status: 'succeeded', output: 'safe' };
  });
  const listJobs = vi.fn((): ToolJobRecord[] => []);
  const listApprovals = vi.fn(() => []);
  const decideApproval = vi.fn();
  const tools = {
    runTool, listJobs, listApprovals, decideApproval,
    getToolDefinition: vi.fn((name: string) => [fileTool, networkTool].find((tool) => tool.name === name)),
    searchTools: vi.fn(() => [fileTool, networkTool]),
    listAlwaysLoadedDefinitions: vi.fn(() => [fileTool, networkTool]),
    listCodeSessionEagerToolDefinitions: vi.fn(() => []),
  };
  const runtime = {
    guardian: { check: vi.fn(() => ({ allowed: true })) },
    outputGuardian: new OutputGuardian(undefined, { enabled: false }),
    auditLog: { record: vi.fn() },
  };
  new BrokerServer({ tools: executor ?? tools as unknown as ToolExecutor, runtime: runtime as unknown as Runtime, inputStream: input, outputStream: output, workerId: 'worker', tokenManager });
  let nextId = 0;
  const request = (method: string, params: Record<string, unknown> = {}) => new Promise<JsonRpcResponse>((resolve) => {
    output.once('data', (chunk: Buffer) => resolve(JSON.parse(chunk.toString()) as JsonRpcResponse));
    input.write(`${JSON.stringify({ jsonrpc: '2.0', id: String(++nextId), method, params: { capabilityToken: token.id, ...params } })}\n`);
  });
  return { token, tokenManager, request, tools, runtime };
}

describe('broker authority boundary', () => {
  it('enforces token grants against the real filesystem tool and preserves allowed reads', async () => {
    const root = mkdtempSync(join(tmpdir(), 'guardian-broker-authority-'));
    try {
      writeFileSync(join(root, 'evidence.txt'), 'approved evidence');
      const executor = new ToolExecutor({
        enabled: true, workspaceRoot: root, allowedPaths: [root], allowedCommands: [], allowedDomains: [], policyMode: 'approve_by_policy',
      });
      const denied = setup({ grantedCapabilities: [], executionContext: { principalId: 'alice', principalRole: 'operator' } }, executor);
      const rejected = await denied.request('tool.call', { toolName: 'fs_read', args: { path: 'evidence.txt' } });
      expect(rejected.result).toMatchObject({ success: false });
      expect(JSON.stringify(rejected)).toContain("lacks capability 'read_files'");
      expect(JSON.stringify(rejected)).not.toContain('approved evidence');
      const allowed = setup({ grantedCapabilities: ['read_files'], executionContext: { principalId: 'alice', principalRole: 'operator' } }, executor);
      const accepted = await allowed.request('tool.call', { toolName: 'fs_read', args: { path: 'evidence.txt' } });
      expect(accepted.error).toBeUndefined();
      expect(accepted.result).toMatchObject({ success: true });
      expect(JSON.stringify(accepted)).toContain('approved evidence');
    } finally {
      if (!resolve(root).startsWith(resolve(tmpdir()) + '\\') && !resolve(root).startsWith(resolve(tmpdir()) + '/')) throw new Error('Test cleanup outside temporary directory');
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses only minted identity, workspace, request and memory authority despite forged worker fields', async () => {
    const { request, tools } = setup();
    const response = await request('tool.call', {
      toolName: 'fs_read', userId: 'victim', principalId: 'root', principalRole: 'owner', channel: 'cli',
      codeContext: { workspaceRoot: '/secret', sessionId: 'other' }, requestId: 'other', requestText: 'forged',
      allowModelMemoryMutation: true, scheduleId: 'approved-schedule', activeSkills: ['privileged'],
    });
    expect(response.error).toBeUndefined();
    expect(tools.runTool).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'alice', principalId: 'alice-principal', principalRole: 'operator', channel: 'web',
      codeContext: { workspaceRoot: '/approved', sessionId: 'code' }, requestId: 'request',
    }));
    const context = tools.runTool.mock.calls[0][0];
    expect(context.allowModelMemoryMutation).not.toBe(true);
    expect(context.scheduleId).toBeUndefined();
    expect(context.activeSkills).toBeUndefined();
    expect(context.requestText).toBeUndefined();
  });

  it('never elevates a token without an explicit supervisor principal role', async () => {
    const { request, tools } = setup({ executionContext: undefined });
    await request('tool.call', { toolName: 'fs_read', principalRole: 'owner' });
    expect(tools.runTool.mock.calls[0][0]).toMatchObject({ principalId: 'alice', principalRole: 'viewer' });
  });

  it('enforces action capabilities even when the general Guardian check would allow the action', async () => {
    const { request, runtime } = setup({ grantedCapabilities: ['network_access'] });
    const response = await request('tool.call', { toolName: 'fs_read', grantedCapabilities: ['read_files'] });
    expect(response.error?.message).toContain("lacks capability 'read_files'");
    expect(runtime.guardian.check).not.toHaveBeenCalled();
  });

  it('preserves all other Guardian checks after granting the action', async () => {
    const { request, runtime } = setup();
    runtime.guardian.check.mockReturnValue({ allowed: false });
    const response = await request('tool.call', { toolName: 'fs_read' });
    expect(response.error?.message).toContain('Action denied');
    expect(runtime.guardian.check).toHaveBeenCalledWith(expect.objectContaining({ capabilities: ['read_files'], agentId: 'agent' }));
  });

  it('filters discovery and rejects dispatch outside the category grant', async () => {
    const { request, tools } = setup({ allowedToolCategories: ['filesystem'] });
    expect((await request('tool.search', { query: 'all' })).result).toEqual({ tools: [fileTool] });
    expect((await request('tool.listLoaded')).result).toEqual({ tools: [fileTool] });
    expect((await request('tool.call', { toolName: 'web_fetch' })).error?.message).toContain('category grant');
    expect(tools.runTool).not.toHaveBeenCalled();
  });

  it('treats an empty category grant as no tools, including tools without category metadata', async () => {
    const { request, tools } = setup({ allowedToolCategories: [] });
    tools.getToolDefinition.mockReturnValue({ ...fileTool, category: undefined });
    expect((await request('tool.listLoaded')).result).toEqual({ tools: [] });
    expect((await request('tool.call', { toolName: 'fs_read' })).error).toBeDefined();
    expect(tools.runTool).not.toHaveBeenCalled();
  });

  it('denies worker approval decisions even for owner tokens and explicit forged approval grants', async () => {
    const { request, tools } = setup({ grantedCapabilities: ['approval.decide'], executionContext: { principalRole: 'owner' } });
    const response = await request('approval.decide', { approvalId: 'approval', decision: 'approved', actor: 'root', actorRole: 'owner' });
    expect(response.error?.message).toContain('Workers cannot decide approvals');
    expect(tools.decideApproval).not.toHaveBeenCalled();
  });

  it('does not let the worker clear supervisor-observed output taint', async () => {
    const { request, tools, runtime } = setup();
    vi.spyOn(runtime.outputGuardian, 'scanToolResult').mockReturnValue({
      sanitized: 'external', trustLevel: 'low_trust', taintReasons: ['remote'], allowPlannerRawContent: true,
    } as ReturnType<OutputGuardian['scanToolResult']>);
    await request('tool.call', { toolName: 'fs_read' });
    await request('tool.call', { toolName: 'fs_read', contentTrustLevel: 'trusted', taintReasons: [], derivedFromTaintedContent: false });
    expect(tools.runTool.mock.calls[1][0]).toMatchObject({ contentTrustLevel: 'low_trust', taintReasons: ['remote'], derivedFromTaintedContent: true });
  });

  it('scopes jobs and approval reads to the minted user, channel, principal, agent and code session', async () => {
    const { request, tools } = setup();
    const own = { id: 'own', userId: 'alice', principalId: 'alice-principal', agentId: 'agent', channel: 'web', codeSessionId: 'code', approvalId: 'own-approval', toolName: 'fs_read', status: 'succeeded', resultPreview: 'own data' } as ToolJobRecord;
    const otherJobs = [
      { userId: 'bob' }, { principalId: 'other' }, { agentId: 'other' }, { channel: 'cli' }, { codeSessionId: 'other' },
    ].map((change, index) => ({ ...own, ...change, id: `other-${index}`, approvalId: `other-${index}`, resultPreview: 'private data' }));
    tools.listJobs.mockReturnValue([own, ...otherJobs]);
    tools.listApprovals.mockReturnValue([own, ...otherJobs].map((job) => ({ id: job.approvalId, jobId: job.id, status: 'approved' })) as never[]);
    const jobs = await request('job.list', { userId: 'bob', channel: 'cli' });
    expect((jobs.result as { jobs: unknown[] }).jobs).toHaveLength(1);
    expect((await request('approval.result', { approvalId: 'own-approval' })).result).toMatchObject({ found: true, message: 'own data' });
    for (const job of otherJobs) {
      expect((await request('approval.result', { approvalId: job.approvalId })).result).toMatchObject({ found: false, status: 'not_found' });
      expect((await request('approval.status', { approvalId: job.approvalId })).result).toEqual({ status: 'not_found' });
    }
  });

  it('cannot widen grants by mutating minted or returned token snapshots', () => {
    const { token, tokenManager } = setup({ allowedToolCategories: ['filesystem'] });
    token.allowedToolCategories!.push('network');
    token.executionContext!.principalRole = 'owner';
    const snapshot = tokenManager.get(token.id)!;
    expect(snapshot.allowedToolCategories).toEqual(['filesystem']);
    expect(snapshot.executionContext?.principalRole).toBe('operator');
    snapshot.executionContext!.principalRole = 'owner';
    expect(tokenManager.get(token.id)?.executionContext?.principalRole).toBe('operator');
  });

  it('rejects wrong-worker, expired, revoked and exhausted tokens', async () => {
    for (const options of [{ workerId: 'other' }, { ttlMs: 0 }, { maxToolCalls: 1 }]) {
      const { request, token, tokenManager } = setup(options);
      if ('maxToolCalls' in options) tokenManager.validateAndUse(token.id, 'worker');
      expect((await request('tool.call', { toolName: 'fs_read' })).error).toBeDefined();
    }
    const { request, token, tokenManager } = setup();
    tokenManager.revoke(token.id);
    expect((await request('tool.call', { toolName: 'fs_read' })).error).toBeDefined();
  });
});
