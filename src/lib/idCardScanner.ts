import { createWorker, PSM, type Worker } from 'tesseract.js';
import { parseMauritianIdTexts, readingScore, type IdCardFields } from './idCard';

// Text on the card reads best when the photo's long side is about this size:
// larger photos are scaled down (speed), smaller ones up (small print).
const TARGET_SIDE = 2000;
// Photos of a card are often taken sideways: try upright first, then the other ways.
const ROTATIONS = [0, 90, 270, 180] as const;

export type ScanStage = 'loading' | 'reading';

/** The photo, upright by EXIF and resized, as grey levels 0-255. */
async function loadGrey(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(2, TARGET_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const px = ctx.getImageData(0, 0, width, height).data;
  const grey = new Uint8ClampedArray(width * height);
  for (let i = 0; i < grey.length; i++) {
    // The darkest channel: black print stays dark, while the card's pastel
    // background pattern (light in at least one channel) fades.
    grey[i] = Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
  }
  return { grey, width, height };
}

/** Stretches the grey levels so the darkest print is black and the card white. */
function stretch(grey: Uint8ClampedArray) {
  const histogram = new Uint32Array(256);
  for (const v of grey) histogram[v]++;
  const cut = grey.length * 0.01;
  let lo = 0, hi = 255, seen = 0;
  while (lo < 255 && (seen += histogram[lo]) < cut) lo++;
  seen = 0;
  while (hi > 0 && (seen += histogram[hi]) < cut) hi--;
  const range = Math.max(1, hi - lo);
  return grey.map(v => ((v - lo) * 255) / range);
}

/** The mean grey level around each pixel, within `radius` pixels (via an integral image). */
function localMean(grey: Uint8ClampedArray, width: number, height: number, radius: number) {
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += grey[y * width + x];
      integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + row;
    }
  }
  const mean = new Float32Array(grey.length);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius), y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius), x1 = Math.min(width, x + radius + 1);
      const sum = integral[y1 * (width + 1) + x1] - integral[y0 * (width + 1) + x1]
        - integral[y1 * (width + 1) + x0] + integral[y0 * (width + 1) + x0];
      mean[y * width + x] = sum / ((x1 - x0) * (y1 - y0));
    }
  }
  return mean;
}

/**
 * Black and white by comparing each pixel with its neighbourhood (Bradley's
 * adaptive threshold): copes with dim light, glare and shadows across the card,
 * where a single cut-off turns whole areas black or white.
 */
function binarize(grey: Uint8ClampedArray, width: number, height: number) {
  const mean = localMean(grey, width, height, Math.max(8, Math.round(Math.max(width, height) / 32)));
  // Ink is clearly darker than its surroundings.
  return grey.map((v, i) => (v < mean[i] * 0.82 ? 0 : 255));
}

/** Sharpens edges (unsharp mask), for photos taken slightly out of focus. */
function sharpen(grey: Uint8ClampedArray, width: number, height: number) {
  const blurred = localMean(grey, width, height, 2);
  return grey.map((v, i) => v + 1.5 * (v - blurred[i]));
}

function toCanvas(values: Uint8ClampedArray, width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(width, height);
  for (let i = 0; i < values.length; i++) {
    image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = values[i];
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function rotate(source: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  if (degrees === 0) return source;
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.width * cos + source.height * sin);
  canvas.height = Math.round(source.width * sin + source.height * cos);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; // corners uncovered by a slight turn
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

// Done when the ID checks out and both names were read with confidence.
const complete = (f: IdCardFields) => f.verified && !!f.surname && !!f.firstName && f.guessed.length === 0;

// Words the engine is unsure of are mostly specks of the background pattern
// read as letters ("Eee", "Rrr"), so names are taken from the sure words
// first, and from the less sure ones only when that leaves a name unread.
// Labels and anything with digits are always kept.
const SURE = 60;
const LOOSE = 30;

async function read(worker: Worker, canvas: HTMLCanvasElement) {
  const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
  if (!data.blocks) return { sure: data.text, loose: data.text };
  const lines = data.blocks.flatMap(b => b.paragraphs.flatMap(p => p.lines));
  const text = (min: number) => lines
    .map(line => line.words
      .filter(w => w.confidence >= min || /\d/.test(w.text) || /surname|first|name|gender|date|birth|number/i.test(w.text))
      .map(w => w.text).join(' '))
    .join('\n');
  return { sure: text(SURE), loose: text(LOOSE) };
}

/**
 * Reads a photo of a Mauritian ID card in the browser. The image never leaves
 * the device: recognition runs locally (only the OCR engine is downloaded).
 *
 * The photo is read in two versions (adaptive black and white, and contrast-
 * stretched grey) and the readings are pooled, so a field misread in one is
 * usually right in the other.
 */
export async function scanIdCard(file: File, onStage?: (stage: ScanStage) => void): Promise<IdCardFields> {
  onStage?.('loading');
  const [{ grey, width, height }, worker] = await Promise.all([loadGrey(file), createWorker('eng')]);
  try {
    // The card's text reads best as one block (the default layout analysis
    // splits it around the photo and background pattern).
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    onStage?.('reading');
    const stretched = stretch(grey);
    const views = [
      () => toCanvas(binarize(stretched, width, height), width, height),
      () => toCanvas(stretched, width, height),
      () => toCanvas(binarize(sharpen(stretched, width, height), width, height), width, height),
    ];

    // 1. Find which way up the card is, on the black-and-white version.
    const first = views[0]();
    let best = { degrees: 0 as number, reading: { sure: '', loose: '' }, fields: null as IdCardFields | null };
    for (const degrees of ROTATIONS) {
      const reading = await read(worker, rotate(first, degrees));
      const fields = parseMauritianIdTexts([reading.sure], [reading.loose]);
      if (!best.fields || readingScore(fields) > readingScore(best.fields)) best = { degrees, reading, fields };
      if (complete(fields)) return fields;
    }

    // 2. Not everything read: read the other versions the same way up, pooling
    //    the readings, until the card is complete.
    const readings = [best.reading];
    let result = best.fields!;
    for (const view of views.slice(1)) {
      readings.push(await read(worker, rotate(view(), best.degrees)));
      const pooled = parseMauritianIdTexts(readings.map(r => r.sure), readings.map(r => r.loose));
      if (readingScore(pooled) >= readingScore(result)) result = pooled;
      if (complete(result)) break;
    }

    // 3. Still incomplete: the card may be held at a slant. Straighten it a
    //    little each way and pool those readings too. When nothing was read at
    //    all, which way up the card is is unknown too: try every way.
    if (complete(result)) return result;
    const ways = readingScore(best.fields!) < 2 ? ROTATIONS : [best.degrees];
    for (const degrees of ways) {
      const tilted = [];
      for (const tilt of [-8, 8]) tilted.push(await read(worker, rotate(first, degrees + tilt)));
      const pool = degrees === best.degrees ? [...readings, ...tilted] : tilted;
      const pooled = parseMauritianIdTexts(pool.map(r => r.sure), pool.map(r => r.loose));
      if (readingScore(pooled) >= readingScore(result)) result = pooled;
      if (complete(result)) break;
    }
    return result;
  } finally {
    await worker.terminate();
  }
}
