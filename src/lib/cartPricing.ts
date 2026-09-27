import { splitGross, toCents, type LineAmounts } from '../shared/money';

export interface PricedLine {
  amounts: LineAmounts;
  discountCents: number;
  /** Why this line can't be sold as entered, or null when it can. */
  error: string | null;
}

/**
 * Prices one cart line the way the server does: the list price comes from
 * stock, the typed price may only lower it, and it must stay above zero.
 */
export function priceCartLine(listPrice: string | number | null | undefined, typedPrice: string): PricedLine {
  const listCents = toCents(listPrice);
  const priceCents = toCents(typedPrice.trim() === '' ? NaN : typedPrice);

  let error: string | null = null;
  if (listCents <= 0) error = "Cet article n'a pas de prix. Ajoutez un prix dans le Stock avant de le vendre.";
  else if (!Number.isFinite(priceCents) || priceCents <= 0) error = 'Chaque article doit avoir un prix supérieur à 0.';
  else if (priceCents > listCents) error = 'Le prix ne peut pas dépasser le prix affiché en stock.';

  if (error) return { amounts: splitGross(0), discountCents: 0, error };
  return { amounts: splitGross(priceCents), discountCents: listCents - priceCents, error: null };
}
