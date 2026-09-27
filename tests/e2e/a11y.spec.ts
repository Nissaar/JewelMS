import { test, expect } from '@playwright/test';

test.describe('Accessibility basics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel("Nom d'utilisateur").fill('admin');
    await page.getByLabel('Mot de passe').fill('mysecret');
    await page.locator('button:has-text("Se Connecter")').click();
    await expect(page).toHaveURL('/');
  });

  test('page is declared French', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });

  test('dialogs close with Escape and return focus', async ({ page }) => {
    await page.goto('/odf');
    await page.locator('button:has-text("Nouveau Rachat")').click();
    const opener = page.getByRole('button', { name: 'Nouveau Client' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Nouveau client' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test('customer cards open from the keyboard', async ({ page, request }) => {
    const login = await request.post('/api/login', { data: { username: 'admin', password: 'mysecret' } });
    const { token } = await login.json();
    const name = `Keyboard ${Date.now()}`;
    await request.post('/api/customers', { headers: { Authorization: `Bearer ${token}` }, data: { name } });

    await page.goto(`/customers?q=${encodeURIComponent(name)}`);
    const card = page.getByRole('button', { name: `Voir le dossier de ${name}` });
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Dossier client' })).toBeVisible();
  });
});
