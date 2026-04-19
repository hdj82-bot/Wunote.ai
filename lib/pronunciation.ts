import { createServerClient } from '@/lib/supabase'
import type { PronunciationSession, PronunciationError, PronunciationLanguage } from '@/types/pronunciation'

export function computeAccuracy(targetText: string, recognizedText: string): number {
  const targetWords = tokenize(targetText)
  if (targetWords.length === 0) return 100

  const pool = tokenize(recognizedText)
  let matches = 0

  for (const word of targetWords) {
    const idx = pool.indexOf(word)
    if (idx !== -1) {
      matches++
      pool.splice(idx, 1)
    }
  }

  return Math.round((matches / targetWords.length) * 100)
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"()\[\]{}]/g, '')
    .split(/\s+/)
    .filter(Boolean)
}

export function diffWords(
  targetText: string,
  recognizedText: string
): { word: string; status: 'correct' | 'substituted' | 'missing' | 'extra'; recognized?: string }[] {
  const targetWords = tokenize(targetText)
  const recognizedWords = tokenize(recognizedText)
  const result: { word: string; status: 'correct' | 'substituted' | 'missing' | 'extra'; recognized?: string }[] = []

  let ti = 0
  let ri = 0

  while (ti < targetWords.length && ri < recognizedWords.length) {
    if (targetWords[ti] === recognizedWords[ri]) {
      result.push({ word: targetWords[ti], status: 'correct' })
      ti++
      ri++
    } else {
      const futureTargetIdx = targetWords.indexOf(recognizedWords[ri], ti + 1)
      const futureRecognizedIdx = recognizedWords.indexOf(targetWords[ti], ri + 1)

      if (futureTargetIdx !== -1 && (futureRecognizedIdx === -1 || futureTargetIdx < futureRecognizedIdx)) {
        result.push({ word: targetWords[ti], status: 'missing' })
        ti++
      } else if (futureRecognizedIdx !== -1) {
        result.push({ word: recognizedWords[ri], status: 'extra' })
        ri++
      } else {
        result.push({ word: targetWords[ti], status: 'substituted', recognized: recognizedWords[ri] })
        ti++
        ri++
      }
    }
  }

  while (ti < targetWords.length) {
    result.push({ word: targetWords[ti++], status: 'missing' })
  }

  return result
}

export async function savePronunciationSession(params: {
  studentId: string
  targetText: string
  recognizedText: string
  accuracyScore: number
  errors: PronunciationError[]
  language: PronunciationLanguage
}): Promise<string> {
  const supabase = createServerClient()

  const { data, error } = await (supabase as any)
    .from('pronunciation_sessions')
    .insert({
      student_id: params.studentId,
      target_text: params.targetText,
      recognized_text: params.recognizedText,
      accuracy_score: params.accuracyScore,
      errors: params.errors,
      language: params.language,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to save pronunciation session: ${error.message}`)
  return (data as { id: string }).id
}

export async function getPronunciationHistory(studentId: string): Promise<PronunciationSession[]> {
  const supabase = createServerClient()

  const { data, error } = await (supabase as any)
    .from('pronunciation_sessions')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new Error(`Failed to fetch pronunciation history: ${error.message}`)
  return (data ?? []) as PronunciationSession[]
}

export async function getPronunciationStats(studentId: string): Promise<{
  totalSessions: number
  averageAccuracy: number
  bestAccuracy: number
  recentSessions: PronunciationSession[]
}> {
  const sessions = await getPronunciationHistory(studentId)

  if (sessions.length === 0) {
    return { totalSessions: 0, averageAccuracy: 0, bestAccuracy: 0, recentSessions: [] }
  }

  const scores = sessions.map(s => s.accuracy_score)
  const averageAccuracy = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  const bestAccuracy = Math.max(...scores)

  return {
    totalSessions: sessions.length,
    averageAccuracy,
    bestAccuracy,
    recentSessions: sessions.slice(0, 10),
  }
}
