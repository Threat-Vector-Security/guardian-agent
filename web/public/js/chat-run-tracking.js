function normalizeTrackingValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function matchesRunTimelineRequest(detail, expected = {}) {
  const runId = normalizeTrackingValue(detail?.summary?.runId);
  const parentRunId = normalizeTrackingValue(detail?.summary?.parentRunId);
  const eventCodeSessionId = normalizeTrackingValue(detail?.summary?.codeSessionId);
  const requestId = normalizeTrackingValue(expected?.requestId);
  const codeSessionId = normalizeTrackingValue(expected?.codeSessionId);

  if (requestId) {
    if (runId !== requestId && parentRunId !== requestId) return false;
    if (codeSessionId && eventCodeSessionId && eventCodeSessionId !== codeSessionId) return false;
    return true;
  }

  if (codeSessionId) {
    return eventCodeSessionId === codeSessionId;
  }

  return false;
}
