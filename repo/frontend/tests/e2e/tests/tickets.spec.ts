import { test, expect } from '@playwright/test';

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

});
