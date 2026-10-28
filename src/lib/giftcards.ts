import 'server-only';
import { GiftCard, User, WalletTransaction, type IGiftCard } from './models';
import { sendEmail, emailLayout } from './notify';
import { escapeHtml, formatPLN } from './util';
import { pushHistory } from './loyalty';
import { HttpError } from './http';
import { SITE_URL } from './site';

export async function sendGiftCard(card: IGiftCard) {
  const html = emailLayout(
    `${escapeHtml(card.recipientName || 'Hej')}, masz prezent!`,
    `<p>${escapeHtml(card.buyerName)} przesyła Ci kartę podarunkową Milkshakebar o wartości <strong>${formatPLN(card.amount)}</strong>.</p>
     ${card.message ? `<p style="font-style:italic;border-left:3px solid #F6D6D1;padding-left:12px">${escapeHtml(card.message)}</p>` : ''}
     <p style="font-size:26px;font-weight:700;letter-spacing:.15em;background:#F8FAFC;padding:14px;border-radius:12px;text-align:center">${card.code}</p>
     <p>Wpisz kod w aplikacji MilkMi (Portfel → Karta podarunkowa) albo pokaż go przy kasie. Ważna do ${new Date(card.validTo).toLocaleDateString('pl-PL')}.</p>`,
    { label: 'Otwórz MilkMi', url: `${SITE_URL}/app/portfel` }
  );
  await sendEmail(card.recipientEmail, 'Karta podarunkowa Milkshakebar 🎁', html);
  if (card.buyerEmail && card.buyerEmail !== card.recipientEmail) {
    await sendEmail(card.buyerEmail, 'Karta podarunkowa wysłana', emailLayout('Dziękujemy za zakup!', `<p>Karta ${formatPLN(card.amount)} została wysłana na adres ${escapeHtml(card.recipientEmail)}.</p>`));
  }
  await GiftCard.updateOne({ _id: card._id }, { $set: { sentAt: new Date() } });
}

// Realizacja karty w aplikacji: całe saldo trafia do portfela klienta
export async function redeemGiftCard(userId: string, code: string) {
  const card = await GiftCard.findOneAndUpdate(
    { code: code.trim().toUpperCase(), status: 'active', balance: { $gt: 0 }, validTo: { $gt: new Date() } },
    { $set: { status: 'redeemed', redeemedBy: userId, redeemedAt: new Date(), balance: 0 } },
    { new: false }
  ).lean<IGiftCard>();
  if (!card) throw new HttpError(400, 'Nieprawidłowy, wykorzystany lub przeterminowany kod karty.');
  const u = await User.findByIdAndUpdate(
    userId,
    { $inc: { walletBalance: card.balance }, ...pushHistory([`+ ${card.balance.toFixed(2)} zł • Karta podarunkowa`]) },
    { new: true }
  ).lean();
  await WalletTransaction.create({ userId, userDisplay: `${u?.username} (${u?.phone})`, amount: card.balance, action: 'add', reason: `Karta podarunkowa ${card.code}` });
  return { amount: card.balance, walletBalance: u?.walletBalance || 0 };
}
