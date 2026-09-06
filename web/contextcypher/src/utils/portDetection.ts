// The editor belongs to the Guardian origin and never probes other local services.
export interface ServerInfo { port: number; url: string; status: 'ok' | 'error' }
export async function detectServerPort(): Promise<ServerInfo> {
  const response = await fetch('/health', { credentials: 'same-origin', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Guardian health check failed (${response.status})`);
  return { port: Number(location.port || (location.protocol === 'https:' ? 443 : 80)), url: location.origin, status: 'ok' };
}
export async function getServerUrl(): Promise<string> { return (await detectServerPort()).url; }
export function clearCachedPort(): void { sessionStorage.removeItem('contextcypher_server_port'); }
