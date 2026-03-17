import { api } from '../api.js';
import { onSSE } from '../app.js';

const STORAGE_KEY = 'guardianagent_code_sessions_v1';
const DEFAULT_USER_CHANNEL = 'web';
const MAX_TERMINAL_PANES = 3;
const APPROVAL_BACKLOG_SOFT_CAP = 3;
const MAX_SESSION_JOBS = 20;
const ASSISTANT_TABS = ['chat', 'tasks', 'approvals', 'checks'];

const SCROLL_SELECTORS = ['.code-file-list', '.code-editor__content', '.code-chat__history', '.code-rail__list'];

let currentContainer = null;
let codeState = loadState();
let cachedAgents = [];
let cachedFileView = { source: '', diff: '', error: null };
let treeCache = new Map(); // keyed by absolute path → { entries, error }
let renderInFlight = false;
let hasRenderedOnce = false;
let detectedPlatform = 'linux'; // populated on first render from server
let shellOptionsCache = [];
let terminalListenersBound = false;
let terminalRenderTimer = null;
let terminalUnloadBound = false;
let terminalLibPromise = null;
let terminalCssLoaded = false;
let terminalInstances = new Map();

function isAssistantTab(value) {
  return ASSISTANT_TABS.includes(value);
}

// ─── Platform-aware shell options ──────────────────────────

function getShellOptions() {
  if (Array.isArray(shellOptionsCache) && shellOptionsCache.length > 0) {
    return shellOptionsCache;
  }
  switch (detectedPlatform) {
    case 'win32':
      return [
        { id: 'powershell', label: 'PowerShell (Windows)', detail: 'powershell.exe' },
        { id: 'cmd', label: 'Command Prompt (cmd.exe)', detail: 'cmd.exe' },
        { id: 'git-bash', label: 'Git Bash', detail: 'C:\\Program Files\\Git\\bin\\bash.exe' },
        { id: 'wsl', label: 'WSL Bash', detail: 'wsl -- bash' },
        { id: 'bash', label: 'Bash', detail: 'bash' },
      ];
    case 'darwin':
      return [
        { id: 'zsh', label: 'Zsh', detail: 'zsh' },
        { id: 'bash', label: 'Bash', detail: 'bash' },
        { id: 'sh', label: 'POSIX sh', detail: 'sh' },
      ];
    default:
      return [
        { id: 'bash', label: 'Bash', detail: 'bash' },
        { id: 'zsh', label: 'Zsh', detail: 'zsh' },
        { id: 'sh', label: 'POSIX sh', detail: 'sh' },
      ];
  }
}

function getDefaultShell() {
  return getShellOptions()[0]?.id || 'bash';
}

function getShellOption(shellId) {
  return getShellOptions().find((option) => option.id === shellId) || null;
}

function ensureTerminalCss() {
  if (terminalCssLoaded) return;
  terminalCssLoaded = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/vendor/xterm/xterm.css';
  document.head.appendChild(link);
}

async function loadTerminalLib() {
  if (!terminalLibPromise) {
    ensureTerminalCss();
    terminalLibPromise = Promise.all([
      import('/vendor/xterm/xterm.mjs'),
      import('/vendor/xterm/addon-fit.mjs'),
    ]).then(([xterm, addonFit]) => ({
      Terminal: xterm.Terminal,
      FitAddon: addonFit.FitAddon,
    }));
  }
  return terminalLibPromise;
}

async function copyTextToClipboard(text) {
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function bindTerminalListeners() {
  if (terminalListenersBound) return;
  terminalListenersBound = true;
  if (!terminalUnloadBound) {
    terminalUnloadBound = true;
    window.addEventListener('beforeunload', () => {
      for (const session of codeState.sessions || []) {
        for (const tab of session.terminalTabs || []) {
          if (tab.runtimeTerminalId) {
            fetch(`/api/code/terminals/${encodeURIComponent(tab.runtimeTerminalId)}`, {
              method: 'DELETE',
              credentials: 'same-origin',
              keepalive: true,
            }).catch(() => {});
          }
        }
      }
    });
  }

  onSSE('terminal.output', (payload) => {
    const tab = findTerminalTabByRuntimeId(payload?.terminalId);
    if (!tab || typeof payload?.data !== 'string') return;
    tab.output = trimTerminalOutput((tab.output || '') + payload.data);
    tab.connected = true;
    saveState(codeState);
    const instance = terminalInstances.get(tab.id);
    if (instance) instance.term.write(payload.data);
  });

  onSSE('terminal.exit', (payload) => {
    const tab = findTerminalTabByRuntimeId(payload?.terminalId);
    if (!tab) return;
    tab.connected = false;
    tab.runtimeTerminalId = null;
    const exitCode = Number.isInteger(payload?.exitCode) ? payload.exitCode : 'unknown';
    tab.output = trimTerminalOutput(`${tab.output || ''}\n[process exited ${exitCode}]\n`);
    saveState(codeState);
    const instance = terminalInstances.get(tab.id);
    if (instance) {
      instance.term.write(`\r\n[process exited ${exitCode}]\r\n`);
    }
    scheduleTerminalRender();
  });
}

function findTerminalTabByRuntimeId(runtimeTerminalId) {
  if (!runtimeTerminalId) return null;
  for (const session of codeState.sessions) {
    const tab = (session.terminalTabs || []).find((candidate) => candidate.runtimeTerminalId === runtimeTerminalId);
    if (tab) return tab;
  }
  return null;
}

function scheduleTerminalRender() {
  if (terminalRenderTimer) return;
  terminalRenderTimer = setTimeout(() => {
    terminalRenderTimer = null;
    rerenderFromState();
  }, 40);
}

function trimTerminalOutput(text) {
  const MAX_CHARS = 120000;
  return text.length > MAX_CHARS ? text.slice(text.length - MAX_CHARS) : text;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function humanizeToolName(toolName) {
  return String(toolName || '')
    .replace(/^code_/, '')
    .replace(/^fs_/, 'file ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatRelativeTime(timestamp) {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return '';
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
  const deltaMinutes = Math.floor(deltaSeconds / 60);
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h ago`;
  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}d ago`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isApprovalNotFoundMessage(value) {
  return /approval\s+'[^']+'\s+not\s+found/i.test(String(value || ''));
}

function getApprovalBacklogState(session) {
  const count = Array.isArray(session?.pendingApprovals) ? session.pendingApprovals.length : 0;
  return {
    count,
    blocked: count >= APPROVAL_BACKLOG_SOFT_CAP,
  };
}

function isSessionJob(job, session) {
  return !!job
    && job.userId === buildUserId(session)
    && job.channel === DEFAULT_USER_CHANNEL;
}

function isCodeAssistantJob(job) {
  const toolName = String(job?.toolName || '').trim();
  return toolName.startsWith('code_')
    || toolName === 'find_tools'
    || toolName.startsWith('fs_')
    || toolName === 'shell_safe';
}

function isVerificationJob(job) {
  const toolName = String(job?.toolName || '').trim();
  return toolName === 'code_test'
    || toolName === 'code_lint'
    || toolName === 'code_build'
    || !!job?.verificationStatus
    || job?.status === 'failed';
}

function mapTaskStatus(job) {
  if (!job) return 'info';
  if (job.status === 'pending_approval') return 'waiting';
  if (job.status === 'failed' || job.status === 'denied') return 'blocked';
  if (job.status === 'running') return 'active';
  if (job.status === 'succeeded') return 'completed';
  return 'info';
}

function mapCheckStatus(job) {
  if (!job) return 'info';
  if (job.status === 'failed' || job.status === 'denied') return 'fail';
  if (job.verificationStatus === 'verified') return 'pass';
  if (job.status === 'pending_approval') return 'warn';
  if (job.verificationStatus === 'unverified') return 'warn';
  if (job.status === 'succeeded') return 'warn';
  return 'info';
}

function summarizeJobDetail(job) {
  if (!job) return '';
  if (job.status === 'pending_approval') return 'Waiting for your approval before execution can continue.';
  if (job.status === 'failed' || job.status === 'denied') return job.error || 'This step did not complete successfully.';
  if (job.verificationEvidence) return job.verificationEvidence;
  if (job.resultPreview) return job.resultPreview;
  if (job.argsPreview) return job.argsPreview;
  return `${humanizeToolName(job.toolName)} ${job.status || 'updated'}.`;
}

function summarizeTaskTitle(job) {
  if (!job) return 'Recent activity';
  if (job.status === 'pending_approval') return `${humanizeToolName(job.toolName)} is waiting for approval`;
  if (job.status === 'failed') return `${humanizeToolName(job.toolName)} failed`;
  if (job.status === 'denied') return `${humanizeToolName(job.toolName)} was denied`;
  if (job.status === 'succeeded') return `${humanizeToolName(job.toolName)} completed`;
  return `${humanizeToolName(job.toolName)} is in progress`;
}

function deriveTaskItems(session) {
  const items = [];
  const backlog = getApprovalBacklogState(session);
  const recentJobs = Array.isArray(session?.recentJobs) ? session.recentJobs.filter(isCodeAssistantJob) : [];

  if (backlog.count > 0) {
    items.push({
      id: 'pending-approvals',
      title: backlog.blocked
        ? `Approval backlog is full (${backlog.count})`
        : `${backlog.count} ${pluralize(backlog.count, 'approval')} waiting`,
      status: backlog.blocked ? 'blocked' : 'waiting',
      detail: backlog.blocked
        ? 'New write actions are paused until you clear some approvals.'
        : 'A mutating step is paused until you approve or deny it.',
    });
  }

  if (session?.planSummary) {
    items.push({
      id: 'active-plan',
      title: 'Active plan',
      status: 'info',
      detail: session.planSummary,
    });
  }

  recentJobs.slice(0, 4).forEach((job) => {
    items.push({
      id: job.id,
      title: summarizeTaskTitle(job),
      status: mapTaskStatus(job),
      detail: summarizeJobDetail(job),
      meta: formatRelativeTime(job.createdAt),
    });
  });

  return items;
}

function deriveCheckItems(session) {
  const jobs = Array.isArray(session?.recentJobs)
    ? session.recentJobs.filter(isVerificationJob).slice(0, 8)
    : [];
  return jobs.map((job) => ({
    id: job.id,
    title: humanizeToolName(job.toolName),
    status: mapCheckStatus(job),
    detail: summarizeJobDetail(job),
    meta: formatRelativeTime(job.createdAt),
  }));
}

function getTaskBadgeCount(session) {
  return deriveTaskItems(session).filter((item) => item.status !== 'completed').length;
}

function getCheckBadgeCount(session) {
  return deriveCheckItems(session).filter((item) => item.status !== 'pass' && item.status !== 'info').length;
}

function normalizePendingApprovals(values, existing = []) {
  const previousById = new Map(
    (Array.isArray(existing) ? existing : [])
      .filter((entry) => entry && typeof entry.id === 'string')
      .map((entry) => [entry.id, entry]),
  );
  return Array.isArray(values)
    ? values
      .filter((entry) => entry && typeof entry.id === 'string')
      .map((entry) => {
        const previous = previousById.get(entry.id) || {};
        return {
          id: entry.id,
          toolName: String(entry.toolName || previous.toolName || 'unknown'),
          argsPreview: String(entry.argsPreview || previous.argsPreview || ''),
          createdAt: Number(entry.createdAt || previous.createdAt) || null,
          risk: String(entry.risk || previous.risk || ''),
          origin: String(entry.origin || previous.origin || ''),
        };
      })
    : [];
}

function disposeTerminalInstance(tabId) {
  const instance = terminalInstances.get(tabId);
  if (!instance) return;
  instance.resizeObserver?.disconnect?.();
  instance.term.dispose();
  terminalInstances.delete(tabId);
}

function disposeInactiveTerminalInstances(activeTabs) {
  const keep = new Set((activeTabs || []).map((tab) => tab.id));
  for (const tabId of Array.from(terminalInstances.keys())) {
    if (!keep.has(tabId)) {
      disposeTerminalInstance(tabId);
    }
  }
}

async function mountActiveTerminals(container, session) {
  const tabs = session?.terminalTabs || [];
  disposeInactiveTerminalInstances(tabs);
  if (tabs.length === 0) return;
  const { Terminal, FitAddon } = await loadTerminalLib();
  for (const tab of tabs) {
    const host = container.querySelector(`[data-terminal-viewport="${tab.id}"]`);
    if (!host) {
      disposeTerminalInstance(tab.id);
      continue;
    }
    const existing = terminalInstances.get(tab.id);
    if (existing?.host === host) {
      existing.fitAddon.fit();
      continue;
    }
    disposeTerminalInstance(tab.id);
    host.innerHTML = '';
    const term = new Terminal({
      cursorBlink: true,
      convertEol: false,
      fontFamily: 'Consolas, "Cascadia Mono", "Courier New", monospace',
      fontSize: 13,
      theme: {
        background: '#0b1220',
        foreground: '#e5edf7',
        cursor: '#f8fafc',
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(host);
    fitAddon.fit();
    if (tab.output) {
      term.write(tab.output);
    }
    term.attachCustomKeyEventHandler((event) => {
      const isCopy = event.type === 'keydown' && event.key.toLowerCase() === 'c' && (event.ctrlKey || event.metaKey);
      if (isCopy && term.hasSelection()) {
        void copyTextToClipboard(term.getSelection());
        term.clearSelection();
        event.preventDefault();
        return false;
      }
      return true;
    });
    term.onData((data) => {
      if (!tab.runtimeTerminalId) return;
      api.codeTerminalInput(tab.runtimeTerminalId, { input: data }).catch(() => {});
    });
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (tab.runtimeTerminalId) {
        api.codeTerminalResize(tab.runtimeTerminalId, {
          cols: term.cols,
          rows: term.rows,
        }).catch(() => {});
      }
    });
    resizeObserver.observe(host);
    host.addEventListener('click', () => term.focus());
    term.focus();
    if (tab.runtimeTerminalId) {
      api.codeTerminalResize(tab.runtimeTerminalId, {
        cols: term.cols,
        rows: term.rows,
      }).catch(() => {});
    }
    terminalInstances.set(tab.id, { term, fitAddon, resizeObserver, host });
  }
}

// ─── Render pipeline ──────────────────────────────────────

export async function renderCode(container) {
  if (renderInFlight) return;
  renderInFlight = true;
  currentContainer = container;
  bindTerminalListeners();

  if (!hasRenderedOnce) {
    container.innerHTML = '<div class="loading" style="padding:2rem">Loading coding workspace...</div>';
  }

  try {
    const [agents, statusResult] = await Promise.all([
      api.agents().catch(() => []),
      api.status().catch(() => null),
    ]);
    cachedAgents = agents.filter((agent) => agent.canChat !== false);
    if (statusResult?.platform) detectedPlatform = statusResult.platform;
    if (Array.isArray(statusResult?.shellOptions)) shellOptionsCache = statusResult.shellOptions;

    codeState = normalizeState(codeState, cachedAgents);
    saveState(codeState);

    const activeSession = getActiveSession();
    if (activeSession) {
      // Load root tree dir if not cached
      const rootPath = activeSession.resolvedRoot || activeSession.workspaceRoot || '.';
      if (!treeCache.has(rootPath)) {
        const rootData = await loadTreeDir(activeSession, rootPath);
        treeCache.set(rootPath, rootData);
        if (!activeSession.resolvedRoot && rootData.resolvedPath) {
          activeSession.resolvedRoot = rootData.resolvedPath;
        }
      }
      // Load expanded dirs
      await loadExpandedDirs(activeSession);
      cachedFileView = await loadFileView(activeSession);
      await ensureSessionTerminals(activeSession);
      await refreshAssistantState(activeSession, { rerender: false });
      saveState(codeState);
    } else {
      cachedFileView = { source: '', diff: '', error: null };
    }

    renderDOM(container);
    hasRenderedOnce = true;
  } catch (err) {
    container.innerHTML = `<div class="loading" style="padding:2rem">Error: ${esc(err instanceof Error ? err.message : String(err))}</div>`;
  } finally {
    renderInFlight = false;
  }
}

export function updateCode() {
  // No-op: Code page manages its own state; SSE invalidation is disabled for this route.
}

function rerenderFromState() {
  if (!currentContainer) return;
  renderDOM(currentContainer);
  const activeSession = getActiveSession();
  if (activeSession) {
    void ensureSessionTerminals(activeSession);
  }
}

function saveScrollPositions(container) {
  const positions = {};
  for (const sel of SCROLL_SELECTORS) {
    const el = container.querySelector(sel);
    if (el) positions[sel] = el.scrollTop;
  }
  return positions;
}

function restoreScrollPositions(container, positions) {
  for (const [sel, top] of Object.entries(positions)) {
    const el = container.querySelector(sel);
    if (el) el.scrollTop = top;
  }
}

function scrollToBottom(container, selector) {
  const el = container.querySelector(selector);
  if (el) el.scrollTop = el.scrollHeight;
}

async function ensureSessionTerminals(session) {
  if (!session?.terminalTabs?.length) return;
  await Promise.all(session.terminalTabs.map((tab) => ensureTerminalConnected(session, tab)));
}

async function ensureTerminalConnected(session, tab) {
  if (!tab || tab.runtimeTerminalId || tab.connecting || tab.openFailed) return;
  tab.connecting = true;
  if (!tab.output) {
    tab.output = 'Connecting to terminal...\n';
  }
  saveState(codeState);
  try {
    const result = await api.codeTerminalOpen({
      cwd: session.resolvedRoot || session.workspaceRoot,
      shell: tab.shell || getDefaultShell(),
      cols: 120,
      rows: 30,
    });
    tab.runtimeTerminalId = result?.terminalId || null;
    tab.connected = !!tab.runtimeTerminalId;
    tab.openFailed = false;
    if (tab.output === 'Connecting to terminal...\n') {
      tab.output = '';
    }
  } catch (err) {
    tab.connected = false;
    tab.runtimeTerminalId = null;
    tab.openFailed = true;
    tab.output = trimTerminalOutput(`${tab.output || ''}\n[terminal error: ${err instanceof Error ? err.message : String(err)}]\n`);
  } finally {
    tab.connecting = false;
    saveState(codeState);
  }
}

async function closeTerminal(tab) {
  if (!tab?.runtimeTerminalId) return;
  try {
    await api.codeTerminalClose(tab.runtimeTerminalId);
  } catch {
    // Best effort close.
  }
  tab.runtimeTerminalId = null;
  tab.connected = false;
  tab.openFailed = false;
}

function renderDOM(container) {
  const saved = saveScrollPositions(container);
  const activeSession = getActiveSession();
  const fileView = cachedFileView;

  const editorContent = activeSession?.selectedFilePath
    ? (activeSession.showDiff
      ? `<div class="code-editor__split">
          <div class="code-editor__pane">
            <div class="code-editor__pane-label">Source</div>
            <pre class="code-editor__content">${esc(fileView.source || 'Empty file.')}</pre>
          </div>
          <div class="code-editor__pane">
            <div class="code-editor__pane-label">Diff</div>
            <pre class="code-editor__content">${esc(fileView.diff || 'No diff output for this file.')}</pre>
          </div>
        </div>`
      : `<pre class="code-editor__content">${esc(fileView.source || 'Empty file.')}</pre>`)
    : '';

  const isCollapsed = activeSession?.terminalCollapsed;
  const terminalPanes = activeSession ? getVisibleTerminalPanes(activeSession) : [];

  container.innerHTML = `
    <div class="code-page">
      <div class="code-page__shell">
        <aside class="code-rail">
          <div class="code-rail__header">
            <h3>Sessions</h3>
            <button class="btn btn-primary btn-sm" type="button" data-code-new-session>+</button>
          </div>
          ${renderSessionForm()}
          <div class="code-rail__list">
            ${codeState.sessions.map((session) => renderSessionCard(session)).join('')}
          </div>
        </aside>
        <section class="code-workspace">
          <div class="code-workspace__main ${isCollapsed ? 'terminals-collapsed' : ''}">
            <section class="code-explorer panel">
              <div class="panel__header">
                <h3>Explorer <span class="code-tooltip-icon" title="Browse workspace files. Expand folders in the tree, click files to view source.">&#9432;</span></h3>
                ${activeSession ? `
                  <div class="panel__actions">
                    <button class="btn btn-secondary btn-sm" type="button" data-code-refresh-explorer title="Reload directory tree">&#x21BB;</button>
                  </div>
                ` : ''}
              </div>
              ${activeSession ? `
                <div class="code-file-list">
                  ${renderTree(activeSession.resolvedRoot || activeSession.workspaceRoot || '.', activeSession)}
                </div>
              ` : '<div class="empty-state">Create a session to browse.</div>'}
            </section>
            <section class="code-editor panel">
              <div class="panel__header">
                <h3>${activeSession?.selectedFilePath ? esc(basename(activeSession.selectedFilePath)) : 'Editor'} <span class="code-tooltip-icon" title="View file source and git diffs. Click a file in the Explorer to open it. Use Split Diff to compare source and changes side by side.">&#9432;</span></h3>
                ${activeSession?.selectedFilePath ? `
                  <div class="panel__actions">
                    <button class="btn btn-secondary btn-sm" type="button" data-code-refresh-file title="Reload file contents">&#x21BB;</button>
                    <button class="btn btn-secondary btn-sm" type="button" data-code-toggle-diff title="Toggle side-by-side source and diff view">${activeSession.showDiff ? 'Source Only' : 'Split Diff'}</button>
                  </div>
                ` : ''}
              </div>
              ${activeSession?.selectedFilePath ? `
                <div class="code-path">${esc(activeSession.selectedFilePath)}</div>
                ${fileView.error ? `<div class="code-error">${esc(fileView.error)}</div>` : ''}
                ${editorContent}
              ` : '<div class="empty-state">Select a file to inspect.</div>'}
            </section>
            <section class="code-terminals panel ${isCollapsed ? 'is-collapsed' : ''}">
              <div class="panel__header">
                <h3>Terminal <span class="code-tooltip-icon" title="Direct shell access from the selected workspace. This is a command-based terminal surface backed by your chosen shell.">&#9432;</span></h3>
                ${activeSession ? `
                  <div class="panel__actions">
                    <button class="btn btn-secondary btn-sm" type="button" data-code-toggle-terminal-collapse title="${isCollapsed ? 'Expand' : 'Collapse'} terminal panel">${isCollapsed ? '&#x25B2;' : '&#x25BC;'}</button>
                    ${!isCollapsed && terminalPanes.length < MAX_TERMINAL_PANES ? `
                      <button class="btn btn-secondary btn-sm" type="button" data-code-new-terminal title="Add terminal pane (max ${MAX_TERMINAL_PANES})">+ Terminal</button>
                    ` : ''}
                  </div>
                ` : ''}
              </div>
              ${!isCollapsed && activeSession ? `
                <div class="code-terminal-panes" style="grid-template-columns: repeat(${terminalPanes.length}, 1fr)">
                  ${terminalPanes.map((tab) => renderTerminalPane(activeSession, tab)).join('')}
                </div>
              ` : (!activeSession ? '<div class="empty-state">Create a session to open terminals.</div>' : '')}
            </section>
          </div>
          <aside class="code-chat panel">
            <div class="panel__header">
              <h3>Assistant</h3>
              ${activeSession ? `
                <div class="panel__actions">
                  <button class="btn btn-secondary btn-sm" type="button" data-code-reset-chat title="Clear conversation and start fresh">Reset</button>
                </div>
              ` : ''}
            </div>
            ${activeSession ? `
              ${renderAssistantTabs(activeSession)}
              ${renderAssistantPanel(activeSession)}
            ` : '<div class="empty-state">Create a session to start chatting.</div>'}
          </aside>
        </section>
      </div>
    </div>
  `;

  bindEvents(container);
  restoreScrollPositions(container, saved);
  if (activeSession) {
    void mountActiveTerminals(container, activeSession);
  } else {
    disposeInactiveTerminalInstances([]);
  }
}

// ─── Tree Explorer ─────────────────────────────────────────

function renderTree(rootPath, session) {
  const cached = treeCache.get(rootPath);
  if (!cached) return '<div class="empty-inline">Loading...</div>';
  if (cached.error) return `<div class="code-error">${esc(cached.error)}</div>`;
  if (!cached.entries || cached.entries.length === 0) return '<div class="empty-inline">Empty directory.</div>';
  return renderTreeEntries(rootPath, cached.entries, 0, session);
}

function renderTreeEntries(basePath, entries, depth, session) {
  const expandedDirs = session.expandedDirs || [];
  // Sort: dirs first, then files, alphabetical
  const sorted = [...entries].sort((a, b) => {
    if (a.type === 'dir' && b.type !== 'dir') return -1;
    if (a.type !== 'dir' && b.type === 'dir') return 1;
    return a.name.localeCompare(b.name);
  });

  return sorted.map((entry) => {
    const fullPath = joinWorkspacePath(basePath, entry.name);
    const indent = depth * 16;

    if (entry.type === 'dir') {
      const isExpanded = expandedDirs.includes(fullPath);
      const chevronClass = isExpanded ? 'is-expanded' : '';
      let children = '';
      if (isExpanded) {
        const childCache = treeCache.get(fullPath);
        if (childCache && !childCache.error && childCache.entries) {
          children = renderTreeEntries(fullPath, childCache.entries, depth + 1, session);
        } else if (childCache?.error) {
          children = `<div class="code-tree-row" style="padding-left:${(depth + 1) * 16}px"><span class="code-error" style="font-size:0.7rem">${esc(childCache.error)}</span></div>`;
        } else {
          children = `<div class="code-tree-row" style="padding-left:${(depth + 1) * 16}px"><span class="text-muted" style="font-size:0.7rem">Loading...</span></div>`;
        }
      }
      return `<button class="code-tree-row is-dir" type="button" data-code-tree-toggle="${escAttr(fullPath)}" style="padding-left:${indent}px">
        <span class="code-tree-chevron ${chevronClass}">&#x25B6;</span>
        <span class="code-tree-icon">&#128193;</span>
        <span class="code-tree-name">${esc(entry.name)}</span>
      </button>${children}`;
    }

    return `<button class="code-tree-row" type="button" data-code-tree-file="${escAttr(fullPath)}" style="padding-left:${indent}px">
      <span class="code-tree-icon">&#128196;</span>
      <span class="code-tree-name">${esc(entry.name)}</span>
    </button>`;
  }).join('');
}

async function loadTreeDir(session, dirPath) {
  const result = await api.codeFsList({
    path: dirPath,
  }).catch((err) => ({ success: false, error: err.message }));

  if (!result?.success) {
    return { entries: [], error: result?.message || result?.error || 'Failed to list directory.', resolvedPath: dirPath };
  }

  return {
    entries: Array.isArray(result.entries) ? result.entries : [],
    error: null,
    resolvedPath: result.path || dirPath,
  };
}

async function loadExpandedDirs(session) {
  const expandedDirs = session.expandedDirs || [];
  const missing = expandedDirs.filter((dir) => !treeCache.has(dir));
  if (missing.length === 0) return;
  const results = await Promise.all(missing.map((dir) => loadTreeDir(session, dir)));
  results.forEach((result, i) => treeCache.set(missing[i], result));
}

// ─── Directory Picker ──────────────────────────────────────

function renderDirPicker() {
  if (!codeState.dirPickerOpen) return '';
  const path = codeState.dirPickerPath || '/';
  const entries = codeState.dirPickerEntries || [];
  const error = codeState.dirPickerError || '';
  const loading = codeState.dirPickerLoading;

  return `
    <div class="code-dir-picker">
      <div class="code-dir-picker__path">${esc(path)}</div>
      ${error ? `<div class="code-error">${esc(error)}</div>` : ''}
      <div class="code-dir-picker__list">
        ${path !== '/' ? `<button class="code-dir-picker__entry" type="button" data-code-dirpick-navigate="${escAttr(parentPath(path))}">..</button>` : ''}
        ${loading ? '<div class="empty-inline">Loading...</div>' : entries.filter((e) => e.type === 'dir').map((e) => `
          <button class="code-dir-picker__entry" type="button" data-code-dirpick-navigate="${escAttr(joinWorkspacePath(path, e.name))}">${esc(e.name)}</button>
        `).join('') || '<div class="empty-inline">No subdirectories.</div>'}
      </div>
      <div class="code-dir-picker__actions">
        <button class="btn btn-primary btn-sm" type="button" data-code-dirpick-select>Select</button>
        <button class="btn btn-secondary btn-sm" type="button" data-code-dirpick-cancel>Cancel</button>
      </div>
    </div>
  `;
}

async function openDirPicker(startPath) {
  codeState.dirPickerOpen = true;
  codeState.dirPickerPath = startPath || '/';
  codeState.dirPickerEntries = [];
  codeState.dirPickerError = '';
  codeState.dirPickerLoading = true;
  saveState(codeState);
  rerenderFromState();
  await navigateDirPicker(codeState.dirPickerPath);
}

async function navigateDirPicker(dirPath) {
  codeState.dirPickerPath = dirPath;
  codeState.dirPickerLoading = true;
  codeState.dirPickerError = '';
  saveState(codeState);
  rerenderFromState();

  const result = await api.codeFsList({
    path: dirPath,
  }).catch((err) => ({ success: false, error: err.message }));

  if (!result?.success) {
    codeState.dirPickerError = result?.message || 'Failed to list directory.';
    codeState.dirPickerEntries = [];
  } else {
    codeState.dirPickerPath = result.path || dirPath;
    codeState.dirPickerEntries = Array.isArray(result.entries) ? result.entries : [];
    codeState.dirPickerError = '';
  }
  codeState.dirPickerLoading = false;
  saveState(codeState);
  rerenderFromState();
}

function closeDirPicker() {
  codeState.dirPickerOpen = false;
  codeState.dirPickerPath = '';
  codeState.dirPickerEntries = [];
  codeState.dirPickerError = '';
  codeState.dirPickerLoading = false;
  saveState(codeState);
  rerenderFromState();
}

// ─── Terminal rendering ────────────────────────────────────

function getVisibleTerminalPanes(session) {
  return session.terminalTabs || [];
}

function renderTerminalPane(session, tab) {
  const shellOptions = getShellOptions();
  const currentShell = tab.shell || getDefaultShell();
  const selectedShell = getShellOption(currentShell);
  const cwd = session.resolvedRoot || session.workspaceRoot;

  return `
    <div class="code-terminal-pane" data-pane-id="${escAttr(tab.id)}">
      <div class="code-terminal-pane__header">
        <span class="code-terminal-pane__name">${esc(tab.name)}</span>
        <span class="code-terminal-pane__badge">${tab.connected ? 'connected' : tab.connecting ? 'connecting' : tab.openFailed ? 'error' : 'disconnected'}</span>
        <select class="code-terminal-pane__shell" data-code-shell-select="${escAttr(tab.id)}">
          ${shellOptions.map((option) => `<option value="${escAttr(option.id)}"${option.id === currentShell ? ' selected' : ''}>${esc(option.label)}</option>`).join('')}
        </select>
        <button class="code-terminal-pane__close" type="button" data-code-close-terminal="${escAttr(tab.id)}" title="Close pane">&times;</button>
      </div>
      <div class="code-terminal__toolbar">
        <span class="code-terminal__meta">shell: ${esc(selectedShell?.detail || currentShell)}</span>
        <span class="code-terminal__meta">cwd: ${esc(cwd)}</span>
      </div>
      <div class="code-terminal__viewport" data-terminal-viewport="${escAttr(tab.id)}"></div>
    </div>
  `;
}

function renderAssistantTabs(session) {
  const approvalCount = Array.isArray(session?.pendingApprovals) ? session.pendingApprovals.length : 0;
  const taskCount = getTaskBadgeCount(session);
  const checkCount = getCheckBadgeCount(session);
  const counts = {
    chat: 0,
    tasks: taskCount,
    approvals: approvalCount,
    checks: checkCount,
  };

  return `
    <div class="code-assistant-tabs" role="tablist" aria-label="Coding assistant views">
      ${ASSISTANT_TABS.map((tabId) => {
        const label = tabId.charAt(0).toUpperCase() + tabId.slice(1);
        const isActive = (session?.activeAssistantTab || 'chat') === tabId;
        const count = counts[tabId] || 0;
        return `
          <button
            class="code-assistant-tab ${isActive ? 'is-active' : ''}"
            type="button"
            role="tab"
            aria-selected="${isActive ? 'true' : 'false'}"
            data-code-assistant-tab="${escAttr(tabId)}"
          >
            <span>${label}</span>
            ${count > 0 ? `<span class="code-assistant-tab__badge">${count}</span>` : ''}
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderChatNotice(session) {
  const backlog = getApprovalBacklogState(session);
  if (backlog.count === 0) return '';
  const copy = backlog.blocked
    ? `Too many approvals are waiting. New code changes are paused until you clear some of them.`
    : `${backlog.count} ${pluralize(backlog.count, 'approval')} ${backlog.count === 1 ? 'is' : 'are'} waiting for your decision.`;
  return `
    <div class="code-chat__notice ${backlog.blocked ? 'is-warning' : ''}">
      <span>${esc(copy)}</span>
      <button class="btn btn-secondary btn-sm" type="button" data-code-switch-tab="approvals">Review approvals</button>
    </div>
  `;
}

function renderTaskList(session) {
  const items = deriveTaskItems(session);
  if (items.length === 0) {
    return '<div class="empty-state">No tracked coding work yet. Active plans, paused steps, and recent coding actions will appear here.</div>';
  }
  return `
    <div class="code-status-list">
      ${items.map((item) => `
        <article class="code-status-card status-${escAttr(item.status)}">
          <div class="code-status-card__top">
            <strong>${esc(item.title)}</strong>
            ${item.meta ? `<span class="code-status-card__meta">${esc(item.meta)}</span>` : ''}
          </div>
          <div class="code-status-card__detail">${esc(item.detail || '')}</div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderApprovalList(session) {
  const approvals = Array.isArray(session?.pendingApprovals) ? session.pendingApprovals : [];
  const backlog = getApprovalBacklogState(session);
  const warning = backlog.blocked
    ? `<div class="code-tab-banner is-warning">New write actions are paused until some approvals are cleared.</div>`
    : '';
  if (approvals.length === 0) {
    return `${warning}<div class="empty-state">No approvals are waiting for this coding session.</div>`;
  }
  return `
    ${warning}
    <div class="code-status-list">
      ${approvals.map((approval) => `
        <article class="approval-card">
          <div class="approval-card__header">
            <div>
              <div class="approval-card__title">${esc(humanizeToolName(approval.toolName))}</div>
              <div class="approval-card__meta">
                ${approval.createdAt ? esc(formatRelativeTime(approval.createdAt)) : ''}
                ${approval.risk ? ` • ${esc(approval.risk)}` : ''}
                ${approval.origin ? ` • ${esc(approval.origin)}` : ''}
              </div>
            </div>
          </div>
          <div class="approval-card__preview">${esc(approval.argsPreview || 'No preview available.')}</div>
          <div class="approval-card__actions">
            <button class="btn btn-secondary btn-sm" type="button" data-code-approval-id="${escAttr(approval.id)}" data-code-approval-decision="approved">Approve</button>
            <button class="btn btn-secondary btn-sm" type="button" data-code-approval-id="${escAttr(approval.id)}" data-code-approval-decision="denied">Deny</button>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderCheckList(session) {
  const items = deriveCheckItems(session);
  if (items.length === 0) {
    return '<div class="empty-state">Verification results will appear here when coding checks or tool verification runs complete.</div>';
  }
  return `
    <div class="code-status-list">
      ${items.map((item) => `
        <article class="code-status-card status-${escAttr(item.status)}">
          <div class="code-status-card__top">
            <strong>${esc(item.title)}</strong>
            ${item.meta ? `<span class="code-status-card__meta">${esc(item.meta)}</span>` : ''}
          </div>
          <div class="code-status-card__detail">${esc(item.detail || '')}</div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderAssistantPanel(session) {
  const activeTab = session?.activeAssistantTab || 'chat';
  switch (activeTab) {
    case 'tasks':
      return `
        <div class="code-assistant-panel__body">
          <div class="code-chat__meta">
            <div class="code-chat__workspace">${esc(session.resolvedRoot || session.workspaceRoot)}</div>
          </div>
          <div class="code-assistant-panel__scroll">
            ${renderTaskList(session)}
          </div>
        </div>
      `;
    case 'approvals':
      return `
        <div class="code-assistant-panel__body">
          <div class="code-chat__meta">
            <div class="code-chat__workspace">${esc(session.resolvedRoot || session.workspaceRoot)}</div>
          </div>
          <div class="code-assistant-panel__scroll">
            ${renderApprovalList(session)}
          </div>
        </div>
      `;
    case 'checks':
      return `
        <div class="code-assistant-panel__body">
          <div class="code-chat__meta">
            <div class="code-chat__workspace">${esc(session.resolvedRoot || session.workspaceRoot)}</div>
          </div>
          <div class="code-assistant-panel__scroll">
            ${renderCheckList(session)}
          </div>
        </div>
      `;
    case 'chat':
    default:
      return `
        <div class="code-chat__meta">
          <div class="code-chat__workspace">${esc(session.resolvedRoot || session.workspaceRoot)}</div>
        </div>
        ${renderChatNotice(session)}
        <div class="code-chat__history">
          ${session.chat.length === 0
            ? `<div class="code-chat__onboarding">
                <div class="code-chat__onboarding-title">Getting Started</div>
                <ul class="code-chat__onboarding-list">
                  <li>Describe a bug, feature, or refactor in plain language</li>
                  <li>The agent reads files, edits code, and runs commands</li>
                  <li>Mutating actions go through Guardian approval automatically</li>
                  <li>Coding tools are built in &mdash; just describe what you need</li>
                </ul>
              </div>`
            : session.chat.map((message) => `
              <div class="code-message ${message.role === 'user' ? 'is-user' : message.role === 'error' ? 'is-error' : 'is-agent'}">
                <div class="code-message__role">${esc(message.role)}</div>
                <div class="code-message__body">${esc(message.content)}</div>
              </div>
            `).join('')}
        </div>
        <form class="code-chat__form" data-code-chat-form>
          <textarea name="message" rows="3" placeholder="Describe the change, bug, or refactor you want.">${esc(session.chatDraft || '')}</textarea>
          <button class="btn btn-primary" type="submit">Send</button>
        </form>
      `;
  }
}

// ─── Session card rendering ────────────────────────────────

function renderSessionForm() {
  const isCreate = codeState.showCreateForm;
  const isEdit = !!codeState.editingSessionId;
  if (!isCreate && !isEdit) return '';

  const draft = isEdit ? codeState.editDraft || {} : codeState.createDraft || {};
  const formId = isEdit ? 'data-code-edit-session-form' : 'data-code-session-form';
  const submitLabel = isEdit ? 'Save' : 'Create';
  const cancelAttr = isEdit ? 'data-code-cancel-edit' : 'data-code-cancel-create';

  return `
    <form class="code-session-form is-visible" ${formId}>
      <label>
        Title
        <input name="title" type="text" value="${escAttr(draft.title || '')}" placeholder="Frontend app">
      </label>
      <label>
        Workspace Root
        <div style="display:flex;gap:0.5rem;align-items:center">
          <input name="workspaceRoot" type="text" value="${escAttr(draft.workspaceRoot || '.')}" placeholder=". or /path/to/project" style="flex:1">
          <button class="btn btn-secondary btn-sm" type="button" data-code-browse-dir>Browse</button>
        </div>
      </label>
      ${renderDirPicker()}
      ${!isEdit ? `
        <label>
          Agent
          <select name="agentId">
            <option value="">Guardian Auto</option>
            ${cachedAgents.map((agent) => `<option value="${escAttr(agent.id)}"${draft.agentId === agent.id ? ' selected' : ''}>${esc(agent.name)} (${esc(agent.id)})</option>`).join('')}
          </select>
        </label>
      ` : ''}
      <div class="code-session-form__actions">
        <button class="btn btn-primary btn-sm" type="submit">${submitLabel}</button>
        <button class="btn btn-secondary btn-sm" type="button" ${cancelAttr}>Cancel</button>
      </div>
    </form>
  `;
}

function renderSessionCard(session) {
  const isActive = session.id === codeState.activeSessionId;
  const approvalCount = Array.isArray(session.pendingApprovals) ? session.pendingApprovals.length : 0;
  const checkCount = getCheckBadgeCount(session);
  const taskCount = getTaskBadgeCount(session);
  return `
    <button class="code-session ${isActive ? 'is-active' : ''}" type="button" data-code-session-id="${escAttr(session.id)}">
      <div class="code-session__top">
        <strong>${esc(session.title)}</strong>
        <span style="display:flex;gap:0.4rem;align-items:center">
          <span class="code-session__edit" data-code-edit-session="${escAttr(session.id)}" title="Edit session">&#9998;</span>
          <span class="code-session__delete" data-code-delete-session="${escAttr(session.id)}">&times;</span>
        </span>
      </div>
      <div class="code-session__meta">${esc(session.workspaceRoot)}</div>
      <div class="code-session__badges">
        ${approvalCount > 0 ? `<span class="badge badge-warn">${approvalCount} ${approvalCount === 1 ? 'approval' : 'approvals'}</span>` : ''}
        ${taskCount > 0 ? `<span class="badge badge-idle">${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}</span>` : ''}
        ${checkCount > 0 ? `<span class="badge badge-info">${checkCount} ${checkCount === 1 ? 'check' : 'checks'}</span>` : ''}
      </div>
    </button>
  `;
}

// ─── Async data refresh helpers ────────────────────────────

async function refreshTree(session) {
  const rootPath = session.resolvedRoot || session.workspaceRoot || '.';
  treeCache.clear();
  const rootData = await loadTreeDir(session, rootPath);
  treeCache.set(rootPath, rootData);
  if (!session.resolvedRoot && rootData.resolvedPath) {
    session.resolvedRoot = rootData.resolvedPath;
  }
  await loadExpandedDirs(session);
  saveState(codeState);
  rerenderFromState();
}

async function refreshFileView(session) {
  cachedFileView = await loadFileView(session);
  rerenderFromState();
}

async function refreshSessionData(session) {
  const rootPath = session.resolvedRoot || session.workspaceRoot || '.';
  treeCache.clear();
  const [rootData, fileView] = await Promise.all([
    loadTreeDir(session, rootPath),
    loadFileView(session),
  ]);
  treeCache.set(rootPath, rootData);
  if (!session.resolvedRoot && rootData.resolvedPath) {
    session.resolvedRoot = rootData.resolvedPath;
  }
  cachedFileView = fileView;
  await loadExpandedDirs(session);
  await refreshAssistantState(session, { rerender: false });
  saveState(codeState);
  rerenderFromState();
}

// ─── API data loaders ──────────────────────────────────────

async function loadFileView(session) {
  if (!session.selectedFilePath) {
    return { source: '', diff: '', error: null };
  }

  const [sourceResult, diffResult] = await Promise.all([
    api.codeFsRead({
      path: session.selectedFilePath,
      maxBytes: 250000,
    }).catch((err) => ({ success: false, error: err.message })),
    api.codeGitDiff({
      cwd: session.resolvedRoot || session.workspaceRoot,
      path: toRelativePath(session.selectedFilePath, session.resolvedRoot || session.workspaceRoot),
    }).catch((err) => ({ success: false, error: err.message })),
  ]);

  return {
    source: sourceResult?.content || '',
    diff: diffResult?.stdout || diffResult?.stderr || '',
    error: sourceResult?.success ? null : (sourceResult?.message || sourceResult?.error || 'Failed to read file.'),
  };
}

async function loadAssistantState(session) {
  const userId = buildUserId(session);
  const [pendingResult, toolsState] = await Promise.all([
    api.pendingToolApprovals(userId, DEFAULT_USER_CHANNEL, 100).catch(() => []),
    api.toolsState(100).catch(() => ({ approvals: [], jobs: [] })),
  ]);

  const approvalsById = new Map(
    (Array.isArray(toolsState?.approvals) ? toolsState.approvals : [])
      .filter((approval) => approval && typeof approval.id === 'string')
      .map((approval) => [approval.id, approval]),
  );

  const pendingApprovals = normalizePendingApprovals(
    Array.isArray(pendingResult)
      ? pendingResult.map((approval) => ({
        ...approval,
        ...(approvalsById.get(approval.id) || {}),
      }))
      : [],
    session.pendingApprovals,
  );

  const recentJobs = (Array.isArray(toolsState?.jobs) ? toolsState.jobs : [])
    .filter((job) => isSessionJob(job, session))
    .slice(0, MAX_SESSION_JOBS);

  return {
    pendingApprovals,
    recentJobs,
  };
}

async function refreshAssistantState(session, { rerender = true, fallbackPendingApprovals = null } = {}) {
  if (!session) return;
  const nextState = await loadAssistantState(session);
  session.pendingApprovals = Array.isArray(nextState.pendingApprovals) && nextState.pendingApprovals.length > 0
    ? nextState.pendingApprovals
    : normalizePendingApprovals(fallbackPendingApprovals, session.pendingApprovals);
  session.recentJobs = nextState.recentJobs;
  saveState(codeState);
  if (rerender) rerenderFromState();
}

function appendChatMessage(session, role, content) {
  if (!session || !content) return;
  session.chat.push({ role, content });
}

async function decideCodeApprovalWithRetry(session, approvalId, decision) {
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const result = await api.decideToolApproval({ approvalId, decision, actor: buildUserId(session) });
      if (result?.success === false && isApprovalNotFoundMessage(result.message) && attempt < 4) {
        lastError = new Error(result.message);
      } else {
        return result;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (!isApprovalNotFoundMessage(lastError.message) || attempt >= 4) {
        throw lastError;
      }
    }

    await delay(250 * (attempt + 1));
    const refreshed = await loadAssistantState(session).catch(() => null);
    if (refreshed) {
      if (Array.isArray(refreshed.pendingApprovals) && refreshed.pendingApprovals.length > 0) {
        session.pendingApprovals = refreshed.pendingApprovals;
      }
      if (Array.isArray(refreshed.recentJobs)) {
        session.recentJobs = refreshed.recentJobs;
      }
      saveState(codeState);
    }
  }

  if (lastError) throw lastError;
  throw new Error(`Approval '${approvalId}' could not be processed.`);
}

async function handleCodeApprovalDecision(session, approvalIds, decision) {
  if (!session || !Array.isArray(approvalIds) || approvalIds.length === 0) return;

  const approvalResponses = [];
  let continuationPendingApprovals = null;
  for (const id of approvalIds) {
    try {
      const result = await decideCodeApprovalWithRetry(session, id, decision);
      approvalResponses.push(result);
    } catch (err) {
      approvalResponses.push({
        success: false,
        message: err instanceof Error ? err.message : String(err),
        continueConversation: false,
      });
    }
  }

  const immediateMessages = approvalResponses
    .map((result) => result.displayMessage)
    .filter((value) => typeof value === 'string' && value.trim().length > 0);
  const continuedResponses = approvalResponses
    .map((result) => result.continuedResponse)
    .filter((value) => value && typeof value.content === 'string');

  immediateMessages.forEach((message) => appendChatMessage(session, 'agent', message));
  continuedResponses.forEach((response) => appendChatMessage(session, 'agent', response.content));

  if (decision === 'approved' && continuedResponses.length === 0 && approvalResponses.some((result) => result.continueConversation !== false)) {
    const summary = approvalResponses
      .map((result) => result.success ? (result.message || 'approved') : `Failed: ${result.message || 'unknown error'}`)
      .join('; ');
    const continuationMessage = [
      '[Code Approval Continuation]',
      `[User approved the pending tool action(s). Result: ${summary}]`,
      'Please continue the original coding task and adjust if any approved action failed.',
    ].join('\n');
    try {
      const response = await api.sendMessage(
        buildCodePrompt(session, continuationMessage),
        session.agentId || undefined,
        buildUserId(session),
        DEFAULT_USER_CHANNEL,
        buildCodeMessageMetadata(session),
      );
      if (Array.isArray(response?.metadata?.activeSkills)) {
        session.activeSkills = response.metadata.activeSkills.map((value) => String(value));
      }
      const responsePendingApprovals = Array.isArray(response?.metadata?.pendingApprovals)
        ? response.metadata.pendingApprovals
        : null;
      if (responsePendingApprovals) {
        continuationPendingApprovals = responsePendingApprovals;
        session.pendingApprovals = normalizePendingApprovals(responsePendingApprovals, session.pendingApprovals);
      }
      appendChatMessage(session, 'agent', response.content || 'Approval processed.');
    } catch (err) {
      appendChatMessage(session, 'error', err instanceof Error ? err.message : String(err));
    }
  }

  await refreshAssistantState(session, {
    rerender: false,
    fallbackPendingApprovals: continuationPendingApprovals,
  });
  saveState(codeState);
  rerenderFromState();
  scrollToBottom(currentContainer, '.code-chat__history');
}

// ─── Event binding ─────────────────────────────────────────

function bindEvents(container) {
  // ── Session rail ──

  container.querySelector('[data-code-new-session]')?.addEventListener('click', () => {
    codeState.showCreateForm = true;
    codeState.editingSessionId = null;
    saveState(codeState);
    rerenderFromState();
  });

  container.querySelector('[data-code-cancel-create]')?.addEventListener('click', () => {
    codeState.showCreateForm = false;
    closeDirPicker();
    saveState(codeState);
    rerenderFromState();
  });

  container.querySelector('[data-code-cancel-edit]')?.addEventListener('click', () => {
    codeState.editingSessionId = null;
    codeState.editDraft = null;
    closeDirPicker();
    saveState(codeState);
    rerenderFromState();
  });

  // Create form
  const createForm = container.querySelector('[data-code-session-form]');
  createForm?.addEventListener('input', (event) => {
    const form = event.currentTarget;
    codeState.createDraft = {
      title: form.elements.title.value,
      workspaceRoot: form.elements.workspaceRoot.value,
      agentId: form.elements.agentId?.value || '',
    };
    saveState(codeState);
  });

  createForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const title = form.elements.title.value.trim() || 'Coding Session';
    const workspaceRoot = form.elements.workspaceRoot.value.trim() || '.';
    const agentId = form.elements.agentId?.value || '';
    const session = createSession(title, workspaceRoot, agentId || null);
    codeState.sessions.unshift(session);
    codeState.activeSessionId = session.id;
    codeState.showCreateForm = false;
    codeState.createDraft = { title: '', workspaceRoot: '.', agentId: '' };
    treeCache.clear();
    cachedFileView = { source: '', diff: '', error: null };
    closeDirPicker();
    saveState(codeState);
    rerenderFromState();
    void refreshSessionData(session);
  });

  // Edit form
  const editForm = container.querySelector('[data-code-edit-session-form]');
  editForm?.addEventListener('input', (event) => {
    const form = event.currentTarget;
    codeState.editDraft = {
      ...codeState.editDraft,
      title: form.elements.title.value,
      workspaceRoot: form.elements.workspaceRoot.value,
    };
    saveState(codeState);
  });

  editForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const session = codeState.sessions.find((s) => s.id === codeState.editingSessionId);
    if (!session) return;
    const form = event.currentTarget;
    session.title = form.elements.title.value.trim() || session.title;
    const newRoot = form.elements.workspaceRoot.value.trim() || session.workspaceRoot;
    if (newRoot !== session.workspaceRoot) {
      await Promise.all((session.terminalTabs || []).map((tab) => closeTerminal(tab)));
      session.workspaceRoot = newRoot;
      session.resolvedRoot = null;
      session.terminalTabs = (session.terminalTabs || []).map((tab, index) => ({
        ...tab,
        runtimeTerminalId: null,
        connecting: false,
        connected: false,
        output: index === 0 ? '' : tab.output || '',
      }));
      treeCache.clear();
    }
    codeState.editingSessionId = null;
    codeState.editDraft = null;
    closeDirPicker();
    saveState(codeState);
    rerenderFromState();
    if (session.id === codeState.activeSessionId) {
      void refreshSessionData(session);
    }
  });

  // Edit session button
  container.querySelectorAll('[data-code-edit-session]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const sessionId = button.dataset.codeEditSession;
      const session = codeState.sessions.find((s) => s.id === sessionId);
      if (!session) return;
      codeState.editingSessionId = sessionId;
      codeState.showCreateForm = false;
      codeState.editDraft = {
        title: session.title,
        workspaceRoot: session.workspaceRoot,
      };
      saveState(codeState);
      rerenderFromState();
    });
  });

  // Browse button (dir picker)
  container.querySelector('[data-code-browse-dir]')?.addEventListener('click', () => {
    const currentInput = container.querySelector('[name="workspaceRoot"]');
    const activeSession = getActiveSession();
    const startPath = currentInput?.value?.trim()
      || activeSession?.resolvedRoot
      || activeSession?.workspaceRoot
      || '.';
    void openDirPicker(startPath);
  });

  // Dir picker navigation
  container.querySelectorAll('[data-code-dirpick-navigate]').forEach((button) => {
    button.addEventListener('click', () => {
      void navigateDirPicker(button.dataset.codeDirpickNavigate);
    });
  });

  // Dir picker select
  container.querySelector('[data-code-dirpick-select]')?.addEventListener('click', () => {
    const input = container.querySelector('[name="workspaceRoot"]');
    if (input && codeState.dirPickerPath) {
      input.value = codeState.dirPickerPath;
      // Update the draft
      if (codeState.editingSessionId) {
        codeState.editDraft = { ...codeState.editDraft, workspaceRoot: codeState.dirPickerPath };
      } else {
        codeState.createDraft = { ...codeState.createDraft, workspaceRoot: codeState.dirPickerPath };
      }
    }
    closeDirPicker();
  });

  container.querySelector('[data-code-dirpick-cancel]')?.addEventListener('click', () => {
    closeDirPicker();
  });

  // Switch session
  container.querySelectorAll('[data-code-session-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const prevId = codeState.activeSessionId;
      codeState.activeSessionId = button.dataset.codeSessionId;
      if (prevId === codeState.activeSessionId) return;
      treeCache.clear();
      cachedFileView = { source: '', diff: '', error: null };
      saveState(codeState);
      rerenderFromState();
      const session = getActiveSession();
      if (session) void refreshSessionData(session);
    });
  });

  // Delete session
  container.querySelectorAll('[data-code-delete-session]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const deletedId = button.dataset.codeDeleteSession;
      const deletedSession = codeState.sessions.find((session) => session.id === deletedId);
      if (deletedSession) {
        await Promise.all((deletedSession.terminalTabs || []).map((tab) => closeTerminal(tab)));
      }
      codeState.sessions = codeState.sessions.filter((session) => session.id !== deletedId);
      const wasActive = codeState.activeSessionId === deletedId;
      codeState.activeSessionId = codeState.sessions[0]?.id || null;
      saveState(codeState);
      if (wasActive) {
        treeCache.clear();
        cachedFileView = { source: '', diff: '', error: null };
        rerenderFromState();
        const session = getActiveSession();
        if (session) void refreshSessionData(session);
      } else {
        rerenderFromState();
      }
    });
  });

  // ── Explorer (tree) ──

  container.querySelector('[data-code-refresh-explorer]')?.addEventListener('click', () => {
    const session = getActiveSession();
    if (session) void refreshTree(session);
  });

  container.querySelectorAll('[data-code-tree-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const session = getActiveSession();
      if (!session) return;
      const dirPath = button.dataset.codeTreeToggle;
      if (!session.expandedDirs) session.expandedDirs = [];
      const idx = session.expandedDirs.indexOf(dirPath);
      if (idx >= 0) {
        session.expandedDirs.splice(idx, 1);
      } else {
        session.expandedDirs.push(dirPath);
        // Lazy-load if not cached
        if (!treeCache.has(dirPath)) {
          saveState(codeState);
          void (async () => {
            const data = await loadTreeDir(session, dirPath);
            treeCache.set(dirPath, data);
            rerenderFromState();
          })();
          return;
        }
      }
      saveState(codeState);
      rerenderFromState();
    });
  });

  container.querySelectorAll('[data-code-tree-file]').forEach((button) => {
    button.addEventListener('click', () => {
      const session = getActiveSession();
      if (!session) return;
      session.selectedFilePath = button.dataset.codeTreeFile || null;
      session.showDiff = false;
      saveState(codeState);
      void refreshFileView(session);
    });
  });

  container.querySelector('[data-code-refresh-file]')?.addEventListener('click', () => {
    const session = getActiveSession();
    if (session) void refreshFileView(session);
  });

  container.querySelector('[data-code-toggle-diff]')?.addEventListener('click', () => {
    const session = getActiveSession();
    if (!session) return;
    session.showDiff = !session.showDiff;
    saveState(codeState);
    rerenderFromState();
  });

  // ── Terminals ──

  container.querySelector('[data-code-toggle-terminal-collapse]')?.addEventListener('click', () => {
    const session = getActiveSession();
    if (!session) return;
    session.terminalCollapsed = !session.terminalCollapsed;
    saveState(codeState);
    rerenderFromState();
  });

  container.querySelector('[data-code-new-terminal]')?.addEventListener('click', () => {
    const session = getActiveSession();
    if (!session) return;
    if (session.terminalTabs.length >= MAX_TERMINAL_PANES) return;
    const tab = createTerminalTab(`Terminal ${session.terminalTabs.length + 1}`, getDefaultShell());
    session.terminalTabs.push(tab);
    saveState(codeState);
    rerenderFromState();
    void ensureTerminalConnected(session, tab);
  });

  container.querySelectorAll('[data-code-close-terminal]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const session = getActiveSession();
      if (!session) return;
      if (session.terminalTabs.length <= 1) return;
      const tabId = button.dataset.codeCloseTerminal;
      const tab = session.terminalTabs.find((candidate) => candidate.id === tabId);
      if (tab) {
        await closeTerminal(tab);
      }
      session.terminalTabs = session.terminalTabs.filter((candidate) => candidate.id !== tabId);
      saveState(codeState);
      rerenderFromState();
    });
  });

  // Shell type selector
  container.querySelectorAll('[data-code-shell-select]').forEach((select) => {
    select.addEventListener('change', async () => {
      const session = getActiveSession();
      if (!session) return;
      const tabId = select.dataset.codeShellSelect;
      const tab = session.terminalTabs.find((t) => t.id === tabId);
      if (tab) {
        await closeTerminal(tab);
        tab.shell = select.value;
        tab.output = '';
        tab.openFailed = false;
        saveState(codeState);
        rerenderFromState();
        void ensureTerminalConnected(session, tab);
      }
    });
  });

  // ── Assistant tabs ──

  container.querySelectorAll('[data-code-assistant-tab], [data-code-switch-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const session = getActiveSession();
      if (!session) return;
      const nextTab = button.dataset.codeAssistantTab || button.dataset.codeSwitchTab;
      if (!isAssistantTab(nextTab)) return;
      session.activeAssistantTab = nextTab;
      saveState(codeState);
      rerenderFromState();
    });
  });

  container.querySelectorAll('[data-code-approval-id][data-code-approval-decision]').forEach((button) => {
    button.addEventListener('click', async () => {
      const session = getActiveSession();
      if (!session) return;
      const approvalId = button.dataset.codeApprovalId;
      const decision = button.dataset.codeApprovalDecision;
      if (!approvalId || (decision !== 'approved' && decision !== 'denied')) return;
      button.setAttribute('disabled', 'true');
      try {
        await handleCodeApprovalDecision(session, [approvalId], decision);
      } finally {
        button.removeAttribute('disabled');
      }
    });
  });

  // ── Chat ──

  container.querySelector('[data-code-chat-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const session = getActiveSession();
    if (!session) return;
    const form = event.currentTarget;
    const message = form.elements.message.value.trim();
    if (!message) return;
    session.chatDraft = '';
    session.chat.push({ role: 'user', content: message });
    saveState(codeState);
    rerenderFromState();
    scrollToBottom(currentContainer, '.code-chat__history');

    try {
      const response = await api.sendMessage(
        buildCodePrompt(session, message),
        session.agentId || undefined,
        buildUserId(session),
        DEFAULT_USER_CHANNEL,
        buildCodeMessageMetadata(session),
      );
      session.activeSkills = Array.isArray(response?.metadata?.activeSkills)
        ? response.metadata.activeSkills.map((value) => String(value))
        : [];
      const responsePendingApprovals = Array.isArray(response?.metadata?.pendingApprovals)
        ? response.metadata.pendingApprovals
        : null;
      if (responsePendingApprovals) {
        session.pendingApprovals = normalizePendingApprovals(responsePendingApprovals, session.pendingApprovals);
      }
      appendChatMessage(session, 'agent', response.content || 'No response content.');
      await refreshAssistantState(session, {
        rerender: false,
        fallbackPendingApprovals: responsePendingApprovals,
      });
    } catch (err) {
      appendChatMessage(session, 'error', err instanceof Error ? err.message : String(err));
    }
    saveState(codeState);
    rerenderFromState();
    scrollToBottom(currentContainer, '.code-chat__history');
  });

  container.querySelector('[data-code-reset-chat]')?.addEventListener('click', async () => {
    const session = getActiveSession();
    if (!session) return;
    session.chat = [];
    saveState(codeState);
    try {
      await api.resetConversation(session.agentId || cachedAgents[0]?.id || 'default', buildUserId(session), DEFAULT_USER_CHANNEL);
    } catch {
      // Keep local reset even if server reset fails.
    }
    await refreshAssistantState(session, { rerender: false });
    rerenderFromState();
  });

  container.querySelector('[data-code-chat-form] textarea[name="message"]')?.addEventListener('input', (event) => {
    const session = getActiveSession();
    if (!session) return;
    session.chatDraft = event.currentTarget.value;
    saveState(codeState);
  });
}

// ─── State management ──────────────────────────────────────

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { sessions: [], activeSessionId: null, showCreateForm: false, createDraft: { title: '', workspaceRoot: '.', agentId: '' } };
  } catch {
    return { sessions: [], activeSessionId: null, showCreateForm: false, createDraft: { title: '', workspaceRoot: '.', agentId: '' } };
  }
}

function normalizeState(raw, agents) {
  const next = {
    sessions: Array.isArray(raw?.sessions) ? raw.sessions.map((session) => {
      const terminalTabs = normalizeTerminalTabs(session.terminalTabs);
      return {
        id: session.id || crypto.randomUUID(),
        title: session.title || 'Coding Session',
        workspaceRoot: session.workspaceRoot || '.',
        resolvedRoot: session.resolvedRoot || null,
        currentDirectory: session.currentDirectory || null,
        selectedFilePath: session.selectedFilePath || null,
        showDiff: !!session.showDiff,
        agentId: resolveAgentId(session.agentId, agents),
        terminalTabs,
        terminalCollapsed: !!session.terminalCollapsed,
        expandedDirs: Array.isArray(session.expandedDirs) ? session.expandedDirs : [],
        chat: Array.isArray(session.chat) ? session.chat.slice(-30) : [],
        chatDraft: session.chatDraft || '',
        pendingApprovals: Array.isArray(session.pendingApprovals) ? session.pendingApprovals : [],
        activeSkills: Array.isArray(session.activeSkills) ? session.activeSkills : [],
        recentJobs: Array.isArray(session.recentJobs) ? session.recentJobs.slice(0, MAX_SESSION_JOBS) : [],
        lastExplorerPath: session.lastExplorerPath || null,
        planSummary: session.planSummary || '',
        compactedSummary: session.compactedSummary || '',
        activeAssistantTab: isAssistantTab(session.activeAssistantTab) ? session.activeAssistantTab : 'chat',
      };
    }) : [],
    activeSessionId: raw?.activeSessionId || null,
    showCreateForm: !!raw?.showCreateForm,
    editingSessionId: raw?.editingSessionId || null,
    editDraft: raw?.editDraft || null,
    createDraft: {
      title: raw?.createDraft?.title || '',
      workspaceRoot: raw?.createDraft?.workspaceRoot || '.',
      agentId: raw?.createDraft?.agentId || '',
    },
  };

  if (next.sessions.length === 0) {
    const session = createSession('GuardianAgent', '.', resolveAgentId(null, agents));
    next.sessions = [session];
    next.activeSessionId = session.id;
  }

  if (!next.sessions.some((session) => session.id === next.activeSessionId)) {
    next.activeSessionId = next.sessions[0]?.id || null;
  }

  return next;
}

function normalizeTerminalTabs(value) {
  const userTabs = Array.isArray(value) && value.length > 0
    ? value
      .map((tab) => ({
        id: tab.id && tab.id !== 'agent' ? tab.id : crypto.randomUUID(),
        name: tab.name && tab.name !== 'Agent' ? tab.name : 'Terminal 1',
        shell: tab.shell || getDefaultShell(),
        output: typeof tab.output === 'string'
          ? trimTerminalOutput(tab.output)
          : trimTerminalOutput(Array.isArray(tab.history) ? tab.history.join('\n\n') : ''),
        runtimeTerminalId: typeof tab.runtimeTerminalId === 'string' && tab.runtimeTerminalId ? tab.runtimeTerminalId : null,
        connecting: !!tab.connecting,
        connected: !!tab.connected,
        openFailed: !!tab.openFailed,
      }))
    : [];
  return userTabs.length > 0 ? userTabs : [createTerminalTab('Terminal 1', getDefaultShell())];
}

function saveState(state) {
  const persistable = {
    ...state,
    sessions: Array.isArray(state.sessions)
      ? state.sessions.map((session) => ({
        ...session,
        terminalTabs: Array.isArray(session.terminalTabs)
          ? session.terminalTabs.map((tab) => ({
            id: tab.id,
            name: tab.name,
            shell: tab.shell,
            output: typeof tab.output === 'string' ? trimTerminalOutput(tab.output) : '',
          }))
          : [],
        recentJobs: Array.isArray(session.recentJobs) ? session.recentJobs.slice(0, MAX_SESSION_JOBS) : [],
      }))
      : [],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
}

function getActiveSession() {
  return codeState.sessions.find((session) => session.id === codeState.activeSessionId) || null;
}

function createSession(title, workspaceRoot, agentId) {
  return {
    id: crypto.randomUUID(),
    title,
    workspaceRoot,
    resolvedRoot: null,
    currentDirectory: null,
    selectedFilePath: null,
    showDiff: false,
    agentId,
    terminalTabs: [createTerminalTab('Terminal 1', getDefaultShell())],
    terminalCollapsed: false,
    expandedDirs: [],
    chat: [],
    chatDraft: '',
    pendingApprovals: [],
    activeSkills: [],
    recentJobs: [],
    lastExplorerPath: null,
    planSummary: '',
    compactedSummary: '',
    activeAssistantTab: 'chat',
  };
}

function createTerminalTab(name, shell) {
  return {
    id: crypto.randomUUID(),
    name,
    shell: shell || getDefaultShell(),
    output: '',
    runtimeTerminalId: null,
    connecting: false,
    connected: false,
    openFailed: false,
  };
}

// ─── Prompt and output helpers ─────────────────────────────

function buildUserId(session) {
  return `web-code-${session.id}`;
}

function buildCodeMessageMetadata(session) {
  const workspaceRoot = session.resolvedRoot || session.workspaceRoot || '.';
  return {
    codeContext: {
      sessionId: session.id,
      workspaceRoot,
    },
  };
}

function buildCodePrompt(session, message) {
  const workspaceRoot = session.resolvedRoot || session.workspaceRoot;
  const selectedFile = session.selectedFilePath || '(none)';
  const currentDirectory = session.currentDirectory || workspaceRoot;
  const backlog = getApprovalBacklogState(session);
  return [
    '[Code Workspace Context]',
    `workspaceRoot: ${workspaceRoot}`,
    `currentDirectory: ${currentDirectory}`,
    `selectedFile: ${selectedFile}`,
    Array.isArray(session.activeSkills) && session.activeSkills.length > 0
      ? `activeSkills: ${session.activeSkills.join(', ')}`
      : 'activeSkills: (none)',
    `pendingApprovals: ${backlog.count}`,
    session.planSummary ? `activePlan:\n${session.planSummary}` : 'activePlan: (none)',
    session.compactedSummary ? `compactedSummary:\n${session.compactedSummary}` : 'compactedSummary: (none)',
    '',
    '[Code Workspace Operating Rules]',
    'Follow this loop: understand first, act second, verify third.',
    'Read files before editing them. Prefer code-aware tools when available.',
    'Use code_symbol_search before broad changes and use git diff to verify what changed.',
    'For complex or multi-file work, create or update a concise plan before making large edits.',
    'After material changes, run targeted verification such as tests, lint, or build when available.',
    'If you start repeating the same failed action, stop and change approach.',
    'If the current thread feels stale or bloated, summarize progress clearly so the session can be compacted.',
    backlog.blocked
      ? `Approval backlog is saturated (${backlog.count} pending). Do not initiate new mutating tool calls that would require additional approvals until the queue is reduced. Continue with read-only investigation, explanation, or planning instead.`
      : 'If approvals are already pending, prefer read-only investigation or planning before creating more write actions unless the user explicitly asks to proceed.',
    '',
    'Use coding tools when appropriate. If coding tools are not visible, call find_tools with query "coding code edit patch create plan git diff commit test build lint symbol".',
    `When running shell commands, use cwd="${workspaceRoot}".`,
    '',
    message,
  ].join('\n');
}

// ─── Path and string utilities ─────────────────────────────

function resolveAgentId(agentId, agents) {
  if (!agentId) return null;
  return agents.some((agent) => agent.id === agentId) ? agentId : null;
}

function joinWorkspacePath(base, child) {
  const separator = base.includes('\\') && !base.includes('/') ? '\\' : '/';
  if (base.endsWith(separator)) return `${base}${child}`;
  return `${base}${separator}${child}`;
}

function parentPath(value) {
  if (!value) return '.';
  const normalized = value.replace(/[\\/]+$/, '') || value;
  if (/^[a-zA-Z]:$/.test(normalized) || normalized === '/' || normalized === '\\\\') {
    return normalized;
  }
  const separator = normalized.includes('\\') && !normalized.includes('/') ? '\\' : '/';
  const index = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  if (index < 0) return normalized;
  if (index === 0) return separator;
  if (index === 2 && /^[a-zA-Z]:/.test(normalized)) return normalized.slice(0, 2);
  return normalized.slice(0, index) || normalized;
}

function basename(value) {
  if (!value) return '';
  const parts = value.split(/[\\/]/);
  return parts[parts.length - 1] || value;
}

function toRelativePath(target, root) {
  if (!target || !root) return '';
  const normalizedTarget = target.replace(/\\/g, '/');
  const normalizedRoot = root.replace(/\\/g, '/').replace(/\/$/, '');
  if (normalizedTarget.startsWith(`${normalizedRoot}/`)) {
    return normalizedTarget.slice(normalizedRoot.length + 1);
  }
  return basename(target);
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(value) {
  return esc(value).replace(/`/g, '&#96;');
}
