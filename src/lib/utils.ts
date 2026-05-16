export const formatCurrency = (amount: number | string | null | undefined): string => {
  if (amount === null || amount === undefined || amount === '') return '0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0.00';
  
  // Use en-US to get commas as thousands separators, then replace them with a standard space.
  // This avoids locale-specific characters that might not render well in some PDF fonts
  // and fixes the reported "forward slash" issue.
  return num.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).replace(/,/g, ' ');
};
