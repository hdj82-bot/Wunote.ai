/**
 * gamification.spec.ts — XP, level, and streak display tests.
 *
 * Runs in the "student" Playwright project (pre-authenticated).
 * Analysis API is mocked; gamification data is loaded server-side from real
 * Supabase and verified by checking component presence and structure rather
 * than exact values (which vary per test account).
 */
import { test, expect } from '@playwright/test'
import { mockAnalyzeAPI, MOCK_ANALYSIS_RESULT } from './helpers/mocks'

// ---------------------------------------------------------------------------
// Initial state — components are present on the learn page
// ---------------------------------------------------------------------------

test.describe('Gamification components', () => {
  test.beforeEach(async ({ page }) => {
    await mockAnalyzeAPI(page)
  })

  test('level progress bar is present on the learn page', async ({ page }) => {
    await page.goto('/learn/1')
    // LevelBar renders a progressbar role element
    await expect(page.locator('[role="progressbar"]')).toBeVisible()
  })

  test('progressbar has aria-valuenow attribute', async ({ page }) => {
    await page.goto('/learn/1')
    const bar = page.locator('[role="progressbar"]')
    const valuenow = await bar.getAttribute('aria-valuenow')
    expect(Number(valuenow)).toBeGreaterThanOrEqual(0)
  })

  test('streak counter shows consecutive days text', async ({ page }) => {
    await page.goto('/learn/1')
    // StreakCounter renders "🔥 {days}일 연속 학습"
    await expect(page.getByText(/연속 학습/)).toBeVisible()
  })

  test('streak counter days value is a positive number', async ({ page }) => {
    await page.goto('/learn/1')
    const streakText = await page.getByText(/연속 학습/).textContent()
    const match = streakText?.match(/(\d+)일 연속/)
    expect(match).not.toBeNull()
    expect(Number(match![1])).toBeGreaterThanOrEqual(0)
  })

  test('level label includes "Lv." prefix', async ({ page }) => {
    await page.goto('/learn/1')
    await expect(page.getByText(/Lv\.\d/)).toBeVisible()
  })

  test('XP value is displayed as a number', async ({ page }) => {
    await page.goto('/learn/1')
    // XP text matches a pattern like "350 XP"
    await expect(page.getByText(/\d+ XP/)).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// XP update after submitting a session
// ---------------------------------------------------------------------------

test.describe('XP after submission', () => {
  test('XP value is at least as large after submitting a session', async ({ page }) => {
    await mockAnalyzeAPI(page)

    await page.goto('/learn/1')

    // Read XP before submission
    const xpLocator = page.getByText(/\d+ XP/)
    await expect(xpLocator).toBeVisible()
    const xpBeforeText = await xpLocator.textContent()
    const xpBefore = Number(xpBeforeText?.match(/(\d+) XP/)?.[1] ?? 0)

    // Submit a session
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.click()
    await editor.fill('我去学校了。这是一个好句子。')
    await page.getByRole('button', { name: '재진단' }).click()
    await expect(
      page.getByText(new RegExp(`오류 카드 \\(${MOCK_ANALYSIS_RESULT.error_count}\\)`))
    ).toBeVisible({ timeout: 10_000 })

    // Reload to let the server-side gamification update propagate
    await page.reload()

    const xpAfterText = await page.getByText(/\d+ XP/).textContent()
    const xpAfter = Number(xpAfterText?.match(/(\d+) XP/)?.[1] ?? 0)

    expect(xpAfter).toBeGreaterThanOrEqual(xpBefore)
  })

  test('streak counter is still visible after a session', async ({ page }) => {
    await mockAnalyzeAPI(page)

    await page.goto('/learn/1')
    const editor = page.locator('[aria-label="중국어 문장 입력"]')
    await editor.click()
    await editor.fill('今天天气很好。')
    await page.getByRole('button', { name: '재진단' }).click()
    await expect(page.getByText(/오류 카드/)).toBeVisible({ timeout: 10_000 })

    // Streak should still be displayed
    await expect(page.getByText(/연속 학습/)).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Badges page
// ---------------------------------------------------------------------------

test.describe('Badges page', () => {
  test('badge shelf page loads without error', async ({ page }) => {
    await page.goto('/badges')
    await expect(page).toHaveURL('/badges')
    await expect(page.getByText('배지 진열장')).toBeVisible()
  })

  test('badge count label shows earned/total format', async ({ page }) => {
    await page.goto('/badges')
    // Count label matches "{n} / {total}" pattern
    await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible()
  })
})
