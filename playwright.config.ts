import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['line']],

  use: {
    baseURL: 'http://localhost:3000',
    locale: 'ko-KR',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Auth setup — logs in once and saves cookies so other projects skip login
    {
      name: 'student-setup',
      testMatch: /setup\/student\.setup\.ts/,
    },
    {
      name: 'professor-setup',
      testMatch: /setup\/professor\.setup\.ts/,
    },

    // Auth page tests (no pre-existing session)
    {
      name: 'auth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /auth\.spec\.ts/,
    },

    // Student feature tests (reuse saved session)
    {
      name: 'student',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/student.json',
      },
      dependencies: ['student-setup'],
      testMatch: /(learn|gamification)\.spec\.ts/,
    },

    // Professor feature tests (reuse saved session)
    {
      name: 'professor',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/professor.json',
      },
      dependencies: ['professor-setup'],
      testMatch: /professor\.spec\.ts/,
    },
  ],

  // Attach to an already-running dev server; start one if not running
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
