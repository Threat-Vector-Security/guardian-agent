function readDuration(entry, key) {
  const value = entry?.details?.[key];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

function rounded(value) {
  return value === null ? null : Math.round(value);
}

function numericValues(samples, key) {
  return samples
    .map((sample) => sample[key])
    .filter((value) => typeof value === 'number' && Number.isFinite(value));
}

export function summarizeRoutingLatency(entries = []) {
  const samples = entries
    .map((entry) => ({
      total: readDuration(entry, 'totalDispatchDurationMs'),
      runtime: readDuration(entry, 'runtimeDispatchDurationMs'),
      gateway: readDuration(entry, 'intentGatewayLatencyMs'),
      fallback: readDuration(entry, 'fallbackRuntimeDispatchDurationMs'),
    }))
    .filter((sample) => sample.total !== null);

  if (samples.length === 0) {
    return null;
  }

  const totals = numericValues(samples, 'total');
  const runtimes = numericValues(samples, 'runtime');
  const gateways = numericValues(samples, 'gateway');

  return {
    sampleCount: samples.length,
    avgTotalMs: rounded(average(totals)),
    p95TotalMs: rounded(percentile(totals, 95)),
    maxTotalMs: rounded(Math.max(...totals)),
    avgRuntimeMs: rounded(average(runtimes)),
    avgGatewayMs: rounded(average(gateways)),
    fallbackCount: samples.filter((sample) => sample.fallback !== null).length,
  };
}
