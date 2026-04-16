import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When API_PROXY_TARGET is set (e.g. in the playwright test container), the Vite dev
// server proxies /api/* to the backend service. This lets E2E tests access the API via
// the frontend's own origin without CORS or TLS certificate issues.
const apiProxyTarget = process.env.API_PROXY_TARGET;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: apiProxyTarget
    ? {
        // Docker service hostnames (e.g. frontend-pw) are not in Vite's default
        // allow-list. Allow all hosts so the dev server can be reached by sibling
        // containers via their service name during E2E tests.
        allowedHosts: true,
        proxy: {
          '/api': {
            target: apiProxyTarget,
            changeOrigin: true,
            secure: false,
          },
        },
      }
    : undefined,
  test: {
    environment: 'jsdom',
    setupFiles: [],
    // Restrict Vitest discovery to the unit-test tree. Playwright specs live
    // under tests/e2e/ and must not be picked up by Vitest (different runner).
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Thresholds apply across the broader include set (logic layer + key
      // pages/components). Functions are slightly below lines because pages
      // define several React event handlers that aren't all exercised by the
      // tests we care about verifying (the core flows are covered).
      thresholds: {
        lines: 95,
        functions: 90,
        branches: 85,
        statements: 95,
      },
      // Coverage is measured over the logic layer AND user-facing surfaces
      // that have dedicated unit tests. Page/component coverage is intentionally
      // included so thresholds reflect real UI behaviour, not just APIs.
      include: [
        'src/api/**/*.ts',
        'src/features/**/api/**/*.ts',
        'src/features/**/hooks/**/*.tsx',
        'src/features/**/utils/**/*.ts',
        'src/features/**/lib/**/*.ts',
        'src/features/auth/components/**/*.tsx',
        'src/features/auth/pages/LoginPage.tsx',
        'src/features/auth/pages/RegisterPage.tsx',
        'src/features/tickets/pages/TicketsListPage.tsx',
        'src/features/tickets/pages/TicketCreatePage.tsx',
        'src/features/catalog/pages/CatalogPage.tsx',
        'src/shared/components/RoleGate.tsx',
        'src/shared/components/RouteErrorFallback.tsx',
        'src/shared/lib/**/*.ts',
      ],
      exclude: [
        '**/*.test.*',
        '**/*.spec.*',
        '**/node_modules/**',
        'src/api/types/**',
      ],
    },
  },
});
