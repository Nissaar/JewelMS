/** Escapes LIKE / ILIKE wildcards so user text matches literally. */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, ch => `\\${ch}`);
