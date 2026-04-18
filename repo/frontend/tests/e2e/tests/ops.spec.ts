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
  test('5. Moderator can access /mod/reviews and sees "Moderation queue" heading', async ({ page }) => {
    await loginAs(page, 'moderator_demo', 'devpass123456');

    // ModerationQueuePage is lazy-loaded and gated by RoleGate.  Wait for the
    // route to commit and the network to go idle before asserting on the h1.
    await page.goto('/mod/reviews');
    await page.waitForURL('**/mod/reviews', { timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Moderation queue', level: 1 })).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(`${BASE_URL}/mod/reviews`);
  });

  test('6. Customer visiting /mod/reviews is redirected to /catalog', async ({ page }) => {
    await loginAs(page, 'customer_demo', 'devpass123456');

    await page.goto('/mod/reviews');
    // RoleGate sees a non-moderator and redirects via <Navigate to="/app"/>,
    // and /app redirects to /catalog.  Give the auth bootstrap time to finish.
    await page.waitForURL('**/catalog', { timeout: 30_000 });
    await expect(page).toHaveURL(/\/catalog/);
  });

  test('7. Unauthenticated visit to /mod/reviews redirects to /login', async ({ page }) => {
    await page.goto('/mod/reviews');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });
});
