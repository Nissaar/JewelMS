import { test, expect } from '@playwright/test';
import { apiClient, createCustomer, uniqueTag } from './helpers';

test.describe('Customers (KYC)', () => {
  test('create, validate and update a customer', async () => {
    const api = apiClient();
    await api.login();
    const tag = uniqueTag('C');
    const customer = await createCustomer(api, tag, { email: 'client@example.com', address: 'Port Louis' });
    expect((await api.post('/api/customers', { name: 'Dup', idNumber: `ID${tag}` })).status, 'duplicate ID number').toBe(400);
    expect((await api.post('/api/customers', { name: 'Bad', email: 'not-an-email' })).status, 'invalid email').toBe(400);
    const upd = await api.put(`/api/customers/${customer.id}`, { address: 'Curepipe' });
    expect(upd.data.address).toBe('Curepipe');
    expect(upd.data.email, 'partial update keeps other fields').toBe('client@example.com');
  });

  test('search and history', async () => {
    const api = apiClient();
    await api.login();
    const tag = uniqueTag('H');
    const customer = await createCustomer(api, tag);
    const found = await api.get(`/api/customers?page=1&q=${tag}`);
    expect(found.data.total).toBe(1);
    expect(found.data.items[0].id).toBe(customer.id);
    const history = await api.get(`/api/customers/${customer.id}/history`);
    expect(history.status).toBe(200);
  });
});
