import { test, expect } from '@playwright/test';
import { apiClient, createCustomer, createStock, sleep, uniqueTag } from './helpers';

// Runs only where SEND_TESTS=1: the CI server has a fake WhatsApp token and no
// APP_URL, so a send fails before any request leaves the server, and email is
// not configured. Never run this against a server with real credentials.
test.describe('Sending receipts', () => {
  test.skip(process.env.SEND_TESTS !== '1', 'set SEND_TESTS=1 only for a server without real WhatsApp/email credentials');

  test('sends are validated, logged, and their failure reason recorded', async () => {
    const api = apiClient();
    await api.login();
    const tag = uniqueTag('N');
    const customer = await createCustomer(api, tag, { phoneNumber: '5712 3456' });
    const item = await createStock(api, tag, '1150');
    const sale = (await api.post('/api/sales', { customerId: customer.id, paymentMode: 'Cash', items: [{ stockId: item.id }] })).data;

    expect((await api.post(`/api/receipts/${sale.sales_id}/send`, { method: 'sms' })).status, 'unknown method').toBe(400);

    const email = await api.post(`/api/receipts/${sale.sales_id}/send`, { method: 'email' });
    expect(email.status, 'email not configured').toBe(412);
    expect(email.data.error).toBe('CONFIGURATION_MISSING');

    const whatsapp = await api.post(`/api/receipts/${sale.sales_id}/send`, { method: 'whatsapp' });
    expect(whatsapp.status).toBe(200);
    expect(whatsapp.data.notifications[0].status).toBe('pending');
    let log: any[] = [];
    for (let i = 0; i < 10 && log[0]?.status !== 'failed'; i++) {
      await sleep(300);
      log = (await api.get(`/api/notifications?kind=receipt&refId=${sale.sales_id}`)).data;
    }
    expect(log[0].status).toBe('failed');
    expect(log[0].error).toMatch(/APP_URL/);
    expect(log[0].recipient, 'local number gets +230').toBe('23057123456');
  });
});
