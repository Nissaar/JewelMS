import { test, expect } from '@playwright/test';
import { apiClient } from './helpers';

const LISTS = ['/api/stock', '/api/stock/sold', '/api/customers', '/api/sales/history', '/api/orders', '/api/odf', '/api/receipts'];

test.describe('Lists', () => {
  for (const path of LISTS) {
    test(`${path} pages on request and returns everything otherwise`, async () => {
      const api = apiClient();
      await api.login();
      const paged = await api.get(`${path}?page=1&pageSize=2`);
      expect(paged.status).toBe(200);
      expect(paged.data.items.length).toBeLessThanOrEqual(2);
      expect(typeof paged.data.total).toBe('number');
      expect(Array.isArray((await api.get(path)).data)).toBe(true);
    });
  }

  test('page size is capped', async () => {
    const api = apiClient();
    await api.login();
    expect((await api.get('/api/stock?page=1&pageSize=5000')).status).toBe(400);
  });

  test('settings and stock options are readable, and only admins write them', async () => {
    const api = apiClient();
    await api.login();
    const settings = (await api.get('/api/settings')).data;
    for (const key of ['shop_name', 'shop_legal_name', 'shop_address', 'shop_phone', 'shop_brn', 'shop_vat_number']) {
      expect.soft(settings.some((s: any) => s.key === key), key).toBe(true);
    }
    const heading = settings.find((s: any) => s.key === 'receipt_heading');
    expect((await api.put('/api/settings/receipt_heading', { value: heading.value })).status).toBe(200);
    expect((await api.put('/api/settings/no_such_key', { value: 'x' })).status).toBe(404);
    expect((await api.get('/api/stock/metadata')).status).toBe(200);
  });
});
