import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://frontend-pw:5173';

async function loginAs(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.waitForURL('**/login');
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/catalog');
}

// ---------------------------------------------------------------------------
// Customer accessing /mod is redirected to /catalog (insufficient role).
// ---------------------------------------------------------------------------
test('customer accessing /mod is redirected to /catalog', async ({ page }) => {
  await loginAs(page, 'customer_demo', 'devpass123456');

  await page.goto('/mod');
  await page.waitForURL('**/catalog', { timeout: 15_000 });
  await expect(page).toHaveURL(/\/catalog/);
});
