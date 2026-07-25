import { test, expect } from '@playwright/test';

test.describe('Stock Management', () => {
  test.beforeEach(async ({ page }) => {
    // Log in before every test
    await page.goto('/login');
    await page.locator('input[placeholder="Nom d\'utilisateur"]').fill('admin');
    await page.locator('input[placeholder="Mot de passe"]').fill('admin');
    await page.locator('button:has-text("Se Connecter")').click();
    await expect(page).toHaveURL('/');
  });

  test('should create, search, and edit a stock item successfully', async ({ page }) => {
    // Click on Stock in the sidebar
    await page.locator('span:has-text("Stock")').click();
    await expect(page).toHaveURL('/stock');

    // Click "Ajouter"
    await page.locator('button:has-text("Ajouter")').click();

    // Fill in Stock item details
    const uniqueBarcode = `BARCODE_${Date.now()}`;
    const uniqueItemCode = `CODE_${Math.floor(Math.random() * 10000)}`;
    const priceValue = '4500.50';
    const weightValue = '12.450';

    // We locate by labels or inputs
    await page.locator('label:has-text("Code-Barres") >> xpath=../..//input').fill(uniqueBarcode);
    await page.locator('input[placeholder="Ex: H-1234"]').fill(uniqueItemCode);
    await page.locator('select:near(label:has-text("Catégorie"))').selectOption('Jewellery');
    await page.locator('input[placeholder="0.00"]').fill(priceValue);

    // Dynamic fields for Jewellery
    await page.locator('label:has-text("Poids (Grammes)") >> xpath=../..//input').fill(weightValue);

    // Select the default options if available
    await page.locator('select:near(label:has-text("Métal"))').selectOption({ index: 0 });
    await page.locator('select:near(label:has-text("Pureté"))').selectOption({ index: 0 });

    // Submit form
    await page.locator('button[type="submit"]:has-text("Enregistrer")').click();

    // Verify redirected back to listing
    await expect(page.locator('input[placeholder="Rechercher par code-barres ou N° de série..."]')).toBeVisible();

    // Search for the newly created item
    await page.locator('input[placeholder="Rechercher par code-barres ou N° de série..."]').fill(uniqueBarcode);
    await page.waitForTimeout(500); // Wait for filter debounce

    // Verify it appears in the table list
    await expect(page.locator(`tr:has-text("${uniqueBarcode}")`)).toBeVisible();
    await expect(page.locator(`tr:has-text("${uniqueItemCode}")`)).toBeVisible();

    // Trigger editing by clicking edit icon on the row
    await page.locator(`tr:has-text("${uniqueBarcode}")`).hover();
    await page.locator(`tr:has-text("${uniqueBarcode}") >> button:has(.lucide-edit2)`).click();

    // Change the price to a higher value
    const updatedPrice = '4999.99';
    await page.locator('input[placeholder="0.00"]').fill(updatedPrice);

    // Submit edits
    await page.locator('button[type="submit"]:has-text("Mettre à jour")').click();

    // Search again and check updated price
    await page.locator('input[placeholder="Rechercher par code-barres ou N° de série..."]').fill(uniqueBarcode);
    await page.waitForTimeout(500); // Debounce
    await expect(page.locator(`tr:has-text("${uniqueBarcode}"):has-text("Rs 4,999.99")`)).toBeVisible();
  });
});
