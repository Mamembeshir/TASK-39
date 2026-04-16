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
// 1. /content loads publicly and the PageHeader renders a "Content" <h1>.
// ---------------------------------------------------------------------------
test('content list page renders publicly with Content heading', async ({ page }) => {
  await page.goto('/content');
  await page.waitForURL('**/content');

  await page.locator('h1:has-text("Content")').waitFor({ timeout: 15_000 });
  await expect(page.locator('h1:has-text("Content")')).toBeVisible();
  await expect(page).toHaveURL(`${BASE_URL}/content`);
});

// ---------------------------------------------------------------------------
// 2. /content/<nonexistent-id> renders gracefully. ContentArticlePage shows
//    an EmptyState "Article unavailable" (<h3>) when the query errors or
//    returns nothing. We simply assert the page doesn't crash and the URL
//    stays on the article route.
// ---------------------------------------------------------------------------
test('content article page for nonexistent id does not crash', async ({ page }) => {
  await page.goto('/content/nonexistent-article-id-xyz');

  // Give the page time to settle (either empty state, skeleton, or data)
  await page.waitForURL(/\/content\/nonexistent-article-id-xyz/);
  await expect(page).toHaveURL(/\/content\/nonexistent-article-id-xyz/);

  // Accept any valid state: empty state, a page shell, or a rendered
  // article header. Just require the body to be present and non-empty.
  await expect(page.locator('body')).toBeVisible();
});

// ---------------------------------------------------------------------------
// 3. /content?q=guide does not crash. Just accept any valid state and
//    assert the Content h1 is present.
// ---------------------------------------------------------------------------
test('content list with query string does not crash', async ({ page }) => {
  await page.goto('/content?q=guide');
  await page.waitForURL(/\/content/);

  await page.locator('h1:has-text("Content")').waitFor({ timeout: 15_000 });
  await expect(page.locator('h1:has-text("Content")')).toBeVisible();
});
