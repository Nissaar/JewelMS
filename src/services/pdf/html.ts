import { chromium } from 'playwright';
import { declarationPdfFixedHtml } from '../../templates/declarationTemplate';

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
}

export function renderDeclarationTemplate(data: DeclarationTemplateData): string {
  let html = declarationPdfFixedHtml;

  // Replace item loop
  const itemBlockRegex = /\{\{#trade_in_items\}\}([\s\S]*?)\{\{\/trade_in_items\}\}/;
  const match = html.match(itemBlockRegex);
  if (match) {
    const itemTemplate = match[1];
    let itemsHtml = '';
    if (data.trade_in_items && data.trade_in_items.length > 0) {
      itemsHtml = data.trade_in_items.map(item => {
        return itemTemplate
          .replace(/\{\{index\}\}/g, String(item.index))
          .replace(/\{\{description\}\}/g, item.description || '')
          .replace(/\{\{mass\}\}/g, item.mass || '0.000')
          .replace(/\{\{fineness\}\}/g, item.fineness || '');
      }).join('');
    } else {
      itemsHtml = '<tr><td>1</td><td>Article</td><td>0.000</td><td>-</td></tr>';
    }
    html = html.replace(itemBlockRegex, itemsHtml);
  }

  // Replace simple variables
  html = html
    .replace(/\{\{odf_serial\}\}/g, data.odf_serial || '')
    .replace(/\{\{customer_name\}\}/g, data.customer_name || '')
    .replace(/\{\{customer_address\}\}/g, data.customer_address || 'N/A')
    .replace(/\{\{date\}\}/g, data.date || '')
    .replace(/\{\{customer_phone\}\}/g, data.customer_phone || 'N/A')
    .replace(/\{\{customer_nic\}\}/g, data.customer_nic || 'N/A')
    .replace(/\{\{start_date\}\}/g, data.start_date || '')
    .replace(/\{\{end_date\}\}/g, data.end_date || '');

  return html;
}

export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px'
      }
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}
