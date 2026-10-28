/**
 * Tworzy lub resetuje konto właściciela panelu.
 * Użycie:  OWNER_EMAIL=ja@firma.pl OWNER_PASSWORD='min10znakow' npm run create-owner
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Staff } from '../src/lib/models';

async function main() {
  const uri = process.env.MONGO_URL || process.env.MONGO_URI || process.env.DATABASE_URL;
  const email = (process.env.OWNER_EMAIL || '').toLowerCase().trim();
  const password = process.env.OWNER_PASSWORD || '';
  if (!uri || !email || password.length < 10) throw new Error('Ustaw MONGO_URL, OWNER_EMAIL i OWNER_PASSWORD (min. 10 znaków).');
  await mongoose.connect(uri);
  await Staff.updateOne(
    { email },
    { $set: { email, name: 'Właściciel', role: 'owner', active: true, password: await bcrypt.hash(password, 12), failedLogins: 0, lockedUntil: null, totpEnabled: false, totpSecret: null } },
    { upsert: true }
  );
  console.log(`✅ Konto właściciela gotowe: ${email} (2FA wyłączone – włącz w profilu)`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
