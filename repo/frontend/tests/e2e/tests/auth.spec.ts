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
// 1. Login page renders and submits successfully → lands on /catalog
// ---------------------------------------------------------------------------
test('login page renders and successful login redirects to /catalog', async ({ page }) => {
  await page.goto('/login');
  await page.waitForURL('**/login');

  // Core page elements are present
  await expect(page.locator('#username')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

  // Clear pre-filled defaults and fill with valid credentials
  await page.fill('#username', 'customer_demo');
  await page.fill('#password', 'devpass123456');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/catalog');
  await expect(page).toHaveURL(`${BASE_URL}/catalog`);
});

// ---------------------------------------------------------------------------
// 2. Login with wrong password → shows an error message on the page
// ---------------------------------------------------------------------------
test('login with wrong password shows an error message', async ({ page }) => {
  await page.goto('/login');
  await page.waitForURL('**/login');

  await page.fill('#username', 'customer_demo');
  await page.fill('#password', 'wrongpassword123');
  await page.click('button[type="submit"]');

  // Wait for the error to appear — LoginPage sets error state after API failure
  // and renders a <p class="text-sm text-destructive">{error}</p>
  await expect(page.locator('p.text-destructive')).toBeVisible({ timeout: 10_000 });

  // URL must NOT have changed to /catalog
  await expect(page).toHaveURL(`${BASE_URL}/login`);
});

// ---------------------------------------------------------------------------
// 3. Login with password shorter than 12 chars → shows validation error
//    WITHOUT making a network request
// ---------------------------------------------------------------------------
test('login with short password shows validation error without network request', async ({ page }) => {
  await page.goto('/login');
  await page.waitForURL('**/login');

  // Intercept any POST to the login endpoint — it must never fire
  let loginRequestMade = false;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/auth/login')) {
      loginRequestMade = true;
    }
  });

  await page.fill('#username', 'customer_demo');
  await page.fill('#password', 'short');
  await page.click('button[type="submit"]');

  // Validation error should be shown immediately
  await expect(page.getByText('Password must be at least 12 characters')).toBeVisible();

  // No network call should have been made
  expect(loginRequestMade).toBe(false);

  // URL should still be /login
  await expect(page).toHaveURL(`${BASE_URL}/login`);
});

// ---------------------------------------------------------------------------
// 4. Logout after login → redirected back to /login
// ---------------------------------------------------------------------------
test('logout after login redirects to /login', async ({ page }) => {
  await loginAs(page, 'customer_demo', 'devpass123456');
  await expect(page).toHaveURL(`${BASE_URL}/catalog`);

  // Click the Logout button in the sidebar (desktop layout)
  await page.click('button:has-text("Logout")');

  await page.waitForURL('**/login');
  await expect(page).toHaveURL(`${BASE_URL}/login`);
});

// ---------------------------------------------------------------------------
// 5. Unauthenticated access to /tickets redirects to /login
// ---------------------------------------------------------------------------
test('unauthenticated access to /tickets redirects to /login', async ({ page }) => {
  await page.goto('/tickets');
  await page.waitForURL('**/login');
  await expect(page).toHaveURL(`${BASE_URL}/login`);
});

// ---------------------------------------------------------------------------
// 6. An authenticated user visiting /login still sees the login form.
//    The app does not auto-redirect away — this lets a signed-in user
//    sign in as a different account without first logging out.
// ---------------------------------------------------------------------------
test('authenticated user visiting /login still sees the form', async ({ page }) => {
  await loginAs(page, 'customer_demo', 'devpass123456');
  await expect(page).toHaveURL(`${BASE_URL}/catalog`);

  await page.goto('/login');
  await expect(page.locator('#username')).toBeVisible({ timeout: 10_000 });
});
