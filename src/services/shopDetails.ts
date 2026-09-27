import { inArray } from 'drizzle-orm';
import { db } from '../db';
import { settings } from '../db/schema';

/** The shop's legal identity printed on invoices and declarations, edited in Settings. */
export interface ShopDetails {
  name: string;
  legalName: string;
  address: string;
  phone: string;
  brn: string;
  vatNumber: string;
}

export const SHOP_SETTING_DEFAULTS = {
  shop_name: 'Haujee Jewellery',
  shop_legal_name: 'Société Mohammud Haujee & Sons',
  shop_address: '33, Sir Seewoosagur Ramgoolam Street',
  shop_phone: '',
  shop_brn: '',
  shop_vat_number: '',
} as const;

export async function getShopDetails(): Promise<ShopDetails> {
  const rows = await db.select().from(settings).where(inArray(settings.key, Object.keys(SHOP_SETTING_DEFAULTS)));
  const get = (key: keyof typeof SHOP_SETTING_DEFAULTS) =>
    (rows.find((r: any) => r.key === key)?.value ?? SHOP_SETTING_DEFAULTS[key]).trim();
  return {
    name: get('shop_name') || SHOP_SETTING_DEFAULTS.shop_name,
    legalName: get('shop_legal_name'),
    address: get('shop_address'),
    phone: get('shop_phone'),
    brn: get('shop_brn'),
    vatNumber: get('shop_vat_number'),
  };
}
