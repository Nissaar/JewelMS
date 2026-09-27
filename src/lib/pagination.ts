import { badRequest } from './errors';

export interface PageRequest {
  page: number;
  pageSize: number;
  offset: number;
}

/** Reads ?page=&pageSize= (1-based page, at most 200 rows per page). */
export function parsePage(query: Record<string, unknown>, defaultSize = 50): PageRequest {
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.pageSize === undefined ? defaultSize : Number(query.pageSize);
  if (!Number.isInteger(page) || page < 1) throw badRequest('page must be a positive integer');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) throw badRequest('pageSize must be between 1 and 200');
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Lists are paged only when the caller asks (?page=): screens that need the
 * whole list (e.g. pickers) keep receiving a plain array.
 */
export const wantsPage = (query: Record<string, unknown>) => query.page !== undefined;

/** Runs a list query either paged ({ items, total, page, pageSize }) or whole (array). */
export async function listResponse<T>(
  query: Record<string, unknown>,
  fetch: (limit?: number, offset?: number) => Promise<T[]>,
  count: () => Promise<number>,
): Promise<Page<T> | T[]> {
  if (!wantsPage(query)) return fetch();
  const { page, pageSize, offset } = parsePage(query);
  const [items, total] = await Promise.all([fetch(pageSize, offset), count()]);
  return { items, total, page, pageSize };
}
