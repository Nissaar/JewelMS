import { pgTable, serial, text, varchar, timestamp, boolean, integer, jsonb, unique, numeric, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).unique().notNull(),
  email: varchar('email', { length: 100 }).unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).default('User').notNull(), // 'Admin' | 'User'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const rolesPermissions = pgTable('roles_permissions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  functionality: varchar('functionality', { length: 50 }).notNull(),
  canView: boolean('can_view').default(false).notNull(),
  canCreate: boolean('can_create').default(false).notNull(),
  canEdit: boolean('can_edit').default(false).notNull(),
  canDelete: boolean('can_delete').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  unq: unique().on(t.userId, t.functionality),
}));

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  actionType: varchar('action_type', { length: 50 }).notNull(),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
});

export const stock = pgTable('stock', {
  id: serial('id').primaryKey(),
  barcode: varchar('barcode', { length: 100 }).unique().notNull(),
  category: varchar('category', { length: 20 }).notNull(), // 'Jewellery' | 'Pen' | 'Sewing Machine' | 'Parts'
  subCategory: varchar('sub_category', { length: 100 }),
  stockType: varchar('stock_type', { length: 20 }).notNull(), // 'on-display' | 'in-store'
  
  // General / Non-Jewellery
  brand: varchar('brand', { length: 100 }),
  yearsOfGuarantee: integer('years_of_guarantee').default(0),
  serialNumber: varchar('serial_number', { length: 100 }),

  // Jewellery Specifics
  metalType: varchar('metal_type', { length: 50 }),
  fineness: varchar('fineness', { length: 20 }),
  weightGrams: numeric('weight_grams', { precision: 10, scale: 3 }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 100 }),
  address: text('address'),
  phoneNumber: varchar('phone_number', { length: 20 }),
  idNumber: varchar('id_number', { length: 100 }).unique().notNull(),
  riskRating: varchar('risk_rating', { length: 20 }).default('Low').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idNumIdx: index('idx_customers_id_number').on(t.idNumber),
}));

export const sales = pgTable('sales', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  stockId: integer('stock_id').references(() => stock.id, { onDelete: 'set null' }),
  datetime: timestamp('datetime', { withTimezone: true }).defaultNow().notNull(),
  paymentMode: varchar('payment_mode', { length: 20 }).notNull(), // 'Cash' | 'Juice' | 'Card' | 'Bank Transfer' | 'Cheque'
  chequeNumber: varchar('cheque_number', { length: 50 }),
  qty: integer('qty').default(1).notNull(),
  itemDetails: text('item_details'),
  weight: numeric('weight', { precision: 10, scale: 3 }),
  fineness: varchar('fineness', { length: 20 }),
  unitSalesPrice: numeric('unit_sales_price', { precision: 15, scale: 2 }),
  amount: numeric('amount', { precision: 15, scale: 2 }),
  vat15: numeric('vat_15', { precision: 15, scale: 2 }),
  metalType: varchar('metal_type', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const receipts = pgTable('receipts', {
  id: serial('id').primaryKey(),
  receiptSerialNumber: serial('receipt_serial_number'),
  saleId: integer('sale_id').references(() => sales.id, { onDelete: 'cascade' }).notNull(),
  printCount: integer('print_count').default(0).notNull(),
  fileUrl: text('file_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: serial('order_number'),
  customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  itemDescription: text('item_description'),
  estimatedWeight: numeric('estimated_weight', { precision: 10, scale: 3 }),
  finalWeight: numeric('final_weight', { precision: 10, scale: 3 }),
  finalPrice: numeric('final_price', { precision: 15, scale: 2 }),
  status: varchar('status', { length: 20 }).default('Pending').notNull(), // 'Pending' | 'Completed'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const odf = pgTable('odf', {
  id: serial('id').primaryKey(),
  odfSerialNumber: serial('odf_serial_number'),
  date: timestamp('date', { withTimezone: true }).defaultNow().notNull(),
  customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  itemReservedRepair: text('item_reserved_repair'),
  comments: text('comments'),
  weight: numeric('weight', { precision: 10, scale: 3 }),
  metalType: varchar('metal_type', { length: 50 }),
  fineness: varchar('fineness', { length: 20 }),
  amount: numeric('amount', { precision: 15, scale: 2 }),
  imageUrl: text('image_url'),
  fileUrl: text('file_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).unique().notNull(),
  value: text('value'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
