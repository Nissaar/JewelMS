import { test, expect } from '@playwright/test';
import { apiClient, createCustomer, odfForm, PNG, uniqueTag } from './helpers';

test.describe('Permissions', () => {
  test('a sales-only user sees only what the till needs', async () => {
    const admin = apiClient();
    await admin.login();
    const tag = uniqueTag('P');
    const customer = await createCustomer(admin, tag);
    const odf = (await admin.post('/api/odf', odfForm(customer.id, [{ description: 'Ring', mass: '1', fineness: '18K' }], {}, { data: PNG, name: 'p.png', type: 'image/png' }))).data;

    const name = `cashier${tag.toLowerCase()}`;
    const { data: user } = await admin.post('/api/users', { username: name, email: `${name}@example.com`, password: 'cashier-password-1' });
    await admin.put(`/api/users/${user.id}/permissions`, { permissions: [{ functionality: 'sales', canCreate: true }] });
    const cashier = apiClient();
    await cashier.login(name, 'cashier-password-1');

    const search = await cashier.get(`/api/search?q=${tag}`);
    expect.soft(search.status).toBe(200);
    expect.soft(search.data.customers, 'search hides customers').toHaveLength(0);
    expect.soft((await admin.get(`/api/search?q=${tag}`)).data.customers.length, 'admin sees them').toBeGreaterThan(0);
    expect.soft((await cashier.get('/api/odf')).status, 'ODF list').toBe(403);
    expect.soft((await cashier.get('/api/orders')).status, 'orders list').toBe(403);
    expect.soft((await cashier.get('/api/sales/history')).status, 'sales history').toBe(403);
    expect.soft((await cashier.get('/api/users')).status, 'admin routes').toBe(403);
    expect.soft((await cashier.get(odf.imageUrl)).status, 'ODF photo').toBe(403);
    expect.soft((await cashier.get(`/api/odf/${odf.id}/pdf`)).status, 'ODF PDF').toBe(403);
    expect.soft((await cashier.get(`/api/customers?search=${tag}`)).status, 'find customers at the till').toBe(200);
    expect.soft((await cashier.get(`/api/stock/autocomplete?q=${tag}`)).status, 'look up stock at the till').toBe(200);
  });

  test('ODF is grantable and unknown permissions are rejected', async () => {
    const admin = apiClient();
    await admin.login();
    const name = `perm${uniqueTag().toLowerCase()}`;
    const { data: user } = await admin.post('/api/users', { username: name, email: `${name}@example.com`, password: 'long-enough-pw' });
    expect((await admin.put(`/api/users/${user.id}/permissions`, { permissions: [{ functionality: 'odf', canView: true }] })).status).toBe(200);
    expect((await admin.put(`/api/users/${user.id}/permissions`, { permissions: [{ functionality: 'hacking', canView: true }] })).status).toBe(400);
  });
});
