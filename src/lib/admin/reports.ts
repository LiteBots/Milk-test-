import 'server-only';
import { Order, User, WalletTopup, PointTransaction } from '../models';
import { TZ } from '../hours';

const VALID = { $nin: ['cancelled', 'payment_failed', 'awaiting_payment'] };

// Granice dnia w strefie Europe/Warsaw → UTC (z uwzględnieniem czasu letniego, niezależnie od strefy serwera)
function tzOffsetMs(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) - d.getTime();
}

export function dayStartUtc(date: string) {
  const guess = new Date(`${date}T00:00:00Z`);
  return new Date(guess.getTime() - tzOffsetMs(guess));
}

export async function salesReport(from: string, to: string, location: string) {
  const start = dayStartUtc(from);
  const end = new Date(dayStartUtc(to).getTime() + 24 * 3600 * 1000);
  const match: Record<string, unknown> = { createdAt: { $gte: start, $lt: end }, status: VALID };
  if (location !== 'all') match.location = location;

  const [totals, daily, byPayment, bySource, byLocation, hourly, topProducts, cancelled, ratings, newCustomers, topups, pointsAwarded] = await Promise.all([
    Order.aggregate([{ $match: match }, { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 }, discounts: { $sum: '$discount' }, wallet: { $sum: '$walletUsed' } } }]),
    Order.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Order.aggregate([{ $match: match }, { $group: { _id: '$paymentMethod', revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }, { $sort: { revenue: -1 } }]),
    Order.aggregate([{ $match: match }, { $group: { _id: '$source', revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }]),
    Order.aggregate([{ $match: match }, { $group: { _id: '$location', revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: match },
      { $group: { _id: { d: { $isoDayOfWeek: { date: '$createdAt', timezone: TZ } }, h: { $hour: { date: '$createdAt', timezone: TZ } } }, n: { $sum: 1 } } }
    ]),
    Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      { $group: { _id: '$items.productId', name: { $first: '$items.name' }, qty: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
      { $sort: { qty: -1 } },
      { $limit: 20 }
    ]),
    Order.countDocuments({ ...match, status: 'cancelled' }),
    Order.aggregate([{ $match: { ...match, rating: { $ne: null } } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]),
    User.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    WalletTopup.aggregate([{ $match: { status: 'completed', createdAt: { $gte: start, $lt: end } } }, { $group: { _id: null, amount: { $sum: '$amount' }, bonus: { $sum: '$bonus' }, n: { $sum: 1 } } }]),
    PointTransaction.aggregate([{ $match: { date: { $gte: start, $lt: end }, pointsAwarded: { $gt: 0 } } }, { $group: { _id: null, n: { $sum: '$pointsAwarded' } } }])
  ]);
  const t = totals[0] || { revenue: 0, orders: 0, discounts: 0, wallet: 0 };
  // Dni bez sprzedaży też na wykresie
  const days: { date: string; revenue: number; orders: number }[] = [];
  const map = new Map(daily.map((d: { _id: string; revenue: number; orders: number }) => [d._id, d]));
  for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    const v = map.get(k);
    days.push({ date: k, revenue: v?.revenue || 0, orders: v?.orders || 0 });
  }
  return {
    totals: { revenue: t.revenue, orders: t.orders, avg: t.orders ? t.revenue / t.orders : 0, discounts: t.discounts, wallet: t.wallet, cancelled },
    daily: days,
    byPayment,
    bySource,
    byLocation,
    hourly,
    topProducts,
    rating: ratings[0] || { avg: null, n: 0 },
    newCustomers,
    topups: topups[0] || { amount: 0, bonus: 0, n: 0 },
    pointsAwarded: pointsAwarded[0]?.n || 0
  };
}
