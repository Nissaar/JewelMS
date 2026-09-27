import PDFDocument from 'pdfkit';
import { db } from '../../db';
import { customers, settings, odf, odfItems } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { formatCurrency, formatItemDetails } from '../../lib/utils';

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
