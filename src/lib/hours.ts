import type { ILocation, WeekKey, DayHours } from './models/core';

// Wszystkie obliczenia godzin w strefie lokalu (Europe/Warsaw), niezależnie od strefy serwera
export const TZ = 'Europe/Warsaw';
const WEEK: WeekKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const WEEK_LABELS: Record<WeekKey, string> = {
  mon: 'Poniedziałek',
  tue: 'Wtorek',
  wed: 'Środa',
  thu: 'Czwartek',
  fri: 'Piątek',
  sat: 'Sobota',
  sun: 'Niedziela'
};
export const WEEK_ORDER: WeekKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const ON_DAY: Record<WeekKey, string> = { mon: 'w poniedziałek', tue: 'we wtorek', wed: 'w środę', thu: 'w czwartek', fri: 'w piątek', sat: 'w sobotę', sun: 'w niedzielę' };

export interface LocalNow {
  date: string; // YYYY-MM-DD
  minutes: number; // minuty od północy
  weekday: WeekKey;
}

export function localParts(d: Date = new Date()): LocalNow {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23'
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const wd = String(p.weekday).toLowerCase().slice(0, 3) as WeekKey;
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute), weekday: wd };
}

export const toMin = (hhmm: string) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const toHHMM = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function weekdayOf(dateStr: string): WeekKey {
  const [y, m, d] = dateStr.split('-').map(Number);
  return WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function addDays(dateStr: string, n: number) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

type HoursSource = Pick<ILocation, 'schedule' | 'exceptions' | 'active'>;

// Godziny dla konkretnej daty z uwzględnieniem wyjątków (święta, sezon)
export function hoursForDate(loc: HoursSource, dateStr: string): (DayHours & { note?: string }) | null {
  if (loc.active === false) return null;
  const ex = (loc.exceptions || []).find((e) => e.date === dateStr);
  if (ex) {
    if (ex.closed) return null;
    return { isOpen: true, from: ex.from || '10:00', to: ex.to || '22:00', note: ex.note };
  }
  const d = loc.schedule?.[weekdayOf(dateStr)];
  if (!d || !d.isOpen) return null;
  return d;
}

export interface OpenStatus {
  open: boolean;
  label: string; // „Otwarte do 22:00” / „Zamknięte · otwieramy jutro o 10:00”
  todayHours: string | null;
}

export function openStatus(loc: HoursSource, now: LocalNow = localParts()): OpenStatus {
  const today = hoursForDate(loc, now.date);
  if (today) {
    const from = toMin(today.from);
    let to = toMin(today.to);
    if (to <= from) to += 24 * 60;
    const todayHours = `${today.from}–${today.to}`;
    if (now.minutes >= from && now.minutes < to) return { open: true, label: `Otwarte do ${today.to}`, todayHours };
    if (now.minutes < from) return { open: false, label: `Zamknięte · otwieramy dziś o ${today.from}`, todayHours };
  }
  for (let i = 1; i <= 14; i++) {
    const date = addDays(now.date, i);
    const h = hoursForDate(loc, date);
    if (h) {
      const when = i === 1 ? 'jutro' : ON_DAY[weekdayOf(date)];
      return { open: false, label: `Zamknięte · otwieramy ${when} o ${h.from}`, todayHours: today ? `${today.from}–${today.to}` : null };
    }
  }
  return { open: false, label: 'Chwilowo zamknięte', todayHours: null };
}

// Sloty odbioru: od teraz + czas przygotowania do zamknięcia minus bufor; pełne sloty pomijane
export function pickupSlots(
  loc: Pick<ILocation, 'schedule' | 'exceptions' | 'active' | 'prepMinutes' | 'slotStepMinutes' | 'lastOrderMinutesBeforeClose' | 'maxOrdersPerSlot'>,
  load: Record<string, number> = {},
  now: LocalNow = localParts(),
  extraPrepMinutes = 0
): string[] {
  const h = hoursForDate(loc, now.date);
  if (!h) return [];
  const step = Math.max(5, loc.slotStepMinutes || 15);
  const from = toMin(h.from);
  let to = toMin(h.to);
  if (to <= from) to = 24 * 60 - 1;
  const last = to - (loc.lastOrderMinutesBeforeClose ?? 30);
  const earliest = Math.max(from + (loc.prepMinutes || 20), now.minutes + (loc.prepMinutes || 20) + extraPrepMinutes);
  const start = Math.ceil(earliest / step) * step;
  const slots: string[] = [];
  for (let t = start; t <= last; t += step) {
    const s = toHHMM(t);
    if ((load[s] || 0) < (loc.maxOrdersPerSlot || 999)) slots.push(s);
  }
  return slots;
}

export function scheduleSummary(loc: HoursSource): { label: string; hours: string }[] {
  return WEEK_ORDER.map((k) => {
    const d = loc.schedule?.[k];
    return { label: WEEK_LABELS[k], hours: d && d.isOpen ? `${d.from}–${d.to}` : 'nieczynne' };
  });
}

// Format dla schema.org openingHoursSpecification
export const SCHEMA_DAYS: Record<WeekKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday'
};
