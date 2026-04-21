/**
 * learn.spec.ts — Core learning flow (highest priority).
 *
 * Runs in the "student" Playwright project, which supplies a pre-authenticated
 * session via storageState (created by student.setup.ts).
 *
 * The /api/analyze endpoint is mocked with page.route() so no real LLM call
 * is made.  All Supabase REST queries that happen browser-side are also mocked.
 * Server component data (initial page render) uses real Supabase via the
 * saved session cookies — this is the normal Next.js SSR flow.
 */
import { test, expect } from '@playwright/test'
import { mockAnalyzeAPI, mockAnalyzeAPIError, MOCK_ANALYSIS_RESULT } from './helpers/mocks'

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test.describe('Learn index redirect', () => {
  test('/learn redirects to a chapter page', async ({ page }) => {
    await page.goto('/learn')
    // The index page reads the last session from DB and redirects to /learn/:id
    await page.waitForURL(/\/learn\/\d+/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/learn\/\d+/)
  })
})

// ---------------------------------------------------------------------------
// Document editor
// ---------------------------------------------------------------------------

test.describe('Document editor', () => {
  test.beforeEach(async ({ page }) => {
    await mockAnalyzeAPI(page)
  })

  test('shows the contenteditable editor with correct aria-label', async ({ page }) => {
    await page.goto('/learn/1')
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await expect(editor).toBeVisible()
  })

  test('shows the chapter label', async ({ page }) => {
    await page.goto('/learn/1')
    await expect(page.getByText(/제1장/)).toBeVisible()
  })

  test('submit button is disabled when editor is empty', async ({ page }) => {
    await page.goto('/learn/1')
    // Clear any pre-loaded content
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.clear()
    await expect(page.getByRole('button', { name: '재진단' })).toBeDisabled()
  })

  test('student can type Chinese text in the editor', async ({ page }) => {
    await page.goto('/learn/1')
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.click()
    await editor.fill('我去学校了。')
    await expect(editor).toContainText('我去学校了。')
  })

  test('submit button becomes enabled after typing', async ({ page }) => {
    await page.goto('/learn/1')
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.click()
    await editor.fill('我去学校了。')
    await expect(page.getByRole('button', { name: '재진단' })).toBeEnabled()
  })
})

// ---------------------------------------------------------------------------
// AI analysis
// ---------------------------------------------------------------------------

test.describe('Analysis flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockAnalyzeAPI(page)
  })

  test('clicking 재진단 shows loading state', async ({ page }) => {
    // Slow the response so the in-flight loading indicator is catchable
    await page.route('/api/analyze', async (route) => {
      await new Promise((r) => setTimeout(r, 400))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ANALYSIS_RESULT),
      })
    })

    await page.goto('/learn/1')
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.click()
    await editor.fill('我去学校了。')
    await page.getByRole('button', { name: '재진단' }).click()

    await expect(page.getByText('분석 중…')).toBeVisible()
  })

  test('error panel shows correct error count after analysis', async ({ page }) => {
    await page.goto('/learn/1')
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.click()
    await editor.fill('我去学校了。')
    await page.getByRole('button', { name: '재진단' }).click()

    const expectedCount = MOCK_ANALYSIS_RESULT.error_count
    await expect(
      page.getByText(new RegExp(`오류 카드 \\(${expectedCount}\\)`))
    ).toBeVisible({ timeout: 10_000 })
  })

  test('annotated text view appears after analysis', async ({ page }) => {
    await page.goto('/learn/1')
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.click()
    await editor.fill('我去学校了。')
    await page.getByRole('button', { name: '재진단' }).click()

    // After analysis, the header switches to "분석 결과" and an edit link appears
    await expect(page.getByText('분석 결과')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('수정하기')).toBeVisible()
  })

  test('clicking 수정하기 returns to edit mode', async ({ page }) => {
    await page.goto('/learn/1')
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.click()
    await editor.fill('我去学校了。')
    await page.getByRole('button', { name: '재진단' }).click()

    await expect(page.getByText('분석 결과')).toBeVisible({ timeout: 10_000 })
    await page.getByText('수정하기').click()

    await expect(page.getByText('문서 작성')).toBeVisible()
    await expect(page.locator('[aria-label="중국어 문장 입력"]')).toBeVisible()
  })

  test('error panel shows overall feedback after analysis', async ({ page }) => {
    await page.goto('/learn/1')
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.click()
    await editor.fill('我去학교了。')
    await page.getByRole('button', { name: '재진단' }).click()

    await expect(page.getByText('전체 피드백')).toBeVisible({ timeout: 10_000 })
  })

  test('API error is shown as an alert', async ({ page }) => {
    // Override the beforeEach mock with an error response
    await mockAnalyzeAPIError(page, '분석 요청에 실패했습니다.')

    await page.goto('/learn/1')
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.click()
    await editor.fill('我去学校了。')
    await page.getByRole('button', { name: '재진단' }).click()

    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// Mobile tab navigation
// ---------------------------------------------------------------------------

test.describe('Mobile tab navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await mockAnalyzeAPI(page)
  })

  test('tab bar is visible on mobile', async ({ page }) => {
    await page.goto('/learn/1')
    await expect(page.locator('[aria-label="뷰 전환"]')).toBeVisible()
  })

  test('switching to 오류 tab changes active tab', async ({ page }) => {
    await page.goto('/learn/1')
    const errorsTab = page.locator('[aria-label="뷰 전환"] button').filter({ hasText: '오류' })
    await errorsTab.click()
    await expect(errorsTab).toHaveAttribute('aria-pressed', 'true')
  })

  test('switching to 채팅 tab changes active tab', async ({ page }) => {
    await page.goto('/learn/1')
    const chatTab = page.locator('[aria-label="뷰 전환"] button').filter({ hasText: '채팅' })
    await chatTab.click()
    await expect(chatTab).toHaveAttribute('aria-pressed', 'true')
  })
})
