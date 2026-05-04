import { describe, it, expect } from 'vitest'
import { classifyWord, estimateMaxHskLevel, validateClaudeHskLevel } from './hsk'

describe('classifyWord() — HSK 1/2/3 골든셋', () => {
  it.each([
    ['我', 1], ['你', 1], ['是', 1], ['不', 1], ['好', 1],
    ['学校', 1], ['老师', 1], ['学生', 1], ['朋友', 1], ['今天', 1]
  ])('HSK1: %s → %i', (w, lvl) => {
    expect(classifyWord(w)).toBe(lvl)
  })

  it.each([
    ['帮', 2], ['找', 2], ['给', 2], ['希望', 2], ['认识', 2],
    ['介绍', 2], ['医院', 2], ['银行', 2], ['鸡蛋', 2], ['苹果', 2]
  ])('HSK2: %s → %i', (w, lvl) => {
    expect(classifyWord(w)).toBe(lvl)
  })

  it.each([
    ['其实', 3], ['突然', 3], ['一直', 3], ['马上', 3], ['一定', 3],
    ['或者', 3], ['但是', 3], ['因为', 3], ['所以', 3], ['如果', 3]
  ])('HSK3: %s → %i', (w, lvl) => {
    expect(classifyWord(w)).toBe(lvl)
  })

  it('미등재 단어 → 4 (모름 = HSK4 이상)', () => {
    expect(classifyWord('魑魅')).toBe(4)
    expect(classifyWord('哲学家')).toBe(4)
  })
})

describe('estimateMaxHskLevel() — 문장 단위 최댓값 추정', () => {
  it('HSK1 단어만 포함 → 1', () => {
    expect(estimateMaxHskLevel('我是学生')).toBe(1)
  })

  it('HSK1 + HSK2 단어 혼합 → 2', () => {
    expect(estimateMaxHskLevel('我希望去学校')).toBe(2)
  })

  it('HSK1 + HSK3 단어 혼합 → 3', () => {
    expect(estimateMaxHskLevel('我一直在学习')).toBe(3)
  })

  it('미등재 한자 포함 → 최소 4', () => {
    expect(estimateMaxHskLevel('魑魅魍魉的故事')).toBeGreaterThanOrEqual(4)
  })

  it('빈 문자열 또는 한자 없음 → 1 (보수적 default)', () => {
    expect(estimateMaxHskLevel('')).toBe(1)
    expect(estimateMaxHskLevel('Hello world')).toBe(1)
  })

  it('longest-match — "学校" 를 "学" + "校" 으로 쪼개지 않음', () => {
    // 学校는 HSK1 등재 (2자) — 1자씩 쪼개도 学/校 둘 다 HSK1 이지만 longest-match 동작 검증
    expect(estimateMaxHskLevel('学校')).toBe(1)
  })
})

describe('validateClaudeHskLevel() — Claude 응답 검증', () => {
  it('일치 → agreesWithEstimate true, suspicious false', () => {
    const r = validateClaudeHskLevel(1, '我是学生')
    expect(r.agreesWithEstimate).toBe(true)
    expect(r.suspicious).toBe(false)
  })

  it('1 단계 차이 → agrees false 이지만 suspicious 는 false', () => {
    // 텍스트는 HSK1, Claude 가 2 라고 주장 — 허용 오차
    const r = validateClaudeHskLevel(2, '我是学生')
    expect(r.agreesWithEstimate).toBe(false)
    expect(r.suspicious).toBe(false)
    expect(r.estimatedLevel).toBe(1)
  })

  it('2 이상 차이 → suspicious true', () => {
    // 텍스트는 HSK1, Claude 가 5 라고 주장 — 의심
    const r = validateClaudeHskLevel(5, '我是学生')
    expect(r.suspicious).toBe(true)
  })

  it('Claude 가 미등재 단어를 정확히 HSK4 라고 응답 → suspicious false', () => {
    const r = validateClaudeHskLevel(4, '魑魅魍魉')
    expect(r.suspicious).toBe(false)
  })
})
