import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { parseCorpusFile, MAX_CORPUS_FILE_BYTES } from '@/lib/corpus-parser'
import { createServerClient } from '@/lib/supabase'
import type { CorpusUploadResponse } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

/** DB TEXT 컬럼으로 들어갈 파싱 결과가 극단적으로 커지면 잘라내 저장 비용을 제한한다. */
const MAX_STORED_TEXT_CHARS = 200_000
/** 수업당 최대 20개 파일 (Wunote.md 명세) */
const MAX_DOCS_PER_CLASS = 20

export async function POST(req: Request) {
  let auth
  try {
    auth = await requireAuth('professor')
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: '인증 확인 중 오류가 발생했습니다' }, { status: 500 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'multipart/form-data 파싱 실패' }, { status: 400 })
  }

  const classId = form.get('classId')
  if (typeof classId !== 'string' || !classId) {
    return NextResponse.json({ error: 'classId 필드가 필요합니다' }, { status: 400 })
  }

  const isPublicRaw = form.get('isPublic')
  const isPublic = isPublicRaw === 'true' || isPublicRaw === '1'

  const fileEntry = form.get('file')
  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: 'file 필드에 업로드 파일이 필요합니다' }, { status: 400 })
  }

  if (fileEntry.size === 0) {
    return NextResponse.json({ error: '빈 파일입니다' }, { status: 400 })
  }
  if (fileEntry.size > MAX_CORPUS_FILE_BYTES) {
    return NextResponse.json({ error: '파일 크기가 10MB를 초과합니다' }, { status: 413 })
  }

  const supabase = createServerClient()

  // 교수자 본인이 해당 class 의 소유자인지 확인. RLS 정책(classes_professor_all)과 중복 체크하지만
  // 명시적 400 메시지를 반환하기 위해 선행 확인한다.
  const { data: klass, error: klassErr } = await supabase
    .from('classes')
    .select('id, professor_id')
    .eq('id', classId)
    .maybeSingle()

  if (klassErr) {
    console.error('[api/corpus/upload] classes 조회 실패:', klassErr)
    return NextResponse.json({ error: '수업 조회 실패' }, { status: 500 })
  }
  if (!klass) {
    return NextResponse.json({ error: '존재하지 않는 수업입니다' }, { status: 404 })
  }
  if ((klass as { professor_id?: unknown }).professor_id !== auth.userId) {
    return NextResponse.json({ error: '해당 수업의 소유자만 업로드할 수 있습니다' }, { status: 403 })
  }

  // 수업당 파일 수 제한
  const { count: existingCount, error: countErr } = await supabase
    .from('corpus_documents')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', classId)
  if (countErr) {
    console.error('[api/corpus/upload] corpus_documents COUNT 실패:', countErr)
    return NextResponse.json({ error: '기존 파일 수 조회 실패' }, { status: 500 })
  }
  if ((existingCount ?? 0) >= MAX_DOCS_PER_CLASS) {
    return NextResponse.json(
      { error: `수업당 최대 ${MAX_DOCS_PER_CLASS}개 파일까지 업로드할 수 있습니다` },
      { status: 400 }
    )
  }

  // 파일 파싱
  let parsed
  try {
    const buf = Buffer.from(await fileEntry.arrayBuffer())
    parsed = await parseCorpusFile(buf, fileEntry.name)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '파일 파싱 실패'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const storedText = parsed.text.length > MAX_STORED_TEXT_CHARS
    ? parsed.text.slice(0, MAX_STORED_TEXT_CHARS)
    : parsed.text

  // `as never` — types/database.ts placeholder 에 의한 Insert 타입 never 우회.
  const { data: inserted, error: insertErr } = await supabase
    .from('corpus_documents')
    .insert({
      class_id: classId,
      professor_id: auth.userId,
      file_name: fileEntry.name,
      file_type: parsed.fileType,
      content: storedText,
      is_public: isPublic
    } as never)
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.error('[api/corpus/upload] insert 실패:', insertErr)
    return NextResponse.json({ error: 'corpus_documents insert 실패' }, { status: 500 })
  }

  const id = (inserted as { id?: unknown }).id
  if (typeof id !== 'string') {
    return NextResponse.json({ error: 'insert 응답 파싱 실패' }, { status: 500 })
  }

  const response: CorpusUploadResponse = {
    id,
    fileName: fileEntry.name,
    fileType: parsed.fileType,
    charLength: storedText.length,
    isPublic
  }
  return NextResponse.json(response, { status: 201 })
}
