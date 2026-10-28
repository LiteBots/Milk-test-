import 'server-only';
import mongoose from 'mongoose';
import { Order, Location, nextSeq, type IOrder, type ILocation, type OrderStatus } from './models';
import { quoteCart, type CartLineInput } from './pricing';
import { consumeOrderBenefits, restoreOrderBenefits, awardOrderLoyalty } from './loyalty';
import { createPayuOrder, payuConfigured, refundPayu } from './payu';
import { pickupSlots, localParts, toMin } from './hours';
import { HttpError } from './http';
import { pushToStaff, pushToUser, sendEmail, sendSms, emailLayout } from './notify';
import { signId, verifyId } from './tokens';
import { getUserSession } from './auth';
import { escapeHtml, formatPLN, isValidEmail, isValidPhone, normalizePhone, STATUS_LABELS } from './util';
import { SITE_URL } from './site';

export interface CreateOrderInput {
  location: string;
  items: CartLineInput[];
  couponCode?: string | null;
  reward?: string | null;
  deliveryMethod: 'pickup' | 'delivery';
  deliveryAddress?: string;
  paymentMethod: 'cash' | 'card' | 'online' | 'prepaid';
  pickupTime: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  notes?: string;
  source: 'web' | 'app' | 'kiosk';
  clientOrderId?: string;
  userId?: string | null;
  ip: string;
}

export const statusUrl = (id: string) => `/zamow/status/${id}?t=${signId('order', id)}`;

// Obłożenie slotów: liczba aktywnych zamówień na daną godzinę odbioru dziś
export async function slotLoad(location: string, date = localParts().date) {
  const rows = await Order.aggregate<{ _id: string; n: number }>([
    { $match: { location, pickupDate: date, status: { $nin: ['cancelled', 'payment_failed'] } } },
    { $group: { _id: '$pickupTime', n: { $sum: 1 } } }
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.n]));
}

export function orderingState(loc: ILocation): { open: boolean; reason?: string } {
  if (!loc.active) return { open: false, reason: 'Lokal jest nieczynny.' };
  if (!loc.ordersEnabled) return { open: false, reason: 'Zamówienia online są w tym lokalu wyłączone.' };
  if (loc.pausedUntil && new Date(loc.pausedUntil) > new Date()) {
    const t = new Date(loc.pausedUntil).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });
    return { open: false, reason: `Mamy teraz dużo zamówień – wracamy o ${t}.` };
  }
  return { open: true };
}

export async function createOrder(input: CreateOrderInput) {
  if (input.clientOrderId) {
    const existing = await Order.findOne({ clientOrderId: input.clientOrderId }).lean<IOrder>();
    if (existing) return { order: existing, redirectUrl: null as string | null, duplicate: true };
  }
  const loc = await Location.findOne({ slug: input.location }).lean<ILocation>();
  if (!loc) throw new HttpError(400, 'Nieznany lokal.');
  const state = orderingState(loc);
  if (!state.open) throw new HttpError(403, state.reason!);
  if (input.deliveryMethod === 'pickup' && !loc.pickupEnabled) throw new HttpError(400, 'Odbiór osobisty jest chwilowo niedostępny.');

  const name = input.customerName.trim();
  const phone = normalizePhone(input.customerPhone);
  if (name.length < 2) throw new HttpError(400, 'Podaj imię.');
  if (!isValidPhone(phone)) throw new HttpError(400, 'Podaj prawidłowy numer telefonu.');
  const email = (input.customerEmail || '').trim().toLowerCase();
  if (email && !isValidEmail(email)) throw new HttpError(400, 'Podaj prawidłowy e-mail.');

  const now = localParts();
  const load = await slotLoad(loc.slug, now.date);
  const slots = pickupSlots(loc, load, now);
  if (!slots.includes(input.pickupTime)) {
    throw new HttpError(409, slots.length ? 'Wybrana godzina jest już niedostępna – wybierz nową.' : 'Na dziś nie przyjmujemy już zamówień.');
  }

  const userId = input.userId && mongoose.isValidObjectId(input.userId) ? input.userId : null;
  const source = input.source === 'app' && userId ? 'app' : input.source === 'kiosk' ? 'kiosk' : 'web';
  const q = await quoteCart({
    items: input.items,
    location: loc.slug,
    couponCode: input.couponCode,
    reward: input.reward,
    deliveryMethod: input.deliveryMethod,
    paymentMethod: input.paymentMethod,
    userId,
    phone,
    source
  });
  if (input.couponCode && q.couponError) throw new HttpError(400, q.couponError);
  if (input.reward && q.rewardError) throw new HttpError(400, q.rewardError);

  let walletUsed = 0;
  if (input.paymentMethod === 'prepaid') {
    if (!userId) throw new HttpError(401, 'Zaloguj się, aby zapłacić portfelem.');
    if ((q.walletBalance || 0) < q.total) throw new HttpError(400, `W portfelu brakuje ${formatPLN(q.total - (q.walletBalance || 0))}.`);
    walletUsed = q.total;
  }
  if (input.paymentMethod === 'online' && !payuConfigured()) throw new HttpError(400, 'Płatności online są chwilowo niedostępne.');

  const seq = await nextSeq('orderNum');
  const orderNumber = `MI-${String(seq).padStart(4, '0')}`;
  const online = input.paymentMethod === 'online' && q.total > 0;
  const status: OrderStatus = online ? 'awaiting_payment' : 'pending';
  const created = await Order.create({
    orderNumber,
    clientOrderId: input.clientOrderId || undefined,
    userId,
    source,
    customerName: name.slice(0, 80),
    customerPhone: phone,
    customerEmail: email || undefined,
    pickupTime: input.pickupTime,
    pickupDate: now.date,
    notes: (input.notes || '').slice(0, 500),
    items: q.items,
    subtotal: q.subtotal,
    packagingFee: q.packagingFee,
    deliveryFee: q.deliveryFee,
    discount: q.discount,
    couponCode: q.coupon?.code || null,
    rewardUsed: q.reward?.key || null,
    walletUsed,
    totalAmount: q.total,
    paymentMethod: input.paymentMethod,
    paymentStatus: walletUsed > 0 || q.total === 0 ? 'paid' : 'unpaid',
    deliveryMethod: input.deliveryMethod,
    deliveryAddress: input.deliveryMethod === 'delivery' ? (input.deliveryAddress || '').slice(0, 200) : '',
    location: loc.slug,
    status,
    statusHistory: [{ status, at: new Date(), by: 'klient' }],
    estimatedReadyAt: null
  });

  try {
    await consumeOrderBenefits(created, q.coupon?.id || null, q.couponDiscount);
  } catch (e) {
    await Order.deleteOne({ _id: created._id });
    throw e;
  }

  const id = String(created._id);
  let redirectUrl: string | null = null;
  if (online) {
    try {
      const payu = await createPayuOrder({
        extOrderId: `order:${id}`,
        description: `Zamówienie ${orderNumber} – Milkshakebar`,
        totalAmount: q.total,
        customerIp: input.ip,
        buyer: { email: email || undefined, phone, firstName: name },
        // Jedna pozycja = suma po rabatach (PayU nie przyjmuje ujemnych cen pozycji)
        products: [{ name: `Zamówienie ${orderNumber} (${q.items.reduce((n, i) => n + i.quantity, 0)} poz.)`, unitPrice: q.total, quantity: 1 }],
        continuePath: statusUrl(id)
      });
      redirectUrl = payu.redirectUri;
      if (payu.orderId) await Order.updateOne({ _id: created._id }, { $set: { payuOrderId: payu.orderId } });
    } catch (e) {
      const doc = await Order.findByIdAndUpdate(created._id, { $set: { status: 'payment_failed', paymentStatus: 'failed' } }, { new: true }).lean<IOrder>();
      if (doc) await restoreOrderBenefits(doc);
      throw new HttpError(502, (e as Error).message || 'Nie udało się połączyć z PayU. Wybierz inną metodę płatności.');
    }
  } else {
    await announceNewOrder(created.toObject() as IOrder);
  }
  return { order: created.toObject() as IOrder, redirectUrl, duplicate: false };
}

// Powiadomienie obsługi i klienta o nowym (opłaconym lub płatnym przy odbiorze) zamówieniu
export async function announceNewOrder(o: IOrder) {
  pushToStaff({
    title: `Nowe zamówienie ${o.orderNumber}`,
    body: `${o.customerName} · ${formatPLN(o.totalAmount)} · odbiór ${o.pickupTime}`,
    url: '/admin/zamowienia',
    tag: 'order'
  }).catch(() => {});
  if (o.customerEmail) {
    const id = String(o._id);
    const rows = o.items
      .map((i) => `<tr><td style="padding:4px 0">${i.quantity}× ${escapeHtml(i.name)}${i.desc ? `<br><small style="color:#8A8377">${escapeHtml(i.desc)}</small>` : ''}</td><td style="text-align:right">${formatPLN(i.price * i.quantity)}</td></tr>`)
      .join('');
    sendEmail(
      o.customerEmail,
      `Zamówienie ${o.orderNumber} przyjęte`,
      emailLayout(
        `Dziękujemy, ${escapeHtml(o.customerName)}!`,
        `<p>Zamówienie <strong>${o.orderNumber}</strong> do odbioru o <strong>${o.pickupTime}</strong>.</p><table style="width:100%;font-size:14px">${rows}</table><p style="font-weight:700;margin-top:12px">Razem: ${formatPLN(o.totalAmount)}</p>`,
        { label: 'Śledź zamówienie', url: `${SITE_URL}${statusUrl(id)}` }
      )
    ).catch(() => {});
  }
}

const ALLOWED: Record<string, string[]> = {
  awaiting_payment: ['pending', 'cancelled', 'payment_failed'],
  payment_failed: ['pending', 'cancelled'],
  pending: ['accepted', 'preparing', 'ready', 'completed', 'cancelled'],
  accepted: ['preparing', 'ready', 'completed', 'cancelled'],
  preparing: ['ready', 'completed', 'cancelled'],
  ready: ['completed', 'preparing', 'cancelled'],
  completed: [],
  cancelled: [],
  rejected: []
};

// Zmiana statusu z panelu: historia, punkty po wydaniu, zwroty po anulowaniu, powiadomienia klienta
export async function setOrderStatus(id: string, status: OrderStatus, by: string, opts: { reason?: string; readyInMinutes?: number } = {}) {
  const order = await Order.findById(id).lean<IOrder>();
  if (!order) throw new HttpError(404, 'Nie znaleziono zamówienia.');
  if (order.status === status) return order;
  if (!(ALLOWED[order.status] || []).includes(status)) {
    throw new HttpError(400, `Nie można zmienić statusu z „${STATUS_LABELS[order.status] || order.status}” na „${STATUS_LABELS[status]}”.`);
  }
  const set: Record<string, unknown> = { status };
  if (opts.readyInMinutes) set.estimatedReadyAt = new Date(Date.now() + opts.readyInMinutes * 60000);
  if (status === 'cancelled' && opts.reason) set.cancelReason = opts.reason.slice(0, 200);
  if (status === 'completed' && order.paymentMethod !== 'online') set.paymentStatus = 'paid';
  const updated = await Order.findOneAndUpdate(
    { _id: id, status: order.status },
    { $set: set, $push: { statusHistory: { status, at: new Date(), by } } },
    { new: true }
  ).lean<IOrder>();
  if (!updated) throw new HttpError(409, 'Zamówienie zostało właśnie zmienione przez kogoś innego – odśwież.');

  if (status === 'completed') await awardOrderLoyalty(updated._id);
  if (status === 'cancelled') {
    await restoreOrderBenefits(updated);
    if (updated.paymentMethod === 'online' && updated.paymentStatus === 'paid' && updated.payuOrderId) {
      const okRefund = await refundPayu(updated.payuOrderId, `Anulowane zamówienie ${updated.orderNumber}`);
      if (okRefund) await Order.updateOne({ _id: updated._id }, { $set: { paymentStatus: 'refunded' } });
    }
  }
  await notifyCustomerStatus(updated);
  return updated;
}

async function notifyCustomerStatus(o: IOrder) {
  const msgs: Partial<Record<string, { title: string; body: string }>> = {
    accepted: { title: 'Zamówienie przyjęte', body: `${o.orderNumber} – zaczynamy przygotowanie.` },
    preparing: { title: 'Przygotowujemy Twoje zamówienie', body: `${o.orderNumber} będzie gotowe ok. ${o.pickupTime}.` },
    ready: { title: 'Zamówienie gotowe do odbioru!', body: `${o.orderNumber} czeka na Ciebie.` },
    cancelled: { title: 'Zamówienie anulowane', body: `${o.orderNumber}${o.cancelReason ? ` – ${o.cancelReason}` : ''}. Środki wrócą na Twoje konto.` }
  };
  const m = msgs[o.status];
  if (!m) return;
  if (o.userId) pushToUser(o.userId, { ...m, url: o.source === 'app' ? `/app/zamowienia/${o._id}` : statusUrl(String(o._id)), tag: `order-${o._id}` }).catch(() => {});
  if (o.status === 'ready' && process.env.SMS_ON_READY !== 'false') sendSms(o.customerPhone, `Milkshakebar: zamówienie ${o.orderNumber} jest gotowe do odbioru. Smacznego!`).catch(() => {});
  if (o.status === 'cancelled' && o.customerEmail) sendEmail(o.customerEmail, `Zamówienie ${o.orderNumber} anulowane`, emailLayout(m.title, `<p>${escapeHtml(m.body)}</p>`)).catch(() => {});
}

// Publiczny widok zamówienia (bez telefonu i e-maila)
export function publicOrder(o: IOrder) {
  return {
    id: String(o._id),
    orderNumber: o.orderNumber,
    status: o.status,
    statusLabel: STATUS_LABELS[o.status] || o.status,
    items: o.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, desc: i.desc || '' })),
    subtotal: o.subtotal,
    packagingFee: o.packagingFee,
    deliveryFee: o.deliveryFee,
    discount: o.discount,
    walletUsed: o.walletUsed,
    totalAmount: o.totalAmount,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    pickupTime: o.pickupTime,
    pickupDate: o.pickupDate,
    deliveryMethod: o.deliveryMethod,
    location: o.location,
    customerName: o.customerName.split(' ')[0],
    estimatedReadyAt: o.estimatedReadyAt,
    rating: o.rating ?? null,
    pointsEarned: o.pointsEarned || 0,
    source: o.source,
    createdAt: o.createdAt,
    minutesToPickup: o.pickupDate === localParts().date ? toMin(o.pickupTime) - localParts().minutes : null
  };
}

// Dostęp do zamówienia: podpisany link albo zalogowany właściciel
export async function loadOrderForViewer(id: string, token: string | null) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Nie znaleziono zamówienia.');
  const o = await Order.findById(id).lean<IOrder>();
  if (!o) throw new HttpError(404, 'Nie znaleziono zamówienia.');
  if (!verifyId('order', id, token)) {
    const s = await getUserSession();
    if (!s || !o.userId || String(o.userId) !== s.userId) throw new HttpError(403, 'Brak dostępu do zamówienia.');
  }
  return o;
}

