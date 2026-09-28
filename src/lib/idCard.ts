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
  /** Names taken from uncertain OCR words only. */
  guessed: ('surname' | 'firstName')[];
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, fev: 2, mar: 3, apr: 4, avr: 4, may: 5, mai: 5, jun: 6, jul: 7,
  aug: 8, aou: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Month number from its (possibly OCR-garbled) name: "Jul", "JUL", "Ju1", "Juil", "Juin"... */
function monthNumber(name: string): number | undefined {
  const m = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/1/g, 'l').replace(/0/g, 'o');
  if (m.startsWith('juin')) return 6;
  if (m.startsWith('jui')) return 7;
  return MONTHS[m.slice(0, 3)];
}

// Labels are matched anywhere in a line (OCR often adds stray marks around them),
// after lower-casing and dropping everything but letters.
const squash = (line: string) => line.toLowerCase().replace(/[^a-z]/g, '');
const isSurnameLabel = (l: string) => squash(l).includes('surname') && !squash(l).includes('birth');
const isFirstNameLabel = (l: string) => /first\s*name/i.test(l);
const isLabel = (l: string) => /surname|first\s*name|gender|date\s*of|birth|signature|id\s*number|republic|national|identity/i.test(l);

// Words printed on every card, never part of a name (left over when OCR
// misreads the rest of a label: "First" lost, "Name" kept).
const CARD_WORDS = /^(surname|first|name|gender|date|birth|signature|number|republic|mauritius|national|identity|card)$/i;

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
    const nameLike = /^\p{Lu}[\p{Ll}'-]{2,}$/u.test(word) || /^\p{Lu}{3,}$/u.test(word);
    if (nameLike && !CARD_WORDS.test(word)) current.push(word);
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

interface ReadDate { iso: string; ddmmyy: string }

function toDate(day: number, month: number | undefined, year: number): ReadDate | null {
  if (!month || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return { iso: `${year}-${mm}-${dd}`, ddmmyy: `${dd}${mm}${String(year).slice(2)}` };
}

/** Digits in a date as OCR tends to misread them ("l3", "2O00"). */
const fixDigits = (s: string) => s.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/S/g, '5').replace(/B/g, '8');

/** Every date in the text: "13 Jul 2000" (tolerating OCR slips) or "13/07/2000". */
function findDates(text: string): ReadDate[] {
  const out: ReadDate[] = [];
  for (const m of text.matchAll(/(?<![\p{L}\d])([\dOoIl|]{1,2})\s*([A-Za-zéû][A-Za-zéû10]{2}[A-Za-zéû]*)\.?\s*([\dOoIlSB]{4})(?![\p{L}\d])/gu)) {
    const date = toDate(Number(fixDigits(m[1])), monthNumber(m[2]), Number(fixDigits(m[3])));
    if (date) out.push(date);
  }
  for (const m of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g)) {
    const date = toDate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (date) out.push(date);
  }
  return out;
}

/** The date of birth encoded in an ID number (characters 2-7, DDMMYY). */
function dateInId(id: string): ReadDate | null {
  const [dd, mm, yy] = [id.slice(1, 3), id.slice(3, 5), id.slice(5, 7)].map(Number);
  const thisYear = new Date().getFullYear() % 100;
  return toDate(dd, mm, (yy > thisYear ? 1900 : 2000) + yy);
}

const showDate = (d: ReadDate) => d.iso.split('-').reverse().join('/');

/** What one OCR text offers: every candidate value, before choosing. */
function extract(text: string) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const dates = findDates(text);
  const ids = findIdNumbers(text);
  const genderMatch = text.match(/(?:^|\s)([MF])\s+\d{1,2}\s*[A-Za-z]{3}[a-z]*\.?\s*\d{4}/m);
  // The surname starts with the ID number's first letter: use it to pick the right words.
  const initial = (ids.find(id => dates.some(d => d.ddmmyy === id.slice(1, 7))) ?? ids[0])?.[0];
  let surname = pickName(valueLines(lines, isSurnameLabel), initial);
  let firstName = pickName(valueLines(lines, isFirstNameLabel));

  // A misread label ("Surnarne", "/ tt"): the surname is still the name that
  // starts with the ID's initial, and the first name is printed just below it.
  const surnameLine = surname ? lines.findIndex(l => l.toLowerCase().includes(surname!.split(' ')[0].toLowerCase())) : -1;
  if (!surname && initial) {
    const i = lines.findIndex(l => !isLabel(l) && nameRuns(l).some(r => r[0].toUpperCase() === initial));
    if (i >= 0) surname = pickName([lines[i]], initial);
  }
  if (!firstName && surname) {
    const i = surnameLine >= 0 ? surnameLine : lines.findIndex(l => l.toLowerCase().includes(surname!.split(' ')[0].toLowerCase()));
    const below = lines.slice(i + 1, i + 3).find(l => !isLabel(l) && nameRuns(l).length > 0);
    if (i >= 0 && below) firstName = pickName([below]);
  }

  return {
    dates,
    ids,
    gender: genderMatch ? (genderMatch[1].toUpperCase() as 'M' | 'F') : null,
    surname,
    firstName,
  };
}

/** Values ordered from most to least often read. */
function byVotes<T>(values: (T | null)[], key: (v: T) => string = String): T[] {
  const counts = new Map<string, { value: T; n: number }>();
  for (const v of values) {
    if (v === null) continue;
    const k = key(v);
    counts.set(k, { value: v, n: (counts.get(k)?.n ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).map(c => c.value);
}

export function parseMauritianIdText(text: string): IdCardFields {
  return parseMauritianIdTexts([text]);
}

/**
 * Reads the card from one or more OCR texts of the same photo (e.g. prepared
 * in different ways). Each field is the value read most often, and the ID
 * number the one that best agrees with the surname and date of birth.
 * `fallbackTexts` (less certain readings) supply a name only when `texts`
 * give none; their ID numbers and dates count, since those are cross-checked.
 */
export function parseMauritianIdTexts(texts: string[], fallbackTexts: string[] = []): IdCardFields {
  const reads = texts.map(extract);
  const fallback = fallbackTexts.map(extract);
  const all = [...reads, ...fallback];
  const warnings: string[] = [];
  const dates = all.flatMap(r => r.dates);
  const guessed: IdCardFields['guessed'] = [];
  const vote = <K extends 'surname' | 'firstName' | 'gender'>(key: K) => {
    const sure = byVotes(reads.map(r => r[key]));
    if (sure.length) return sure;
    const unsure = byVotes(fallback.map(r => r[key]));
    if (unsure.length && key !== 'gender') guessed.push(key as 'surname' | 'firstName');
    return unsure;
  };
  const surnames = vote('surname');
  const firstName = vote('firstName')[0] ?? null;
  // Three letters or fewer is more often a fragment of the background read
  // as a word ("Leh", "Ene") than a name: ask for a check.
  const short = (name: string | null) => !!name && name.replace(/[^\p{L}]/gu, '').length < 4;
  if (short(firstName) && !guessed.includes('firstName')) guessed.push('firstName');
  const gender = vote('gender')[0] ?? null;

  const matchesADate = (id: string) => dates.some(d => d.ddmmyy === id.slice(1, 7));
  const initialFits = (id: string) => surnames.some(s => s[0].toUpperCase() === id[0]);
  const score = (id: string) => (initialFits(id) ? 1 : 0) + (matchesADate(id) ? 2 : dateInId(id) ? 1 : 0);
  // Ties go to the number read most often.
  const idNumber = byVotes(all.flatMap(r => r.ids)).sort((a, b) => score(b) - score(a))[0] ?? null;

  const surname = (idNumber && surnames.find(s => s[0].toUpperCase() === idNumber[0])) || surnames[0] || null;
  if (short(surname) && !guessed.includes('surname')) guessed.push('surname');
  const initialOk = !!idNumber && !!surname && idNumber[0] === surname[0].toUpperCase();

  // The date printed on the card, preferring the one that agrees with the ID.
  const printed = (idNumber && dates.find(d => d.ddmmyy === idNumber.slice(1, 7))) || byVotes(dates, d => d.iso)[0] || null;
  const encoded = idNumber ? dateInId(idNumber) : null;
  const date = printed ?? encoded;
  const dateOk = !!idNumber && !!encoded && (!printed || printed.ddmmyy === idNumber.slice(1, 7));
  const verified = initialOk && dateOk;

  if (!idNumber) warnings.push("Numéro d'identité non lu.");
  else {
    if (!encoded) warnings.push(`Vérifiez le numéro d'identité : « ${idNumber.slice(1, 7)} » n'est pas une date de naissance valide.`);
    else if (printed && !dateOk) warnings.push(`Vérifiez le numéro d'identité ou la date de naissance : la carte indique le ${showDate(printed)}, le numéro le ${showDate(encoded)}.`);
    if (surname && !initialOk) warnings.push(`Vérifiez le nom de famille : lu « ${surname} », alors que le numéro commence par ${idNumber[0]}.`);
  }
  if (!surname) warnings.push('Nom de famille non lu.');
  else if (guessed.includes('surname')) warnings.push('Nom de famille incertain : vérifiez-le.');
  if (!firstName) warnings.push('Prénom non lu.');
  else if (guessed.includes('firstName')) warnings.push('Prénom incertain : vérifiez-le.');

  return {
    surname,
    firstName,
    fullName: [firstName, surname].filter(Boolean).join(' ') || null,
    idNumber,
    dateOfBirth: date?.iso ?? null,
    gender,
    verified,
    warnings,
    guessed,
  };
}

/** How complete a reading is, to pick the best of several attempts (e.g. rotations). */
export const readingScore = (f: IdCardFields) =>
  (f.idNumber ? 2 : 0) + (f.verified ? 3 : 0) + (f.surname ? 1 : 0) + (f.firstName ? 1 : 0) + (f.dateOfBirth ? 1 : 0)
  - f.guessed.length / 2;
