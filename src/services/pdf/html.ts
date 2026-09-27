import { chromium, type Browser } from 'playwright';
import { declarationPdfFixedHtml } from '../../templates/declarationTemplate';
import { escapeHtml } from '../../lib/html';

interface DeclarationTemplateData {
  odf_serial: string;
  customer_name: string;
  customer_address: string;
  trade_in_items: Array<{
    index: number;
    description: string;
    mass: string;
    fineness: string;
  }>;
  date: string;
  customer_phone: string;
  customer_nic: string;
  start_date: string;
  end_date: string;
  shop_legal_name: string;
  shop_address: string;
}

/**
 * Replaces {{key}} placeholders with HTML-escaped values. A function replacer
 * is used so "$&", "$'" etc. in customer data are inserted literally.
 */
function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, key: string) =>
    key in values ? escapeHtml(values[key]) : placeholder);
}

export function renderDeclarationTemplate(data: DeclarationTemplateData): string {
  const itemBlockRegex = /\{\{#trade_in_items\}\}([\s\S]*?)\{\{\/trade_in_items\}\}/;
  const html = declarationPdfFixedHtml.replace(itemBlockRegex, (_block, itemTemplate: string) =>
    data.trade_in_items.map(item => fill(itemTemplate, {
      index: item.index,
      description: item.description || '',
      mass: item.mass || '0.000',
      fineness: item.fineness || '',
    })).join(''));

  return fill(html, {
    odf_serial: data.odf_serial || '',
    customer_name: data.customer_name || '',
    customer_address: data.customer_address || 'N/A',
    date: data.date || '',
    customer_phone: data.customer_phone || 'N/A',
    customer_nic: data.customer_nic || 'N/A',
    start_date: data.start_date || '',
    end_date: data.end_date || '',
    shop_legal_name: data.shop_legal_name.toUpperCase(),
    shop_address: data.shop_address.toUpperCase(),
  });
}

// --- Shared headless browser ------------------------------------------------

const MAX_CONCURRENT_RENDERS = 2;
const RENDER_TIMEOUT_MS = 20_000;

let browserPromise: Promise<Browser> | null = null;

/** One Chromium for the whole process, relaunched if it crashes or is closed. */
function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true }).then(browser => {
      browser.on('disconnected', () => { browserPromise = null; });
      return browser;
    });
    browserPromise.catch(() => { browserPromise = null; });
  }
  return browserPromise;
}

let active = 0;
const waiting: Array<() => void> = [];

async function withRenderSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT_RENDERS) await new Promise<void>(resolve => waiting.push(resolve));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

/**
 * Renders trusted template HTML to an A4 PDF. The page runs with JavaScript
 * disabled and every network request blocked, so injected markup can't fetch
 * internal URLs or local files.
 */
export function htmlToPdfBuffer(html: string): Promise<Buffer> {
  return withRenderSlot(async () => {
    const browser = await getBrowser();
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      await context.route('**/*', route => route.abort());
      const page = await context.newPage();
      page.setDefaultTimeout(RENDER_TIMEOUT_MS);
      await page.setContent(html, { waitUntil: 'load', timeout: RENDER_TIMEOUT_MS });
      return await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
      });
    } finally {
      await context.close();
    }
  });
}
