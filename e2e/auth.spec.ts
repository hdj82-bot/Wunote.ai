/**
 * auth.spec.ts — Login / signup form tests and unauthenticated redirect.
 *
 * These tests run without a pre-existing session (no storageState).
 * Supabase auth endpoints are mocked at the browser level via page.route().
 * Server-side middleware redirect tests rely on no valid session cookie being
 * present, which is guaranteed because no storageState is set for this project.
 */
import { test, expect } from '@playwright/test'
import {
  mockSupabaseSignIn,
  mockSupabaseSignInFail,
  MOCK_STUDENT,
  MOCK_PROFESSOR,
} from './helpers/mocks'

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

test.describe('Login page', () => {
  test('renders email, password fields and submit button', async ({ page }) => {
    await page.goto('/login')

    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toContainText('로그인')
  })

  test('shows error when form is submitted empty', async ({ page }) => {
    await page.goto('/login')
    await page.click('button[type="submit"]')

    await expect(page.locator('[role="alert"]')).toContainText(
      '이메일과 비밀번호를 입력하세요'
    )
  })

  test('shows error for wrong credentials', async ({ page }) => {
    await mockSupabaseSignInFail(page)

    await page.goto('/login')
    await page.fill('#email', 'nobody@example.com')
    await page.fill('#password', 'wrongpassword')
    await page.click('button[type="submit"]')

    await expect(page.locator('[role="alert"]')).toContainText(
      '이메일 또는 비밀번호가 올바르지 않습니다'
    )
  })

  test('submit button shows loading text while submitting', async ({ page }) => {
    // Delay the Supabase response so we can catch the in-flight state
    await page.route('**/auth/v1/token*', async (route) => {
      await new Promise((r) => setTimeout(r, 600))
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid' }),
      })
    })

    await page.goto('/login')
    await page.fill('#email', 'test@example.com')
    await page.fill('#password', 'password123')
    await page.click('button[type="submit"]')

    // The button text changes to "로그인 중…" while the Server Action runs
    await expect(page.locator('button[type="submit"]')).toContainText('로그인 중')
  })
})

// ---------------------------------------------------------------------------
// Signup
// ---------------------------------------------------------------------------

test.describe('Signup page', () => {
  test('renders name, email, password fields', async ({ page }) => {
    await page.goto('/signup')

    await expect(page.locator('#name')).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toContainText('가입하기')
  })

  test('shows error when required fields are missing', async ({ page }) => {
    await page.goto('/signup')
    await page.click('button[type="submit"]')

    await expect(page.locator('[role="alert"]')).toContainText(
      '이름, 이메일, 비밀번호를 모두 입력하세요'
    )
  })

  test('shows error for password shorter than 8 characters', async ({ page }) => {
    await page.goto('/signup')
    await page.fill('#name', '테스트 사용자')
    await page.fill('#email', 'test@example.com')
    await page.fill('#password', 'short')
    await page.click('button[type="submit"]')

    await expect(page.locator('[role="alert"]')).toContainText('비밀번호는 8자 이상')
  })

  test('student role radio is selected by default', async ({ page }) => {
    await page.goto('/signup')

    // The role radio buttons are visually styled; we check the hidden input value
    const studentRadio = page.locator('input[name="role"][value="student"]')
    await expect(studentRadio).toBeChecked()
  })

  test('selecting professor role hides student ID field', async ({ page }) => {
    await page.goto('/signup')

    // Student ID field visible by default (student role)
    await expect(page.locator('#student_id')).toBeVisible()

    // Switch to professor
    await page.locator('input[name="role"][value="professor"]').click({ force: true })

    await expect(page.locator('#student_id')).not.toBeVisible()
  })

  test('has link to login page', async ({ page }) => {
    await page.goto('/signup')
    await page.click('a:has-text("로그인")')
    await expect(page).toHaveURL(/\/login/)
  })
})

// ---------------------------------------------------------------------------
// Redirect guards (no session present)
// ---------------------------------------------------------------------------

test.describe('Unauthenticated redirect', () => {
  test('/learn redirects to /login', async ({ page }) => {
    await page.goto('/learn')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    expect(page.url()).toContain('/login')
  })

  test('/learn redirect includes the original path', async ({ page }) => {
    await page.goto('/learn')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    expect(page.url()).toContain('redirect')
  })

  test('/dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    expect(page.url()).toContain('/login')
  })

  test('/errors redirects to /login', async ({ page }) => {
    await page.goto('/errors')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    expect(page.url()).toContain('/login')
  })
})
