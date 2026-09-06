import { saveExport } from './exportUtils';

// Browser-based console logger that keeps logs in memory only.
// Replaces Tauri file system logging without persisting log contents in web storage.

const MAX_LOG_ENTRIES = 100;
const LEGACY_STORAGE_KEY = 'contextcypher_console_logs';
let logBuffer: string[] = [];
let isInitialized = false;

// Override console methods to capture logs
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug
};

const SENSITIVE_PATTERN = /sk-[a-zA-Z0-9]{20,}|key-[a-zA-Z0-9]{20,}|Bearer\s+[a-zA-Z0-9._-]{20,}/g;
const SENSITIVE_KEYS = /api[_-]?key|secret|password|token|authorization|credential|private[_-]?key/i;

function redactString(str: string): string {
  return str.replace(SENSITIVE_PATTERN, '[REDACTED]');
}

function redactValue(value: any): any {
  if (typeof value === 'string') {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce<Record<string, any>>((acc, [key, entryValue]) => {
      acc[key] = SENSITIVE_KEYS.test(key) ? '[REDACTED]' : redactValue(entryValue);
      return acc;
    }, {});
  }

  return value;
}

function formatLogEntry(level: string, args: any[]): string {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        const serialized = JSON.stringify(redactValue(arg));
        if (serialized.length > 1000) {
          return `${serialized.slice(0, 1000)}... [truncated ${serialized.length - 1000} chars]`;
        }
        return serialized;
      } catch (e) {
        return String(arg);
      }
    }
    return redactString(String(arg));
  }).join(' ');

  return `[${timestamp}] [${level}] ${message}`;
}

function clearLegacyStoredLogs() {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (error) {
    originalConsole.error('Failed to clear legacy console logs from storage:', error);
  }
}

function addToLogBuffer(entry: string) {
  logBuffer.push(entry);
  
  // Keep only last MAX_LOG_ENTRIES
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer = logBuffer.slice(-MAX_LOG_ENTRIES);
  }
}

// Initialize console interceptors
export function initializeConsoleLogger() {
  if (isInitialized) return;
  
  // Remove any legacy persisted logs from older builds.
  clearLegacyStoredLogs();
  
  console.log = (...args: any[]) => {
    originalConsole.log(...args);
    addToLogBuffer(formatLogEntry('LOG', args));
  };
  
  console.error = (...args: any[]) => {
    originalConsole.error(...args);
    addToLogBuffer(formatLogEntry('ERROR', args));
  };
  
  console.warn = (...args: any[]) => {
    originalConsole.warn(...args);
    addToLogBuffer(formatLogEntry('WARN', args));
  };
  
  console.info = (...args: any[]) => {
    originalConsole.info(...args);
    addToLogBuffer(formatLogEntry('INFO', args));
  };
  
  console.debug = (...args: any[]) => {
    originalConsole.debug(...args);
    addToLogBuffer(formatLogEntry('DEBUG', args));
  };

  // Log initialization with timestamp and environment info
  const initTime = new Date().toISOString();
  console.log(`[${initTime}] Browser console logger initialized`);
  console.log(`[${initTime}] Environment: ${process.env.NODE_ENV}`);
  console.log(`[${initTime}] Browser mode: Yes`);
  console.log(`[${initTime}] Console logs are kept in memory for the current session only`);
  
  isInitialized = true;
}

// Export function to get current logs
export function getConsoleLogs(): string[] {
  return [...logBuffer];
}

// Export function to clear logs
export function clearConsoleLogs(): void {
  logBuffer = [];
  clearLegacyStoredLogs();
}

// Export function to download logs as a file
export function downloadConsoleLogs(): Promise<boolean> {
  const logs = logBuffer.join('\n');
  const blob = new Blob([logs], { type: 'text/plain' });
  return saveExport(`contextcypher-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`, blob);
}

// Export original console for debugging
export { originalConsole };
