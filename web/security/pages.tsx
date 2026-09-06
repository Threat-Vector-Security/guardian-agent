import { useEffect, useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, Clock3, Copy, FileWarning, Monitor, Network, Plus, Search, Shield, X } from 'lucide-react';
import { asList, asRecord, canPerform, dateLabel, label, operation, request, useOperation, type Principal, type RecordData } from './api';
import { Empty, ErrorNotice, Evidence, Facts, PageTitle, Refresh, Status } from './components';

type Items = { items: RecordData[]; nextCursor?: number; hasMore?: boolean; total?: number };
const emptyItems: Items = { items: [] };
const message = (cause: unknown) => cause instanceof Error ? cause.message : 'The operation failed.';

export function ProtectionPage({ principal, go }: { principal: Principal; go: (page: 'activity' | 'findings') => void }) {
  const status = useOperation<RecordData>('status.get', {});
  const findings = useOperation<Items>('findings.list', emptyItems);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [scanType, setScanType] = useState('quick');
  const host = asRecord(status.data.host);
  const native = asRecord(status.data.native);
  const nativeData = asRecord(native.data);
  const defender = asRecord(nativeData.defender);
  const hostData = asRecord(host.data);
  const device = asRecord(status.data.device);
  const scanSupported = device.platform === 'win32' && nativeData.scanSupported === true;
  const macComponents = asList(nativeData.components);
  const coverage = asList(status.data.coverage);
  const network = asRecord(status.data.network);
  const run = async (name: string, input: RecordData = {}) => {
    if (name === 'native.scan.propose' && !scanSupported) return;
    if (principal.projectIds || !canPerform(principal, name === 'host.check.start' ? 'security:collect' : 'response:propose', true)) return;
    setBusy(name); setError(''); setNotice('');
    try {
      const result = await operation(name, input);
      const job = asRecord(result.job || result);
      setNotice(`Request ${label(job.id, 'recorded')}: ${label(job.status, 'submitted')}. Review its evidence and any required approval in Activity.`);
      await status.refresh(); await findings.refresh();
    } catch (cause) { setError(message(cause)); } finally { setBusy(''); }
  };
  return <><PageTitle title="Protection" description="Understand what is monitored. Review changes before they run."><Refresh loading={status.loading} onClick={() => { void status.refresh(); void findings.refresh(); }} /></PageTitle>
    <ErrorNotice message={status.error || error} />{notice && <div className="notice" role="status">{notice}<button className="text-button" onClick={() => go('activity')}>Open activity</button></div>}
    <div className="workbench"><section className="primary-pane">
      <div className="actions action-strip"><button disabled={!!busy || !canPerform(principal, 'security:collect', true) || !!principal.projectIds} onClick={() => void run('host.check.start')}><Monitor size={16} />{busy === 'host.check.start' ? 'Checking…' : 'Check workstation'}</button><div className="joined"><select disabled={!scanSupported || !!busy} aria-label="Antivirus scan type" value={scanType} onChange={event => setScanType(event.target.value)}><option value="quick">Quick scan</option><option value="full">Full scan</option></select><button disabled={!scanSupported || !!busy || !canPerform(principal, 'response:propose', true) || !!principal.projectIds} onClick={() => void run('native.scan.propose', { scanType })}><Shield size={16} />Request antivirus scan</button></div></div>
      {!scanSupported && <p className="muted">Antivirus scan requests require a supported Microsoft Defender connector on Windows. No scan capability is reported for this device.</p>}
      <section className="panel coverage"><h2>Protection coverage</h2><p className="muted">Coverage reflects reported capabilities, not a security guarantee.</p>
        {status.loading && <p role="status">Loading current observations…</p>}
        <div className="coverage-row"><Monitor size={21} /><div><strong>Workstation</strong><span>{hostData.baselineReady === true ? 'Observed baseline · partial coverage' : label(host.description, 'No observation yet')}</span><span>Collected: {dateLabel(host.collectedAt)}</span></div><Status value={host.status || 'Not checked'} /></div>
        <div className="coverage-row"><Network size={21} /><div><strong>Local network</strong><span>{label(network.description, 'No network observation yet')}</span><span>Collected: {dateLabel(network.collectedAt)}</span></div><Status value={network.status || 'Not checked'} /></div>
        <div className="coverage-row"><Shield size={21} /><div><strong>{nativeData.provider === 'macos_security' ? 'macOS security settings' : 'Antivirus'}</strong><span>{label(nativeData.provider, Object.keys(defender).length ? 'Microsoft Defender' : 'No provider reported')}</span>{defender.summary != null && <span>{label(defender.summary)}</span>}<span>Collected: {dateLabel(native.collectedAt)}</span></div><Status value={native.status || 'Not checked'} /></div>
        {macComponents.map(component => <div className="coverage-row" key={label(component.id)}><Shield size={21} /><div><strong>{label(component.name)}</strong><span>{component.enabled === true ? 'Enabled' : component.enabled === false ? 'Disabled' : 'Setting unknown'}</span><span>{label(component.scope)}</span><span>Collected: {dateLabel(component.collectedAt)}</span>{component.error != null && <span>{label(component.error)}</span>}</div><Status value={component.status} /></div>)}
        {nativeData.provider === 'macos_security' && <p className="muted">These observations report settings only. XProtect health, detections and scan completion are not collected.</p>}
        {asList(nativeData.antivirusProducts).length > 0 && <p className="muted">Registered antivirus: {asList(nativeData.antivirusProducts).map(item => label(item.displayName)).join(', ')}. Registration does not establish protection health.</p>}
        {coverage.length > 0 && <div className="coverage-capabilities">{coverage.map(item => <div key={label(item.id)}><div className="section-heading"><strong>{label(item.name || item.id)}</strong><Status value={item.status} /></div><p>{label(item.description, 'No coverage description supplied.')}</p></div>)}</div>}
        <Evidence value={status.data} title="Coverage and observation details" />
      </section>
      <section className="section"><div className="section-heading"><h2>Recent findings</h2><button className="quiet" onClick={() => go('findings')}>View all<ArrowUpRight size={14} /></button></div><ErrorNotice message={findings.error} />
        {findings.loading ? <p role="status">Loading findings…</p> : findings.data.items.length ? <div className="rows">{findings.data.items.slice(0, 5).map(item => <button className="record-row" key={label(item.id)} onClick={() => go('findings')}><FileWarning size={18} /><span><strong>{label(item.title || item.summary)}</strong><small>{label(item.source)} · {dateLabel(item.observedAt || item.updatedAt || item.createdAt)}</small></span><Status value={item.severity} /></button>)}</div> : <Empty title="No findings recorded">Run a workstation check to collect current evidence. An empty queue does not establish that the workstation is safe.</Empty>}
      </section>
    </section><aside className="inspector"><h2>Approval boundary</h2><p>External assistants request actions through scoped tools.</p><p>Administrators review sensitive actions before execution.</p><button onClick={() => go('activity')}><ArrowUpRight size={15} />Open activity</button><hr /><h3>This device</h3><Facts value={device} /><hr /><h3>Observation limits</h3><p>Host snapshots and connection metadata provide evidence. Antivirus and endpoint tools retain their own protection responsibilities.</p></aside></div>
  </>;
}

export function FindingsPage({ principal }: { principal: Principal }) {
  const findings = useOperation<Items>('findings.list', emptyItems);
  const projects = useOperation<Items>('projects.list', emptyItems, {}, canPerform(principal, 'projects:read'));
  const [filter, setFilter] = useState('');
  const [state, setState] = useState('all');
  const [selected, setSelected] = useState('');
  const [targetState, setTargetState] = useState('acknowledged');
  const [reason, setReason] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [loadingOlder, setLoadingOlder] = useState(false);
  const items = findings.data.items.filter(item => (state === 'all' || item.status === state) && `${label(item.title, '')} ${label(item.description, '')} ${label(item.source, '')}`.toLowerCase().includes(filter.toLowerCase()));
  const finding = findings.data.items.find(item => item.id === selected);

  const loadOlder = async () => {

    if (!findings.data.hasMore || !findings.data.nextCursor) return;

    setLoadingOlder(true); setError('');

    try { const next = await operation<Items>('findings.list', { cursor: findings.data.nextCursor }); findings.setData({ ...next, items: [...findings.data.items, ...next.items] }); }

    catch (cause) { setError(message(cause)); } finally { setLoadingOlder(false); }

  };
  const update = async (event: FormEvent) => {
    event.preventDefault(); if (!finding || !canPerform(principal, 'findings:write', true)) return; setBusy(true); setError('');
    try { await operation('findings.update', { id: finding.id, status: targetState, reason, ...(projectId ? { projectId } : {}), ...(assetId ? { assetId } : {}) }); setReason(''); await findings.refresh(); }
    catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  };
  return <><PageTitle title="Findings" description="Investigate evidence, record decisions, and connect findings to your systems."><Refresh loading={findings.loading} onClick={() => void findings.refresh()} /></PageTitle><ErrorNotice message={findings.error || error} />
    <div className="filters"><label className="search"><Search size={16} /><input aria-label="Search findings" placeholder="Search findings" value={filter} onChange={event => setFilter(event.target.value)} /></label><select aria-label="Finding status" value={state} onChange={event => setState(event.target.value)}><option value="all">All statuses</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option></select><span className="muted">{items.length}{findings.data.total != null ? ` of ${findings.data.total}` : ''} findings</span></div>
    <div className="split-view"><section className="list-pane">{findings.loading ? <p role="status">Loading findings…</p> : items.length ? <><div className="rows">{items.map(item => <button className={`record-row ${selected === item.id ? 'selected' : ''}`} key={label(item.id)} onClick={() => { setSelected(label(item.id)); setProjectId(label(item.projectId, '')); setAssetId(label(item.assetId, '')); setReason(''); }}><FileWarning size={18} /><span><strong>{label(item.title || item.summary)}</strong><small>{label(item.source)} · {label(item.status)}</small></span><Status value={item.severity} /></button>)}</div>{findings.data.hasMore && <button disabled={loadingOlder} onClick={() => void loadOlder()}>{loadingOlder ? 'Loading…' : 'Load older findings'}</button>}</> : <Empty title="No matching findings">Current observations and your filters determine what appears here.</Empty>}</section>
      <aside className="inspector finding-inspector">{finding ? <><div className="section-heading"><Status value={finding.severity} /><button className="icon-button" onClick={() => setSelected('')} aria-label="Close finding"><X size={16} /></button></div><h2>{label(finding.title || finding.summary)}</h2><p>{label(finding.description || finding.message, 'No description supplied.')}</p><Facts value={{ status: finding.status, source: finding.source, observed: dateLabel(finding.observedAt || finding.updatedAt || finding.createdAt), id: finding.id }} /><Evidence value={finding.evidence || finding} />
        <form className="stack" onSubmit={update}><h3>Record a decision</h3><label>Status<select value={targetState} onChange={event => setTargetState(event.target.value)}><option value="acknowledged">Acknowledge</option><option value="resolved">Resolve</option><option value="open">Reopen</option></select></label><label>System link<select disabled={!canPerform(principal, 'projects:read')} value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">No new system link</option>{projects.data.items.map(project => <option key={label(project.id)} value={label(project.id)}>{label(project.name)}</option>)}</select></label><label>Asset ID (optional)<input value={assetId} onChange={event => setAssetId(event.target.value)} placeholder="ID from the systems canvas" /></label><label>Reason<textarea value={reason} onChange={event => setReason(event.target.value)} required rows={3} /></label><button className="primary" disabled={busy || !canPerform(principal, 'findings:write', true) || !reason.trim()}><Check size={15} />{busy ? 'Saving…' : 'Save decision'}</button><small className="muted">Resolving a finding records your assessment; it does not disable a detector or change device protection.</small></form></> : <Empty title="Select a finding">Review the source evidence before recording a decision.</Empty>}</aside>
    </div></>;
}

export function ActivityPage({ principal }: { principal: Principal }) {
  const jobs = useOperation<Items>('jobs.list', emptyItems);
  const audit = useOperation<Items>('audit.list', emptyItems, {}, principal.role === 'admin');
  const [tab, setTab] = useState('jobs');
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [loadingOlder, setLoadingOlder] = useState(false);
  const job = jobs.data.items.find(item => item.id === selected);
  const pending = job && ['pending_approval', 'awaiting_approval', 'pending'].includes(label(job.status || job.state));

  const loadOlderAudit = async () => {

    if (!audit.data.hasMore || !audit.data.nextCursor) return;

    setLoadingOlder(true); setError('');

    try { const next = await operation<Items>('audit.list', { cursor: audit.data.nextCursor }); audit.setData({ ...next, items: [...audit.data.items, ...next.items] }); }

    catch (cause) { setError(message(cause)); } finally { setLoadingOlder(false); }

  };
  const decision = async (approve: boolean) => {
    if (!job || !reason.trim() || principal.role !== 'admin') return; setBusy(true); setError('');
    try { await operation(approve ? 'jobs.approve' : 'jobs.reject', { id: job.id, reason }); setReason(''); await jobs.refresh(); await audit.refresh(); }
    catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  };
  return <><PageTitle title="Activity" description="Review requests, approve scoped actions, and inspect the audit trail."><Refresh loading={jobs.loading || audit.loading} onClick={() => { void jobs.refresh(); void audit.refresh(); }} /></PageTitle><ErrorNotice message={error || jobs.error || audit.error} /><div className="tabs" role="tablist" aria-label="Activity views"><button role="tab" aria-selected={tab === 'jobs'} onClick={() => setTab('jobs')}>Requests & approvals<span>{jobs.data.items.length}</span></button>{principal.role === 'admin' && <button role="tab" aria-selected={tab === 'audit'} onClick={() => setTab('audit')}>Audit trail</button>}</div>
    {tab === 'jobs' || principal.role !== 'admin' ? <div className="split-view"><section className="list-pane">{jobs.loading ? <p role="status">Loading requests…</p> : jobs.data.items.length ? <div className="rows">{jobs.data.items.map(item => <button className={`record-row ${selected === item.id ? 'selected' : ''}`} key={label(item.id)} onClick={() => { setSelected(label(item.id)); setReason(''); }}><Clock3 size={18} /><span><strong>{label(item.title || item.operation || item.type, 'Security request')}</strong><small>{dateLabel(item.createdAt)} · {label(item.actorId || item.requestedBy || item.principalId, 'Actor not reported')}</small></span><Status value={item.status || item.state} /></button>)}</div> : <Empty title="No security requests">Checks and scan requests appear here with their execution state.</Empty>}</section><aside className="inspector">{job ? <><Status value={job.status || job.state} /><h2>{label(job.title || job.operation || job.type, 'Security request')}</h2><p>{label(job.description || job.reason, 'Inspect the exact request before making a decision.')}</p><Facts value={{ targetDevice: job.target, requestedBy: job.actorId || job.requestedBy || job.principalId, requestId: job.id, created: dateLabel(job.createdAt), expires: job.expiresAt ? dateLabel(job.expiresAt) : undefined, approvedBy: job.approvedBy }} /><Evidence value={{ operation: job.operation, target: job.target, input: job.input || job.parameters, actorId: job.actorId, expiresAt: job.expiresAt }} title="Exact request" />{job.result != null && <Evidence value={job.result} title="Execution result" />}{job.error != null && <Evidence value={job.error} title="Execution error" />}
        {pending && <div className="stack"><h3>Administrator review</h3><p>An approval authorizes this recorded request only.</p><label>Decision reason<textarea value={reason} onChange={event => setReason(event.target.value)} rows={3} required /></label><div className="actions"><button className="primary" disabled={busy || principal.role !== 'admin' || !reason.trim()} onClick={() => void decision(true)}><Check size={15} />Approve</button><button disabled={busy || principal.role !== 'admin' || !reason.trim()} onClick={() => void decision(false)}><X size={15} />Reject</button></div>{principal.role !== 'admin' && <p className="muted">An administrator must review this request.</p>}</div>}</> : <Empty title="Select a request">Review the target, inputs, and resulting evidence.</Empty>}</aside></div> : <section className="audit-table">{audit.loading ? <p role="status">Loading audit records…</p> : audit.data.items.length ? <>{audit.data.items.map((item, index) => <article className="audit-entry" key={label(item.id, String(index))}><Clock3 size={17} /><div><div className="section-heading"><strong>{label(item.operation || item.action || item.type || item.event, 'Audit event')}</strong><time>{dateLabel(item.at || item.timestamp || item.createdAt)}</time></div><p>{label(item.principalId || item.actor, 'Actor not reported')} · {label(item.outcome || item.status, 'Outcome not reported')}</p><Evidence value={item} title="Event details" /></div></article>)}{audit.data.hasMore && <button disabled={loadingOlder} onClick={() => void loadOlderAudit()}>{loadingOlder ? 'Loading…' : 'Load older audit records'}</button>}</> : <Empty title="No audit records">Recorded operations and decisions will appear here.</Empty>}</section>}
  </>;
}

export function IntegrationsPage({ principal }: { principal: Principal }) {
  const integrations = useOperation<Items>('integrations.list', emptyItems);
  const readAws = !principal.projectIds && canPerform(principal, 'cloud:read');
  const collectAws = !principal.projectIds && canPerform(principal, 'cloud:collect', true);
  const aws = useOperation<RecordData>('aws.status.get', {}, {}, readAws);
  const [entra, setEntra] = useState<boolean | null>(null);
  const [providerError, setProviderError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const refreshProviders = async () => {
    setProviderError('');
    try { const value = await request<{ entra: boolean }>('/api/v1/auth/providers'); setEntra(value.entra === true); }
    catch (cause) { setEntra(null); setProviderError(message(cause)); }
  };
  useEffect(() => { void refreshProviders(); }, []);
  const checkAws = async () => {
    if (!collectAws || !readAws || aws.data.configured !== true || aws.data.checking === true || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const job = await operation('aws.check.start');
      setNotice(`AWS request ${label(job.id)}: ${label(job.state || job.status, 'submitted')}. Review execution in Activity, then refresh this page for collected evidence.`);
      await aws.refresh();
    } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  };
  const report = asRecord(aws.data.report);
  return <><PageTitle title="Integrations" description="Understand the capabilities and limits of each connected security tool."><Refresh loading={integrations.loading || aws.loading} onClick={() => { void integrations.refresh(); void aws.refresh(); void refreshProviders(); }} /></PageTitle><ErrorNotice message={integrations.error || aws.error || providerError || error} />
    {notice && <div className="notice" role="status">{notice}</div>}
    <section className="panel stack"><div className="section-heading"><h2>AWS security</h2><Status value={!readAws ? 'Access restricted' : aws.loading ? 'Loading' : aws.error ? 'Unknown' : aws.data.configured !== true ? 'Not configured' : aws.data.checking === true ? 'Checking' : report.status || 'Not checked'} /></div>
      <p>Collect security evidence from your configured private AWS account and region. Opening this page reads saved local status; only Check AWS starts collection.</p>
      {readAws ? <><Facts value={{ target: aws.data.target, collected: report.collectedAt ? dateLabel(report.collectedAt) : 'Not recorded' }} /><button disabled={busy || aws.loading || !collectAws || aws.data.configured !== true || aws.data.checking === true} onClick={() => void checkAws()}>{busy || aws.data.checking === true ? 'Checking AWS...' : 'Check AWS'}</button>{aws.data.configured !== true && !aws.loading && !aws.error && <p className="muted">Configure the AWS account, region and credentials on the Guardian service before collecting.</p>}{asList(report.coverage).map(item => <div key={label(item.id)}><div className="section-heading"><strong>{label(item.name || item.id)}</strong><Status value={item.status} /></div><p>{label(item.description)}</p></div>)}{Array.isArray(report.errors) && report.errors.length > 0 && <div className="notice warning"><ul>{report.errors.map((item, index) => <li key={index}>{label(item)}</li>)}</ul></div>}{Object.keys(report).length > 0 && <Evidence value={report} title="AWS collection evidence and coverage" />}</> : <p className="muted">AWS evidence requires installation scope and cloud:read. Collection additionally requires cloud:collect and an operator or administrator session.</p>}
    </section>
    <section className="panel stack"><div className="section-heading"><h2>Microsoft Entra ID</h2><Status value={entra === null ? 'Unknown' : entra ? 'Configured' : 'Not configured'} /></div><p>{entra === true ? 'Enterprise sign-in is enabled by this Guardian service. Account access remains subject to its tenant and role configuration.' : entra === false ? 'Enterprise sign-in is not enabled on this Guardian service.' : 'Identity provider availability has not been confirmed.'}</p></section>
    <div className="integration-list">{integrations.loading ? <p role="status">Loading integrations...</p> : integrations.data.items.length ? integrations.data.items.filter(item => item.id !== 'entra' && item.id !== 'aws').map((item, index) => <article className="integration" key={label(item.id, String(index))}><div className="integration-icon"><Shield size={23} strokeWidth={1.4} /></div><div><div className="section-heading"><h2>{label(item.name || item.id)}</h2><Status value={item.status || (item.available === true ? 'available' : item.available === false ? 'unavailable' : 'Not configured')} /></div><p>{label(item.description, 'This connector has not supplied a description.')}</p><div className="capability-list">{Array.isArray(item.capabilities) ? item.capabilities.map((capability, position) => <span key={position}>{label(capability, JSON.stringify(capability))}</span>) : null}</div>{item.reason != null && <p className="muted">{label(item.reason)}</p>}<Evidence value={item} title="Connector details" /></div></article>) : <Empty title="No integrations reported">Available connectors are reported by the Guardian service.</Empty>}</div>
    <div className="notice"><Shield size={17} /><span>Installed antivirus tools remain responsible for their own real-time protection. Guardian only offers actions declared by each connector.</span></div></>;
}

function BrowserAccessSettings({ principal }: { principal: Principal }) {
  const preference = useOperation<{ requireSignIn: boolean; enforcedByEntra: boolean; signInRequired: boolean }>('browser-auth.get', { requireSignIn: false, enforcedByEntra: false, signInRequired: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = async (requireSignIn: boolean) => {
    setSaving(true); setError('');
    try {
      const result = await operation<typeof preference.data>('browser-auth.update', { requireSignIn });
      preference.setData(result);
      if (principal.id === 'local-browser') window.dispatchEvent(new Event('guardian-session-expired'));
    } catch (cause) { setError(message(cause)); }
    finally { setSaving(false); }
  };
  return <section className="panel stack"><h2>Browser access</h2><ErrorNotice message={error || preference.error} /><label className="checkbox"><input type="checkbox" checked={preference.data.signInRequired} disabled={saving || preference.loading || !!preference.error || preference.data.enforcedByEntra} onChange={event => void update(event.target.checked)} />Require an access token to open Guardian</label><p className="muted">Off by default: browsers on this workstation can open the local workspace directly. Assistant applications always need their own scoped token.</p>{preference.data.enforcedByEntra ? <p>Microsoft Entra ID requires sign-in for this installation.</p> : <p>Turning this on ends direct local-browser sessions. Use the administrator token in your Guardian data directory's <code>admin-token.txt</code> file to sign in.</p>}{saving && <p role="status">Saving browser access preference…</p>}</section>;
}

export function SettingsPage({ principal }: { principal: Principal }) {
  const isAdmin = principal.role === 'admin';
  const clients = useOperation<Items>('clients.list', emptyItems, {}, isAdmin);
  const projects = useOperation<Items>('projects.list', emptyItems, {}, isAdmin);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['security:read', 'projects:read']);
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [restrictProjects, setRestrictProjects] = useState(false);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revokeId, setRevokeId] = useState('');
  const availableScopes = ['security:read', 'projects:read', 'projects:write', 'findings:write', 'findings:ingest', 'security:collect', 'response:propose', 'cloud:read', 'cloud:collect'];
  const installationScopes = ['findings:ingest', 'security:collect', 'response:propose', 'cloud:read', 'cloud:collect'];
  const assistantClients = clients.data.items.filter(client => client.role !== 'admin' && !label(client.id, '').startsWith('entra:'));
  const expirationDays = Number(expiresInDays);
  const validExpiry = Number.isInteger(expirationDays) && expirationDays >= 1 && expirationDays <= 90;
  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAdmin || !validExpiry || !scopes.length || (restrictProjects && !projectIds.length)) return;
    setBusy(true); setError(''); setToken(''); setCopied(false);
    try { const result = await operation<{ client: RecordData; token: string }>('clients.create', { name, scopes, expiresInDays: expirationDays, ...(restrictProjects ? { projectIds } : {}) }); setToken(result.token); setName(''); await clients.refresh(); }
    catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  };
  const revoke = async () => {
    const selected = assistantClients.find(client => client.id === revokeId);
    if (!isAdmin || !selected || selected.revoked === true) return;
    setBusy(true); setError('');
    try { await operation('clients.revoke', { id: revokeId }); setRevokeId(''); await clients.refresh(); }
    catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  };
  return <><PageTitle title="Settings" description="Manage browser access, assistant tokens and your authenticated authority.">{isAdmin && <Refresh loading={clients.loading} onClick={() => void clients.refresh()} />}</PageTitle><ErrorNotice message={error || clients.error} />{isAdmin && <BrowserAccessSettings principal={principal} />}
    <div className="workbench"><section className="primary-pane"><section className="section"><h2>Connected assistants</h2><p>Give each assistant its own revocable token with only the capabilities it needs.</p>{!isAdmin ? <div className="notice">Assistant enrollment and credential inventory require an administrator session.</div> : clients.loading ? <p role="status">Loading clients…</p> : assistantClients.length ? <div className="rows">{assistantClients.map(client => {
      const revoked = client.revoked === true;
      const expired = typeof client.expiresAt === 'number' && client.expiresAt <= Date.now();
      return <div className="record-row" key={label(client.id)}><Monitor size={18} /><span><strong>{label(client.name || client.id)}</strong><small>{Array.isArray(client.scopes) ? client.scopes.map(value => label(value)).join(', ') : 'No scopes reported'}</small><small>Expires {dateLabel(client.expiresAt)} · {Array.isArray(client.projectIds) ? `${client.projectIds.length} selected systems` : 'Installation scope'}</small></span><Status value={revoked ? 'revoked' : expired ? 'expired' : 'enrolled'} />{!revoked && !expired && <button disabled={busy} onClick={() => setRevokeId(label(client.id))}>Revoke</button>}</div>;
    })}</div> : <Empty title="No assistants enrolled">Enroll a client to enable scoped automation.</Empty>}
      {revokeId && isAdmin && <div className="notice warning"><span>Revoke access for {label(assistantClients.find(client => client.id === revokeId)?.name, revokeId)}? Its token will stop authorizing new requests.</span><div className="actions"><button disabled={busy} onClick={() => void revoke()}>Revoke access</button><button disabled={busy} onClick={() => setRevokeId('')}>Cancel</button></div></div>}</section>
      {isAdmin && <form className="panel stack enrollment" onSubmit={create}><h2>Enroll an assistant</h2><label>Client name<input value={name} maxLength={120} onChange={event => setName(event.target.value)} required placeholder="e.g. Codex on this workstation" /></label><label>Token lifetime (days)<input type="number" min={1} max={90} step={1} required value={expiresInDays} onChange={event => setExpiresInDays(event.target.value)} /></label><small className="muted">Choose 1–90 days. Expired tokens must be replaced through enrollment.</small><label>System access<select value={restrictProjects ? 'selected' : 'installation'} onChange={event => { const restricted = event.target.value === 'selected'; setRestrictProjects(restricted); if (restricted) setScopes(previous => previous.filter(scope => !installationScopes.includes(scope))); }}><option value="installation">Installation scope</option><option value="selected">Selected existing systems</option></select></label>
        {restrictProjects && <fieldset><legend>Accessible systems</legend><ErrorNotice message={projects.error} />{projects.loading ? <p role="status">Loading systems…</p> : projects.data.items.length ? <div className="scope-grid">{projects.data.items.map(project => <label className="checkbox" key={label(project.id)}><input type="checkbox" checked={projectIds.includes(label(project.id))} disabled={!projectIds.includes(label(project.id)) && projectIds.length >= 100} onChange={event => setProjectIds(previous => event.target.checked ? [...previous, label(project.id)] : previous.filter(id => id !== project.id))} />{label(project.name)}</label>)}</div> : <p>Create a system before restricting a credential to it.</p>}<p className="muted">Choose at least one system. Restricted credentials cannot collect workstation data, request scans, ingest findings, access AWS evidence, or create new systems.</p></fieldset>}
        <fieldset><legend>Allowed capabilities</legend><div className="scope-grid">{availableScopes.map(scope => <label className="checkbox" key={scope}><input type="checkbox" checked={scopes.includes(scope)} disabled={restrictProjects && installationScopes.includes(scope)} onChange={event => setScopes(previous => event.target.checked ? [...previous, scope] : previous.filter(value => value !== scope))} />{scope}</label>)}</div></fieldset><button className="primary" disabled={busy || !name.trim() || !scopes.length || !validExpiry || (restrictProjects && !projectIds.length)}><Plus size={15} />{busy ? 'Enrolling…' : 'Create access token'}</button></form>}
      {isAdmin && token && <section className="panel token-panel" role="status"><h2>Save this token now</h2><p>It is shown once. Treat it as a credential and store it in your assistant’s credential manager.</p><code className="issued-token">{token}</code><div className="actions"><button onClick={async () => { try { await navigator.clipboard.writeText(token); setCopied(true); } catch { setError('Clipboard access is unavailable. Select and copy the token manually.'); } }}><Copy size={15} />{copied ? 'Copied' : 'Copy token'}</button><button onClick={() => { setToken(''); setCopied(false); }}>Dismiss token</button></div></section>}
    </section><aside className="inspector"><h2>Your session</h2><Facts value={{ identity: principal.id, role: principal.role }} /><h3>Session scopes</h3><ul className="scope-list">{principal.scopes.map(scope => <li key={scope}><code>{scope}</code></li>)}</ul><hr /><h3>Administrative boundary</h3><p>Assistant enrollment and approval require an administrator session. Scoped assistant tokens cannot grant themselves more authority.</p><h3>Enterprise identity</h3><p>SSO availability is determined by the service configuration. No identity provider is enabled from this screen.</p></aside></div>
  </>;
}
