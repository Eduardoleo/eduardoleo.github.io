import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list']],
  outputDir: '.local/test-results',
  use: { baseURL: 'http://127.0.0.1:4322', trace: 'off' },
  webServer: {
    command: 'npm run build && npx astro preview --host 127.0.0.1 --port 4322',
    url: 'http://127.0.0.1:4322/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
});
