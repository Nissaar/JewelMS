export const formatCurrency = (amount: number | string | null | undefined): string => {
  if (amount === null || amount === undefined || amount === '') return '0.00 Rs';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0.00 Rs';
  
  // Mauritian Rupee formatting as requested: 1 000.00 Rs
  const formatted = new Intl.NumberFormat('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(num).replace(/,/g, ' ');

  return `${formatted} Rs`;
};

export const sanitize = (str: string | null | undefined): string => {
  if (!str) return 'unknown';
  // Remove accents, replace non-alphanumeric with _, trim, and lowercase
  return str.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .toLowerCase()
    .slice(0, 50); // Limit length
};
