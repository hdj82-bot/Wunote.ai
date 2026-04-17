// Wunote 공유 타입 — 오류 카드, Claude API 요청/응답, 화석화 감지
// [소유자] 창2 (feature/ai). 수정 시 커밋 메시지 앞에 [types] 태그 필수.

export type ErrorType = 'vocab' | 'grammar'

export interface CotStep {
  step: string
  content: string
}

export interface AnalysisError {
  id: number
  error_span: string
  error_type: ErrorType
  error_subtype: string
  correction: string
  explanation: string
  cot_reasoning: CotStep[]
  similar_example: string
  hsk_level: number
}

export interface AnalysisResponse {
  error_count: number
  annotated_text: string
  errors: AnalysisError[]
  overall_feedback: string
  fluency_suggestion?: string
  /** 세션·오류 카드 영속화 시 발급되는 세션 PK (UUID). */
  session_id?: string
  /** 이번 제출로 화석화 임계(3회+)에 도달한 error_subtype 경고 목록. */
  fossilization_warnings?: FossilizationWarning[]
}

export interface IclExample {
  input: string
  error_type: ErrorType
  error_subtype: string
  correction: string
  explanation: string
  cot_reasoning?: CotStep[]
}

export interface AnalyzeRequest {
  studentId: string
  classId?: string
  chapterNumber: number
  draftText: string
  corpus?: string
  iclExamples?: IclExample[]
  chapterFocus?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  errorContext?: AnalysisError
  chapterNumber?: number
}

export interface RemedialQuiz {
  question: string
  answer: string
  explanation: string
}

export interface RemedialContent {
  subtype: string
  quizzes: RemedialQuiz[]
  examples: string[]
}

export interface FossilizationWarning {
  isFossilized: boolean
  errorSubtype: string
  count: number
  warningMessage?: string
  remedialContent?: RemedialContent
}

export type CorpusFileType = 'pdf' | 'docx' | 'txt'

export interface CorpusParseResult {
  text: string
  fileType: CorpusFileType
  byteLength: number
  charLength: number
}

export interface CorpusUploadResponse {
  id: string
  fileName: string
  fileType: CorpusFileType
  charLength: number
  isPublic: boolean
}

// ============================================================
// 단어장 / 북마크 / 퀴즈 — Phase 2 sprint 1
// ============================================================

export interface VocabItem {
  id: string
  student_id: string
  chinese: string
  pinyin: string | null
  korean: string | null
  source_error_id: string | null
  review_count: number
  next_review_at: string | null
  created_at: string
}

export interface VocabCreateInput {
  chinese: string
  pinyin?: string
  korean?: string
  source_error_id?: string
}

export interface BookmarkItem {
  id: string
  student_id: string
  error_card_id: string | null
  sentence: string
  note: string | null
  created_at: string
}

export interface BookmarkCreateInput {
  sentence: string
  note?: string
  error_card_id?: string
}

export interface QuizQuestion {
  /** 이 문제의 근거가 된 error_card id. 정답 제출 시 이 id 로 quiz_results 에 기록된다. */
  error_card_id: string
  error_subtype: string | null
  /** 문제 지문(한국어 설명 + 중국어 빈칸). */
  question: string
  /** 정확히 5개의 선택지. correct_index 로 정답 위치를 표시한다. */
  options: string[]
  correct_index: number
  explanation: string
}

export interface QuizGenerateResponse {
  questions: QuizQuestion[]
}

export interface QuizAnswerRequest {
  error_card_id: string
  is_correct: boolean
}

export interface QuizAnswerResponse {
  recorded: boolean
  xp_awarded: number
  level: number
  xp: number
  level_up: boolean
}

// ============================================================
// 게이미피케이션 스냅샷 — 클라이언트에 내려줄 집계
// ============================================================

export interface GamificationSnapshot {
  level: number
  xp: number
  streak_days: number
  last_active_date: string | null
  next_level_xp: number | null
}
