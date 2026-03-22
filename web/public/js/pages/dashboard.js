import { api } from '../api.js';
import { createStatusCard, updateStatusCard } from '../components/status-card.js';
import { renderGuidancePanel, renderInfoButton, activateContextHelp, enhanceSectionHelp } from '../components/context-help.js';
import { onSSE, offSSE } from '../app.js';

let cards = {};
let metricsHandler = null;
let currentContainer = null;

function resolveActiveLLM(agents = []) {
  const running = agents
    .filter((agent) => agent.state === 'running' && agent.provider && agent.providerModel)
    .sort((a, b) => (b.lastActivityMs || 0) - (a.lastActivityMs || 0));
  if (running.length > 0) {
    return {
      status: running.length > 1 ? `${running.length} Active` : 'Active',
      subtitle: `${running[0].provider}: ${running[0].providerModel} (${running[0].providerLocality || 'unknown'})`,
      tone: running[0].providerLocality === 'external' ? 'accent' : 'info',
      tooltip: running.length > 1
        ? `Currently active LLM communication is using ${running.length} running agents. Most recent: ${running[0].provider} / ${running[0].providerModel} (${running[0].providerLocality || 'unknown'}).`
        : `Currently active LLM communication is using ${running[0].provider} / ${running[0].providerModel} (${running[0].providerLocality || 'unknown'}).`,
    };
  }

  const queued = agents
    .filter((agent) => agent.state === 'queued' && agent.provider && agent.providerModel)
    .sort((a, b) => (b.lastActivityMs || 0) - (a.lastActivityMs || 0));
  if (queued.length > 0) {
    return {
      status: queued.length > 1 ? `${queued.length} Queued` : 'Queued',
      subtitle: `${queued[0].provider}: ${queued[0].providerModel} (${queued[0].providerLocality || 'unknown'})`,
      tone: 'warning',
      tooltip: `Queued LLM work is waiting on ${queued[0].provider} / ${queued[0].providerModel} (${queued[0].providerLocality || 'unknown'}).`,
    };
  }

  return {
    status: 'Idle',
    subtitle: 'No active LLM communication',
    tone: 'success',
    tooltip: 'No agent is currently in a running or queued LLM communication state.',
  };
}

export async function renderDashboard(container) {
  currentContainer = container;
  container.innerHTML = '<h2 class="page-title">Dashboard</h2><div class="loading">Loading...</div>';

  try {
    const [agents, summary, providers, readiness, assistantState, recentWarn, recentCritical] = await Promise.all([
      api.agents().catch(() => []),
      api.auditSummary(300000).catch(() => null),
      api.providersStatus().catch(() => api.providers().catch(() => [])),
      api.setupStatus().catch(() => null),
      api.assistantState().catch(() => null),
      api.audit({ severity: 'warn', limit: 6 }).catch(() => []),
      api.audit({ severity: 'critical', limit: 6 }).catch(() => []),
    ]);

    const defaultProviderName = assistantState?.defaultProvider || null;
    const primaryProvider = defaultProviderName
      ? providers.find((provider) => provider.name === defaultProviderName) || providers[0]
      : providers[0];
    const attentionItems = [...(recentCritical || []), ...(recentWarn || [])]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 8);
    const orchestratorSummary = assistantState?.orchestrator?.summary || {};
    const jobsSummary = assistantState?.jobs?.summary || {};
    const readinessLoaded = !!readiness;
    const warnCount = summary?.bySeverity?.warn || 0;
    const criticalCount = summary?.bySeverity?.critical || 0;
    const totalActiveAlerts = warnCount + criticalCount;
    const runtimeLoaded = !!assistantState;
    const activeLLM = resolveActiveLLM(agents);

    container.innerHTML = `
      <h2 class="page-title">Dashboard</h2>
      ${renderGuidancePanel({
        kicker: 'Orientation',
        title: 'Dashboard at a glance',
        compact: true,
        whatItIs: 'Dashboard is the summary landing page for the whole product. It is meant to tell you whether Guardian is healthy, whether anything urgent is happening, and which owner page you should open next.',
        whatSeeing: 'You are seeing system-health cards, a recent attention queue, agent/runtime metrics, and shortcut links into Security, Cloud, Automations, and Configuration.',
        whatCanDo: 'Use it to orient yourself quickly, spot urgent issues without opening every page, and jump straight into the page that owns the real work.',
        howLinks: 'Dashboard is intentionally summary-only. Investigation, editing, approvals, and workflow changes still happen on the owning pages.',
      })}
    `;

    const summaryGrid = document.createElement('div');
    summaryGrid.className = 'cards-grid';

    cards.runtime = createStatusCard(
      'Guardian Core',
      runtimeLoaded ? 'Online' : 'Degraded',
      runtimeLoaded
        ? `${orchestratorSummary.runningCount || 0} running / ${orchestratorSummary.queuedCount || 0} queued`
        : 'Assistant runtime state unavailable',
      runtimeLoaded ? 'success' : 'warning',
    );
    setCardTooltip(cards.runtime, 'Guardian core runtime status. Shows whether the main system is up and serving requests.');
    cards.readiness = createStatusCard(
      'Readiness',
      !readinessLoaded ? 'Unknown' : readiness.ready ? 'Ready' : 'Needs Review',
      !readinessLoaded
        ? 'Readiness state unavailable'
        : readiness.completed
        ? 'Config baseline complete'
        : 'Complete system configuration',
      readinessLoaded && readiness.ready ? 'success' : 'warning',
    );
    setCardTooltip(cards.readiness, 'Configuration readiness summary. Opens Configuration > System.');
    cards.alerts = createStatusCard(
      'Active Alerts',
      totalActiveAlerts,
      summary ? `${criticalCount} critical / ${warnCount} warn in last 5m` : 'No recent audit summary',
      criticalCount > 0 ? 'error' : totalActiveAlerts > 0 ? 'warning' : 'success',
    );
    setCardTooltip(cards.alerts, 'Count of current warning and critical security events. Opens Security > Security Log.');
    cards.llm = createStatusCard(
      'Primary Provider',
      primaryProvider ? (primaryProvider.connected !== false ? 'Connected' : 'Disconnected') : 'None',
      primaryProvider
        ? `${primaryProvider.name}: ${primaryProvider.model} (${primaryProvider.locality === 'local' ? 'Local' : 'External'})`
        : 'Configure AI & Search',
      primaryProvider ? (primaryProvider.connected !== false ? 'success' : 'warning') : 'warning',
    );
    setCardTooltip(cards.llm, 'Current global default AI provider status and model. Opens Configuration > AI & Search.');
    cards.liveLlm = createStatusCard(
      'Live LLM',
      activeLLM.status,
      activeLLM.subtitle,
      activeLLM.tone,
    );
    setCardTooltip(cards.liveLlm, activeLLM.tooltip);
    cards.agents = createStatusCard(
      'Agents',
      agents.length,
      `${agents.filter((agent) => agent.state === 'running' || agent.state === 'idle').length} available`,
      agents.length > 0 ? 'info' : 'warning',
    );
    setCardTooltip(cards.agents, 'High-level agent count and availability. Opens Automations.');

    bindCard(cards.alerts, '#/security?tab=security-log');
    bindCard(cards.llm, '#/config?tab=ai-search');
    bindCard(cards.readiness, '#/config?tab=system');
    bindCard(cards.agents, '#/automations');
    bindCard(cards.liveLlm, '#/dashboard');

    summaryGrid.append(cards.runtime, cards.readiness, cards.alerts, cards.llm, cards.liveLlm, cards.agents);

    const summarySection = document.createElement('div');
    summarySection.className = 'table-container';
    summarySection.innerHTML = `
      <div class="table-header">
        <div class="section-heading">
          <h3>System Summary</h3>
          ${renderInfoButton('System Summary', {
            whatItIs: 'This strip is the top-level status board for the major Guardian control planes: core runtime, setup readiness, alert pressure, AI provider health, and agent availability.',
            whatSeeing: 'You are seeing one compact card per domain, each showing the current status plus a short subtitle that tells you what is driving that status.',
            whatCanDo: 'Use these cards to confirm whether the platform is basically healthy and click straight into the owner page when one area needs attention.',
            howLinks: 'Each card is only a summary and navigation entry point. It does not replace the actual page that owns configuration or investigation for that domain.',
          })}
        </div>
      </div>
    `;
    summarySection.appendChild(summaryGrid);
    container.appendChild(summarySection);

    container.appendChild(createAttentionSection(attentionItems));
    container.appendChild(createRuntimeSection({ orchestratorSummary, jobsSummary, agents, summary, assistantState }));
    container.appendChild(createQuickLinksSection());
    enhanceSectionHelp(container, {
      'Needs Attention': {
        whatItIs: 'This section is the short-form attention queue for the most recent warning and critical events that may need operator review.',
        whatSeeing: 'You are seeing a mixed feed of recent high-severity items pulled from audit, monitoring, and automation activity, including their source and short detail text.',
        whatCanDo: 'Use it to spot what is hot right now, then open Security > Security Log when you need acknowledgement, triage, or a fuller incident view.',
        howLinks: 'It is a dashboard preview of urgent activity. The actual incident queue and acknowledgement workflow remain in Security.',
      },
      'Agent Runtime': {
        whatItIs: 'This section summarizes whether the agent layer and job system are healthy enough to keep up with work.',
        whatSeeing: 'You are seeing compact metrics for orchestrator load, queued or recent jobs, and shortcut links into the pages that own the underlying runtime detail.',
        whatCanDo: 'Use it to determine whether Guardian is falling behind, stuck, or healthy, then jump into Automations, Security Log, Cloud, or Configuration for the relevant fix.',
        howLinks: 'It is a runtime summary and navigation surface, not a replacement for the deeper operational tables on the owner pages.',
      },
      'Quick Links': {
        whatItIs: 'This section is a shortcut launcher for the pages operators most often need after checking dashboard status.',
        whatSeeing: 'You are seeing direct-entry cards for the alert queue, cloud hub, automation workspace, and AI/search configuration.',
        whatCanDo: 'Use these when you already know the next task and want one click into the correct page without working through the left nav.',
        howLinks: 'Each card opens the canonical owner page or tab for that workflow rather than creating a duplicate mini-workflow inside Dashboard.',
      },
    });
    activateContextHelp(container);

    if (metricsHandler) offSSE('metrics', metricsHandler);
    metricsHandler = (data) => {
      if (!data?.agents) return;
      const nextActiveLLM = resolveActiveLLM(data.agents);
      updateStatusCard(
        cards.agents,
        data.agents.length,
        `${data.agents.filter((agent) => agent.state === 'running' || agent.state === 'idle').length} available`,
      );
      cards.agents.className = `status-card ${data.agents.length > 0 ? 'info' : 'warning'} status-card-link`;
      updateStatusCard(cards.liveLlm, nextActiveLLM.status, nextActiveLLM.subtitle);
      cards.liveLlm.className = `status-card ${nextActiveLLM.tone} status-card-link`;
      setCardTooltip(cards.liveLlm, nextActiveLLM.tooltip);
    };
    onSSE('metrics', metricsHandler);
  } catch (err) {
    container.innerHTML = `<h2 class="page-title">Dashboard</h2><div class="loading">Error: ${esc(err instanceof Error ? err.message : String(err))}</div>`;
  }
}

export function updateDashboard() {
  if (currentContainer) {
    void renderDashboard(currentContainer);
  }
}

function createAttentionSection(items) {
  const section = document.createElement('div');
  section.className = 'table-container';
  section.innerHTML = `
    <div class="table-header">
      <h3>Needs Attention</h3>
      <a class="btn btn-secondary btn-sm" href="#/security?tab=security-log">Open Security Log</a>
    </div>
    <table>
      <thead><tr><th>Time</th><th>Type</th><th>Severity</th><th>Source</th><th>Detail</th></tr></thead>
      <tbody>
        ${items.length === 0
          ? '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Nothing urgent right now.</td></tr>'
          : items.map((item) => `
            <tr>
              <td>${formatTime(item.timestamp)}</td>
              <td>${esc(item.type)}</td>
              <td><span class="badge badge-${esc(item.severity)}">${esc(item.severity)}</span></td>
              <td>${esc(item.details?.automationName || item.details?.source || item.agentId || '-')}</td>
              <td title="${escAttr(item.details?.description || item.details?.reason || '')}">${esc(item.details?.description || item.details?.reason || '-')}</td>
            </tr>
          `).join('')}
      </tbody>
    </table>
  `;
  return section;
}

function createRuntimeSection({ orchestratorSummary, jobsSummary, agents, summary, assistantState }) {
  const sessions = Array.isArray(assistantState?.orchestrator?.sessions) ? assistantState.orchestrator.sessions : [];
  const agentMap = new Map((agents || []).map((agent) => [agent.id, agent]));
  const activeSessions = sessions
    .filter((session) => session.status === 'running' || session.status === 'queued')
    .sort((a, b) => {
      const aTime = a.lastStartedAt || a.lastQueuedAt || 0;
      const bTime = b.lastStartedAt || b.lastQueuedAt || 0;
      return bTime - aTime;
    })
    .slice(0, 8);
  const recentSessions = activeSessions.length > 0
    ? activeSessions
    : sessions
      .slice()
      .sort((a, b) => (b.lastCompletedAt || b.lastStartedAt || b.lastQueuedAt || 0) - (a.lastCompletedAt || a.lastStartedAt || a.lastQueuedAt || 0))
      .slice(0, 5);

  const section = document.createElement('div');
  section.className = 'table-container';
  section.innerHTML = `
    <div class="table-header"><h3>Agent Runtime</h3></div>
    <div class="cards-grid" style="padding:1rem;">
      ${renderMiniCard('Sessions', orchestratorSummary.sessionCount || 0, `${orchestratorSummary.runningCount || 0} running / ${orchestratorSummary.queuedCount || 0} queued`, 'info', 'Assistant session volume and queue depth across active conversations.')}
      ${renderMiniCard('Requests', orchestratorSummary.totalRequests || 0, `${orchestratorSummary.failedRequests || 0} failed`, (orchestratorSummary.failedRequests || 0) > 0 ? 'warning' : 'success', 'Total assistant requests processed, including failures.')}
      ${renderMiniCard('Latency', `${orchestratorSummary.avgEndToEndMs || 0}ms`, 'Average end-to-end', 'accent', 'Average end-to-end request time through routing, tool use, and response delivery.')}
      ${renderMiniCard('Jobs', jobsSummary.total || 0, `${jobsSummary.running || 0} running / ${jobsSummary.failed || 0} failed`, (jobsSummary.failed || 0) > 0 ? 'warning' : 'success', 'Background job summary for async and deferred work.')}
    </div>
    <table>
      <thead><tr><th>Area</th><th>Summary</th><th>Destination</th></tr></thead>
      <tbody>
        <tr><td>Agents</td><td>${agents.length} total • ${agents.filter((agent) => agent.state === 'running').length} running • ${agents.filter((agent) => agent.state === 'idle').length} idle</td><td><a href="#/automations">Open Automations</a></td></tr>
        <tr><td>Security</td><td>${summary ? summary.totalEvents : 0} audit events in the last 5 minutes</td><td><a href="#/security?tab=security-log">Open Security Log</a></td></tr>
        <tr><td>Cloud</td><td>Connections, activity, and cloud automations live in the dedicated Cloud hub</td><td><a href="#/cloud">Open Cloud</a></td></tr>
        <tr><td>Configuration</td><td>Provider setup, integrations, system policy, and appearance live in Config</td><td><a href="#/config">Open Config</a></td></tr>
      </tbody>
    </table>
    <table style="margin-top:1rem;">
      <thead><tr><th>Session</th><th>Status</th><th>Agent</th><th>Provider</th><th>Model</th><th>Last Activity</th></tr></thead>
      <tbody>
        ${recentSessions.length === 0
          ? '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No active agent sessions.</td></tr>'
          : recentSessions.map((session) => {
            const agent = agentMap.get(session.agentId);
            const statusBadgeClass = session.status === 'running'
              ? 'badge-running'
              : session.status === 'queued'
              ? 'badge-queued'
              : 'badge-idle';
            const providerSummary = agent?.provider
              ? `${esc(agent.provider)}${agent.providerType ? ` (${esc(agent.providerType)})` : ''}`
              : '-';
            const modelSummary = agent?.providerModel
              ? `${esc(agent.providerModel)}${agent.providerLocality ? ` • ${esc(agent.providerLocality)}` : ''}`
              : '-';
            const activityTs = session.lastStartedAt || session.lastQueuedAt || session.lastCompletedAt;
            return `
              <tr>
                <td title="${escAttr(`${session.channel}:${session.userId}:${session.agentId}`)}">${esc(session.channel)}:${esc(session.userId)}</td>
                <td><span class="badge ${statusBadgeClass}">${esc(session.status)}</span></td>
                <td>${esc(agent?.name || session.agentId)}</td>
                <td>${providerSummary}</td>
                <td>${modelSummary}</td>
                <td>${activityTs ? esc(formatTime(activityTs)) : '-'}</td>
              </tr>
            `;
          }).join('')}
      </tbody>
    </table>
  `;
  return section;
}

function createQuickLinksSection() {
  const section = document.createElement('div');
  section.className = 'table-container';
  section.innerHTML = `
    <div class="table-header"><h3>Quick Links</h3></div>
    <div class="cards-grid" style="padding:1rem;">
      ${renderQuickLink('Security Log', 'Unified alert queue, triage, and audit evidence', '#/security?tab=security-log', 'warning', 'Open Security > Security Log for triage, acknowledgement, source filtering, and audit review.')}
      ${renderQuickLink('Cloud Hub', 'Connections, activity, and cloud-focused automations', '#/cloud', 'info', 'Open Cloud for provider connections, activity, and cloud automation entry points.')}
      ${renderQuickLink('Automations', 'Workflows, schedules, runs, and output routing', '#/automations', 'accent', 'Open Automations for workflow editing, scheduling, run history, and output routing.')}
      ${renderQuickLink('AI & Search', 'Provider setup, embeddings, and retrieval settings', '#/config?tab=ai-search', 'success', 'Open Configuration > AI & Search for provider, search, and retrieval setup.')}
    </div>
  `;
  return section;
}

function renderMiniCard(title, value, subtitle, tone, tooltip) {
  return `
    <div class="status-card ${tone}" title="${escAttr(tooltip || subtitle)}" aria-label="${escAttr(tooltip || subtitle)}">
      <div class="card-title">${esc(title)}</div>
      <div class="card-value">${esc(String(value))}</div>
      <div class="card-subtitle">${esc(String(subtitle))}</div>
    </div>
  `;
}

function renderQuickLink(title, subtitle, href, tone, tooltip) {
  return `
    <a class="status-card ${tone} status-card-link" href="${escAttr(href)}" style="text-decoration:none" title="${escAttr(tooltip || subtitle)}" aria-label="${escAttr(tooltip || subtitle)}">
      <div class="card-title">${esc(title)}</div>
      <div class="card-value">Open</div>
      <div class="card-subtitle">${esc(subtitle)}</div>
    </a>
  `;
}

function bindCard(card, href) {
  card.classList.add('status-card-link');
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  if (!card.getAttribute('title')) {
    card.setAttribute('title', `Open ${href.replace(/^#\//, '')}`);
  }
  if (!card.getAttribute('aria-label')) {
    card.setAttribute('aria-label', card.getAttribute('title'));
  }
  const action = () => { window.location.hash = href; };
  card.addEventListener('click', action);
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  });
}

function setCardTooltip(card, text) {
  card.setAttribute('title', text);
  card.setAttribute('aria-label', text);
}

function formatTime(timestamp) {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleTimeString();
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

function escAttr(str) {
  return esc(str).replace(/"/g, '&quot;');
}
