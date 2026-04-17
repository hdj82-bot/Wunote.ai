import { createServerClient } from './supabase'

export interface CreateSessionParams {
  studentId: string
  classId?: string | null
  chapterNumber: number
  draftText: string
  draftErrorCount?: number
  assignmentId?: string | null
}

/**
 * sessions 테이블에 1행 insert 하고 session_id 를 반환한다.
 * sessions.class_id 는 NOT NULL + RLS(is_enrolled) 이므로 classId 는 필수다.
 * (서명에 ?: 로 둔 것은 호출 측에서 옵션 객체를 느슨하게 넘길 수 있도록 한 것이며,
 * 런타임에서 누락 시 명시적 에러를 던진다.)
 */
export async function createSession(params: CreateSessionParams): Promise<string> {
  if (!params.classId) {
    throw new Error('classId 는 필수입니다 (세션은 수업에 귀속됩니다)')
  }

  const supabase = createServerClient()

  // `as never` — types/database.ts 가 아직 placeholder 이라서 supabase-js 가 Insert 타입을
  // never 로 추론한다. 창3 의 supabase gen types 반영되면 제거할 수 있다.
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      student_id: params.studentId,
      class_id: params.classId,
      chapter_number: params.chapterNumber,
      draft_text: params.draftText,
      draft_error_count: params.draftErrorCount ?? null,
      assignment_id: params.assignmentId ?? null
    } as never)
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`session insert 실패: ${error?.message ?? 'unknown'}`)
  }

  const id = (data as { id?: unknown }).id
  if (typeof id !== 'string') {
    throw new Error('session insert 응답에서 id 를 읽을 수 없습니다')
  }
  return id
}

export interface UpdateSessionRevisionParams {
  sessionId: string
  revisionText: string
  revisionErrorCount: number
}

/** 수정고 재진단 결과를 기존 session 에 덧붙인다 (Phase 1 재진단 플로우). */
export async function updateSessionRevision(params: UpdateSessionRevisionParams): Promise<void> {
  const supabase = createServerClient()

  const { error } = await supabase
    .from('sessions')
    .update({
      revision_text: params.revisionText,
      revision_error_count: params.revisionErrorCount
    } as never)
    .eq('id', params.sessionId)

  if (error) {
    throw new Error(`session 수정고 update 실패: ${error.message}`)
  }
}
