import { test, expect } from '@playwright/test';
import { apiClient, createCustomer, uniqueTag } from './helpers';

test.describe('Orders', () => {
  test('finalizing uses the VAT-inclusive price and happens only once', async () => {
    const api = apiClient();
    await api.login();
    const tag = uniqueTag('O');
    const customer = await createCustomer(api, tag);
    const order = await api.post('/api/orders', { customerId: customer.id, itemDescription: 'Bague sur mesure', estimatedPrice: '20000', deposit: '5000' });
    expect(order.status).toBe(201);
    expect((await api.get(`/api/orders/${order.data.id}/pdf`)).type, 'booking receipt').toContain('pdf');

    const fin = await api.post(`/api/orders/${order.data.id}/finalize`, { finalWeight: '4', finalPrice: '23000', paymentMode: 'Cash' });
    expect(fin.status).toBe(200);
    const sale = (await api.get(`/api/sales/history?page=1&q=${encodeURIComponent(`Client ${tag}`)}`)).data.items.find((s: any) => s.id === fin.data.saleId);
    expect(sale.totalAmount, 'net').toBe('20000.00');
    expect(sale.vat15, 'VAT').toBe('3000.00');
    expect((await api.post(`/api/orders/${order.data.id}/finalize`, { finalPrice: '23000', paymentMode: 'Cash' })).status, 'second finalize').toBe(400);
  });

  test('final price must be positive; orders can be searched and deleted', async () => {
    const api = apiClient();
    await api.login();
    const tag = uniqueTag('Z');
    const customer = await createCustomer(api, tag);
    const order = (await api.post('/api/orders', { customerId: customer.id, itemDescription: `Chaîne ${tag}` })).data;
    expect((await api.post(`/api/orders/${order.id}/finalize`, { finalPrice: '0', paymentMode: 'Cash' })).status).toBe(400);
    expect((await api.get(`/api/orders?page=1&q=${tag}`)).data.total).toBe(1);
    expect((await api.get('/api/orders?status=Pending')).data.every((o: any) => o.status === 'Pending')).toBe(true);
    expect((await api.del(`/api/orders/${order.id}`)).status).toBe(200);
  });
});
