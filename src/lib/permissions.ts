import type { StaffRole } from './models/core';

// Uprawnienia ról w panelu
export const PERMISSIONS = {
  orders: ['owner', 'manager', 'cashier', 'kitchen'],
  pos: ['owner', 'manager', 'cashier'],
  reservations: ['owner', 'manager', 'cashier'],
  menu: ['owner', 'manager'],
  inventory: ['owner', 'manager', 'kitchen'],
  customers: ['owner', 'manager', 'cashier'],
  customersEdit: ['owner', 'manager'],
  loyalty: ['owner', 'manager'],
  marketing: ['owner', 'manager'],
  content: ['owner', 'manager'],
  reports: ['owner', 'manager'],
  team: ['owner', 'manager'],
  timeclock: ['owner', 'manager', 'cashier', 'kitchen'],
  settings: ['owner', 'manager'],
  staff: ['owner'],
  audit: ['owner']
} satisfies Record<string, StaffRole[]>;
export type Permission = keyof typeof PERMISSIONS;

export function can(session: { role: StaffRole } | null | undefined, perm: Permission) {
  return !!session && (PERMISSIONS[perm] as StaffRole[]).includes(session.role);
}

