import { z } from 'zod';
import { FUNCTIONALITIES } from '../shared/permissions';

/**
 * Request body schemas. Every route parses its input through one of these, so
 * only the listed fields ever reach the database: anything else a client sends
 * (status, soldAt, id, createdAt, ...) is dropped.
 *
 * Conventions for optional fields in updates: absent means "leave unchanged",
 * an empty string or null means "clear".
 */

const blankToNull = (v: unknown) => (v === '' || v === null ? null : v);
const trimmed = (v: unknown) => (typeof v === 'string' ? v.trim() : v);

/** Optional text column: trimmed, '' becomes null. */
const text = (max: number) =>
  z.preprocess(v => blankToNull(trimmed(v)), z.string().max(max).nullable()).optional();

/** Required, non-empty text column. */
const requiredText = (max: number) =>
  z.preprocess(trimmed, z.string().min(1, 'Required').max(max));

/** Non-negative decimal that may arrive as a number or numeric string; '' becomes null. */
const decimal = (opts: { positive?: boolean } = {}) =>
  z.preprocess(
    v => {
      v = blankToNull(trimmed(v));
      return typeof v === 'string' ? Number(v) : v;
    },
    (opts.positive ? z.number().positive() : z.number().nonnegative()).finite().nullable(),
  ).optional();

const id = z.coerce.number().int().positive();
const optionalId = z.preprocess(blankToNull, id.nullable()).optional();

const date = z.preprocess(
  v => blankToNull(v) ?? undefined,
  z.coerce.date().refine(d => !isNaN(d.getTime()), 'Invalid date').optional(),
);

export const PAYMENT_MODES = ['Cash', 'Juice', 'Card', 'Bank Transfer', 'Cheque'] as const;

// --- Stock -----------------------------------------------------------------

const stockFields = {
  itemCode: text(100),
  category: requiredText(100),
  subCategory: text(100),
  stockType: z.enum(['on-display', 'in-store']),
  brand: text(100),
  yearsOfGuarantee: z.preprocess(v => blankToNull(v) ?? 0, z.coerce.number().int().min(0).max(100)).optional(),
  serialNumber: text(100),
  metalType: text(50),
  fineness: text(20),
  weightGrams: decimal(),
  price: decimal(),
};

export const stockCreateSchema = z.object({
  barcode: requiredText(90), // leaves room for the "-N" suffix of bulk creation
  ...stockFields,
  quantity: z.coerce.number().int().min(1).max(100).default(1),
});

export const stockUpdateSchema = z.object({
  barcode: requiredText(100).optional(),
  ...stockFields,
  category: stockFields.category.optional(),
  stockType: stockFields.stockType.optional(),
});

export const stockBulkEditSchema = z.object({
  baseItemCode: requiredText(90),
  ...stockFields,
  category: stockFields.category.optional(),
  stockType: stockFields.stockType.optional(),
});

// --- Customers -------------------------------------------------------------

const customerFields = {
  name: requiredText(255),
  email: z.preprocess(v => blankToNull(trimmed(v)), z.string().email('Invalid email').max(100).nullable()).optional(),
  address: text(2000),
  phoneNumber: text(20),
  idNumber: text(100),
  riskRating: z.enum(['Low', 'Medium', 'High']).optional(),
};

export const customerCreateSchema = z.object(customerFields);
export const customerUpdateSchema = z.object({ ...customerFields, name: customerFields.name.optional() });

// --- Sales -----------------------------------------------------------------

/**
 * One cart line. The price always comes from the stock record; the till only
 * says how much discount (VAT-inclusive rupees) was given on it.
 */
export const saleItemSchema = z.object({
  stockId: id,
  discountAmount: decimal().transform(v => v ?? 0),
});

export const saleCreateSchema = z.object({
  customerId: optionalId,
  paymentMode: z.enum(PAYMENT_MODES),
  chequeNumber: text(50),
  orderId: optionalId,
  linkedOdfId: optionalId,
  linkedCommandeId: optionalId,
  items: z.array(saleItemSchema).min(1, 'Aucun article spécifié pour la vente.').max(100),
});

// --- Orders ----------------------------------------------------------------

export const orderCreateSchema = z.object({
  customerId: id,
  itemDescription: text(2000),
  estimatedWeight: decimal(),
  estimatedPrice: decimal(),
  deposit: decimal(),
  createdAt: date,
});

export const orderFinalizeSchema = z.object({
  finalWeight: decimal(),
  finalPrice: decimal({ positive: true }).refine(v => v != null, 'Required'),
  paymentMode: z.enum(PAYMENT_MODES),
});

// --- ODF (multipart form: every field arrives as a string) -----------------

export const odfItemSchema = z.object({
  description: requiredText(500),
  mass: decimal().transform(v => v ?? 0),
  fineness: requiredText(20),
  price: decimal().transform(v => v ?? 0),
});

export const odfCreateSchema = z.object({
  customerId: id,
  metalType: text(50),
  itemReservedRepair: text(2000),
  description: text(2000),
  comments: text(2000),
  createdAt: date,
  tradeInItems: z.preprocess(
    v => {
      if (typeof v !== 'string') return v;
      try { return JSON.parse(v); } catch { return v; } // leave it to the array check to reject
    },
    z.array(odfItemSchema).min(1, 'Add at least one trade-in item').max(100),
  ),
});

// --- Admin -----------------------------------------------------------------

export const settingUpdateSchema = z.object({
  value: z.string().max(20000),
});

const functionalityIds = FUNCTIONALITIES.map(f => f.id) as [string, ...string[]];

export const permissionsUpdateSchema = z.object({
  permissions: z.array(z.object({
    functionality: z.enum(functionalityIds),
    canView: z.boolean().default(false),
    canCreate: z.boolean().default(false),
    canEdit: z.boolean().default(false),
    canDelete: z.boolean().default(false),
  })).max(FUNCTIONALITIES.length),
});

export const sendMethodSchema = z.object({
  method: z.enum(['whatsapp', 'email', 'both']),
});

/** Parses a positive integer route parameter, throwing a 400 on garbage. */
export const idParam = z.coerce.number().int().positive();
