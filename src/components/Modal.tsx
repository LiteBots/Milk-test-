'use client';

import { useEffect, useRef } from 'react';
import { Icon } from './Icon';

// Okno dialogowe / arkusz od dołu na telefonie; Esc i kliknięcie w tło zamykają
export function Modal({ open, onClose, title, children, footer, wide = false }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector<HTMLElement>('button, input, select, textarea, a')?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sheet ${wide ? 'sheet-wide' : ''}`} role="dialog" aria-modal="true" ref={ref}>
        <div className="sheet-head">
          <strong style={{ fontSize: '1.05rem' }}>{title}</strong>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Zamknij">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer ? <div className="sheet-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
