import { sql, type SQL } from 'drizzle-orm';

/**
 * The shop's time zone. The server runs in it (TZ is set at startup), so
 * dates printed on receipts and reports are local; SQL date logic uses it
 * explicitly because the database session may be in UTC.
 */
export const SHOP_TIME_ZONE = process.env.SHOP_TIME_ZONE || 'Indian/Mauritius';

/** Validated for use inside SQL literals (it comes from configuration, not users). */
if (!/^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/.test(SHOP_TIME_ZONE)) {
  throw new Error(`Invalid SHOP_TIME_ZONE: ${SHOP_TIME_ZONE}`);
}

/** A timestamp column (or expression) converted to shop-local time, for DATE() / EXTRACT(). */
export const inShopTime = (column: unknown): SQL => sql`(${column} AT TIME ZONE ${sql.raw(`'${SHOP_TIME_ZONE}'`)})`;

/** True when the timestamp falls on today's date in shop time. */
export const isShopToday = (column: unknown): SQL => sql`DATE(${inShopTime(column)}) = DATE(${inShopTime(sql`NOW()`)})`;
