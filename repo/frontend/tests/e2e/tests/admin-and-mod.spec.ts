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
// 1. Admin user can access /admin and sees "Admin Console" <h1>.
// ---------------------------------------------------------------------------
test('admin user lands on /admin and sees Admin Console heading', async ({ page }) => {
  await loginAs(page, 'admin_demo', 'devpass123456');

  await page.goto('/admin');
  await page.waitForURL('**/admin');

  await page.locator('h1:has-text("Admin Console")').waitFor({ timeout: 15_000 });
  await expect(page.locator('h1:has-text("Admin Console")')).toBeVisible();
  await expect(page).toHaveURL(`${BASE_URL}/admin`);
});

// ---------------------------------------------------------------------------
// 2. Admin user can access /ops. OpsHomePage renders a PageHeader with
//    title="Ops Console" (an <h1>).
// ---------------------------------------------------------------------------
test('admin user can access /ops and sees Ops Console heading', async ({ page }) => {
  await loginAs(page, 'admin_demo', 'devpass123456');

  await page.goto('/ops');
  await page.waitForURL('**/ops');

  await page.locator('h1:has-text("Ops Console")').waitFor({ timeout: 15_000 });
  await expect(page.locator('h1:has-text("Ops Console")')).toBeVisible();
  await expect(page).toHaveURL(`${BASE_URL}/ops`);
});

// ---------------------------------------------------------------------------
// 3. Admin user can access /mod. ModHomePage renders a PageHeader with
//    title="Moderation Console" (an <h1>).
// ---------------------------------------------------------------------------
test('admin user can access /mod and sees Moderation Console heading', async ({ page }) => {
  await loginAs(page, 'admin_demo', 'devpass123456');

  await page.goto('/mod');
  await page.waitForURL('**/mod');

  await page.locator('h1:has-text("Moderation Console")').waitFor({ timeout: 15_000 });
  await expect(page.locator('h1:has-text("Moderation Console")')).toBeVisible();
  await expect(page).toHaveURL(`${BASE_URL}/mod`);
});

// ---------------------------------------------------------------------------
// 4. Customer accessing /ops is redirected to /catalog (insufficient role).
// ---------------------------------------------------------------------------
test('customer accessing /ops is redirected to /catalog', async ({ page }) => {
  await loginAs(page, 'customer_demo', 'devpass123456');

  await page.goto('/ops');
  await page.waitForURL('**/catalog', { timeout: 15_000 });
  await expect(page).toHaveURL(/\/catalog/);
});

// ---------------------------------------------------------------------------
// 5. Customer accessing /mod is redirected to /catalog (insufficient role).
// ---------------------------------------------------------------------------
test('customer accessing /mod is redirected to /catalog', async ({ page }) => {
  await loginAs(page, 'customer_demo', 'devpass123456');

  await page.goto('/mod');
  await page.waitForURL('**/catalog', { timeout: 15_000 });
  await expect(page).toHaveURL(/\/catalog/);
});
