/**
 * Money arithmetic in whole cents, shared by the API and the till so both
 * compute identical totals. Prices are VAT-inclusive (TTC); VAT is 15%.
 *
 * Per line: net = round(gross / 1.15), vat = gross - net. Totals are sums of
 * lines, so net + vat always equals the gross the customer pays.
 */

export const VAT_RATE = 0.15;

/** Rupees (number or numeric string) to integer cents. Non-numeric input gives NaN. */
export function toCents(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Math.round(n * 100);
}

/** Integer cents to a 2-decimal string, the format of the database's numeric columns. */
export const centsToDecimal = (cents: number): string => (cents / 100).toFixed(2);

export interface LineAmounts {
  grossCents: number;
  netCents: number;
  vatCents: number;
}

/** Splits a VAT-inclusive amount into its net and VAT parts. */
export function splitGross(grossCents: number): LineAmounts {
  const netCents = Math.round(grossCents / (1 + VAT_RATE));
  return { grossCents, netCents, vatCents: grossCents - netCents };
}

export function sumLines(lines: LineAmounts[]): LineAmounts {
  return lines.reduce(
    (t, l) => ({ grossCents: t.grossCents + l.grossCents, netCents: t.netCents + l.netCents, vatCents: t.vatCents + l.vatCents }),
    { grossCents: 0, netCents: 0, vatCents: 0 },
  );
}
