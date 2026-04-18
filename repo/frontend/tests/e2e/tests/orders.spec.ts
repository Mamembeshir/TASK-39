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
// 1. Unauthenticated visit to /checkout redirects to /login
// ---------------------------------------------------------------------------
test('unauthenticated visit to /checkout redirects to /login', async ({ page }) => {
  await page.goto('/checkout');
  await page.waitForURL('**/login', { timeout: 10_000 });
  await expect(page).toHaveURL(`${BASE_URL}/login`);
});

// ---------------------------------------------------------------------------
// Unauthenticated visit to /orders/:id redirects to /login
// ---------------------------------------------------------------------------
test('unauthenticated visit to /orders/:id redirects to /login', async ({ page }) => {
  await page.goto('/orders/000000000000000000000000');
  await page.waitForURL('**/login', { timeout: 10_000 });
  await expect(page).toHaveURL(`${BASE_URL}/login`);
});

