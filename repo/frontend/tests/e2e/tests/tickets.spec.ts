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

    await page.goto('/tickets');
    // TicketsListPage renders "Your tickets" as an h1 for customer roles.
    // Don't wait for networkidle (query may keep retrying) — the h1 renders immediately.
    await expect(page.locator('h1:has-text("Your tickets")')).toBeVisible({ timeout: 20_000 });
  });

  test('3. /tickets/new shows "Open ticket" heading and ticket form', async ({ page }) => {
    await loginAs(page, 'customer_demo', 'devpass123456');

    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');

    // TicketCreatePage renders "Open ticket" as an h1, plus an Order ID input.
    await expect(page.locator('h1:has-text("Open ticket")')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#ticket-order')).toBeVisible({ timeout: 10_000 });
  });

});
