/**
 * Reads the fields of a Mauritian National Identity Card from OCR text.
 *
 * The card prints each value on the line under its label ("Surname",
 * "First Name", "Date of Birth"); the 14-character ID number starts with the
 * surname's initial followed by the date of birth (DDMMYY), which is used to
 * catch misreads.
 */

export interface IdCardFields {
  surname: string | null;
  firstName: string | null;
  /** "First Surname", ready for the customer's name field. */
  fullName: string | null;
  idNumber: string | null;
  /** ISO date (YYYY-MM-DD) when readable. */
  dateOfBirth: string | null;
  gender: 'M' | 'F' | null;
  /** True when the ID number agrees with the surname initial and date of birth. */
  verified: boolean;
  /** Points a person should double-check before saving. */
  warnings: string[];
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, fev: 2, mar: 3, apr: 4, avr: 4, may: 5, mai: 5, jun: 6, jui: 7, jul: 7,
  aug: 8, aou: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// Labels are matched anywhere in a line (OCR often adds stray marks around them),
// after lower-casing and dropping everything but letters.
const squash = (line: string) => line.toLowerCase().replace(/[^a-z]/g, '');
const isSurnameLabel = (l: string) => squash(l).includes('surname') && !squash(l).includes('birth');
const isFirstNameLabel = (l: string) => /first\s*name/i.test(l);
const isLabel = (l: string) => /surname|first\s*name|gender|date\s*of|birth|signature|id\s*number|republic|national|identity/i.test(l);

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, ch => ch.toUpperCase());

/**
 * Runs of name-like words in a line: capitalised (or all-caps) words of three
 * or more letters, which skips the short stray tokens OCR adds around a value.
 */
function nameRuns(line: string): string[] {
  const runs: string[] = [];
  let current: string[] = [];
  for (const token of line.split(/\s+/)) {
    const word = token.replace(/^[^\p{L}]+|[^\p{L}'-]+$/gu, '');
    if (/^\p{Lu}[\p{Ll}'-]{2,}$/u.test(word) || /^\p{Lu}{3,}$/u.test(word)) current.push(word);
    else if (current.length) { runs.push(current.join(' ')); current = []; }
  }
  if (current.length) runs.push(current.join(' '));
  return runs;
}

/** The text on the label's line after the label, then the next non-label line. */
function valueLines(lines: string[], isThisLabel: (l: string) => boolean): string[] {
  const i = lines.findIndex(isThisLabel);
  if (i === -1) return [];
  const out: string[] = [];
  const after = lines[i].replace(/^.*?(surname|first\s*name)\s*[:.]?/i, '');
  if (after.trim()) out.push(after);
  const next = lines[i + 1];
  if (next && !isLabel(next)) out.push(next);
  return out;
}

/** The best name from the value lines; `initial` (from the ID number) breaks ties. */
function pickName(candidates: string[], initial?: string): string | null {
  const runs = candidates.flatMap(nameRuns).filter(r => !isLabel(r));
  if (runs.length === 0) return null;
  // With the ID initial known, the surname starts at the first word with that letter.
  const preferred = initial
    ? runs.map(r => r.split(' ')).map(words => words.slice(words.findIndex(w => w[0].toUpperCase() === initial)))
        .find(words => words.length > 0 && words[0][0].toUpperCase() === initial)?.join(' ')
    : undefined;
  const best = preferred ?? runs.sort((a, b) => b.length - a.length)[0];
  return titleCase(best);
}

/** Digits OCR commonly misreads as letters. */
const DIGIT_FIXES: Record<string, string> = { O: '0', Q: '0', D: '0', I: '1', L: '1', '|': '1', Z: '2', S: '5', B: '8', G: '6', T: '7' };

/** Candidate ID numbers: a letter then 13 characters (the card prints 14 in all), mostly digits. */
function findIdNumbers(text: string): string[] {
  const out: string[] = [];
  const compact = text.toUpperCase().replace(/[ \t]+/g, '');
  for (const m of compact.matchAll(/[A-Z][0-9OQDILZSBGT|]{12}[0-9A-Z]/g)) {
    const raw = m[0];
    const middle = raw.slice(1, -1).split('').map(ch => DIGIT_FIXES[ch] ?? ch).join('');
    if (/^\d+$/.test(middle)) out.push(raw[0] + middle + raw[raw.length - 1]);
  }
  return out;
}

function parseDate(text: string): { iso: string; ddmmyy: string } | null {
  const m = text.match(/\b(\d{1,2})\s*([A-Za-zéû]{3})[A-Za-zéû]*\.?\s*(\d{4})\b/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 3)];
  const day = Number(m[1]);
  const year = Number(m[3]);
  if (!month || day < 1 || day > 31 || year < 1900) return null;
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return { iso: `${year}-${mm}-${dd}`, ddmmyy: `${dd}${mm}${String(year).slice(2)}` };
}

export function parseMauritianIdText(text: string): IdCardFields {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const warnings: string[] = [];
  const date = parseDate(text);

  const genderMatch = text.match(/(?:^|\s)([MF])\s+\d{1,2}\s*[A-Za-z]{3}[a-z]*\.?\s*\d{4}/m);
  const gender = genderMatch ? (genderMatch[1].toUpperCase() as 'M' | 'F') : null;

  // The ID number is read first: its first letter is the surname's initial.
  const candidates = findIdNumbers(text);
  const byDate = candidates.filter(id => date && id.slice(1, 7) === date.ddmmyy);
  const provisional = byDate[0] ?? candidates[0];

  const surname = pickName(valueLines(lines, isSurnameLabel), provisional?.[0]);
  const firstName = pickName(valueLines(lines, isFirstNameLabel));

  const score = (id: string) =>
    (surname && id[0] === surname[0].toUpperCase() ? 1 : 0) + (date && id.slice(1, 7) === date.ddmmyy ? 2 : 0);
  const idNumber = [...candidates].sort((a, b) => score(b) - score(a))[0] ?? null;
  const verified = !!idNumber && score(idNumber) === 3;

  if (!idNumber) warnings.push("Numéro d'identité non lu.");
  else if (!verified) warnings.push("Vérifiez le numéro d'identité : il ne correspond pas entièrement au nom et à la date de naissance lus.");
  if (!surname) warnings.push('Nom de famille non lu.');
  if (!firstName) warnings.push('Prénom non lu.');

  return {
    surname,
    firstName,
    fullName: [firstName, surname].filter(Boolean).join(' ') || null,
    idNumber,
    dateOfBirth: date?.iso ?? null,
    gender,
    verified,
    warnings,
  };
}

/** How complete a reading is, to pick the best of several attempts (e.g. rotations). */
export const readingScore = (f: IdCardFields) =>
  (f.idNumber ? 2 : 0) + (f.verified ? 3 : 0) + (f.surname ? 1 : 0) + (f.firstName ? 1 : 0) + (f.dateOfBirth ? 1 : 0);
