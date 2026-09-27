import { test, expect } from '@playwright/test';
import { apiClient, uniqueTag } from './helpers';

test.describe('Sign-in and sessions', () => {
  test('admin can sign in and read their profile', async () => {
    const api = apiClient();
    await api.login();
    const me = await api.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.data.user.username).toBe('admin');
    expect(Array.isArray(me.data.user.permissions)).toBe(true);
  });

  test('wrong credentials and malformed bodies are a 401', async () => {
    const api = apiClient();
    expect((await api.post('/api/login', { username: 'admin', password: 'wrong-password' }, null)).status).toBe(401);
    expect((await api.post('/api/login', { username: `ghost${Date.now()}`, password: 'x' }, null)).status).toBe(401);
    expect((await api.post('/api/login', { username: { $ne: 1 } }, null)).status).toBe(401);
  });

  test('tokens are accepted only in the Authorization header', async () => {
    const api = apiClient();
    const token = await api.login();
    expect((await api.get('/api/customers', null)).status).toBe(401);
    expect((await api.get(`/api/users?token=${token}`, null)).status).toBe(401);
    expect((await api.get('/api/users', 'not-a-token')).status).toBe(401);
  });
});

test.describe('User management', () => {
  test('creating a user validates input and never returns the password hash', async () => {
    const api = apiClient();
    await api.login();
    const name = `user${uniqueTag().toLowerCase()}`;
    expect((await api.post('/api/users', { username: name, email: `${name}@example.com`, password: 'short' })).status).toBe(400);
    expect((await api.post('/api/users', { username: name, email: `${name}@example.com`, password: 'long-enough-pw', role: 'Root' })).status).toBe(400);
    const created = await api.post('/api/users', { username: name, email: `${name}@example.com`, password: 'long-enough-pw' });
    expect(created.status).toBe(201);
    expect(created.data).not.toHaveProperty('passwordHash');
    expect((await api.post('/api/users', { username: name, email: `x${name}@example.com`, password: 'long-enough-pw' })).status).toBe(400);
  });

  test('role change, logout and password reset end existing sessions', async () => {
    const admin = apiClient();
    await admin.login();
    const name = `user${uniqueTag().toLowerCase()}`;
    const { data: user } = await admin.post('/api/users', { username: name, email: `${name}@example.com`, password: 'long-enough-pw' });

    const clerk = apiClient();
    const first = await clerk.login(name, 'long-enough-pw');
    await admin.put(`/api/users/${user.id}`, { role: 'Admin' });
    expect((await clerk.get('/api/auth/me', first)).status).toBe(401);

    const second = await clerk.login(name, 'long-enough-pw');
    expect((await clerk.get('/api/users', second)).status).toBe(200); // new role applies
    await admin.put(`/api/users/${user.id}`, { role: 'User' });

    const third = await clerk.login(name, 'long-enough-pw');
    expect((await clerk.post('/api/logout', undefined, third)).status).toBe(200);
    expect((await clerk.get('/api/auth/me', third)).status).toBe(401);

    expect((await admin.post(`/api/users/${user.id}/reset-password`, { password: 'brand-new-password' })).status).toBe(200);
    expect((await admin.post('/api/login', { username: name, password: 'long-enough-pw' }, null)).status).toBe(401);
    expect((await admin.post('/api/login', { username: name, password: 'brand-new-password' }, null)).status).toBe(200);
  });

  test('the last admin cannot be demoted', async () => {
    const api = apiClient();
    await api.login();
    const admins = (await api.get('/api/users')).data.filter((u: any) => u.role === 'Admin');
    test.skip(admins.length !== 1, 'only meaningful with a single admin');
    expect((await api.put(`/api/users/${admins[0].id}`, { role: 'User' })).status).toBe(400);
  });
});
