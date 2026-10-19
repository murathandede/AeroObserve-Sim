import { useId, type ReactNode } from 'react';
import type { ReaderError } from '../../shared/types';

export function Panel({ title, label, className = '', children }: {
  title: string; label: string; className?: string; children: ReactNode;
}) {
  const titleId = useId();
  return <section className={`panel recording-panel ${className}`} aria-labelledby={titleId}>
    <div className="recording-panel-heading"><p className="recording-kicker">{label}</p><h2 id={titleId}>{title}</h2></div>
    {children}
  </section>;
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="recording-empty"><strong>{title}</strong><p>{children}</p></div>;
}

export function ReaderErrorNotice({ error }: { error: ReaderError }) {
  return <div role="alert" className="recording-error">
    <strong>{error.code} · {error.message}</strong><p>{error.recovery}</p>
    {error.file && <p className="recording-file">Dosya: {error.file}</p>}
  </div>;
}
