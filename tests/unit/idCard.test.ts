import { test, expect } from '@playwright/test';
import { parseMauritianIdText, readingScore } from '../../src/lib/idCard';

// Fictitious card data, laid out the way OCR returns a Mauritian ID card.
const CLEAN = `
REPUBLIC OF MAURITIUS
NATIONAL IDENTITY CARD
Surname
RAMDIN
First Name
Anjali Devi
Surname at Birth
Gender Date of Birth
F 15 Mar 1990
Signature
ID Number
R1503904200123
`;

test('ID card: reads every field of a clean card', () => {
  const f = parseMauritianIdText(CLEAN);
  expect(f.surname).toBe('Ramdin');
  expect(f.firstName).toBe('Anjali Devi');
  expect(f.fullName).toBe('Anjali Devi Ramdin');
  expect(f.idNumber).toBe('R1503904200123');
  expect(f.dateOfBirth).toBe('1990-03-15');
  expect(f.gender).toBe('F');
  expect(f.verified).toBe(true);
  expect(f.warnings).toEqual([]);
});

test('ID card: fixes letters misread as digits in the ID number', () => {
  const f = parseMauritianIdText(CLEAN.replace('R1503904200123', 'R15O39O42OO1Z3'));
  expect(f.idNumber).toBe('R1503904200123');
  expect(f.verified).toBe(true);
});

test('ID card: accepts spaces inside the ID number', () => {
  const f = parseMauritianIdText(CLEAN.replace('R1503904200123', 'R 150390 4200123'));
  expect(f.idNumber).toBe('R1503904200123');
  expect(f.verified).toBe(true);
});

// The way OCR actually returns a photographed card: stray marks around labels
// and values, a misspelt label, noise between fields.
const NOISY = `
4 A
* REPUBLIC OF MAURITIUS —
/ 0a NATIONAL IDENTITY CARD pus—
’ a Surname
re Yn Ramdin
First Name
Anjali
| y Surname at Birth SE a |
yp Geoder Date of Birth
—-< F 15 Mar 1990
; - Sigrialure
- At
R1503904200123 )
`;

test('ID card: reads a noisy photographed card', () => {
  const f = parseMauritianIdText(NOISY);
  expect(f.surname).toBe('Ramdin');
  expect(f.firstName).toBe('Anjali');
  expect(f.idNumber).toBe('R1503904200123');
  expect(f.dateOfBirth).toBe('1990-03-15');
  expect(f.gender).toBe('F');
  expect(f.verified).toBe(true);
});

test('ID card: uses the ID initial to pick the surname out of noise', () => {
  const f = parseMauritianIdText(NOISY.replace('re Yn Ramdin', 'we Vit Ramdin oo'));
  expect(f.surname).toBe('Ramdin');
});

test('ID card: prefers the candidate matching the surname and date of birth', () => {
  const f = parseMauritianIdText(CLEAN + '\nX9999999999999\n');
  expect(f.idNumber).toBe('R1503904200123');
});

test('ID card: flags an ID number that does not match the other fields', () => {
  const f = parseMauritianIdText(CLEAN.replace('R1503904200123', 'K0101014200123'));
  expect(f.idNumber).toBe('K0101014200123');
  expect(f.verified).toBe(false);
  expect(f.warnings.some(w => w.includes("numéro d'identité"))).toBeTruthy();
});

test('ID card: reads a value printed on the same line as its label', () => {
  const f = parseMauritianIdText(CLEAN.replace('Surname\nRAMDIN', 'Surname RAMDIN'));
  expect(f.surname).toBe('Ramdin');
});

test('ID card: does not mistake the next label for a value', () => {
  const f = parseMauritianIdText(CLEAN.replace('Anjali Devi\n', ''));
  expect(f.firstName).toBe(null);
  expect(f.warnings.includes('Prénom non lu.')).toBeTruthy();
});

test('ID card: text from a sideways photo reads as nothing', () => {
  const f = parseMauritianIdText('Lx e2 ~~ 3ul\n,/ ;; rdsa\n');
  expect(f.idNumber).toBe(null);
  expect(f.fullName).toBe(null);
  expect(readingScore(f) < readingScore(parseMauritianIdText(CLEAN))).toBeTruthy();
});
