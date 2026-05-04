import type Anthropic from '@anthropic-ai/sdk'
import { dispatchJSON } from './ai/dispatch'
import { extractFirstJsonObject } from './parser'
import type {
  Rubric,
  RubricAIResult,
  RubricCriterion,
  RubricScoreItem
} from '@/types/assignments'

// ============================================================
// 루브릭 검증 (criteria 가중치 합 = 100)
// ============================================================

export interface CriteriaValidationError {
  ok: false
  reason: string
}
export interface CriteriaValidationOk {
  ok: true
  criteria: RubricCriterion[]
}
export type CriteriaValidation = CriteriaValidationOk | CriteriaValidationError

export function validateCriteria(raw: unknown): CriteriaValidation {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, reason: '최소 1개 이상의 평가 기준이 필요합니다' }
  }
  if (raw.length > 10) {
    return { ok: false, reason: '평가 기준은 최대 10개까지 설정할 수 있습니다' }
  }

  const cleaned: RubricCriterion[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      return { ok: false, reason: '기준 항목 형식이 올바르지 않습니다' }
    }
    const obj = item as Record<string, unknown>
    const name = typeof obj.name === 'string' ? obj.name.trim() : ''
    const description = typeof obj.description === 'string' ? obj.description.trim() : ''
    const weight = typeof obj.weight === 'number' ? obj.weight : Number.NaN
    const maxScore = typeof obj.max_score === 'number' ? obj.max_score : 100

    if (!name) return { ok: false, reason: '기준명(name)은 필수입니다' }
    if (!Number.isFinite(weight) || weight <= 0) {
      return { ok: false, reason: `'${name}' 가중치는 양수여야 합니다` }
    }
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      return { ok: false, reason: `'${name}' 만점(max_score)은 양수여야 합니다` }
    }
    cleaned.push({ name, description, weight, max_score: maxScore })
  }

  const totalWeight = cleaned.reduce((s, c) => s + c.weight, 0)
  // 소수점 오차 허용 (±0.5)
  if (Math.abs(totalWeight - 100) > 0.5) {
    return {
      ok: false,
      reason: `가중치 합이 100 이어야 합니다 (현재 ${totalWeight.toFixed(1)})`
    }
  }
  return { ok: true, criteria: cleaned }
}

/** 각 항목 점수를 가중치 기준으로 0~100 환산한 총점. */
export function computeTotalScore(
  scores: RubricScoreItem[],
  criteria: RubricCriterion[]
): number {
  const byName = new Map(criteria.map(c => [c.name, c]))
  let weighted = 0
  let totalWeight = 0
  for (const s of scores) {
    const c = byName.get(s.criterion)
    if (!c) continue
    const ratio = c.max_score > 0 ? Math.max(0, Math.min(1, s.score / c.max_score)) : 0
    weighted += ratio * c.weight
    totalWeight += c.weight
  }
  if (totalWeight <= 0) return 0
  // 기준 가중치가 100 에서 벗어나 있어도 정규화해 0~100 스케일 유지
  return Math.round((weighted / totalWeight) * 100 * 100) / 100
}

// ============================================================
// Claude 루브릭 자동 채점 프롬프트
// ============================================================

const RUBRIC_SYSTEM = `당신은 한국 대학 중국어 전공 학부생의 작문을 루브릭 기준에 따라 평가하는 전문 평가자 AI입니다.
- 언어: 학습자 모국어는 한국어. 피드백은 한국어로 작성하고, 인용이 필요한 표현은 중국어 원문을 유지합니다.
- 평가 원칙:
  · 루브릭의 각 기준(criterion)에 대해 0 ~ max_score 범위의 정수 또는 0.5 단위 점수를 부여합니다.
  · 점수 근거는 feedback 필드에 2~4문장으로 구체적인 예(문장·표현)를 포함해 작성합니다.
  · 제출문에서 확인할 수 없는 근거로 추측 감점하지 않습니다.
  · 교수자가 수정 가능하므로 과도하게 관대하거나 엄격한 점수는 피하고 규범 기반으로 일관되게 채점합니다.
- 출력: 반드시 유효한 JSON 객체 하나만 출력합니다. 마크다운 코드펜스나 설명 문장을 넣지 않습니다.`

export interface EvaluateRubricInput {
  rubric: Pick<Rubric, 'name' | 'criteria'>
  assignmentTitle: string
  assignmentPrompt: string
  draftText: string
  /** 오류 분석 결과를 함께 전달하면 일관성 있는 채점에 도움이 된다. */
  errorSummary?: {
    error_count: number
    by_subtype: Record<string, number>
  }
}

function buildUserPrompt(input: EvaluateRubricInput): string {
  const criteriaJson = JSON.stringify(input.rubric.criteria, null, 2)
  const errorBlock = input.errorSummary
    ? `\n\n[오류 분석 요약]\n- 총 오류 수: ${input.errorSummary.error_count}\n- 유형별: ${JSON.stringify(input.errorSummary.by_subtype)}`
    : ''

  return (
    `[과제 제목] ${input.assignmentTitle}\n\n` +
    `[과제 지시문]\n${input.assignmentPrompt}\n\n` +
    `[루브릭: ${input.rubric.name}]\n${criteriaJson}\n\n` +
    `[학습자 제출문]\n${input.draftText}` +
    errorBlock +
    `\n\n` +
    `위 제출문을 루브릭 기준에 따라 채점하세요.\n` +
    `각 기준마다 아래 스키마에 맞춰 점수와 피드백을 제공하고, total_score 는 가중치를 반영한 0~100 환산 점수입니다.\n\n` +
    `출력 JSON 스키마:\n` +
    `{\n` +
    `  "scores": [\n` +
    `    { "criterion": "<기준명>", "score": <0~max_score>, "max_score": <기준 max_score>, "feedback": "<한국어 피드백>" }\n` +
    `  ],\n` +
    `  "total_score": <가중치 반영 0~100>,\n` +
    `  "ai_feedback": "<제출문 전체에 대한 한 문단 총평 (한국어)>"\n` +
    `}`
  )
}

function sanitizeAIResult(raw: unknown, criteria: RubricCriterion[]): RubricAIResult {
  if (!raw || typeof raw !== 'object') throw new Error('응답이 객체가 아닙니다')
  const obj = raw as Record<string, unknown>

  const scoresRaw = Array.isArray(obj.scores) ? obj.scores : []
  const byName = new Map(criteria.map(c => [c.name, c]))
  const scores: RubricScoreItem[] = []

  for (const item of scoresRaw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const criterion = typeof o.criterion === 'string' ? o.criterion.trim() : ''
    const ref = byName.get(criterion)
    if (!ref) continue
    const score = typeof o.score === 'number' && Number.isFinite(o.score)
      ? Math.max(0, Math.min(ref.max_score, o.score))
      : 0
    const feedback = typeof o.feedback === 'string' ? o.feedback.trim() : ''
    scores.push({
      criterion,
      score,
      max_score: ref.max_score,
      feedback
    })
  }

  // 누락된 기준은 0점 + 안내 피드백으로 채워 교수자가 수정 가능한 상태로 둔다.
  for (const c of criteria) {
    if (!scores.find(s => s.criterion === c.name)) {
      scores.push({
        criterion: c.name,
        score: 0,
        max_score: c.max_score,
        feedback: '(AI가 이 기준에 대한 판단을 제공하지 못했습니다. 수동 채점이 필요합니다.)'
      })
    }
  }

  const reportedTotal = typeof obj.total_score === 'number' ? obj.total_score : NaN
  const total_score = Number.isFinite(reportedTotal)
    ? Math.max(0, Math.min(100, reportedTotal))
    : computeTotalScore(scores, criteria)

  const ai_feedback = typeof obj.ai_feedback === 'string' ? obj.ai_feedback.trim() : ''

  return { scores, total_score, ai_feedback }
}

export async function evaluateWithRubric(input: EvaluateRubricInput): Promise<RubricAIResult> {
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: RUBRIC_SYSTEM }]

  return dispatchJSON<RubricAIResult>(
    'rubric-evaluate',
    {
      system,
      messages: [{ role: 'user', content: buildUserPrompt(input) }],
      maxTokens: 4000
    },
    raw => {
      const jsonText = extractFirstJsonObject(raw)
      if (!jsonText) throw new Error('JSON 객체를 찾을 수 없습니다')
      const parsed = JSON.parse(jsonText)
      return sanitizeAIResult(parsed, input.rubric.criteria)
    }
  )
}
