function normalizeTrackingValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function matchesRunTimelineRequest(detail, expected = {}) {
  const runId = normalizeTrackingValue(detail?.summary?.runId);
  const parentRunId = normalizeTrackingValue(detail?.summary?.parentRunId);
  const executionId = normalizeTrackingValue(detail?.summary?.executionId);
  const parentExecutionId = normalizeTrackingValue(detail?.summary?.parentExecutionId);
  const rootExecutionId = normalizeTrackingValue(detail?.summary?.rootExecutionId);
  const eventCodeSessionId = normalizeTrackingValue(detail?.summary?.codeSessionId);
  const requestId = normalizeTrackingValue(expected?.requestId);
  const expectedExecutionId = normalizeTrackingValue(expected?.executionId) || requestId;
  const codeSessionId = normalizeTrackingValue(expected?.codeSessionId);

  if (expectedExecutionId) {
    const correlated = [
      runId,
      parentRunId,
      executionId,
      parentExecutionId,
      rootExecutionId,
    ].some((value) => value === expectedExecutionId);
    if (!correlated) return false;
    if (codeSessionId && eventCodeSessionId && eventCodeSessionId !== codeSessionId) return false;
    return true;
  }

  if (codeSessionId) {
    return eventCodeSessionId === codeSessionId;
  }

  return false;
}
