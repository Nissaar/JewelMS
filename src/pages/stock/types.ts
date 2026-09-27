export interface StockItem {
  id: number;
  barcode: string;
  itemCode?: string;
  category: string;
  subCategory: string;
  stockType: string;
  brand?: string;
  yearsOfGuarantee?: number;
  serialNumber?: string;
  metalType?: string;
  fineness?: string;
  weightGrams?: string;
  price?: string;
  createdAt: string;
}

export interface SubCategory {
  name: string;
  category: string;
}

/** Stock drop-down options, from the stock_* and guarantee_options settings. */
export interface StockMetadata {
  stock_categories?: string[];
  stock_sub_categories?: SubCategory[];
  stock_metal_types?: string[];
  stock_fineness_options?: string[];
  stock_sewing_machine_brands?: string[];
  guarantee_options?: string[];
  [key: string]: unknown;
}

export type StockForm = {
  barcode: string;
  itemCode: string;
  category: string;
  subCategory: string;
  stockType: string;
  brand: string;
  yearsOfGuarantee: number;
  serialNumber: string;
  metalType: string;
  fineness: string;
  weightGrams: string;
  price: string;
  quantity: number;
};

/** "HJ01-3" -> "HJ01": items created together share a base code. */
export const getBaseItemCode = (itemCode?: string): string | null => {
  if (!itemCode) return null;
  const match = itemCode.match(/^(.+)-\d+$/);
  return match ? match[1] : null;
};

/** First sub-category name belonging to a category. */
export const firstSubCategory = (metadata: StockMetadata, category: string): string =>
  (metadata.stock_sub_categories || []).find(sc => sc.category === category)?.name || '';

/** A blank form with the configured defaults for the given category. */
export function emptyStockForm(metadata: StockMetadata, category = metadata.stock_categories?.[0] || 'Jewellery'): StockForm {
  const isJewellery = category === 'Jewellery';
  return {
    barcode: '',
    itemCode: '',
    category,
    subCategory: firstSubCategory(metadata, category),
    stockType: 'on-display',
    brand: category === 'Sewing Machine' ? (metadata.stock_sewing_machine_brands?.[0] || '') : '',
    yearsOfGuarantee: 0,
    serialNumber: '',
    metalType: isJewellery ? (metadata.stock_metal_types?.[0] || '') : '',
    fineness: isJewellery ? (metadata.stock_fineness_options?.[0] || '') : '',
    weightGrams: '',
    price: '',
    quantity: 1,
  };
}
