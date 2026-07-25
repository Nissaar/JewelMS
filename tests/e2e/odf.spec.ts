import { test, expect } from '@playwright/test';

test.describe('Trade-In / ODF Module', () => {
  test.beforeEach(async ({ page }) => {
    // Log in before every test
    await page.goto('/login');
    await page.locator('input[placeholder="Nom d\'utilisateur"]').fill('admin');
    await page.locator('input[placeholder="Mot de passe"]').fill('admin');
    await page.locator('button:has-text("Se Connecter")').click();
    await expect(page).toHaveURL('/');
  });

  test('should create an ODF trade-in record successfully', async ({ page }) => {
    // Go to ODF page
    await page.locator('span:has-text("Trade-ins (ODF)")').click();
    await expect(page).toHaveURL('/odf');

    // Click "Nouveau Rachat"
    await page.locator('button:has-text("Nouveau Rachat")').click();

    // Click on '+' to create a new customer inline
    await page.locator('button[title="Nouveau Client"]').click();

    // Fill customer details in modal
    const customerName = `ODF Customer ${Date.now()}`;
    const customerId = `IDODF${Math.floor(Math.random() * 100000)}`;
    await page.locator('input#customer-name').fill(customerName);
    await page.locator('input#customer-id').fill(customerId);
    await page.locator('button[type="submit"]:has-text("Enregistrer")').click();

    // Verify customer is selected
    await expect(page.locator(`div:has-text("${customerName}")`).first()).toBeVisible();

    // Fill item reservation / repair
    await page.locator('input[placeholder="Bague, Chaîne..."]').fill('Collier Réparé');

    // Fill trade-in item #1
    await page.locator('input[placeholder="Ex: Bracelet, Collier..."]').fill('Vieux Collier Or');
    await page.locator('input[placeholder="0.000"]').fill('15.5');
    await page.locator('input[placeholder="Ex: 22K, 750"]').fill('18K');

    // Set daily gold rate manually
    const rateInput = page.locator('input[step="0.01"]');
    await rateInput.clear();
    await rateInput.fill('3250');

    // Add another item
    await page.locator('button:has-text("Ajouter un article")').click();

    // Fill second item details
    await page.locator('input[placeholder="Ex: Bracelet, Collier..."]').nth(1).fill('Bague Or Cassée');
    await page.locator('input[placeholder="0.000"]').nth(1).fill('5.0');
    await page.locator('input[placeholder="Ex: 22K, 750"]').nth(1).fill('22K');

    // Comments
    await page.locator('textarea[placeholder="Détails supplémentaires..."]').fill('Rachat standard de métaux précieux.');

    // Submit ODF Form
    await page.locator('button[type="submit"]:has-text("Enregistrer le Rachat")').click();

    // Verify success modal pops up
    await expect(page.locator('h2:has-text("Rachat Enregistré!")')).toBeVisible();

    // Click close/return to list button
    await page.locator('button:has-text("Retour à l\'historique")').click();

    // Verify returned to the history table and the transaction is listed
    await expect(page.locator(`tr:has-text("${customerName}")`)).toBeVisible();
  });
});
