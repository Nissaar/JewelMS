import { test, expect } from '@playwright/test';
import { apiClient } from './helpers';

test.describe('Platform', () => {
  test('health and version endpoints answer', async () => {
    const api = apiClient();
    expect((await api.get('/api/health', null)).status).toBe(200);
    const v = await api.get('/api/version', null);
    expect(v.status).toBe(200);
    expect(typeof v.data.version).toBe('string');
  });

  test('security headers are sent', async () => {
    const res = await fetch(apiClient().base + '/');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    if (process.env.NODE_ENV === 'production') {
      expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    }
  });

  test('uploaded files are not served publicly', async () => {
    const api = apiClient();
    expect((await api.get('/uploads/receipts/x.pdf', null)).status).toBe(404);
    expect((await api.get('/uploads/.gitkeep', null)).status).toBe(404);
  });

  test('unknown API routes return a JSON 404', async () => {
    const r = await apiClient().get('/api/does-not-exist', null);
    expect(r.status).toBe(404);
    expect(r.type).toContain('json');
  });

  test('garbage IDs are a 400, not a server error', async () => {
    const api = apiClient();
    await api.login();
    expect((await api.get('/api/receipts/abc/pdf')).status).toBe(400);
    expect((await api.get('/api/customers/abc/history')).status).toBe(400);
  });
});
