import { test } from 'node:test';
import assert from 'node:assert/strict';
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

test('reads every field of a clean card', () => {
  const f = parseMauritianIdText(CLEAN);
  assert.equal(f.surname, 'Ramdin');
  assert.equal(f.firstName, 'Anjali Devi');
  assert.equal(f.fullName, 'Anjali Devi Ramdin');
  assert.equal(f.idNumber, 'R1503904200123');
  assert.equal(f.dateOfBirth, '1990-03-15');
  assert.equal(f.gender, 'F');
  assert.equal(f.verified, true);
  assert.deepEqual(f.warnings, []);
});

test('fixes letters misread as digits in the ID number', () => {
  const f = parseMauritianIdText(CLEAN.replace('R1503904200123', 'R15O39O42OO1Z3'));
  assert.equal(f.idNumber, 'R1503904200123');
  assert.equal(f.verified, true);
});

test('accepts spaces inside the ID number', () => {
  const f = parseMauritianIdText(CLEAN.replace('R1503904200123', 'R 150390 4200123'));
  assert.equal(f.idNumber, 'R1503904200123');
  assert.equal(f.verified, true);
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

test('reads a noisy photographed card', () => {
  const f = parseMauritianIdText(NOISY);
  assert.equal(f.surname, 'Ramdin');
  assert.equal(f.firstName, 'Anjali');
  assert.equal(f.idNumber, 'R1503904200123');
  assert.equal(f.dateOfBirth, '1990-03-15');
  assert.equal(f.gender, 'F');
  assert.equal(f.verified, true);
});

test('uses the ID initial to pick the surname out of noise', () => {
  const f = parseMauritianIdText(NOISY.replace('re Yn Ramdin', 'we Vit Ramdin oo'));
  assert.equal(f.surname, 'Ramdin');
});

test('prefers the candidate matching the surname and date of birth', () => {
  const f = parseMauritianIdText(CLEAN + '\nX9999999999999\n');
  assert.equal(f.idNumber, 'R1503904200123');
});

test('flags an ID number that does not match the other fields', () => {
  const f = parseMauritianIdText(CLEAN.replace('R1503904200123', 'K0101014200123'));
  assert.equal(f.idNumber, 'K0101014200123');
  assert.equal(f.verified, false);
  assert.ok(f.warnings.some(w => w.includes("numéro d'identité")));
});

test('reads a value printed on the same line as its label', () => {
  const f = parseMauritianIdText(CLEAN.replace('Surname\nRAMDIN', 'Surname RAMDIN'));
  assert.equal(f.surname, 'Ramdin');
});

test('does not mistake the next label for a value', () => {
  const f = parseMauritianIdText(CLEAN.replace('Anjali Devi\n', ''));
  assert.equal(f.firstName, null);
  assert.ok(f.warnings.includes('Prénom non lu.'));
});

test('text from a sideways photo reads as nothing', () => {
  const f = parseMauritianIdText('Lx e2 ~~ 3ul\n,/ ;; rdsa\n');
  assert.equal(f.idNumber, null);
  assert.equal(f.fullName, null);
  assert.ok(readingScore(f) < readingScore(parseMauritianIdText(CLEAN)));
});
