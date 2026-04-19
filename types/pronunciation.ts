export type PronunciationLanguage = 'en-US' | 'ko-KR'

export type PronunciationErrorType =
  | 'word_substitution'
  | 'word_omission'
  | 'word_insertion'
  | 'stress_error'
  | 'intonation_error'
  | 'vowel_error'
  | 'consonant_error'

export interface PronunciationError {
  type: PronunciationErrorType
  word: string
  expected?: string
  recognized?: string
  explanation: string
  position: number
}

export interface PronunciationAnalysis {
  accuracy_score: number
  errors: PronunciationError[]
  tone_feedback: string
  stress_feedback: string
  overall_feedback: string
  tips: string[]
}

export interface PronunciationSession {
  id: string
  student_id: string
  target_text: string
  recognized_text: string
  accuracy_score: number
  errors: PronunciationError[]
  language: PronunciationLanguage
  created_at: string
}

export interface PronunciationAnalyzeRequest {
  targetText: string
  recognizedText: string
  language: PronunciationLanguage
}

export interface PronunciationAnalyzeResponse {
  accuracy_score: number
  analysis: PronunciationAnalysis
  session_id: string
}
