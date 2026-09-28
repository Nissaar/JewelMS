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

test('ID card: tolerates OCR slips in the date of birth', () => {
  for (const printed of ['F l5 Mar 199O', 'F 15Mar1990', 'F 15 MAR 1990', 'F 15/03/1990']) {
    const f = parseMauritianIdText(CLEAN.replace('F 15 Mar 1990', printed));
    expect(f.dateOfBirth, printed).toBe('1990-03-15');
    expect(f.verified, printed).toBe(true);
    expect(f.warnings, printed).toEqual([]);
  }
});

test('ID card: reads the month even when a letter is misread as a digit', () => {
  const f = parseMauritianIdText(CLEAN.replace('F 15 Mar 1990', 'F 15 Ju1 1990').replace('R1503904200123', 'R1507904200123'));
  expect(f.dateOfBirth).toBe('1990-07-15');
  expect(f.verified).toBe(true);
});

test('ID card: "Juin" is June, "Juil" is July', () => {
  expect(parseMauritianIdText(CLEAN.replace('15 Mar', '15 Juin')).dateOfBirth).toBe('1990-06-15');
  expect(parseMauritianIdText(CLEAN.replace('15 Mar', '15 Juil')).dateOfBirth).toBe('1990-07-15');
});

test('ID card: an unreadable date of birth is taken from the ID number, without a warning', () => {
  const f = parseMauritianIdText(CLEAN.replace('F 15 Mar 1990', 'F ~~ ### ####'));
  expect(f.dateOfBirth).toBe('1990-03-15');
  expect(f.verified).toBe(true);
  expect(f.warnings).toEqual([]);
});

test('ID card: says which date disagrees with the ID number', () => {
  const f = parseMauritianIdText(CLEAN.replace('15 Mar 1990', '18 Mar 1990'));
  expect(f.verified).toBe(false);
  expect(f.warnings).toEqual(["Vérifiez le numéro d'identité ou la date de naissance : la carte indique le 18/03/1990, le numéro le 15/03/1990."]);
});

test('ID card: says when the surname does not match the ID initial', () => {
  const f = parseMauritianIdText(CLEAN.replace('RAMDIN', 'KAMDIN'));
  expect(f.verified).toBe(false);
  expect(f.warnings).toEqual(['Vérifiez le nom de famille : lu « Kamdin », alors que le numéro commence par R.']);
});
