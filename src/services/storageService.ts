import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const RECEIPTS_DIR = path.join(UPLOADS_DIR, 'receipts');
const ODF_DIR = path.join(UPLOADS_DIR, 'odf');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(RECEIPTS_DIR)) fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
if (!fs.existsSync(ODF_DIR)) fs.mkdirSync(ODF_DIR, { recursive: true });

export async function uploadReceiptToStorage(fileName: string, pdfBuffer: Buffer): Promise<string> {
  const filePath = path.join(RECEIPTS_DIR, fileName);
  await fs.promises.writeFile(filePath, pdfBuffer);
  return `/uploads/receipts/${fileName}`;
}

export async function getReceiptFromStorage(fileName: string): Promise<Buffer> {
  const filePath = path.join(RECEIPTS_DIR, fileName);
  return await fs.promises.readFile(filePath);
}

export async function uploadODFToStorage(fileName: string, pdfBuffer: Buffer): Promise<string> {
  const filePath = path.join(ODF_DIR, fileName);
  await fs.promises.writeFile(filePath, pdfBuffer);
  return `/uploads/odf/${fileName}`;
}

export async function getODFFromStorage(fileName: string): Promise<Buffer> {
  const filePath = path.join(ODF_DIR, fileName);
  return await fs.promises.readFile(filePath);
}
