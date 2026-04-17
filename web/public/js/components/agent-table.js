/**
 * Agent table component — shows agents with state badges.
 */

export function createAgentTable(agents, title = 'Agents') {
  const container = document.createElement('div');
  container.className = 'table-container';
  container.innerHTML = `
    <div class="table-header"><h3>${title}</h3></div>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>State</th>
          <th>Role</th>
          <th>Provider</th>
          <th>Capabilities</th>
        </tr>
      </thead>
      <tbody id="agent-table-body"></tbody>
    </table>
  `;

  const tbody = container.querySelector('#agent-table-body');
  renderRows(tbody, agents);
  return container;
}

export function updateAgentTable(container, agents) {
  const tbody = container.querySelector('#agent-table-body');
  if (tbody) renderRows(tbody, agents);
}

function renderRows(tbody, agents) {
  tbody.innerHTML = agents.map(a => `
    <tr>
      <td>${esc(a.id)}</td>
      <td>${esc(a.name)}</td>
      <td><span class="badge badge-${a.state}">${esc(a.state)}</span></td>
      <td>${esc(a.orchestrationLabel || a.routingRole || '-')}</td>
      <td>${esc(a.provider || '-')}</td>
      <td>${(a.capabilities || []).map(c => esc(c)).join(', ') || '-'}</td>
    </tr>
  `).join('');
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
