'use client';

import { formatPLN } from '@/lib/util';
import type { MenuProduct } from '@/lib/data';
import type { CartLine, Quote, StoreData } from './types';

// Pozycje koszyka, sugestie „może do tego…” i podsumowanie liczone na serwerze
export function CartView({
  cart,
  quote,
  quoteError,
  setQty,
  upsell,
  menu,
  onAddUpsell,
  onOpenProduct
}: {
  cart: CartLine[];
  quote: Quote | null;
  quoteError: string;
  setQty: (key: string, qty: number) => void;
  upsell: StoreData['upsell'];
  menu: MenuProduct[];
  onAddUpsell: (u: { id: string; name: string; price: number; img: string }) => void;
  onOpenProduct: (id: string) => void;
}) {
  if (!cart.length) return <p className="muted small">Koszyk jest pusty. Dodaj coś pysznego z menu.</p>;

  // Sugestie: reguły (np. do burgera frytki) + stałe dodatki upsell, bez tego, co już jest w koszyku
  const inCart = new Set(cart.map((l) => l.productId));
  const cats = cart.map((l) => menu.find((m) => m.id === l.productId)?.categoryId || '');
  const ruleIds = upsell.rules.filter((r) => cats.some((c) => c.startsWith(r.whenCategoryPrefix))).flatMap((r) => r.suggestProductIds);
  const ruleProducts = ruleIds.map((id) => menu.find((m) => m.id === id && m.available)).filter((m): m is MenuProduct => !!m && !inCart.has(m.id)).slice(0, 3);
  const extras = upsell.items.filter((u) => !inCart.has(u.id)).slice(0, 4);

  return (
    <div>
      {cart.map((l) => (
        <div key={l.key} className="cart-line">
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.93rem' }}>{l.name}</div>
            {l.desc ? <div className="tiny muted">{l.desc}</div> : null}
            <div className="small muted">{formatPLN(l.unitPrice)}</div>
          </div>
          <div className="qty" aria-label={`Ilość: ${l.name}`}>
            <button onClick={() => setQty(l.key, l.quantity - 1)} aria-label="Mniej">
              −
            </button>
            <span>{l.quantity}</span>
            <button onClick={() => setQty(l.key, l.quantity + 1)} aria-label="Więcej">
              +
            </button>
          </div>
        </div>
      ))}

      {ruleProducts.length || extras.length ? (
        <div className="mt-2">
          <div className="label mb-2">Może do tego…</div>
          <div className="chips">
            {ruleProducts.map((p) => (
              <button key={p.id} className="chip" onClick={() => onOpenProduct(p.id)}>
                + {p.name} · {formatPLN(p.fromPrice)}
              </button>
            ))}
            {extras.map((u) => (
              <button key={u.id} className="chip" onClick={() => onAddUpsell(u)}>
                + {u.name} · {formatPLN(u.price)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-2">
        {quote ? (
          <>
            <div className="summary-row">
              <span>Produkty</span>
              <span>{formatPLN(quote.subtotal)}</span>
            </div>
            {quote.rewardDiscount ? (
              <div className="summary-row">
                <span>{quote.reward?.label || 'Nagroda'}</span>
                <span className="neg">−{formatPLN(quote.rewardDiscount)}</span>
              </div>
            ) : null}
            {quote.couponDiscount ? (
              <div className="summary-row">
                <span>Rabat {quote.coupon?.code}</span>
                <span className="neg">−{formatPLN(quote.couponDiscount)}</span>
              </div>
            ) : null}
            {quote.packagingFee ? (
              <div className="summary-row">
                <span>Opakowania</span>
                <span>{formatPLN(quote.packagingFee)}</span>
              </div>
            ) : null}
            {quote.deliveryFee ? (
              <div className="summary-row">
                <span>Dostawa</span>
                <span>{formatPLN(quote.deliveryFee)}</span>
              </div>
            ) : null}
            <div className="summary-row total">
              <span>Razem</span>
              <span>{formatPLN(quote.total)}</span>
            </div>
          </>
        ) : quoteError ? (
          <p className="alert alert-error small">{quoteError}</p>
        ) : (
          <div className="skeleton" style={{ height: 60 }} />
        )}
      </div>
    </div>
  );
}
