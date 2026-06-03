import PDFDocument from 'pdfkit';
import { db } from '../db';
import { sales, customers, receipts, settings, odf, stock, orders } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { formatCurrency, formatItemDetails } from '../lib/utils';

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
    bufferPages: true,
  });

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
  let description = formatItemDetails(sale.itemDetails) || 'Article Bijouterie';
  if (record.stock) {
    const s = record.stock;
    description = `${formatItemDetails(s.barcode)} - ${formatItemDetails(s.category)} ${formatItemDetails(s.subCategory)} ${s.metalType ? `(${formatItemDetails(s.metalType)})` : ''}`.trim().replace(/\s+/g, ' ');
  }

  if (isJewellery) {
    doc.text(description, 35, itemY, { width: 140 });
    doc.text(sale.weight ? sale.weight.toString() : '-', 180, itemY);
    doc.text(formatCurrency(sale.unitSalesPrice), 240, itemY);
    doc.text(formatCurrency(sale.amount), 320, itemY);
  } else {
    doc.text(description, 35, itemY, { width: 170 });
    doc.text(formatCurrency(sale.unitSalesPrice), 220, itemY);
    doc.text(formatCurrency(sale.amount), 310, itemY);
  }

  doc.moveTo(30, itemY + 25).lineTo(385, itemY + 25).stroke();

  // Summary
  doc.moveDown(2);
  const labelX = 220;
  const valueX = 300;
  const colWidth = 85;

  let currentY = doc.y;

  // Helper to draw summary rows safely
  const drawSummaryRow = (label: string, value: string, isBold = false) => {
    if (isBold) doc.font('Helvetica-Bold');
    doc.text(label, labelX, currentY);
    doc.text(value, valueX, currentY, { width: colWidth, align: 'right' });
    doc.font('Helvetica');
    currentY += 15; // Set explicit line height
  };

  drawSummaryRow('Sous-Total:', formatCurrency(sale.amount));
  drawSummaryRow('TVA (15%):', formatCurrency(sale.vat15));
  
  const total = Number(sale.amount) + Number(sale.vat15);

  if (order && order.deposit) {
    drawSummaryRow('Acompte Déduit:', `-${formatCurrency(order.deposit)}`);
    const balance = total - Number(order.deposit);
    drawSummaryRow('Reste à Payer:', formatCurrency(balance), true);
  } else {
    drawSummaryRow('Grand Total:', formatCurrency(total), true);
  }

  doc.y = currentY; // Update doc.y to prevent overlap with signature section
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

  // Post-processing watermark loop for copies
  if (receipt.printCount > 0) {
    addWatermark(doc, 'COPIE');
  }

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
  doc.text(`Métal: ${formatItemDetails(odfRecord.metalType)}`);
  doc.text(`Finesse: ${formatItemDetails(odfRecord.fineness)}`);
  doc.text(`Poids: ${odfRecord.weight} g`);
  doc.text(`Montant Estimé: ${formatCurrency(odfRecord.amount || 0)}`);
  doc.moveDown();

  if (odfRecord.itemReservedRepair) {
    doc.font('Helvetica-Bold').text('Article Réservé / Réparation:');
    doc.font('Helvetica').text(formatItemDetails(odfRecord.itemReservedRepair));
    doc.moveDown();
  }

  if (odfRecord.description) {
    doc.font('Helvetica-Bold').text('Description:');
    doc.font('Helvetica').text(formatItemDetails(odfRecord.description));
    doc.moveDown();
  }

  if (odfRecord.parameters) {
    doc.font('Helvetica-Bold').text('Paramètres:');
    doc.font('Helvetica').text(formatItemDetails(odfRecord.parameters));
    doc.moveDown();
  }

  if (odfRecord.comments) {
    doc.font('Helvetica-Bold').text('Commentaires:');
    doc.font('Helvetica').text(formatItemDetails(odfRecord.comments));
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
  doc.text(formatItemDetails(order.itemDescription) || 'Article sur commande', 35, itemY, { width: 140 });
  doc.text(order.estimatedWeight ? order.estimatedWeight.toString() : '-', 180, itemY);
  doc.text(formatCurrency(order.estimatedPrice || 0), 280, itemY);

  doc.moveTo(30, itemY + 25).lineTo(385, itemY + 25).stroke();

  // Summary
  doc.moveDown(2);
  const labelX = 220;
  const valueX = 300;
  const colWidth = 85;

  let currentY = doc.y;

  const drawSummaryRow = (label: string, value: string, isBold = false, color = 'black') => {
    doc.fillColor(color);
    if (isBold) doc.font('Helvetica-Bold');
    doc.text(label, labelX, currentY);
    doc.text(value, valueX, currentY, { width: colWidth, align: 'right' });
    doc.font('Helvetica');
    doc.fillColor('black');
    currentY += 15;
  };

  drawSummaryRow('PRIX ESTIMÉ:', formatCurrency(order.estimatedPrice || 0), true);
  drawSummaryRow('ACOMPTE PAYÉ:', formatCurrency(order.deposit || 0), true, 'blue');

  doc.y = currentY;
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
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    
    doc.save();
    doc.opacity(0.12);
    doc.fontSize(75);
    doc.fillColor('#969696');
    
    const x = doc.page.width / 2;
    const y = doc.page.height / 2;
    
    // Rotate 45 degrees around the center
    doc.rotate(-45, { origin: [x, y] });
    
    // Draw text centered at the origin
    doc.text(text, 0, y - 35, {
      align: 'center',
      width: doc.page.width,
      lineBreak: false
    });
    
    doc.restore();
  }
  // Move back to the last page to ensure doc.end() works as expected
  doc.switchToPage(range.start + range.count - 1);
}

export async function generateVatReportPDF(day?: string, month?: string, year?: string): Promise<PDFKit.PDFDocument> {
  const conditions = [];
  if (year) conditions.push(sql`EXTRACT(YEAR FROM ${sales.createdAt}) = ${year}`);
  if (month) conditions.push(sql`EXTRACT(MONTH FROM ${sales.createdAt}) = ${month}`);
  if (day) conditions.push(sql`EXTRACT(DAY FROM ${sales.createdAt}) = ${day}`);

  const reportData = await db.select({
    saleId: sales.id,
    receiptNo: receipts.receiptSerialNumber,
    itemDetails: sales.itemDetails,
    weight: sales.weight,
    amountExclVat: sales.amount,
    metalType: sales.metalType,
    fineness: sales.fineness,
    createdAt: sales.createdAt
  })
  .from(sales)
  .leftJoin(receipts, eq(sales.id, receipts.saleId))
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .orderBy(sales.id);

  const calculatedData = reportData.map(row => {
    const amount = parseFloat(row.amountExclVat || "0");
    const vat = amount * 0.15;
    return {
      ...row,
      vatAmount: vat.toFixed(2),
      total: (amount + vat).toFixed(2)
    };
  });

  const allSettings = await db.select().from(settings);
  const heading = allSettings.find(s => s.key === 'receipt_heading')?.value || 'Haujee Jewellery';

  // Create PDF (A4 size)
  const doc = new PDFDocument({
    size: 'A4',
    margin: 30,
    bufferPages: true,
  });

  // Header Title
  doc.fontSize(18).font('Helvetica-Bold').text(heading, { align: 'center' });
  doc.fontSize(14).text('RAPPORT DÉTAILLÉ DE TVA (15%)', { align: 'center' });
  doc.fontSize(10).font('Helvetica-Oblique').text(`Généré le: ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, { align: 'center' });
  doc.moveDown();

  // Period Details
  doc.fontSize(9).font('Helvetica-Bold').text('PÉRIODE DE FILTRAGE DES RAPPORTS:');
  const periodParts = [];
  if (day) periodParts.push(`Jour: ${day}`);
  if (month) periodParts.push(`Mois: ${month}`);
  if (year) periodParts.push(`Année: ${year}`);
  const periodText = periodParts.length > 0 ? periodParts.join(' / ') : 'Toutes les périodes';
  doc.font('Helvetica').fontSize(9).text(periodText);
  doc.moveDown();

  // Draw table line
  let y = doc.y;
  const bottomThreshold = doc.page.height - 50;

  const drawTableHeader = (startY: number) => {
    doc.rect(30, startY, 535, 20).fill('#f8fafc');
    doc.fillColor('#475569');
    doc.font('Helvetica-Bold').fontSize(8);
    doc.text('Date', 35, startY + 6);
    doc.text('Réf. Facture', 105, startY + 6);
    doc.text('Description', 185, startY + 6);
    doc.text('Taxable (Rs HT)', 350, startY + 6, { width: 65, align: 'right' });
    doc.text('TVA (15%)', 425, startY + 6, { width: 65, align: 'right' });
    doc.text('Total TTC (Rs)', 495, startY + 6, { width: 65, align: 'right' });
    doc.moveTo(30, startY + 20).lineTo(565, startY + 20).strokeColor('#e2e8f0').stroke();
    doc.font('Helvetica').fontSize(8).fillColor('black');
  };

  drawTableHeader(y);
  y += 24;

  for (const row of calculatedData) {
    let cleanDescription = row.itemDetails || 'Article';
    try {
      const parsed = typeof row.itemDetails === 'string' ? JSON.parse(row.itemDetails) : row.itemDetails;
      if (parsed) {
        cleanDescription = [parsed.name, parsed.category, parsed.brand].filter(Boolean).join(' - ');
      }
    } catch (e) {
      // Not JSON string or parsing failed
    }
    const metalParts = [row.metalType, row.fineness].filter(Boolean).join(' ');
    const finalPdfDescription = metalParts ? `${cleanDescription} (${metalParts})` : cleanDescription;

    const textHeight = doc.heightOfString(finalPdfDescription || 'Article', { width: 160 });
    const rowHeight = Math.max(25, textHeight + 10);

    if (y + rowHeight > bottomThreshold) {
      doc.addPage();
      y = 40;
      drawTableHeader(y);
      y += 24;
    }

    const dateStr = row.createdAt ? new Date(row.createdAt).toLocaleDateString('fr-FR') : 'N/A';
    const invoiceNo = row.receiptNo ? `#FS-${row.receiptNo}` : 'N/A';

    doc.font('Helvetica').fillColor('#0f172a').fontSize(8);
    doc.text(dateStr, 35, y + 6);
    doc.text(invoiceNo, 105, y + 6);
    doc.text(finalPdfDescription, 185, y + 6, { width: 160 });

    doc.text(formatCurrency(row.amountExclVat || "0"), 350, y + 6, { width: 65, align: 'right' });
    doc.text(formatCurrency(row.vatAmount || "0"), 425, y + 6, { width: 65, align: 'right' });
    doc.text(formatCurrency(row.total || "0"), 495, y + 6, { width: 65, align: 'right' });

    doc.moveTo(30, y + rowHeight).lineTo(565, y + rowHeight).strokeColor('#f1f5f9').stroke();
    y += rowHeight;
  }

  // Draw Total row
  if (y + 35 > bottomThreshold) {
    doc.addPage();
    y = 40;
  }

  const totalTaxable = calculatedData.reduce((sum, row) => sum + parseFloat(row.amountExclVat || "0"), 0);
  const totalVatCalculated = calculatedData.reduce((sum, row) => sum + parseFloat(row.vatAmount || "0"), 0);
  const grandTotalCalculated = totalTaxable + totalVatCalculated;

  doc.rect(30, y, 535, 25).fill('#f1f5f9');
  doc.fillColor('#0f172a');
  doc.font('Helvetica-Bold').fontSize(8);
  doc.text('TOTAL GÉNÉRAL / GRAND TOTALS', 35, y + 8);
  
  doc.text(formatCurrency(totalTaxable), 350, y + 8, { width: 65, align: 'right' });
  doc.text(formatCurrency(totalVatCalculated), 425, y + 8, { width: 65, align: 'right' });
  doc.text(formatCurrency(grandTotalCalculated), 495, y + 8, { width: 65, align: 'right' });

  return doc;
}
