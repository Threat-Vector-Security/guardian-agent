import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Background, Controls, Handle, Position, ReactFlow, type Connection, type Edge, type Node, type NodeChange, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Download, FileUp, Layers3, Link2, Plus, Save, Trash2, X } from 'lucide-react';
import { asList, asRecord, canPerform, dateLabel, downloadJson, label, operation, useOperation, type Principal, type Project, type RecordData } from './api';
import { Empty, ErrorNotice, Evidence, PageTitle, Refresh, Status } from './components';
import { assetPositions, assetRemovalIds, removeAsset, updateAsset, updateGrcRecord, updateThreat } from './document';

const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : 'Unable to complete the operation.';
const nodeTypes = { guardianAsset: AssetNode };
function AssetNode({ data, selected }: NodeProps) {
  return <div className={`asset-node ${selected ? 'is-selected' : ''}`}><Handle type="target" position={Position.Left} /><div className="asset-node-icon"><Layers3 size={17} /></div><div><strong>{label(data.label, 'Untitled asset')}</strong><small>{label(data.guardianType || data.zone, 'Asset')}</small></div><Handle type="source" position={Position.Right} /></div>;
}

export default function SystemsPage({ principal }: { principal: Principal }) {
  const projects = useOperation<{ items: Project[] }>('projects.list', { items: [] });
  const [project, setProject] = useState<Project | null>(null);
  const [document, setDocument] = useState<RecordData>({ nodes: [], edges: [] });
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState('');
  const [selectedEdge, setSelectedEdge] = useState('');
  const [view, setView] = useState('diagram');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const editable = canPerform(principal, 'projects:write', true) && !busy;
  const rawNodes = asList(document.nodes);
  const rawEdges = asList(document.edges);
  const node = rawNodes.find(item => item.id === selected);
  const edge = rawEdges.find(item => item.id === selectedEdge);
  const patch = useCallback((change: (previous: RecordData) => RecordData) => { setDocument(change); setDirty(true); }, []);
  useEffect(() => {
    window.document.documentElement.dataset.guardianDirty = String(dirty);
    const prevent = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', prevent);
    return () => { window.removeEventListener('beforeunload', prevent); delete window.document.documentElement.dataset.guardianDirty; };
  }, [dirty]);
  const canDiscard = () => !dirty || window.confirm('Discard unsaved system changes? Export the draft first if you want to keep them.');
  const acceptProject = (next: Project) => { setProject(next); setDocument(next.document); setDirty(false); setSelected(''); setSelectedEdge(''); setError(''); };
  const load = async (id: string) => {
    if (!canDiscard()) return; setBusy('loading'); setError(''); setNotice('');
    try { const result = await operation<{ project: Project }>('projects.get', { id }); acceptProject(result.project); }
    catch (cause) { setError(errorMessage(cause)); } finally { setBusy(''); }
  };
  const create = async (event: FormEvent) => {
    event.preventDefault(); if (!canDiscard()) return; setBusy('creating'); setError('');
    try { const result = await operation<{ project: Project }>('projects.create', { name }); acceptProject(result.project); setCreating(false); setName(''); await projects.refresh(); }
    catch (cause) { setError(errorMessage(cause)); } finally { setBusy(''); }
  };
  const importFile = async (file: File | undefined) => {
    if (!file || !canDiscard()) return;
    if (file.size > 64 * 1024 * 1024) { setError('The import exceeds the 64 MiB envelope limit; editable documents are limited to 16 MiB.'); return; }
    setBusy('importing'); setError('');
    try { const content = await file.text(); const result = await operation<{ project: Project }>('projects.import', { name: file.name.replace(/\.[^.]+$/, ''), content }); acceptProject(result.project); await projects.refresh(); setNotice('System imported. Original content and extension fields are retained.'); }
    catch (cause) { setError(errorMessage(cause)); } finally { setBusy(''); if (fileInput.current) fileInput.current.value = ''; }
  };
  const save = async () => {
    if (!project) return; setBusy('saving'); setError('');
    try { const result = await operation<{ project: Project }>('projects.update', { id: project.id, revision: project.revision, document }); setProject(result.project); setDocument(result.project.document); setDirty(false); await projects.refresh(); setNotice('System saved.'); }
    catch (cause) { setError(`${errorMessage(cause)} Your draft remains open; export it before reloading a conflicting revision.`); } finally { setBusy(''); }
  };
  const exportProject = async (original: boolean) => {
    if (!project) return; setBusy('exporting'); setError('');
    try { await downloadJson(`${project.name}${original ? '-original' : ''}`, async () => {
      const result = await operation<{ document: RecordData; original: string }>('projects.export', { id: project.id });
      return original ? result.original : result.document;
    }); }
    catch (cause) { setError(errorMessage(cause)); } finally { setBusy(''); }
  };
  const addAsset = () => {
    const id = crypto.randomUUID();
    patch(previous => ({ ...previous, nodes: [...asList(previous.nodes), { id, type: 'default', position: { x: 80 + rawNodes.length % 4 * 230, y: 80 + Math.floor(rawNodes.length / 4) * 110 }, data: { label: 'New asset', description: '', securityControls: [] } }] }));
    setSelected(id); setSelectedEdge('');
  };
  // Imported styles and custom renderers remain stored but cannot introduce external resources or overlay UI.
  const nodes = useMemo<Node[]>(() => {
    const positions = assetPositions(document);
    return rawNodes.map(item => ({ id: label(item.id), type: 'guardianAsset', position: positions.get(label(item.id)) || { x: 0, y: 0 }, data: { label: label(asRecord(item.data).label, 'Untitled asset'), guardianType: item.type }, selected: item.id === selected, deletable: editable, draggable: editable, connectable: editable }));
  }, [document.nodes, selected, editable]);
  const edges = useMemo<Edge[]>(() => rawEdges.map(item => ({ id: label(item.id), source: label(item.source), target: label(item.target), type: 'default', sourceHandle: null, targetHandle: null, label: typeof item.label === 'string' ? item.label : undefined, selected: item.id === selectedEdge, deletable: editable })), [document.edges, selectedEdge, editable]);
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (!editable) return;
    const positions = changes.filter(change => change.type === 'position');
    if (positions.length) patch(previous => {
      const world = assetPositions(previous);
      return { ...previous, nodes: asList(previous.nodes).map(item => {
        const change = positions.find(candidate => candidate.id === item.id);
        if (!change?.position) return item;
        const parent = world.get(String(item.parentId ?? item.parentNode)) || { x: 0, y: 0 };
        return { ...item, position: { ...asRecord(item.position), x: change.position.x - parent.x, y: change.position.y - parent.y } };
      }) };
    });
  }, [editable, patch]);
  const onConnect = useCallback((connection: Connection) => {
    if (!editable || !connection.source || !connection.target) return;
    patch(previous => ({ ...previous, edges: [...asList(previous.edges), { id: crypto.randomUUID(), source: connection.source, target: connection.target, label: '', data: {} }] }));
  }, [editable, patch]);
  return <><PageTitle title="Systems" description="Model your assets, relationships, threats, and controls in one security context."><button disabled={!editable || !!busy || !!principal.projectIds} onClick={() => setCreating(value => !value)}><Plus size={15} />New system</button><button disabled={!editable || !!busy || !!principal.projectIds} onClick={() => fileInput.current?.click()}><FileUp size={15} />Import ContextCypher</button><input className="visually-hidden" ref={fileInput} type="file" accept=".json,.cypher,application/json" aria-label="Import ContextCypher document" onChange={event => void importFile(event.target.files?.[0])} /></PageTitle><ErrorNotice message={error || projects.error} />{notice && <div className="notice" role="status">{notice}<button className="icon-button" aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={15} /></button></div>}
    {creating && <form className="create-system" onSubmit={create}><label>System name<input autoFocus value={name} onChange={event => setName(event.target.value)} required maxLength={200} /></label><button className="primary" disabled={!!busy || !name.trim()}>Create system</button><button type="button" onClick={() => setCreating(false)}>Cancel</button></form>}
    <div className="system-toolbar"><label>System<select aria-label="System" value={project?.id || ''} disabled={!!busy} onChange={event => { if (event.target.value) void load(event.target.value); }}><option value="">Select a system</option>{projects.data.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><Refresh loading={projects.loading} onClick={() => void projects.refresh()} /><span className="toolbar-spacer" />{project && <><span className="muted">Revision {project.revision}{dirty ? ' · Unsaved changes' : ''}</span><button disabled={!editable || !dirty || !!busy} className="primary" onClick={() => void save()}><Save size={15} />{busy === 'saving' ? 'Saving…' : 'Save'}</button><button disabled={!!busy || dirty} onClick={() => void exportProject(false)}><Download size={15} />Export saved</button><button disabled={!!busy} onClick={() => void exportProject(true)}>Original</button>{dirty && <button onClick={() => { void downloadJson(`${project.name}-draft`, document).catch(cause => setError(errorMessage(cause))); }}>Export draft</button>}</>}</div>
    {project ? <><div className="tabs" role="tablist" aria-label="System views">{[['diagram', 'Diagram'], ['threats', 'Threats & risks'], ['controls', 'Controls'], ['context', 'Imported context']].map(([id, title]) => <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}>{title}</button>)}</div>
      {view === 'diagram' ? <div className="diagram-workbench"><section className="canvas-area" aria-label="System diagram"><div className="canvas-toolbar"><button disabled={!editable} onClick={addAsset}><Plus size={15} />Add asset</button><span>{rawNodes.length} assets · {rawEdges.length} connections</span></div><ReactFlow key={project.id} nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onConnect={onConnect} onNodeClick={(_, item) => { setSelected(item.id); setSelectedEdge(''); }} onEdgeClick={(_, item) => { setSelectedEdge(item.id); setSelected(''); }} onPaneClick={() => { setSelected(''); setSelectedEdge(''); }} fitView fitViewOptions={{ padding: 0.25, maxZoom: 1 }} minZoom={0.1} maxZoom={2} deleteKeyCode={null} colorMode="dark" nodesDraggable={editable} nodesConnectable={editable} proOptions={{ hideAttribution: false }}><Background gap={22} size={1} color="#3b3b3b" /><Controls showInteractive={false} /></ReactFlow>{!rawNodes.length && <div className="canvas-empty"><Layers3 size={30} strokeWidth={1.2} /><strong>Map your system</strong><p>Add an asset, then drag between its connection handles to describe data flow.</p></div>}</section>
      <aside className="inspector asset-inspector">{node ? <AssetInspector node={node} editable={editable} onPatch={values => patch(previous => updateAsset(previous, selected, values))} onThreatPatch={(id, values) => patch(previous => updateThreat(previous, selected, id, values))} onRemove={() => { const count = assetRemovalIds(document, selected).size; if (window.confirm(`Delete ${count} asset${count === 1 ? '' : 's (including contained assets)'} and all their connected edges? Imported GRC references are retained for review.`)) { patch(previous => removeAsset(previous, selected)); setSelected(''); } }} /> : edge ? <><h2>Connection</h2><p className="muted">{label(edge.source)} → {label(edge.target)}</p><label>Label<input disabled={!editable} value={label(edge.label, '')} onChange={event => patch(previous => ({ ...previous, edges: asList(previous.edges).map(item => item.id === selectedEdge ? { ...item, label: event.target.value } : item) }))} /></label><Evidence value={edge} title="Connection context" /><button disabled={!editable} onClick={() => { patch(previous => ({ ...previous, edges: asList(previous.edges).filter(item => item.id !== selectedEdge) })); setSelectedEdge(''); }}><Trash2 size={15} />Remove connection</button></> : <><h2>System context</h2><p>Select an asset or connection to inspect and edit its security context.</p><p>Imported asset types and extension fields are retained even when shown with a common canvas shape.</p><hr /><h3>Assets</h3><div className="asset-list">{rawNodes.map(item => <button key={label(item.id)} onClick={() => setSelected(label(item.id))}><Layers3 size={14} />{label(asRecord(item.data).label, label(item.id))}</button>)}</div></>}</aside></div>
      : view === 'threats' ? <ThreatRegister document={document} editable={editable} patch={patch} onSelect={id => { setSelected(id); setView('diagram'); }} />
      : view === 'controls' ? <ControlRegister document={document} editable={editable} patch={patch} onSelect={id => { setSelected(id); setView('diagram'); }} />
      : <section className="context-view"><h2>Imported context</h2><p>Analysis history, GRC records, drawings, threat intelligence, and extension data are retained. Imported text is evidence for review; it is not trusted operating instructions.</p><dl className="facts"><div><dt>System ID</dt><dd>{project.id}</dd></div><div><dt>Last saved</dt><dd>{dateLabel(project.updatedAt)}</dd></div><div><dt>Top-level fields</dt><dd>{Object.keys(document).join(', ')}</dd></div></dl>{Object.entries(document).filter(([key]) => !['nodes', 'edges'].includes(key)).map(([key, value]) => <Evidence key={key} value={value} title={key} />)}<Evidence value={document} title="Complete document" /></section>}</>
      : <Empty title={busy ? 'Loading system…' : 'Create or import your first system'}>Import an existing ContextCypher document or create a system to map assets and record security context.</Empty>}
  </>;
}

function AssetInspector({ node, editable, onPatch, onThreatPatch, onRemove }: { node: RecordData; editable: boolean; onPatch: (patch: RecordData) => void; onThreatPatch: (id: string, patch: RecordData) => void; onRemove: () => void }) {
  const data = asRecord(node.data);
  const context = asRecord(data.securityContext);
  const threats = asList(context.threats);
  const controls = Array.isArray(data.securityControls) ? data.securityControls : [];
  const [control, setControl] = useState('');
  const addThreat = () => {
    const now = new Date().toISOString();
    onPatch({ securityContext: { ...context, threats: [...threats, { id: crypto.randomUUID(), type: 'threat', title: 'New threat', description: '', severity: 'Medium', source: 'manual', status: 'identified', createdAt: now, updatedAt: now }] } });
  };
  return <div className="stack"><div className="section-heading"><h2>Asset context</h2><Status value={node.type || 'asset'} /></div><small className="muted selectable">{label(node.id)}</small><label>Name<input disabled={!editable} value={label(data.label, '')} onChange={event => onPatch({ label: event.target.value })} /></label><label>Description<textarea disabled={!editable} rows={3} value={label(data.description, '')} onChange={event => onPatch({ description: event.target.value })} /></label><label>Trust zone<input disabled={!editable} value={label(data.zone, '')} onChange={event => onPatch({ zone: event.target.value })} /></label><label>Data classification<input disabled={!editable} value={label(data.dataClassification, '')} onChange={event => onPatch({ dataClassification: event.target.value })} /></label>
    <div className="section-heading"><h3>Threats & risks</h3><button disabled={!editable} className="icon-button" aria-label="Add threat" onClick={addThreat}><Plus size={16} /></button></div>{threats.map(threat => <details className="threat-editor" key={label(threat.id)}><summary>{label(threat.title)}<Status value={threat.severity} /></summary><ThreatFields item={threat} editable={editable} onChange={values => onThreatPatch(label(threat.id), { ...values, updatedAt: new Date().toISOString() })} /></details>)}{!threats.length && <p className="muted">No threats recorded for this asset.</p>}
    <h3>Security controls</h3><div className="control-tags">{controls.map((value, index) => <div key={index}><span>{label(value, JSON.stringify(value))}</span><button disabled={!editable} className="icon-button" aria-label={`Remove control ${label(value)}`} onClick={() => onPatch({ securityControls: controls.filter((_, position) => position !== index) })}><X size={13} /></button></div>)}</div><form className="joined" onSubmit={event => { event.preventDefault(); if (control.trim()) { onPatch({ securityControls: [...controls, control.trim()] }); setControl(''); } }}><input disabled={!editable} value={control} onChange={event => setControl(event.target.value)} aria-label="New security control" placeholder="Add a control" /><button disabled={!editable || !control.trim()} aria-label="Add security control"><Plus size={15} /></button></form><Evidence value={node} title="Full asset context" /><button disabled={!editable} className="danger-button" onClick={onRemove}><Trash2 size={15} />Delete asset</button></div>;
}

function ThreatFields({ item, editable, onChange }: { item: RecordData; editable: boolean; onChange: (patch: RecordData) => void }) {
  return <div className="stack"><label>Title<input disabled={!editable} value={label(item.title, '')} onChange={event => onChange({ title: event.target.value })} /></label><label>Kind<select disabled={!editable} value={label(item.type, 'threat')} onChange={event => onChange({ type: event.target.value })}><option value="threat">Threat</option><option value="vulnerability">Vulnerability</option><option value="risk">Risk</option></select></label><label>Description<textarea disabled={!editable} rows={3} value={label(item.description, '')} onChange={event => onChange({ description: event.target.value })} /></label><label>Severity<select disabled={!editable} value={label(item.severity, 'Medium')} onChange={event => onChange({ severity: event.target.value })}>{Array.from(new Set([label(item.severity, 'Medium'), 'Critical', 'High', 'Medium', 'Low', 'Info'])).map(value => <option key={value}>{value}</option>)}</select></label><label>Mitigation<textarea disabled={!editable} rows={2} value={label(item.mitigation, '')} onChange={event => onChange({ mitigation: event.target.value })} /></label><label>Status<select disabled={!editable} value={label(item.status, 'identified')} onChange={event => onChange({ status: event.target.value })}>{Array.from(new Set([label(item.status, 'identified'), 'identified', 'mitigated', 'accepted', 'transferred'])).map(value => <option key={value}>{value}</option>)}</select></label></div>;
}

function ThreatRegister({ document, editable, patch, onSelect }: { document: RecordData; editable: boolean; patch: (change: (previous: RecordData) => RecordData) => void; onSelect: (id: string) => void }) {
  const assets = asList(document.nodes);
  const threats = assets.flatMap(node => asList(asRecord(asRecord(node.data).securityContext).threats).map(threat => ({ node, threat })));
  const risks = asList(asRecord(document.grcWorkspace).risks);
  const findings = asList(asRecord(document.grcWorkspace).findings);
  return <section className="register"><div className="section-heading"><h2>Asset threats and risks</h2><span className="muted">{threats.length} records</span></div><p>Record new threats and risks in an asset’s inspector. Ratings here are recorded assessments, not automatic proof of exposure.</p>{threats.length ? threats.map(({ node, threat }) => <details className="register-record" key={`${label(node.id)}:${label(threat.id)}`}><summary><span><strong>{label(threat.title)}</strong><small>{label(asRecord(node.data).label)} · {label(threat.type)}</small></span><Status value={threat.severity} /></summary><div className="register-detail"><ThreatFields item={threat} editable={editable} onChange={values => patch(previous => updateThreat(previous, label(node.id), label(threat.id), { ...values, updatedAt: new Date().toISOString() }))} /><div><button onClick={() => onSelect(label(node.id))}><Link2 size={15} />Open asset</button><Evidence value={threat} title="Threat context" /></div></div></details>) : <Empty title="No asset threats recorded">Open an asset on the diagram to document a threat, vulnerability, or risk.</Empty>}
    <h2>Imported GRC risk register</h2>{risks.length ? risks.map(item => <details className="register-record" key={label(item.id)}><summary><span><strong>{label(item.title)}</strong><small>{label(item.owner, 'Unassigned')} · {label(item.status)}</small></span><Status value={asRecord(item.inherentScore).ratingLabel} /></summary><div className="register-detail"><div className="stack"><label>Title<input disabled={!editable} value={label(item.title, '')} onChange={event => patch(previous => updateGrcRecord(previous, 'risks', label(item.id), { title: event.target.value }))} /></label><label>Description<textarea disabled={!editable} rows={3} value={label(item.description, '')} onChange={event => patch(previous => updateGrcRecord(previous, 'risks', label(item.id), { description: event.target.value }))} /></label><label>Treatment plan<textarea disabled={!editable} rows={3} value={label(item.treatmentPlan, '')} onChange={event => patch(previous => updateGrcRecord(previous, 'risks', label(item.id), { treatmentPlan: event.target.value }))} /></label></div><div><p>Imported scoring models, assessment links, and acceptance records are preserved.</p><Evidence value={item} title="GRC risk details" /></div></div></details>) : <p className="muted">No imported GRC risk register.</p>}
    {findings.length > 0 && <><h2>Imported analysis findings</h2>{findings.map(item => <details className="register-record" key={label(item.id)}><summary><strong>{label(item.title)}</strong><Status value={item.severity} /></summary><p>{label(item.description, '')}</p><Evidence value={item} /></details>)}</>}
  </section>;
}

function ControlRegister({ document, editable, patch, onSelect }: { document: RecordData; editable: boolean; patch: (change: (previous: RecordData) => RecordData) => void; onSelect: (id: string) => void }) {
  const assets = asList(document.nodes).filter(node => Array.isArray(asRecord(node.data).securityControls) && (asRecord(node.data).securityControls as unknown[]).length);
  const workspace = asRecord(document.grcWorkspace);
  const implemented = asList(workspace.implementedControls);
  const controlSets = asList(workspace.controlSets);
  return <section className="register"><h2>Asset controls</h2><p>Controls describe the intended or recorded safeguards for an asset. Listing a control does not verify its implementation.</p>{assets.length ? assets.map(node => <article className="register-record" key={label(node.id)}><div className="section-heading"><h3>{label(asRecord(node.data).label)}</h3><button className="quiet" onClick={() => onSelect(label(node.id))}><Link2 size={14} />Edit asset</button></div><ul>{(asRecord(node.data).securityControls as unknown[]).map((control, index) => <li key={index}>{label(control, JSON.stringify(control))}</li>)}</ul></article>) : <Empty title="No asset controls recorded">Add security controls in an asset’s inspector.</Empty>}
    <h2>Imported implemented controls</h2>{implemented.length ? implemented.map(item => <details className="register-record" key={label(item.id)}><summary><strong>{label(item.title || item.name || item.controlId)}</strong><Status value={item.status} /></summary><div className="stack"><label>Description<textarea disabled={!editable} value={label(item.description, '')} onChange={event => patch(previous => updateGrcRecord(previous, 'implementedControls', label(item.id), { description: event.target.value }))} /></label><Evidence value={item} /></div></details>) : <p className="muted">No imported implementation records.</p>}
    <h2>Imported control sets</h2>{controlSets.length ? controlSets.map(set => <details className="register-record" key={label(set.id)}><summary><strong>{label(set.name)}</strong><span>{asList(set.controls).length} controls</span></summary>{asList(set.controls).map(control => <article className="control-definition" key={label(control.id)}><h3>{label(control.controlId)} · {label(control.title)}</h3><p>{label(control.description, 'No description supplied.')}</p></article>)}</details>) : <p className="muted">No imported control sets.</p>}
  </section>;
}
