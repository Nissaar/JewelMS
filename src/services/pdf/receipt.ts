import PDFDocument from 'pdfkit';
import { db } from '../../db';
import { sales, saleItems, customers, receipts, odf, stock, orders } from '../../db/schema';
import { eq, sql } from 'drizzle-orm';
import { formatCurrency, formatItemDetails } from '../../lib/utils';
import { numberToWords, addWatermark } from './common';
import { getShopDetails } from '../shopDetails';
import { splitGross, toCents, VAT_RATE } from '../../shared/money';

/**
 * Builds the tax invoice. A counted print increments the receipt's print count,
 * and every print after the first is watermarked COPIE. Stored copies sent to
 * the customer pass countAsPrint: false and are always the clean original.
 */
export async function generateReceiptPDF(
  saleId: number,
  { countAsPrint = true }: { countAsPrint?: boolean } = {},
): Promise<{ doc: PDFKit.PDFDocument, receipt: any }> {
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

  // One receipt per sale (unique sale_id); safe when two requests race.
  await db.insert(receipts).values({ saleId }).onConflictDoNothing({ target: receipts.saleId });
  let [receipt] = await db.select().from(receipts).where(eq(receipts.saleId, saleId)).limit(1);

  // Count the print atomically; every print after the first is a copy.
  let isCopy = false;
  if (countAsPrint) {
    [receipt] = await db.update(receipts)
      .set({ printCount: sql`${receipts.printCount} + 1` })
      .where(eq(receipts.id, receipt.id))
      .returning();
    isCopy = receipt.printCount > 1;
  }

  const shop = await getShopDetails();

  // 2. Create PDF with standard A4 page size
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    bufferPages: true,
  });

  // Header Block
  doc.fillColor('#5c3a21');
  doc.fontSize(24).font('Helvetica-Bold').text(shop.name.toUpperCase(), { align: 'center', characterSpacing: 2 });
  doc.fillColor('#000000');
  doc.fontSize(14).font('Helvetica-Bold').text('TAX INVOICE', { align: 'center' });
  const registration = [shop.vatNumber && `VAT : ${shop.vatNumber}`, shop.brn && `BRN : ${shop.brn}`].filter(Boolean).join('   ');
  if (registration) doc.fontSize(10).font('Helvetica').text(registration, { align: 'center' });
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

  // Fetch items list
  const itemsList = await db.select({
    item: saleItems,
    stock: stock
  })
  .from(saleItems)
  .leftJoin(stock, eq(saleItems.stockId, stock.id))
  .where(eq(saleItems.saleId, saleId));

  // Determine rows to render (fallback to record for legacy sales)
  const renderedRows = itemsList.length > 0 ? itemsList.map((row, index) => {
    const s = row.stock;
    const stockCode = row.item.barcode || s?.itemCode || s?.barcode || 'N/A';
    let description = row.item.itemDetails || formatItemDetails(sale.itemDetails) || 'Article Bijouterie';
    if (s) {
      description = `${s.category} ${s.subCategory || ''} ${s.metalType ? `(${s.metalType})` : ''}`.trim().replace(/\s+/g, ' ');
      if (s.fineness) {
        description += ` - ${s.fineness}`;
      }
    }
    const pcs = row.item.qty || 1;
    const weight = row.item.weight ?? s?.weightGrams;
    const qtyGrams = weight ? parseFloat(String(weight)).toFixed(3) : '-';
    // Stored amounts, in cents: the invoice must match what was recorded.
    const netCents = toCents(row.item.amount);
    const taxCents = row.item.vat15 != null ? toCents(row.item.vat15) : Math.round(netCents * VAT_RATE);
    return { index: index + 1, stockCode, description, pcs, qtyGrams, netCents, taxCents, grossCents: netCents + taxCents };
  }) : [{
    index: 1,
    stockCode: record.stock?.itemCode || record.stock?.barcode || 'N/A',
    description: record.stock 
      ? `${record.stock.category} ${record.stock.subCategory || ''} ${record.stock.metalType ? `(${record.stock.metalType})` : ''}`.trim().replace(/\s+/g, ' ')
      : (formatItemDetails(sale.itemDetails) || 'Article Bijouterie'),
    pcs: sale.qty || 1,
    qtyGrams: sale.weight ? parseFloat(String(sale.weight)).toFixed(3) : '-',
    netCents: toCents(sale.amount),
    taxCents: toCents(sale.vat15),
    grossCents: toCents(sale.amount) + toCents(sale.vat15),
  }];

  let currentRowY = tableHeaderY + headerHeight;
  let totalNetCents = 0;
  let totalTaxCents = 0;
  let totalGrossCents = 0;
  let totalPcsSum = 0;

  for (const rowData of renderedRows) {
    const descHeight = doc.heightOfString(rowData.description, { width: 155 });
    const rowHeight = Math.max(25, descHeight + 10);

    doc.font('Helvetica').fontSize(8).fillColor('#000000');
    doc.text(String(rowData.index), columns[0].x, currentRowY + (rowHeight - 8) / 2, { width: columns[0].w, align: 'center' });
    doc.text(rowData.stockCode, columns[1].x, currentRowY + (rowHeight - 8) / 2, { width: columns[1].w, align: 'center' });
    doc.text(rowData.description, columns[2].x, currentRowY + 5, { width: columns[2].w, align: 'left' });
    doc.text(String(rowData.pcs), columns[3].x, currentRowY + (rowHeight - 8) / 2, { width: columns[3].w, align: 'center' });
    doc.text(String(rowData.qtyGrams), columns[4].x, currentRowY + (rowHeight - 8) / 2, { width: columns[4].w, align: 'right' });
    doc.text(formatCurrency(rowData.netCents / 100), columns[5].x, currentRowY + (rowHeight - 8) / 2, { width: columns[5].w, align: 'right' });
    doc.text('15.00', columns[6].x, currentRowY + (rowHeight - 8) / 2, { width: columns[6].w, align: 'center' });
    doc.text(formatCurrency(rowData.taxCents / 100), columns[7].x, currentRowY + (rowHeight - 8) / 2, { width: columns[7].w, align: 'right' });
    doc.text(formatCurrency(rowData.grossCents / 100), columns[8].x, currentRowY + (rowHeight - 8) / 2, { width: columns[8].w, align: 'right' });

    doc.rect(40, currentRowY, 515, rowHeight).strokeColor('#000000').lineWidth(1).stroke();
    columns.forEach((col, idx) => {
      if (idx > 0) {
        doc.moveTo(col.x, currentRowY).lineTo(col.x, currentRowY + rowHeight).stroke();
      }
    });

    currentRowY += rowHeight;
    totalNetCents += rowData.netCents;
    totalTaxCents += rowData.taxCents;
    totalGrossCents += rowData.grossCents;
    totalPcsSum += Number(rowData.pcs);
  }

  currentY = currentRowY;

  // Row 1: Sub-totals align row
  let totalRowY = currentY;
  const totalRowHeight = 20;

  doc.rect(40, totalRowY, 515, totalRowHeight).strokeColor('#000000').lineWidth(1).stroke();
  doc.font('Helvetica-Bold').fontSize(8);

  doc.text(`Total (${totalPcsSum} Items)`, 45, totalRowY + 6, { width: columns[5].x - 45, align: 'right' });
  doc.text(formatCurrency(totalNetCents / 100), columns[5].x, totalRowY + 6, { width: columns[5].w, align: 'right' });
  doc.text(formatCurrency(totalTaxCents / 100), columns[7].x, totalRowY + 6, { width: columns[7].w, align: 'right' });
  doc.text(formatCurrency(totalGrossCents / 100), columns[8].x, totalRowY + 6, { width: columns[8].w, align: 'right' });

  doc.moveTo(columns[5].x, totalRowY).lineTo(columns[5].x, totalRowY + totalRowHeight).stroke();
  doc.moveTo(columns[6].x, totalRowY).lineTo(columns[6].x, totalRowY + totalRowHeight).stroke();
  doc.moveTo(columns[7].x, totalRowY).lineTo(columns[7].x, totalRowY + totalRowHeight).stroke();
  doc.moveTo(columns[8].x, totalRowY).lineTo(columns[8].x, totalRowY + totalRowHeight).stroke();

  currentY = totalRowY + totalRowHeight;

  // Summary and calculations with integrated Scrap Exchange
  const scrapCents = linkedOdf ? toCents(linkedOdf.amount) : 0;
  const depositCents = toCents(order?.deposit) + toCents(linkedCommande?.deposit);

  // Trade-in value and deposit are deducted from the VAT-inclusive total; the
  // amount still due is then split into its net and VAT parts.
  const due = splitGross(Math.max(0, totalGrossCents - scrapCents - depositCents));

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

  if (scrapCents > 0) {
    drawFinalTotalsRow('Scrap Exchange / Trade-in', `-${formatCurrency(scrapCents / 100)}`, false, '#ff0000');
  }

  if (depositCents > 0) {
    drawFinalTotalsRow('Deposit / Acompte Paid', `-${formatCurrency(depositCents / 100)}`, false, '#0000ff');
  }

  drawFinalTotalsRow('Total Before VAT', formatCurrency(due.netCents / 100));
  drawFinalTotalsRow('Total VAT (15%)', formatCurrency(due.vatCents / 100));
  drawFinalTotalsRow('Net Amount To Pay (Rs)', formatCurrency(due.grossCents / 100), true);

  // Amount in Words
  doc.moveDown(1.5);
  doc.fillColor('#000000').font('Helvetica-BoldOblique').fontSize(10);
  const amountWords = `${numberToWords(due.grossCents / 100)} Mauritian Rupees Only.`;
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
  doc.text(shop.legalName || shop.name, 40, storeY, { align: 'center' });
  doc.font('Helvetica').fontSize(9);
  if (shop.address) doc.text(shop.address, 40, storeY + 15, { align: 'center' });
  if (shop.phone) doc.text(`Tel: ${shop.phone}`, 40, storeY + 28, { align: 'center' });

  if (isCopy) addWatermark(doc, 'COPIE');

  return { doc, receipt };
}
