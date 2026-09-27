import { test, expect } from '@playwright/test';

// A fictitious ID card, drawn in the browser and photographed sideways, so the
// test never needs a real person's document.
const FAKE_CARD = `
<div id="card" style="width:860px;height:540px;padding:36px;box-sizing:border-box;font-family:Arial,sans-serif;
  background:repeating-radial-gradient(circle at 70% 80%,#f7c6cf 0 6px,#fde2e7 6px 12px);transform-origin:top left">
  <div style="color:#1f3a8a;font-weight:bold;font-size:30px">REPUBLIC OF MAURITIUS<br>NATIONAL IDENTITY CARD</div>
  <div style="display:flex;gap:40px;margin-top:24px">
    <div style="width:210px;height:260px;background:#999"></div>
    <div style="font-size:26px;line-height:1.25">
      <div style="color:#dc2626">Surname</div><div>Ramdin</div>
      <div style="color:#dc2626">First Name</div><div>Anjali</div>
      <div style="color:#dc2626">Surname at Birth</div>
      <div style="color:#dc2626">Gender&nbsp;&nbsp;&nbsp;Date of Birth</div><div>F&nbsp;&nbsp;&nbsp;&nbsp;15 Mar 1990</div>
      <div style="color:#dc2626">Signature</div>
    </div>
  </div>
  <div style="color:#dc2626;font-size:22px;margin-top:6px">ID Number</div>
  <div style="font-size:34px;letter-spacing:1px">R1503904200123</div>
</div>`;

test('fills the customer form from a photo of an ID card', async ({ page, context }) => {
  test.setTimeout(120_000);

  // Photograph the fake card, turned sideways like a real phone photo.
  const studio = await context.newPage();
  await studio.setViewportSize({ width: 600, height: 900 });
  await studio.setContent(`<body style="margin:0">${FAKE_CARD}</body>`);
  await studio.locator('#card').evaluate(el => { el.style.transform = 'translateY(860px) rotate(-90deg)'; });
  const photo = await studio.screenshot({ clip: { x: 0, y: 0, width: 540, height: 860 } });
  await studio.close();

  await page.goto('/login');
  await page.getByLabel("Nom d'utilisateur").fill('admin');
  await page.getByLabel('Mot de passe').fill('mysecret');
  await page.locator('button:has-text("Se Connecter")').click();
  await expect(page).toHaveURL('/');

  await page.goto('/odf');
  await page.locator('button:has-text("Nouveau Rachat")').click();
  await page.getByRole('button', { name: 'Nouveau Client' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau client' });

  await dialog.locator('input[type="file"]').setInputFiles({ name: 'id.png', mimeType: 'image/png', buffer: photo });
  await expect(dialog.getByRole('button', { name: "Scanner la carte d'identité" })).toBeEnabled({ timeout: 100_000 });

  await expect(page.locator('#customer-name')).toHaveValue('Anjali Ramdin');
  await expect(page.locator('#customer-id')).toHaveValue('R1503904200123');
  await expect(dialog.getByRole('status')).toContainText('vérifiez-les');
});
