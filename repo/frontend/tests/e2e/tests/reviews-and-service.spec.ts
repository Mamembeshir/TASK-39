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
// 1. Unauthenticated visit to /catalog renders, and clicking a service card
//    navigates to the /services/:id detail page. The service detail header
//    renders the service title (as an <h3> via CardTitle in
//    ServiceDetailHeader), so we assert on that element once the URL changes.
// ---------------------------------------------------------------------------
test('catalog card navigates to service detail page', async ({ page }) => {
  await page.goto('/catalog');
  // Wait for the catalog heading to be present (PageHeader renders <h1>)
  await page.locator('h1:has-text("Catalog")').waitFor({ timeout: 15_000 });

  // Click the first service link on the catalog page
  const firstServiceLink = page.locator('a[href^="/services/"]').first();
  await firstServiceLink.waitFor({ timeout: 15_000 });
  await firstServiceLink.click();

  // URL should now be under /services/
  await page.waitForURL(/\/services\//, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/services\//);

  // The service title renders inside a CardTitle (<h3>) inside
  // ServiceDetailHeader. We just verify some h3 is visible on the page as
  // a sanity check that the detail page rendered without crashing.
  await page.locator('h3').first().waitFor({ timeout: 15_000 });
});

// ---------------------------------------------------------------------------
// 2. /services/<nonexistent-id> renders a "Service unavailable" fallback
//    card without crashing. The error title is rendered via CardTitle
//    (<h3>) per ServiceDetailPage.tsx.
// ---------------------------------------------------------------------------
test('service detail for nonexistent id shows unavailable fallback', async ({ page }) => {
  await page.goto('/services/nonexistent-service-id-xyz');

  // Assert that the fallback card title is visible
  await page.locator('h3:has-text("Service unavailable")').waitFor({ timeout: 15_000 });
  await expect(page.locator('h3:has-text("Service unavailable")')).toBeVisible();

  // URL should remain on the /services/ route
  await expect(page).toHaveURL(/\/services\/nonexistent-service-id-xyz/);
});
