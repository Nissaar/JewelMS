import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:3000';
// No local server when testing a deployed site (BASE_URL elsewhere) or when
// only the unit tests run (NO_SERVER=1).
const needsLocalServer = !process.env.NO_SERVER && /localhost|127\.0\.0\.1/.test(baseURL);

export default defineConfig({
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    // In CI, 'github' turns failures into inline annotations on the commit / PR.
    process.env.CI ? ['github'] : ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }]
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'retain-on-failure',
  },
  // One report, grouped by kind of test.
  projects: [
    { name: 'Unit', testDir: './tests/unit', testMatch: /.*\.test\.ts$/ },
    { name: 'Database', testDir: './tests/db', testMatch: /.*\.spec\.ts$/ },
    { name: 'API', testDir: './tests/api', testMatch: /.*\.spec\.ts$/ },
    { name: 'E2E', testDir: './tests/e2e', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: needsLocalServer ? {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  } : undefined,
});
