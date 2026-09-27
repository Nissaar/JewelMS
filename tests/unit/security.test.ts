import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';
import { renderDeclarationTemplate } from '../../src/services/pdf/html';
import { resolveStoredFile, signedFileUrl, sniffImage, verifyFileToken } from '../../src/services/storage';
import { csvCell } from '../../src/lib/csv';
import { numberToWords } from '../../src/services/pdf/common';
import { splitGross, toCents } from '../../src/shared/money';
import { JWT_SECRET } from '../../src/config';

const declaration = (overrides: Partial<Parameters<typeof renderDeclarationTemplate>[0]>) => renderDeclarationTemplate({
  odf_serial: '7', customer_name: 'Name', customer_address: 'Address', date: 'd', customer_phone: 'p', customer_nic: 'n',
  start_date: 's', end_date: 'e', shop_legal_name: 'Shop', shop_address: 'Street',
  trade_in_items: [{ index: 1, description: 'Ring', mass: '1.000', fineness: '18K' }],
  ...overrides,
});

test('declaration PDF: customer data is HTML-escaped', () => {
  const html = declaration({ customer_name: '<iframe src="http://169.254.169.254/">', trade_in_items: [{ index: 1, description: '<img src=file:///etc/passwd>', mass: '1', fineness: '18K' }] });
  expect(html).not.toContain('<iframe');
  expect(html).not.toContain('<img src=file');
  expect(html).toContain('&lt;iframe');
});

test('declaration PDF: $-patterns in data are inserted literally', () => {
  expect(declaration({ customer_address: "Flat $' B $& $$" })).toContain('Flat $&#39; B $&amp; $$');
});

test('signed file links: round-trip, tamper-proof, not interchangeable with login tokens', () => {
  process.env.APP_URL = 'https://shop.example';
  const token = signedFileUrl('receipts', 'abc.pdf').split('/api/files/')[1];
  expect(verifyFileToken(token)).toEqual({ kind: 'receipts', name: 'abc.pdf' });
  expect(() => verifyFileToken(token.slice(0, -2) + 'xx')).toThrow();
  expect(() => verifyFileToken(jwt.sign({ k: 'receipts', f: 'x.pdf' }, JWT_SECRET))).toThrow();
});

test('stored files: paths cannot leave their folder', () => {
  expect(() => resolveStoredFile('receipts', '../../.env')).toThrow();
  expect(resolveStoredFile('receipts', '/uploads/receipts/a.pdf')).toMatch(/uploads[\\/]receipts[\\/]a\.pdf$/);
});

test('uploads: images are recognised by content, not by name', () => {
  expect(sniffImage(Buffer.from('<html>'))).toBeNull();
  expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.contentType).toBe('image/jpeg');
});

test('CSV: every cell is quoted and formulas are neutralised', () => {
  expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  expect(csvCell('-12.5')).toBe('"-12.5"');
  expect(csvCell('a,b')).toBe('"a,b"');
});

test('money: VAT is split per line in whole cents', () => {
  expect(splitGross(toCents('10350'))).toEqual({ grossCents: 1035000, netCents: 900000, vatCents: 135000 });
  expect(toCents('0.1') + toCents('0.2')).toBe(30);
});

test('amount in words works in whole cents', () => {
  expect(numberToWords(1.995)).toBe('Two');
  expect(numberToWords(0.5)).toBe('Zero and Fifty Cents');
  expect(numberToWords(12345.67)).toBe('Twelve Thousand Three Hundred and Forty-Five and Sixty-Seven Cents');
});
