import axios from 'axios';

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
  const absoluteUrl = pdfUrl.startsWith('/') ? (process.env.APP_URL || 'http://localhost:3000') + pdfUrl : pdfUrl;

  try {
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
    console.error("WhatsApp API Error:", error.response?.data || error.message);
    throw new Error("Failed to send WhatsApp message");
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
  const absoluteUrl = pdfUrl.startsWith('/') ? (process.env.APP_URL || 'http://localhost:3000') + pdfUrl : pdfUrl;

  try {
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
    console.error("WhatsApp ODF Error:", error.response?.data || error.message);
    throw new Error("Failed to send WhatsApp ODF message");
  }
}
