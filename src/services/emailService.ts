import axios from 'axios';
import { ensureOdfFile, ensureReceiptFile, readOdfFile, readReceiptFile } from './documents';
import { escapeHtml } from '../lib/html';
import { describeHttpError } from '../lib/httpErrors';

const brevoClient = axios.create({
  baseURL: 'https://api.brevo.com/v3',
  timeout: 15000,
});

// Retry once, but only when the request never reached Brevo. A timeout after
// sending may already have delivered the email, so retrying it would send twice.
const CONNECT_ERRORS = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET']);
brevoClient.interceptors.response.use(undefined, async (error) => {
  const { config } = error;
  if (config && !config._isRetry && CONNECT_ERRORS.has(error.code)) {
    config._isRetry = true;
    return brevoClient(config);
  }
  return Promise.reject(error);
});

function brevoConfig() {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL || process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'Haujee Jewellery';
  if (!apiKey || !senderEmail) throw new Error('Email is not configured (BREVO_API_KEY / BREVO_SENDER_EMAIL)');
  return { apiKey, senderEmail, senderName };
}

async function sendEmail(to: { email: string; name: string }, subject: string, message: string, attachment: { name: string; content: Buffer }) {
  const { apiKey, senderEmail, senderName } = brevoConfig();
  try {
    const response = await brevoClient.post('/smtp/email', {
      sender: { email: senderEmail, name: senderName },
      to: [to],
      subject,
      htmlContent: `<html><body><p>Bonjour ${escapeHtml(to.name)}, ${escapeHtml(message)}</p></body></html>`,
      attachment: [{ name: attachment.name, content: attachment.content.toString('base64') }],
    }, { headers: { 'api-key': apiKey } });
    return response.data;
  } catch (error) {
    // Never log the raw axios error: its config carries the api-key header.
    throw new Error(`Brevo: ${describeHttpError(error)}`);
  }
}

export async function sendEmailReceipt(email: string, customerName: string, saleId: number) {
  const doc = await ensureReceiptFile(saleId);
  return sendEmail(
    { email, name: customerName },
    'Votre Reçu - Haujee Jewellery',
    'veuillez trouver votre reçu en pièce jointe.',
    { name: `Facture_${doc.serial}.pdf`, content: await readReceiptFile(doc) },
  );
}

export async function sendEmailODF(email: string, customerName: string, odfId: number) {
  const doc = await ensureOdfFile(odfId);
  return sendEmail(
    { email, name: customerName },
    'Votre Formulaire de Rachat - Haujee Jewellery',
    `veuillez trouver votre formulaire de rachat en pièce jointe (ODF N° ${doc.serial}).`,
    { name: `ODF_${doc.serial}.pdf`, content: await readOdfFile(doc) },
  );
}
