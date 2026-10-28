'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../Icon';

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Podpowiedź „Dodaj do ekranu głównego” (Android/Chrome) i instrukcja dla iPhone
export function InstallPrompt() {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone || localStorage.getItem('mm_install_dismissed')) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIP);
      setHidden(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      setIos(true);
      setHidden(false);
    }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (hidden) return null;
  const dismiss = () => {
    localStorage.setItem('mm_install_dismissed', '1');
    setHidden(true);
  };
  return (
    <div className="card card-sm row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <div className="feature-icon" style={{ width: 38, height: 38 }}>
        <Icon name="download" size={18} />
      </div>
      <div style={{ flex: 1 }}>
        <strong className="small">Dodaj MilkMi do ekranu głównego</strong>
        <p className="tiny muted" style={{ margin: '2px 0 8px' }}>
          {ios ? 'W Safari stuknij „Udostępnij”, a potem „Do ekranu początkowego”.' : 'Otwieraj aplikację jednym dotknięciem, jak każdą inną.'}
        </p>
        {evt ? (
          <button
            className="btn btn-accent btn-sm"
            onClick={async () => {
              await evt.prompt();
              setHidden(true);
            }}
          >
            Dodaj
          </button>
        ) : null}
      </div>
      <button className="btn btn-ghost btn-icon btn-sm" onClick={dismiss} aria-label="Zamknij">
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
