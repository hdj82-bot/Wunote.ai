import type { Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

export const MOCK_STUDENT = {
  id: 'test-student-id-0000',
  email: 'student@test.example',
  role: 'student',
}

export const MOCK_PROFESSOR = {
  id: 'test-professor-id-0000',
  email: 'professor@test.example',
  role: 'professor',
}

export const MOCK_ANALYSIS_RESULT = {
  error_count: 2,
  annotated_text: '我<span data-id="0">去了</span>学校，<span data-id="1">他们</span>都在。',
  errors: [
    {
      id: 0,
      error_span: '去了',
      error_type: 'grammar',
      error_subtype: '동사 중첩 오류',
      correction: '去',
      explanation: '단순 이동 동작에는 了가 필요하지 않습니다.',
      cot_reasoning: [],
      similar_example: '我去学校。',
      hsk_level: 2,
    },
    {
      id: 1,
      error_span: '他们',
      error_type: 'vocab',
      error_subtype: '대명사 오류',
      correction: '大家',
      explanation: '불특정 다수를 지칭할 때는 大家가 더 자연스럽습니다.',
      cot_reasoning: [],
      similar_example: '大家都在。',
      hsk_level: 1,
    },
  ],
  overall_feedback: '전반적으로 좋은 문장입니다. 몇 가지 문법적 부분을 개선해 보세요.',
  fluency_suggestion: '더 자연스러운 표현을 위해 접속사 사용을 고려해보세요.',
  session_id: 'test-session-id-0000',
  fossilization_warnings: [],
}

export const MOCK_GAMIFICATION = {
  level: 2,
  xp: 350,
  streak_days: 5,
  next_level_xp: 500,
}

export const MOCK_CLASS = {
  id: 'test-class-id-0000',
  name: '2026-1학기 중국어 초급',
  semester: '2026-1',
  is_active: true,
  invite_code: 'ABCD1234',
  created_at: new Date().toISOString(),
}

// ---------------------------------------------------------------------------
// Supabase auth mocks
// ---------------------------------------------------------------------------

/** Mock the Supabase sign-in endpoint (browser-side only). */
export async function mockSupabaseSignIn(page: Page, user = MOCK_STUDENT) {
  await page.route('**/auth/v1/token*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        user: {
          id: user.id,
          email: user.email,
          role: 'authenticated',
          user_metadata: { role: user.role },
          app_metadata: { role: user.role },
        },
      }),
    })
  )
}

/** Mock Supabase returning invalid credentials. */
export async function mockSupabaseSignInFail(page: Page) {
  await page.route('**/auth/v1/token*', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'invalid_grant',
        error_description: 'Invalid login credentials',
      }),
    })
  )
}

/** Mock the current user endpoint (browser-side). */
export async function mockSupabaseUser(page: Page, user = MOCK_STUDENT) {
  await page.route('**/auth/v1/user', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        role: 'authenticated',
        user_metadata: { role: user.role },
        app_metadata: { role: user.role },
      }),
    })
  )
}

// ---------------------------------------------------------------------------
// Supabase REST mocks
// ---------------------------------------------------------------------------

/** Mock a Supabase PostgREST table response. */
export async function mockSupabaseTable(
  page: Page,
  table: string,
  data: unknown[],
  status = 200
) {
  await page.route(`**/rest/v1/${table}*`, (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(data),
    })
  )
}

// ---------------------------------------------------------------------------
// Next.js API route mocks
// ---------------------------------------------------------------------------

/** Mock /api/analyze to return a deterministic analysis result. */
export async function mockAnalyzeAPI(
  page: Page,
  result: typeof MOCK_ANALYSIS_RESULT = MOCK_ANALYSIS_RESULT
) {
  await page.route('/api/analyze', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(result),
    })
  )
}

/** Mock /api/analyze to simulate a server error. */
export async function mockAnalyzeAPIError(page: Page, message = '분석 요청에 실패했습니다.') {
  await page.route('/api/analyze', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: message }),
    })
  )
}
