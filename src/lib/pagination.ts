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
