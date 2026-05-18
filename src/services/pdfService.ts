import PDFDocument from 'pdfkit';
import { db } from '../db';
import { sales, customers, receipts, settings, odf, stock, orders } from '../db/schema';
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

  // Fetch associated order if any
  const orderRecords = sale.orderId 
    ? await db.select().from(orders).where(eq(orders.id, sale.orderId)).limit(1)
    : [];
  const order = orderRecords[0];

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
    addWatermark(doc, 'COPIE');
  }

  // Header
  doc.fontSize(14).text(heading, { align: 'center', underline: true });
  doc.moveDown();

  doc.fontSize(10);
  doc.text(`Reçu N°: ${receipt.receiptSerialNumber}`, { align: 'right' });
  doc.text(`Date: ${new Date(sale.datetime).toLocaleDateString('fr-FR')}`, { align: 'right' });
  if (order) {
    doc.fillColor('blue');
    doc.text(`Basé sur Commande N°: ${order.orderNumber}`, { align: 'right' });
    doc.fillColor('black');
  }
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
  const isJewellery = record.stock?.category === 'Jewellery';
  
  doc.font('Helvetica-Bold');
  doc.text('Description', 35, tableTop);
  if (isJewellery) {
    doc.text('Poids (g)', 180, tableTop);
    doc.text('Prix Unit.', 240, tableTop);
    doc.text('Total (Rs)', 320, tableTop);
  } else {
    doc.text('Prix Unit.', 220, tableTop);
    doc.text('Total (Rs)', 310, tableTop);
  }
  
  doc.moveTo(30, tableTop + 15).lineTo(385, tableTop + 15).stroke();
  doc.font('Helvetica');

  // Items Table Row
  const itemY = tableTop + 20;
  
  // Construct a better description: Barcode - Category SubCategory (MetalType)
  let description = sale.itemDetails || 'Article Bijouterie';
  if (record.stock) {
    const s = record.stock;
    description = `${s.barcode || ''} - ${s.category || ''} ${s.subCategory || ''} ${s.metalType ? `(${s.metalType})` : ''}`.trim().replace(/\s+/g, ' ');
  }

  if (isJewellery) {
    doc.text(description, 35, itemY, { width: 140 });
    doc.text(sale.weight ? sale.weight.toString() : '-', 180, itemY);
    doc.text(formatCurrency(sale.unitSalesPrice), 240, itemY);
    doc.text(formatCurrency(sale.amount), 320, itemY);
    
    if (sale.goldRate) {
      doc.fontSize(8).font('Helvetica-Oblique').text(`Cours de l'Or: ${formatCurrency(sale.goldRate)}/g`, 35, itemY + 12);
      doc.font('Helvetica').fontSize(10);
    }
  } else {
    doc.text(description, 35, itemY, { width: 170 });
    doc.text(formatCurrency(sale.unitSalesPrice), 220, itemY);
    doc.text(formatCurrency(sale.amount), 310, itemY);
  }

  doc.moveTo(30, itemY + 25).lineTo(385, itemY + 25).stroke();

  // Summary
  doc.moveDown(2);
  const summaryX = 240;
  doc.text('Sous-Total:', summaryX);
  doc.text(formatCurrency(sale.amount), 320, doc.y - 12);
  
  doc.text('TVA (15%):', summaryX);
  doc.text(formatCurrency(sale.vat15), 320, doc.y - 12);
  
  const total = Number(sale.amount) + Number(sale.vat15);

  if (order && order.deposit) {
    doc.text('ACOMPTE DÉDUIT:', summaryX);
    doc.text(`- ${formatCurrency(order.deposit)}`, 320, doc.y - 12);
    
    doc.font('Helvetica-Bold');
    doc.text('RESTE À PAYER:', summaryX);
    const balance = total - Number(order.deposit);
    doc.text(formatCurrency(balance), 320, doc.y - 12);
  } else {
    doc.font('Helvetica-Bold');
    doc.text('GRAND TOTAL:', summaryX);
    doc.text(formatCurrency(total), 320, doc.y - 12);
  }
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
  doc.text(`Montant Estimé: ${formatCurrency(odfRecord.amount || 0)}`);
  doc.moveDown();

  if (odfRecord.itemReservedRepair) {
    doc.font('Helvetica-Bold').text('Article Réservé / Réparation:');
    doc.font('Helvetica').text(odfRecord.itemReservedRepair);
    doc.moveDown();
  }

  if (odfRecord.description) {
    doc.font('Helvetica-Bold').text('Description:');
    doc.font('Helvetica').text(odfRecord.description);
    doc.moveDown();
  }

  if (odfRecord.parameters) {
    doc.font('Helvetica-Bold').text('Paramètres:');
    doc.font('Helvetica').text(odfRecord.parameters);
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

export async function generateBookingReceiptPDF(orderId: number): Promise<{ doc: PDFKit.PDFDocument, order: any }> {
  // 1. Fetch data
  const orderRecords = await db.select({
    order: orders,
    customer: customers
  })
  .from(orders)
  .leftJoin(customers, eq(orders.customerId, customers.id))
  .where(eq(orders.id, orderId))
  .limit(1);

  if (orderRecords.length === 0) throw new Error('Order not found');
  const record = orderRecords[0];
  const order = record.order;
  const customer = record.customer;

  const allSettings = await db.select().from(settings);
  const heading = allSettings.find(s => s.key === 'receipt_heading')?.value || 'Haujee Jewellery';
  const policy = allSettings.find(s => s.key === 'receipt_policy_wording')?.value || '';

  // 2. Create PDF
  const doc = new PDFDocument({
    size: 'A5',
    margin: 30,
  });

  // Header
  doc.fontSize(14).text(heading, { align: 'center', underline: true });
  doc.moveDown();

  doc.fontSize(12).font('Helvetica-Bold').text('REÇU D\'ACOMPTE / COMMANDE', { align: 'center' });
  doc.moveDown();

  doc.fontSize(10).font('Helvetica');
  doc.text(`Commande N°: ${order.orderNumber}`, { align: 'right' });
  doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString('fr-FR')}`, { align: 'right' });
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
  doc.text('Poids Est. (g)', 180, tableTop);
  doc.text('Prix Est. (Rs)', 280, tableTop);
  
  doc.moveTo(30, tableTop + 15).lineTo(385, tableTop + 15).stroke();
  doc.font('Helvetica');

  // Items Table Row
  const itemY = tableTop + 20;
  doc.text(order.itemDescription || 'Article sur commande', 35, itemY, { width: 140 });
  doc.text(order.estimatedWeight ? order.estimatedWeight.toString() : '-', 180, itemY);
  doc.text(formatCurrency(order.estimatedPrice || 0), 280, itemY);

  doc.moveTo(30, itemY + 25).lineTo(385, itemY + 25).stroke();

  // Summary
  doc.moveDown(2);
  const summaryX = 220;
  doc.font('Helvetica-Bold');
  doc.text('PRIX ESTIMÉ:', summaryX);
  doc.text(formatCurrency(order.estimatedPrice || 0), 320, doc.y - 12);
  
  doc.fillColor('blue');
  doc.text('ACOMPTE PAYÉ:', summaryX);
  doc.text(formatCurrency(order.deposit || 0), 320, doc.y - 12);
  doc.fillColor('black');

  doc.moveDown(1);
  doc.fontSize(8).font('Helvetica-Oblique').text('* Note: Le poids et le prix final seront ajustés lors de la livraison.');
  doc.font('Helvetica');

  // Signature
  doc.moveDown(3);
  doc.fontSize(10).text('Signature du Client: _______________________', { align: 'left' });

  // Policy Page
  doc.addPage();
  doc.fontSize(12).font('Helvetica-Bold').text('Conditions et Politiques', { align: 'center', underline: true });
  doc.moveDown();
  doc.fontSize(10).font('Helvetica').text(policy, { align: 'left' });

  return { doc, order };
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

function addWatermark(doc: PDFKit.PDFDocument, text: string) {
  doc.save();
  doc.opacity(0.1);
  doc.fontSize(80);
  doc.fillColor('gray');
  
  // Use absolute positioning and rotation that doesn't move the cursor
  const x = doc.page.width / 2;
  const y = doc.page.height / 2;
  
  doc.rotate(-45, { origin: [x, y] });
  
  // Draw text at a fixed position relative to the center
  doc.text(text, 0, y - 40, {
    align: 'center',
    width: doc.page.width,
    lineBreak: false
  });
  
  doc.restore();
}
