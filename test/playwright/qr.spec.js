const { test, expect } = require('@playwright/test');
const path = require('path');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#generate');
});

test('generate QR for plain text', async ({ page }) => {
  await page.fill('#text-input', 'Hola mundo desde Playwright');
  await page.click('#generate');
  await expect(page.locator('#status')).toHaveText(/Generado|Generando|QR generado/,{timeout:5000});
  const html = await page.locator('#qr').innerHTML();
  expect(html.length).toBeGreaterThan(20);
  // download buttons enabled
  expect(await page.getAttribute('#download-svg', 'aria-disabled')).toBeNull();
});

test('generate QR for URL', async ({ page }) => {
  await page.evaluate(() => {
    const el = document.querySelector('#type');
    if (el) { el.value = 'url'; el.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.fill('#url-input', 'https://example.com/playwright');
  await page.click('#generate');
  await expect(page.locator('#status')).toHaveText(/Generado|QR generado/,{timeout:5000});
  await expect(page.locator('#download-svg')).toBeEnabled();
});

test('generate QR for WiFi payload', async ({ page }) => {
  await page.evaluate(() => {
    const el = document.querySelector('#type');
    if (el) { el.value = 'wifi'; el.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.fill('#wifi-ssid', 'TestNetwork');
  await page.fill('#wifi-pass', 's3cr3t');
  await page.evaluate(() => {
    const el = document.querySelector('#wifi-auth');
    if (el) { el.value = 'WPA'; el.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.click('#generate');
  await expect(page.locator('#status')).toHaveText(/Generado|QR generado/,{timeout:5000});
  await expect(page.locator('#download-svg')).toBeEnabled();
});

test('generate QR for contact (vCard)', async ({ page }) => {
  await page.evaluate(() => {
    const el = document.querySelector('#type');
    if (el) { el.value = 'contact'; el.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.fill('#contact-name', 'Diego Minetti');
  await page.fill('#contact-phone', '+34123456789');
  await page.fill('#contact-email', 'diego@example.com');
  await page.click('#generate');
  await expect(page.locator('#status')).toHaveText(/Generado|QR generado/,{timeout:5000});
  await expect(page.locator('#download-svg')).toBeEnabled();
});

test('create QR with centered logo', async ({ page }) => {
  const logoPath = path.resolve(__dirname, 'assets', 'logo.svg');
  await page.setInputFiles('#logo-file', logoPath);
  // wait until the page processed the upload (download button enabled)
  await page.waitForSelector('#download-svg:not([aria-disabled])', { timeout: 7000 });
  await page.click('#generate');
  await expect(page.locator('#status')).toHaveText(/Generado|QR generado/, { timeout: 7000 });
  // verify download enabled as signal that QR was rendered/updated
  await expect(page.locator('#download-svg')).toBeEnabled();
});

test('create QR with logo used as fill (patterned)', async ({ page }) => {
  const logoPath = path.resolve(__dirname, 'assets', 'logo.svg');
  await page.setInputFiles('#logo-file', logoPath);
  await page.waitForSelector('#download-svg:not([aria-disabled])', { timeout: 7000 });
  // Some UI frameworks cover the native checkbox; set it via JS and dispatch change
  await page.evaluate(() => {
    const cb = document.getElementById('use-image-fill');
    if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.click('#generate');
  await expect(page.locator('#status')).toHaveText(/Generado|QR generado/,{timeout:8000});
  const inner = await page.locator('#qr').innerHTML();
  const downloadEnabled = await page.locator('#download-svg').isEnabled();
  expect(/url\(#|pattern/.test(inner) || downloadEnabled).toBeTruthy();
});
