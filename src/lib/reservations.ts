import 'server-only';
import { Reservation, type ILocation } from './models';
import { hoursForDate, localParts, toHHMM, toMin } from './hours';

export interface ResSlot {
  time: string;
  available: boolean;
}

// Wolne godziny: sloty co X min w godzinach otwarcia, z pojemnością strefy i czasem trwania wizyty
export async function reservationSlots(loc: ILocation, date: string, guests: number, zone: string): Promise<ResSlot[]> {
  const h = hoursForDate(loc, date);
  if (!h || !loc.reservationsEnabled) return [];
  const z = loc.reservationZones.find((x) => x.key === zone) || loc.reservationZones[0];
  if (!z) return [];
  const step = Math.max(15, loc.reservationSlotMinutes || 30);
  const dur = Math.max(30, loc.reservationDurationMinutes || 90);
  const open = toMin(h.from);
  let close = toMin(h.to);
  if (close <= open) close = 24 * 60;
  const now = localParts();
  const minStart = date === now.date ? now.minutes + 60 : 0;
  const existing = await Reservation.find({
    location: loc.slug,
    zone: z.key,
    datetime: { $regex: `^${date}T` },
    status: { $in: ['pending', 'accepted'] }
  }).lean();
  const taken = existing.map((r) => ({ start: toMin(r.datetime.slice(11, 16)), guests: r.guests || 0 }));
  const slots: ResSlot[] = [];
  for (let t = Math.ceil(open / step) * step; t + Math.min(dur, 60) <= close; t += step) {
    if (t < minStart) continue;
    const used = taken.filter((r) => r.start < t + dur && t < r.start + dur).reduce((s, r) => s + r.guests, 0);
    slots.push({ time: toHHMM(t), available: used + guests <= z.seats });
  }
  return slots;
}
