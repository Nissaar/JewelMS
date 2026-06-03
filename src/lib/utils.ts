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

export const formatWeight = (weight: number | string | null | undefined): string => {
  if (weight === null || weight === undefined || weight === '') return '0.000 g';
  const num = typeof weight === 'string' ? parseFloat(weight) : weight;
  if (isNaN(num)) return '0.000 g';
  return `${num.toFixed(3)} g`;
};

export const formatWeightValue = (weight: number | string | null | undefined): string => {
  if (weight === null || weight === undefined || weight === '') return '0.000';
  const num = typeof weight === 'string' ? parseFloat(weight) : weight;
  if (isNaN(num)) return '0.000';
  return num.toFixed(3);
};

export const formatItemDetails = (details: any): string => {
  if (!details) return '';
  if (typeof details !== 'string') return String(details);
  
  try {
    const parsed = JSON.parse(details);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed.description || parsed.name || Object.values(parsed).filter(v => typeof v === 'string' || typeof v === 'number').join(' ');
    }
    return details;
  } catch (e) {
    return details; // Return as-is if it's already a clean plain string
  }
};

export const getCleanDisplayLabel = (item: any): string => {
  if (!item) return "";
  // Check if item_details exists and needs parsing
  let details = item.item_details || item.itemDetails || item.description || item.subCategory || item.category || item.name;
  if (typeof details === 'string' && details.startsWith('{')) {
    try {
      const parsed = JSON.parse(details);
      return `${item.barcode || ''} - ${parsed.name || ''} (${item.metal_type || item.metalType || parsed.metal_type || ''} ${item.fineness || ''})`.replace(/^\s*-\s*/, '');
    } catch (e) {
      return item.barcode ? `${item.barcode} - ${details}` : details;
    }
  }
  return `${item.barcode || ''} - ${item.name || details || 'Article Sans Nom'}`;
};

export const getItemFullDescription = (item: any): string => {
  if (!item) return "";
  
  // 1. Determine details source
  const details = item.itemDetails || item.item_details || item.description || item.subCategory || item.category || 'Article';
  
  let name = "";
  let category = item.category || "";
  let metalType = item.metalType || item.metal_type || "";
  let fineness = item.fineness || "";
  let brand = item.brand || "";

  // 2. Parse if JSON formatted
  if (typeof details === 'string' && details.startsWith('{')) {
    try {
      const parsed = JSON.parse(details);
      if (parsed) {
        name = parsed.name || parsed.subCategory || parsed.description || "";
        category = parsed.category || category;
        metalType = parsed.metalType || parsed.metal_type || metalType;
        fineness = parsed.fineness || fineness;
        brand = parsed.brand || brand;
      }
    } catch (e) {
      // ignore
    }
  }

  // If name is still empty, try to fallback to normal attributes
  if (!name) {
    name = item.subCategory || item.name || (typeof details === 'string' && !details.startsWith('{') ? details : "");
  }
  
  // If still empty fallback
  if (!name) name = "Article";

  // If details is a direct string with details already formatted like "Ring (Gold 22k)", avoid duplicate formatting
  if (typeof details === 'string' && !details.startsWith('{') && details.includes('(')) {
    return details;
  }

  const cleanName = brand ? `${name} (${brand})` : name;
  const metalPurity = [metalType, fineness].filter(Boolean).join(' ');
  const parts = [cleanName, category].filter(Boolean);
  
  let description = parts.join(' - ');
  if (metalPurity) {
    description += ` (${metalPurity})`;
  }
  
  return description;
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
