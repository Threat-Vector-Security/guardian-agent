import { api } from '../api.js';
import { enhanceSectionHelp, renderGuidancePanel } from '../components/context-help.js';
import { createTabs } from '../components/tabs.js';

let currentContainer = null;
const state = {
  status: null,
  activeTab: 'overview',
  preview: null,
  selectedProcessTargetIds: new Set(),
  selectedCleanupTargetIds: new Set(),
  feedback: null,
};

const PERFORMANCE_HELP = {
  overview: {
    'Host Snapshot': {
      whatItIs: 'This section is the current host-level performance snapshot for the active profile.',
      whatSeeing: 'You are seeing CPU, memory, disk, and process-count signals from the running machine together with the currently selected Guardian profile.',
      whatCanDo: 'Use it to decide whether the slowdown is general host pressure or something more specific to background processes or latency.',
      howLinks: 'If the pressure comes from apps, move to Actions or Live. If the issue is network or provider responsiveness, move to Latency.',
    },
    'Top Processes': {
      whatItIs: 'This section surfaces the highest-impact live processes currently visible to Guardian.',
      whatSeeing: 'You are seeing the busiest or largest processes from the latest sample, including whether Guardian treats them as protected.',
      whatCanDo: 'Use it to identify likely background noise before you generate a reviewed action preview.',
      howLinks: 'The Actions tab uses the same runtime process view when it builds a kill-preview batch.',
    },
  },
  profiles: {
    'Available Profiles': {
      whatItIs: 'This is the list of performance profiles currently defined in configuration.',
      whatSeeing: 'You are seeing each profile’s power intent, allowed auto-action ids, and process rules, plus which one is currently active.',
      whatCanDo: 'Apply a profile quickly before building an action preview so Guardian uses the right process-protection and terminate rules.',
      howLinks: 'Profiles are configured in the runtime config model and then exercised here from the operational page.',
    },
  },
  live: {
    'Live Processes': {
      whatItIs: 'This is the live process slice from the latest host sample.',
      whatSeeing: 'You are seeing the top process rows Guardian currently knows about, including CPU, memory, and whether the row is protected.',
      whatCanDo: 'Use it to inspect likely contributors to workstation slowdowns without leaving the Performance page.',
      howLinks: 'If you want to act on processes, switch to Actions so Guardian can build a reviewed kill batch first.',
    },
  },
  latency: {
    'Latency Probes': {
      whatItIs: 'This section shows the configured latency targets for the active profile.',
      whatSeeing: 'You are seeing the last probe result for each internet or API target, including disabled or failed probe states when a target cannot be resolved.',
      whatCanDo: 'Use it to separate host slowness from provider or internet responsiveness problems.',
      howLinks: 'Latency targets come from the active profile, so switching profiles changes what this tab monitors.',
    },
  },
  actions: {
    'Action Preview': {
      whatItIs: 'This section generates a reviewed process-action batch before Guardian changes anything on the host.',
      whatSeeing: 'You are seeing the preview trigger, runtime capability status, and any current selection feedback from the last preview or run.',
      whatCanDo: 'Generate a cleanup preview, inspect exactly which processes Guardian proposes, and decide whether to run the selected subset.',
      howLinks: 'The preview is built from the active profile rules and the current live process list, then executed through the privileged runtime route.',
    },
    'Selection Summary': {
      whatItIs: 'This is the final confirmation surface for the current preview batch.',
      whatSeeing: 'You are seeing the selected process and cleanup counts that will actually be submitted if you confirm the run.',
      whatCanDo: 'Uncheck any row you do not want touched, then run only the reviewed subset.',
      howLinks: 'This is the required safety gate before Guardian performs a mutating host action.',
    },
  },
  history: {
    'Action History': {
      whatItIs: 'This section records recent performance actions performed through the Performance page.',
      whatSeeing: 'You are seeing the action type, result, timestamp, and how many reviewed targets were selected when it ran.',
      whatCanDo: 'Use it to confirm what changed recently and whether a prior cleanup attempt actually succeeded.',
      howLinks: 'History stays on the Performance page so operator actions remain inspectable without reopening logs or chat.',
    },
  },
};

export async function renderPerformance(container, options = {}) {
  currentContainer = container;
  if (options?.tab) {
    state.activeTab = options.tab;
  }
  container.innerHTML = '<div class="loading">Loading performance data...</div>';

  try {
    state.status = await api.performanceStatus();
    container.innerHTML = `
      <div class="layout-heading">
        <h2 class="page-title">Performance Manager</h2>
      </div>
      ${renderGuidancePanel({
        kicker: 'Performance Guide',
        title: 'Host monitoring, profiles, and reviewed cleanup actions',
        whatItIs: 'Performance is the workstation-operations page for host pressure, latency, profile selection, and reviewed cleanup actions.',
        whatSeeing: 'You are seeing tabs for summary metrics, profiles, live process visibility, latency targets, guarded actions, and recent action history.',
        whatCanDo: 'Inspect the machine state, switch profiles quickly, preview process cleanups, and confirm the exact subset that Guardian is allowed to stop.',
        howLinks: 'Configuration owns the profile definitions and policy. Performance owns the day-to-day operational view and reviewed actions.',
      })}
      <div id="performance-tabs"></div>
    `;

    const tabsContainer = container.querySelector('#performance-tabs');
    if (!tabsContainer) return;

    createTabs(tabsContainer, [
      { id: 'overview', label: 'Overview', render: (panel) => { state.activeTab = 'overview'; renderOverviewTab(panel); } },
      { id: 'profiles', label: 'Profiles', render: (panel) => { state.activeTab = 'profiles'; renderProfilesTab(panel); } },
      { id: 'live', label: 'Live', render: (panel) => { state.activeTab = 'live'; renderLiveTab(panel); } },
      { id: 'latency', label: 'Latency', render: (panel) => { state.activeTab = 'latency'; renderLatencyTab(panel); } },
      { id: 'actions', label: 'Actions', render: (panel) => { state.activeTab = 'actions'; renderActionsTab(panel); } },
      { id: 'history', label: 'History', render: (panel) => { state.activeTab = 'history'; renderHistoryTab(panel); } },
    ], state.activeTab);
  } catch (error) {
    container.innerHTML = `<div class="loading">Failed to load performance data: ${esc(error instanceof Error ? error.message : String(error))}</div>`;
  }
}

export async function updatePerformance() {
  if (!currentContainer) return;
  await renderPerformance(currentContainer, { tab: state.activeTab });
}

function renderOverviewTab(panel) {
  const status = state.status;
  const snapshot = status?.snapshot ?? {};
  const topProcesses = snapshot.topProcesses ?? [];
  const memorySubtitle = snapshot.memoryTotalMb
    ? `${formatPercent(snapshot.memoryPercent)} of ${formatGb(snapshot.memoryTotalMb)} total`
    : 'Used memory';
  const diskSubtitle = snapshot.diskTotalMb
    ? `${formatPercent(snapshot.diskPercentFree)} free of ${formatGb(snapshot.diskTotalMb)} total`
    : 'Free disk space';

  panel.innerHTML = `
    ${renderGuidancePanel({
      kicker: 'Overview',
      compact: true,
      whatItIs: 'Overview is the fast host-health summary for the active performance profile.',
      whatSeeing: 'You are seeing current resource pressure and the most visible processes from the latest sample.',
      whatCanDo: 'Use it to decide whether to inspect profiles, latency, or a reviewed cleanup preview next.',
      howLinks: 'This tab is summary-first. The mutating safety gate still lives in Actions.',
    })}
    <div class="table-container">
      <div class="table-header"><h3>Host Snapshot</h3></div>
      <div class="intel-summary-grid">
        <div class="status-card info">
          <div class="card-title">OS</div>
          <div class="card-value">${esc(status?.os || 'unknown')}</div>
          <div class="card-subtitle">Active profile: ${esc(status?.activeProfile || 'balanced')}</div>
        </div>
        <div class="status-card ${severityClass(snapshot.cpuPercent, 80, 60)}">
          <div class="card-title">CPU</div>
          <div class="card-value">${formatPercent(snapshot.cpuPercent)}</div>
          <div class="card-subtitle">Current host usage</div>
        </div>
        <div class="status-card ${severityClass(snapshot.memoryPercent, 85, 70)}">
          <div class="card-title">Memory</div>
          <div class="card-value">${formatGb(snapshot.memoryMb)}</div>
          <div class="card-subtitle">${esc(memorySubtitle)}</div>
        </div>
        <div class="status-card ${severityClass(snapshot.diskPercentFree != null ? 100 - snapshot.diskPercentFree : undefined, 90, 75)}">
          <div class="card-title">Disk Free</div>
          <div class="card-value">${formatGb(snapshot.diskFreeMb)}</div>
          <div class="card-subtitle">${esc(diskSubtitle)}</div>
        </div>
        <div class="status-card accent">
          <div class="card-title">Processes</div>
          <div class="card-value">${formatInt(snapshot.processCount)}</div>
          <div class="card-subtitle">From the latest sample</div>
        </div>
      </div>
    </div>

    <div class="table-container">
      <div class="table-header"><h3>Top Processes</h3></div>
      ${topProcesses.length > 0 ? `
        <table>
          <thead>
            <tr><th>Name</th><th>PID</th><th>CPU</th><th>Memory</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${topProcesses.map((processInfo) => `
              <tr>
                <td>${esc(processInfo.name)}</td>
                <td>${formatInt(processInfo.pid)}</td>
                <td>${formatPercent(processInfo.cpuPercent)}</td>
                <td>${formatMb(processInfo.memoryMb)}</td>
                <td>${processInfo.protected
                  ? `<span class="status-chip warning" title="${escAttr(processInfo.protectionReason || 'Protected')}">Protected</span>`
                  : '<span class="status-chip success">Selectable</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<div class="cfg-center-body"><div class="ops-inline-help">No process sample is available yet.</div></div>'}
    </div>
  `;

  enhanceSectionHelp(panel, PERFORMANCE_HELP.overview);
}

function renderProfilesTab(panel) {
  const status = state.status;
  const profiles = status?.profiles ?? [];
  panel.innerHTML = `
    ${renderGuidancePanel({
      kicker: 'Profiles',
      compact: true,
      whatItIs: 'Profiles let Guardian switch between pre-defined workstation modes such as coding or cleanup focus.',
      whatSeeing: 'You are seeing the configured profile list and the process rules each one carries.',
      whatCanDo: 'Apply a profile before generating a preview so Guardian uses the right protect and terminate lists.',
      howLinks: 'Profile definitions live in config; this tab is the operational selector.',
    })}
    <div class="table-container">
      <div class="table-header"><h3>Available Profiles</h3></div>
      ${profiles.length > 0 ? `
        <table>
          <thead>
            <tr><th>Profile</th><th>Rules</th><th>Auto Actions</th><th>Action</th></tr>
          </thead>
          <tbody>
            ${profiles.map((profile) => `
              <tr>
                <td>
                  <div><strong>${esc(profile.name)}</strong></div>
                  <div class="card-subtitle">${esc(profile.powerMode || 'no host power mode')}</div>
                </td>
                <td>
                  <div>Terminate: ${esc(profile.terminateProcessNames.join(', ') || 'none')}</div>
                  <div>Protect: ${esc(profile.protectProcessNames.join(', ') || 'none')}</div>
                </td>
                <td>${profile.autoActionsEnabled ? esc(profile.allowedActionIds.join(', ') || 'enabled') : 'manual only'}</td>
                <td>
                  ${profile.id === status?.activeProfile
                    ? '<span class="status-chip success">Active</span>'
                    : `<button class="btn btn-secondary btn-sm" data-profile-id="${escAttr(profile.id)}">Apply</button>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<div class="cfg-center-body"><div class="ops-inline-help">No performance profiles are configured.</div></div>'}
      <div id="performance-profile-feedback" class="cfg-save-status" style="margin:1rem 1rem 0;"></div>
    </div>
  `;

  panel.querySelectorAll('[data-profile-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const profileId = button.getAttribute('data-profile-id');
      if (!profileId) return;
      const feedback = panel.querySelector('#performance-profile-feedback');
      setStatusText(feedback, 'Applying profile...', 'pending');
      try {
        const result = await api.performanceApplyProfile(profileId);
        state.feedback = { kind: result.success ? 'success' : 'error', text: result.message };
        await updatePerformance();
      } catch (error) {
        setStatusText(feedback, error instanceof Error ? error.message : String(error), 'error');
      }
    });
  });

  if (state.feedback?.text) {
    setStatusText(panel.querySelector('#performance-profile-feedback'), state.feedback.text, state.feedback.kind);
  }

  enhanceSectionHelp(panel, PERFORMANCE_HELP.profiles);
}

function renderLiveTab(panel) {
  const topProcesses = state.status?.snapshot?.topProcesses ?? [];
  panel.innerHTML = `
    ${renderGuidancePanel({
      kicker: 'Live',
      compact: true,
      whatItIs: 'Live is the current process snapshot from the runtime.',
      whatSeeing: 'You are seeing the processes that most visibly affect the latest host sample.',
      whatCanDo: 'Inspect likely pressure sources and confirm whether Guardian considers them protected before building a preview.',
      howLinks: 'The reviewed mutation path still starts from Actions rather than direct inline kills here.',
    })}
    <div class="table-container">
      <div class="table-header"><h3>Live Processes</h3></div>
      ${topProcesses.length > 0 ? `
        <table>
          <thead>
            <tr><th>Name</th><th>PID</th><th>CPU</th><th>Memory</th><th>Guardian Status</th></tr>
          </thead>
          <tbody>
            ${topProcesses.map((processInfo) => `
              <tr>
                <td>${esc(processInfo.name)}</td>
                <td>${formatInt(processInfo.pid)}</td>
                <td>${formatPercent(processInfo.cpuPercent)}</td>
                <td>${formatMb(processInfo.memoryMb)}</td>
                <td>${processInfo.protected ? esc(processInfo.protectionReason || 'Protected') : 'Not currently protected'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<div class="cfg-center-body"><div class="ops-inline-help">No live process sample is available yet.</div></div>'}
    </div>
  `;

  enhanceSectionHelp(panel, PERFORMANCE_HELP.live);
}

function renderLatencyTab(panel) {
  const latencyTargets = state.status?.latencyTargets ?? [];
  panel.innerHTML = `
    ${renderGuidancePanel({
      kicker: 'Latency',
      compact: true,
      whatItIs: 'Latency surfaces the configured internet and API targets for the active profile.',
      whatSeeing: 'You are seeing the last probe state for each target, including errors when a configured target cannot be reached or resolved.',
      whatCanDo: 'Use it to decide whether the problem is workstation pressure or upstream response time.',
      howLinks: 'Targets come from the active profile, so profile changes affect this view immediately on refresh.',
    })}
    <div class="table-container">
      <div class="table-header"><h3>Latency Probes</h3></div>
      ${latencyTargets.length > 0 ? `
        <table>
          <thead>
            <tr><th>Target</th><th>Type</th><th>State</th><th>Latency</th><th>Detail</th></tr>
          </thead>
          <tbody>
            ${latencyTargets.map((target) => `
              <tr>
                <td>
                  <div><strong>${esc(target.label)}</strong></div>
                  <div class="card-subtitle">${esc(target.target || 'resolved at runtime')}</div>
                </td>
                <td>${esc(target.kind)}</td>
                <td><span class="status-chip ${latencyStateClass(target.state)}">${esc(target.state)}</span></td>
                <td>${target.latencyMs != null ? `${Math.round(target.latencyMs)} ms` : 'n/a'}</td>
                <td>${esc(target.detail || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<div class="cfg-center-body"><div class="ops-inline-help">No latency targets are configured for the active profile.</div></div>'}
    </div>
  `;

  enhanceSectionHelp(panel, PERFORMANCE_HELP.latency);
}

function renderActionsTab(panel) {
  const capabilities = state.status?.capabilities ?? {};
  const selectedProcessCount = state.selectedProcessTargetIds.size;
  const selectedCleanupCount = state.selectedCleanupTargetIds.size;
  const preview = state.preview;
  const canRunSelected = Boolean(preview) && (selectedProcessCount > 0 || selectedCleanupCount > 0);

  panel.innerHTML = `
    ${renderGuidancePanel({
      kicker: 'Actions',
      compact: true,
      whatItIs: 'Actions is the guarded mutation surface for reviewed workstation cleanup work.',
      whatSeeing: 'You are seeing runtime capability status, the preview trigger, the review tables, and the final selection count.',
      whatCanDo: 'Generate a reviewed process batch, uncheck anything you do not want touched, and then submit only the approved subset.',
      howLinks: 'This tab is the required safety gate before Guardian stops any process from the Performance page.',
    })}
    <div class="table-container">
      <div class="table-header"><h3>Action Preview</h3></div>
      <div class="cfg-center-body">
        <div class="ops-inline-help">
          Guardian will not stop any process until you review the preview batch below. Protected rows remain visible but disabled.
        </div>
        <div class="cfg-actions" style="margin-top:1rem;">
          <button class="btn btn-primary" id="performance-preview-button">Preview Recommended Cleanup</button>
          <button class="btn btn-secondary" id="performance-refresh-button">Refresh Status</button>
        </div>
        <div class="card-subtitle" style="margin-top:0.75rem;">
          Process actions: ${capabilities.canManageProcesses ? 'supported' : 'read-only on this OS'}.
          Cleanup actions: ${capabilities.canRunCleanup ? 'supported' : 'not implemented in this build'}.
        </div>
        <div id="performance-action-feedback" class="cfg-save-status" style="margin-top:0.75rem;"></div>
      </div>
    </div>

    ${preview ? `
      <div class="table-container">
        <div class="table-header"><h3>Selection Summary</h3></div>
        <div class="cfg-center-body">
          <div class="ops-inline-help">
            ${selectedProcessCount} process${selectedProcessCount === 1 ? '' : 'es'} and ${selectedCleanupCount} cleanup target${selectedCleanupCount === 1 ? '' : 's'} are selected for execution.
          </div>
          <div class="cfg-actions" style="margin-top:1rem;">
            <button class="btn btn-primary" id="performance-run-button"${canRunSelected ? '' : ' disabled'}>Run Selected (${selectedProcessCount + selectedCleanupCount})</button>
          </div>
        </div>
      </div>

      ${renderPreviewTable('Processes', preview.processTargets, 'process')}
      ${renderPreviewTable('Cleanup Targets', preview.cleanupTargets, 'cleanup')}
    ` : ''}
  `;

  panel.querySelector('#performance-preview-button')?.addEventListener('click', async () => {
    const feedback = panel.querySelector('#performance-action-feedback');
    setStatusText(feedback, 'Generating reviewed preview...', 'pending');
    try {
      const previewResult = await api.performancePreviewAction('cleanup');
      state.preview = previewResult;
      state.selectedProcessTargetIds = new Set(
        (previewResult.processTargets || [])
          .filter((target) => target.checkedByDefault && target.selectable)
          .map((target) => target.targetId),
      );
      state.selectedCleanupTargetIds = new Set(
        (previewResult.cleanupTargets || [])
          .filter((target) => target.checkedByDefault && target.selectable)
          .map((target) => target.targetId),
      );
      state.feedback = { kind: 'success', text: 'Preview generated. Review the checked rows before running the action.' };
      renderActionsTab(panel);
    } catch (error) {
      setStatusText(feedback, error instanceof Error ? error.message : String(error), 'error');
    }
  });

  panel.querySelector('#performance-refresh-button')?.addEventListener('click', async () => {
    state.feedback = null;
    await updatePerformance();
  });

  panel.querySelectorAll('[data-target-kind][data-target-id]').forEach((input) => {
    input.addEventListener('change', () => {
      const targetId = input.getAttribute('data-target-id');
      const kind = input.getAttribute('data-target-kind');
      if (!targetId || !kind) return;
      const selection = kind === 'process' ? state.selectedProcessTargetIds : state.selectedCleanupTargetIds;
      if (input.checked) {
        selection.add(targetId);
      } else {
        selection.delete(targetId);
      }
      renderActionsTab(panel);
    });
  });

  panel.querySelector('#performance-run-button')?.addEventListener('click', async () => {
    if (!state.preview) return;
    const feedback = panel.querySelector('#performance-action-feedback');
    setStatusText(feedback, 'Running selected actions...', 'pending');
    try {
      const result = await api.performanceRunAction({
        previewId: state.preview.previewId,
        selectedProcessTargetIds: [...state.selectedProcessTargetIds],
        selectedCleanupTargetIds: [...state.selectedCleanupTargetIds],
      });
      state.preview = null;
      state.selectedProcessTargetIds = new Set();
      state.selectedCleanupTargetIds = new Set();
      state.feedback = { kind: result.success ? 'success' : 'error', text: result.message };
      await updatePerformance();
    } catch (error) {
      setStatusText(feedback, error instanceof Error ? error.message : String(error), 'error');
    }
  });

  if (state.feedback?.text) {
    setStatusText(panel.querySelector('#performance-action-feedback'), state.feedback.text, state.feedback.kind);
  }

  enhanceSectionHelp(panel, PERFORMANCE_HELP.actions);
}

function renderHistoryTab(panel) {
  const history = state.status?.history ?? [];
  panel.innerHTML = `
    ${renderGuidancePanel({
      kicker: 'History',
      compact: true,
      whatItIs: 'History is the recent log of performance actions run from this page.',
      whatSeeing: 'You are seeing the latest recorded runs and whether they succeeded.',
      whatCanDo: 'Use it to confirm what was attempted recently before generating another preview.',
      howLinks: 'This stays local to the Performance domain so operator cleanup actions are easy to inspect.',
    })}
    <div class="table-container">
      <div class="table-header"><h3>Action History</h3></div>
      ${history.length > 0 ? `
        <table>
          <thead>
            <tr><th>When</th><th>Action</th><th>Result</th><th>Selection</th><th>Message</th></tr>
          </thead>
          <tbody>
            ${history.map((entry) => `
              <tr>
                <td>${esc(formatTimestamp(entry.executedAt))}</td>
                <td>${esc(entry.actionId)}</td>
                <td><span class="status-chip ${entry.success ? 'success' : 'error'}">${entry.success ? 'success' : 'failed'}</span></td>
                <td>${entry.selectedProcessCount} process / ${entry.selectedCleanupCount} cleanup</td>
                <td>${esc(entry.message)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<div class="cfg-center-body"><div class="ops-inline-help">No performance actions have been recorded yet.</div></div>'}
    </div>
  `;

  enhanceSectionHelp(panel, PERFORMANCE_HELP.history);
}

function renderPreviewTable(title, targets, kind) {
  if (!Array.isArray(targets) || targets.length === 0) {
    return `
      <div class="table-container">
        <div class="table-header"><h3>${esc(title)}</h3></div>
        <div class="cfg-center-body"><div class="ops-inline-help">No ${esc(title.toLowerCase())} were suggested for this preview.</div></div>
      </div>
    `;
  }

  return `
    <div class="table-container">
      <div class="table-header"><h3>${esc(title)}</h3></div>
      <table>
        <thead>
          <tr><th>Select</th><th>Name</th><th>PID</th><th>CPU</th><th>Memory</th><th>Reason</th><th>Risk</th></tr>
        </thead>
        <tbody>
          ${targets.map((target) => `
            <tr>
              <td>
                <input
                  type="checkbox"
                  data-target-kind="${escAttr(kind)}"
                  data-target-id="${escAttr(target.targetId)}"
                  ${target.selectable ? '' : 'disabled'}
                  ${isSelected(kind, target.targetId) ? 'checked' : ''}
                />
              </td>
              <td>
                <div><strong>${esc(target.label || target.name || target.targetId)}</strong></div>
                ${target.blockedReason ? `<div class="card-subtitle">${esc(target.blockedReason)}</div>` : ''}
              </td>
              <td>${target.pid != null ? formatInt(target.pid) : 'n/a'}</td>
              <td>${formatPercent(target.cpuPercent)}</td>
              <td>${formatMb(target.memoryMb)}</td>
              <td>${esc(target.suggestedReason || '')}</td>
              <td>${esc(target.risk)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function isSelected(kind, targetId) {
  const selection = kind === 'process' ? state.selectedProcessTargetIds : state.selectedCleanupTargetIds;
  return selection.has(targetId);
}

function setStatusText(element, text, kind = 'info') {
  if (!element) return;
  element.textContent = text || '';
  element.className = `cfg-save-status ${kind || 'info'}`.trim();
}

function severityClass(value, high, medium) {
  if (typeof value !== 'number') return 'info';
  if (value >= high) return 'error';
  if (value >= medium) return 'warning';
  return 'success';
}

function latencyStateClass(stateValue) {
  if (stateValue === 'ok') return 'success';
  if (stateValue === 'disabled' || stateValue === 'idle') return 'warning';
  return 'error';
}

function formatPercent(value) {
  return typeof value === 'number' ? `${Math.round(value)}%` : 'n/a';
}

function formatMb(value) {
  return typeof value === 'number' ? `${Math.round(value)} MB` : 'n/a';
}

function formatGb(value) {
  return typeof value === 'number' ? `${round(value / 1024)} GB` : 'n/a';
}

function formatInt(value) {
  return typeof value === 'number' ? String(Math.round(value)) : 'n/a';
}

function formatTimestamp(value) {
  if (typeof value !== 'number') return 'unknown';
  return new Date(value).toLocaleString();
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(value) {
  return esc(value).replace(/'/g, '&#39;');
}
