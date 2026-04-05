import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  // WSL2: libs exist but aren't on the default linker path
  env: {
    LD_LIBRARY_PATH: '/usr/lib/x86_64-linux-gnu',
    PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS: '1',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] }, // 393x851 — close to real Android
    },
    {
      name: 'iphone-se',
      use: { ...devices['iPhone SE'] }, // 375px — smallest common iOS size
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
