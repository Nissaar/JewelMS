/**
 * Whether the credentials for a given delivery method are configured.
 * Shared by the receipt and ODF sending routes.
 */
export const checkNotificationConfig = (method: 'whatsapp' | 'email' | 'both') => {
  const hasWhatsApp = process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID;
  const hasEmail = process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL;

  if (method === 'whatsapp' && !hasWhatsApp) return false;
  if (method === 'email' && !hasEmail) return false;
  if (method === 'both' && (!hasWhatsApp && !hasEmail)) return false;

  return true;
};
