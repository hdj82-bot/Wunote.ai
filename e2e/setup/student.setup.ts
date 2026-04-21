/**
 * Auth setup: log in as a student once, save the session to disk.
 *
 * Requires env vars:
 *   TEST_STUDENT_EMAIL    (default: student@test.example)
 *   TEST_STUDENT_PASSWORD (default: testpassword123)
 *
 * The saved state is read by the "student" Playwright project so individual
 * spec files don't repeat the login dance.
 */
import { test as setup } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const AUTH_FILE = 'playwright/.auth/student.json'

setup('student auth', async ({ page }) => {
  const email    = process.env.TEST_STUDENT_EMAIL    ?? 'student@test.example'
  const password = process.env.TEST_STUDENT_PASSWORD ?? 'testpassword123'

  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')

  // After a successful login the server redirects a student to /learn
  await page.waitForURL(/\/learn/, { timeout: 20_000 })

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })
  await page.context().storageState({ path: AUTH_FILE })
})
