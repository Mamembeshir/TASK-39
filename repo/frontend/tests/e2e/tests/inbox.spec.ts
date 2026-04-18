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
// 1. Unauthenticated visit to /inbox redirects to /login
// ---------------------------------------------------------------------------
test('unauthenticated visit to /inbox redirects to /login', async ({ page }) => {
  await page.goto('/inbox');
  await page.waitForURL('**/login', { timeout: 10_000 });
  await expect(page).toHaveURL(`${BASE_URL}/login`);
});

// ---------------------------------------------------------------------------
// 2. Authenticated customer sees the Inbox page with "Inbox" heading
// ---------------------------------------------------------------------------
test('authenticated customer sees inbox page with Inbox heading', async ({ page }) => {
  await loginAs(page, 'customer_demo', 'devpass123456');

  await page.goto('/inbox');
  await page.waitForLoadState('networkidle');

  // InboxPage renders a PageHeader with title="Inbox"
  await expect(page.locator('h1:has-text("Inbox")')).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(`${BASE_URL}/inbox`);
});

