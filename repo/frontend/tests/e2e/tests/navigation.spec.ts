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
// 1. Unauthenticated user visiting /admin is redirected to /login
// ---------------------------------------------------------------------------
test('unauthenticated visit to /admin redirects to /login', async ({ page }) => {
  await page.goto('/admin');
  await page.waitForURL('**/login');
  await expect(page).toHaveURL(`${BASE_URL}/login`);
});

// ---------------------------------------------------------------------------
// 2. Unauthenticated user visiting /ops is redirected to /login
// ---------------------------------------------------------------------------
test('unauthenticated visit to /ops redirects to /login', async ({ page }) => {
  await page.goto('/ops');
  await page.waitForURL('**/login');
  await expect(page).toHaveURL(`${BASE_URL}/login`);
});

// ---------------------------------------------------------------------------
// Admin user can access /admin (page loads, not redirected)
// ---------------------------------------------------------------------------
test('admin user can access /admin', async ({ page }) => {
  await loginAs(page, 'admin_demo', 'devpass123456');
  await expect(page).toHaveURL(`${BASE_URL}/catalog`);

  await page.goto('/admin');
  await page.waitForURL('**/admin');
  await expect(page).toHaveURL(`${BASE_URL}/admin`);

  // Admin Console heading should be visible
  await expect(page.locator('h1:has-text("Admin Console")')).toBeVisible({ timeout: 15_000 });
});

// ---------------------------------------------------------------------------
// 5. /catalog is publicly accessible (no login required)
// ---------------------------------------------------------------------------
test('/catalog is publicly accessible without login', async ({ page }) => {
  await page.goto('/catalog');
  await page.waitForURL('**/catalog');
  await expect(page).toHaveURL(`${BASE_URL}/catalog`);

  // The page should render the Catalog heading (h1), not just the nav link
  await expect(page.locator('h1:has-text("Catalog")')).toBeVisible({ timeout: 15_000 });
});

// ---------------------------------------------------------------------------
// 6. /content is publicly accessible
// ---------------------------------------------------------------------------
test('/content is publicly accessible without login', async ({ page }) => {
  await page.goto('/content');
  await page.waitForURL('**/content');
  await expect(page).toHaveURL(`${BASE_URL}/content`);

  // The page should render the Content heading (h1), not just the nav link
  await expect(page.locator('h1:has-text("Content")')).toBeVisible({ timeout: 15_000 });
});
