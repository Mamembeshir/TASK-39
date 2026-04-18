import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAs(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/catalog');
}

// ---------------------------------------------------------------------------
// Tickets flow
// ---------------------------------------------------------------------------

test.describe('Tickets flow', () => {
  test('1. Unauthenticated visit to /tickets redirects to /login', async ({ page }) => {
    // Navigate directly — no prior auth cookie.
    await page.goto('/tickets');
    await page.waitForLoadState('networkidle');

    // ProtectedRoute redirects unauthenticated visitors to /login.
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('2. Authenticated customer sees tickets list page', async ({ page }) => {
    await loginAs(page, 'customer_demo', 'devpass123456');

    // TicketsListPage is lazy-loaded (React.lazy) and gated by ProtectedRoute
    // which shows <div>Loading...</div> until auth bootstrap finishes.  Wait
    // for the URL to commit and the page to settle, then assert on the h1.
    await page.goto('/tickets');
    await page.waitForURL('**/tickets', { timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Your tickets', level: 1 })).toBeVisible({ timeout: 30_000 });
  });


});
