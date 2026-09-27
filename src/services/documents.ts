import { eq } from 'drizzle-orm';
import { db } from '../db';
import { odf, receipts } from '../db/schema';
import { notFound } from '../lib/errors';
import { generateODFPDF, generateReceiptPDF, getPDFBuffer } from './pdf';
import { fileExists, readFile, saveFile } from './storage';

/**
 * Stored copies of customer documents, used when sending them by email or
 * WhatsApp. Generated once on first need and reused afterwards; regenerated if
 * the file has gone missing from disk.
 */

export interface StoredDocument {
  fileName: string;
  /** Number shown to the customer (receipt or ODF serial). */
  serial: string;
}

export async function ensureReceiptFile(saleId: number): Promise<StoredDocument> {
  const [existing] = await db.select().from(receipts).where(eq(receipts.saleId, saleId)).limit(1);
  if (existing?.fileUrl && fileExists('receipts', existing.fileUrl)) {
    return { fileName: existing.fileUrl, serial: String(existing.receiptSerialNumber) };
  }

  // The stored copy is the original: it isn't a print and carries no COPIE mark.
  const { doc, receipt } = await generateReceiptPDF(saleId, { countAsPrint: false });
  const fileName = await saveFile('receipts', await getPDFBuffer(doc), '.pdf');
  await db.update(receipts).set({ fileUrl: fileName }).where(eq(receipts.id, receipt.id));
  return { fileName, serial: String(receipt.receiptSerialNumber) };
}

export async function ensureOdfFile(odfId: number): Promise<StoredDocument> {
  const [existing] = await db.select().from(odf).where(eq(odf.id, odfId)).limit(1);
  if (!existing) throw notFound('ODF record not found');
  if (existing.fileUrl && fileExists('odf', existing.fileUrl)) {
    return { fileName: existing.fileUrl, serial: String(existing.odfSerialNumber) };
  }

  const { doc } = await generateODFPDF(odfId);
  const fileName = await saveFile('odf', await getPDFBuffer(doc), '.pdf');
  await db.update(odf).set({ fileUrl: fileName }).where(eq(odf.id, odfId));
  return { fileName, serial: String(existing.odfSerialNumber) };
}

export const readReceiptFile = (doc: StoredDocument) => readFile('receipts', doc.fileName);
export const readOdfFile = (doc: StoredDocument) => readFile('odf', doc.fileName);
