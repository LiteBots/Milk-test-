import type { MenuProduct, PublicCategory, PublicLocation } from '@/lib/data';

export interface CartLine {
  key: string;
  type: 'product' | 'upsell';
  productId: string;
  name: string;
  variant?: string | null;
  addonIds?: string[];
  set?: { side: string; drink: string } | null;
  desc?: string;
  unitPrice: number; // tylko do podglądu – cena liczona na serwerze
  quantity: number;
  img?: string;
}

export interface StoreData {
  location: PublicLocation;
  ordering: { open: boolean; reason?: string; slots: string[]; status: { open: boolean; label: string; todayHours: string | null } };
  payments: { online: boolean; card: boolean; cash: boolean; prepaid: boolean };
  menu: MenuProduct[];
  categories: PublicCategory[];
  upsell: { items: { id: string; name: string; price: number; img: string }[]; rules: { whenCategoryPrefix: string; suggestProductIds: string[] }[] };
  user: null | {
    name: string;
    phone: string;
    email: string;
    walletBalance: number;
    points: number;
    stampRewardsAvailable: number;
    stampPrefix: string;
    favorites: string[];
    rewards: { code: string; name: string }[];
    coupons: { code: string; name: string }[];
  };
}

export interface Quote {
  items: { productId: string; name: string; price: number; quantity: number; desc?: string }[];
  subtotal: number;
  packagingFee: number;
  deliveryFee: number;
  couponDiscount: number;
  rewardDiscount: number;
  discount: number;
  total: number;
  coupon: { id: string; code: string; name: string } | null;
  couponError: string | null;
  reward: { key: string; label: string } | null;
  rewardError: string | null;
  walletBalance: number | null;
  warnings: string[];
}
