import { useState } from 'react';
import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react';
import { Cloud, Network, Play, Save } from 'lucide-react';
import { asList, asRecord, canPerform, dateLabel, label, operation, useOperation, type Principal, type Project, type RecordData } from './api';
import { Empty, ErrorNotice, Evidence, PageTitle, Refresh, Status } from './components';
import '@xyflow/react/dist/style.css';

type Preview = { source: 'local' | 'aws'; scope: string; collectedAt: number; nodeCount: number; edgeCount: number; warnings: string[]; coverage: RecordData[]; document: RecordData };
const failure = (cause: unknown) => cause instanceof Error ? cause.message : 'Environment operation failed.';

export default function EnvironmentsPage({ principal, onOpenProject }: { principal: Principal; onOpenProject?: (id: string) => void }) {
  const [source, setSource] = useState<'local' | 'aws'>('local');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [name, setName] = useState('');
  const [jobId, setJobId] = useState('');
  const jobs = useOperation<{ items: RecordData[] }>('jobs.list', { items: [] }, {}, canPerform(principal, 'security:read') && !!jobId);
  const job = jobs.data.items.find(item => item.id === jobId);
  const installation = !principal.projectIds;
  const canRead = installation && canPerform(principal, 'security:read') && (source === 'local' || canPerform(principal, 'cloud:read'));
  const canCollect = installation && canPerform(principal, source === 'local' ? 'security:collect' : 'cloud:collect', true);
  const canCreate = installation && canPerform(principal, 'projects:write', true);
  const getPreview = async () => {
    setBusy('preview'); setError(''); setNotice('');
    try { const result = await operation<Preview>('environments.preview', { source }); setPreview(result); setName(label(result.document.systemName, 'Observed environment')); }
    catch (cause) { setError(failure(cause)); setPreview(null); }
    finally { setBusy(''); }
  };
  const collect = async () => {
    setBusy('collect'); setError(''); setNotice(''); setPreview(null);
    try { const result = await operation(source === 'local' ? 'host.check.start' : 'aws.check.start'); setJobId(label(result.id, '')); setNotice('Collection requested. Refresh its status, then preview the latest recorded snapshot.'); }
    catch (cause) { setError(failure(cause)); }
    finally { setBusy(''); }
  };
  const create = async () => {
    if (!preview) return;
    setBusy('create'); setError('');
    try {
      const { project } = await operation<{ project: Project }>('projects.import', { name: name.trim(), content: JSON.stringify({ ...preview.document, systemName: name.trim() }) });
      setNotice(`Created ${name.trim()}. The snapshot is saved in Systems.`);
      if (onOpenProject) onOpenProject(project.id); else location.hash = `systems?project=${encodeURIComponent(project.id)}`;
    } catch (cause) { setError(failure(cause)); }
    finally { setBusy(''); }
  };
  const nodes: Node[] = preview ? asList(preview.document.nodes).map(item => ({ id: label(item.id), position: { x: Number(asRecord(item.position).x) || 0, y: Number(asRecord(item.position).y) || 0 }, data: { label: label(asRecord(item.data).label) }, style: { color: 'var(--text, #ddd)', background: 'var(--surface, #252525)', border: '1px solid #666', width: 240 } })) : [];
  const edges: Edge[] = preview ? asList(preview.document.edges).map(item => ({ id: label(item.id), source: label(item.source), target: label(item.target), label: label(item.label, ''), style: { stroke: '#888' }, labelStyle: { fill: '#ddd' }, labelBgStyle: { fill: '#252525' } })) : [];
  return <><PageTitle title="Environments" description="Turn recorded local and cloud inventory into editable systems, with source evidence and explicit coverage." />
    <ErrorNotice message={error || jobs.error} />{notice && <p className="notice" role="status">{notice}</p>}
    <section className="panel"><div className="section-heading"><h2>Discover and map</h2></div>
      <div className="actions"><label>Environment<select value={source} onChange={event => { setSource(event.target.value as 'local' | 'aws'); setPreview(null); setError(''); setNotice(''); setJobId(''); }} disabled={!!busy}><option value="local">Local network — passive observations</option><option value="aws">AWS — enrolled account and region</option></select></label>
        <button disabled={!!busy || !canCollect} onClick={() => void collect()}><Play size={16} />{busy === 'collect' ? 'Starting…' : 'Collect now'}</button>
        <button disabled={!!busy || !canRead} onClick={() => void getPreview()}>{source === 'local' ? <Network size={16} /> : <Cloud size={16} />}{busy === 'preview' ? 'Preparing…' : 'Preview latest snapshot'}</button></div>
      <p className="muted">{source === 'local' ? 'Reads the operating system’s neighbor cache. It sends no discovery probes and cannot establish a complete LAN topology. Edges describe cache observations.' : 'Uses the backend’s explicitly enrolled AWS profile, account and region. Reads EC2 instances and security groups; attachment edges are configuration associations.'}</p>
      {!installation && <p className="notice">Environment discovery requires installation-wide permission. Your credential is restricted to selected systems.</p>}
      {jobId && <div className="notice"><span>Collection {jobId}: <Status value={job?.state ?? 'requested'} /> {label(job?.message, '')}</span><Refresh loading={jobs.loading} onClick={() => void jobs.refresh()} /><a href="#activity">Open activity</a></div>}
    </section>
    {preview ? <section className="panel"><div className="section-heading"><h2>Snapshot preview</h2><span>{preview.nodeCount} assets · {preview.edgeCount} observed associations</span></div><p className="muted">{preview.scope} · Collected {dateLabel(preview.collectedAt)}</p>
      <ul>{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
      <div className="actions"><label>System name<input value={name} maxLength={200} onChange={event => setName(event.target.value)} /></label><button className="primary" disabled={!canCreate || !name.trim() || !!busy} onClick={() => void create()}><Save size={16} />{busy === 'create' ? 'Saving…' : 'Create editable system'}</button></div>
      <p className="muted">Creates a new system. Your existing models and manual edits are preserved. Automatic reconciliation with an existing model is not yet implemented.</p>
      <div style={{ height: 440, border: '1px solid #555', borderRadius: 8, margin: '16px 0' }} aria-label="Observed environment diagram"><ReactFlow key={`${preview.source}:${preview.collectedAt}`} nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false} deleteKeyCode={null} minZoom={0.05} colorMode="dark"><Background /><Controls showInteractive={false} /></ReactFlow></div>
      <h3>Collection coverage</h3><div className="rows">{preview.coverage.map((item, index) => <div className="record-row" key={`${label(item.id)}:${index}`}><span><strong>{label(item.name)}</strong><small>{label(item.description)}</small></span><Status value={item.status} /></div>)}</div>
      <Evidence value={asList(preview.document.nodes).map(item => ({ name: asRecord(item.data).label, ...asRecord(asRecord(item.data).discovery) }))} title="Asset source evidence" />
    </section> : <Empty title="Preview an observed environment">Collect now, or use the latest recorded snapshot. Review coverage before creating an editable diagram.</Empty>}
    <section className="panel"><h2>Microsoft environments</h2><p>Guardian’s Entra sign-in authenticates users into this application. Azure resource discovery and Entra/Microsoft 365 identity and device inventory require separate read permissions and explicitly selected subscriptions or tenants.</p><p className="muted">Those discovery adapters are not connected in this build. Use Systems to import an existing ContextCypher Azure model; a saved model is not live tenant discovery.</p></section>
  </>;
}
