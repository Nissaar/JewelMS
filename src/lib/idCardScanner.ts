import { createWorker, PSM } from 'tesseract.js';
import { parseMauritianIdText, readingScore, type IdCardFields } from './idCard';

const MAX_SIDE = 2000;
// Photos of a card are often taken sideways: try upright first, then the other ways.
const ROTATIONS = [0, 90, 270, 180] as const;

export type ScanStage = 'loading' | 'reading';

// Below this brightness a pixel is ink. The card's pastel background pattern
// is lighter and drops out; black values and the red labels stay.
const INK_THRESHOLD = 110;

/** The photo as an upright-by-EXIF, downscaled, black-and-white canvas. */
async function prepare(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = image.data;
  for (let i = 0; i < px.length; i += 4) {
    const luminance = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = luminance < INK_THRESHOLD ? 0 : 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function rotate(source: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  if (degrees === 0) return source;
  const quarter = degrees === 90 || degrees === 270;
  const canvas = document.createElement('canvas');
  canvas.width = quarter ? source.height : source.width;
  canvas.height = quarter ? source.width : source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

/**
 * Reads a photo of a Mauritian ID card in the browser. The image never leaves
 * the device: recognition runs locally (only the OCR engine is downloaded).
 */
export async function scanIdCard(file: File, onStage?: (stage: ScanStage) => void): Promise<IdCardFields> {
  onStage?.('loading');
  const [image, worker] = await Promise.all([prepare(file), createWorker('eng')]);
  try {
    // The card's text reads best as one block (the default layout analysis
    // splits it around the photo and background pattern).
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    onStage?.('reading');
    let best: IdCardFields | null = null;
    for (const degrees of ROTATIONS) {
      const { data } = await worker.recognize(rotate(image, degrees));
      const fields = parseMauritianIdText(data.text);
      if (!best || readingScore(fields) > readingScore(best)) best = fields;
      if (fields.verified && fields.surname && fields.firstName) break; // good enough, stop early
    }
    return best!;
  } finally {
    await worker.terminate();
  }
}
