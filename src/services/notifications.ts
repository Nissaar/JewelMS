import { AppError, badRequest } from '../lib/errors';
import { checkNotificationConfig } from '../lib/notifications';

export type SendMethod = 'whatsapp' | 'email' | 'both';
export type DocumentKind = 'receipt' | 'odf';

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
export function channelsFor(method: SendMethod, customer: Recipient): Array<'whatsapp' | 'email'> {
  if (method !== 'both') return [method];
  return (['whatsapp', 'email'] as const).filter(c =>
    checkNotificationConfig(c) && (c === 'email' ? !!customer.email : !!customer.phoneNumber));
}

/**
 * Sends the document on each channel. Channels are independent: a WhatsApp
 * failure does not stop the email.
 */
export async function deliverDocument(kind: DocumentKind, refId: number, method: SendMethod, customer: Recipient) {
  const channels = channelsFor(method, customer);
  for (const channel of channels) {
    try {
      if (channel === 'whatsapp') {
        const { sendWhatsAppReceipt, sendWhatsAppODF } = await import('./whatsappService');
        await (kind === 'receipt' ? sendWhatsAppReceipt : sendWhatsAppODF)(customer.phoneNumber!, refId);
      } else {
        const { sendEmailReceipt, sendEmailODF } = await import('./emailService');
        await (kind === 'receipt' ? sendEmailReceipt : sendEmailODF)(customer.email!, customer.name, refId);
      }
      console.log(`[Notifications] ${kind} ${refId} sent by ${channel} to customer ${customer.id}.`);
    } catch (error: any) {
      console.error(`[Notifications] ${kind} ${refId} by ${channel} failed: ${error.message}`);
    }
  }
}
