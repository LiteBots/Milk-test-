import 'server-only';
import { AuditLog } from './models';
import type { StaffSession } from './auth';
import { clientIp } from './http';

export async function audit(s: StaffSession, action: string, entity: string, entityId?: string, details?: string) {
  try {
    await AuditLog.create({ staffId: s.staffId, staffName: s.name, action, entity, entityId, details: details?.slice(0, 1000), ip: await clientIp() });
  } catch (e) {
    console.error('[audit]', e);
  }
}
