import PDFDocument from 'pdfkit';
import { db } from '../../db';
import { customers, settings, orders } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { formatCurrency, formatItemDetails } from '../../lib/utils';

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
    if (customer.idNumber && customer.idNumber.trim() !== "") {
      doc.text(`CIN: ${customer.idNumber}`);
    }
    if (customer.phoneNumber && customer.phoneNumber.trim() !== "") {
      doc.text(`Tél: ${customer.phoneNumber}`);
    }
    if (customer.email && customer.email.trim() !== "") {
      doc.text(`Email: ${customer.email}`);
    }
    if (customer.address && customer.address.trim() !== "") {
      doc.text(`Adresse: ${customer.address}`);
    }
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
