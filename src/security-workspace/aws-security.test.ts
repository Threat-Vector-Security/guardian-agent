import { afterEach, describe, expect, it, vi } from 'vitest';
import { STSClient } from '@aws-sdk/client-sts';
import { EC2Client } from '@aws-sdk/client-ec2';
import { SecurityHubClient } from '@aws-sdk/client-securityhub';
import { GuardDutyClient } from '@aws-sdk/client-guardduty';
import { AwsSecurityIntegration, type AwsSecurityClients } from './aws-security.js';

const accountId = '123456789012';
const region = 'ap-southeast-2';
const config = { accountId, region };
type Reply = (input: Record<string, any>, options: { abortSignal: AbortSignal }) => any;
const integrations: AwsSecurityIntegration[] = [];
afterEach(() => { integrations.splice(0).forEach(item => item.close()); vi.restoreAllMocks(); vi.useRealTimers(); });

function setup(overrides: Record<string, Reply> = {}, timeoutMs = 15000) {
  // Explicit inert credentials and mocked send methods: no provider chain or network.
  const clientConfig = { region, credentials: { accessKeyId: 'test', secretAccessKey: 'test' } };
  const clients: AwsSecurityClients = { sts: new STSClient(clientConfig), ec2: new EC2Client(clientConfig), securityhub: new SecurityHubClient(clientConfig), guardduty: new GuardDutyClient(clientConfig) };
  const calls: Array<{ name: string; input: Record<string, any>; signal: AbortSignal }> = [];
  const defaults: Record<string, Reply> = {
    GetCallerIdentityCommand: () => ({ Account: accountId }),
    DescribeInstancesCommand: () => ({ Reservations: [] }),
    DescribeSecurityGroupsCommand: () => ({ SecurityGroups: [] }),
    DescribeHubCommand: () => ({}),
    GetFindingsCommand: input => input.DetectorId ? { Findings: [] } : { Findings: [] },
    ListDetectorsCommand: () => ({ DetectorIds: ['detector'] }),
    GetDetectorCommand: () => ({ Status: 'ENABLED' }),
    ListFindingsCommand: () => ({ FindingIds: [] }),
  };
  for (const client of Object.values(clients)) {
    vi.spyOn(client, 'send').mockImplementation((async (command: any, options: any) => {
      const name = command.constructor.name;
      calls.push({ name, input: structuredClone(command.input), signal: options.abortSignal });
      const reply = overrides[name] ?? defaults[name];
      if (!reply) throw new Error(`Unexpected command ${name}`);
      return reply(command.input, options);
    }) as any);
  }
  const integration = new AwsSecurityIntegration(config, { clients, timeoutMs, now: () => 1000000 });
  integrations.push(integration);
  return { integration, clients, calls };
}
const hub = (extra = {}) => ({ AwsAccountId: accountId, Region: region, RecordState: 'ACTIVE', Id: 'hub-id', ProductArn: 'product', Title: 'Source title', Severity: { Label: 'HIGH' }, ...extra });
const guard = (extra = {}) => ({ AccountId: accountId, Region: region, Id: 'guard-id', Service: { Archived: false }, Severity: 8, ...extra });
const permission = { IpProtocol: 'tcp', FromPort: 22, ToPort: 22, IpRanges: [{ CidrIp: '0.0.0.0/0' }] };

describe('AWS security collection boundaries', () => {
  it.each([
    { accountId: 'wrong', region }, { accountId, region: 'http://attacker' },
    { ...config, endpoint: 'https://attacker' }, { ...config, profile: '../credentials' },
  ])('rejects invalid enrollment %j', invalid => {
    expect(() => new AwsSecurityIntegration(invalid as any)).toThrow();
  });

  it.each([NaN, Infinity, 0, -1])('rejects invalid timeout %s', timeoutMs => {
    expect(() => new AwsSecurityIntegration(config, { timeoutMs })).toThrow();
  });

  it.each([undefined, '999999999999'])('calls no collection APIs on mismatched/missing identity %s', Account => {
    const { integration, calls } = setup({ GetCallerIdentityCommand: () => ({ Account }) });
    return integration.check().then(report => {
      expect(report.status).toBe('unavailable');
      expect(report.errors[0].code).toBe('AccountMismatch');
      expect(calls.map(item => item.name)).toEqual(['GetCallerIdentityCommand']);
    });
  });

  it('waits for STS before collecting, coalesces concurrent checks, and refreshes subsequent checks', async () => {
    let resolve!: (value: unknown) => void;
    const { integration, calls } = setup({ GetCallerIdentityCommand: () => new Promise(done => { resolve = done; }) });
    const pending = integration.check();
    expect(integration.check()).toBe(pending);
    expect(calls).toHaveLength(1);
    resolve({ Account: accountId });
    expect((await pending).status).toBe('available');
    const refresh = integration.check();
    expect(refresh).not.toBe(pending);
    resolve({ Account: accountId });
    await refresh;
  });

  it('filters ownership and aggregated account/region/state records; preserves untrusted evidence', async () => {
    const { integration, calls } = setup({
      DescribeInstancesCommand: () => ({ Reservations: [{ OwnerId: accountId, Instances: [{ InstanceId: 'owned' }] }, { OwnerId: '999999999999', Instances: [{ InstanceId: 'foreign' }] }, { Instances: [{ InstanceId: 'missing-owner' }] }] }),
      DescribeSecurityGroupsCommand: () => ({ SecurityGroups: [{ OwnerId: accountId, GroupId: 'owned', IpPermissions: [permission] }, { OwnerId: '999999999999', GroupId: 'foreign', IpPermissions: [permission] }] }),
      ListFindingsCommand: () => ({ FindingIds: ['guard-id'] }),
      GetFindingsCommand: input => ({ Findings: input.DetectorId ? [guard(), guard({ AccountId: '999999999999' }), guard({ Region: 'us-east-1' }), guard({ Service: {} }), guard({ Id: 'unrequested' }), guard({ Service: { Archived: true } })] : [hub(), hub({ AwsAccountId: '999999999999' }), hub({ Region: 'us-east-1' }), hub({ RecordState: 'ARCHIVED' })] }),
    });
    const report = await integration.check();
    expect(report.resources?.instances.map(item => item.InstanceId)).toEqual(['owned']);
    expect(report.resources?.securityGroups.map(item => item.GroupId)).toEqual(['owned']);
    expect(report.findings.map(item => item.source).sort()).toEqual(['aws.ec2', 'aws.guardduty', 'aws.securityhub']);
    expect(report.findings.find(item => item.source === 'aws.securityhub')?.evidence).toMatchObject({ original: hub(), trust: 'untrusted' });
    const filter = calls.find(item => item.name === 'GetFindingsCommand' && !item.input.DetectorId)!.input.Filters;
    expect(filter).toMatchObject({ AwsAccountId: [{ Value: accountId }], Region: [{ Value: region }], RecordState: [{ Value: 'ACTIVE' }] });
  });

  it.each([['same', 'same'], ['a', 'b', 'a']])('marks repeated token sequence %j partial', async (...tokens: string[]) => {
    let index = 0;
    const { integration, calls } = setup({ DescribeInstancesCommand: () => ({ Reservations: [], NextToken: tokens[index++] }) });
    const report = await integration.check();
    expect(report.status).toBe('degraded');
    expect(report.errors).toContainEqual(expect.objectContaining({ source: 'aws.ec2.instances', code: 'Truncated' }));
    expect(calls.filter(item => item.name === 'DescribeInstancesCommand')).toHaveLength(tokens.length);
  });

  it('bounds pages even when every page is empty', async () => {
    let index = 0;
    const { integration, calls } = setup({ DescribeInstancesCommand: () => ({ NextToken: `token-${index++}` }) });
    expect((await integration.check()).status).toBe('degraded');
    expect(calls.filter(item => item.name === 'DescribeInstancesCommand')).toHaveLength(10);
  });

  it('bounds oversized inventories and generated findings globally', async () => {
    const { integration } = setup({
      DescribeInstancesCommand: () => ({ Reservations: [{ OwnerId: accountId, Instances: Array.from({ length: 1001 }, (_, i) => ({ InstanceId: `i-${i}` })) }] }),
      DescribeSecurityGroupsCommand: () => ({ SecurityGroups: [{ OwnerId: accountId, GroupId: 'group', IpPermissions: Array.from({ length: 1100 }, () => permission) }] }),
      GetFindingsCommand: () => ({ Findings: Array.from({ length: 1000 }, (_, i) => hub({ Id: `hub-${i}` })) }),
    });
    const report = await integration.check();
    expect(report.resources?.instances).toHaveLength(1000);
    expect(report.findings).toHaveLength(1000);
    expect(report.status).toBe('degraded');
    expect(report.errors.filter(item => item.code === 'Truncated').length).toBeGreaterThanOrEqual(2);
  });

  it.each([[], ['a', 'b']])('does not imply GuardDuty coverage from detectors %j', async (...DetectorIds: string[]) => {
    const { integration, calls } = setup({ ListDetectorsCommand: () => ({ DetectorIds }) });
    const report = await integration.check();
    expect(report.coverage.find(item => item.id === 'aws.guardduty')?.status).toBe('unavailable');
    expect(calls.some(item => item.name === 'GetDetectorCommand')).toBe(false);
  });

  it('does not fetch findings from a disabled detector', async () => {
    const { integration, calls } = setup({ GetDetectorCommand: () => ({ Status: 'DISABLED' }) });
    const report = await integration.check();
    expect(report.errors).toContainEqual(expect.objectContaining({ code: 'NotEnabled' }));
    expect(calls.some(item => item.name === 'ListFindingsCommand')).toBe(false);
  });

  it('retains bounded GuardDuty findings after repeated list tokens and marks them partial', async () => {
    const { integration, calls } = setup({
      ListFindingsCommand: () => ({ FindingIds: ['guard-id'], NextToken: 'repeat' }),
      GetFindingsCommand: input => ({ Findings: input.DetectorId ? [guard()] : [] }),
    });
    const report = await integration.check();
    expect(report.errors).toContainEqual(expect.objectContaining({ source: 'aws.guardduty', code: 'Truncated' }));
    expect(report.findings.some(item => item.source === 'aws.guardduty')).toBe(true);
    expect(calls.filter(item => item.name === 'ListFindingsCommand')).toHaveLength(2);
  });

  it('batches GuardDuty GetFindings at fifty requested IDs', async () => {
    const { integration, calls } = setup({ ListFindingsCommand: () => ({ FindingIds: Array.from({ length: 101 }, (_, i) => `id-${i}`) }) });
    await integration.check();
    expect(calls.filter(item => item.name === 'GetFindingsCommand' && item.input.DetectorId).map(item => item.input.FindingIds.length)).toEqual([50, 50, 1]);
  });

  it('reports unavailable when every observation source fails despite a matching STS identity', async () => {
    const fail = () => { throw Object.assign(new Error('denied'), { name: 'AccessDeniedException' }); };
    const { integration } = setup({ DescribeInstancesCommand: fail, DescribeSecurityGroupsCommand: fail, DescribeHubCommand: fail, ListDetectorsCommand: fail });
    expect((await integration.check()).status).toBe('unavailable');
  });

  it('does not leak SDK or credential-process exception messages', async () => {
    const { integration } = setup({ DescribeHubCommand: () => { throw Object.assign(new Error('secret token stderr'), { name: 'AccessDeniedException' }); } });
    const report = await integration.check();
    expect(report.status).toBe('degraded');
    expect(report.errors).toContainEqual(expect.objectContaining({ source: 'aws.securityhub', code: 'AccessDeniedException' }));
    expect(JSON.stringify(report)).not.toContain('secret token');
  });

  it('labels deadlines Timeout and aborts the actual SDK paginator signal', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    let index = 0;
    const { integration } = setup({ DescribeInstancesCommand: (_input, options) => {
      if (index++ === 0) { signal = options.abortSignal; return { NextToken: 'next' }; }
      expect(options.abortSignal).toBe(signal);
      return new Promise((_resolve, reject) => options.abortSignal.addEventListener('abort', () => reject(Object.assign(new Error('sdk aborted'), { name: 'AbortError' })), { once: true }));
    } }, 20);
    const pending = integration.check();
    await vi.advanceTimersByTimeAsync(21);
    const report = await pending;
    expect(signal?.aborted).toBe(true);
    expect(report.errors).toContainEqual(expect.objectContaining({ code: 'Timeout' }));
    expect(report.errors.some(item => item.code === 'Aborted' || item.code === 'AbortError')).toBe(false);
  });

  it('never consumes late paginator data after its timeout', async () => {
    vi.useFakeTimers();
    let resolve!: (page: unknown) => void;
    const { integration, calls } = setup({ DescribeInstancesCommand: () => new Promise(done => { resolve = done; }) }, 20);
    const pending = integration.check();
    await vi.advanceTimersByTimeAsync(21);
    const report = await pending;
    resolve({ Reservations: [{ OwnerId: accountId, Instances: [{ InstanceId: 'late' }] }], NextToken: 'another' });
    await vi.advanceTimersByTimeAsync(1);
    expect(report.resources?.instances).toEqual([]);
    expect(calls.filter(item => item.name === 'DescribeInstancesCommand')).toHaveLength(1);
  });

  it('close interrupts active requests, destroys clients and rejects later collection', async () => {
    const { integration, clients, calls } = setup({ GetCallerIdentityCommand: (_input, options) => new Promise((_resolve, reject) => options.abortSignal.addEventListener('abort', () => reject(new Error('aborted')))) });
    const destroys = Object.values(clients).map(client => vi.spyOn(client, 'destroy'));
    const pending = integration.check();
    integration.close();
    const report = await pending;
    expect(report.errors[0].code).toBe('Aborted');
    expect(calls[0].signal.aborted).toBe(true);
    destroys.forEach(spy => expect(spy).toHaveBeenCalledOnce());
    await expect(integration.check()).rejects.toThrow('closed');
  });
});
