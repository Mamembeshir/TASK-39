import { test, expect } from '@playwright/test';

const BASE_URL = 'http://frontend-pw:5173';

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
// /catalog is publicly accessible (no login required)
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
