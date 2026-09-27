
export function numberToWords(num: number): string {
  if (!(num > 0)) return 'Zero';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const g = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

  function translate(n: number): string {
    let str = '';
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
      if (n > 0) str += 'and ';
    }
    if (n >= 20) {
      str += b[Math.floor(n / 10)] + (n % 10 > 0 ? '-' + a[n % 10] : '') + ' ';
    } else if (n > 0) {
      str += a[n] + ' ';
    }
    return str;
  }

  // Work in whole cents so 1.995 becomes 2.00, never "One Hundred Cents".
  const totalCents = Math.round(num * 100);
  const integerPart = Math.floor(totalCents / 100);
  const decimalPart = totalCents % 100;

  let word = '';
  let temp = integerPart;
  let groupIndex = 0;

  while (temp > 0) {
    const chunk = temp % 1000;
    if (chunk > 0) {
      const chunkStr = translate(chunk);
      word = chunkStr + (g[groupIndex] ? g[groupIndex] + ' ' : '') + word;
    }
    temp = Math.floor(temp / 1000);
    groupIndex++;
  }

  let finalStr = word.trim() || 'Zero';
  if (decimalPart > 0) {
    finalStr += ' and ' + translate(decimalPart).trim() + ' Cents';
  }

  return finalStr;
}

export async function getPDFBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));
    doc.end();
  });
}

export function addWatermark(doc: PDFKit.PDFDocument, text: string) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    
    doc.save();
    doc.opacity(0.12);
    doc.fontSize(75);
    doc.fillColor('#969696');
    
    const x = doc.page.width / 2;
    const y = doc.page.height / 2;
    
    // Rotate 45 degrees around the center
    doc.rotate(-45, { origin: [x, y] });
    
    // Draw text centered at the origin
    doc.text(text, 0, y - 35, {
      align: 'center',
      width: doc.page.width,
      lineBreak: false
    });
    
    doc.restore();
  }
  // Move back to the last page to ensure doc.end() works as expected
  doc.switchToPage(range.start + range.count - 1);
}
