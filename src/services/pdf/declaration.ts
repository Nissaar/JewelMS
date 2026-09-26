import { db } from '../../db';
import { sales, customers, receipts, odf, odfItems } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { renderDeclarationTemplate, htmlToPdfBuffer } from './html';

export async function generateDeclarationPDF(saleId: number): Promise<{ buffer: Buffer; doc?: any }> {
  // 1. Fetch Sale
  const saleRecords = await db.select({
    sale: sales,
    customer: customers
  })
  .from(sales)
  .leftJoin(customers, eq(sales.customerId, customers.id))
  .where(eq(sales.id, saleId))
  .limit(1);

  if (saleRecords.length === 0) throw new Error('Sale not found');
  const record = saleRecords[0];
  const sale = record.sale;
  const customer = record.customer;

  if (!customer) throw new Error('Customer not found for this sale');

  // 2. Fetch Receipt
  let receiptArr = await db.select().from(receipts).where(eq(receipts.saleId, saleId)).limit(1);
  if (receiptArr.length === 0) {
    receiptArr = await db.insert(receipts).values({ saleId }).returning();
  }
  const receipt = receiptArr[0];

  // 3. Fetch ODF (Trade-In) record for this customer
  const customerOdfs = await db.select().from(odf).where(eq(odf.customerId, customer.id));
  const sortedOdfs = customerOdfs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const odfRecord = sortedOdfs[0];

  // 4. Fetch trade-in items if ODF exists
  let items: any[] = [];
  if (odfRecord) {
    items = await db.select().from(odfItems).where(eq(odfItems.odfId, odfRecord.id));
  }

  // Format Dates
  const saleDateObj = new Date(sale.datetime);
  const startDateStr = saleDateObj.toLocaleDateString('en-GB'); // DD/MM/YYYY
  const endDateObj = new Date(saleDateObj.getTime() + 10 * 24 * 60 * 60 * 1000);
  const endDateStr = endDateObj.toLocaleDateString('en-GB');

  const serialNo = receipt.receiptSerialNumber ? String(receipt.receiptSerialNumber) : (odfRecord?.odfSerialNumber || String(saleId));

  let tradeInItems: Array<{ index: number; description: string; mass: string; fineness: string }> = [];
  if (items && items.length > 0) {
    tradeInItems = items.map((item, index) => ({
      index: index + 1,
      description: item.description || '',
      mass: item.mass ? parseFloat(item.mass).toFixed(3) : '0.000',
      fineness: item.fineness || ''
    }));
  } else if (odfRecord) {
    tradeInItems = [{
      index: 1,
      description: odfRecord.description || 'Article',
      mass: odfRecord.weight ? parseFloat(odfRecord.weight).toFixed(3) : '0.000',
      fineness: odfRecord.fineness || ''
    }];
  } else {
    tradeInItems = [{
      index: 1,
      description: 'Article',
      mass: '0.000',
      fineness: ''
    }];
  }

  const html = renderDeclarationTemplate({
    odf_serial: serialNo,
    customer_name: customer.name || '',
    customer_address: customer.address || 'N/A',
    trade_in_items: tradeInItems,
    date: startDateStr,
    customer_phone: customer.phoneNumber || 'N/A',
    customer_nic: customer.idNumber || 'N/A',
    start_date: startDateStr,
    end_date: endDateStr
  });

  const buffer = await htmlToPdfBuffer(html);
  return { buffer };
}

export async function generateOdfDeclarationPDF(odfId: number): Promise<{ buffer: Buffer; doc?: any }> {
  // 1. Fetch ODF
  const odfRecords = await db.select({
    odf: odf,
    customer: customers
  })
  .from(odf)
  .leftJoin(customers, eq(odf.customerId, customers.id))
  .where(eq(odf.id, odfId))
  .limit(1);

  if (odfRecords.length === 0) throw new Error('ODF not found');
  const record = odfRecords[0];
  const odfRecord = record.odf;
  const customer = record.customer;

  if (!customer) throw new Error('Customer not found for this ODF');

  // 2. Fetch ODF Items
  const items = await db.select().from(odfItems).where(eq(odfItems.odfId, odfId));

  // Format Dates
  const odfDateObj = new Date(odfRecord.date || odfRecord.createdAt);
  const startDateStr = odfDateObj.toLocaleDateString('en-GB'); // DD/MM/YYYY
  const endDateObj = new Date(odfDateObj.getTime() + 10 * 24 * 60 * 60 * 1000);
  const endDateStr = endDateObj.toLocaleDateString('en-GB');

  const serialNo = odfRecord.odfSerialNumber ? String(odfRecord.odfSerialNumber) : String(odfRecord.id);

  let tradeInItems: Array<{ index: number; description: string; mass: string; fineness: string }> = [];
  if (items && items.length > 0) {
    tradeInItems = items.map((item, index) => ({
      index: index + 1,
      description: item.description || '',
      mass: item.mass ? parseFloat(item.mass).toFixed(3) : '0.000',
      fineness: item.fineness || ''
    }));
  } else {
    tradeInItems = [{
      index: 1,
      description: odfRecord.description || 'Article',
      mass: odfRecord.weight ? parseFloat(odfRecord.weight).toFixed(3) : '0.000',
      fineness: odfRecord.fineness || ''
    }];
  }

  const html = renderDeclarationTemplate({
    odf_serial: serialNo,
    customer_name: customer.name || '',
    customer_address: customer.address || 'N/A',
    trade_in_items: tradeInItems,
    date: startDateStr,
    customer_phone: customer.phoneNumber || 'N/A',
    customer_nic: customer.idNumber || 'N/A',
    start_date: startDateStr,
    end_date: endDateStr
  });

  const buffer = await htmlToPdfBuffer(html);
  return { buffer };
}
