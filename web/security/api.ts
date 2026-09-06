import { useCallback, useEffect, useRef, useState } from 'react';
import { saveFile } from '../shared/file-dialogs';

export type RecordData = Record<string, unknown>;
export type Principal = { id: string; role: 'admin' | 'operator' | 'viewer'; scopes: string[]; projectIds?: string[]; expiresAt?: number };
export type Project = { id: string; name: string; revision: number; document: RecordData; createdAt: number | string; updatedAt: number | string };
export const asRecord = (value: unknown): RecordData => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordData : {};
export const asList = (value: unknown): RecordData[] => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as RecordData[] : [];
export const label = (value: unknown, fallback = 'Not reported'): string => typeof value === 'string' || typeof value === 'number' ? String(value) : typeof value === 'boolean' ? value ? 'Yes' : 'No' : fallback;
export const dateLabel = (value: unknown): string => {
  if (typeof value !== 'number' && typeof value !== 'string') return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString();
};
export const canPerform = (principal: Principal, scope: string, write = false): boolean =>
  (!write || principal.role !== 'viewer') && (principal.role === 'admin' || principal.scopes.includes(scope));

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.error) {
    if (response.status === 401) window.dispatchEvent(new Event('guardian-session-expired'));
    throw new Error(body?.error?.message || `Request failed (${response.status}).`);
  }
  return body as T;
}

export async function operation<T = RecordData>(name: string, input: RecordData = {}): Promise<T> {
  const response = await request<{ result: T }>('/api/v1/operations', { method: 'POST', body: JSON.stringify({ operation: name, input }) });
  return response.result;
}

export function useOperation<T>(name: string, initial: T, input: RecordData = {}, enabled = true) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const initialValue = useRef(initial);
  const sequence = useRef(0);
  const serialized = JSON.stringify(input);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    if (!enabled) { setData(initialValue.current); setLoading(false); setError(''); return; }
    setLoading(true);
    setError('');
    try {
      const result = await operation<T>(name, JSON.parse(serialized));
      if (current === sequence.current) setData(result);
    } catch (cause) {
      if (current === sequence.current) setError(cause instanceof Error ? cause.message : 'Unable to load data.');
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [name, serialized, enabled]);
  useEffect(() => { void refresh(); return () => { sequence.current++; }; }, [refresh]);
  return { data, loading, error, refresh, setData };
}

export function downloadJson(name: string, value: unknown): Promise<boolean> {
  const filename = `${name.replace(/[^a-z0-9_-]/gi, '-').slice(0, 100) || 'guardian-system'}.json`;
  return saveFile(filename, async () => {
    const content = typeof value === 'function' ? await value() : value;
    return new Blob([typeof content === 'string' ? content : JSON.stringify(content, null, 2)], { type: 'application/json' });
  });
}
