import type { AnalysisResponse, AnalyzeRequest } from '@/types'
import { completeJSON } from './claude'
import { buildSystemBlocks, buildAnalyzeUserPrompt } from './prompts/base'
import { parseAnalysisResponse } from './parser'

export async function analyzeDraft(req: AnalyzeRequest): Promise<AnalysisResponse> {
  const system = buildSystemBlocks({
    corpus: req.corpus,
    iclExamples: req.iclExamples,
    chapterNumber: req.chapterNumber,
    chapterFocus: req.chapterFocus
  })

  return completeJSON<AnalysisResponse>(
    {
      system,
      messages: [{ role: 'user', content: buildAnalyzeUserPrompt(req.draftText) }],
      maxTokens: 16000,
      cacheSystem: true
    },
    parseAnalysisResponse
  )
}
