const SAFE_WORKING_LABELS = [
  { afterMs: 30_000, label: 'Still working; this one is taking longer…' },
  { afterMs: 12_000, label: 'Still working; waiting on tools or provider…' },
  { afterMs: 6_000, label: 'Working with the selected model…' },
  { afterMs: 2_000, label: 'Checking route and context…' },
  { afterMs: 0, label: 'Reading the request…' },
];

const SAFE_APPROVAL_LABELS = [
  { afterMs: 30_000, label: 'Still working; this continuation is taking longer…' },
  { afterMs: 12_000, label: 'Still working; waiting on tools or provider…' },
  { afterMs: 6_000, label: 'Resuming the approved work…' },
  { afterMs: 2_000, label: 'Checking continuation context…' },
  { afterMs: 0, label: 'Continuing after approval…' },
];

export function resolveSafeWorkingLabel(elapsedMs, options = {}) {
  const elapsed = typeof elapsedMs === 'number' && Number.isFinite(elapsedMs)
    ? Math.max(0, elapsedMs)
    : 0;
  const labels = options?.mode === 'approval' ? SAFE_APPROVAL_LABELS : SAFE_WORKING_LABELS;
  return labels.find((entry) => elapsed >= entry.afterMs)?.label ?? 'Working…';
}
