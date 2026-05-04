import { describe, it, expect } from 'vitest'
import {
  modelForTask,
  cacheTierForTask,
  policyForTask,
  ROUTER_OPUS,
  ROUTER_HAIKU,
  type TaskKind
} from './router'

describe('router policy', () => {
  it('analyze (CoT 핵심) → Opus 4.7', () => {
    expect(modelForTask('analyze')).toBe(ROUTER_OPUS)
  })

  it('tutor-chat → Opus 4.7', () => {
    expect(modelForTask('tutor-chat')).toBe(ROUTER_OPUS)
  })

  it('cardnews / pronunciation / translate-compare → Haiku 4.5', () => {
    expect(modelForTask('cardnews')).toBe(ROUTER_HAIKU)
    expect(modelForTask('pronunciation')).toBe(ROUTER_HAIKU)
    expect(modelForTask('translate-compare')).toBe(ROUTER_HAIKU)
  })

  it('rubric-evaluate / professor-report → 1h 캐시 (코퍼스 갱신 빈도 낮음)', () => {
    expect(cacheTierForTask('rubric-evaluate')).toBe('1h')
    expect(cacheTierForTask('professor-report')).toBe('1h')
  })

  it('analyze / chat / cardnews → 5m 캐시 (기본)', () => {
    expect(cacheTierForTask('analyze')).toBe('5m')
    expect(cacheTierForTask('tutor-chat')).toBe('5m')
    expect(cacheTierForTask('cardnews')).toBe('5m')
  })

  it('policyForTask 는 reason 문자열 포함', () => {
    const p = policyForTask('analyze')
    expect(p.reason.length).toBeGreaterThan(0)
  })

  it('모든 TaskKind 에 정책이 정의되어 있다', () => {
    const kinds: TaskKind[] = [
      'analyze', 'tutor-chat', 'cardnews', 'rubric-evaluate',
      'pronunciation', 'translate-compare', 'url-analyze',
      'quiz-generate', 'remedial', 'professor-report'
    ]
    for (const k of kinds) {
      const p = policyForTask(k)
      expect(p.model === ROUTER_OPUS || p.model === ROUTER_HAIKU).toBe(true)
    }
  })

  it('CoT 작업은 항상 Opus, 단순 작업은 Haiku — 정책 invariant', () => {
    expect(modelForTask('analyze')).toBe(ROUTER_OPUS)
    expect(modelForTask('remedial')).toBe(ROUTER_OPUS)
    expect(modelForTask('quiz-generate')).toBe(ROUTER_HAIKU)
  })
})
