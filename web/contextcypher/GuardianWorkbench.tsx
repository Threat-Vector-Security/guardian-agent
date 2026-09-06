import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, MenuItem, Select, TextField, Typography } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import DiagramEditor, { type GuardianDocumentBridge } from './src/components/DiagramEditor';
import GrcModule, { type DiagramFileActions } from './src/components/grc/GrcModule';
import { AnalysisContextProvider } from './src/components/AnalysisContextProvider';
import { ManualAnalysisProvider } from './src/contexts/ManualAnalysisContext';
import { ViewStateProvider } from './src/contexts/ViewStateContext';
import { WorkspaceViewportProvider } from './src/hooks/useViewportLayout';
import { SettingsProvider, useSettings } from './src/settings/SettingsContext';
import { AutosaveCountdown } from './src/components/AutosaveCountdown';
import { ensureGrcWorkspace } from './src/services/GrcWorkspaceService';
import { type AppModuleMode, type DiagramContextSnapshot, type GrcWorkspace } from './src/types/GrcTypes';
import { getTheme } from './src/styles/Theme';
import { documentContentFingerprint, preserveExtensions } from './document-preservation';
import { setGuardianProjectContext } from './src/services/guardianApi';
import { canPerform, downloadJson, operation, useOperation, type Principal, type Project, type RecordData } from '../security/api';
import SystemsPage from '../security/systems';
import './src/styles/ThemeAnimations.css';
import '@xyflow/react/dist/style.css';

export default function GuardianWorkbench({ principal }: { principal: Principal }) {
  if (!canPerform(principal, 'projects:write', true)) return <SystemsPage principal={principal} />;
  return <SettingsProvider><WorkbenchTheme><ProjectWorkbench /></WorkbenchTheme></SettingsProvider>;
}

function WorkbenchTheme({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const theme = useMemo(() => {
    const colors = getTheme(settings.theme, settings.customTheme).colors;
    return createTheme({ palette: { mode: settings.theme === 'light' ? 'light' : 'dark', primary: { main: colors.primary }, secondary: { main: colors.secondary }, background: { default: colors.background, paper: colors.surface }, text: { primary: colors.textPrimary, secondary: colors.textSecondary } }, typography: { button: { textTransform: 'none' } }, colors } as any);
  }, [settings.theme, settings.customTheme]);
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

function ProjectWorkbench() {
  const { settings } = useSettings();
  const projects = useOperation<{ items: Project[] }>('projects.list', { items: [] });
  const [project, setProject] = useState<Project | null>(null);
  const [generation, setGeneration] = useState(0);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [autosavePaused, setAutosavePaused] = useState(false);
  const [nextAutosaveAt, setNextAutosaveAt] = useState<number | null>(null);
  const draft = useRef<RecordData | null>(null);
  const saved = useRef('');
  const baselinePending = useRef(false);
  const saving = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  useEffect(() => {
    setGuardianProjectContext(project ? { projectId: project.id, revision: project.revision } : null);
    return () => setGuardianProjectContext(null);
  }, [project?.id, project?.revision]);

  useEffect(() => {
    document.documentElement.dataset.guardianDirty = String(dirty);
    const prevent = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', prevent);
    return () => { window.removeEventListener('beforeunload', prevent); delete document.documentElement.dataset.guardianDirty; };
  }, [dirty]);

  const accept = (next: Project) => {
    draft.current = next.document;
    saved.current = documentContentFingerprint(next.document);
    baselinePending.current = true;
    setDirty(false); setError(''); setAutosavePaused(false); setProject(next); setGeneration(value => value + 1);
  };
  const canDiscard = () => !dirty || window.confirm('Discard unsaved changes? Export your draft first to keep a copy.');
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Operation failed.'); }
    finally { setBusy(false); }
  };
  const load = (id: string) => {
    if (!id || !canDiscard()) return;
    void run(async () => { const result = await operation<{ project: Project }>('projects.get', { id }); accept(result.project); });
  };
  useEffect(() => {
    const id = new URLSearchParams(window.location.hash.split('?')[1] || '').get('project');
    if (id) load(id);
  }, []);
  const create = () => {
    if (!name.trim() || !canDiscard()) return;
    void run(async () => { const result = await operation<{ project: Project }>('projects.create', { name: name.trim() }); accept(result.project); setName(''); await projects.refresh(); });
  };
  const importDocument = useCallback(async (content: RecordData) => {
    if (!canDiscard()) return;
    await run(async () => {
      const result = await operation<{ project: Project }>('projects.import', { name: typeof content.systemName === 'string' ? content.systemName : 'Imported system', content: JSON.stringify(content) });
      accept(result.project); await projects.refresh(); setNotice('Imported as a new system.');
    });
  }, [dirty, projects.refresh]);
  const change = useCallback((next: RecordData) => {
    draft.current = next;
    const serialized = documentContentFingerprint(next);
    if (baselinePending.current) { saved.current = serialized; baselinePending.current = false; }
    setDirty(saved.current !== serialized);
  }, []);
  const save = useCallback(async (next: RecordData, automatic = false): Promise<boolean> => {
    const current = projectRef.current;
    if (!current || saving.current) return false;
    saving.current = true; setBusy(true); setError(''); setNotice('');
    const submitted = documentContentFingerprint(next);
    try {
      const result = await operation<{ project: Project }>('projects.update', { id: current.id, revision: current.revision, document: next });
      projectRef.current = result.project;
      setProject(result.project); saved.current = submitted;
      setDirty(documentContentFingerprint(draft.current || {}) !== submitted);
      setAutosavePaused(false);
      setNotice(`${automatic ? 'Autosaved' : 'Saved'} revision ${result.project.revision}.`);
      await projects.refresh(); return true;
    } catch (cause) {
      setError(`${cause instanceof Error ? cause.message : 'Save failed.'} Your draft remains open. Export it before loading another revision.`);
      setAutosavePaused(true);
      return false;
    } finally { saving.current = false; setBusy(false); }
  }, [projects.refresh]);

  useEffect(() => {
    setNextAutosaveAt(null);
    const intervalMs = settings.autosave.intervalMinutes * 60_000;
    if (!project || !settings.autosave.enabled || autosavePaused || busy ||
        !Number.isFinite(intervalMs) || intervalMs < 60_000 || intervalMs > 2_147_483_647) return;
    let disposed = false;
    setNextAutosaveAt(Date.now() + intervalMs);
    const timer = setInterval(async () => {
      if (disposed) return;
      setNextAutosaveAt(Date.now() + intervalMs);
      const next = draft.current;
      if (!next || baselinePending.current || saving.current || documentContentFingerprint(next) === saved.current) return;
      const successful = await save(next, true);
      if (!successful && !disposed) {
        clearInterval(timer);
        setNextAutosaveAt(null);
      }
    }, intervalMs);
    return () => { disposed = true; clearInterval(timer); };
  }, [settings.autosave.enabled, settings.autosave.intervalMinutes, project?.id, autosavePaused, busy, save]);

  return <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 55px)', minHeight: 0, minWidth: 0 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, p: 1, bgcolor: 'background.paper' }}>
      <Typography variant="h6">Systems</Typography>
      <Select size="small" aria-label="Saved system" value={project?.id || ''} displayEmpty disabled={busy} onChange={event => load(event.target.value)} sx={{ minWidth: 190, maxWidth: 330 }}>
        <MenuItem value="" disabled>Choose a saved system</MenuItem>
        {projects.data.items.map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
      </Select>
      <TextField size="small" label="New system name" value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') create(); }} />
      <Button disabled={busy || !name.trim()} onClick={create}>Create system</Button>
      <Button disabled={busy} onClick={() => fileInput.current?.click()}>Import JSON</Button>
      <input hidden ref={fileInput} type="file" accept=".json,application/json" onChange={event => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (!file) return;
        if (file.size > 64 * 1024 * 1024) { setError('The import exceeds the 64 MiB envelope limit.'); return; }
        void file.text().then(text => importDocument(JSON.parse(text))).catch(cause => setError(`Import failed: ${cause.message}`));
      }} />
      <Button disabled={!project || busy} variant="contained" onClick={() => { if (draft.current) void save(draft.current); }}>Save system</Button>
      <Button disabled={!project} onClick={() => { if (draft.current) void downloadJson(`${project?.name || 'system'}-draft`, draft.current).catch(cause => setError(cause instanceof Error ? cause.message : 'Export failed.')); }}>Export draft</Button>
      {project && <Typography variant="caption">Revision {project.revision}{dirty ? ' · Unsaved changes' : ''}</Typography>}
      <AutosaveCountdown enabled={settings.autosave.enabled && !autosavePaused} nextAutosaveAt={nextAutosaveAt} />
    </Box>
    {(error || projects.error) && <Alert severity="error">{error || projects.error}</Alert>}
    {project && autosavePaused && settings.autosave.enabled && <Alert severity="warning">Autosave is paused after a save failed. Your draft remains editable and can be exported. Use Save system to retry; a successful save resumes autosave.</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
    {project ? <ProjectEditor key={`${project.id}:${generation}`} initialDocument={project.document} onDraftChange={change} onSave={save} onImport={importDocument} /> : <Box sx={{ p: 3 }}><Typography>Create or open a system to use the full editor, built-in examples, security analysis and GRC workspace.</Typography></Box>}
  </Box>;
}

function ProjectEditor(bridge: GuardianDocumentBridge) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeModule, setActiveModule] = useState<AppModuleMode>('diagram');
  const [workspace, setWorkspace] = useState<GrcWorkspace>(() => preserveExtensions(bridge.initialDocument.grcWorkspace, ensureGrcWorkspace(bridge.initialDocument.grcWorkspace)));
  const [snapshot, setSnapshot] = useState<DiagramContextSnapshot | null>(null);
  const [actions, setActions] = useState<DiagramFileActions | null>(null);
  const workspaceLoad = useCallback((value: unknown) => setWorkspace(preserveExtensions(value, ensureGrcWorkspace(value))), []);
  const actionsReady = useCallback((value: DiagramFileActions) => setActions(value), []);
  return <ViewStateProvider><AnalysisContextProvider><ManualAnalysisProvider>
    <Box ref={containerRef} sx={{ flex: 1, minHeight: 0, minWidth: 0, position: 'relative', transform: 'translateZ(0)', overflow: 'hidden' }}>
      <WorkspaceViewportProvider containerRef={containerRef}>
      <Box sx={{ height: '100%', display: activeModule === 'diagram' ? 'block' : 'none' }}>
        <DiagramEditor guardian={bridge} activeModule={activeModule} onSwitchModule={setActiveModule} grcWorkspace={workspace} onGrcWorkspaceLoad={workspaceLoad} onDiagramContextChange={setSnapshot} onFileActionsReady={actionsReady} />
      </Box>
      {activeModule === 'grc' && <GrcModule workspace={workspace} onWorkspaceChange={setWorkspace} onSwitchModule={setActiveModule} diagramSnapshot={snapshot} diagramFileActions={actions} />}
      </WorkspaceViewportProvider>
    </Box>
  </ManualAnalysisProvider></AnalysisContextProvider></ViewStateProvider>;
}
