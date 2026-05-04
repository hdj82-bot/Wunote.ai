export const ROUTER_OPUS = 'claude-opus-4-7' as const
export const ROUTER_HAIKU = 'claude-haiku-4-5' as const

export type RouterModel = typeof ROUTER_OPUS | typeof ROUTER_HAIKU

export type TaskKind =
  | 'analyze'
  | 'tutor-chat'
  | 'cardnews'
  | 'rubric-evaluate'
  | 'pronunciation'
  | 'translate-compare'
  | 'url-analyze'
  | 'quiz-generate'
  | 'remedial'
  | 'professor-report'

interface ModelChoice {
  model: RouterModel
  cacheTier: '5m' | '1h' | false
  reason: string
}

const POLICY: Record<TaskKind, ModelChoice> = {
  analyze:            { model: ROUTER_OPUS,  cacheTier: '5m', reason: 'CoT 추론·정확성 우선' },
  'tutor-chat':       { model: ROUTER_OPUS,  cacheTier: '5m', reason: '학생 1:1 대화 — 추론 품질 우선' },
  remedial:           { model: ROUTER_OPUS,  cacheTier: '5m', reason: '화석화 교정 — 깊은 설명 필요' },
  'rubric-evaluate':  { model: ROUTER_OPUS,  cacheTier: '1h', reason: '루브릭은 갱신 빈도 매우 낮음' },
  cardnews:           { model: ROUTER_HAIKU, cacheTier: '5m', reason: '주간 요약 — 비용 절감' },
  pronunciation:      { model: ROUTER_HAIKU, cacheTier: '5m', reason: '발음 단순 분류' },
  'translate-compare':{ model: ROUTER_HAIKU, cacheTier: '5m', reason: '번역 비교 — 짧고 결정적' },
  'url-analyze':      { model: ROUTER_HAIKU, cacheTier: '5m', reason: 'URL 어휘·문체 추출' },
  'quiz-generate':    { model: ROUTER_HAIKU, cacheTier: '5m', reason: '오류카드 기반 빈칸 생성' },
  'professor-report': { model: ROUTER_HAIKU, cacheTier: '1h', reason: '주간 집계 — 코퍼스 RAG 캐시' }
}

export function modelForTask(kind: TaskKind): RouterModel {
  return POLICY[kind].model
}

export function cacheTierForTask(kind: TaskKind): '5m' | '1h' | false {
  return POLICY[kind].cacheTier
}

export function policyForTask(kind: TaskKind): ModelChoice {
  return POLICY[kind]
}
