import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';
import { badRequest, notFound } from '../lib/errors';

/**
 * Local file storage for customer documents and photos.
 *
 * Nothing here is served publicly. Staff read files through authenticated API
 * routes; WhatsApp (which must fetch the PDF itself) gets a short-lived signed
 * link. Stored names are random, so they reveal nothing and can't be guessed.
 */

export type StorageKind = 'receipts' | 'odf' | 'images';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const KINDS: StorageKind[] = ['receipts', 'odf', 'images'];

for (const kind of KINDS) fs.mkdirSync(path.join(UPLOADS_DIR, kind), { recursive: true });

/**
 * Resolves a stored value to its path inside the kind's folder. Accepts a bare
 * name or a legacy "/uploads/<kind>/<name>" URL; anything that would escape the
 * folder is rejected.
 */
export function resolveStoredFile(kind: StorageKind, stored: string): string {
  const dir = path.join(UPLOADS_DIR, kind);
  const name = path.basename(stored);
  const resolved = path.resolve(dir, name);
  if (!name || name.startsWith('.') || path.dirname(resolved) !== dir) {
    throw badRequest('Invalid file reference');
  }
  return resolved;
}

export async function saveFile(kind: StorageKind, data: Buffer, extension: string): Promise<string> {
  const name = `${crypto.randomUUID()}${extension}`;
  await fs.promises.writeFile(path.join(UPLOADS_DIR, kind, name), data, { flag: 'wx' });
  return name;
}

/**
 * Where a stored file actually lives. Photos uploaded before the move to
 * uploads/images/ sit directly in uploads/, so images fall back there.
 */
function locate(kind: StorageKind, stored: string): string | null {
  const primary = resolveStoredFile(kind, stored);
  if (fs.existsSync(primary)) return primary;
  if (kind === 'images') {
    const legacy = path.join(UPLOADS_DIR, path.basename(primary));
    if (fs.existsSync(legacy)) return legacy;
  }
  return null;
}

export async function readFile(kind: StorageKind, stored: string): Promise<Buffer> {
  const location = locate(kind, stored);
  if (!location) throw notFound('File not found');
  return fs.promises.readFile(location);
}

export function fileExists(kind: StorageKind, stored: string | null | undefined): boolean {
  if (!stored) return false;
  try {
    return locate(kind, stored) !== null;
  } catch {
    return false;
  }
}

// --- Uploaded images --------------------------------------------------------

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Detects the image type from its first bytes; the client's MIME type is not trusted. */
export function sniffImage(data: Buffer): { extension: string; contentType: string } | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { extension: '.jpg', contentType: 'image/jpeg' };
  }
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: '.png', contentType: 'image/png' };
  }
  if (data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
    return { extension: '.webp', contentType: 'image/webp' };
  }
  return null;
}

export async function saveImage(data: Buffer): Promise<string> {
  const type = sniffImage(data);
  if (!type) throw badRequest('Only JPEG, PNG or WebP images are accepted');
  return saveFile('images', data, type.extension);
}

export function contentTypeFor(stored: string): string {
  const ext = path.extname(stored).toLowerCase();
  return ({
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  } as Record<string, string>)[ext] || 'application/octet-stream';
}

// --- Signed links -----------------------------------------------------------

// A separate key, so a login token can never be used as a file link or vice versa.
const LINK_KEY = crypto.createHmac('sha256', JWT_SECRET).update('signed-file-links').digest();
const LINK_TTL = '24h';

export function signedFileUrl(kind: StorageKind, stored: string): string {
  const token = jwt.sign({ k: kind, f: path.basename(stored) }, LINK_KEY, { expiresIn: LINK_TTL });
  const base = (process.env.APP_URL || '').replace(/\/+$/, '');
  if (!base) throw new Error('APP_URL must be set to send documents by WhatsApp');
  return `${base}/api/files/${token}`;
}

export function verifyFileToken(token: string): { kind: StorageKind; name: string } {
  let payload: any;
  try {
    payload = jwt.verify(token, LINK_KEY, { algorithms: ['HS256'] });
  } catch {
    throw notFound('Link expired or invalid');
  }
  if (!KINDS.includes(payload.k) || typeof payload.f !== 'string') throw notFound('Link expired or invalid');
  return { kind: payload.k, name: payload.f };
}
