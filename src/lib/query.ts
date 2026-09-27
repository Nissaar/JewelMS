import { escapeLike } from './sql';

/** A trimmed string query parameter, or '' when absent / not a string. */
export const queryText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** ILIKE pattern matching the text anywhere, with its wildcards escaped. */
export const containsPattern = (text: string) => `%${escapeLike(text)}%`;
