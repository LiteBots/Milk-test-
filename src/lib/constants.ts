// Stałe współdzielone przez serwer i przeglądarkę (bez zależności od bazy)
export const ALLERGENS = [
  'gluten',
  'mleko',
  'jaja',
  'orzeszki ziemne',
  'orzechy',
  'soja',
  'seler',
  'gorczyca',
  'sezam',
  'siarczyny',
  'łubin',
  'ryby',
  'skorupiaki',
  'mięczaki'
] as const;
export const DIET_TAGS = ['wege', 'weganskie', 'bez-laktozy', 'bez-glutenu', 'ostre', 'nowosc', 'sezonowe'] as const;

export const ORDER_STATUSES = [
  'awaiting_payment',
  'pending',
  'accepted',
  'preparing',
  'ready',
  'completed',
  'cancelled',
  'payment_failed'
] as const;
