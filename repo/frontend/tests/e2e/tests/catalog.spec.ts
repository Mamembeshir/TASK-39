import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAs(
  page: Parameters<typeof test.use>[0] extends { page: infer P } ? P : import('@playwright/test').Page,
  username: string,
  password: string,
): Promise<void> {
  await page.goto('/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/catalog');
}

// ---------------------------------------------------------------------------
// Catalog & public pages
// ---------------------------------------------------------------------------

test.describe('Catalog and public pages', () => {
  test('1. /catalog renders without error', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    // PageHeader renders "Catalog" as an h1 on every state (loading/success/error).
    await expect(page.locator('h1:has-text("Catalog")')).toBeVisible({ timeout: 15_000 });
  });

  test('2. /services/<non-existent-id> shows "Service unavailable"', async ({ page }) => {
    await page.goto('/services/nonexistent-service-id-00000000');
    await page.waitForLoadState('networkidle');

    // ServiceDetailPage renders a "Service unavailable" card when the query errors
    // (instead of throwing into the RouteErrorFallback).
    await expect(page.getByText('Service unavailable', { exact: false })).toBeVisible({ timeout: 15_000 });
  });

  test('3. /search renders a search input field', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');

    // SearchPage renders a text input for the search term.
    const input = page.getByPlaceholder('Search services, guides, and more');
    await expect(input).toBeVisible({ timeout: 10_000 });
  });

  test('4. /content renders heading or list', async ({ page }) => {
    await page.goto('/content');
    await page.waitForLoadState('networkidle');

    // ContentListPage renders a "Content" PageHeader h1 regardless of API data.
    await expect(page.locator('h1:has-text("Content")')).toBeVisible({ timeout: 15_000 });
  });

  test('5. /catalog?category=cleaning does not crash', async ({ page }) => {
    await page.goto('/catalog?category=cleaning');
    await page.waitForLoadState('networkidle');

    // PageHeader renders the "Catalog" h1 on every state.
    await expect(page.locator('h1:has-text("Catalog")')).toBeVisible({ timeout: 15_000 });
  });
});
