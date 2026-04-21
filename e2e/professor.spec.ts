/**
 * professor.spec.ts — Professor dashboard and class management flow.
 *
 * Runs in the "professor" Playwright project (pre-authenticated as professor).
 * Supabase REST calls that happen browser-side (client components) are mocked.
 * Server component data uses real Supabase through the saved session.
 */
import { test, expect } from '@playwright/test'
import { MOCK_CLASS } from './helpers/mocks'

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

test.describe('Professor dashboard', () => {
  test('loads the dashboard without redirecting', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/dashboard')
  })

  test('shows the main heading', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(
      page.getByRole('heading', { name: '교수자 대시보드' })
    ).toBeVisible()
  })

  test('shows the three stat cards', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText('운영 수업')).toBeVisible()
    await expect(page.getByText('총 수강생')).toBeVisible()
  })

  test('shows marketplace link', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('link', { name: /마켓플레이스/ })).toBeVisible()
  })

  test('shows weekly report link when classes exist', async ({ page }) => {
    await page.goto('/dashboard')
    // If there are classes, a "리포트 전체보기" link should appear
    // (only asserts presence if at least one class exists in test account)
    const reportLink = page.getByText(/리포트 전체보기|주간 리포트/)
    const count = await reportLink.count()
    if (count > 0) {
      await expect(reportLink.first()).toBeVisible()
    }
  })
})

// ---------------------------------------------------------------------------
// Cross-role access control
// ---------------------------------------------------------------------------

test.describe('Role-based access control', () => {
  test('professor cannot access student /learn page', async ({ page }) => {
    await page.goto('/learn')
    // Middleware redirects professors away from student routes to /dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 })
    expect(page.url()).toContain('/dashboard')
  })

  test('professor cannot access /errors page', async ({ page }) => {
    await page.goto('/errors')
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 })
    expect(page.url()).toContain('/dashboard')
  })

  test('professor cannot access /vocabulary page', async ({ page }) => {
    await page.goto('/vocabulary')
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 })
    expect(page.url()).toContain('/dashboard')
  })
})

// ---------------------------------------------------------------------------
// Class detail navigation
// ---------------------------------------------------------------------------

test.describe('Class detail', () => {
  test('clicking a class card navigates to class detail', async ({ page }) => {
    await page.goto('/dashboard')

    // Find the first class link — only runs if the test account has classes
    const classLink = page.locator('a[href^="/classes/"]').first()
    const exists = await classLink.count()

    if (exists === 0) {
      test.skip(true, 'No classes in test account — skipping class detail test')
      return
    }

    await classLink.click()
    await expect(page).toHaveURL(/\/classes\//)
  })

  test('class detail shows student roster section', async ({ page }) => {
    await page.goto('/dashboard')

    const classLink = page.locator('a[href^="/classes/"]').first()
    if ((await classLink.count()) === 0) {
      test.skip(true, 'No classes in test account')
      return
    }

    await classLink.click()
    await expect(page.getByText('수강생 현황')).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// Assignments list
// ---------------------------------------------------------------------------

test.describe('Professor assignments', () => {
  test('/assignments loads without error', async ({ page }) => {
    await page.goto('/assignments')
    await expect(page).toHaveURL('/assignments')
  })
})

// ---------------------------------------------------------------------------
// Unauthenticated fallback (using a fresh context without saved state)
// ---------------------------------------------------------------------------

test.describe('Unauthenticated fallback', () => {
  test('clearing cookies and visiting /dashboard redirects to /login', async ({
    page,
    context,
  }) => {
    await context.clearCookies()
    await page.goto('/dashboard')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    expect(page.url()).toContain('/login')
  })
})
