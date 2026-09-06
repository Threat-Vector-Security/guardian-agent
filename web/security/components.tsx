import type { ReactNode } from 'react';
import { AlertCircle, FileSearch, RefreshCw } from 'lucide-react';
import { label, type RecordData } from './api';

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><FileSearch size={30} strokeWidth={1.3} /><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? <div className="notice error" role="alert"><AlertCircle size={17} /><span>{message}</span></div> : null;
}
export function Status({ value }: { value: unknown }) {
  const text = label(value, 'Unknown');
  const normalized = text.toLowerCase();
  const tone = ['critical', 'high', 'failed', 'error', 'blocked'].includes(normalized) ? 'danger' : ['pending', 'pending_approval', 'awaiting_approval', 'medium', 'warning'].includes(normalized) ? 'warning' : ['completed', 'resolved', 'connected', 'available'].includes(normalized) ? 'success' : '';
  return <span className={`status ${tone}`}><span />{text.replaceAll('_', ' ')}</span>;
}
export function PageTitle({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="page-title"><div><h1>{title}</h1><p>{description}</p></div>{children && <div className="actions">{children}</div>}</div>;
}
export function Refresh({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return <button className="quiet" onClick={onClick} disabled={loading}><RefreshCw size={15} className={loading ? 'spinning' : ''} />Refresh</button>;
}
export function Evidence({ value, title = 'Recorded evidence' }: { value: unknown; title?: string }) {
  return <details className="evidence"><summary>{title}</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>;
}
export function Facts({ value }: { value: RecordData }) {
  const fields = Object.entries(value).filter(([, item]) => ['string', 'boolean', 'number'].includes(typeof item));
  return fields.length ? <dl className="facts">{fields.map(([key, item]) => <div key={key}><dt>{key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ')}</dt><dd>{label(item)}</dd></div>)}</dl> : <p className="muted">No summary reported.</p>;
}
