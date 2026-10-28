import Link from 'next/link';
import { Icon } from '../Icon';

export function AppTop({ title, back, right }: { title: string; back?: string; right?: React.ReactNode }) {
  return (
    <header className="app-top">
      <div className="row" style={{ '--gap': '8px', flexWrap: 'nowrap' } as React.CSSProperties}>
        {back ? (
          <Link href={back} className="btn btn-ghost btn-icon btn-sm" aria-label="Wstecz">
            <Icon name="chevron-left" size={18} />
          </Link>
        ) : (
          <Link href="/" className="logo" style={{ fontSize: '1.2rem' }} aria-label="Strona główna Milkshakebar">
            MilkMi<span className="dot-accent">.</span>
          </Link>
        )}
        {back ? <strong>{title}</strong> : null}
      </div>
      {right}
    </header>
  );
}
