import { createHash } from 'node:crypto';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { EC2Client, paginateDescribeInstances, paginateDescribeSecurityGroups, type Instance, type SecurityGroup } from '@aws-sdk/client-ec2';
import { SecurityHubClient, DescribeHubCommand, paginateGetFindings as paginateSecurityHubFindings, type AwsSecurityFinding } from '@aws-sdk/client-securityhub';
import { GuardDutyClient, GetDetectorCommand, GetFindingsCommand, paginateListDetectors, paginateListFindings, type Finding } from '@aws-sdk/client-guardduty';

export interface AwsSecurityConfig { region: string; accountId: string; profile?: string }
export interface AwsSecurityClients { sts: STSClient; ec2: EC2Client; securityhub: SecurityHubClient; guardduty: GuardDutyClient }
export interface AwsSecurityOptions { clients?: AwsSecurityClients; timeoutMs?: number; now?: () => number }
type Status = 'available' | 'degraded' | 'unavailable';
export interface AwsSecurityReport {
  accountId: string; region: string; collectedAt: number; status: Status;
  errors: Array<{ source: string; code: string; message: string }>;
  coverage: Array<{ id: string; name: string; status: Status; description: string }>;
  findings: Array<{ id: string; source: string; severity: string; title: string; description: string; evidence: unknown; observedAt: number }>;
  resources?: { instances: Instance[]; securityGroups: SecurityGroup[] };
}
const MAX_PAGES = 10;
const MAX_ITEMS = 1000;
const MANAGEMENT_PORTS = [22, 3389, 5985, 5986];
class CollectionError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
const idFor = (source: string, ...parts: string[]): string => `aws:${source}:${createHash('sha256').update(JSON.stringify(parts)).digest('hex')}`;

/** Explicit account/region enrollment only. No ambient-credential autodiscovery. */
export class AwsSecurityIntegration {
  readonly target: string;
  private readonly clients: AwsSecurityClients;
  private readonly config: Readonly<AwsSecurityConfig>;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly aborts = new Set<AbortController>();
  private pending?: Promise<AwsSecurityReport>;
  private closed = false;

  constructor(config: AwsSecurityConfig, options: AwsSecurityOptions = {}) {
    if (!config || Object.keys(config).some(key => !['region', 'accountId', 'profile'].includes(key)) || !/^\d{12}$/.test(config.accountId ?? '')
      || !/^(?:af|ap|ca|cn|eu|il|me|mx|sa|us)(?:-gov)?-[a-z]+-\d+$/.test(config.region ?? '')
      || (config.profile !== undefined && !/^[A-Za-z0-9_.@+=-]{1,128}$/.test(config.profile))) throw new Error('An explicit AWS account ID, supported AWS region and optional named profile are required; endpoints and access keys are not accepted.');
    this.config = Object.freeze({ ...config });
    this.target = `aws:${config.accountId}:${config.region}`;
    if (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)) throw new Error('AWS timeout must be a positive finite duration.');
    this.timeoutMs = Math.min(15000, Math.max(1, options.timeoutMs ?? 15000));
    this.now = options.now ?? Date.now;
    const base = { region: config.region, ...(config.profile ? { profile: config.profile } : {}), maxAttempts: 2 };
    // Pin service endpoints so AWS_ENDPOINT_URL/profile endpoint overrides cannot
    // redirect signed inventory requests. Credentials still use the SDK chain.
    const endpoint = (service: string) => `https://${service}.${config.region}.${config.region.startsWith('cn-') ? 'amazonaws.com.cn' : 'amazonaws.com'}`;
    this.clients = options.clients ?? {
      sts: new STSClient({ ...base, endpoint: endpoint('sts') }),
      ec2: new EC2Client({ ...base, endpoint: endpoint('ec2') }),
      securityhub: new SecurityHubClient({ ...base, endpoint: endpoint('securityhub') }),
      guardduty: new GuardDutyClient({ ...base, endpoint: endpoint('guardduty') }),
    };
  }

  private async call<T>(action: (options: { abortSignal: AbortSignal }) => Promise<T>): Promise<T> {
    if (this.closed) throw new CollectionError('Closed', 'AWS integration is closed.');
    const controller = new AbortController();
    this.aborts.add(controller);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(new CollectionError('Timeout', 'AWS read operation exceeded its time limit; coverage is incomplete.')); }, this.timeoutMs);
      controller.signal.addEventListener('abort', () => reject(controller.signal.reason instanceof CollectionError ? controller.signal.reason : new CollectionError('Aborted', 'AWS read operation was interrupted; coverage is incomplete.')), { once: true });
    });
    try { return await Promise.race([action({ abortSignal: controller.signal }), deadline]); }
    finally { if (timer) clearTimeout(timer); this.aborts.delete(controller); }
  }

  private async pages<T extends { NextToken?: string }>(factory: (options: { abortSignal: AbortSignal }) => AsyncIterable<T>, consume: (page: T, remaining: number) => number): Promise<void> {
    // One fixed signal bounds the whole traversal and reaches every SDK request.
    await this.call(async options => {
      const tokens = new Set<string>();
      let count = 0;
      let pages = 0;
      for await (const page of factory(options)) {
        if (options.abortSignal.aborted) throw options.abortSignal.reason;
        pages++;
        count += consume(page, Math.max(0, MAX_ITEMS - count));
        if (page.NextToken && tokens.has(page.NextToken)) throw new CollectionError('Truncated', 'AWS returned a repeated pagination token; coverage is incomplete.');
        if (count > MAX_ITEMS || (page.NextToken && (count >= MAX_ITEMS || pages >= MAX_PAGES))) throw new CollectionError('Truncated', 'AWS results exceeded 10 pages or 1000 records; this is a partial inventory.');
        if (!page.NextToken) return;
        tokens.add(page.NextToken);
      }
    });
  }

  private addFinding(report: AwsSecurityReport, finding: AwsSecurityReport['findings'][number]): void {
    if (report.findings.length >= MAX_ITEMS) throw new CollectionError('Truncated', 'AWS findings exceeded the global 1000-record limit; coverage is incomplete.');
    report.findings.push(finding);
  }

  check(): Promise<AwsSecurityReport> {
    if (this.pending) return this.pending;
    if (this.closed) return Promise.reject(new Error('AWS integration is closed.'));
    const pending = this.collect();
    this.pending = pending;
    void pending.finally(() => { if (this.pending === pending) this.pending = undefined; }).catch(() => {});
    return pending;
  }

  private error(report: AwsSecurityReport, source: string, error: unknown): void {
    const code = error instanceof CollectionError ? error.code : error instanceof Error ? error.name : 'UnknownError';
    // SDK messages may include account details, URLs or credential-process stderr.
    const safeCode = /^[A-Za-z][A-Za-z0-9_.-]{0,100}$/.test(code) ? code : 'UnknownError';
    report.errors.push({ source, code: safeCode, message: error instanceof CollectionError ? error.message : 'AWS read failed. Check this profile, service availability and read permissions; no remediation was attempted.' });
  }

  private async collect(): Promise<AwsSecurityReport> {
    const report: AwsSecurityReport = { accountId: this.config.accountId, region: this.config.region, collectedAt: this.now(), status: 'unavailable', errors: [], coverage: [], findings: [], resources: { instances: [], securityGroups: [] } };
    try {
      const identity = await this.call(options => this.clients.sts.send(new GetCallerIdentityCommand({}), options));
      if (identity.Account !== this.config.accountId) throw new CollectionError('AccountMismatch', 'The authenticated AWS account differs from the configured account. No inventory or finding APIs were called.');
    } catch (error) {
      this.error(report, 'sts', error);
      report.coverage.push({ id: 'aws.identity', name: 'AWS account identity', status: 'unavailable', description: 'Account identity verification failed. All other collection was skipped.' });
      return report;
    }
    report.coverage.push({ id: 'aws.identity', name: 'AWS account identity', status: 'available', description: 'STS identity matched the explicitly configured account.' });
    const service = async (id: string, name: string, description: string, action: () => Promise<void>) => {
      let status: Status = 'available';
      try { await action(); }
      catch (error) { status = error instanceof CollectionError && error.code === 'Truncated' ? 'degraded' : 'unavailable'; this.error(report, id, error); }
      report.coverage.push({ id, name, status, description });
    };
    await Promise.all([
      service('aws.ec2.instances', 'EC2 instances', 'Bounded EC2 instance inventory for the configured region. Inventory does not establish guest security or private network reachability.', () => this.instances(report)),
      service('aws.ec2.security-groups', 'EC2 security groups', 'Ingress configuration observations only. Public CIDRs are not proof that a host is reachable; routes, NACLs, public addresses and host controls are not evaluated.', () => this.securityGroups(report)),
      service('aws.securityhub', 'Security Hub CSPM findings', 'Active ASFF findings for this account and region, retaining source records and original identifiers. Empty findings do not establish a secure account.', () => this.securityHub(report)),
      service('aws.guardduty', 'GuardDuty findings', 'Existing enabled detector and unarchived findings only. Disabled/unavailable detectors provide no assurance; no service is automatically enabled.', () => this.guardDuty(report)),
    ]);
    const observations = report.coverage.filter(item => item.id !== 'aws.identity');
    report.status = observations.every(item => item.status === 'unavailable') ? 'unavailable' : report.errors.length ? 'degraded' : 'available';
    report.collectedAt = this.now();
    return report;
  }

  private async instances(report: AwsSecurityReport): Promise<void> {
    await this.pages(options => paginateDescribeInstances({ client: this.clients.ec2, pageSize: 100, stopOnSameToken: true }, {}, options), (page, remaining) => {
      const values = (page.Reservations ?? []).flatMap(item => (item.Instances ?? []).map(instance => ({ instance, ownerId: item.OwnerId })));
      report.resources!.instances.push(...values.slice(0, remaining).filter(item => item.ownerId === this.config.accountId).map(item => item.instance));
      return values.length;
    });
  }

  private async securityGroups(report: AwsSecurityReport): Promise<void> {
    await this.pages(options => paginateDescribeSecurityGroups({ client: this.clients.ec2, pageSize: 100, stopOnSameToken: true }, {}, options), (page, remaining) => {
      const values = page.SecurityGroups ?? [];
      for (const group of values.slice(0, remaining)) {
        if (group.OwnerId !== this.config.accountId) continue;
        report.resources!.securityGroups.push(group);
        for (const permission of group.IpPermissions ?? []) {
          const protocol = permission.IpProtocol;
          if (!['-1', 'tcp', '6', 'udp', '17'].includes(protocol ?? '')) continue;
          const ports = MANAGEMENT_PORTS.filter(port => protocol === '-1' || (typeof permission.FromPort === 'number' && typeof permission.ToPort === 'number' && permission.FromPort <= port && permission.ToPort >= port));
          const cidrs = [...(permission.IpRanges ?? []).map(range => range.CidrIp), ...(permission.Ipv6Ranges ?? []).map(range => range.CidrIpv6)].filter((cidr): cidr is string => cidr === '0.0.0.0/0' || cidr === '::/0');
          if (!ports.length || !cidrs.length || !group.GroupId) continue;
          this.addFinding(report, { id: idFor('ec2', this.target, group.GroupId, String(protocol), ports.join(','), [...cidrs].sort().join(',')), source: 'aws.ec2', severity: 'high', title: 'Security group permits public management-port ingress', description: `Security group ${group.GroupId} permits ${protocol === '-1' ? 'all protocols' : protocol} traffic on management ports ${ports.join(', ')} from ${cidrs.join(', ')}. This is a configuration risk, not verified host reachability.`, evidence: { accountId: this.config.accountId, region: this.config.region, groupId: group.GroupId, vpcId: group.VpcId, permission, observationOnly: true }, observedAt: this.now() });
        }
      }
      return values.length;
    });
  }

  private async securityHub(report: AwsSecurityReport): Promise<void> {
    await this.call(options => this.clients.securityhub.send(new DescribeHubCommand({}), options));
    await this.pages(options => paginateSecurityHubFindings({ client: this.clients.securityhub, pageSize: 100, stopOnSameToken: true }, { Filters: { AwsAccountId: [{ Value: this.config.accountId, Comparison: 'EQUALS' }], Region: [{ Value: this.config.region, Comparison: 'EQUALS' }], RecordState: [{ Value: 'ACTIVE', Comparison: 'EQUALS' }] } }, options), (page, remaining) => {
      const values = page.Findings ?? [];
      for (const finding of values.slice(0, remaining)) {
        // Aggregators can return other accounts/regions. Never trust only the filter.
        if (finding.AwsAccountId !== this.config.accountId || finding.Region !== this.config.region || finding.RecordState !== 'ACTIVE' || !finding.Id || !finding.ProductArn) continue;
        this.addFinding(report, this.hubFinding(finding));
      }
      return values.length;
    });
  }

  private hubFinding(finding: AwsSecurityFinding): AwsSecurityReport['findings'][number] {
    const label = finding.Severity?.Label?.toLowerCase();
    const severity = label === 'informational' ? 'info' : ['low', 'medium', 'high', 'critical'].includes(label ?? '') ? label! : 'info';
    return { id: idFor('securityhub', finding.ProductArn!, finding.Id!), source: 'aws.securityhub', severity, title: finding.Title ?? 'Security Hub finding', description: finding.Description ?? 'Imported ASFF security finding; consult source evidence.', evidence: { format: 'ASFF', accountId: finding.AwsAccountId, region: finding.Region, productArn: finding.ProductArn, findingId: finding.Id, original: finding, trust: 'untrusted' }, observedAt: this.timestamp(finding.UpdatedAt ?? finding.CreatedAt) };
  }

  private async guardDuty(report: AwsSecurityReport): Promise<void> {
    const detectors: string[] = [];
    await this.pages(options => paginateListDetectors({ client: this.clients.guardduty, pageSize: 50, stopOnSameToken: true }, {}, options), (page, remaining) => { detectors.push(...(page.DetectorIds ?? []).slice(0, remaining)); return page.DetectorIds?.length ?? 0; });
    if (!detectors.length) throw new CollectionError('NotEnabled', 'No GuardDuty detector exists in this account and region. No detection coverage is available.');
    if (detectors.length > 1) throw new CollectionError('UnexpectedDetectors', 'Multiple detectors returned for one account and region; refusing an ambiguous collection target.');
    const detectorId = detectors[0];
    const detector = await this.call(options => this.clients.guardduty.send(new GetDetectorCommand({ DetectorId: detectorId }), options));
    if (detector.Status !== 'ENABLED') throw new CollectionError('NotEnabled', 'GuardDuty detector is not enabled. Empty results would not establish detection coverage.');
    const ids: string[] = [];
    let truncation: unknown;
    try {
      await this.pages(options => paginateListFindings({ client: this.clients.guardduty, pageSize: 50, stopOnSameToken: true }, { DetectorId: detectorId, FindingCriteria: { Criterion: { accountId: { Eq: [this.config.accountId] }, 'service.archived': { Eq: ['false'] } } } }, options), (page, remaining) => { ids.push(...(page.FindingIds ?? []).slice(0, remaining)); return page.FindingIds?.length ?? 0; });
    } catch (error) { if (!(error instanceof CollectionError) || error.code !== 'Truncated') throw error; truncation = error; }
    for (let offset = 0; offset < ids.length; offset += 50) {
      const page = await this.call(options => this.clients.guardduty.send(new GetFindingsCommand({ DetectorId: detectorId, FindingIds: ids.slice(offset, offset + 50) }), options));
      for (const finding of page.Findings ?? []) {
        if (finding.AccountId !== this.config.accountId || finding.Region !== this.config.region || finding.Service?.Archived !== false || !finding.Id || !ids.slice(offset, offset + 50).includes(finding.Id)) continue;
        this.addFinding(report, this.guardDutyFinding(finding, detectorId));
      }
    }
    if (truncation) throw truncation;
  }

  private guardDutyFinding(finding: Finding, detectorId: string): AwsSecurityReport['findings'][number] {
    const value = finding.Severity;
    const severity = typeof value !== 'number' ? 'info' : value >= 9 ? 'critical' : value >= 7 ? 'high' : value >= 4 ? 'medium' : value >= 1 ? 'low' : 'info';
    return { id: idFor('guardduty', this.target, detectorId, finding.Id!), source: 'aws.guardduty', severity, title: finding.Title ?? 'GuardDuty finding', description: finding.Description ?? 'Imported GuardDuty finding; consult source evidence.', evidence: { accountId: finding.AccountId, region: finding.Region, detectorId, findingId: finding.Id, arn: finding.Arn, original: finding, trust: 'untrusted' }, observedAt: this.timestamp(finding.UpdatedAt ?? finding.CreatedAt) };
  }

  private timestamp(value: string | undefined): number {
    const time = value ? Date.parse(value) : NaN;
    return Number.isFinite(time) && time <= this.now() + 300000 ? time : this.now();
  }

  close(): void {
    this.closed = true;
    for (const controller of this.aborts) controller.abort();
    for (const client of Object.values(this.clients)) client.destroy();
  }
}
