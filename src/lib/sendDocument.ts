import axios from 'axios';

type Channel = 'whatsapp' | 'email';
interface Notification { id: number; channel: Channel; status: 'pending' | 'sent' | 'failed'; error?: string | null }

const LABEL: Record<Channel, string> = { whatsapp: 'WhatsApp', email: 'Email' };
const POLL_EVERY_MS = 2000;
const GIVE_UP_AFTER_MS = 60_000;

/**
 * Sends a receipt or ODF and waits for the real outcome of each channel, so
 * the message shown to staff says whether it was actually delivered.
 * Resolves with a user-facing summary; rejects if the request itself fails.
 */
export async function sendDocumentAndWait(kind: 'receipt' | 'odf', id: number, method: Channel | 'both'): Promise<{ ok: boolean; text: string }> {
  const url = kind === 'receipt' ? `/api/receipts/${id}/send` : `/api/odf/${id}/send`;
  const res = await axios.post(url, { method });
  let notifications: Notification[] = res.data.notifications || [];
  if (notifications.length === 0) return { ok: false, text: "Aucun canal d'envoi disponible pour ce client." };

  const ids = notifications.map(n => n.id).join(',');
  const started = Date.now();
  while (notifications.some(n => n.status === 'pending') && Date.now() - started < GIVE_UP_AFTER_MS) {
    await new Promise(resolve => setTimeout(resolve, POLL_EVERY_MS));
    const status = await axios.get('/api/notifications', { params: { kind, refId: id, ids } });
    notifications = status.data;
  }

  const parts = notifications.map(n =>
    n.status === 'sent' ? `${LABEL[n.channel]} : envoyé`
    : n.status === 'failed' ? `${LABEL[n.channel]} : échec${n.error ? ` (${n.error})` : ''}`
    : `${LABEL[n.channel]} : toujours en cours`);
  return { ok: notifications.every(n => n.status === 'sent'), text: parts.join(' · ') };
}
