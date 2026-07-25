import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should login and logout successfully with correct credentials', async ({ page }) => {
    // Go to login page
    await page.goto('/login');

    // Fill in username and password
    await page.locator('input[placeholder="Nom d\'utilisateur"]').fill('admin');
    await page.locator('input[placeholder="Mot de passe"]').fill('admin');

    // Click Se Connecter
    await page.locator('button:has-text("Se Connecter")').click();

    // Verify redirect to Dashboard (has title or URL check)
    await expect(page).toHaveURL('/');
    
    // Check that Dashboard heading exists
    await expect(page.locator('h1:has-text("Tableau de Bord")')).toBeVisible();

    // Now logout
    await page.locator('button:has-text("Déconnexion")').click();

    // Verify redirected back to login
    await expect(page).toHaveURL('/login');
    await expect(page.locator('input[placeholder="Nom d\'utilisateur"]')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[placeholder="Nom d\'utilisateur"]').fill('invalid_user');
    await page.locator('input[placeholder="Mot de passe"]').fill('wrong_password');
    await page.locator('button:has-text("Se Connecter")').click();

    // Verify error message exists
    await expect(page.locator('div:has-text("Invalid username or password")').first()).toBeVisible();
  });
});
