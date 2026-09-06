import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { Activity, ChevronRight, FileWarning, Layers3, LogOut, Monitor, PanelLeftClose, PanelLeftOpen, Plug, Settings2, Shield, ShieldCheck } from 'lucide-react';
import { request, type Principal } from './api';
import { ErrorNotice } from './components';
import { ActivityPage, FindingsPage, IntegrationsPage, ProtectionPage, SettingsPage } from './pages';

const SystemsPage = lazy(() => import('../contextcypher/GuardianWorkbench'));
const EnvironmentsPage = lazy(() => import('./environments'));
const navigation = [
  { id: 'protection', title: 'Protection', icon: Shield },
  { id: 'environments', title: 'Environments', icon: Monitor },
  { id: 'findings', title: 'Findings', icon: FileWarning },
  { id: 'systems', title: 'Systems', icon: Layers3 },
  { id: 'activity', title: 'Activity', icon: Activity },
  { id: 'integrations', title: 'Integrations', icon: Plug },
  { id: 'settings', title: 'Settings', icon: Settings2 },
] as const;
type Page = typeof navigation[number]['id'];
function currentPage(): Page {
  const value = location.hash.slice(1).split('?')[0];
  return navigation.some(item => item.id === value) ? value as Page : 'protection';
}

export default function App() {
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState<Page>(currentPage);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('guardian-sidebar-collapsed') === 'true'; }
    catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('guardian-sidebar-collapsed', String(sidebarCollapsed)); }
    catch { /* The sidebar still works when browser preference storage is unavailable. */ }
  }, [sidebarCollapsed]);
  const activePage = useRef(page);
  const allowNavigation = () => window.document.documentElement.dataset.guardianDirty !== 'true' || window.confirm('Discard unsaved system changes? Export your draft from Systems first to retain them.');
  const session = async () => {
    setChecking(true);
    try {
      let result = await request<{ authenticated: boolean; principal?: Principal }>('/api/v1/session');
      if (!result.authenticated) {
        const providers = await request<{ localBrowserAccess: boolean }>('/api/v1/auth/providers');
        if (providers.localBrowserAccess) result = await request('/api/v1/session/local', { method: 'POST', body: '{}' });
      }
      setPrincipal(result.authenticated && result.principal ? result.principal : null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to verify session.'); }
    finally { setChecking(false); }
  };
  useEffect(() => {
    void session();
    const expired = () => setPrincipal(null);
    const navigate = (event: HashChangeEvent) => {
      const next = currentPage();
      if (next === activePage.current) return;
      if (!allowNavigation()) { window.history.replaceState(null, '', event.oldURL ? new URL(event.oldURL).hash : `#${activePage.current}`); return; }
      activePage.current = next;
      setPage(next);
    };
    window.addEventListener('guardian-session-expired', expired);
    window.addEventListener('hashchange', navigate);
    return () => { window.removeEventListener('guardian-session-expired', expired); window.removeEventListener('hashchange', navigate); };
  }, []);
  const go = (target: Page) => { location.hash = target; };
  if (checking) return <div className="session-screen"><Shield size={34} /><p role="status">Connecting to Guardian…</p></div>;
  if (!principal) return <Login error={error} onSession={session} />;
  const title = navigation.find(item => item.id === page)?.title;
  return <div className={`shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to workspace</a>
    <aside id="guardian-sidebar" className="sidebar">
      <div className="sidebar-header">
        <a className="brand" href="#protection" aria-label="Guardian Agent home" title="Guardian Agent"><ShieldCheck size={25} strokeWidth={1.6} /><span>Guardian Agent</span></a>
        <button type="button" className="icon-button sidebar-toggle" aria-controls="guardian-sidebar" aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setSidebarCollapsed(value => !value)}>
          {sidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
        </button>
      </div>
      <nav aria-label="Workspace">{navigation.map(({ id, title: text, icon: Icon }) => <a key={id} href={`#${id}`} title={text} aria-label={text} aria-current={page === id ? 'page' : undefined} className={page === id ? 'active' : ''}><Icon size={19} strokeWidth={1.6} /><span>{text}</span></a>)}</nav>
      <div className="sidebar-bottom"><div title="Local workspace" aria-label="Local workspace"><Monitor size={17} /><span>Local workspace</span></div><div className="identity"><span className="avatar" title={`${principal.role} · ${principal.id}`}>{principal.role[0].toUpperCase()}</span><span><strong>{principal.role}</strong><small title={principal.id}>{principal.id}</small></span><button className="icon-button" title="Sign out" aria-label="Sign out" onClick={async () => { if (!allowNavigation()) return; try { await request('/api/v1/session', { method: 'DELETE' }); setPrincipal(null); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign out failed.'); } }}><LogOut size={16} /></button></div></div>
    </aside>
    <main id="main-content" tabIndex={-1}>
      <header className="topbar"><span>Workspace</span><ChevronRight size={13} /><strong>{title}</strong><span className="topbar-spacer" /><span className="local-label" title="Loaded application build"><span className="neutral-dot" />Local security · v{process.env.REACT_APP_VERSION}</span></header>
      <div className={`page ${page === 'systems' ? 'systems-page' : ''}`} key={page}>
        <ErrorNotice message={error} />
        {page === 'protection' && <ProtectionPage principal={principal} go={go} />}
        {page === 'environments' && <Suspense fallback={<p role="status">Loading environments…</p>}><EnvironmentsPage principal={principal} /></Suspense>}
        {page === 'findings' && <FindingsPage principal={principal} />}
        {page === 'activity' && <ActivityPage principal={principal} />}
        {page === 'integrations' && <IntegrationsPage principal={principal} />}
        {page === 'settings' && <SettingsPage principal={principal} />}
        {page === 'systems' && <Suspense fallback={<p role="status">Loading systems workspace…</p>}><SystemsPage principal={principal} /></Suspense>}
      </div>
      <footer className="workspace-footer"><span>Evidence first. Scoped actions. Recorded decisions.</span><button className="text-button" onClick={() => window.location.reload()}>Reload page</button></footer>
    </main>
  </div>;
}

function Login({ error: initialError, onSession }: { error: string; onSession: () => Promise<void> }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const [entra, setEntra] = useState(false);
  const [localAccess, setLocalAccess] = useState(false);
  useEffect(() => { void request<{ entra: boolean; localBrowserAccess: boolean }>('/api/v1/auth/providers').then(value => { setEntra(value.entra === true); setLocalAccess(value.localBrowserAccess === true); }).catch(() => {}); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await request('/api/v1/session', { method: 'POST', body: JSON.stringify({ token }) }); setToken(''); await onSession(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign in failed.'); }
    finally { setBusy(false); }
  };
  return <div className="session-screen"><form className="login" onSubmit={submit}><ShieldCheck size={36} strokeWidth={1.5} /><h1>Guardian Agent</h1><p>Your security workspace, under your control.</p><ErrorNotice message={error} />{localAccess ? <button className="primary" type="button" onClick={() => void onSession()}>Open local workspace<ChevronRight size={16} /></button> : <>{entra && <a className="sso-button" href="/api/v1/auth/entra/start">Sign in with Microsoft Entra ID</a>}<label>Access token<input type="password" value={token} onChange={event => setToken(event.target.value)} autoComplete="off" required autoFocus /></label><button className="primary" disabled={busy || !token.trim()}>{busy ? 'Connecting…' : 'Open workspace'}<ChevronRight size={16} /></button><small>Use a token issued by your local Guardian administrator. Credentials are exchanged for a browser session.</small></>}</form></div>;
}
