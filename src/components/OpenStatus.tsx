'use client';

import { useEffect, useState } from 'react';
import { openStatus } from '@/lib/hours';
import type { PublicLocation } from '@/lib/data';

// Status liczony w przeglądarce, żeby był aktualny także na stronach z cache
export function OpenStatus({ location, className = '' }: { location: Pick<PublicLocation, 'schedule' | 'exceptions' | 'active'>; className?: string }) {
  const [s, setS] = useState(() => openStatus(location));
  useEffect(() => {
    setS(openStatus(location));
    const id = setInterval(() => setS(openStatus(location)), 60_000);
    return () => clearInterval(id);
  }, [location]);
  return (
    <span className={`row ${className}`} style={{ '--gap': '8px', display: 'inline-flex' } as React.CSSProperties} suppressHydrationWarning>
      <span className={`dot ${s.open ? 'status-open' : 'status-closed'}`} />
      <span suppressHydrationWarning>{s.label}</span>
    </span>
  );
}
