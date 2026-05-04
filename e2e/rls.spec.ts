// RLS 정책 시나리오별 E2E.
//
// 검증 대상:
//   - supabase/migrations/20260421000005_rls_policies.sql       (전체 RLS 골격)
//   - supabase/migrations/20260505000001_live_typing_consents.sql
//   - supabase/migrations/20260505000002_weekly_reports_and_notifications.sql
//
// 시나리오:
//   1) 학생 A 는 학생 B 의 sessions / error_cards / weekly_reports / in_app_notifications /
//      live_typing_consents 를 읽지 못한다.
//   2) 교수 P 는 자기 강의의 학생 데이터만 본다 (다른 강의 P2 의 학생은 못 본다).
//   3) 익명은 marketplace 의 is_public=true 인 corpus_documents 만 읽고
//      그 외 사적 테이블 / 비공개 marketplace 글은 모두 차단된다.
//
// 실행 전제:
//   - SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY 가 설정된 환경.
//   - 같은 DB 에 직접 접속하므로 dev/staging 전용 — 운영 DB 에서는 절대 실행하지 말 것.
//   - service-role 로 임시 사용자/레코드를 생성하고 afterAll 에서 정리한다.
//
// 비고:
//   PostgREST 에서 RLS 로 차단된 read 는 "에러" 가 아니라 "빈 배열" 로 응답한다.
//   따라서 본 spec 은 `data?.length === 0` 또는 `data === null` 을 차단의 신호로 본다.

import { test, expect, type SupabaseClient } from '@playwright/test'
import { adminClient, anonClient, readRlsEnv, signInClient, tag, type RlsEnv } from './helpers/supabase-clients'
import type { Database } from '@/types/database'

const env = readRlsEnv()

test.describe.configure({ mode: 'serial' })
test.describe('RLS policies', () => {
  test.skip(!env, 'SUPABASE_TEST_URL / ANON_KEY / SERVICE_ROLE_KEY 미설정 — RLS 테스트 스킵')

  // ─── shared fixture state ──────────────────────────────────────────────
  let admin: SupabaseClient<Database>
  let runTag: string

  // 사용자
  let studentA = { email: '', password: '', userId: '' }
  let studentB = { email: '', password: '', userId: '' }
  let professorP = { email: '', password: '', userId: '' }
  let professorP2 = { email: '', password: '', userId: '' }

  // 도메인 객체
  let classCId = ''     // P owns
  let classC2Id = ''    // P2 owns
  let aSessionId = ''   // student A's session in C
  let bSessionId = ''   // student B's session in C2 (B is enrolled there)
  let publicDocId = ''  // marketplace public, owned by P
  let privateDocId = '' // marketplace private, owned by P

  // 시그날: 클라이언트
  let aClient: SupabaseClient<Database>
  let bClient: SupabaseClient<Database>
  let pClient: SupabaseClient<Database>
  let anonSb: SupabaseClient<Database>

  test.beforeAll(async () => {
    if (!env) return
    admin = adminClient(env)
    runTag = tag()

    // ── 사용자 4명 생성 (이미 존재하면 createUser 가 실패 → 새 이메일로 재시도)
    async function createUser(role: 'student' | 'professor'): Promise<{ email: string; password: string; userId: string }> {
      const email = `${runTag}-${role}-${Math.random().toString(36).slice(2, 8)}@rls.test.example`
      const password = `Pa55word!-${Math.random().toString(36).slice(2, 10)}`
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (error || !data.user) throw new Error(`createUser(${email}) failed: ${error?.message}`)
      const userId = data.user.id
      // profiles 행은 트리거(handle_new_user)가 자동 생성한다고 가정.
      // role 만 service-role 로 보정.
      await admin.from('profiles').update({ role }).eq('id', userId)
      return { email, password, userId }
    }

    studentA = await createUser('student')
    studentB = await createUser('student')
    professorP = await createUser('professor')
    professorP2 = await createUser('professor')

    // ── 강의 2개 (P, P2 각자 소유)
    const c = await admin
      .from('classes')
      .insert({
        professor_id: professorP.userId,
        name: `${runTag}-classC`,
        semester: '2026-1',
        invite_code: runTag.slice(0, 8).toUpperCase() + '01',
        is_active: true,
      } as never)
      .select('id')
      .single()
    if (c.error || !c.data) throw new Error(`insert class C: ${c.error?.message}`)
    classCId = (c.data as { id: string }).id

    const c2 = await admin
      .from('classes')
      .insert({
        professor_id: professorP2.userId,
        name: `${runTag}-classC2`,
        semester: '2026-1',
        invite_code: runTag.slice(0, 8).toUpperCase() + '02',
        is_active: true,
      } as never)
      .select('id')
      .single()
    if (c2.error || !c2.data) throw new Error(`insert class C2: ${c2.error?.message}`)
    classC2Id = (c2.data as { id: string }).id

    // ── 수강 등록: A → C, B → C2
    {
      const { error } = await admin.from('enrollments').insert([
        { student_id: studentA.userId, class_id: classCId } as never,
        { student_id: studentB.userId, class_id: classC2Id } as never,
      ])
      if (error) throw new Error(`enrollments: ${error.message}`)
    }

    // ── sessions: A in C, B in C2
    {
      const { data, error } = await admin
        .from('sessions')
        .insert([
          { student_id: studentA.userId, class_id: classCId, chapter_number: 1, draft_text: 'A 작성' } as never,
          { student_id: studentB.userId, class_id: classC2Id, chapter_number: 1, draft_text: 'B 작성' } as never,
        ])
        .select('id, student_id')
      if (error || !data) throw new Error(`sessions: ${error?.message}`)
      const rows = data as Array<{ id: string; student_id: string }>
      aSessionId = rows.find((r) => r.student_id === studentA.userId)!.id
      bSessionId = rows.find((r) => r.student_id === studentB.userId)!.id
    }

    // ── error_cards: 1 per session
    {
      const { error } = await admin.from('error_cards').insert([
        {
          student_id: studentA.userId,
          session_id: aSessionId,
          chapter_number: 1,
          error_span: '去了',
          error_type: 'grammar',
          error_subtype: '동사중첩',
          correction: '去',
          explanation: 'A',
        } as never,
        {
          student_id: studentB.userId,
          session_id: bSessionId,
          chapter_number: 1,
          error_span: '他们',
          error_type: 'vocab',
          error_subtype: '대명사',
          correction: '大家',
          explanation: 'B',
        } as never,
      ])
      if (error) throw new Error(`error_cards: ${error.message}`)
    }

    // ── student_weekly_reports
    {
      const week = '2026-04-27' // arbitrary Monday
      const { error } = await admin.from('student_weekly_reports').insert([
        {
          student_id: studentA.userId,
          class_id: classCId,
          week_start: week,
          metrics: { total_sessions: 1 },
          suggestions: { headline: 'A 제안' },
        } as never,
        {
          student_id: studentB.userId,
          class_id: classC2Id,
          week_start: week,
          metrics: { total_sessions: 1 },
          suggestions: { headline: 'B 제안' },
        } as never,
      ])
      if (error) throw new Error(`student_weekly_reports: ${error.message}`)
    }

    // ── in_app_notifications (학생/교수자 공용 user_id 매핑)
    {
      const { error } = await admin.from('in_app_notifications').insert([
        {
          user_id: studentA.userId,
          type: 'weekly_report',
          title: 'A 알림',
          body: 'A',
        } as never,
        {
          user_id: studentB.userId,
          type: 'weekly_report',
          title: 'B 알림',
          body: 'B',
        } as never,
      ])
      if (error) throw new Error(`in_app_notifications: ${error.message}`)
    }

    // ── live_typing_consents: A in C, B in C2
    {
      const { error } = await admin.from('live_typing_consents').insert([
        { class_id: classCId, student_id: studentA.userId } as never,
        { class_id: classC2Id, student_id: studentB.userId } as never,
      ])
      if (error) throw new Error(`live_typing_consents: ${error.message}`)
    }

    // ── corpus_documents: 1 public + 1 private (둘 다 P 소유)
    {
      const { data, error } = await admin
        .from('corpus_documents')
        .insert([
          {
            professor_id: professorP.userId,
            class_id: classCId,
            file_name: `${runTag}-public.txt`,
            file_type: 'txt',
            title: `${runTag}-public`,
            content: 'public corpus',
            is_public: true,
          } as never,
          {
            professor_id: professorP.userId,
            class_id: classCId,
            file_name: `${runTag}-private.txt`,
            file_type: 'txt',
            title: `${runTag}-private`,
            content: 'private corpus',
            is_public: false,
          } as never,
        ])
        .select('id, is_public')
      if (error || !data) throw new Error(`corpus_documents: ${error?.message}`)
      const rows = data as Array<{ id: string; is_public: boolean }>
      publicDocId = rows.find((r) => r.is_public)!.id
      privateDocId = rows.find((r) => !r.is_public)!.id
    }

    // ── 사용자 컨텍스트 클라이언트
    aClient = await signInClient(env, studentA.email, studentA.password)
    bClient = await signInClient(env, studentB.email, studentB.password)
    pClient = await signInClient(env, professorP.email, professorP.password)
    anonSb = anonClient(env)
  })

  test.afterAll(async () => {
    if (!env || !admin) return
    // 데이터 → 사용자 순으로 정리. on delete cascade 가 대부분 처리.
    if (publicDocId) await admin.from('corpus_documents').delete().eq('id', publicDocId)
    if (privateDocId) await admin.from('corpus_documents').delete().eq('id', privateDocId)
    if (classCId) await admin.from('classes').delete().eq('id', classCId)
    if (classC2Id) await admin.from('classes').delete().eq('id', classC2Id)
    for (const u of [studentA, studentB, professorP, professorP2]) {
      if (u.userId) await admin.auth.admin.deleteUser(u.userId)
    }
  })

  // ────────────────────────────────────────────────────────────────────────
  // 1. 학생 A 는 학생 B 의 데이터를 읽지 못한다
  // ────────────────────────────────────────────────────────────────────────
  test('학생 A 는 학생 B 의 sessions 못 읽음', async () => {
    const { data, error } = await aClient
      .from('sessions')
      .select('id')
      .eq('student_id', studentB.userId)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  test('학생 A 는 학생 B 의 error_cards 못 읽음', async () => {
    const { data, error } = await aClient
      .from('error_cards')
      .select('id')
      .eq('student_id', studentB.userId)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  test('학생 A 는 학생 B 의 student_weekly_reports 못 읽음', async () => {
    const { data, error } = await aClient
      .from('student_weekly_reports')
      .select('id')
      .eq('student_id', studentB.userId)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  test('학생 A 는 학생 B 의 in_app_notifications 못 읽음', async () => {
    const { data, error } = await aClient
      .from('in_app_notifications')
      .select('id')
      .eq('user_id', studentB.userId)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  test('학생 A 는 학생 B 의 live_typing_consents 못 읽음', async () => {
    const { data, error } = await aClient
      .from('live_typing_consents')
      .select('id')
      .eq('student_id', studentB.userId)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  test('학생 A 는 자기 sessions 는 정상적으로 읽는다 (sanity)', async () => {
    const { data, error } = await aClient
      .from('sessions')
      .select('id')
      .eq('id', aSessionId)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)
  })

  // ────────────────────────────────────────────────────────────────────────
  // 2. 교수 P 는 자기 강의 학생만 본다
  // ────────────────────────────────────────────────────────────────────────
  test('교수 P 는 자기 강의(C) 학생 A 의 sessions 를 읽는다', async () => {
    const { data, error } = await pClient
      .from('sessions')
      .select('id')
      .eq('id', aSessionId)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)
  })

  test('교수 P 는 다른 강의(C2) 학생 B 의 sessions 는 못 읽는다', async () => {
    const { data, error } = await pClient
      .from('sessions')
      .select('id')
      .eq('id', bSessionId)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  test('교수 P 는 다른 강의 학생 B 의 student_weekly_reports 못 본다', async () => {
    const { data, error } = await pClient
      .from('student_weekly_reports')
      .select('id')
      .eq('student_id', studentB.userId)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  test('교수 P 는 자기 강의 학생 A 의 live_typing_consents 를 읽는다', async () => {
    const { data, error } = await pClient
      .from('live_typing_consents')
      .select('id')
      .eq('class_id', classCId)
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThanOrEqual(1)
  })

  test('교수 P 는 다른 강의(C2) live_typing_consents 못 본다', async () => {
    const { data, error } = await pClient
      .from('live_typing_consents')
      .select('id')
      .eq('class_id', classC2Id)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  // ────────────────────────────────────────────────────────────────────────
  // 3. 익명 사용자
  // ────────────────────────────────────────────────────────────────────────
  test('익명은 sessions 못 읽는다', async () => {
    const { data, error } = await anonSb.from('sessions').select('id').limit(1)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  test('익명은 error_cards 못 읽는다', async () => {
    const { data, error } = await anonSb.from('error_cards').select('id').limit(1)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  test('익명은 in_app_notifications 못 읽는다', async () => {
    const { data, error } = await anonSb.from('in_app_notifications').select('id').limit(1)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  test('익명은 student_weekly_reports 못 읽는다', async () => {
    const { data, error } = await anonSb.from('student_weekly_reports').select('id').limit(1)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  test('익명은 live_typing_consents 못 읽는다', async () => {
    const { data, error } = await anonSb.from('live_typing_consents').select('id').limit(1)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  test('익명은 marketplace 비공개 글(is_public=false)은 못 읽는다', async () => {
    const { data, error } = await anonSb
      .from('corpus_documents')
      .select('id')
      .eq('id', privateDocId)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  test('익명은 marketplace 공개 글(is_public=true)만 읽는다', async () => {
    // NOTE: 현재 corpus_public_marketplace_select 정책은 `is_public = true and public.is_professor()`
    // 로 되어 있어, 익명에게는 is_professor() 가 false 이므로 차단된다.
    // 사용자 스펙은 "익명도 공개 글은 읽는다"이므로 본 케이스가 실패하면 정책 갭으로 간주.
    const { data, error } = await anonSb
      .from('corpus_documents')
      .select('id')
      .eq('id', publicDocId)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)
  })
})
