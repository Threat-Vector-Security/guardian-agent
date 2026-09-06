import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { SecurityStore, WorkspaceError, digest, type Principal } from './store.js';
import { authorize, ASSISTANT_SCOPES } from './operations.js';
import { importContextCypher, updateContextDocument, exportContextCypher, type GuardianContextEnvelope } from './contextcypher.js';
import type { SecurityCollectors } from './collectors.js';
import type { AwsSecurityIntegration } from './aws-security.js';
import { SecurityAi, type SecurityAiKind } from './ai.js';
import { buildLocalEnvironmentMap, buildAwsEnvironmentMap } from './environment-mapping.js';
import type { CollectorTelemetry } from './collectors.js';
import type { AwsSecurityReport } from './aws-security.js';

interface Project {
  id: string; name: string; revision: number; createdAt: number; updatedAt: number; envelope: GuardianContextEnvelope; createdBy?: string;
}
export interface SecurityJob {
  id: string; operation: 'host.check' | 'native.scan' | 'aws.check' | 'ai.run'; input: { scanType?: 'quick' | 'full'; kind?: SecurityAiKind; requestId?: string; projectId?: string; revision?: number };
  actorId: string; target: string; state: string; status: string; createdAt: number; updatedAt: number;
  expiresAt: number; approvedBy?: string; reason?: string; result?: unknown; error?: string;
}
interface Finding {
  id: string; source: string; severity: string; title: string; description?: string; evidence?: unknown;
  observedAt: number; status: string; projectId?: string; assetId?: string; reason?: string;
}
const publicProject = (project: Project) => ({ id: project.id, name: project.name, revision: project.revision, createdAt: project.createdAt, updatedAt: project.updatedAt, document: project.envelope.document });
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const MAX_CONNECTOR_BYTES = 32 * 1024 * 1024;
function validateEvidence(value: unknown, depth = 0, state = { values: 0 }): void {
  if (++state.values > 5000 || depth > 16) throw new WorkspaceError(400, 'Finding evidence is too complex');
  if (typeof value === 'string' && Buffer.byteLength(value) > 16 * 1024) throw new WorkspaceError(400, 'Finding evidence string exceeds 16 KiB');
  if (Array.isArray(value)) { if (value.length > 1000) throw new WorkspaceError(400, 'Finding evidence array is too large'); for (const item of value) validateEvidence(item, depth + 1, state); }
  else if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 100) throw new WorkspaceError(400, 'Finding evidence object is too large');
    for (const [key, item] of entries) { if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new WorkspaceError(400, 'Unsafe finding evidence key'); validateEvidence(item, depth + 1, state); }
  }
}

export class SecurityWorkspace {
  readonly ai: SecurityAi;
  readonly device: { id: string; name: string; platform: string };
  private readonly running = new Map<string, Promise<void>>();
  private checkId?: string;
  private awsCheckId?: string;
  private closing = false;
  constructor(readonly store: SecurityStore, readonly collectors: Pick<SecurityCollectors, 'check' | 'requestScan'> & { supportsScan?: boolean }, readonly aws?: Pick<AwsSecurityIntegration, 'target' | 'check' | 'close'>, private readonly config: { entraEnabled?: boolean } = {}) {
    store.acquireServiceOwnership();
    this.ai = new SecurityAi(store);
    const savedDevice = store.get<{ id: string; name: string; platform: string }>('meta', 'device');
    this.device = savedDevice?.name === hostname() && savedDevice.platform === process.platform
      ? savedDevice : { id: randomUUID(), name: hostname(), platform: process.platform };
    store.put('meta', 'device', this.device);
    store.transaction(() => {
      for (const job of store.list<SecurityJob>('job', 10000)) {
        if (job.state !== 'running') continue;
        job.state = job.status = 'interrupted';
        job.updatedAt = Date.now();
        job.error = 'Guardian restarted during execution. Outcome requires verification; this job will not be replayed.';
        store.put('job', job.id, job);
        store.audit('service', 'jobs.interrupted', job.id);
      }
    });
  }
  private project(principal: Principal, id: string): Project {
    if (principal.projectIds && !principal.projectIds.includes(id)) throw new WorkspaceError(403, 'Project is outside this credential scope');
    return this.store.require('project', id);
  }
  private findingVisible(principal: Principal, finding: Finding): boolean {
    return !principal.projectIds || (!!finding.projectId && principal.projectIds.includes(finding.projectId));
  }
  private jobVisible(principal: Principal, job: SecurityJob): boolean {
    if (principal.role === 'admin') return true;
    if (job.actorId !== principal.id) return false;
    if (job.operation === 'ai.run') {
      if (job.input.projectId && !principal.scopes.includes('projects:read')) return false;
      if (principal.projectIds && (!job.input.projectId || !principal.projectIds.includes(job.input.projectId))) return false;
    }
    return true;
  }
  browserAuthentication() {
    const preference = this.store.get<{ requireSignIn: boolean; revision: string }>('meta', 'browser-auth');
    return { requireSignIn: !!preference?.requireSignIn, revision: preference?.revision ?? 'default', enforcedByEntra: !!this.config.entraEnabled, signInRequired: !!preference?.requireSignIn || !!this.config.entraEnabled };
  }
  async execute(principal: Principal, audience: 'admin' | 'assistant', name: string, input: Record<string, unknown>): Promise<unknown> {
    if (this.closing) throw new WorkspaceError(503, 'Guardian is shutting down');
    const current = this.store.client(principal.id);
    if (!current) throw new WorkspaceError(401, 'Credential no longer exists');
    principal = current;
    try { authorize(principal, audience, name, input); }
    catch (error) {
      this.store.audit(principal.id, 'authorization.denied', undefined, { operation: name });
      throw error;
    }
    switch (name) {
      case 'browser-auth.get': return this.browserAuthentication();
      case 'browser-auth.update': {
        if (this.config.entraEnabled && input.requireSignIn === false) throw new WorkspaceError(409, 'Microsoft Entra ID requires browser sign-in');
        this.store.transaction(() => {
          this.store.put('meta', 'browser-auth', { requireSignIn: input.requireSignIn, revision: randomUUID() });
          this.store.audit(principal.id, name, undefined, { requireSignIn: input.requireSignIn });
        });
        return this.browserAuthentication();
      }
      case 'ai.providers.list': return this.ai.list();
      case 'ai.models.list': return this.ai.models();
      case 'ai.models.discover': return this.ai.discover(input as { provider: string; apiKey?: string }, principal.id);
      case 'environments.preview': {
        if (principal.projectIds) throw new WorkspaceError(403, 'Environment mapping requires installation scope');
        if (input.source === 'aws') {
          authorize(principal, audience, 'aws.status.get', {});
          if (!this.aws) throw new WorkspaceError(409, 'Configure and collect the AWS account before mapping it');
          const report = this.store.get<AwsSecurityReport>('aws-status', this.aws.target);
          if (!report) throw new WorkspaceError(409, 'Collect AWS observations before mapping the account');
          const [, accountId, region] = this.aws.target.split(':');
          if (!accountId || !region) throw new WorkspaceError(409, 'AWS enrollment target is invalid');
          try { return buildAwsEnvironmentMap(report, { accountId, region }); }
          catch (error) { throw new WorkspaceError(409, message(error)); }
        }
        const status = this.store.get<{ network: CollectorTelemetry }>('meta', 'status');
        if (!status?.network) throw new WorkspaceError(409, 'Check the local workstation before mapping the network');
        try { return buildLocalEnvironmentMap(status.network, this.device); }
        catch (error) { throw new WorkspaceError(409, message(error)); }
      }
      case 'ai.configure': return this.ai.configure(input as unknown as { provider: string; model: string; apiKey?: string }, principal.id);
      case 'ai.cancel': return this.ai.cancel(principal.id, String(input.requestId));
      case 'ai.test':
      case 'ai.run': {
        const projectId = input.projectId as string | undefined;
        const assertContextAccess = (actor: Principal) => {
          if (!projectId && (actor.projectIds || input.revision)) throw new WorkspaceError(403, 'Select a project within this credential scope');
          if (!projectId) return undefined;
          authorize(actor, audience, 'projects.get', { id: projectId });
          const project = this.project(actor, projectId);
          if (project.revision !== input.revision) throw new WorkspaceError(409, 'Workspace changed. Reload before requesting AI analysis.');
          return project;
        };
        const project = assertContextAccess(principal);
        const requestId = String(input.requestId ?? randomUUID());
        const kind = name === 'ai.test' ? 'chat' : input.kind as SecurityAiKind;
        const job = this.createJob(principal.id, 'ai.run', { kind, requestId, ...(projectId ? { projectId, revision: project!.revision } : {}) }, projectId ?? this.device.id);
        let result: unknown;
        let failure: unknown;
        this.launch(job, async () => {
          try {
            const output = await this.ai.run(principal.id, requestId, kind, name === 'ai.test' ? 'Reply briefly to confirm that security AI is available.' : String(input.prompt), { ...(input.context as Record<string, unknown> ?? {}), ...(project ? { project: project.envelope.document } : {}) });
            const fresh = this.store.client(principal.id);
            if (!fresh) throw new WorkspaceError(401, 'Credential no longer exists');
            authorize(fresh, audience, name, input);
            assertContextAccess(fresh);
            result = { ...output, jobId: job.id, requestId };
            this.finish(job, 'succeeded', result);
          } catch (error) { failure = error; throw error; }
        });
        await this.running.get(job.id);
        if (failure) throw failure;
        return result;
      }
      case 'status.get': {
        if (principal.projectIds) throw new WorkspaceError(403, 'Host status requires installation scope');
        return { ...(this.store.get<Record<string, unknown>>('meta', 'status') ?? { host: null, native: null, network: null, coverage: [] }), device: this.device, checking: !!this.checkId };
      }
      case 'projects.list': return { items: this.store.projectSummaries(principal.projectIds) };
      case 'projects.create':
      case 'projects.import': {
        if (principal.projectIds) throw new WorkspaceError(403, 'A credential restricted to existing projects cannot create projects');
        if (this.store.count('project') >= 200) throw new WorkspaceError(409, 'Local workspace limit reached (200 projects)');
        let envelope: GuardianContextEnvelope;
        try { envelope = importContextCypher(name === 'projects.import' ? String(input.content) : JSON.stringify({ nodes: [], edges: [], systemName: input.name })); }
        catch (error) { throw new WorkspaceError(400, message(error)); }
        const project: Project = { id: randomUUID(), name: String(input.name), revision: 1, createdAt: Date.now(), updatedAt: Date.now(), envelope, createdBy: principal.id };
        this.store.transaction(() => {
          this.store.put('project', project.id, project);
          this.store.audit(principal.id, name, project.id, { originalSha256: envelope.original.sha256, revision: 1 });
        });
        return { project: publicProject(project) };
      }
      case 'projects.get': return { project: publicProject(this.project(principal, String(input.id))) };
      case 'projects.update': return this.store.transaction(() => {
        const project = this.project(principal, String(input.id));
        if (project.revision !== input.revision) throw new WorkspaceError(409, 'Workspace changed. Reload before applying your changes.');
        try { project.envelope = updateContextDocument(project.envelope, input.document); }
        catch (error) { throw new WorkspaceError(400, message(error)); }
        const assetIds = new Set((project.envelope.document.nodes as Array<{ id: string }>).map(node => node.id));
        if (this.store.list<Finding>('finding', 20000).some(finding => finding.projectId === project.id && finding.assetId && !assetIds.has(finding.assetId))) {
          throw new WorkspaceError(409, 'An asset is linked to a finding. Remove its asset link in Findings before deleting the asset.');
        }
        project.revision += 1; project.updatedAt = Date.now();
        this.store.put('project', project.id, project);
        this.store.audit(principal.id, name, project.id, { revision: project.revision, documentSha256: digest(JSON.stringify(project.envelope.document)) });
        return { project: publicProject(project) };
      });
      case 'projects.export': {
        const project = this.project(principal, String(input.id));
        return { document: project.envelope.document, original: exportContextCypher(project.envelope, 'original'), guardian: exportContextCypher(project.envelope), originalSha256: project.envelope.original.sha256 };
      }
      case 'findings.list': return this.store.page<Finding>('finding', Number(input.limit ?? 100), input.cursor === undefined ? undefined : Number(input.cursor), principal.projectIds);
      case 'findings.update': return this.store.transaction(() => {
        const finding = this.store.get<Finding>('finding', String(input.id));
        if (!finding || !this.findingVisible(principal, finding)) throw new WorkspaceError(404, 'finding not found');
        if (input.assetId && !input.projectId) throw new WorkspaceError(400, 'An asset link requires a project');
        if (input.projectId) {
          if (principal.role !== 'admin' && !principal.scopes.includes('projects:read')) throw new WorkspaceError(403, 'Linking a finding requires projects:read');
          const project = this.project(principal, String(input.projectId));
          if (input.assetId && !(project.envelope.document.nodes as Array<{ id: string }>).some(n => n.id === input.assetId)) throw new WorkspaceError(400, 'Asset does not exist in this project');
          finding.projectId = String(input.projectId);
          finding.assetId = input.assetId ? String(input.assetId) : undefined;
        }
        finding.status = String(input.status); finding.reason = String(input.reason);
        this.store.put('finding', finding.id, finding);
        this.store.audit(principal.id, name, finding.id, { status: finding.status, reason: finding.reason, projectId: finding.projectId, assetId: finding.assetId });
        return { finding };
      });
      case 'findings.ingest': {
        if (principal.projectIds) throw new WorkspaceError(403, 'Use an installation-scoped ingestion credential');
        const items = input.items as Array<Record<string, unknown>>;
        if (this.store.count('finding') + items.length > 20000) throw new WorkspaceError(409, 'Finding storage limit reached');
        const prepared: Finding[] = [];
        for (const item of items) {
          if (Number(item.observedAt) > Date.now() + 300000) throw new WorkspaceError(400, 'Observation time is in the future');
          validateEvidence(item.evidence);
          const id = `external:${principal.id}:${digest(String(item.externalId))}`;
          const existing = this.store.get<Finding>('finding', id);
          if (existing && Number(item.observedAt) <= existing.observedAt) continue;
          const finding = { ...existing, ...item, id, source: principal.name, status: 'open', trust: 'untrusted', receivedAt: Date.now() } as Finding;
          if (Buffer.byteLength(JSON.stringify(finding)) > 64 * 1024) throw new WorkspaceError(413, 'Finding record exceeds 64 KiB');
          prepared.push(finding);
        }
        const prefix = `external:${principal.id}:`;
        let projected = this.store.recordBytes('finding', prefix);
        for (const finding of prepared) {
          const existing = this.store.get('finding', finding.id);
          projected += Buffer.byteLength(JSON.stringify(finding)) - (existing === undefined ? 0 : Buffer.byteLength(JSON.stringify(existing)));
        }
        if (projected > MAX_CONNECTOR_BYTES) throw new WorkspaceError(507, 'Connector finding storage quota reached');
        return this.store.transaction(() => {
          for (const finding of prepared) this.store.put('finding', finding.id, finding);
          this.store.audit(principal.id, name, undefined, { received: items.length, accepted: prepared.length });
          return { accepted: prepared.length };
        });
      }
      case 'host.check.start': {
        if (principal.projectIds) throw new WorkspaceError(403, 'Host collection requires installation scope');
        if (this.checkId) {
          const existing = this.store.require<SecurityJob>('job', this.checkId);
          if (!this.jobVisible(principal, existing)) throw new WorkspaceError(409, 'A host check is already running');
          return existing;
        }
        const job = this.createJob(principal.id, 'host.check', {});
        this.checkId = job.id;
        this.launch(job, () => this.collect(job));
        return job;
      }
      case 'native.scan.propose': {
        if (this.collectors.supportsScan === false) throw new WorkspaceError(409, 'This platform does not expose a supported native antivirus scan API.');
        if (principal.projectIds) throw new WorkspaceError(403, 'Native response requires installation scope');
        this.expireApprovals();
        const pending = this.store.list<SecurityJob>('job').filter(j => ['awaiting_approval', 'running'].includes(j.state) && j.operation === 'native.scan' && j.expiresAt > Date.now());
        if (pending.length >= 10) throw new WorkspaceError(429, 'Too many pending native scans');
        return this.createJob(principal.id, 'native.scan', { scanType: input.scanType as 'quick' | 'full' });
      }
      case 'aws.status.get': {
        if (principal.projectIds) throw new WorkspaceError(403, 'AWS status requires installation scope');
        return { configured: !!this.aws, target: this.aws?.target, checking: !!this.awsCheckId, report: this.aws ? this.store.get('aws-status', this.aws.target) ?? null : null };
      }
      case 'aws.check.start': {
        if (principal.projectIds) throw new WorkspaceError(403, 'AWS collection requires installation scope');
        const aws = this.aws;
        if (!aws) throw new WorkspaceError(409, 'Configure the AWS account and region on the service before collecting.');
        if (this.awsCheckId) throw new WorkspaceError(409, 'An AWS check is already running');
        const job = this.createJob(principal.id, 'aws.check', {}, aws.target);
        this.awsCheckId = job.id;
        this.launch(job, async () => {
          const result = await aws.check();
          this.store.transaction(() => {
            this.store.put('aws-status', aws.target, result);
            for (const finding of result.findings) {
              const existing = this.store.get<Finding>('finding', finding.id);
              this.store.put('finding', finding.id, { ...existing, ...finding, status: existing?.status === 'acknowledged' ? 'acknowledged' : 'open' });
            }
            this.store.audit('aws-collector', 'observations.collected', aws.target, { count: result.findings.length, jobId: job.id });
          });
          this.finish(job, result.status === 'unavailable' ? 'failed' : 'succeeded', { status: result.status, coverage: result.coverage, findingCount: result.findings.length, errors: result.errors });
        });
        return job;
      }
      case 'jobs.list': this.expireApprovals(); return { items: this.store.list<SecurityJob>('job').filter(j => this.jobVisible(principal, j)) };
      case 'jobs.approve':
      case 'jobs.reject': {
        this.expireApprovals();
        const job = this.store.transaction(() => {
          const job = this.store.require<SecurityJob>('job', String(input.id));
          if (job.state !== 'awaiting_approval' || job.expiresAt <= Date.now()) throw new WorkspaceError(409, 'Job is no longer pending approval');
          if (job.target !== this.device.id) throw new WorkspaceError(409, 'Target device changed');
          const origin = this.store.client(job.actorId);
          if (!origin || origin.revoked || origin.expiresAt <= Date.now()) throw new WorkspaceError(409, 'Requesting credential has expired or been revoked');
          if (name === 'jobs.approve' && this.store.list<SecurityJob>('job').some(j => j.operation === 'native.scan' && j.state === 'running')) throw new WorkspaceError(409, 'A native scan request is already running');
          job.state = job.status = name === 'jobs.reject' ? 'rejected' : 'running';
          job.approvedBy = principal.id; job.reason = String(input.reason); job.updatedAt = Date.now();
          this.store.put('job', job.id, job);
          this.store.audit(principal.id, name, job.id, { operation: job.operation, input: job.input, target: job.target, reason: job.reason });
          return job;
        });
        if (job.state === 'running') this.launch(job, async () => {
          const result = await this.collectors.requestScan(job.input.scanType!);
          this.finish(job, result.state, result);
        });
        return job;
      }
      case 'clients.list': return { items: this.store.clients() };
      case 'clients.create': {
        const scopes = input.scopes as string[];
        if (scopes.some(scope => !ASSISTANT_SCOPES.includes(scope))) throw new WorkspaceError(400, 'Unknown or administrative scope requested');
        if (this.store.clients().filter(c => !c.revoked).length >= 100) throw new WorkspaceError(409, 'Client limit reached');
        const projectIds = input.projectIds as string[] | undefined;
        if (projectIds) for (const id of projectIds) this.project(principal, id);
        return this.store.createClient({ name: String(input.name), role: 'operator', scopes, ...(projectIds ? { projectIds } : {}), expiresAt: Date.now() + Number(input.expiresInDays ?? 30) * 86400000 }, principal.id);
      }
      case 'clients.revoke': this.store.revoke(String(input.id), principal.id); return {};
      case 'audit.list': return this.store.auditPage(Number(input.limit ?? 100), input.cursor === undefined ? undefined : Number(input.cursor));
      case 'integrations.list': return { items: [
        { id: 'host', name: 'Local workstation and network', status: 'available', capabilities: ['posture', 'connections', 'neighbors'], description: 'Read-only periodic observation. No packet inspection or kernel containment.' },
        { id: 'defender', name: 'Microsoft Defender', status: process.platform === 'win32' ? 'installed_platform' : 'unsupported', capabilities: ['status', 'scan_request'], description: 'Native status and separately approved scan requests. A requested scan is not a clean scan result.' },
        { id: 'security-events', name: 'Security event ingestion', status: 'available', capabilities: ['findings.ingest'], description: 'Scoped connector credentials accept normalized findings. Vendor source identity is bound to the credential.' },
        { id: 'contextcypher', name: 'ContextCypher', status: 'available', capabilities: ['import', 'export', 'diagram', 'risk_context'], description: 'Full JSON workspace preservation with original-file integrity and revision checks.' },
        { id: 'mcp', name: 'External assistants', status: 'available', capabilities: ['stdio', 'scoped_operations'], description: 'MCP and CLI share the authenticated operation service. Administrative tools are excluded from MCP.' },
        { id: 'entra', name: 'Microsoft Entra ID', status: this.config.entraEnabled ? 'configured' : 'not_configured', capabilities: ['oidc', 'pkce', 'group_roles'], description: 'Optional tenant-bound SSO with explicit administrator/operator/viewer groups. Configure on the local service and verify in your tenant.' },
        { id: 'macos', name: 'macOS security posture', status: process.platform === 'darwin' ? 'supported_platform' : 'unsupported', capabilities: ['gatekeeper', 'filevault', 'application_firewall', 'passive_network'], description: 'Read-only native posture and passive visibility. No XProtect scan or protection-disablement API is exposed.' },
        { id: 'aws', name: 'AWS security', status: this.aws ? 'configured' : 'not_configured', capabilities: ['account_identity', 'resource_posture', 'securityhub', 'guardduty'], description: this.aws ? `Read-only collection for ${this.aws.target}. Coverage and permission failures remain explicit.` : 'Set GUARDIAN_AWS_ACCOUNT_ID and GUARDIAN_AWS_REGION; use a dedicated AWS profile or workload role. No AWS calls run until explicitly requested.' },
      ] };
      default: throw new WorkspaceError(404, 'Unknown operation');
    }
  }
  private createJob(actorId: string, operation: SecurityJob['operation'], input: SecurityJob['input'], target = this.device.id): SecurityJob {
    const now = Date.now(); const state = operation === 'native.scan' ? 'awaiting_approval' : 'running';
    const job: SecurityJob = { id: randomUUID(), operation, input, actorId, target, state, status: state, createdAt: now, updatedAt: now, expiresAt: now + 15 * 60000 };
    this.store.transaction(() => { this.store.put('job', job.id, job); this.store.audit(actorId, 'jobs.create', job.id, { operation, input, target: job.target }); });
    return job;
  }
  private launch(job: SecurityJob, action: () => Promise<void>): void {
    const promise = Promise.resolve().then(action).catch(error => this.finish(job, 'failed', undefined, message(error))).finally(() => {
      this.running.delete(job.id);
      if (this.checkId === job.id) this.checkId = undefined;
      if (this.awsCheckId === job.id) this.awsCheckId = undefined;
    });
    this.running.set(job.id, promise);
  }
  private async collect(job: SecurityJob): Promise<void> {
    const result = await this.collectors.check();
    this.store.transaction(() => {
      this.store.put('meta', 'status', { ...result, findings: undefined, collectedAt: Date.now() });
      for (const observed of result.findings) {
        const existing = this.store.get<Finding>('finding', observed.id);
        this.store.put('finding', observed.id, { ...existing, ...observed, status: existing?.status === 'acknowledged' ? 'acknowledged' : 'open' });
      }
      this.store.audit('collector', 'observations.collected', this.device.id, { count: result.findings.length, jobId: job.id });
    });
    this.finish(job, 'succeeded', { findingCount: result.findings.length, coverage: result.coverage, message: 'Observation collection finished; consult individual collector coverage and errors.' });
  }
  private finish(job: SecurityJob, state: string, result?: unknown, error?: string): void {
    job.state = job.status = state; job.result = result; job.error = error; job.updatedAt = Date.now();
    this.store.transaction(() => { this.store.put('job', job.id, job); this.store.audit('service', `jobs.${state}`, job.id, { error }); this.store.pruneTerminalJobs(); });
  }
  private expireApprovals(): void {
    const expired = this.store.expiredApprovalJobs<SecurityJob>();
    if (!expired.length) return;
    this.store.transaction(() => {
      for (const job of expired) {
        job.state = job.status = 'expired'; job.updatedAt = Date.now();
        this.store.put('job', job.id, job);
        this.store.audit('service', 'jobs.expired', job.id, { operation: job.operation, target: job.target });
      }
      this.store.pruneTerminalJobs();
    });
  }
  async idle(): Promise<void> { await Promise.all([...this.running.values()]); }
  poll(): void {
    if (this.closing || this.checkId) return;
    const job = this.createJob('service', 'host.check', {});
    this.checkId = job.id;
    this.launch(job, () => this.collect(job));
  }
  async close(): Promise<void> { this.closing = true; this.ai.close(); this.aws?.close(); await this.idle(); }
}
