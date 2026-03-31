function normalizeLocality(locality) {
  return locality === 'local' || locality === 'external' || locality === 'fallback'
    ? locality
    : null;
}

export function describeResponseSource(value) {
  const locality = normalizeLocality(value?.locality) || 'system';
  const providerName = typeof value?.providerName === 'string' && value.providerName.trim()
    ? value.providerName.trim()
    : '';
  const tier = value?.tier === 'local' || value?.tier === 'external'
    ? value.tier
    : '';
  const usedFallback = value?.usedFallback === true;
  const notice = typeof value?.notice === 'string' && value.notice.trim()
    ? value.notice.trim()
    : '';
  const labelParts = [locality];
  if (providerName) {
    labelParts.push(providerName);
  }
  if (usedFallback) {
    labelParts.push('fallback');
  }
  const titleParts = [];
  if (notice) titleParts.push(notice);
  if (tier && tier !== locality) {
    titleParts.push(`Requested ${tier} route.`);
  }
  return {
    locality,
    providerName,
    tier,
    usedFallback,
    notice,
    label: labelParts.join(' · '),
    title: titleParts.join(' '),
  };
}

export function createResponseSourceBadge(value) {
  const source = describeResponseSource(value);
  const badge = document.createElement('div');
  badge.className = 'chat-msg-source';
  badge.textContent = source.label;
  if (source.title) {
    badge.title = source.title;
  }
  return badge;
}

export function renderResponseSourceBadgeMarkup(value, esc, escAttr) {
  const source = describeResponseSource(value);
  const titleAttr = source.title ? ` title="${escAttr(source.title)}"` : '';
  return `<div class="chat-msg-source"${titleAttr}>${esc(source.label)}</div>`;
}
