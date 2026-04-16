import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  // Run sequentially so concurrent logins don't trip the auth rate limiter.
  workers: 1,
  retries: 1,
  timeout: 45_000,
  use: {
    baseURL: process.env.FRONTEND_URL || 'http://frontend-pw:5173',
    trace: 'on-first-retry',
    // The API base URL inside the browser should match the frontend-pw service origin
    // so that Vite's /api proxy routes all backend calls through the same container.
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
