import { test, expect } from '@playwright/test';

test.describe('Reports & Archives Module', () => {
  test.beforeEach(async ({ page }) => {
    // Log in before every test
    await page.goto('/login');
    await page.locator('input[placeholder="Nom d\'utilisateur"]').fill('admin');
    await page.locator('input[placeholder="Mot de passe"]').fill('mysecret');
    await page.locator('button:has-text("Se Connecter")').click();
    await expect(page).toHaveURL('/');
  });

  test('should navigate and switch between reports tabs', async ({ page }) => {
    // Go to reports page
    await page.locator('span:has-text("Rapports")').click();
    await expect(page).toHaveURL('/reports');

    // Tab 1: VAT Report (Default)
    await expect(page.locator('button:has-text("Rapport TVA")')).toHaveClass(/bg-white/);
    await expect(page.locator('th:has-text("VAT Amount (TVA 15%)")')).toBeVisible();
    await expect(page.locator('button#export-vat-pdf-btn')).toBeVisible();

    // Tab 2: Archives Factures (Invoice History)
    await page.locator('button:has-text("Archives Factures")').click();
    await expect(page.locator('button:has-text("Archives Factures")')).toHaveClass(/bg-white/);
    await expect(page.locator('input[placeholder="Rechercher par N° Facture ou Client..."]')).toBeVisible();

    // Tab 3: Registre Trade-In (Assay Office)
    await page.locator('button:has-text("Registre Trade-In (Assay Office)")').click();
    await expect(page.locator('button:has-text("Registre Trade-In (Assay Office)")')).toHaveClass(/bg-white/);
    await expect(page.locator('h3:has-text("Registre Physique de Contrôle - Assay Office")')).toBeVisible();
    await expect(page.locator('button#export-tradein-excel-btn')).toBeVisible();
    await expect(page.locator('button#export-tradein-pdf-btn')).toBeVisible();

    // Tab 4: Rapport par Métal (Metal report)
    await page.locator('button:has-text("Rapport par Métal")').click();
    await expect(page.locator('button:has-text("Rapport par Métal")')).toHaveClass(/bg-white/);
    await expect(page.locator('p:has-text("Poids Total Vendu")')).toBeVisible();
    await expect(page.locator('button#export-sales-metal-excel-btn')).toBeVisible();
    await expect(page.locator('button#export-sales-metal-pdf-btn')).toBeVisible();
  });
});
