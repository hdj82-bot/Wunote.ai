/**
 * Auth setup: log in as a professor once, save the session to disk.
 *
 * Requires env vars:
 *   TEST_PROFESSOR_EMAIL    (default: professor@test.example)
 *   TEST_PROFESSOR_PASSWORD (default: testpassword123)
 */
import { test as setup } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const AUTH_FILE = 'playwright/.auth/professor.json'

setup('professor auth', async ({ page }) => {
  const email    = process.env.TEST_PROFESSOR_EMAIL    ?? 'professor@test.example'
  const password = process.env.TEST_PROFESSOR_PASSWORD ?? 'testpassword123'

  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')

  // Professors are redirected to /dashboard after login
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 })

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })
  await page.context().storageState({ path: AUTH_FILE })
})
