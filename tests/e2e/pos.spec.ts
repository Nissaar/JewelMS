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
    await page.locator('a[href="/stock"]').click();
    await expect(page).toHaveURL('/stock');

    await page.locator('button:has-text("Ajouter")').click();
    await page.locator('label:has-text("Code-Barres") >> xpath=../..//input').fill(posBarcode);
    await page.locator('input[placeholder="Ex: H-1234"]').fill(`POS_CODE_${Date.now()}`);
    await page.locator('form label:has-text("Catégorie") >> xpath=..//select').first().selectOption('Jewellery');
    await page.locator('input[placeholder="0.00"]').fill('10000.00'); // Rs 10,000
    await page.locator('label:has-text("Poids (Grammes)") >> xpath=../..//input').fill('5.5');
    await page.locator('button[type="submit"]:has-text("Enregistrer")').click();

    // Verify stock created
    await page.locator('input[placeholder="Rechercher par code-barres ou N° de série..."]').fill(posBarcode);
    await page.waitForTimeout(500);
    await expect(page.locator(`tr:has-text("${posBarcode}")`)).toBeVisible();

    // Step 2: Go to POS (Ventes)
    await page.locator('a[href="/sales"]').click();
    await expect(page).toHaveURL('/sales');

    // Scan/Enter barcode
    await page.locator('input[placeholder="Saisir barcode ou catégorie..."]').fill(posBarcode);
    await page.locator('button:has-text("Rechercher")').click();

    // Item should be in the cart
    await expect(page.locator(`tr:has-text("${posBarcode}")`)).toBeVisible();

    // Click "Continuer"
    await page.locator('button:has-text("Continuer")').click();

    // Step 3: Select or Create Customer
    await page.locator('button:has-text("Nouveau Client")').click();
    const customerName = `POS Customer ${Date.now()}`;
    await page.locator('input#customer-name').fill(customerName);
    await page.locator('input#customer-id').fill(`IDPOS_${Date.now()}`);
    await page.locator('button[type="submit"]:has-text("Enregistrer")').click();

    // Step 4: Payment Details
    // Select payment mode
    await page.locator('button:has-text("Cash")').click();

    // Verify total and check finalization button
    await page.locator('button:has-text("Finaliser & Facturer")').click();

    // Step 5: Verify completed checkout
    await expect(page.locator('h2:has-text("Vente Réussie !")')).toBeVisible();

    // Verify PDF actions exist on screen
    await expect(page.locator('p:has-text("Télécharger PDF")')).toBeVisible();
    // No trade-in was linked, so there is no declaration of ownership to print.
    await expect(page.locator('p:has-text("Imprimer Déclaration (Trade-in)")')).toHaveCount(0);

    // Go back to sales
    await page.locator('button:has-text("Nouvelle Vente")').click();
    await expect(page).toHaveURL('/sales');
  });

  test('should block checkout when a cart price is cleared or above the list price', async ({ page, request }) => {
    // Create the item through the API to keep this test about the till.
    const login = await request.post('/api/login', { data: { username: 'admin', password: 'mysecret' } });
    const { token } = await login.json();
    const barcode = `POS_PRICE_${Date.now()}`;
    const created = await request.post('/api/stock', {
      headers: { Authorization: `Bearer ${token}` },
      data: { barcode, category: 'Jewellery', stockType: 'on-display', price: '5000' },
    });
    expect(created.ok()).toBeTruthy();

    await page.locator('a[href="/sales"]').click();
    await page.locator('input[placeholder="Saisir barcode ou catégorie..."]').fill(barcode);
    await page.locator('button:has-text("Rechercher")').click();
    await expect(page.locator(`tr:has-text("${barcode}")`)).toBeVisible();

    const priceInput = page.locator('input[type="number"][step="0.01"]').first();
    const continueButton = page.locator('button:has-text("Continuer")');

    await priceInput.fill('');
    await expect(page.getByRole('alert')).toContainText('prix supérieur à 0');
    await expect(continueButton).toBeDisabled();

    await priceInput.fill('6000');
    await expect(page.getByRole('alert')).toContainText('ne peut pas dépasser');
    await expect(continueButton).toBeDisabled();

    await priceInput.fill('4500');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(continueButton).toBeEnabled();
  });
});
