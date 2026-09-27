import axios from 'axios';
import { ensureOdfFile, ensureReceiptFile } from './documents';
import { signedFileUrl } from './storage';
import { describeHttpError } from '../lib/httpErrors';

function whatsappConfig() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error('WhatsApp is not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)');
  return { token, phoneNumberId };
}

/** Sends a document template: the PDF as header, the document number as body text. */
async function sendDocumentTemplate(phoneNumber: string, templateName: string, link: string, fileName: string, number: string) {
  const { token, phoneNumberId } = whatsappConfig();
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: phoneNumber.replace(/\D/g, ''),
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'fr' },
          components: [
            { type: 'header', parameters: [{ type: 'document', document: { link, filename: fileName } }] },
            { type: 'body', parameters: [{ type: 'text', text: number }] },
          ],
        },
      },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  } catch (error) {
    throw new Error(`WhatsApp: ${describeHttpError(error)}`);
  }
}

export async function sendWhatsAppReceipt(phoneNumber: string, saleId: number) {
  const doc = await ensureReceiptFile(saleId);
  return sendDocumentTemplate(
    phoneNumber,
    process.env.WHATSAPP_TEMPLATE_NAME || 'receipt_notification',
    signedFileUrl('receipts', doc.fileName),
    `Reçu_${doc.serial}.pdf`,
    doc.serial,
  );
}

export async function sendWhatsAppODF(phoneNumber: string, odfId: number) {
  const doc = await ensureOdfFile(odfId);
  return sendDocumentTemplate(
    phoneNumber,
    process.env.WHATSAPP_ODF_TEMPLATE_NAME || 'odf_notification',
    signedFileUrl('odf', doc.fileName),
    `ODF_${doc.serial}.pdf`,
    doc.serial,
  );
}
