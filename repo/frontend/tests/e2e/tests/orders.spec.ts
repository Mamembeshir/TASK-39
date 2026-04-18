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
// 2. Authenticated customer visiting /checkout sees the "Checkout" heading
//    (CheckoutPage renders PageHeader title="Checkout" regardless of cart state)
// ---------------------------------------------------------------------------
test('authenticated customer visiting /checkout sees Checkout heading', async ({ page }) => {
  await loginAs(page, 'customer_demo', 'devpass123456');

  await page.goto('/checkout');
  await page.waitForLoadState('networkidle');

  // CheckoutPage renders a PageHeader with title="Checkout"
  await expect(page.locator('h1:has-text("Checkout")')).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(`${BASE_URL}/checkout`);
});

// ---------------------------------------------------------------------------
// 3. /orders/<nonexistent-id> shows an error card for authenticated user
// ---------------------------------------------------------------------------
test('order detail for nonexistent id shows error card', async ({ page }) => {
  await loginAs(page, 'customer_demo', 'devpass123456');

  await page.goto('/orders/000000000000000000000000');
  await page.waitForLoadState('networkidle');

  // OrderDetailPage renders "Unable to load order" when the query errors
  await expect(page.locator('h3:has-text("Unable to load order"), text=Unable to load order')).toBeVisible({
    timeout: 15_000,
  });
});

// ---------------------------------------------------------------------------
// 4. Unauthenticated visit to /orders/:id redirects to /login
// ---------------------------------------------------------------------------
test('unauthenticated visit to /orders/:id redirects to /login', async ({ page }) => {
  await page.goto('/orders/000000000000000000000000');
  await page.waitForURL('**/login', { timeout: 10_000 });
  await expect(page).toHaveURL(`${BASE_URL}/login`);
});

// ---------------------------------------------------------------------------
// 5. Authenticated customer visiting /favorites sees the Favorites page
// ---------------------------------------------------------------------------
test('authenticated customer visiting /favorites page loads', async ({ page }) => {
  await loginAs(page, 'customer_demo', 'devpass123456');

  await page.goto('/favorites');
  await page.waitForLoadState('networkidle');

  // FavoritesPage renders with a heading or empty state — URL must be correct
  await expect(page).toHaveURL(`${BASE_URL}/favorites`);
  // Page should not throw a full crash (RouteErrorFallback)
  await expect(page.locator('h1:has-text("Not Found"), h1:has-text("Something went wrong")')).not.toBeVisible();
});
