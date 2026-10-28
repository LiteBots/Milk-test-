import 'server-only';
import mongoose from 'mongoose';
import { User, type IUser } from '../models';
import { parseMilkId } from '../user';
import { normalizePhone } from '../util';
import { localParts } from '../hours';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Wyszukanie klienta po kodzie QR Milk ID, telefonie, e-mailu, imieniu lub kodzie polecającym
export async function findCustomer(query: string): Promise<IUser | null> {
  const q = String(query || '').trim();
  if (!q) return null;
  const fromQr = parseMilkId(q);
  if (fromQr) return User.findById(fromQr, '-password').lean<IUser>();
  if (mongoose.isValidObjectId(q)) {
    const byId = await User.findById(q, '-password').lean<IUser>();
    if (byId) return byId;
  }
  const phone = normalizePhone(q).replace(/^\+?48/, '');
  return User.findOne(
    {
      $or: [{ email: q.toLowerCase() }, ...(phone.length === 9 ? [{ phone: { $regex: `${phone}$` } }] : []), { referralCode: q.toUpperCase() }, { username: q }]
    },
    '-password'
  ).lean<IUser>();
}

// Segmenty CRM – używane w filtrach listy klientów i w kampaniach
export function segmentFilter(segment: string): Record<string, unknown> {
  const now = Date.now();
  const month = localParts().date.slice(5, 7);
  switch (segment) {
    case 'inactive30':
      return { $or: [{ lastOrderAt: { $lt: new Date(now - 30 * 864e5) } }, { lastOrderAt: null }] };
    case 'inactive90':
      return { $or: [{ lastOrderAt: { $lt: new Date(now - 90 * 864e5) } }, { lastOrderAt: null }] };
    case 'vip':
      return { $or: [{ tier: 'gold' }, { lifetimeSpent: { $gte: 1000 } }] };
    case 'tier_gold':
      return { tier: 'gold' };
    case 'tier_silver':
      return { tier: 'silver' };
    case 'birthday_month':
      return { birthday: { $regex: `^${month}-` } };
    case 'new30':
      return { createdAt: { $gte: new Date(now - 30 * 864e5) } };
    case 'wallet':
      return { walletBalance: { $gte: 1 } };
    case 'marketing':
      return { marketingConsent: true };
    default:
      return {};
  }
}

export const SEGMENTS: Record<string, string> = {
  all: 'Wszyscy',
  marketing: 'Ze zgodą marketingową',
  new30: 'Nowi (30 dni)',
  inactive30: 'Nieaktywni 30+ dni',
  inactive90: 'Nieaktywni 90+ dni',
  vip: 'VIP (Gold lub 1000 zł+)',
  tier_gold: 'Poziom Gold',
  tier_silver: 'Poziom Silver',
  birthday_month: 'Urodziny w tym miesiącu',
  wallet: 'Ze środkami w portfelu'
};

export function searchFilter(q: string): Record<string, unknown> {
  const t = q.trim();
  if (!t) return {};
  const phone = normalizePhone(t).replace(/^\+?48/, '');
  return {
    $or: [
      { name: { $regex: esc(t), $options: 'i' } },
      { username: { $regex: esc(t), $options: 'i' } },
      { email: { $regex: esc(t), $options: 'i' } },
      ...(phone.length >= 3 && /^\d+$/.test(phone) ? [{ phone: { $regex: esc(phone) } }] : [])
    ]
  };
}

export function customerCard(u: IUser) {
  return {
    id: String(u._id),
    name: u.name || u.username,
    email: u.email,
    phone: u.phone,
    points: u.points || 0,
    walletBalance: u.walletBalance || 0,
    tier: u.tier || 'milk',
    stamps: u.stamps || 0,
    stampRewardsAvailable: u.stampRewardsAvailable || 0,
    rewards: (u.activeRewards || []).filter((r) => !r.usedAt && r.code).map((r) => ({ code: r.code, name: r.name })),
    birthday: u.birthday || '',
    lastOrderAt: u.lastOrderAt || null,
    createdAt: u.createdAt
  };
}
