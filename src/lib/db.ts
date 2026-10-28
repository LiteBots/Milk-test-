import mongoose from 'mongoose';

// Railway udostępnia adres bazy pod różnymi nazwami
const MONGO_URI =
  process.env.MONGO_URL || process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/milkmi_db';

type Cached = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const g = globalThis as unknown as { __mongoose?: Cached };
const cached: Cached = g.__mongoose || (g.__mongoose = { conn: null, promise: null });

export async function db(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    cached.promise = mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      maxPoolSize: 30
    });
  }
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
  return cached.conn;
}
