import { db } from '../../db';
import { sales, customers, odf, odfItems } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { badRequest, notFound } from '../../lib/errors';
import { renderDeclarationTemplate, htmlToPdfBuffer } from './html';
import { getShopDetails } from '../shopDetails';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Declaration of ownership for one trade-in (ODF). The declarant is the ODF's
 * customer and the number is the ODF serial issued at trade-in. The 10-day
 * holding period starts at `baseDate`.
 */
async function renderOdfDeclaration(odfId: number, baseDate?: Date): Promise<Buffer> {
  const [record] = await db.select({ odf, customer: customers })
    .from(odf)
    .leftJoin(customers, eq(odf.customerId, customers.id))
    .where(eq(odf.id, odfId))
    .limit(1);

  if (!record) throw notFound('ODF not found');
  const { odf: odfRecord, customer } = record;
  if (!customer) throw badRequest('Customer not found for this ODF');

  const items = await db.select().from(odfItems).where(eq(odfItems.odfId, odfId)).orderBy(odfItems.id);
  const tradeInItems = items.length > 0
    ? items.map((item, index) => ({
        index: index + 1,
        description: item.description || '',
        mass: item.mass ? parseFloat(item.mass).toFixed(3) : '0.000',
        fineness: item.fineness || ''
      }))
    : [{
        index: 1,
        description: odfRecord.description || 'Article',
        mass: odfRecord.weight ? parseFloat(odfRecord.weight).toFixed(3) : '0.000',
        fineness: odfRecord.fineness || ''
      }];

  const start = baseDate ?? new Date(odfRecord.date || odfRecord.createdAt);
  const startDateStr = start.toLocaleDateString('en-GB'); // DD/MM/YYYY
  const endDateStr = new Date(start.getTime() + 10 * DAY_MS).toLocaleDateString('en-GB');

  const shop = await getShopDetails();
  const html = renderDeclarationTemplate({
    odf_serial: String(odfRecord.odfSerialNumber ?? odfRecord.id),
    customer_name: customer.name || '',
    customer_address: customer.address || 'N/A',
    trade_in_items: tradeInItems,
    date: startDateStr,
    customer_phone: customer.phoneNumber || 'N/A',
    customer_nic: customer.idNumber || 'N/A',
    start_date: startDateStr,
    end_date: endDateStr,
    shop_legal_name: shop.legalName || shop.name,
    shop_address: shop.address,
  });

  return htmlToPdfBuffer(html);
}

export async function generateOdfDeclarationPDF(odfId: number): Promise<{ buffer: Buffer }> {
  return { buffer: await renderOdfDeclaration(odfId) };
}

/** Declaration for the trade-in linked to a sale, dated from the sale. */
export async function generateDeclarationPDF(saleId: number): Promise<{ buffer: Buffer }> {
  const [sale] = await db.select().from(sales).where(eq(sales.id, saleId)).limit(1);
  if (!sale) throw notFound('Sale not found');
  if (!sale.linkedOdfId) throw badRequest("Cette vente n'a pas de trade-in (ODF) lié : aucune déclaration à imprimer.");
  return { buffer: await renderOdfDeclaration(sale.linkedOdfId, new Date(sale.datetime)) };
}
