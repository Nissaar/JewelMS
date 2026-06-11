import axios from 'axios';
import fs from 'fs';
import path from 'path';

async function getBase64ForReceipt(pdfUrl: string | null | undefined, receiptNumber: string): Promise<string> {
  // Try existing file paths first if pdfUrl is provided
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
          const buffer = await fs.promises.readFile(p);
          return buffer.toString('base64');
        }
      } catch (e) {
        // Continue
      }
    }
  }

  // Fallback: If it's missing or not on disk, generate on-the-fly!
  console.log(`[Email Service] Receipt file not found on disk. Generating on-the-fly for receipt serial: ${receiptNumber}`);
  const { db } = await import('../db');
  const { receipts } = await import('../db/schema');
  const { eq } = await import('drizzle-orm');
  const { generateReceiptPDF, getPDFBuffer } = await import('./pdfService');
  const { uploadReceiptToStorage } = await import('./storageService');
  const { sanitize } = await import('../lib/utils');

  // Find the receipt by serial number
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

  return buffer.toString('base64');
}

async function getBase64ForODF(pdfUrl: string | null | undefined, odfNumber: string): Promise<string> {
  // Try existing file paths first if pdfUrl is provided
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
          const buffer = await fs.promises.readFile(p);
          return buffer.toString('base64');
        }
      } catch (e) {
        // Continue
      }
    }
  }

  // Fallback: If it's missing or not on disk, generate on-the-fly!
  console.log(`[Email Service] ODF file not found on disk. Generating on-the-fly for serial: ${odfNumber}`);
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

  return buffer.toString('base64');
}

export async function sendEmailReceipt(email: string, customerName: string, pdfUrl: string, receiptNumber: string) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL || process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'Haujee Jewellery';

  if (!apiKey || !senderEmail) {
    console.warn("Brevo API key or sender email not configured. Skipping email.");
    return;
  }

  try {
    const pdfBase64String = await getBase64ForReceipt(pdfUrl, receiptNumber);
    const receiptId = receiptNumber;
    const customer = { email, name: customerName };

    const sendSmtpEmail = {
      sender: { email: senderEmail, name: senderName },
      to: [{ email: customer.email, name: customer.name }],
      subject: `Votre Reçu - Haujee Jewellery`,
      htmlContent: `<html><body><p>Bonjour ${customer.name}, veuillez trouver votre reçu en pièce jointe.</p></body></html>`,
      attachment: [{ name: `Facture_${receiptId}.pdf`, content: pdfBase64String }]
    };

    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      sendSmtpEmail,
      {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error: any) {
    console.error("=== DETAILED BREVO FAILURE ===");

    // Check for Brevo SDK/Axios nested response body structures
    if (error.response && error.response.body) {
      console.error("Brevo API Body Error:", JSON.stringify(error.response.body, null, 2));
    } else if (error.response && error.response.data) {
      console.error("Brevo API Data Error:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Raw Error Object:", error);
    }

    console.error("==============================");
    throw error; // Re-throw the authentic error instead of a generic string
  }
}

export async function sendEmailODF(email: string, customerName: string, pdfUrl: string, odfNumber: string) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL || process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'Haujee Jewellery';

  if (!apiKey || !senderEmail) {
    console.warn("Brevo API key or sender email not configured. Skipping email.");
    return;
  }

  try {
    const pdfBase64String = await getBase64ForODF(pdfUrl, odfNumber);
    const customer = { email, name: customerName };

    const sendSmtpEmail = {
      sender: { email: senderEmail, name: senderName },
      to: [{ email: customer.email, name: customer.name }],
      subject: `Votre Formulaire de Rachat - Haujee Jewellery`,
      htmlContent: `<html><body><p>Bonjour ${customer.name}, veuillez trouver votre formulaire de rachat en pièce jointe (ODF N° ${odfNumber}).</p></body></html>`,
      attachment: [{ name: `ODF_${odfNumber}.pdf`, content: pdfBase64String }]
    };

    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      sendSmtpEmail,
      {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error: any) {
    console.error("=== DETAILED BREVO FAILURE ===");

    // Check for Brevo SDK/Axios nested response body structures
    if (error.response && error.response.body) {
      console.error("Brevo API Body Error:", JSON.stringify(error.response.body, null, 2));
    } else if (error.response && error.response.data) {
      console.error("Brevo API Data Error:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Raw Error Object:", error);
    }

    console.error("==============================");
    throw error; // Re-throw the authentic error instead of a generic string
  }
}
