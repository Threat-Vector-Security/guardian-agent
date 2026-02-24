/**
 * Status card component — title/value/subtitle with color class.
 */

export function createStatusCard(title, value, subtitle, colorClass = '') {
  const card = document.createElement('div');
  card.className = `status-card ${colorClass}`;
  card.innerHTML = `
    <div class="card-title">${escapeHtml(title)}</div>
    <div class="card-value">${escapeHtml(String(value))}</div>
    <div class="card-subtitle">${escapeHtml(subtitle)}</div>
  `;
  return card;
}

export function updateStatusCard(card, value, subtitle) {
  const valueEl = card.querySelector('.card-value');
  const subtitleEl = card.querySelector('.card-subtitle');
  if (valueEl) valueEl.textContent = String(value);
  if (subtitleEl) subtitleEl.textContent = subtitle;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
