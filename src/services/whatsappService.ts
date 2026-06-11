import axios from 'axios';
import fs from 'fs';
import path from 'path';

async function getOrGenerateReceiptUrl(pdfUrl: string | null | undefined, receiptNumber: string): Promise<string> {
  if (pdfUrl) {
    const fileName = path.basename(pdfUrl);
    const possiblePaths = [
      path.join(process.cwd(), 'uploads', 'receipts', fileName),
      path.join(process.cwd(), 'uploads', fileName),
      path.join(process.cwd(), fileName),
      path.join(process.cwd(), pdfUrl.replace(/^\//, '')),
    ];
    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(p)) {
          return pdfUrl;
        }
      } catch (e) {
        // Continue
      }
    }
  }

  // Fallback: If it's missing or not on disk, generate on-the-fly!
  console.log(`[WhatsApp Service] Receipt file not found on disk. Generating on-the-fly for receipt serial: ${receiptNumber}`);
  const { db } = await import('../db');
  const { receipts } = await import('../db/schema');
  const { eq } = await import('drizzle-orm');
  const { generateReceiptPDF, getPDFBuffer } = await import('./pdfService');
  const { uploadReceiptToStorage } = await import('./storageService');
  const { sanitize } = await import('../lib/utils');

  const serialNo = parseInt(receiptNumber);
  if (isNaN(serialNo)) {
    throw new Error(`Invalid receipt serial number: ${receiptNumber}`);
  }

  const receiptArr = await db.select().from(receipts).where(eq(receipts.receiptSerialNumber, serialNo)).limit(1);
  if (receiptArr.length === 0) {
    throw new Error(`Receipt record with serial number ${receiptNumber} not found in database.`);
  }
  const receiptRecord = receiptArr[0];

  const { doc, receipt } = await generateReceiptPDF(receiptRecord.saleId);
  const buffer = await getPDFBuffer(doc);
  const fileName = `receipt-${receipt.id}-${sanitize(receipt.receiptSerialNumber.toString())}.pdf`;
  const fileUrl = await uploadReceiptToStorage(fileName, buffer);

  // Update DB so we don't have to regenerate next time
  await db.update(receipts).set({ fileUrl }).where(eq(receipts.id, receipt.id));

  return fileUrl;
}

async function getOrGenerateODFUrl(pdfUrl: string | null | undefined, odfNumber: string): Promise<string> {
  if (pdfUrl) {
    const fileName = path.basename(pdfUrl);
    const possiblePaths = [
      path.join(process.cwd(), 'uploads', 'odf', fileName),
      path.join(process.cwd(), 'uploads', fileName),
      path.join(process.cwd(), fileName),
      path.join(process.cwd(), pdfUrl.replace(/^\//, '')),
    ];
    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(p)) {
          return pdfUrl;
        }
      } catch (e) {
        // Continue
      }
    }
  }

  // Fallback: If it's missing or not on disk, generate on-the-fly!
  console.log(`[WhatsApp Service] ODF file not found on disk. Generating on-the-fly for serial: ${odfNumber}`);
  const { db } = await import('../db');
  const { odf } = await import('../db/schema');
  const { eq } = await import('drizzle-orm');
  const { generateODFPDF, getPDFBuffer } = await import('./pdfService');
  const { uploadODFToStorage } = await import('./storageService');
  const { sanitize } = await import('../lib/utils');

  const serialNo = parseInt(odfNumber);
  if (isNaN(serialNo)) {
    throw new Error(`Invalid ODF serial number: ${odfNumber}`);
  }

  const odfArr = await db.select().from(odf).where(eq(odf.odfSerialNumber, serialNo)).limit(1);
  if (odfArr.length === 0) {
    throw new Error(`ODF record with serial number ${odfNumber} not found in database.`);
  }
  const odfRecord = odfArr[0];

  const { doc, odfRecord: genOdf } = await generateODFPDF(odfRecord.id);
  const buffer = await getPDFBuffer(doc);
  const fileName = `odf-${genOdf.id}-${sanitize(genOdf.odfSerialNumber.toString())}.pdf`;
  const fileUrl = await uploadODFToStorage(fileName, buffer);

  // Update DB
  await db.update(odf).set({ fileUrl }).where(eq(odf.id, genOdf.id));

  return fileUrl;
}

export async function sendWhatsAppReceipt(phoneNumber: string, pdfUrl: string, receiptNumber: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'receipt_notification';

  if (!token || !phoneNumberId) {
    console.warn("WhatsApp credentials not fully configured. Skipping send.");
    return;
  }

  // Clean phone number (remove +, spaces, etc.)
  const cleanNumber = phoneNumber.replace(/\D/g, '');

  try {
    const verifiedPdfUrl = await getOrGenerateReceiptUrl(pdfUrl, receiptNumber);
    const absoluteUrl = verifiedPdfUrl.startsWith('/') ? (process.env.APP_URL || 'http://localhost:3000') + verifiedPdfUrl : verifiedPdfUrl;

    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to: cleanNumber,
        type: "template",
        template: {
          name: templateName,
          language: { code: "fr" },
          components: [
            {
              type: "header",
              parameters: [
                {
                  type: "document",
                  document: {
                    link: absoluteUrl,
                    filename: `Reçu_${receiptNumber}.pdf`
                  }
                }
              ]
            },
            {
              type: "body",
              parameters: [
                { type: "text", text: receiptNumber }
              ]
            }
          ]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error: any) {
    const errorData = error.response?.data;
    const errMsg = errorData ? (typeof errorData === 'object' ? JSON.stringify(errorData) : errorData) : error.message;
    console.error(`[WhatsApp Receipt Send Error] for receipt ${receiptNumber} to ${phoneNumber}:`, errMsg);
    throw new Error(`Failed to send WhatsApp message: ${errMsg}`);
  }
}

export async function sendWhatsAppODF(phoneNumber: string, pdfUrl: string, odfNumber: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_ODF_TEMPLATE_NAME || 'odf_notification';

  if (!token || !phoneNumberId) {
    console.warn("WhatsApp credentials not fully configured. Skipping send.");
    return;
  }

  const cleanNumber = phoneNumber.replace(/\D/g, '');

  try {
    const verifiedPdfUrl = await getOrGenerateODFUrl(pdfUrl, odfNumber);
    const absoluteUrl = verifiedPdfUrl.startsWith('/') ? (process.env.APP_URL || 'http://localhost:3000') + verifiedPdfUrl : verifiedPdfUrl;

    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to: cleanNumber,
        type: "template",
        template: {
          name: templateName,
          language: { code: "fr" },
          components: [
            {
              type: "header",
              parameters: [
                {
                  type: "document",
                  document: {
                    link: absoluteUrl,
                    filename: `ODF_${odfNumber}.pdf`
                  }
                }
              ]
            },
            {
              type: "body",
              parameters: [
                { type: "text", text: odfNumber }
              ]
            }
          ]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error: any) {
    const errorData = error.response?.data;
    const errMsg = errorData ? (typeof errorData === 'object' ? JSON.stringify(errorData) : errorData) : error.message;
    console.error(`[WhatsApp ODF Send Error] for ODF ${odfNumber} to ${phoneNumber}:`, errMsg);
    throw new Error(`Failed to send WhatsApp ODF message: ${errMsg}`);
  }
}
