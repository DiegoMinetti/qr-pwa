import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/playwright',
  timeout: 30_000,
  webServer: {
    command: 'python3 -m http.server 3000',
    port: 3000,
    timeout: 120_000,
    reuseExistingServer: false,
  },
  use: {
    headless: true,
    baseURL: 'http://localhost:3000',
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10_000,
  },
});
