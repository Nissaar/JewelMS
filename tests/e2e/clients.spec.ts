import { test, expect } from '@playwright/test';

test.describe('Client Management (KYC)', () => {
  test.beforeEach(async ({ page }) => {
    // Log in before every test
    await page.goto('/login');
    await page.locator('input[placeholder="Nom d\'utilisateur"]').fill('admin');
    await page.locator('input[placeholder="Mot de passe"]').fill('mysecret');
    await page.locator('button:has-text("Se Connecter")').click();
    await expect(page).toHaveURL('/');
  });

  test('should create, search, and edit a customer successfully', async ({ page }) => {
    // Click on Clients in the sidebar
    await page.locator('span:has-text("Clients")').click();
    await expect(page).toHaveURL('/customers');

    // Click "Ajouter un Client"
    await page.locator('button:has-text("Ajouter un Client")').click();

    // Fill in Customer details
    const testName = `Test Customer ${Date.now()}`;
    const testId = `ID${Math.floor(Math.random() * 10000000)}`;
    const testEmail = `test_${Date.now()}@example.com`;
    const testPhone = '5551234';
    const testAddress = '123 E2E Testing Street';

    await page.locator('input#customer-name').fill(testName);
    await page.locator('input#customer-id').fill(testId);
    await page.locator('input#customer-email').fill(testEmail);
    await page.locator('input#customer-phone').fill(testPhone);
    await page.locator('select#customer-risk').selectOption('Medium');
    await page.locator('textarea#customer-address').fill(testAddress);

    // Submit form
    await page.locator('button[type="submit"]:has-text("Enregistrer")').click();

    // Verify modal is closed
    await expect(page.locator('input#customer-name')).not.toBeVisible();

    // Search for created customer
    await page.locator('input[placeholder="Nom ou N° de Carte..."]').fill(testName);
    await page.waitForTimeout(500); // Wait for debounce

    // Verify search result contains customer name
    await expect(page.locator(`h3:has-text("${testName}")`)).toBeVisible();
    await expect(page.locator(`p:has-text("${testId}")`)).toBeVisible();

    // Click edit button on the customer card
    // Hover or target the card button
    const customerCard = page.locator(`div.group:has(h3:has-text("${testName}"))`);
    await customerCard.hover();
    await customerCard.locator('button:has(svg)').click();

    // Check that values are populated correctly in the form
    await expect(page.locator('input#customer-name')).toHaveValue(testName);
    await expect(page.locator('input#customer-id')).toHaveValue(testId);

    // Edit the risk level and address
    await page.locator('select#customer-risk').selectOption('High');
    await page.locator('textarea#customer-address').fill(testAddress + ' - Edited');

    // Save changes
    await page.locator('button[type="submit"]:has-text("Enregistrer")').click();

    // Verify edit saved by searching and viewing details
    await page.locator('input[placeholder="Nom ou N° de Carte..."]').fill(testName);
    await page.waitForTimeout(500); // Wait for debounce
    await page.locator(`h3:has-text("${testName}")`).click();

    // Verify detail drawer is open and risk level is "High"
    await expect(page.locator('div:has-text("High")').first()).toBeVisible();
  });
});
