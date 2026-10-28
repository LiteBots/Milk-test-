'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal';
import { Icon } from '../Icon';
import { formatPLN } from '@/lib/util';
import type { MenuProduct, PublicLocation } from '@/lib/data';
import type { CartLine } from './types';

export function ProductModal({
  product: p,
  location,
  allowSet,
  favorite,
  canFavorite,
  onToggleFavorite,
  onClose,
  onAdd
}: {
  product: MenuProduct | null;
  location: PublicLocation;
  allowSet: (categoryId: string) => boolean;
  favorite: boolean;
  canFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onClose: () => void;
  onAdd: (line: Omit<CartLine, 'key' | 'quantity'>, qty: number) => void;
}) {
  const [variant, setVariant] = useState(0);
  const [withSet, setWithSet] = useState(false);
  const [side, setSide] = useState(location.setSides[0] || '');
  const [drink, setDrink] = useState(location.setDrinks[0] || '');
  const [addons, setAddons] = useState<string[]>([]);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setVariant(0);
    setWithSet(false);
    setAddons([]);
    setQty(1);
  }, [p?.id]);

  const setAvailable = !!p && (p.allowSet || allowSet(p.categoryId)) && location.setSides.length > 0;
  const unit = useMemo(() => {
    if (!p) return 0;
    const base = p.variants.length ? p.variants[variant]?.price ?? p.fromPrice : p.price;
    const add = p.addons.filter((a) => addons.includes(a.id)).reduce((s, a) => s + a.price, 0);
    return base + add + (withSet && setAvailable ? location.mealSetPrice : 0);
  }, [p, variant, addons, withSet, setAvailable, location.mealSetPrice]);

  if (!p) return null;
  const v = p.variants[variant];

  function add() {
    if (!p) return;
    const chosen = p.addons.filter((a) => addons.includes(a.id));
    const set = withSet && setAvailable ? { side, drink } : null;
    onAdd(
      {
        type: 'product',
        productId: p.id,
        name: v ? `${p.name} (${v.name})` : p.name,
        variant: v ? v.name : null,
        addonIds: chosen.map((a) => a.id),
        set,
        desc: [set ? `Zestaw: ${side}, ${drink}` : '', ...chosen.map((a) => `+ ${a.name}`)].filter(Boolean).join(' | '),
        unitPrice: unit,
        img: p.imageUrl
      },
      qty
    );
    onClose();
  }

  return (
    <Modal
      open={!!p}
      onClose={onClose}
      title={p.name}
      footer={
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <div className="qty" aria-label="Ilość">
            <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Mniej">
              −
            </button>
            <span>{qty}</span>
            <button onClick={() => setQty(Math.min(30, qty + 1))} aria-label="Więcej">
              +
            </button>
          </div>
          <button className="btn btn-accent btn-lg" style={{ flex: 1 }} onClick={add}>
            Dodaj · {formatPLN(unit * qty)}
          </button>
        </div>
      }
    >
      <div className="stack">
        {p.imageUrl ? (
          <div className="media-frame" style={{ aspectRatio: '16 / 10', borderRadius: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.imageUrl} alt={p.name} />
          </div>
        ) : null}
        <div className="row between">
          <span className="price" style={{ fontSize: '1.15rem' }}>
            {formatPLN(p.variants.length ? p.variants[variant]?.price ?? p.fromPrice : p.price)}
          </span>
          {canFavorite ? (
            <button className="btn btn-ghost btn-sm" onClick={() => onToggleFavorite(p.id)} aria-pressed={favorite}>
              <Icon name="heart" size={16} style={{ color: favorite ? 'var(--accent)' : undefined, fill: favorite ? 'var(--accent)' : 'none' }} /> {favorite ? 'W ulubionych' : 'Do ulubionych'}
            </button>
          ) : null}
        </div>
        {p.description ? <p className="muted" style={{ margin: 0 }}>{p.description}</p> : null}
        {p.allergens.length ? (
          <p className="small" style={{ margin: 0 }}>
            <strong>Alergeny:</strong> {p.allergens.join(', ')}
          </p>
        ) : null}

        {p.variants.length > 1 ? (
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, '--gap': '8px' } as React.CSSProperties}>
            <legend className="label mb-2">Wybierz wariant</legend>
            {p.variants.map((x, i) => (
              <label key={x.name} className="option-card">
                <input type="radio" name="variant" checked={variant === i} onChange={() => setVariant(i)} />
                <span style={{ flex: 1 }}>{x.name}</span>
                <span className="price small">{formatPLN(x.price)}</span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {setAvailable ? (
          <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
            <label className="option-card">
              <input type="checkbox" checked={withSet} onChange={(e) => setWithSet(e.target.checked)} />
              <span style={{ flex: 1 }}>
                <strong>Zestaw</strong> <span className="small muted">dodatek + napój</span>
              </span>
              <span className="price small">+{formatPLN(location.mealSetPrice)}</span>
            </label>
            {withSet ? (
              <div className="grid grid-2" style={{ '--gap': '8px' } as React.CSSProperties}>
                <select className="select" value={side} onChange={(e) => setSide(e.target.value)} aria-label="Dodatek do zestawu">
                  {location.setSides.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select className="select" value={drink} onChange={(e) => setDrink(e.target.value)} aria-label="Napój do zestawu">
                  {location.setDrinks.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        ) : null}

        {p.addons.length ? (
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, '--gap': '8px' } as React.CSSProperties}>
            <legend className="label mb-2">Dodatki</legend>
            {p.addons.map((a) => (
              <label key={a.id} className="option-card">
                <input type="checkbox" checked={addons.includes(a.id)} onChange={(e) => setAddons(e.target.checked ? [...addons, a.id] : addons.filter((x) => x !== a.id))} />
                <span style={{ flex: 1 }}>{a.name}</span>
                <span className="price small">+{formatPLN(a.price)}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
      </div>
    </Modal>
  );
}
