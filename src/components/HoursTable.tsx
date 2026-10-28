'use client';

import { useEffect, useState } from 'react';
import { WEEK_ORDER, WEEK_LABELS, localParts } from '@/lib/hours';
import type { PublicLocation } from '@/lib/data';

const EN: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

export function HoursTable({ location, lang = 'pl' }: { location: Pick<PublicLocation, 'schedule' | 'exceptions'>; lang?: 'pl' | 'en' }) {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(localParts().weekday), []);
  const upcoming = (location.exceptions || []).filter((e) => e.date >= localParts().date).slice(0, 3);
  return (
    <>
      <table className="hours-table">
        <tbody>
          {WEEK_ORDER.map((k) => {
            const d = location.schedule?.[k];
            return (
              <tr key={k} data-today={today === k}>
                <td>{lang === 'en' ? EN[k] : WEEK_LABELS[k]}</td>
                <td>{d && d.isOpen ? `${d.from}–${d.to}` : lang === 'en' ? 'closed' : 'nieczynne'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {upcoming.length ? (
        <div className="alert alert-info mt-2 small">
          {upcoming.map((e) => (
            <div key={e.date}>
              {e.date.split('-').reverse().join('.')}: {e.closed ? 'nieczynne' : `${e.from}–${e.to}`} {e.note ? `· ${e.note}` : ''}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
