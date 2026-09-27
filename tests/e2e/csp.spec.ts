import { test, expect } from '@playwright/test';

const PAGES = ['/', '/stock', '/customers', '/sales', '/sales-history', '/stock/sold', '/orders', '/odf', '/reports', '/reports/discounts', '/stock-reports', '/settings', '/audit-logs'];

// Every page loads under the production Content Security Policy.
test('no Content Security Policy violations on any page', async ({ page }) => {
  const res = await page.goto('/login');
  test.skip(!res?.headers()['content-security-policy'], 'no CSP (development server)');

  const violations: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    if (/Content Security Policy|Refused to/i.test(text) && !/report-only/i.test(text)) violations.push(`${page.url()}: ${text}`);
  });

  await page.getByLabel("Nom d'utilisateur").fill('admin');
  await page.getByLabel('Mot de passe').fill('mysecret');
  await page.locator('button:has-text("Se Connecter")').click();
  await expect(page).toHaveURL('/');
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  expect(await page.evaluate(() => document.fonts.check('16px Inter')), 'Google Fonts load').toBeTruthy();
  // Behind Cloudflare, its bot-detection snippet is injected inline into every
  // page (not part of the app) and is correctly blocked; ignore only that.
  const cloudflareSnippet = await page.evaluate(() => document.documentElement.innerHTML.includes('__CF$cv$params'));
  const appViolations = cloudflareSnippet ? violations.filter(v => !/inline script/i.test(v)) : violations;
  expect(appViolations, appViolations.join('\n')).toEqual([]);
});
