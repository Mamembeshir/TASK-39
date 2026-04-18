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
// Ops pages (service_manager / administrator role required)
// ---------------------------------------------------------------------------

test.describe('Ops Catalog Setup page', () => {
  test('4. Customer visiting /ops/catalog is redirected to /catalog', async ({ page }) => {
    await loginAs(page, 'customer_demo', 'devpass123456');

    await page.goto('/ops/catalog');
    await page.waitForURL('**/catalog', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/catalog/);
  });
});

test.describe('Moderation queue page', () => {
  test('7. Unauthenticated visit to /mod/reviews redirects to /login', async ({ page }) => {
    await page.goto('/mod/reviews');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });
});
