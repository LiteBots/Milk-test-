// Migracja danych ze starej wersji (bez zależności od Next.js – używana przez skrypt i przycisk w panelu)
import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User, Order, Product, Media, Staff, Category } from './models';

const code = (n: number) => Array.from(crypto.randomBytes(n), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

async function copyImage(url: string, OLD: string): Promise<string | null> {
  if (!url || url.startsWith('/api/media/') || url.startsWith('https://res.cloudinary.com')) return null;
  const src = url.startsWith('http') ? url : OLD ? `${OLD}${url.startsWith('/') ? '' : '/'}${url}` : null;
  if (!src) return null;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || 'image/jpeg';
    if (!type.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const m = await Media.create({ filename: src.split('/').pop(), contentType: type, size: buf.length, data: buf });
    return `/api/media/${m._id}`;
  } catch {
    return null;
  }
}

export async function runMigration(opts: { oldUrl?: string; log?: (m: string) => void } = {}) {
  const OLD = (opts.oldUrl || '').replace(/\/$/, '');
  const log = opts.log || console.log;
  const db = mongoose.connection;

  // 1. Klienci: nowe pola z wartościami domyślnymi, kod polecający, imię
  const users = await User.find({}).lean();
  let u1 = 0;
  for (const u of users) {
    const set: Record<string, unknown> = {};
    if (!u.name) set.name = u.username;
    if (!u.referralCode) {
      let c = code(6);
      while (await User.exists({ referralCode: c })) c = code(6);
      set.referralCode = c;
    }
    if (u.tier === undefined) set.tier = 'milk';
    if (u.stamps === undefined) set.stamps = 0;
    if (u.stampRewardsAvailable === undefined) set.stampRewardsAvailable = 0;
    if (u.favorites === undefined) set.favorites = [];
    if (Object.keys(set).length) {
      await User.updateOne({ _id: u._id }, { $set: set });
      u1++;
    }
  }
  log(`👤 Klienci: ${users.length}, uzupełnieni: ${u1}`);

  // 2. Zamówienia: źródło, status płatności, stare statusy
  const r1 = await Order.updateMany({ source: { $exists: false } }, { $set: { source: 'web' } });
  const r2 = await Order.updateMany({ status: 'rejected' }, { $set: { status: 'cancelled' } });
  const r3 = await Order.updateMany({ paymentStatus: { $exists: false }, paymentMethod: 'online', status: { $nin: ['awaiting_payment', 'payment_failed'] } }, { $set: { paymentStatus: 'paid' } });
  const r4 = await Order.updateMany({ paymentStatus: { $exists: false } }, { $set: { paymentStatus: 'unpaid' } });
  // Stare zamówienia nie naliczą ponownie punktów po zmianie statusu
  const r5 = await Order.updateMany({ loyaltyProcessed: { $exists: false } }, { $set: { loyaltyProcessed: true } });
  // Numeracja: licznik nie może cofnąć się poniżej istniejących numerów
  const counter = await db.collection('counters').findOne({ id: 'orderNum' });
  const maxNum = (await Order.find({ orderNumber: /^MI-\d+$/ }, 'orderNumber').lean()).reduce((m, o) => Math.max(m, Number(o.orderNumber.slice(3)) || 0), 0);
  if (!counter || (counter.seq || 0) < maxNum) await db.collection('counters').updateOne({ id: 'orderNum' }, { $set: { seq: maxNum } }, { upsert: true });
  log(`🧾 Zamówienia: źródło ${r1.modifiedCount}, statusy ${r2.modifiedCount}, płatności ${r3.modifiedCount + r4.modifiedCount}, oznaczone ${r5.modifiedCount}; licznik ≥ ${maxNum}`);

  // 3. Produkty: dostępność + przeniesienie zdjęć z dysku starego serwera do bazy
  await Product.updateMany({ available: { $exists: false } }, { $set: { available: true, unavailableAt: [], allergens: [], tags: [] } });
  let moved = 0;
  if (OLD) {
    for (const p of await Product.find({ imageUrl: /^\/?uploads\// }).lean()) {
      const url = await copyImage(p.imageUrl, OLD);
      if (url) {
        await Product.updateOne({ _id: p._id }, { $set: { imageUrl: url } });
        moved++;
      }
    }
    for (const c of await Category.find({ imageUrl: /^\/?uploads\// }).lean()) {
      const url = await copyImage(String(c.imageUrl), OLD);
      if (url) await Category.updateOne({ _id: c._id }, { $set: { imageUrl: url } });
    }
    for (const b of await db.collection('categorybanners').find({}).toArray()) {
      const url = await copyImage(String(b.imageUrl), OLD);
      if (url) await db.collection('categorybanners').updateOne({ _id: b._id }, { $set: { imageUrl: url } });
    }
    for (const u of await db.collection('upsellconfigs').find({}).toArray()) {
      const items = await Promise.all((u.items || []).map(async (it: { img?: string }) => ({ ...it, img: (await copyImage(it.img || '', OLD)) || it.img })));
      await db.collection('upsellconfigs').updateOne({ _id: u._id }, { $set: { items } });
    }
  }
  log(`🖼️  Zdjęcia przeniesione do bazy: ${moved}${OLD ? '' : ' (pominięto – brak OLD_APP_URL)'}`);

  // 4. Konto właściciela panelu
  if ((await Staff.estimatedDocumentCount()) === 0 && process.env.OWNER_EMAIL && (process.env.OWNER_PASSWORD || '').length >= 10) {
    await Staff.create({ name: 'Właściciel', email: process.env.OWNER_EMAIL.toLowerCase(), password: await bcrypt.hash(process.env.OWNER_PASSWORD!, 12), role: 'owner' });
    log(`🔑 Utworzono konto właściciela: ${process.env.OWNER_EMAIL}`);
  }

  log('✨ Gotowe. Lokale, kategorie, adresy produktów i FAQ uzupełnią się automatycznie przy pierwszym wejściu na stronę.');
}

