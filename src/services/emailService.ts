import axios from 'axios';
import fs from 'fs';
import path from 'path';

async function getBase64FromUrl(pdfUrl: string, defaultDir: string): Promise<string> {
  const fileName = path.basename(pdfUrl);
  const possiblePaths = [
    path.join(process.cwd(), 'uploads', defaultDir, fileName),
    path.join(process.cwd(), 'uploads', fileName),
    path.join(process.cwd(), fileName),
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
  throw new Error(`Could not find or read PDF file: ${fileName}`);
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
    const pdfBase64String = await getBase64FromUrl(pdfUrl, 'receipts');
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
    if (error.response && !error.response.text) {
      error.response.text = typeof error.response.data === 'object'
        ? JSON.stringify(error.response.data)
        : error.response.data;
    }
    console.error("Brevo Error:", error.response ? error.response.text : error.message);
    throw new Error("Failed to send email");
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
    const pdfBase64String = await getBase64FromUrl(pdfUrl, 'odf');
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
    if (error.response && !error.response.text) {
      error.response.text = typeof error.response.data === 'object'
        ? JSON.stringify(error.response.data)
        : error.response.data;
    }
    console.error("Brevo Error:", error.response ? error.response.text : error.message);
    throw new Error("Failed to send ODF email");
  }
}
