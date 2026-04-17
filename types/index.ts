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
