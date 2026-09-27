import { eq } from 'drizzle-orm';
import { db } from '../db';
import { notificationLog } from '../db/schema';
import { AppError, badRequest } from '../lib/errors';
import { checkNotificationConfig } from '../lib/notifications';

export type SendMethod = 'whatsapp' | 'email' | 'both';
export type DocumentKind = 'receipt' | 'odf';
type Channel = 'whatsapp' | 'email';

interface Recipient {
  id: number;
  name: string;
  email: string | null;
  phoneNumber: string | null;
}

/**
 * Checks everything that can be known before sending, so the caller gets a
 * clear error instead of a silent background failure.
 */
export function assertCanSend(method: SendMethod, customer: Recipient | undefined): asserts customer is Recipient {
  if (!checkNotificationConfig(method)) {
    throw new AppError('WhatsApp or Email service is not configured on the server.', 412, 'CONFIGURATION_MISSING');
  }
  if (!customer) throw badRequest('Customer info required for sending.');
  if ((method === 'email' || method === 'both') && !customer.email) {
    throw badRequest("Le client n'a pas d'adresse email configurée.", 'CLIENT_EMAIL_MISSING');
  }
  if (method === 'whatsapp' && !customer.phoneNumber) {
    throw badRequest("Le client n'a pas de numéro de téléphone configuré.", 'CLIENT_PHONE_MISSING');
  }
}

/** Channels that will actually be used; "both" skips whatever is unconfigured or missing. */
export function channelsFor(method: SendMethod, customer: Recipient): Channel[] {
  if (method !== 'both') return [method];
  return (['whatsapp', 'email'] as const).filter(c =>
    checkNotificationConfig(c) && (c === 'email' ? !!customer.email : !!customer.phoneNumber));
}

/**
 * Mauritian numbers are stored without the country code (e.g. "5712 3456").
 * WhatsApp needs the full international number, so local 7/8-digit numbers
 * get 230 in front. Numbers already in international form are kept.
 */
export function toWhatsAppNumber(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 7 || digits.length === 8) digits = `230${digits}`;
  return digits;
}

/**
 * Records one pending log row per channel and starts sending in the
 * background. Returns the rows so the caller can follow their status.
 */
export async function queueDocument(kind: DocumentKind, refId: number, method: SendMethod, customer: Recipient, userId?: number) {
  const channels = channelsFor(method, customer);
  const rows = await db.insert(notificationLog).values(channels.map(channel => ({
    kind,
    refId,
    channel,
    recipient: channel === 'email' ? customer.email : toWhatsAppNumber(customer.phoneNumber || ''),
    createdBy: userId ?? null,
  }))).returning();

  setImmediate(() => { void deliver(kind, refId, customer, rows); });
  return rows.map((r) => ({ id: r.id, channel: r.channel, status: r.status }));
}

/** Sends on each channel independently: a WhatsApp failure doesn't stop the email. */
async function deliver(kind: DocumentKind, refId: number, customer: Recipient, rows: any[]) {
  for (const row of rows) {
    let status: 'sent' | 'failed' = 'sent';
    let error: string | null = null;
    try {
      if (row.channel === 'whatsapp') {
        const { sendWhatsAppReceipt, sendWhatsAppODF } = await import('./whatsappService');
        await (kind === 'receipt' ? sendWhatsAppReceipt : sendWhatsAppODF)(row.recipient, refId);
      } else {
        const { sendEmailReceipt, sendEmailODF } = await import('./emailService');
        await (kind === 'receipt' ? sendEmailReceipt : sendEmailODF)(row.recipient, customer.name, refId);
      }
    } catch (err: any) {
      status = 'failed';
      error = String(err?.message || err).slice(0, 1000);
      console.error(`[Notifications] ${kind} ${refId} by ${row.channel} failed: ${error}`);
    }
    await db.update(notificationLog)
      .set({ status, error, updatedAt: new Date() })
      .where(eq(notificationLog.id, row.id))
      .catch((e: any) => console.error('[Notifications] could not record result:', e.message));
  }
}
