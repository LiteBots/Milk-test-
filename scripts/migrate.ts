/**
 * Migracja danych ze starej wersji MilkMi (ta sama baza MongoDB).
 * Uruchom raz po wdrożeniu:  npm run migrate   (albo przycisk w panelu: Lokale i godziny → Migracja)
 * Wymaga: MONGO_URL; opcjonalnie OLD_APP_URL (adres starego serwisu, by przenieść zdjęcia z /uploads)
 * Bezpieczny do ponownego uruchomienia – nie dubluje danych.
 */
import mongoose from 'mongoose';
import { runMigration } from '../src/lib/migrateCore';

async function main() {
  const uri = process.env.MONGO_URL || process.env.MONGO_URI || process.env.DATABASE_URL;
  if (!uri) throw new Error('Ustaw MONGO_URL.');
  await mongoose.connect(uri);
  console.log('✅ Połączono z bazą');
  await runMigration({ oldUrl: process.env.OLD_APP_URL });
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
