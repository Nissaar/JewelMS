import { test, expect } from '@playwright/test';

test.describe('Point of Sale (POS) Checkout', () => {
  test.beforeEach(async ({ page }) => {
    // Log in before every test
    await page.goto('/login');
    await page.locator('input[placeholder="Nom d\'utilisateur"]').fill('admin');
    await page.locator('input[placeholder="Mot de passe"]').fill('mysecret');
    await page.locator('button:has-text("Se Connecter")').click();
    await expect(page).toHaveURL('/');
  });

  test('should create a stock item, then checkout through POS successfully', async ({ page }) => {
    // Step 1: Create a stock item to sell
    const posBarcode = `POS_BAR_${Date.now()}`;
    await page.locator('span:has-text("Stock")').click();
    await expect(page).toHaveURL('/stock');

    await page.locator('button:has-text("Ajouter")').click();
    await page.locator('label:has-text("Code-Barres") >> xpath=../..//input').fill(posBarcode);
    await page.locator('input[placeholder="Ex: H-1234"]').fill(`POS_CODE_${Date.now()}`);
    await page.locator('select:near(label:has-text("Catégorie"))').selectOption('Jewellery');
    await page.locator('input[placeholder="0.00"]').fill('10000.00'); // Rs 10,000
    await page.locator('label:has-text("Poids (Grammes)") >> xpath=../..//input').fill('5.5');
    await page.locator('button[type="submit"]:has-text("Enregistrer")').click();

    // Verify stock created
    await page.locator('input[placeholder="Rechercher par code-barres ou N° de série..."]').fill(posBarcode);
    await page.waitForTimeout(500);
    await expect(page.locator(`tr:has-text("${posBarcode}")`)).toBeVisible();

    // Step 2: Go to POS (Ventes)
    await page.locator('span:has-text("Ventes")').click();
    await expect(page).toHaveURL('/sales');

    // Scan/Enter barcode
    await page.locator('input[placeholder="Saisir barcode ou catégorie..."]').fill(posBarcode);
    await page.locator('button:has-text("Rechercher")').click();

    // Item should be recognized
    await expect(page.locator(`p:has-text("${posBarcode}")`)).toBeVisible();

    // Click "Continuer"
    await page.locator('button:has-text("Continuer")').click();

    // Step 3: Select or Create Customer
    await page.locator('button:has-text("Nouveau Client")').click();
    const customerName = `POS Customer ${Date.now()}`;
    await page.locator('input#customer-name').fill(customerName);
    await page.locator('input#customer-id').fill(`IDPOS_${Date.now()}`);
    await page.locator('button[type="submit"]:has-text("Enregistrer")').click();

    // Select customer (it should be automatically highlighted/added)
    await page.locator('button:has-text("Valider Client")').click();

    // Step 4: Payment Details
    // Select payment mode
    await page.locator('button:has-text("Cash")').click();

    // Verify total and check finalization button
    await page.locator('button:has-text("Finaliser & Facturer")').click();

    // Step 5: Verify completed checkout
    await expect(page.locator('h2:has-text("Vente Enregistrée!")')).toBeVisible();

    // Verify PDF actions exist on screen
    await expect(page.locator('button:has-text("Reçu (PDF)")')).toBeVisible();
    await expect(page.locator('button:has-text("Déclaration (PDF)")')).toBeVisible();

    // Go back to sales
    await page.locator('button:has-text("Nouvelle Vente")').click();
    await expect(page).toHaveURL('/sales');
  });
});
