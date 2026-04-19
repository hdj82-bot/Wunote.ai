// 한→중 번역 엔진 어댑터.
// 의존성은 일부러 fetch 만 사용한다 — deepl-node / openai SDK 를 추가하지 않기 위함.
// 환경변수 키가 없는 엔진은 호출을 생략(skipped)한다.

import type { EngineResult, TranslateEngine } from '@/types/translate'

export interface EngineCaller {
  readonly name: TranslateEngine
  isConfigured(): boolean
  translate(koreanText: string): Promise<string>
}

// ------------------------------------------------------------
// DeepL — https://api-free.deepl.com/v2/translate
// free/pro 키 모두 지원하기 위해 도메인은 키 접미사(":fx")로 분기.
// ------------------------------------------------------------
class DeepLEngine implements EngineCaller {
  readonly name = 'deepl' as const

  isConfigured(): boolean {
    return !!process.env.DEEPL_API_KEY
  }

  async translate(text: string): Promise<string> {
    const key = process.env.DEEPL_API_KEY
    if (!key) throw new Error('DEEPL_API_KEY missing')

    const host = key.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com'
    const res = await fetch(`https://${host}/v2/translate`, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        text,
        source_lang: 'KO',
        target_lang: 'ZH'
      })
    })

    if (!res.ok) {
      throw new Error(`DeepL HTTP ${res.status}`)
    }
    const body = (await res.json()) as { translations?: Array<{ text: string }> }
    const first = body.translations?.[0]?.text
    if (!first) throw new Error('DeepL 응답에 translations 가 없음')
    return first
  }
}

// ------------------------------------------------------------
// Papago — https://openapi.naver.com/v1/papago/n2mt
// 네이버 오픈 API. Client ID/Secret 헤더 필요.
// ------------------------------------------------------------
class PapagoEngine implements EngineCaller {
  readonly name = 'papago' as const

  isConfigured(): boolean {
    return !!(process.env.PAPAGO_CLIENT_ID && process.env.PAPAGO_CLIENT_SECRET)
  }

  async translate(text: string): Promise<string> {
    const id = process.env.PAPAGO_CLIENT_ID
    const secret = process.env.PAPAGO_CLIENT_SECRET
    if (!id || !secret) throw new Error('PAPAGO credentials missing')

    const res = await fetch('https://openapi.naver.com/v1/papago/n2mt', {
      method: 'POST',
      headers: {
        'X-Naver-Client-Id': id,
        'X-Naver-Client-Secret': secret,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        source: 'ko',
        target: 'zh-CN',
        text
      })
    })

    if (!res.ok) {
      throw new Error(`Papago HTTP ${res.status}`)
    }
    const body = (await res.json()) as {
      message?: { result?: { translatedText?: string } }
    }
    const translated = body.message?.result?.translatedText
    if (!translated) throw new Error('Papago 응답 구조 불일치')
    return translated
  }
}

// ------------------------------------------------------------
// GPT — OpenAI Chat Completions REST.
// 정확성·일관성을 위해 system 에 번역 지시만, temperature 낮게.
// ------------------------------------------------------------
class GptEngine implements EngineCaller {
  readonly name = 'gpt' as const

  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY
  }

  async translate(text: string): Promise<string> {
    const key = process.env.OPENAI_API_KEY
    if (!key) throw new Error('OPENAI_API_KEY missing')

    const model = process.env.OPENAI_TRANSLATE_MODEL || 'gpt-4o-mini'
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              '당신은 한국어를 중국어(간체, Mandarin)로 번역하는 전문 번역가입니다. ' +
              '문체는 원문을 따르고, 설명·주석·따옴표 없이 번역문만 한 줄로 출력하세요.'
          },
          { role: 'user', content: text }
        ]
      })
    })

    if (!res.ok) {
      throw new Error(`OpenAI HTTP ${res.status}`)
    }
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = body.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error('OpenAI 응답에 content 가 없음')
    return content
  }
}

const ENGINES: readonly EngineCaller[] = [new DeepLEngine(), new PapagoEngine(), new GptEngine()]

/**
 * 세 엔진을 병렬 호출한다. 키 미설정 엔진은 skipped, 예외는 error 로 각각 기록.
 * 입력 전체가 실패해도 빈 results 배열을 돌려줄 수 있다 — 호출 측에서 판단.
 */
export async function translateWithAllEngines(koreanText: string): Promise<EngineResult[]> {
  const trimmed = koreanText.trim()
  if (!trimmed) return []

  return Promise.all(
    ENGINES.map(async (engine): Promise<EngineResult> => {
      if (!engine.isConfigured()) {
        return { engine: engine.name, status: 'skipped', translation: null }
      }
      try {
        const translation = await engine.translate(trimmed)
        return { engine: engine.name, status: 'ok', translation }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { engine: engine.name, status: 'error', translation: null, error: message }
      }
    })
  )
}

export function getConfiguredEngineNames(): TranslateEngine[] {
  return ENGINES.filter(e => e.isConfigured()).map(e => e.name)
}
