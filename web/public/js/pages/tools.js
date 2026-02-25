/**
 * Tools page — tool catalog, policy config, approvals, and job history.
 */

import { api } from '../api.js';
import { applyInputTooltips } from '../tooltip.js';

let lastRunNotice = null;
let lastPolicyNotice = null;

export async function renderTools(container) {
  container.innerHTML = '<h2 class="page-title">Tools</h2><div class="loading">Loading...</div>';

  try {
    const state = await api.toolsState(80);
    const tools = state.tools || [];
    const policy = state.policy || { mode: 'approve_by_policy', toolPolicies: {}, sandbox: { allowedPaths: [], allowedCommands: [], allowedDomains: [] } };
    const approvals = state.approvals || [];
    const jobs = state.jobs || [];

    container.innerHTML = `
      <h2 class="page-title">Tools</h2>

      <div class="intel-summary-grid">
        <div class="status-card ${state.enabled ? 'success' : 'error'}">
          <div class="card-title">Tool Runtime</div>
          <div class="card-value">${state.enabled ? 'Enabled' : 'Disabled'}</div>
          <div class="card-subtitle">Assistant + manual task execution</div>
        </div>
        <div class="status-card info">
          <div class="card-title">Catalog</div>
          <div class="card-value">${tools.length}</div>
          <div class="card-subtitle">Available tools</div>
        </div>
        <div class="status-card warning">
          <div class="card-title">Pending Approvals</div>
          <div class="card-value">${approvals.filter((a) => a.status === 'pending').length}</div>
          <div class="card-subtitle">Manual decisions required</div>
        </div>
        <div class="status-card accent">
          <div class="card-title">Recent Jobs</div>
          <div class="card-value">${jobs.length}</div>
          <div class="card-subtitle">Execution history</div>
        </div>
      </div>

      <div class="table-container">
        <div class="table-header">
          <h3>Run Tool</h3>
          <button class="btn btn-secondary" id="tools-refresh" style="font-size:0.75rem;padding:0.35rem 0.65rem;">Refresh</button>
        </div>
        <div class="intel-controls">
          <div class="intel-control-row">
            <label>Tool</label>
            <select id="tools-run-name">
              ${tools.map((tool) => `<option value="${esc(tool.name)}">${esc(tool.name)} (${esc(tool.risk)})</option>`).join('')}
            </select>
            <label>Origin</label>
            <select id="tools-run-origin">
              <option value="web" selected>web</option>
              <option value="cli">cli</option>
              <option value="assistant">assistant</option>
            </select>
            <button class="btn btn-primary" id="tools-run-btn">Run</button>
          </div>
          <div class="intel-control-row">
            <label>Arguments JSON</label>
            <textarea id="tools-run-args" rows="5" style="flex:1;min-height:96px;" placeholder='{"path":"docs"}'></textarea>
          </div>
          <div id="tools-run-status" class="intel-status">Ready.</div>
        </div>
      </div>

      <div class="table-container">
        <div class="table-header"><h3>Policy & Sandbox</h3></div>
        <div class="intel-controls">
          <div class="intel-control-row">
            <label>Mode</label>
            <select id="tools-policy-mode">
              <option value="approve_each" ${policy.mode === 'approve_each' ? 'selected' : ''}>approve_each</option>
              <option value="approve_by_policy" ${policy.mode === 'approve_by_policy' ? 'selected' : ''}>approve_by_policy</option>
              <option value="autonomous" ${policy.mode === 'autonomous' ? 'selected' : ''}>autonomous</option>
            </select>
            <button class="btn btn-secondary" id="tools-policy-save">Save Policy</button>
          </div>
          <div class="intel-control-row">
            <label>Allowed Paths (comma-separated)</label>
            <input id="tools-policy-paths" type="text" value="${esc((policy.sandbox?.allowedPaths || []).join(', '))}">
          </div>
          <div class="intel-control-row">
            <label>Allowed Commands (comma-separated prefixes)</label>
            <input id="tools-policy-commands" type="text" value="${esc((policy.sandbox?.allowedCommands || []).join(', '))}">
          </div>
          <div class="intel-control-row">
            <label>Allowed Domains (comma-separated)</label>
            <input id="tools-policy-domains" type="text" value="${esc((policy.sandbox?.allowedDomains || []).join(', '))}">
          </div>
          <div id="tools-policy-status" class="intel-status">Policy loaded.</div>
        </div>
      </div>

      <div class="table-container">
        <div class="table-header"><h3>Tool Catalog</h3></div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Risk</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${tools.length === 0
              ? '<tr><td colspan="3">No tools registered.</td></tr>'
              : tools.map((tool) => `
                <tr>
                  <td>${esc(tool.name)}</td>
                  <td><span class="badge ${riskClass(tool.risk)}">${esc(tool.risk)}</span></td>
                  <td>${esc(tool.description)}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>

      <div class="table-container">
        <div class="table-header"><h3>Pending Approvals</h3></div>
        <table>
          <thead>
            <tr>
              <th>Approval</th>
              <th>Tool</th>
              <th>Risk</th>
              <th>Origin</th>
              <th>Created</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            ${approvals.length === 0
              ? '<tr><td colspan="6">No approvals.</td></tr>'
              : approvals.map((approval) => `
                <tr>
                  <td title="${esc(approval.id)}">${esc(shortId(approval.id))}</td>
                  <td>${esc(approval.toolName)}</td>
                  <td>${esc(approval.risk)}</td>
                  <td>${esc(approval.origin)}</td>
                  <td>${esc(formatDate(approval.createdAt))}</td>
                  <td>
                    ${approval.status === 'pending' ? `
                      <button class="btn btn-secondary tool-approve" data-approval-id="${escAttr(approval.id)}" data-decision="approved">Approve</button>
                      <button class="btn btn-secondary tool-approve" data-approval-id="${escAttr(approval.id)}" data-decision="denied">Deny</button>
                    ` : `<span class="badge ${approval.status === 'approved' ? 'badge-running' : 'badge-errored'}">${esc(approval.status)}</span>`}
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>

      <div class="table-container">
        <div class="table-header"><h3>Recent Tool Jobs</h3></div>
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Tool</th>
              <th>Status</th>
              <th>Origin</th>
              <th>Created</th>
              <th>Duration</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            ${jobs.length === 0
              ? '<tr><td colspan="7">No tool jobs yet.</td></tr>'
              : jobs.map((job) => `
                <tr>
                  <td title="${esc(job.id)}">${esc(shortId(job.id))}</td>
                  <td>${esc(job.toolName)}</td>
                  <td><span class="badge ${statusClass(job.status)}">${esc(job.status)}</span></td>
                  <td>${esc(job.origin)}</td>
                  <td>${esc(formatDate(job.createdAt))}</td>
                  <td>${job.durationMs ? `${job.durationMs}ms` : '-'}</td>
                  <td>${esc(job.error || job.resultPreview || job.argsPreview || '-')}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const runStatus = container.querySelector('#tools-run-status');
    const policyStatus = container.querySelector('#tools-policy-status');
    const setRunStatus = (text, color = 'var(--text-muted)') => {
      runStatus.textContent = text;
      runStatus.style.color = color;
    };
    const setPolicyStatus = (text, color = 'var(--text-muted)') => {
      policyStatus.textContent = text;
      policyStatus.style.color = color;
    };

    if (lastRunNotice) {
      setRunStatus(lastRunNotice.text, lastRunNotice.color);
    }
    if (lastPolicyNotice) {
      setPolicyStatus(lastPolicyNotice.text, lastPolicyNotice.color);
    }

    container.querySelector('#tools-refresh')?.addEventListener('click', () => renderTools(container));

    container.querySelector('#tools-run-btn')?.addEventListener('click', async () => {
      const toolName = container.querySelector('#tools-run-name').value;
      const origin = container.querySelector('#tools-run-origin').value;
      const argsRaw = container.querySelector('#tools-run-args').value.trim();
      let args = {};
      if (argsRaw) {
        try {
          args = JSON.parse(argsRaw);
        } catch {
          setRunStatus('Invalid JSON in tool arguments.', 'var(--error)');
          return;
        }
      }
      setRunStatus('Running tool...', 'var(--text-muted)');
      try {
        const result = await api.runTool({ toolName, args, origin, channel: 'web', userId: 'web-user' });
        const statusColor = result.success ? 'var(--success)' : (result.status === 'pending_approval' ? 'var(--warning)' : 'var(--error)');
        const extra = result.approvalId ? ` (approval ${result.approvalId.slice(0, 8)})` : '';
        setRunStatus(`${result.message}${extra}`, statusColor);
        lastRunNotice = { text: `${result.message}${extra}`, color: statusColor };
        await renderTools(container);
      } catch (err) {
        lastRunNotice = null;
        setRunStatus(err.message || 'Tool run failed.', 'var(--error)');
      }
    });

    container.querySelector('#tools-policy-save')?.addEventListener('click', async () => {
      const mode = container.querySelector('#tools-policy-mode').value;
      const allowedPaths = splitCsv(container.querySelector('#tools-policy-paths').value);
      const allowedCommands = splitCsv(container.querySelector('#tools-policy-commands').value);
      const allowedDomains = splitCsv(container.querySelector('#tools-policy-domains').value);
      try {
        const result = await api.updateToolPolicy({
          mode,
          sandbox: { allowedPaths, allowedCommands, allowedDomains },
        });
        if (!result.success) {
          lastPolicyNotice = null;
          setPolicyStatus(result.message || 'Policy update failed.', 'var(--error)');
          return;
        }
        const pathCount = result.policy?.sandbox?.allowedPaths?.length;
        const suffix = Number.isFinite(pathCount) ? ` (${pathCount} allowed path${pathCount === 1 ? '' : 's'})` : '';
        const text = `${result.message || 'Policy updated.'}${suffix}`;
        setPolicyStatus(text, 'var(--success)');
        lastPolicyNotice = { text, color: 'var(--success)' };
        await renderTools(container);
      } catch (err) {
        lastPolicyNotice = null;
        setPolicyStatus(err.message || 'Policy update failed.', 'var(--error)');
      }
    });

    container.querySelectorAll('.tool-approve').forEach((button) => {
      button.addEventListener('click', async () => {
        const approvalId = button.getAttribute('data-approval-id');
        const decision = button.getAttribute('data-decision');
        if (!approvalId || !decision) return;
        try {
          const result = await api.decideToolApproval({
            approvalId,
            decision,
            actor: 'web-user',
          });
          setRunStatus(result.message || 'Decision recorded.', result.success ? 'var(--success)' : 'var(--error)');
          await renderTools(container);
        } catch (err) {
          setRunStatus(err.message || 'Failed to update approval.', 'var(--error)');
        }
      });
    });

    applyInputTooltips(container);
  } catch (err) {
    container.innerHTML = `<h2 class="page-title">Tools</h2><div class="loading">Error: ${esc(err.message || String(err))}</div>`;
  }
}

function splitCsv(raw) {
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function shortId(id) {
  return id?.slice(0, 8) || '';
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString();
}

function riskClass(risk) {
  if (risk === 'external_post') return 'badge-critical';
  if (risk === 'mutating') return 'badge-errored';
  if (risk === 'network') return 'badge-warn';
  return 'badge-info';
}

function statusClass(status) {
  if (status === 'succeeded') return 'badge-running';
  if (status === 'pending_approval') return 'badge-warn';
  if (status === 'running') return 'badge-running';
  if (status === 'failed' || status === 'denied') return 'badge-errored';
  return 'badge-idle';
}

function esc(value) {
  const d = document.createElement('div');
  d.textContent = value == null ? '' : String(value);
  return d.innerHTML;
}

function escAttr(value) {
  return esc(value).replace(/"/g, '&quot;');
}
