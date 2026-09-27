/** User-facing message for a failed receipt / ODF send request. */
export function sendErrorMessage(err: any): string {
  const status = err?.response?.status;
  const code = err?.response?.data?.error;
  if (status === 412 || code === 'CONFIGURATION_MISSING') {
    return 'Configuration manquante — Veuillez configurer vos paramètres Email/WhatsApp dans les réglages.';
  }
  if (code === 'CLIENT_EMAIL_MISSING') return 'Erreur : Veuillez ajouter une adresse email au profil de ce client.';
  if (code === 'CLIENT_PHONE_MISSING') return 'Erreur : Veuillez ajouter un numéro de téléphone au profil de ce client.';
  return err?.response?.data?.message || err?.response?.data?.error || "Erreur lors de l'envoi.";
}
