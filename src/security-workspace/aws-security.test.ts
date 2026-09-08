import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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
const configDirectories: string[] = [];
afterEach(() => {
  integrations.splice(0).forEach(item => item.close());
  for (const directory of configDirectories.splice(0)) {
    if (!directory.startsWith(join(tmpdir(), 'guardian-aws-config-'))) throw new Error('Unexpected AWS test directory');
    rmSync(directory, { recursive: true, force: true });
  }
  vi.restoreAllMocks(); vi.useRealTimers();
});

function hostEnvironment(content = ''): NodeJS.ProcessEnv {
  const directory = mkdtempSync(join(tmpdir(), 'guardian-aws-config-'));
  configDirectories.push(directory);
  const env = { AWS_CONFIG_FILE: join(directory, 'config'), AWS_SHARED_CREDENTIALS_FILE: join(directory, 'credentials') };
  writeFileSync(env.AWS_CONFIG_FILE, content);
  writeFileSync(env.AWS_SHARED_CREDENTIALS_FILE, '');
  return env;
}

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

describe('AWS host credential enrollment', () => {
  it('discovers only STS at startup, then pins the account for explicit collection', async () => {
    let currentAccount = accountId;
    const { clients, calls } = setup({ GetCallerIdentityCommand: () => ({ Account: currentAccount }) });
    const result = await AwsSecurityIntegration.fromEnvironment({ ...hostEnvironment(), AWS_REGION: region }, { clients, now: () => 1234 });
    const integration = result.integration!;
    integrations.push(integration);
    expect(result.unavailable).toBeUndefined();
    expect(integration.status()).toMatchObject({ configured: true, mode: 'host_cli', accountId, region, identityOk: true, lastIdentityAt: 1234 });
    expect(calls.map(item => item.name)).toEqual(['GetCallerIdentityCommand']);
    expect((await integration.check()).status).toBe('available');
    calls.length = 0;
    currentAccount = '999999999999';
    const mismatch = await integration.check();
    expect(mismatch.errors).toContainEqual(expect.objectContaining({ code: 'AccountMismatch' }));
    expect(calls.map(item => item.name)).toEqual(['GetCallerIdentityCommand']);
    expect(integration.status()).toMatchObject({ accountId, identityOk: false, status: 'degraded', lastIdentityAt: 1234 });
    currentAccount = accountId;
    expect((await integration.check()).status).toBe('available');
    expect(integration.status()).toMatchObject({ accountId, identityOk: true, status: 'configured' });
  });

  it.each([
    [{ AWS_REGION: region, AWS_DEFAULT_REGION: 'us-west-2' }, region, undefined],
    [{ AWS_DEFAULT_REGION: 'us-west-2' }, 'us-west-2', undefined],
    [{}, 'eu-west-1', undefined],
    [{ AWS_REGION: '', AWS_DEFAULT_REGION: '' }, 'eu-west-1', undefined],
    [{ AWS_PROFILE: 'cli' }, 'ap-northeast-1', 'cli'],
    [{ GUARDIAN_AWS_PROFILE: 'guardian', AWS_PROFILE: 'cli' }, 'ap-southeast-2', 'guardian'],
    [{ GUARDIAN_AWS_PROFILE: 'guardian', AWS_REGION: 'us-east-2' }, 'us-east-2', 'guardian'],
  ])('resolves environment/profile precedence %j', async (overrides, expectedRegion, expectedProfile) => {
    const env = hostEnvironment('[default]\nregion = eu-west-1\n[profile cli]\nregion = ap-northeast-1\n[profile guardian]\nregion = ap-southeast-2\n');
    const { clients } = setup();
    const { integration } = await AwsSecurityIntegration.fromEnvironment({ ...env, ...overrides }, { clients });
    integrations.push(integration!);
    expect(integration!.status()).toMatchObject({ mode: 'host_cli', accountId, region: expectedRegion });
    expect(integration!.status().profile).toBe(expectedProfile);
  });

  it('requires a region and does not substitute the SSO login region', async () => {
    const { clients, calls } = setup();
    const { integration, unavailable } = await AwsSecurityIntegration.fromEnvironment(hostEnvironment('[default]\nsso_region = us-east-1\n'), { clients });
    expect(integration).toBeUndefined();
    expect(unavailable).toMatchObject({ configured: false, mode: 'host_cli', status: 'needs_region', identityOk: false });
    expect(unavailable?.message).toContain('AWS_REGION');
    expect(calls).toEqual([]);
  });

  it.each(['http://attacker', 'secret region'])('does not call STS or echo invalid region %s', async value => {
    const { clients, calls } = setup();
    const result = await AwsSecurityIntegration.fromEnvironment({ ...hostEnvironment(), AWS_REGION: value }, { clients });
    expect(result.unavailable?.status).toBe('needs_region');
    expect(JSON.stringify(result)).not.toContain(value);
    expect(calls).toEqual([]);
  });

  it.each(['CredentialsProviderError', 'TokenProviderError', 'ExpiredTokenException'])('keeps %s nonfatal and does not expose credential-process errors', async name => {
    const { clients, calls } = setup({ GetCallerIdentityCommand: () => { throw Object.assign(new Error('secret token from credential process'), { name }); } });
    const result = await AwsSecurityIntegration.fromEnvironment({ ...hostEnvironment(), AWS_REGION: region }, { clients });
    expect(result.integration).toBeUndefined();
    expect(result.unavailable).toMatchObject({ configured: false, status: 'unavailable', mode: 'host_cli', identityOk: false, region });
    expect(result.unavailable?.message).toContain('aws sso login');
    expect(JSON.stringify(result)).not.toContain('secret token');
    expect(calls.map(item => item.name)).toEqual(['GetCallerIdentityCommand']);
  });

  it.each([undefined, '999', 'invalid-secret-account'])('refuses invalid STS account %s', async Account => {
    const { clients, calls } = setup({ GetCallerIdentityCommand: () => ({ Account }) });
    const result = await AwsSecurityIntegration.fromEnvironment({ ...hostEnvironment(), AWS_REGION: region }, { clients });
    expect(result.integration).toBeUndefined();
    expect(result.unavailable?.status).toBe('unavailable');
    expect(result.unavailable?.accountId).toBeUndefined();
    expect(calls).toHaveLength(1);
  });

  it.each([
    { GUARDIAN_AWS_ACCOUNT_ID: accountId }, { GUARDIAN_AWS_REGION: region },
    { GUARDIAN_AWS_PROFILE: '../invalid' }, { AWS_PROFILE: '../invalid' },
  ])('fails fast for invalid explicit environment %j', async env => {
    const { clients, calls } = setup();
    await expect(AwsSecurityIntegration.fromEnvironment(env, { clients })).rejects.toThrow();
    expect(calls).toEqual([]);
  });

  it('retains the pinned construction path and account mismatch guard', async () => {
    const { clients, calls } = setup({ GetCallerIdentityCommand: () => ({ Account: '999999999999' }) });
    const { integration } = await AwsSecurityIntegration.fromEnvironment({ GUARDIAN_AWS_ACCOUNT_ID: accountId, GUARDIAN_AWS_REGION: region, GUARDIAN_AWS_PROFILE: 'guardian', AWS_PROFILE: 'cli', AWS_REGION: 'us-east-1' }, { clients });
    integrations.push(integration!);
    expect(calls).toEqual([]);
    expect(integration!.status()).toMatchObject({ mode: 'pinned', configured: true, accountId, region, profile: 'guardian', identityOk: false });
    expect((await integration!.check()).errors[0].code).toBe('AccountMismatch');
    expect(calls.map(item => item.name)).toEqual(['GetCallerIdentityCommand']);
  });

  it('bounds startup discovery and ignores a late identity response', async () => {
    vi.useFakeTimers();
    let resolve!: (identity: unknown) => void;
    const { clients, calls } = setup({ GetCallerIdentityCommand: () => new Promise(done => { resolve = done; }) });
    const pending = AwsSecurityIntegration.fromEnvironment({ ...hostEnvironment(), AWS_REGION: region }, { clients, timeoutMs: 20 });
    await vi.advanceTimersByTimeAsync(21);
    const result = await pending;
    expect(result.integration).toBeUndefined();
    expect(result.unavailable?.message).toContain('timed out');
    expect(calls[0].signal.aborted).toBe(true);
    resolve({ Account: accountId });
    await vi.advanceTimersByTimeAsync(1);
    expect(result.integration).toBeUndefined();
    expect(calls).toHaveLength(1);
  });

  it.each([undefined, 'cli'])('uses SDK credentials and pins endpoints for profile %s without making network calls', async profile => {
    const env = { ...hostEnvironment(`[${profile ? `profile ${profile}` : 'default'}]\nregion = cn-north-1\nendpoint_url = http://attacker\n`), ...(profile ? { AWS_PROFILE: profile } : {}) };
    if (profile) writeFileSync(env.AWS_SHARED_CREDENTIALS_FILE!, `[${profile}]\naws_access_key_id = test\naws_secret_access_key = test\n`);
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    vi.stubEnv('AWS_PROFILE', undefined);
    vi.stubEnv('AWS_ACCESS_KEY_ID', profile ? undefined : 'test');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', profile ? undefined : 'test');
    vi.stubEnv('AWS_SESSION_TOKEN', undefined);
    for (const key of ['AWS_ENDPOINT_URL', 'AWS_ENDPOINT_URL_STS', 'AWS_ENDPOINT_URL_EC2', 'AWS_ENDPOINT_URL_SECURITY_HUB', 'AWS_ENDPOINT_URL_GUARD_DUTY']) vi.stubEnv(key, 'http://attacker');
    const hosts: string[] = [];
    for (const Client of [STSClient, EC2Client, SecurityHubClient, GuardDutyClient]) {
      const send = Client.prototype.send;
      vi.spyOn(Client.prototype, 'send').mockImplementation(function (this: STSClient, command: any, options: any) {
        this.middlewareStack.add(() => async (args: any) => {
          hosts.push(args.request.hostname);
          return { response: {}, output: { $metadata: {}, Account: accountId, Reservations: [], SecurityGroups: [], Findings: [], DetectorIds: [] } };
        }, { step: 'finalizeRequest', name: 'captureWithoutNetwork', priority: 'high', override: true });
        return send.call(this, command, options);
      } as any);
    }
    const { integration } = await AwsSecurityIntegration.fromEnvironment(env);
    expect(integration).toBeDefined();
    integrations.push(integration!);
    await integration!.check();
    expect(hosts).toEqual(expect.arrayContaining(['sts.cn-north-1.amazonaws.com.cn', 'ec2.cn-north-1.amazonaws.com.cn', 'securityhub.cn-north-1.amazonaws.com.cn', 'guardduty.cn-north-1.amazonaws.com.cn']));
    expect(hosts.every(host => host.endsWith('.cn-north-1.amazonaws.com.cn'))).toBe(true);
  });
});

describe('AWS security collection boundaries', () => {
  it.each([
    { accountId: 'wrong', region }, { accountId, region: 'http://attacker' },
    { ...config, endpoint: 'https://attacker' }, { ...config, profile: '../credentials' },
    { ...config, accessKeyId: 'test' }, { ...config, secretAccessKey: 'test' }, { ...config, credentials: {} },
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
