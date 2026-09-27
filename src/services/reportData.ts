import { and, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../db';
import { customers, odf, odfItems, receipts, saleItems, sales } from '../db/schema';
import { badRequest } from '../lib/errors';
import { inShopTime } from '../lib/time';

/**
 * Report queries shared by the on-screen reports and their PDF versions, so
 * both always show the same figures. Only completed sales are counted, and
 * sales are reported per item (sale_items), not per cart.
 */

const completed = eq(sales.status, 'Completed');

/*
 * Correlated subqueries are written as plain SQL: drizzle leaves column names
 * unqualified inside sql fragments, which is ambiguous across joined tables.
 */

/** All barcodes of a sale's items, comma-separated (a cart can hold several). */
export const saleBarcodes = sql<string>`(SELECT STRING_AGG(si.barcode, ', ' ORDER BY si.id)
  FROM sale_items si WHERE si.sale_id = sales.id)`;

/**
 * Parses an optional YYYY-MM-DD query value as the start of that day in shop
 * time (new Date('2026-09-01') would be midnight UTC, 4 a.m. in Mauritius).
 */
export function parseDateParam(value: unknown, name: string): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const d = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(String(value));
  if (isNaN(d.getTime())) throw badRequest(`${name}: invalid date`);
  return d;
}

/** Inclusive date range filter on a timestamp column; the end date covers its whole day. */
function dateRange(column: any, startDate?: string, endDate?: string): SQL[] {
  const conditions: SQL[] = [];
  const start = parseDateParam(startDate, 'startDate');
  const end = parseDateParam(endDate, 'endDate');
  if (start) conditions.push(sql`${column} >= ${start}`);
  if (end) {
    end.setHours(23, 59, 59, 999);
    conditions.push(sql`${column} <= ${end}`);
  }
  return conditions;
}

const intParam = (value: unknown, name: string, min: number, max: number): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw badRequest(`${name}: must be between ${min} and ${max}`);
  return n;
};

/** The sale's stored VAT, falling back to 15% of the net for very old rows without it. */
const saleVat = sql<string>`COALESCE(${sales.vat15}, ROUND(${sales.amount} * 0.15, 2))`;

// --- VAT ----------------------------------------------------------------------

export async function vatReportRows(filters: { day?: string; month?: string; year?: string }) {
  const conditions: SQL[] = [completed];
  const year = intParam(filters.year, 'year', 2000, 2100);
  const month = intParam(filters.month, 'month', 1, 12);
  const day = intParam(filters.day, 'day', 1, 31);
  if (year) conditions.push(sql`EXTRACT(YEAR FROM ${inShopTime(sales.createdAt)}) = ${year}`);
  if (month) conditions.push(sql`EXTRACT(MONTH FROM ${inShopTime(sales.createdAt)}) = ${month}`);
  if (day) conditions.push(sql`EXTRACT(DAY FROM ${inShopTime(sales.createdAt)}) = ${day}`);

  const rows = await db.select({
    saleId: sales.id,
    receiptNo: receipts.receiptSerialNumber,
    itemDetails: sales.itemDetails,
    weight: sales.weight,
    metalType: sales.metalType,
    fineness: sales.fineness,
    amountExclVat: sales.amount,
    vatAmount: saleVat,
    createdAt: sales.createdAt,
  })
  .from(sales)
  .leftJoin(receipts, eq(sales.id, receipts.saleId))
  .where(and(...conditions))
  .orderBy(sales.id);

  return rows.map((row: any) => {
    const amount = Number(row.amountExclVat || 0);
    const vat = Number(row.vatAmount || 0);
    return { ...row, vatAmount: vat.toFixed(2), total: (amount + vat).toFixed(2) };
  });
}

// --- Sales by metal (per item) ---------------------------------------------

/** The line's stored VAT; for rows without one, its share of the sale's VAT. */
const itemVat = sql<string>`COALESCE(${saleItems.vat15}, CASE WHEN COALESCE(${sales.amount}, 0) = 0 THEN 0
  ELSE ROUND(${saleVat} * ${saleItems.amount} / ${sales.amount}, 2) END)`;

function metalCondition(metalType: string): SQL | undefined {
  const m = metalType.toLowerCase().trim();
  if (m === 'or' || m === 'gold') return or(ilike(saleItems.metalType, 'Gold'), ilike(saleItems.metalType, 'Or'));
  if (m === 'argent' || m === 'silver') return or(ilike(saleItems.metalType, 'Silver'), ilike(saleItems.metalType, 'Argent'));
  if (m === 'platine' || m === 'platinum') return or(ilike(saleItems.metalType, 'Platinum'), ilike(saleItems.metalType, 'Platine'));
  return eq(sql`LOWER(${saleItems.metalType})`, m);
}

export async function salesByMetalRows(filters: { startDate?: string; endDate?: string; metalType?: string; fineness?: string }) {
  const conditions: (SQL | undefined)[] = [completed, ...dateRange(sales.createdAt, filters.startDate, filters.endDate)];
  if (filters.metalType && filters.metalType !== 'all') conditions.push(metalCondition(filters.metalType));
  if (filters.fineness && filters.fineness !== 'all') conditions.push(eq(sql`LOWER(${saleItems.fineness})`, filters.fineness.toLowerCase()));

  const rows = await db.select({
    id: sales.id,
    itemId: saleItems.id,
    createdAt: sales.createdAt,
    customerName: customers.name,
    itemDetails: saleItems.itemDetails,
    barcode: saleItems.barcode,
    metalType: saleItems.metalType,
    fineness: saleItems.fineness,
    weight: saleItems.weight,
    amount: saleItems.amount,
    vat15: itemVat,
    receiptNo: receipts.receiptSerialNumber,
  })
  .from(saleItems)
  .innerJoin(sales, eq(saleItems.saleId, sales.id))
  .leftJoin(customers, eq(sales.customerId, customers.id))
  .leftJoin(receipts, eq(sales.id, receipts.saleId))
  .where(and(...conditions))
  .orderBy(sql`${sales.createdAt} DESC`, saleItems.id);

  const items = rows.map((row: any) => {
    const weight = Number(row.weight || 0);
    const amount = Number(row.amount || 0);
    const vat = Number(row.vat15 || 0);
    return { ...row, weight, amount, totalWithVat: amount + vat };
  });

  return {
    items,
    summary: {
      totalWeight: items.reduce((s: number, i: any) => s + i.weight, 0),
      totalRevenue: items.reduce((s: number, i: any) => s + i.amount, 0),
      totalRevenueWithVat: items.reduce((s: number, i: any) => s + i.totalWithVat, 0),
      count: items.length,
    },
  };
}

// --- Discounts ----------------------------------------------------------------

export async function discountRows() {
  const rows = await db.select({
    saleId: sales.id,
    createdAt: sales.createdAt,
    customerName: customers.name,
    customerIdNumber: customers.idNumber,
    itemBarcode: saleBarcodes,
    itemDetails: sales.itemDetails,
    amount: sales.amount,
    vat15: saleVat,
    discountAmount: sales.discountAmount,
    discountPercentage: sales.discountPercentage,
  })
  .from(sales)
  .leftJoin(customers, eq(sales.customerId, customers.id))
  .where(and(completed, sql`COALESCE(${sales.discountAmount}, 0) > 0`))
  .orderBy(sql`${sales.createdAt} DESC`);

  const data = rows.map((row: any) => {
    const discAmt = Number(row.discountAmount || 0);
    const finalPriceTTC = Number(row.amount || 0) + Number(row.vat15 || 0);
    return {
      saleId: row.saleId,
      createdAt: row.createdAt,
      customerName: row.customerName || 'Client inconnu',
      customerIdNumber: row.customerIdNumber || '',
      itemBarcode: row.itemBarcode || 'N/A',
      itemDetails: row.itemDetails || 'N/A',
      originalPriceTTC: (finalPriceTTC + discAmt).toFixed(2),
      finalPriceTTC: finalPriceTTC.toFixed(2),
      discountAmount: discAmt.toFixed(2),
      discountPercentage: Number(row.discountPercentage || 0).toFixed(2),
    };
  });

  return {
    data,
    summary: {
      totalDiscounts: data.reduce((s: number, r: any) => s + Number(r.discountAmount), 0).toFixed(2),
      count: data.length,
    },
  };
}

// --- Trade-in register (Assay Office) --------------------------------------

export async function tradeInRows(filters: { startDate?: string; endDate?: string }) {
  const conditions = dateRange(odf.createdAt, filters.startDate, filters.endDate);

  const records = await db.select({
    id: odf.id,
    odfSerialNumber: odf.odfSerialNumber,
    createdAt: odf.createdAt,
    customerName: customers.name,
    customerNIC: customers.idNumber,
    customerAddress: customers.address,
    metalType: odf.metalType,
    fineness: odf.fineness,
    weight: odf.weight,
    description: odf.description,
    // The completed sale this trade-in was used against, if any.
    receiptNo: sql<number | null>`(SELECT r.receipt_serial_number FROM sales s
      JOIN receipts r ON r.sale_id = s.id
      WHERE s.linked_odf_id = odf.id AND s.status = 'Completed'
      ORDER BY s.id LIMIT 1)`,
  })
  .from(odf)
  .innerJoin(customers, eq(odf.customerId, customers.id))
  .where(conditions.length ? and(...conditions) : undefined)
  .orderBy(odf.createdAt);

  // One query for all items instead of one per ODF.
  const ids = records.map((r: any) => r.id);
  const items = ids.length ? await db.select().from(odfItems).where(inArray(odfItems.odfId, ids)).orderBy(odfItems.id) : [];
  const itemsByOdf = new Map<number, any[]>();
  for (const item of items) itemsByOdf.set(item.odfId, [...(itemsByOdf.get(item.odfId) || []), item]);

  return records.flatMap((record: any) => {
    const base = {
      id: record.id,
      date: record.createdAt,
      customerName: record.customerName,
      customerNIC: record.customerNIC,
      customerAddress: record.customerAddress,
      invNo: `#ODF-${record.odfSerialNumber || record.id}`,
      out: record.receiptNo ? `#FS-${record.receiptNo}` : '-',
    };
    const recordItems = itemsByOdf.get(record.id) || [];
    if (recordItems.length === 0) {
      return [{ ...base, description: record.description || `${record.metalType} ${record.fineness}`, weight: record.weight, fineness: record.fineness }];
    }
    return recordItems.map(item => ({
      ...base,
      description: item.description || `${record.metalType} ${item.fineness || record.fineness}`,
      weight: item.mass,
      fineness: item.fineness,
    }));
  });
}
