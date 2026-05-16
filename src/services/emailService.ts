import axios from 'axios';

export async function sendEmailReceipt(email: string, customerName: string, pdfUrl: string, receiptNumber: string) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'Haujee Jewellery';

  if (!apiKey || !senderEmail) {
    console.warn("Brevo API key or sender email not configured. Skipping email.");
    return;
  }

  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { name: senderName, email: senderEmail },
        to: [{ email: email, name: customerName }],
        subject: `Votre Reçu Haujee Jewellery - N° ${receiptNumber}`,
        htmlContent: `
          <html>
            <body>
              <p>Bonjour ${customerName},</p>
              <p>Merci pour votre achat chez Haujee Jewellery.</p>
              <p>Veuillez trouver ci-joint votre reçu électronique (N° ${receiptNumber}).</p>
              <p>Lien vers le reçu: <a href="${pdfUrl}">Télécharger mon reçu</a></p>
              <br/>
              <p>Cordialement,</p>
              <p>L'équipe Haujee Jewellery</p>
            </body>
          </html>
        `,
        attachment: [
          {
            url: pdfUrl,
            name: `Recu_${receiptNumber}.pdf`
          }
        ]
      },
      {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error: any) {
    console.error("Brevo Email API Error:", error.response?.data || error.message);
    throw new Error("Failed to send email");
  }
}

export async function sendEmailODF(email: string, customerName: string, pdfUrl: string, odfNumber: string) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'Haujee Jewellery';

  if (!apiKey || !senderEmail) {
    console.warn("Brevo API key or sender email not configured. Skipping email.");
    return;
  }

  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { name: senderName, email: senderEmail },
        to: [{ email: email, name: customerName }],
        subject: `Formulaire de Rachat Haujee Jewellery - N° ${odfNumber}`,
        htmlContent: `
          <html>
            <body>
              <p>Bonjour ${customerName},</p>
              <p>Veuillez trouver ci-joint votre formulaire de rachat (ODF N° ${odfNumber}).</p>
              <p>Lien vers le document: <a href="${pdfUrl}">Télécharger mon ODF</a></p>
              <br/>
              <p>Cordialement,</p>
              <p>L'équipe Haujee Jewellery</p>
            </body>
          </html>
        `,
        attachment: [
          {
            url: pdfUrl,
            name: `ODF_${odfNumber}.pdf`
          }
        ]
      },
      {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error: any) {
    console.error("Brevo Email ODF Error:", error.response?.data || error.message);
    throw new Error("Failed to send ODF email");
  }
}
