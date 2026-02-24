/**
 * Event log component — auto-scrolling event list with badges.
 */

const MAX_ENTRIES = 200;

export function createEventLog(title = 'Event Log') {
  const container = document.createElement('div');
  container.className = 'event-log';
  container.innerHTML = `
    <div class="event-log-header">
      <h3>${title}</h3>
      <button class="btn btn-secondary event-log-pause">Pause</button>
    </div>
    <div class="event-log-body"></div>
  `;

  let paused = false;
  const btn = container.querySelector('.event-log-pause');
  btn.addEventListener('click', () => {
    paused = !paused;
    btn.textContent = paused ? 'Resume' : 'Pause';
  });

  container._paused = () => paused;
  return container;
}

export function appendEvent(container, event) {
  if (container._paused && container._paused()) return;

  const body = container.querySelector('.event-log-body');
  if (!body) return;

  const entry = document.createElement('div');
  entry.className = 'event-entry';

  const time = new Date(event.timestamp).toLocaleTimeString();
  const severityClass = `badge-${event.severity || 'info'}`;

  entry.innerHTML = `
    <span class="event-time">${time}</span>
    <span class="event-type"><span class="badge ${severityClass}">${esc(event.type)}</span></span>
    <span class="event-agent">${esc(event.agentId || '-')}</span>
    <span class="event-detail">${esc(summarizeDetails(event))}</span>
  `;

  body.appendChild(entry);

  // Cap entries
  while (body.children.length > MAX_ENTRIES) {
    body.removeChild(body.firstChild);
  }

  // Auto-scroll
  body.scrollTop = body.scrollHeight;
}

function summarizeDetails(event) {
  if (event.controller) return event.controller;
  if (event.details) {
    const d = event.details;
    if (d.reason) return String(d.reason);
    if (d.error) return String(d.error);
    if (d.pattern) return String(d.pattern);
    return JSON.stringify(d).slice(0, 80);
  }
  return '';
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
