import { test, expect } from '@playwright/test';

const PAGES = ['/', '/stock', '/stock/sold', '/customers', '/sales', '/sales-history', '/orders', '/odf', '/reports', '/reports/discounts', '/stock-reports', '/settings', '/audit-logs'];

// A small phone (or a phone with large text): nothing may be cut off or push
// the page sideways. Wide tables scroll inside their own container.
test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });

test('every page fits a small phone screen', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel("Nom d'utilisateur").fill('admin');
  await page.getByLabel('Mot de passe').fill('mysecret');
  await page.locator('button:has-text("Se Connecter")').click();
  await expect(page).toHaveURL('/');

  const problems: string[] = [];
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const cut = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      return [...document.querySelectorAll('main *')]
        .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > width + 1 && !el.closest('.overflow-x-auto'); })
        .slice(0, 3)
        .map(el => `<${el.tagName.toLowerCase()}> "${(el.textContent || '').trim().slice(0, 40)}"`);
    });
    if (cut.length) problems.push(`${path}: ${cut.join(', ')}`);
  }
  expect(problems, problems.join('\n')).toEqual([]);
});

test('the phone menu reaches Déconnexion and closes when tapping beside it', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await page.goto('/login');
  await page.getByLabel("Nom d'utilisateur").fill('admin');
  await page.getByLabel('Mot de passe').fill('mysecret');
  await page.locator('button:has-text("Se Connecter")').click();
  await expect(page).toHaveURL('/');

  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await expect(page.getByRole('button', { name: 'Déconnexion' })).toBeInViewport();
  await page.mouse.click(300, 300);
  await expect(page.getByRole('button', { name: 'Fermer le menu' })).not.toBeInViewport();
});
