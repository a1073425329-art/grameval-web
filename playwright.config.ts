import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  // 只跑 e2e 与 api 测试, unit(vitest 负责的)跳过
  testMatch: /(e2e|api)\/.*\.(test|spec)\.ts$|^tests\/(admin|student)\.test\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:9000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:9000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
