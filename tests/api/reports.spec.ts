import { test, expect } from '@playwright/test';
import { apiClient, createCustomer, createStock, odfForm, uniqueTag } from './helpers';

test.describe('Reports', () => {
  test('reports count items of multi-item sales and exclude cancelled sales', async () => {
    const api = apiClient();
    await api.login();
    const tag = uniqueTag('R');
    const customer = await createCustomer(api, tag);
    const gold = await createStock(api, `${tag}A`, '11500');
    const silver = await createStock(api, `${tag}B`, '2300', { metalType: 'Argent', fineness: '925', weightGrams: '10' });
    const sale = (await api.post('/api/sales', { customerId: customer.id, paymentMode: 'Cash', items: [{ stockId: gold.id, discountAmount: '1150' }, { stockId: silver.id }] })).data;

    const rows = (await api.get('/api/reports/sales-by-metal')).data.items.filter((i: any) => i.id === sale.sales_id);
    expect.soft(rows, 'both cart items listed').toHaveLength(2);
    expect.soft(rows.some((r: any) => r.metalType === 'Argent' && r.weight === 10), 'second item as silver').toBe(true);
    const vatShare = rows.reduce((s: number, r: any) => s + (r.totalWithVat - r.amount), 0);
    expect.soft(Math.abs(vatShare - 1650), 'item VAT adds up to the sale VAT').toBeLessThan(0.02);
    expect.soft((await api.get('/api/reports/sales-by-metal?metalType=argent')).data.items.every((r: any) => /argent|silver/i.test(r.metalType)), 'metal filter').toBe(true);

    const vat = (await api.get('/api/reports/vat')).data.data.find((r: any) => r.saleId === sale.sales_id);
    expect.soft(vat?.vatAmount, 'VAT report uses the stored VAT').toBe('1650.00');
    const discount = (await api.get('/api/reports/discounts')).data.data.find((r: any) => r.saleId === sale.sales_id);
    expect.soft(discount?.itemBarcode, 'discount report lists every barcode').toContain(', ');
    expect.soft((await api.get('/api/stock/sold')).data.find((i: any) => i.id === silver.id)?.customerName, 'sold items: second item has its customer').toBe(`Client ${tag}`);

    await api.post(`/api/sales/${sale.sales_id}/cancel`);
    expect.soft((await api.get('/api/reports/vat')).data.data.some((r: any) => r.saleId === sale.sales_id), 'cancelled sale left out of VAT').toBe(false);
    expect.soft((await api.get('/api/reports/discounts')).data.data.some((r: any) => r.saleId === sale.sales_id), 'cancelled sale left out of discounts').toBe(false);
  });

  test('trade-in register, dashboard and stock weight', async () => {
    const api = apiClient();
    await api.login();
    const customer = await createCustomer(api, uniqueTag('T'));
    const odf = (await api.post('/api/odf', odfForm(customer.id, [{ description: 'Chaîne', mass: '3.2', fineness: '22K', price: '8000' }]))).data;
    expect((await api.get('/api/reports/tradein')).data.some((r: any) => r.id === odf.id)).toBe(true);
    expect((await api.get('/api/reports/dashboard-summary')).status).toBe(200);
    expect((await api.get('/api/reports/stock-weight')).status).toBe(200);
  });

  test('invalid report filters are a 400', async () => {
    const api = apiClient();
    await api.login();
    expect((await api.get('/api/reports/tradein?startDate=banana')).status).toBe(400);
    expect((await api.get('/api/reports/vat?month=13')).status).toBe(400);
  });

  test('report PDFs', async () => {
    const api = apiClient();
    await api.login();
    for (const path of ['/api/reports/vat/pdf', '/api/reports/tradein/pdf', '/api/reports/sales-by-metal/pdf']) {
      expect.soft((await api.get(path)).type, path).toContain('pdf');
    }
  });
});
