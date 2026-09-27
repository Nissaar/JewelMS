import { test, expect } from '@playwright/test';
import { apiClient, createCustomer, createStock, odfForm, PNG, uniqueTag } from './helpers';

const ITEM = [{ description: 'Vieille chaîne', mass: '3.2', fineness: '22K', price: '8000' }];

test.describe('Trade-ins (ODF)', () => {
  test('a file path sent by the client is ignored', async () => {
    const api = apiClient();
    await api.login();
    const customer = await createCustomer(api, uniqueTag('F'));
    const r = await api.post('/api/odf', odfForm(customer.id, ITEM, { fileUrl: '/.env' }));
    expect(r.status).toBe(201);
    expect(r.data.fileUrl).toBeNull();
  });

  test('only real images are accepted, up to 5 MB, and served with a login', async () => {
    const api = apiClient();
    await api.login();
    const customer = await createCustomer(api, uniqueTag('I'));
    const fake = await api.post('/api/odf', odfForm(customer.id, ITEM, {}, { data: '<script>alert(1)</script>', name: 'evil.html', type: 'image/png' }));
    expect(fake.status, 'HTML disguised as PNG').toBe(400);
    const big = await api.post('/api/odf', odfForm(customer.id, ITEM, {}, { data: Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]), name: 'big.png', type: 'image/png' }));
    expect(big.status, 'over 5 MB').toBe(400);
    const ok = await api.post('/api/odf', odfForm(customer.id, ITEM, {}, { data: PNG, name: 'photo.png', type: 'image/png' }));
    expect(ok.status).toBe(201);
    expect((await api.get(ok.data.imageUrl)).type).toBe('image/png');
    expect((await api.get(ok.data.imageUrl, null)).status, 'without login').toBe(401);
  });

  test('ODF PDFs and the declaration of ownership', async () => {
    const api = apiClient();
    await api.login();
    const tag = uniqueTag('W');
    const customer = await createCustomer(api, tag);
    const odf = (await api.post('/api/odf', odfForm(customer.id, ITEM))).data;
    expect((await api.get(`/api/odf/${odf.id}/pdf`)).type).toContain('pdf');
    expect((await api.get(`/api/odf/${odf.id}/declaration-pdf`)).type, 'declaration rendered by Chromium').toContain('pdf');

    const plain = await createStock(api, `${tag}A`, '1000');
    const plainSale = (await api.post('/api/sales', { customerId: customer.id, paymentMode: 'Cash', items: [{ stockId: plain.id }] })).data;
    expect((await api.get(`/api/receipts/${plainSale.sales_id}/declaration-pdf`)).status, 'sale without trade-in').toBe(400);

    const linked = await createStock(api, `${tag}B`, '20000');
    const tradeSale = (await api.post('/api/sales', { customerId: customer.id, paymentMode: 'Cash', linkedOdfId: odf.id, items: [{ stockId: linked.id }] })).data;
    expect((await api.get(`/api/receipts/${tradeSale.sales_id}/declaration-pdf`)).type, 'sale with trade-in').toContain('pdf');
  });

  test('ODF list is searchable and paged', async () => {
    const api = apiClient();
    await api.login();
    const tag = uniqueTag('N');
    const customer = await createCustomer(api, tag);
    await api.post('/api/odf', odfForm(customer.id, ITEM));
    const found = await api.get(`/api/odf?page=1&q=${encodeURIComponent(`Client ${tag}`)}`);
    expect(found.data.total).toBe(1);
    expect(found.data.items[0].tradeInItems).toHaveLength(1);
  });
});
