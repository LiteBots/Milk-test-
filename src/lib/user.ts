import 'server-only';
import { redirect } from 'next/navigation';
import { db } from './db';
import { User, type IUser, type ILoyaltyConfig } from './models';
import { getUserSession } from './auth';
import { expirePointsIfNeeded, getLoyaltyConfig, nextTier, tierFor } from './loyalty';
import { signId } from './tokens';
import { localParts } from './hours';

export async function getAppUser(): Promise<IUser | null> {
  const s = await getUserSession();
  if (!s) return null;
  await db();
  let u = await User.findById(s.userId).lean<IUser>();
  if (u && (await expirePointsIfNeeded(u))) u = await User.findById(s.userId).lean<IUser>();
  return u;
}

// Strony aplikacji wymagające logowania
export async function requireAppUser(next: string): Promise<IUser> {
  const u = await getAppUser();
  if (!u) redirect(`/app/logowanie?next=${encodeURIComponent(next)}`);
  return u!;
}

// Kod Milk ID w QR – podpisany, żeby nie dało się podrobić cudzego konta przy kasie
export const milkId = (userId: string) => `MM1.${userId}.${signId('milkid', userId)}`;

export function parseMilkId(code: string): string | null {
  const m = String(code || '').trim().match(/^MM1\.([a-f0-9]{24})\.([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  return signId('milkid', m[1]) === m[2] ? m[1] : null;
}

export function loyaltySummary(u: IUser, cfg: ILoyaltyConfig) {
  const year = Number(localParts().date.slice(0, 4));
  const yearSpent = u.yearSpentYear === year ? u.yearSpent || 0 : 0;
  const tier = tierFor(cfg, yearSpent);
  const next = nextTier(cfg, yearSpent);
  return {
    points: u.points || 0,
    walletBalance: u.walletBalance || 0,
    tier: { key: tier.key, name: tier.name, perks: tier.perks, multiplier: tier.multiplier },
    nextTier: next ? { name: next.name, missing: Math.max(0, next.minYearSpent - yearSpent), progress: Math.min(1, yearSpent / next.minYearSpent) } : null,
    yearSpent,
    stamps: u.stamps || 0,
    stampsRequired: cfg.stampsRequired,
    stampsEnabled: cfg.stampsEnabled,
    stampRewardsAvailable: u.stampRewardsAvailable || 0,
    pointsExpireAt: u.pointsExpireAt || null
  };
}

export async function loyaltyFor(u: IUser) {
  return loyaltySummary(u, await getLoyaltyConfig());
}
