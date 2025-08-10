// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'https://app.staging.dataflowgroup.com',
    trace: 'on-first-retry',
  },

  projects: [
    // Setup project to authenticate once
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // Main tests that depend on authentication
    {
      name: 'logged-in-tests',
      use: { 
        ...devices['Desktop Chrome'],
        // Use signed-in state from auth.setup.ts
        storageState: 'auth-state.json',
      },
      dependencies: ['setup'],
      testMatch: /create_vr\.spec\.ts/,
    },
  ],
});