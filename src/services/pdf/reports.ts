import PDFDocument from 'pdfkit';
import { db } from '../../db';
import { sales, customers, receipts, settings, odf, odfItems, stock } from '../../db/schema';
import { eq, and, sql, or, ilike } from 'drizzle-orm';
import { formatCurrency } from '../../lib/utils';

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
