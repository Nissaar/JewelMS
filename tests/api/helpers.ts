import { test } from '@playwright/test';

/** A 1x1 PNG, for photo uploads. */
export const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4560000000049454e44ae426082', 'hex');

export interface Response<T = any> { status: number; data: T; type: string; size: number }

/**
 * Minimal JSON client for the API tests, bound to the project's baseURL.
 * Tests call the real HTTP API of a running server (the CI server, or any
 * URL given with BASE_URL).
 */
export function apiClient() {
  const base = String(test.info().project.use.baseURL).replace(/\/+$/, '');
  let token = '';

  async function call<T = any>(method: string, path: string, body?: unknown, auth: string | null = token): Promise<Response<T>> {
    const isForm = body instanceof FormData;
    const res = await fetch(base + path, {
      method,
      headers: { ...(auth ? { authorization: `Bearer ${auth}` } : {}), ...(body && !isForm ? { 'content-type': 'application/json' } : {}) },
      body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get('content-type') || '';
    let data: any = buf.toString('utf8');
    if (type.includes('json')) { try { data = JSON.parse(data); } catch { /* keep text */ } }
    return { status: res.status, data, type, size: buf.length };
  }

  return {
    base,
    get token() { return token; },
    call,
    get: <T = any>(path: string, auth?: string | null) => call<T>('GET', path, undefined, auth === undefined ? token : auth),
    post: <T = any>(path: string, body?: unknown, auth?: string | null) => call<T>('POST', path, body, auth === undefined ? token : auth),
    put: <T = any>(path: string, body?: unknown) => call<T>('PUT', path, body),
    del: <T = any>(path: string) => call<T>('DELETE', path),
    /** Logs in and keeps the token for later calls. Returns the token. */
    async login(username = 'admin', password = 'mysecret') {
      const r = await call('POST', '/api/login', { username, password }, null);
      if (r.status !== 200) throw new Error(`Login failed for ${username}: ${r.status}`);
      token = r.data.token;
      return token as string;
    },
  };
}

export type ApiClient = ReturnType<typeof apiClient>;

/** A unique tag so records created by one run never collide with another. */
export const uniqueTag = (prefix = 'T') => `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.toUpperCase();

/** Creates a customer and returns it. */
export async function createCustomer(api: ApiClient, tag: string, extra: Record<string, unknown> = {}) {
  const r = await api.post('/api/customers', { name: `Client ${tag}`, idNumber: `ID${tag}`, ...extra });
  if (r.status !== 201) throw new Error(`createCustomer: ${r.status} ${JSON.stringify(r.data)}`);
  return r.data;
}

/** Creates a jewellery stock item and returns it (or the list, for quantity > 1). */
export async function createStock(api: ApiClient, barcode: string, price: string, extra: Record<string, unknown> = {}) {
  const r = await api.post('/api/stock', {
    barcode, itemCode: `C${barcode}`, category: 'Jewellery', subCategory: 'Bague', stockType: 'on-display',
    metalType: 'Or', fineness: '18K', weightGrams: '2.5', price, ...extra,
  });
  if (r.status !== 201) throw new Error(`createStock: ${r.status} ${JSON.stringify(r.data)}`);
  return r.data;
}

/** Multipart body for POST /api/odf. */
export function odfForm(customerId: number, items: unknown[], extra: Record<string, string> = {}, image?: { data: Buffer | string; name: string; type: string }) {
  const fd = new FormData();
  fd.append('customerId', String(customerId));
  fd.append('tradeInItems', JSON.stringify(items));
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  if (image) fd.append('image', new Blob([image.data], { type: image.type }), image.name);
  return fd;
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
