import { test, expect } from '@playwright/test';
import { apiClient, createStock, uniqueTag } from './helpers';

test.describe('Stock', () => {
  test('creating an item splits the VAT-inclusive price into net and VAT', async () => {
    const api = apiClient();
    await api.login();
    const item = await createStock(api, uniqueTag('S'), '11500');
    expect(item.price).toBe('11500.00');
    expect(item.priceNet).toBe('10000.00');
    expect(item.priceVat).toBe('1500.00');
    expect(item.status).toBe('Disponible');
  });

  test('several identical pieces get numbered barcodes and item codes', async () => {
    const api = apiClient();
    await api.login();
    const tag = uniqueTag('Q');
    const created = await createStock(api, tag, '2300', { quantity: 2 });
    expect(created.count).toBe(2);
    expect(created.items.map((i: any) => i.barcode)).toEqual([`${tag}-1`, `${tag}-2`]);
  });

  test('clients cannot set status, sold date or ID', async () => {
    const api = apiClient();
    await api.login();
    const item = (await api.post('/api/stock', { barcode: uniqueTag('M'), category: 'Jewellery', stockType: 'on-display', price: '1150', status: 'Vendu', id: 999999 })).data;
    expect(item.status).toBe('Disponible');
    expect(item.id).not.toBe(999999);
    const upd = await api.put(`/api/stock/${item.id}`, { status: 'Vendu', soldAt: '2020-01-01' });
    expect(upd.data.status).toBe('Disponible');
    expect(upd.data.soldAt).toBeNull();
  });

  test('editing without a price keeps the price', async () => {
    const api = apiClient();
    await api.login();
    const item = await createStock(api, uniqueTag('K'), '1150');
    const upd = await api.put(`/api/stock/${item.id}`, { category: 'Jewellery' });
    expect(upd.status).toBe(200);
    expect(upd.data.price).toBe('1150.00');
  });

  test('invalid values and duplicate barcodes are a 400', async () => {
    const api = apiClient();
    await api.login();
    const tag = uniqueTag('D');
    expect((await api.post('/api/stock', { barcode: tag, category: 'Jewellery', stockType: 'on-display', price: 'abc' })).status).toBe(400);
    await createStock(api, tag, '100');
    const dup = await api.post('/api/stock', { barcode: tag, category: 'Jewellery', stockType: 'on-display', price: '100' });
    expect(dup.status).toBe(400);
  });

  test('bulk edit changes the group and treats % literally', async () => {
    const api = apiClient();
    await api.login();
    const tag = uniqueTag('G');
    await createStock(api, tag, '1000', { quantity: 2, itemCode: tag });
    const group = await api.put('/api/stock/bulk-edit', { baseItemCode: tag, stockType: 'in-store' });
    expect(group.data.updated).toBe(2);
    const wildcard = await api.put('/api/stock/bulk-edit', { baseItemCode: '%', price: '1' });
    expect(wildcard.status).toBe(200);
    expect(wildcard.data.updated).toBe(0);
  });

  test('lookup by barcode and autocomplete', async () => {
    const api = apiClient();
    await api.login();
    const tag = uniqueTag('L');
    await createStock(api, tag, '500');
    expect((await api.get(`/api/stock/${tag}`)).status).toBe(200);
    expect((await api.get(`/api/stock/autocomplete?q=${tag}`)).data.length).toBe(1);
  });
});
