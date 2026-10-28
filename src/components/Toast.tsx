'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type ToastType = 'info' | 'success' | 'error';
interface ToastItem {
  id: number;
  text: string;
  type: ToastType;
}
const Ctx = createContext<(text: string, type?: ToastType) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-2), { id, text, type }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toast-stack" aria-live="polite" role="status">
        {items.map((t) => (
          <div key={t.id} className="toast" data-type={t.type}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
