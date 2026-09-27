import { test, expect } from '@playwright/test';
import { apiClient, createCustomer, createStock, uniqueTag } from './helpers';

test.describe('Sales', () => {
  test('prices come from stock and totals are exact to the cent', async () => {
    const api = apiClient();
    await api.login();
    const tag = uniqueTag('V');
    const customer = await createCustomer(api, tag);
    const a = await createStock(api, `${tag}A`, '11500');
    const b = await createStock(api, `${tag}B`, '2300', { metalType: 'Argent', fineness: '925' });
    const sale = await api.post('/api/sales', { customerId: customer.id, paymentMode: 'Cash', items: [{ stockId: a.id, discountAmount: '1150' }, { stockId: b.id }] });
    expect(sale.status).toBe(201);
    // a: 10350 TTC -> 9000.00 net + 1350.00 VAT; b: 2300 -> 2000.00 + 300.00
    expect(sale.data.sale.amount).toBe('11000.00');
    expect(sale.data.sale.vat15).toBe('1650.00');
    expect(sale.data.sale.discountAmount).toBe('1150.00');
  });

  test('invalid carts are rejected', async () => {
    const api = apiClient();
    await api.login();
    const tag = uniqueTag('R');
    const customer = await createCustomer(api, tag);
    const item = await createStock(api, `${tag}A`, '1000');
    const unpriced = await createStock(api, `${tag}N`, '');
    const sell = (items: unknown[], paymentMode = 'Cash') => api.post('/api/sales', { customerId: customer.id, paymentMode, items });
    expect.soft((await sell([{ stockId: item.id, discountAmount: '1000' }])).status, 'discount >= price').toBe(400);
    expect.soft((await sell([{ stockId: item.id, discountAmount: '-5' }])).status, 'negative discount').toBe(400);
    expect.soft((await sell([{ stockId: item.id }, { stockId: item.id }])).status, 'same item twice').toBe(400);
    expect.soft((await sell([{ stockId: unpriced.id }])).status, 'item without a price').toBe(400);
    expect.soft((await sell([{ stockId: item.id }], 'Bitcoin')).status, 'unknown payment mode').toBe(400);
    expect.soft((await sell([])).status, 'empty cart').toBe(400);
  });

  test('a sold item cannot be sold again or deleted; cancelling restores it', async () => {
    const api = apiClient();
    await api.login();
    const tag = uniqueTag('X');
    const customer = await createCustomer(api, tag);
    const item = await createStock(api, tag, '5750');
    const sale = (await api.post('/api/sales', { customerId: customer.id, paymentMode: 'Card', items: [{ stockId: item.id }] })).data;
    expect((await api.post('/api/sales', { customerId: customer.id, paymentMode: 'Cash', items: [{ stockId: item.id }] })).status).toBe(400);
    expect((await api.del(`/api/stock/${item.id}`)).status).toBe(400);
    expect((await api.post(`/api/sales/${sale.sales_id}/cancel`)).status).toBe(200);
    expect((await api.get(`/api/stock/${tag}`)).status).toBe(200);
    expect((await api.post(`/api/sales/${sale.sales_id}/cancel`)).status, 'second cancel').toBe(400);
  });

  test('sales history searches by customer and filters by shop day', async () => {
    const api = apiClient();
    await api.login();
    const tag = uniqueTag('Y');
    const customer = await createCustomer(api, tag);
    const item = await createStock(api, tag, '1000');
    const sale = (await api.post('/api/sales', { customerId: customer.id, paymentMode: 'Cash', items: [{ stockId: item.id }] })).data;
    const byName = await api.get(`/api/sales/history?page=1&q=${encodeURIComponent(`Client ${tag}`)}`);
    expect(byName.data.items.some((s: any) => s.id === sale.sales_id)).toBe(true);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Indian/Mauritius' });
    const byDay = await api.get(`/api/sales/history?page=1&pageSize=200&date=${today}`);
    expect(byDay.data.items.some((s: any) => s.id === sale.sales_id)).toBe(true);
  });

  test('receipt PDF: one receipt per sale, reprints marked COPIE', async () => {
    const api = apiClient();
    await api.login();
    const tag = uniqueTag('P');
    const customer = await createCustomer(api, tag);
    const item = await createStock(api, tag, '1000');
    const sale = (await api.post('/api/sales', { customerId: customer.id, paymentMode: 'Cash', items: [{ stockId: item.id }] })).data;
    const first = await api.get(`/api/receipts/${sale.sales_id}/pdf`);
    const second = await api.get(`/api/receipts/${sale.sales_id}/pdf`);
    expect(first.type).toContain('pdf');
    expect(second.size, 'reprint carries the COPIE watermark').toBeGreaterThan(first.size);
    const receipts = (await api.get('/api/receipts')).data.filter((r: any) => r.saleId === sale.sales_id);
    expect(receipts).toHaveLength(1);
  });
});
