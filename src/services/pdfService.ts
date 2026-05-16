import PDFDocument from 'pdfkit';
import { db } from '../db';
import { sales, customers, receipts, settings, odf, stock } from '../db/schema';
import { eq } from 'drizzle-orm';
import { formatCurrency } from '../lib/utils';

export interface ReceiptData {
  saleId: number;
}

export async function generateReceiptPDF(saleId: number): Promise<{ doc: PDFKit.PDFDocument, receipt: any }> {
  // 1. Fetch data
  const saleRecords = await db.select({
    sale: sales,
    stock: stock
  })
  .from(sales)
  .leftJoin(stock, eq(sales.stockId, stock.id))
  .where(eq(sales.id, saleId))
  .limit(1);

  if (saleRecords.length === 0) throw new Error('Sale not found');
  const record = saleRecords[0];
  const sale = record.sale;

  const customerRecords = sale.customerId 
    ? await db.select().from(customers).where(eq(customers.id, sale.customerId)).limit(1)
    : [];
  const customer = customerRecords[0];

  // Check if receipt exists, if not create one
  let receiptRecords = await db.select().from(receipts).where(eq(receipts.saleId, saleId)).limit(1);
  if (receiptRecords.length === 0) {
    receiptRecords = await db.insert(receipts).values({ saleId }).returning();
  }
  const receipt = receiptRecords[0];

  const allSettings = await db.select().from(settings);
  const heading = allSettings.find(s => s.key === 'receipt_heading')?.value || 'Haujee Jewellery';
  const policy = allSettings.find(s => s.key === 'receipt_policy_wording')?.value || '';

  // 2. Create PDF
  const doc = new PDFDocument({
    size: 'A5',
    margin: 30,
  });

  // Watermark for copies
  if (receipt.printCount > 0) {
    doc.save()
       .opacity(0.1)
       .fontSize(80)
       .fillColor('red')
       .rotate(-45, { origin: [doc.page.width / 2, doc.page.height / 2] })
       .text('COPIE', doc.page.width / 2 - 120, doc.page.height / 2 - 40)
       .restore()
       .fillColor('black') // Reset color
       .opacity(1); // Reset opacity
  }

  // Header
  doc.fontSize(14).text(heading, { align: 'center', underline: true });
  doc.moveDown();

  doc.fontSize(10);
  doc.text(`Reçu N°: ${receipt.receiptSerialNumber}`, { align: 'right' });
  doc.text(`Date: ${new Date(sale.datetime).toLocaleDateString('fr-FR')}`, { align: 'right' });
  doc.moveDown();

  // Customer Info
  if (customer) {
    doc.fontSize(10).font('Helvetica-Bold').text('Client:');
    doc.font('Helvetica').text(`Nom: ${customer.name}`);
    if (customer.idNumber) doc.text(`CIN: ${customer.idNumber}`);
    if (customer.address) doc.text(`Adresse: ${customer.address}`);
    doc.moveDown();
  }

  // Items Table Header
  const tableTop = doc.y;
  doc.font('Helvetica-Bold');
  doc.text('Description', 35, tableTop);
  doc.text('Poids (g)', 180, tableTop);
  doc.text('Prix Unit.', 240, tableTop);
  doc.text('Total (Rs)', 320, tableTop);
  doc.moveTo(30, tableTop + 15).lineTo(385, tableTop + 15).stroke();
  doc.font('Helvetica');

  // Items Table Row
  const itemY = tableTop + 20;
  
  // Construct a better description: Barcode - Category SubCategory
  let description = sale.itemDetails || 'Article Bijouterie';
  if (record.stock) {
    const s = record.stock;
    description = `${s.barcode} - ${s.category} ${s.subCategory || ''}`.trim();
  }

  doc.text(description, 35, itemY, { width: 140 });
  doc.text(sale.weight ? sale.weight.toString() : '-', 180, itemY);
  doc.text(formatCurrency(sale.unitSalesPrice), 240, itemY);
  doc.text(formatCurrency(sale.amount), 320, itemY);

  doc.moveTo(30, itemY + 25).lineTo(385, itemY + 25).stroke();

  // Summary
  doc.moveDown(2);
  const summaryX = 240;
  doc.text('Sous-Total:', summaryX);
  doc.text(formatCurrency(sale.amount), 320, doc.y - 12);
  
  doc.text('TVA (15%):', summaryX);
  doc.text(formatCurrency(sale.vat15), 320, doc.y - 12);
  
  doc.font('Helvetica-Bold');
  doc.text('GRAND TOTAL:', summaryX);
  const total = Number(sale.amount) + Number(sale.vat15);
  doc.text(formatCurrency(total), 320, doc.y - 12);
  doc.font('Helvetica');

  doc.moveDown(2);
  doc.text(`Mode de Paiement: ${sale.paymentMode}`);
  if (sale.chequeNumber) doc.text(`Chèque N°: ${sale.chequeNumber}`);

  // Signature
  doc.moveDown(3);
  doc.text('Signature du Client: _______________________', { align: 'left' });

  // Second Page for Policy
  doc.addPage();
  doc.fontSize(12).text('Conditions et Politiques', { align: 'center', underline: true });
  doc.moveDown();
  doc.fontSize(10).text(policy, { align: 'left' });

  // 3. Increment print count
  await db.update(receipts)
    .set({ printCount: receipt.printCount + 1 })
    .where(eq(receipts.id, receipt.id));

  return { doc, receipt };
}

export async function generateODFPDF(odfId: number): Promise<{ doc: PDFKit.PDFDocument, odfRecord: any }> {
  // 1. Fetch data
  const odfRecords = await db.select().from(odf).where(eq(odf.id, odfId)).limit(1);
  if (odfRecords.length === 0) throw new Error('ODF record not found');
  const odfRecord = odfRecords[0];

  const customerRecords = odfRecord.customerId 
    ? await db.select().from(customers).where(eq(customers.id, odfRecord.customerId)).limit(1)
    : [];
  const customer = customerRecords[0];

  const allSettings = await db.select().from(settings);
  const heading = allSettings.find(s => s.key === 'receipt_heading')?.value || 'Haujee Jewellery';

  // 2. Create PDF
  const doc = new PDFDocument({
    size: 'A5',
    margin: 30,
  });

  // Header
  doc.fontSize(14).text(heading, { align: 'center', underline: true });
  doc.moveDown();

  doc.fontSize(12).font('Helvetica-Bold').text('FORMULAIRE DE RACHAT (ODF)', { align: 'center' });
  doc.moveDown();

  doc.fontSize(10).font('Helvetica');
  doc.text(`ODF N°: ${odfRecord.odfSerialNumber}`, { align: 'right' });
  doc.text(`Date: ${new Date(odfRecord.date).toLocaleDateString('fr-FR')}`, { align: 'right' });
  doc.moveDown();

  // Customer Info
  if (customer) {
    doc.fontSize(10).font('Helvetica-Bold').text('Informations du Client:');
    doc.font('Helvetica').text(`Nom: ${customer.name}`);
    if (customer.idNumber) doc.text(`CIN: ${customer.idNumber}`);
    if (customer.address) doc.text(`Adresse: ${customer.address}`);
    doc.moveDown();
  }

  // ODF Details
  doc.font('Helvetica-Bold').text('Détails du Rachat:');
  doc.font('Helvetica');
  doc.text(`Métal: ${odfRecord.metalType}`);
  doc.text(`Finesse: ${odfRecord.fineness}`);
  doc.text(`Poids: ${odfRecord.weight} g`);
  doc.text(`Montant Estimé: ${formatCurrency(odfRecord.amount || 0)} Rs`);
  doc.moveDown();

  if (odfRecord.itemReservedRepair) {
    doc.font('Helvetica-Bold').text('Article Réservé / Réparation:');
    doc.font('Helvetica').text(odfRecord.itemReservedRepair);
    doc.moveDown();
  }

  if (odfRecord.comments) {
    doc.font('Helvetica-Bold').text('Commentaires:');
    doc.font('Helvetica').text(odfRecord.comments);
    doc.moveDown();
  }

  // Signature Sections
  doc.moveDown(3);
  const startY = doc.y;
  doc.text('Signature du Client:', 30, startY);
  doc.text('_______________________', 30, startY + 15);

  doc.text('Signature du Gérant:', 240, startY);
  doc.text('_______________________', 240, startY + 15);

  return { doc, odfRecord };
}

export async function getPDFBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));
    doc.end();
  });
}
