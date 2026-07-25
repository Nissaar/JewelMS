import PDFDocument from 'pdfkit';
import { db } from '../db';
import { sales, customers, receipts, settings, odf, odfItems, stock, orders } from '../db/schema';
import { eq, and, sql, or, ilike } from 'drizzle-orm';
import { formatCurrency, formatItemDetails } from '../lib/utils';

export interface ReceiptData {
  saleId: number;
}

export function numberToWords(num: number): string {
  if (num <= 0) return 'Zero';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const g = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

  function translate(n: number): string {
    let str = '';
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
      if (n > 0) str += 'and ';
    }
    if (n >= 20) {
      str += b[Math.floor(n / 10)] + (n % 10 > 0 ? '-' + a[n % 10] : '') + ' ';
    } else if (n > 0) {
      str += a[n] + ' ';
    }
    return str;
  }

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let word = '';
  let temp = integerPart;
  let groupIndex = 0;

  while (temp > 0) {
    const chunk = temp % 1000;
    if (chunk > 0) {
      const chunkStr = translate(chunk);
      word = chunkStr + (g[groupIndex] ? g[groupIndex] + ' ' : '') + word;
    }
    temp = Math.floor(temp / 1000);
    groupIndex++;
  }

  let finalStr = word.trim();
  if (decimalPart > 0) {
    finalStr += ' and ' + translate(decimalPart).trim() + ' Cents';
  }

  return finalStr;
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

  // Fetch linked ODF if any
  const linkedOdfRecords = sale.linkedOdfId
    ? await db.select().from(odf).where(eq(odf.id, sale.linkedOdfId)).limit(1)
    : [];
  const linkedOdf = linkedOdfRecords[0];

  // Fetch linked Commande if any
  const linkedCommandeRecords = sale.linkedCommandeId
    ? await db.select().from(orders).where(eq(orders.id, sale.linkedCommandeId)).limit(1)
    : [];
  const linkedCommande = linkedCommandeRecords[0];

  // Check if receipt exists, if not create one
  let receiptRecords = await db.select().from(receipts).where(eq(receipts.saleId, saleId)).limit(1);
  if (receiptRecords.length === 0) {
    receiptRecords = await db.insert(receipts).values({ saleId }).returning();
  }
  const receipt = receiptRecords[0];

  // 2. Create PDF with standard A4 page size
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    bufferPages: true,
  });

  // Header Block
  doc.fillColor('#5c3a21');
  doc.fontSize(24).font('Helvetica-Bold').text('HAUJEE JEWELLERY', { align: 'center', characterSpacing: 2 });
  doc.fillColor('#000000');
  doc.fontSize(14).font('Helvetica-Bold').text('TAX INVOICE', { align: 'center' });
  doc.fontSize(10).font('Helvetica').text('VAT / BRN : C10012345', { align: 'center' });
  doc.moveDown(0.5);
  doc.strokeColor('#5c3a21').lineWidth(2).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(1);

  let currentY = doc.y + 10;

  // Top Info Box (Customer Details + Invoice Details)
  const boxTop = currentY;
  const boxHeight = 85;
  doc.rect(40, boxTop, 515, boxHeight).strokeColor('#000000').lineWidth(1).stroke();

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
  let textY = boxTop + 10;

  const drawLabelValue = (label: string, value: string, xL: number, xV: number, y: number) => {
    doc.font('Helvetica-Bold').text(label, xL, y);
    doc.font('Helvetica').text(value, xV, y);
  };

  const customerName = customer?.name || 'Walk-in Customer';
  const customerPhone = customer?.phoneNumber || 'N/A';
  const customerNic = customer?.idNumber || 'N/A';
  const customerEmail = customer?.email || 'N/A';

  drawLabelValue('Customer Name :', customerName, 50, 150, textY);
  drawLabelValue('Mobile Number :', customerPhone, 50, 150, textY + 16);
  drawLabelValue('ID No./NIC :', customerNic, 50, 150, textY + 32);
  drawLabelValue('Email :', customerEmail, 50, 150, textY + 48);

  const receiptSerial = receipt.receiptSerialNumber ? String(receipt.receiptSerialNumber) : 'N/A';
  const saleDateObj = new Date(sale.datetime);
  const dateStr = saleDateObj.toLocaleDateString('en-GB');
  const timeStr = saleDateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const salesmanName = 'Authorised Salesman';
  
  let linkedRef = 'N/A';
  if (linkedOdf) {
    linkedRef = `ODF #${linkedOdf.odfSerialNumber}`;
  } else if (order) {
    linkedRef = `CMD #${order.orderNumber}`;
  } else if (linkedCommande) {
    linkedRef = `CMD #${linkedCommande.orderNumber}`;
  }

  drawLabelValue('Invoice No :', receiptSerial, 310, 410, textY);
  drawLabelValue('Date & Time :', `${dateStr} ${timeStr}`, 310, 410, textY + 16);
  drawLabelValue('Salesman :', salesmanName, 310, 410, textY + 32);
  drawLabelValue('Ref ODF/Order :', linkedRef, 310, 410, textY + 48);

  currentY = boxTop + boxHeight + 20;

  // Columns Width Alignment Setup (Total sum = 515)
  const columns = [
    { label: 'No.', x: 40, w: 25, align: 'center' as const },
    { label: 'Stock Code', x: 65, w: 65, align: 'center' as const },
    { label: 'Description', x: 130, w: 155, align: 'left' as const },
    { label: 'Pcs', x: 285, w: 25, align: 'center' as const },
    { label: 'Qty (g)', x: 310, w: 45, align: 'right' as const },
    { label: 'Net Amount', x: 355, w: 60, align: 'right' as const },
    { label: 'VAT %', x: 415, w: 35, align: 'center' as const },
    { label: 'Tax Amount', x: 450, w: 50, align: 'right' as const },
    { label: 'Gross Amount', x: 500, w: 55, align: 'right' as const }
  ];

  const tableHeaderY = currentY;
  const headerHeight = 25;

  // Draw header background
  doc.rect(40, tableHeaderY, 515, headerHeight).fill('#eaeaea');
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8);

  columns.forEach(col => {
    doc.text(col.label, col.x, tableHeaderY + 8, { width: col.w, align: col.align });
  });

  // Draw border lines for header cells
  doc.rect(40, tableHeaderY, 515, headerHeight).strokeColor('#000000').lineWidth(1).stroke();
  columns.forEach((col, idx) => {
    if (idx > 0) {
      doc.moveTo(col.x, tableHeaderY).lineTo(col.x, tableHeaderY + headerHeight).stroke();
    }
  });

  // Row Data Construction
  const itemNo = '1';
  const itemStockCode = record.stock?.itemCode || record.stock?.barcode || 'N/A';
  
  let itemDescription = formatItemDetails(sale.itemDetails) || 'Article Bijouterie';
  if (record.stock) {
    const s = record.stock;
    itemDescription = `${s.category} ${s.subCategory || ''} ${s.metalType ? `(${s.metalType})` : ''}`.trim().replace(/\s+/g, ' ');
    if (s.fineness) {
      itemDescription += ` - ${s.fineness}`;
    }
  }

  const itemPcs = String(sale.qty || 1);
  const itemQty = sale.weight ? parseFloat(String(sale.weight)).toFixed(3) : '-';
  const itemNetAmount = Number(sale.amount || 0);
  const itemVatPct = '15.00';
  const itemTaxAmount = Number(sale.vat15 || 0);
  const itemGrossAmount = itemNetAmount + itemTaxAmount;

  doc.fontSize(8);
  const descHeight = doc.heightOfString(itemDescription, { width: 155 });
  const rowHeight = Math.max(30, descHeight + 10);
  const rowY = tableHeaderY + headerHeight;

  // Draw cells
  doc.font('Helvetica').fontSize(8).fillColor('#000000');
  
  doc.text(itemNo, columns[0].x, rowY + (rowHeight - 8) / 2, { width: columns[0].w, align: 'center' });
  doc.text(itemStockCode, columns[1].x, rowY + (rowHeight - 8) / 2, { width: columns[1].w, align: 'center' });
  doc.text(itemDescription, columns[2].x, rowY + 5, { width: columns[2].w, align: 'left' });
  doc.text(itemPcs, columns[3].x, rowY + (rowHeight - 8) / 2, { width: columns[3].w, align: 'center' });
  doc.text(itemQty, columns[4].x, rowY + (rowHeight - 8) / 2, { width: columns[4].w, align: 'right' });
  doc.text(formatCurrency(itemNetAmount), columns[5].x, rowY + (rowHeight - 8) / 2, { width: columns[5].w, align: 'right' });
  doc.text(itemVatPct, columns[6].x, rowY + (rowHeight - 8) / 2, { width: columns[6].w, align: 'center' });
  doc.text(formatCurrency(itemTaxAmount), columns[7].x, rowY + (rowHeight - 8) / 2, { width: columns[7].w, align: 'right' });
  doc.text(formatCurrency(itemGrossAmount), columns[8].x, rowY + (rowHeight - 8) / 2, { width: columns[8].w, align: 'right' });

  // Draw borders
  doc.rect(40, rowY, 515, rowHeight).strokeColor('#000000').lineWidth(1).stroke();
  columns.forEach((col, idx) => {
    if (idx > 0) {
      doc.moveTo(col.x, rowY).lineTo(col.x, rowY + rowHeight).stroke();
    }
  });

  currentY = rowY + rowHeight;

  // Row 1: Sub-totals align row
  let totalRowY = currentY;
  const totalRowHeight = 20;

  doc.rect(40, totalRowY, 515, totalRowHeight).strokeColor('#000000').lineWidth(1).stroke();
  doc.font('Helvetica-Bold').fontSize(8);

  doc.text(`Total (${itemPcs} Items)`, 45, totalRowY + 6, { width: columns[5].x - 45, align: 'right' });
  doc.text(formatCurrency(itemNetAmount), columns[5].x, totalRowY + 6, { width: columns[5].w, align: 'right' });
  doc.text(formatCurrency(itemTaxAmount), columns[7].x, totalRowY + 6, { width: columns[7].w, align: 'right' });
  doc.text(formatCurrency(itemGrossAmount), columns[8].x, totalRowY + 6, { width: columns[8].w, align: 'right' });

  doc.moveTo(columns[5].x, totalRowY).lineTo(columns[5].x, totalRowY + totalRowHeight).stroke();
  doc.moveTo(columns[6].x, totalRowY).lineTo(columns[6].x, totalRowY + totalRowHeight).stroke();
  doc.moveTo(columns[7].x, totalRowY).lineTo(columns[7].x, totalRowY + totalRowHeight).stroke();
  doc.moveTo(columns[8].x, totalRowY).lineTo(columns[8].x, totalRowY + totalRowHeight).stroke();

  currentY = totalRowY + totalRowHeight;

  // Summary and calculations with integrated Scrap Exchange
  const scrapExchangeValue = linkedOdf ? Number(linkedOdf.amount || 0) : 0;
  const depositValue = Number(order?.deposit || 0) + Number(linkedCommande?.deposit || 0);
  
  const finalNetAmount = Math.max(0, itemGrossAmount - scrapExchangeValue - depositValue);
  const totalBeforeVat = finalNetAmount / 1.15;
  const totalVatFinal = finalNetAmount - totalBeforeVat;

  const drawFinalTotalsRow = (label: string, value: string, isBig = false, valueColor = '#000000') => {
    const rowHeight = isBig ? 24 : 18;
    doc.rect(40, currentY, 515, rowHeight).strokeColor('#000000').lineWidth(1).stroke();
    doc.rect(40, currentY, 460, rowHeight).fill('#f9f9f9');
    
    doc.fillColor('#000000');
    doc.font('Helvetica-Bold').fontSize(isBig ? 10 : 8);
    doc.text(label, 45, currentY + (rowHeight - (isBig ? 10 : 8)) / 2, { width: 450, align: 'right' });
    
    doc.fillColor(valueColor);
    doc.text(value, columns[8].x, currentY + (rowHeight - (isBig ? 10 : 8)) / 2, { width: columns[8].w, align: 'right' });
    
    doc.moveTo(columns[8].x, currentY).lineTo(columns[8].x, currentY + rowHeight).strokeColor('#000000').stroke();
    currentY += rowHeight;
  };

  if (scrapExchangeValue > 0) {
    drawFinalTotalsRow('Scrap Exchange / Trade-in', `-${formatCurrency(scrapExchangeValue)}`, false, '#ff0000');
  }

  if (depositValue > 0) {
    drawFinalTotalsRow('Deposit / Acompte Paid', `-${formatCurrency(depositValue)}`, false, '#0000ff');
  }

  drawFinalTotalsRow('Total Before VAT', formatCurrency(totalBeforeVat));
  drawFinalTotalsRow('Total VAT (15%)', formatCurrency(totalVatFinal));
  drawFinalTotalsRow('Net Amount To Pay (Rs)', formatCurrency(finalNetAmount), true);

  // Amount in Words
  doc.moveDown(1.5);
  doc.fillColor('#000000').font('Helvetica-BoldOblique').fontSize(10);
  const amountWords = `${numberToWords(finalNetAmount)} Mauritian Rupees Only.`;
  doc.text(amountWords, 40, doc.y);
  
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text(`Received By: ${sale.paymentMode}`, 40, doc.y + 5);

  // Signatures Section
  doc.moveDown(3);
  const sigY = doc.y;
  
  const drawSigBox = (label: string, xStart: number, width: number) => {
    doc.strokeColor('#000000').lineWidth(1).moveTo(xStart, sigY + 30).lineTo(xStart + width, sigY + 30).stroke();
    doc.font('Helvetica-Bold').fontSize(8).text(label, xStart, sigY + 35, { width, align: 'center' });
  };

  drawSigBox("CUSTOMER'S SIGNATURE", 40, 140);
  drawSigBox("INVOICE CHECKED BY", 227, 140);
  drawSigBox("AUTHORISED SIGNATORY", 415, 140);

  // Footer Block
  const footerY = 740;
  doc.rect(40, footerY, 515, 25).fill('#5c3a21');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
  doc.text('Thank you for choosing us for your precious jewellery. We hope to see you again!', 40, footerY + 9, { width: 515, align: 'center' });

  // 7. Terms & Conditions Page (Page Break)
  doc.addPage();
  
  // Header
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(16);
  doc.text('TERMS & CONDITIONS', 40, 50, { align: 'center', underline: true });
  doc.fontSize(10).font('Helvetica-Oblique').text('Returns, Exchange & Upgrade Policy - Valid within 7 days of purchase', 40, 75, { align: 'center' });
  
  // T&C Boxes
  let tcY = 110;
  
  const drawTcBox = (title: string, bullets: string[]) => {
    doc.strokeColor('#cccccc').lineWidth(1).rect(40, tcY, 515, 80).stroke();
    doc.fillColor('#5c3a21').font('Helvetica-Bold').fontSize(11).text(title, 55, tcY + 10);
    doc.strokeColor('#eeeeee').moveTo(55, tcY + 25).lineTo(540, tcY + 25).stroke();
    
    doc.fillColor('#000000').font('Helvetica').fontSize(9);
    let bulletY = tcY + 32;
    bullets.forEach(bullet => {
      doc.text('•', 55, bulletY);
      doc.text(bullet, 65, bulletY, { width: 480 });
      bulletY += 14;
    });
    
    tcY += 95;
  };

  drawTcBox('Gold Jewellery', [
    'Gold jewellery can be exchanged for other jewellery of equivalent value.',
    'Making charges will be deducted during the exchange.',
    'No cash refunds.'
  ]);

  drawTcBox('Diamond Jewellery', [
    'Diamond jewellery can be exchanged for diamond jewellery of equivalent invoice value.',
    'No cash refunds.'
  ]);

  drawTcBox('Important Notes', [
    'The original invoice must be returned for any exchange or upgrade.',
    'If the jewellery sold includes a certificate, the original certificate must also be returned.'
  ]);

  // Store Address details centered at the bottom
  const storeY = 410;
  doc.fillColor('#5c3a21').font('Helvetica-Bold').fontSize(10);
  doc.text('Haujee Jewellery', 40, storeY, { align: 'center' });
  doc.font('Helvetica').fontSize(9);
  doc.text('12 Rue de la Corderie, Port Louis, Mauritius', 40, storeY + 15, { align: 'center' });
  doc.text('Tel: +230 212 3456', 40, storeY + 28, { align: 'center' });

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

  // Fetch odf items
  const items = await db.select().from(odfItems).where(eq(odfItems.odfId, odfId));

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

  // ODF Details
  doc.font('Helvetica-Bold').text('Détails du Rachat:');
  doc.font('Helvetica');
  doc.text(`Métal Principal: ${formatItemDetails(odfRecord.metalType)}`);
  doc.moveDown(0.5);

  if (items.length > 0) {
    // Draw items header
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Articles Rachetés:', { underline: true });
    doc.moveDown(0.3);

    items.forEach((item, index) => {
      doc.font('Helvetica-Bold').text(`${index + 1}. ${item.description}`);
      doc.font('Helvetica').text(`    Masse: ${item.mass} g | Finesse: ${item.fineness}`);
      doc.moveDown(0.3);
    });
    doc.moveDown(0.5);
  } else {
    // Fallback for older ODF records with single item details
    doc.text(`Description: ${formatItemDetails(odfRecord.description || 'Article')}`);
    doc.text(`Finesse: ${formatItemDetails(odfRecord.fineness)}`);
    doc.moveDown(0.5);
  }

  doc.font('Helvetica-Bold').fontSize(10);
  doc.text(`Masse Totale: ${odfRecord.weight} g`);
  doc.text(`Montant Estimé Total: ${formatCurrency(odfRecord.amount || 0)}`);
  doc.moveDown();

  if (odfRecord.itemReservedRepair) {
    doc.font('Helvetica-Bold').text('Article Réservé / Réparation:');
    doc.font('Helvetica').text(formatItemDetails(odfRecord.itemReservedRepair));
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

export async function generateDeclarationPDF(saleId: number): Promise<{ doc: PDFKit.PDFDocument }> {
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
  // Sort in JS to find the latest ODF
  const sortedOdfs = customerOdfs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const odfRecord = sortedOdfs[0];

  // 4. Fetch trade-in items if ODF exists
  let items: any[] = [];
  if (odfRecord) {
    items = await db.select().from(odfItems).where(eq(odfItems.odfId, odfRecord.id));
  }

  // 5. Create PDF
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
  });

  const heading = 'SOCIETE MOHAMMUD HAUJEE & SONS';
  const addressLine = '33, SIR SEEWOOSAGUR RAMGOOLAM STREET';
  const cityLine = 'PORT LOUIS';

  // Format Dates
  const saleDateObj = new Date(sale.datetime);
  const startDateStr = saleDateObj.toLocaleDateString('en-GB'); // DD/MM/YYYY
  const endDateObj = new Date(saleDateObj.getTime() + 10 * 24 * 60 * 60 * 1000);
  const endDateStr = endDateObj.toLocaleDateString('en-GB');

  // Top Serial No.
  doc.font('Times-Bold').fontSize(10);
  doc.text(`Serial No.: ${receipt.receiptSerialNumber}`, { align: 'right' });
  doc.moveDown(1.5);

  // Header
  doc.fontSize(12).text('DECLARATION OF OWNERSHIP IN CASE OF TRADE-IN OF JEWELLERY', { align: 'center' });
  doc.text(heading, { align: 'center' });
  doc.text(addressLine, { align: 'center' });
  doc.text(cityLine, { align: 'center' });
  doc.moveDown(2);

  // PART I Header
  doc.text('PART I', { align: 'center', underline: true });
  doc.font('Times-Roman').fontSize(10).text('(To be filled by the customer)', { align: 'center' });
  doc.moveDown(1.5);

  // Customer Section
  doc.font('Times-Roman').fontSize(11);
  doc.text('I, ', { continued: true });
  doc.font('Times-Bold').text(customer.name || '', { continued: true });
  doc.font('Times-Roman').text(', of ', { continued: true });
  doc.font('Times-Bold').text(customer.address || 'N/A', { continued: true });
  doc.font('Times-Roman').text(', certify that the jewellery specified below belongs to me and I have obtained it through legal means.');
  doc.moveDown(1.5);

  // Trade-in Jewellery Label
  doc.font('Times-Bold').fontSize(11).text('Trade-in jewellery');
  doc.moveDown(0.5);

  // Items Table Header
  const tableTop = doc.y;
  doc.font('Times-Bold').fontSize(10);
  doc.text('SN', 40, tableTop, { width: 30, align: 'center' });
  doc.text('Description', 80, tableTop, { width: 230, align: 'left' });
  doc.text('Mass (grams)', 320, tableTop, { width: 100, align: 'center' });
  doc.text('Declared fineness', 430, tableTop, { width: 100, align: 'center' });

  // Draw line below header
  doc.moveTo(40, tableTop + 15).lineTo(540, tableTop + 15).strokeColor('#000000').stroke();

  let currentY = tableTop + 20;
  doc.font('Times-Roman');

  if (items && items.length > 0) {
    items.forEach((item, index) => {
      doc.text((index + 1).toString(), 40, currentY, { width: 30, align: 'center' });
      doc.text(item.description || '', 80, currentY, { width: 230, align: 'left' });
      doc.text(item.mass ? parseFloat(item.mass).toFixed(3) : '0.000', 320, currentY, { width: 100, align: 'center' });
      doc.text(item.fineness || '', 430, currentY, { width: 100, align: 'center' });
      currentY += 20;
    });
  } else {
    // Fallback if no items or ODF
    const fallbackDesc = odfRecord ? (odfRecord.description || 'Article') : 'Article';
    const fallbackWeight = odfRecord ? parseFloat(odfRecord.weight || '0').toFixed(3) : '0.000';
    const fallbackFineness = odfRecord ? (odfRecord.fineness || '') : '';
    doc.text('1', 40, currentY, { width: 30, align: 'center' });
    doc.text(fallbackDesc, 80, currentY, { width: 230, align: 'left' });
    doc.text(fallbackWeight, 320, currentY, { width: 100, align: 'center' });
    doc.text(fallbackFineness, 430, currentY, { width: 100, align: 'center' });
    currentY += 20;
  }

  doc.moveTo(40, currentY).lineTo(540, currentY).stroke();
  doc.y = currentY + 15;

  // Signature Section PART I
  const sigY = doc.y;
  doc.font('Times-Roman').fontSize(10);
  
  // Left side: Signature
  doc.moveTo(40, sigY + 40).lineTo(220, sigY + 40).stroke();
  doc.text('Signature', 40, sigY + 45, { width: 180, align: 'center' });

  // Right side: Date & Phone
  doc.font('Times-Bold').text(startDateStr, 340, sigY);
  doc.moveTo(340, sigY + 15).lineTo(520, sigY + 15).stroke();
  doc.font('Times-Roman').text('Date', 340, sigY + 20, { width: 180, align: 'center' });

  doc.font('Times-Bold').text(customer.phoneNumber || '', 340, sigY + 45);
  doc.moveTo(340, sigY + 60).lineTo(520, sigY + 60).stroke();
  doc.font('Times-Roman').text('Telephone number', 340, sigY + 65, { width: 180, align: 'center' });

  doc.y = sigY + 90;

  // PART II Header
  doc.font('Times-Bold').fontSize(11).text('PART II', { align: 'center', underline: true });
  doc.font('Times-Roman').fontSize(10).text('(To be completed by the dealer/person on behalf of dealer)', { align: 'center' });
  doc.moveDown(1.5);

  const startX = 40;
  doc.font('Times-Roman').fontSize(11);
  doc.text('1. I certify having verified the name of the person referred to in Part I and found it to be correct.', startX);
  doc.moveDown(0.5);

  doc.text('2. Proof of identity produced:', startX);
  doc.text(`   *NIC number/identification number* of approved document: `, { continued: true });
  doc.font('Times-Bold').text(customer.idNumber || 'N/A');
  doc.font('Times-Roman');
  doc.moveDown(0.5);

  doc.text('3. Receipt issued at time of trade-in: ', startX, doc.y, { continued: true });
  doc.font('Times-Bold').text(receipt.receiptSerialNumber.toString());
  doc.font('Times-Roman');
  doc.moveDown(0.5);

  // Holding period checklist
  const checklistY = doc.y;
  doc.text('4. Holding period   YES ', startX, checklistY, { continued: true });
  
  // Draw checkbox for YES
  const checkboxSize = 10;
  const yesCheckboxX = doc.x + 5;
  doc.rect(yesCheckboxX, checklistY + 1, checkboxSize, checkboxSize).stroke();
  doc.text(`        (from ${startDateStr} to ${endDateStr})`, { continued: false });

  const noChecklistY = doc.y + 5;
  doc.text('                    NO  ', startX, noChecklistY, { continued: true });
  const noCheckboxX = doc.x + 5;
  doc.rect(noCheckboxX, noChecklistY + 1, checkboxSize, checkboxSize).stroke();
  doc.text('         (attach original receipt of jewellery)', { continued: false });

  doc.y = noChecklistY + 25;

  // Dealer Signature Row
  doc.moveDown(1.5);
  const dealerSigY = doc.y;

  // Left side: Name & Time
  doc.moveTo(40, dealerSigY + 30).lineTo(220, dealerSigY + 30).stroke();
  doc.text('Name', 40, dealerSigY + 35, { width: 180, align: 'center' });

  doc.moveTo(40, dealerSigY + 75).lineTo(220, dealerSigY + 75).stroke();
  doc.text('Time', 40, dealerSigY + 80, { width: 180, align: 'center' });

  // Right side: Signature & Date
  doc.moveTo(340, dealerSigY + 30).lineTo(520, dealerSigY + 30).stroke();
  doc.text('Signature', 340, dealerSigY + 35, { width: 180, align: 'center' });

  doc.font('Times-Bold').text(startDateStr, 340, dealerSigY + 55);
  doc.moveTo(340, dealerSigY + 70).lineTo(520, dealerSigY + 70).stroke();
  doc.font('Times-Roman').text('Date', 340, dealerSigY + 75, { width: 180, align: 'center' });

  // Footer Note
  doc.y = dealerSigY + 100;
  doc.moveDown(2);
  doc.moveTo(40, doc.y).lineTo(540, doc.y).stroke();
  doc.moveDown(0.5);
  doc.font('Times-Bold').fontSize(10).text('Holding Period');
  doc.font('Times-Roman').fontSize(9).text('A holding period of 10 days shall apply from the date of transaction, in case original receipt of the jewellery is not available.');

  return { doc };
}

export async function generateTradeInReportPDF(startDate?: string, endDate?: string): Promise<PDFKit.PDFDocument> {
  let conditions = [];
  if (startDate) {
    conditions.push(sql`${odf.createdAt} >= ${new Date(startDate)}`);
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push(sql`${odf.createdAt} <= ${end}`);
  }

  const allOdf = await db.select({
    id: odf.id,
    odfSerialNumber: odf.odfSerialNumber,
    createdAt: odf.createdAt,
    customerId: odf.customerId,
    customerName: customers.name,
    customerNIC: customers.idNumber,
    customerAddress: customers.address,
    metalType: odf.metalType,
    fineness: odf.fineness,
    weight: odf.weight,
    amount: odf.amount,
    description: odf.description,
    receiptNo: receipts.receiptSerialNumber
  })
  .from(odf)
  .innerJoin(customers, eq(odf.customerId, customers.id))
  .leftJoin(sales, eq(sales.linkedOdfId, odf.id))
  .leftJoin(receipts, eq(receipts.saleId, sales.id))
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .orderBy(odf.createdAt);

  const allOdfWithItems = await Promise.all(allOdf.map(async (record) => {
    const items = await db.select().from(odfItems).where(eq(odfItems.odfId, record.id));
    return {
      ...record,
      tradeInItems: items
    };
  }));

  // Flatten items for the ledger
  const calculatedData = [];
  for (const record of allOdfWithItems) {
    if (record.tradeInItems && record.tradeInItems.length > 0) {
      for (const item of record.tradeInItems) {
        calculatedData.push({
          id: record.id,
          date: record.createdAt,
          customerName: record.customerName,
          customerNIC: record.customerNIC,
          customerAddress: record.customerAddress,
          description: item.description || `${record.metalType} ${item.fineness || record.fineness}`,
          weight: item.mass,
          fineness: item.fineness,
          invNo: `#ODF-${record.odfSerialNumber || record.id}`,
          out: record.receiptNo ? `#FS-${record.receiptNo}` : '-'
        });
      }
    } else {
      calculatedData.push({
        id: record.id,
        date: record.createdAt,
        customerName: record.customerName,
        customerNIC: record.customerNIC,
        customerAddress: record.customerAddress,
        description: record.description || `${record.metalType} ${record.fineness}`,
        weight: record.weight,
        fineness: record.fineness,
        invNo: `#ODF-${record.odfSerialNumber || record.id}`,
        out: record.receiptNo ? `#FS-${record.receiptNo}` : '-'
      });
    }
  }

  const allSettings = await db.select().from(settings);
  const heading = allSettings.find(s => s.key === 'receipt_heading')?.value || 'Haujee Jewellery';

  // Create PDF in LANDSCAPE orientation
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 30,
    bufferPages: true,
  });

  // Header Title
  doc.fontSize(16).font('Helvetica-Bold').text(heading, { align: 'center' });
  doc.fontSize(13).text('REGISTRE TRADE-IN (ASSAY OFFICE)', { align: 'center' });
  doc.fontSize(8).font('Helvetica-Oblique').text(`Généré le: ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, { align: 'center' });
  doc.moveDown(0.5);

  // Filter Details
  doc.fontSize(8).font('Helvetica-Bold').text('PÉRIODE DE RECHERCHE:');
  const periodText = (startDate && endDate) 
    ? `Du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}`
    : 'Tous les enregistrements';
  doc.font('Helvetica').fontSize(8).text(periodText);
  doc.moveDown(0.5);

  const bottomThreshold = doc.page.height - 110; // Extra room for signature stamp at bottom

  const drawTableHeader = (startY: number) => {
    doc.rect(30, startY, 782, 22).fill('#f1f5f9');
    doc.fillColor('#334155');
    doc.font('Helvetica-Bold').fontSize(8);
    
    doc.text('DATE', 35, startY + 7);
    doc.text('DESCRIPTION', 110, startY + 7);
    doc.text('NAME', 225, startY + 7);
    doc.text('NIC', 340, startY + 7);
    doc.text('ADDRESS', 420, startY + 7);
    doc.text('IN (g)', 570, startY + 7, { width: 45, align: 'right' });
    doc.text('FINENESS', 620, startY + 7);
    doc.text('INV. NO.', 675, startY + 7);
    doc.text('OUT (g)', 765, startY + 7, { width: 45, align: 'right' });
    
    doc.moveTo(30, startY + 22).lineTo(812, startY + 22).strokeColor('#cbd5e1').stroke();
    doc.font('Helvetica').fontSize(8).fillColor('black');
  };

  let y = doc.y;
  drawTableHeader(y);
  y += 26;

  for (const row of calculatedData) {
    const dateStr = row.date ? new Date(row.date).toLocaleDateString('fr-FR') : 'N/A';
    const descriptionStr = row.description || '-';
    const nameStr = row.customerName || '-';
    const nicStr = row.customerNIC || '-';
    const addressStr = row.customerAddress || '-';
    const weightStr = row.weight ? parseFloat(row.weight).toFixed(3) : '0.000';
    const finenessStr = row.fineness || '-';
    const invNoStr = row.invNo || '-';
    const outStr = row.out || '-';

    // Calculate maximum text height for multi-line description & address
    const descHeight = doc.heightOfString(descriptionStr, { width: 110 });
    const nameHeight = doc.heightOfString(nameStr, { width: 110 });
    const addrHeight = doc.heightOfString(addressStr, { width: 145 });
    const rowHeight = Math.max(20, descHeight + 6, nameHeight + 6, addrHeight + 6);

    if (y + rowHeight > bottomThreshold) {
      doc.addPage();
      drawTableHeader(doc.y);
      y = doc.y + 26;
    }

    // Zebra striping
    doc.font('Helvetica').fontSize(8);
    
    doc.text(dateStr, 35, y + 4);
    doc.text(descriptionStr, 110, y + 4, { width: 110 });
    doc.text(nameStr, 225, y + 4, { width: 110 });
    doc.text(nicStr, 340, y + 4);
    doc.text(addressStr, 420, y + 4, { width: 145 });
    doc.text(weightStr, 570, y + 4, { width: 45, align: 'right' });
    doc.text(finenessStr, 620, y + 4);
    doc.text(invNoStr, 675, y + 4);
    doc.text(outStr, 765, y + 4, { width: 45, align: 'right' });

    doc.moveTo(30, y + rowHeight).lineTo(812, y + rowHeight).strokeColor('#e2e8f0').stroke();
    y += rowHeight;
  }

  // Draw signature and stamp block at the bottom
  // Ensure we don't overflow the bottom of the page
  if (y + 80 > doc.page.height) {
    doc.addPage();
    y = 40;
  } else {
    y = Math.max(y + 20, doc.page.height - 100);
  }

  doc.rect(30, y, 782, 1).fillColor('#cbd5e1').fill();
  doc.fillColor('#475569');
  doc.fontSize(8).font('Helvetica-Bold');
  
  doc.text('PREPARED BY (NAME & SIGNATURE): ____________________________', 35, y + 15);
  doc.text('ASSAY OFFICE VERIFICATION STAMP / DATE: ____________________________', 430, y + 15);

  return doc;
}

export async function generateSalesByMetalReportPDF(startDate?: string, endDate?: string, metalType?: string, fineness?: string): Promise<PDFKit.PDFDocument> {
  let conditions = [];
  
  // Filter out cancelled sales
  conditions.push(eq(sales.status, 'Completed'));

  if (startDate) {
    conditions.push(sql`${sales.createdAt} >= ${new Date(startDate)}`);
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push(sql`${sales.createdAt} <= ${end}`);
  }

  if (metalType && metalType !== 'all') {
    let mType = metalType.toLowerCase().trim();
    if (mType === 'or' || mType === 'gold') {
      conditions.push(or(ilike(sales.metalType, 'Gold'), ilike(sales.metalType, 'Or')));
    } else if (mType === 'argent' || mType === 'silver') {
      conditions.push(or(ilike(sales.metalType, 'Silver'), ilike(sales.metalType, 'Argent')));
    } else if (mType === 'platine' || mType === 'platinum') {
      conditions.push(or(ilike(sales.metalType, 'Platinum'), ilike(sales.metalType, 'Platine')));
    } else {
      conditions.push(ilike(sales.metalType, metalType));
    }
  }

  if (fineness && fineness !== 'all') {
    conditions.push(ilike(sales.fineness, fineness));
  }

  const matchingSales = await db.select({
    id: sales.id,
    createdAt: sales.createdAt,
    customerName: customers.name,
    itemDetails: sales.itemDetails,
    barcode: stock.barcode,
    metalType: sales.metalType,
    fineness: sales.fineness,
    weight: sales.weight,
    amount: sales.amount,
    vat15: sales.vat15,
    receiptNo: receipts.receiptSerialNumber
  })
  .from(sales)
  .leftJoin(customers, eq(sales.customerId, customers.id))
  .leftJoin(stock, eq(sales.stockId, stock.id))
  .leftJoin(receipts, eq(sales.id, receipts.saleId))
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .orderBy(sql`${sales.createdAt} DESC`);

  const calculatedData = matchingSales.map(row => {
    const w = parseFloat(row.weight || "0");
    const amt = parseFloat(row.amount || "0");
    const vat = parseFloat(row.vat15 || "0");
    const totalWithVat = amt + vat;
    
    return {
      ...row,
      weight: w,
      amount: amt,
      totalWithVat: totalWithVat
    };
  });

  const allSettings = await db.select().from(settings);
  const heading = allSettings.find(s => s.key === 'receipt_heading')?.value || 'Haujee Jewellery';

  // Create PDF in LANDSCAPE orientation
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 30,
    bufferPages: true,
  });

  // Header Title
  doc.fontSize(16).font('Helvetica-Bold').text(heading, { align: 'center' });
  doc.fontSize(13).text('RAPPORT DES VENTES PAR MÉTAL', { align: 'center' });
  doc.fontSize(8).font('Helvetica-Oblique').text(`Généré le: ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, { align: 'center' });
  doc.moveDown(0.5);

  // Filter Details
  doc.fontSize(8).font('Helvetica-Bold').text('FILTRES APPLIQUÉS:');
  const periodText = `Période: ${(startDate && endDate) ? `Du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}` : 'Toutes'} | Métal: ${metalType || 'Tous'} | Pureté: ${fineness || 'Toutes'}`;
  doc.font('Helvetica').fontSize(8).text(periodText);
  doc.moveDown(0.5);

  const bottomThreshold = doc.page.height - 50;

  const drawTableHeader = (startY: number) => {
    doc.rect(30, startY, 782, 22).fill('#f1f5f9');
    doc.fillColor('#334155');
    doc.font('Helvetica-Bold').fontSize(8);
    
    doc.text('DATE', 35, startY + 7);
    doc.text('FACTURE N°', 110, startY + 7);
    doc.text('CLIENT', 180, startY + 7);
    doc.text('DESCRIPTION', 310, startY + 7);
    doc.text('MÉTAL', 460, startY + 7);
    doc.text('PURETÉ', 530, startY + 7);
    doc.text('POIDS (g)', 590, startY + 7, { width: 55, align: 'right' });
    doc.text('REVENU HT (Rs)', 660, startY + 7, { width: 70, align: 'right' });
    doc.text('TOTAL TTC (Rs)', 740, startY + 7, { width: 65, align: 'right' });
    
    doc.moveTo(30, startY + 22).lineTo(812, startY + 22).strokeColor('#cbd5e1').stroke();
    doc.font('Helvetica').fontSize(8).fillColor('black');
  };

  let y = doc.y;
  drawTableHeader(y);
  y += 26;

  let grandTotalWeight = 0;
  let grandTotalHT = 0;
  let grandTotalTTC = 0;

  for (const row of calculatedData) {
    const dateStr = row.createdAt ? new Date(row.createdAt).toLocaleDateString('fr-FR') : 'N/A';
    const receiptStr = row.receiptNo ? `#FS-${row.receiptNo}` : `Ref #${row.id}`;
    const clientStr = row.customerName || '-';
    const descriptionStr = row.itemDetails || '-';
    const metalStr = row.metalType || '-';
    const finenessStr = row.fineness || '-';
    const weightStr = row.weight.toFixed(3);
    const amountStr = row.amount.toFixed(2);
    const totalWithVatStr = row.totalWithVat.toFixed(2);

    grandTotalWeight += row.weight;
    grandTotalHT += row.amount;
    grandTotalTTC += row.totalWithVat;

    const descHeight = doc.heightOfString(descriptionStr, { width: 140 });
    const clientHeight = doc.heightOfString(clientStr, { width: 120 });
    const rowHeight = Math.max(20, descHeight + 6, clientHeight + 6);

    if (y + rowHeight > bottomThreshold) {
      doc.addPage();
      drawTableHeader(doc.y);
      y = doc.y + 26;
    }

    doc.font('Helvetica').fontSize(8);
    
    doc.text(dateStr, 35, y + 4);
    doc.text(receiptStr, 110, y + 4);
    doc.text(clientStr, 180, y + 4, { width: 120 });
    doc.text(descriptionStr, 310, y + 4, { width: 140 });
    doc.text(metalStr, 460, y + 4);
    doc.text(finenessStr, 530, y + 4);
    doc.text(weightStr, 590, y + 4, { width: 55, align: 'right' });
    doc.text(amountStr, 660, y + 4, { width: 70, align: 'right' });
    doc.text(totalWithVatStr, 740, y + 4, { width: 65, align: 'right' });

    doc.moveTo(30, y + rowHeight).lineTo(812, y + rowHeight).strokeColor('#e2e8f0').stroke();
    y += rowHeight;
  }

  // Draw Summary Row
  if (y + 30 > bottomThreshold) {
    doc.addPage();
    drawTableHeader(doc.y);
    y = doc.y + 26;
  }

  doc.rect(30, y, 782, 22).fill('#f8fafc');
  doc.fillColor('#0f172a');
  doc.font('Helvetica-Bold').fontSize(8);
  
  doc.text('TOTAL GENERAL', 35, y + 7);
  doc.text(grandTotalWeight.toFixed(3), 590, y + 7, { width: 55, align: 'right' });
  doc.text(grandTotalHT.toFixed(2), 660, y + 7, { width: 70, align: 'right' });
  doc.text(grandTotalTTC.toFixed(2), 740, y + 7, { width: 65, align: 'right' });

  doc.moveTo(30, y + 22).lineTo(812, y + 22).strokeColor('#0f172a').stroke();

  return doc;
}

