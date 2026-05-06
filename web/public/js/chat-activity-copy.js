const SAFE_WORKING_LABELS = [
  {
    afterMs: 30_000,
    label: 'Still working; this one is taking longer…',
    detail: 'The request is still active, likely waiting on tools or a provider.',
  },
  {
    afterMs: 12_000,
    label: 'Still working; waiting on tools or provider…',
    detail: 'Keeping the request open while external work finishes.',
  },
  {
    afterMs: 6_000,
    label: 'Working with the selected model…',
    detail: 'Preparing the answer or tool plan.',
  },
  {
    afterMs: 2_000,
    label: 'Checking route and context…',
    detail: 'Choosing the right lane and loading the relevant context.',
  },
  {
    afterMs: 0,
    label: 'Reading the request…',
    detail: 'Reviewing the message and recent context.',
  },
];

const SAFE_APPROVAL_LABELS = [
  {
    afterMs: 30_000,
    label: 'Still working; this continuation is taking longer…',
    detail: 'The approved work is still active, likely waiting on tools or a provider.',
  },
  {
    afterMs: 12_000,
    label: 'Still working; waiting on tools or provider…',
    detail: 'Keeping the continuation open while external work finishes.',
  },
  {
    afterMs: 6_000,
    label: 'Resuming the approved work…',
    detail: 'Continuing the request after the approved action.',
  },
  {
    afterMs: 2_000,
    label: 'Checking continuation context…',
    detail: 'Reconnecting the approval to the current request.',
  },
  {
    afterMs: 0,
    label: 'Continuing after approval…',
    detail: 'Applying the approval and preparing the continuation.',
  },
];

function normalizeElapsed(elapsedMs) {
  return typeof elapsedMs === 'number' && Number.isFinite(elapsedMs)
    ? Math.max(0, elapsedMs)
    : 0;
}

function selectSafeWorkingEntry(elapsedMs, options = {}) {
  const elapsed = normalizeElapsed(elapsedMs);
  const labels = options?.mode === 'approval' ? SAFE_APPROVAL_LABELS : SAFE_WORKING_LABELS;
  return labels.find((entry) => elapsed >= entry.afterMs) ?? labels[labels.length - 1];
}

export function resolveSafeWorkingLabel(elapsedMs, options = {}) {
  return selectSafeWorkingEntry(elapsedMs, options)?.label ?? 'Working…';
}

export function resolveSafeWorkingActivity(elapsedMs, options = {}) {
  const entry = selectSafeWorkingEntry(elapsedMs, options);
  const label = entry?.label ?? 'Working…';
  const detail = entry?.detail ?? '';
  return {
    label,
    items: detail
      ? [{ title: label, detail }]
      : [{ title: label, detail: '' }],
  };
}
