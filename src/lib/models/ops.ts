import { Schema, model, models, type Model, type Types } from 'mongoose';

/* ============================================================
   REZERWACJE (kolekcja `reservations` – zgodna ze starą wersją)
   ============================================================ */
export interface IReservation {
  _id: Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  userId?: Types.ObjectId | null;
  datetime: string; // YYYY-MM-DDTHH:mm (czas lokalny)
  guests: number;
  zone: string;
  notes: string;
  location: string;
  occasion?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'no_show' | 'completed';
  cancelToken?: string;
  smsSent: boolean;
  createdAt: Date;
}
const reservationSchema = new Schema<IReservation>({
  name: String,
  phone: String,
  email: String,
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  datetime: { type: String, index: true },
  guests: Number,
  zone: { type: String, default: 'sala' },
  notes: { type: String, default: '' },
  location: { type: String, default: 'slupsk' },
  occasion: String,
  status: { type: String, default: 'pending' },
  cancelToken: { type: String, index: true },
  smsSent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
export const Reservation: Model<IReservation> =
  (models.Reservation as Model<IReservation>) || model<IReservation>('Reservation', reservationSchema);

/* ============================================================
   ZAPYTANIA (imprezy, catering, kontakt, praca)
   ============================================================ */
export interface IInquiry {
  _id: Types.ObjectId;
  type: 'event' | 'contact' | 'job';
  name: string;
  email: string;
  phone: string;
  message: string;
  date?: string;
  guests?: number;
  location?: string;
  position?: string;
  status: 'new' | 'in_progress' | 'done';
  createdAt: Date;
}
const inquirySchema = new Schema<IInquiry>({
  type: { type: String, default: 'contact' },
  name: String,
  email: String,
  phone: String,
  message: String,
  date: String,
  guests: Number,
  location: String,
  position: String,
  status: { type: String, default: 'new' },
  createdAt: { type: Date, default: Date.now }
});
export const Inquiry: Model<IInquiry> = (models.Inquiry as Model<IInquiry>) || model<IInquiry>('Inquiry', inquirySchema);

/* ============================================================
   ZESPÓŁ (WorkMi): pracownicy, grafik, czas pracy
   ============================================================ */
export interface IEmployee {
  _id: Types.ObjectId;
  name: string;
  phone: string;
  position: string;
  pin: string; // hash PIN-u do odbijania czasu pracy
  hourlyRate: number;
  locations: string[];
  active: boolean;
  createdAt: Date;
}
const employeeSchema = new Schema<IEmployee>({
  name: { type: String, required: true },
  phone: { type: String, default: '' },
  position: { type: String, default: 'Obsługa' },
  pin: String,
  hourlyRate: { type: Number, default: 0 },
  locations: { type: [String], default: ['slupsk'] },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
export const Employee: Model<IEmployee> = (models.Employee as Model<IEmployee>) || model<IEmployee>('Employee', employeeSchema);

export interface IShift {
  _id: Types.ObjectId;
  employeeId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  from: string;
  to: string;
  location: string;
  note?: string;
}
const shiftSchema = new Schema<IShift>({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', index: true },
  date: { type: String, index: true },
  from: String,
  to: String,
  location: { type: String, default: 'slupsk' },
  note: String
});
export const Shift: Model<IShift> = (models.Shift as Model<IShift>) || model<IShift>('Shift', shiftSchema);

export interface ITimeEntry {
  _id: Types.ObjectId;
  employeeId: Types.ObjectId;
  location: string;
  clockIn: Date;
  clockOut?: Date | null;
  minutes?: number | null;
  edited?: boolean;
}
const timeEntrySchema = new Schema<ITimeEntry>({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', index: true },
  location: { type: String, default: 'slupsk' },
  clockIn: { type: Date, default: Date.now, index: true },
  clockOut: { type: Date, default: null },
  minutes: { type: Number, default: null },
  edited: { type: Boolean, default: false }
});
export const TimeEntry: Model<ITimeEntry> = (models.TimeEntry as Model<ITimeEntry>) || model<ITimeEntry>('TimeEntry', timeEntrySchema);

/* ============================================================
   MAGAZYN
   ============================================================ */
export interface IInventoryItem {
  _id: Types.ObjectId;
  name: string;
  unit: string; // kg, l, szt
  quantity: number;
  minQuantity: number;
  location: string;
  linkedProductIds: string[]; // przy stanie 0 produkty dostają „brak” w tym lokalu
  updatedAt: Date;
}
const inventorySchema = new Schema<IInventoryItem>({
  name: { type: String, required: true },
  unit: { type: String, default: 'szt' },
  quantity: { type: Number, default: 0 },
  minQuantity: { type: Number, default: 0 },
  location: { type: String, default: 'slupsk' },
  linkedProductIds: { type: [String], default: [] },
  updatedAt: { type: Date, default: Date.now }
});
export const InventoryItem: Model<IInventoryItem> =
  (models.InventoryItem as Model<IInventoryItem>) || model<IInventoryItem>('InventoryItem', inventorySchema);

export interface IInventoryLog {
  itemId: Types.ObjectId;
  change: number;
  reason: string;
  staffName?: string;
  at: Date;
}
const inventoryLogSchema = new Schema<IInventoryLog>({
  itemId: { type: Schema.Types.ObjectId, index: true },
  change: Number,
  reason: String,
  staffName: String,
  at: { type: Date, default: Date.now }
});
export const InventoryLog: Model<IInventoryLog> =
  (models.InventoryLog as Model<IInventoryLog>) || model<IInventoryLog>('InventoryLog', inventoryLogSchema);

/* ============================================================
   DZIENNIK ZMIAN W PANELU
   ============================================================ */
export interface IAuditLog {
  staffId?: Types.ObjectId | null;
  staffName: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  ip?: string;
  at: Date;
}
const auditSchema = new Schema<IAuditLog>({
  staffId: { type: Schema.Types.ObjectId, default: null },
  staffName: String,
  action: String,
  entity: String,
  entityId: String,
  details: String,
  ip: String,
  at: { type: Date, default: Date.now, index: true }
});
export const AuditLog: Model<IAuditLog> = (models.AuditLog as Model<IAuditLog>) || model<IAuditLog>('AuditLog', auditSchema);
