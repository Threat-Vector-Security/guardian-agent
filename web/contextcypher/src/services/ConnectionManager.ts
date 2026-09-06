import { detectServerPort } from '../utils/portDetection';
export interface ConnectionStatus {
  connected: boolean; retrying: boolean; lastError?: string; retryCount: number;
  serverUrl?: string; isInitialStartup?: boolean;
}
class ConnectionManager {
  static getInstance(): ConnectionManager { return connectionManager; }
  private status: ConnectionStatus = { connected: false, retrying: false, retryCount: 0, isInitialStartup: true };
  private callbacks = new Set<(status: ConnectionStatus) => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private checking = false;
  constructor() { void this.reconnect(); }
  subscribe(callback: (status: ConnectionStatus) => void): () => void {
    this.callbacks.add(callback); callback(this.status); return () => { this.callbacks.delete(callback); };
  }
  private update(value: Partial<ConnectionStatus>) {
    this.status = { ...this.status, ...value }; this.callbacks.forEach(callback => callback(this.status));
  }
  getStatus(): ConnectionStatus { return this.status; }
  isConnected(): boolean { return this.status.connected; }
  getServerUrl(): string | undefined { return this.status.serverUrl; }
  async reconnect(): Promise<void> {
    if (this.checking) return;
    this.checking = true; clearTimeout(this.timer);
    try {
      const server = await detectServerPort();
      this.update({ connected: true, retrying: false, retryCount: 0, lastError: undefined, serverUrl: server.url, isInitialStartup: false });
    } catch (error) {
      this.update({ connected: false, retrying: true, retryCount: this.status.retryCount + 1, lastError: error instanceof Error ? error.message : 'Guardian is unavailable', isInitialStartup: false });
    } finally {
      this.checking = false;
      this.timer = setTimeout(() => { void this.reconnect(); }, this.status.connected ? 30000 : 10000);
    }
  }
  handleConnectionError(error: Error) { this.update({ connected: false, lastError: error.message }); void this.reconnect(); }
  destroy() { clearTimeout(this.timer); this.callbacks.clear(); }
}
export const connectionManager = new ConnectionManager();
export default ConnectionManager;
