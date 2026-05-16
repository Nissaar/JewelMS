import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

export async function uploadReceiptToR2(receiptNumber: string, pdfBuffer: Buffer): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  const key = `receipts/receipt-${receiptNumber}.pdf`;

  if (!bucketName) {
    throw new Error("R2_BUCKET_NAME is not defined");
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: pdfBuffer,
    ContentType: "application/pdf",
  });

  await s3Client.send(command);

  // Return the public URL if configured, otherwise a generic R2 URL
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (publicUrl) {
    return `${publicUrl}/${key}`;
  }

  return `${process.env.R2_ENDPOINT}/${bucketName}/${key}`;
}

export async function uploadODFToR2(odfSerialNumber: string, pdfBuffer: Buffer): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  const key = `odf/odf-${odfSerialNumber}.pdf`;

  if (!bucketName) {
    throw new Error("R2_BUCKET_NAME is not defined");
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: pdfBuffer,
    ContentType: "application/pdf",
  });

  await s3Client.send(command);

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (publicUrl) {
    return `${publicUrl}/${key}`;
  }

  return `${process.env.R2_ENDPOINT}/${bucketName}/${key}`;
}
