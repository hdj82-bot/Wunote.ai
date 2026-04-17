import type { IclExample } from '@/types'
import { CHAPTER_0_FOCUS, CHAPTER_0_ICL } from './chapter0'
import { CHAPTER_1_FOCUS, CHAPTER_1_ICL } from './chapter1'
import { CHAPTER_2_FOCUS, CHAPTER_2_ICL } from './chapter2'
import { CHAPTER_3_FOCUS, CHAPTER_3_ICL } from './chapter3'
import { CHAPTER_4_FOCUS, CHAPTER_4_ICL } from './chapter4'
import { CHAPTER_5_FOCUS, CHAPTER_5_ICL } from './chapter5'
import { CHAPTER_6_FOCUS, CHAPTER_6_ICL } from './chapter6'
import { CHAPTER_7_FOCUS, CHAPTER_7_ICL } from './chapter7'

export interface ChapterConfig {
  chapterNumber: number
  chapterFocus: string
  iclExamples: IclExample[]
  /** 제7장은 AI 검증 모드로 draftText 포맷이 다르다는 점을 표시한다. */
  isVerificationMode?: boolean
}

const CHAPTERS: Record<number, ChapterConfig> = {
  0: { chapterNumber: 0, chapterFocus: CHAPTER_0_FOCUS, iclExamples: CHAPTER_0_ICL },
  1: { chapterNumber: 1, chapterFocus: CHAPTER_1_FOCUS, iclExamples: CHAPTER_1_ICL },
  2: { chapterNumber: 2, chapterFocus: CHAPTER_2_FOCUS, iclExamples: CHAPTER_2_ICL },
  3: { chapterNumber: 3, chapterFocus: CHAPTER_3_FOCUS, iclExamples: CHAPTER_3_ICL },
  4: { chapterNumber: 4, chapterFocus: CHAPTER_4_FOCUS, iclExamples: CHAPTER_4_ICL },
  5: { chapterNumber: 5, chapterFocus: CHAPTER_5_FOCUS, iclExamples: CHAPTER_5_ICL },
  6: { chapterNumber: 6, chapterFocus: CHAPTER_6_FOCUS, iclExamples: CHAPTER_6_ICL },
  7: {
    chapterNumber: 7,
    chapterFocus: CHAPTER_7_FOCUS,
    iclExamples: CHAPTER_7_ICL,
    isVerificationMode: true
  }
}

/**
 * chapterNumber 에 해당하는 집중 포커스·ICL 을 반환한다.
 * 0~7 범위 밖이면 null. 호출측에서 수업 자체 chapterFocus / iclExamples 와 병합할 수 있도록 분리 반환한다.
 */
export function getChapterConfig(chapterNumber: number): ChapterConfig | null {
  if (!Number.isInteger(chapterNumber)) return null
  return CHAPTERS[chapterNumber] ?? null
}

export const SUPPORTED_CHAPTERS = Object.keys(CHAPTERS).map(Number).sort((a, b) => a - b)
