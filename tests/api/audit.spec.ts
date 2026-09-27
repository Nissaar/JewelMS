import { test, expect } from '@playwright/test';
import { apiClient, createCustomer, sleep, uniqueTag } from './helpers';

test.describe('Audit log', () => {
  test('writes are logged without headers, secrets or customer identity', async () => {
    const api = apiClient();
    await api.login();
    const tag = uniqueTag('A');
    await createCustomer(api, tag, { email: 'audit@example.com' });
    await sleep(300);
    const page = await api.get('/api/audit-logs?page=1&pageSize=20&q=%2Fapi%2Fcustomers');
    expect(page.status).toBe(200);
    expect(page.data.items.length).toBeGreaterThan(0);
    const entry = page.data.items[0];
    expect(entry.details).not.toHaveProperty('headers');
    expect(entry.details.body.name).toBe('[personal data]');
    expect(entry.details.body.idNumber).toBe('[personal data]');
    expect(JSON.stringify((await api.get('/api/audit-logs?page=1&pageSize=200')).data)).not.toContain('mysecret');
  });
});
