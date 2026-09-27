import { useState } from 'react';
import { sumLines } from '../../shared/money';
import { priceCartLine } from '../../lib/cartPricing';

export interface CartItem {
  id: string | number;
  stockItem: any;
  barcode: string;
  qty: number;
  /** Price the customer pays, VAT included, as typed at the till. */
  editedInclusivePrice: string;
}

/** The till's cart, priced exactly as the server will record it. */
export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const lines = items.map(item => priceCartLine(item.stockItem.price, item.editedInclusivePrice));
  const totals = sumLines(lines.map(l => l.amounts));
  const error = lines.find(l => l.error)?.error ?? null;

  /** Adds a stock item at its list price. Returns false if it is already in the cart. */
  const add = (stockItem: any): boolean => {
    if (items.some(ci => ci.stockItem.id === stockItem.id)) return false;
    const item: CartItem = {
      id: stockItem.id || stockItem.barcode || Date.now(),
      stockItem,
      barcode: stockItem.barcode || '',
      qty: 1,
      editedInclusivePrice: stockItem.price ? Number(stockItem.price).toString() : '0',
    };
    // Check again against the latest cart: two quick scans can both pass the check above.
    setItems(prev => prev.some(ci => ci.stockItem.id === stockItem.id) ? prev : [...prev, item]);
    return true;
  };

  const remove = (index: number) => setItems(prev => prev.filter((_, i) => i !== index));
  const setPrice = (index: number, price: string) =>
    setItems(prev => prev.map((item, i) => i === index ? { ...item, editedInclusivePrice: price } : item));
  const clear = () => setItems([]);

  return { items, lines, totals, error, add, remove, setPrice, clear };
}

export type Cart = ReturnType<typeof useCart>;
