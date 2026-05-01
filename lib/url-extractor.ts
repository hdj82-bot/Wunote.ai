// Cheerio 래퍼 — 학습자가 입력한 중국어 뉴스/SNS URL 의 본문 텍스트를 추출한다.
// 호스트 패턴으로 source_type 자동 판정. 사이트별로 다른 selector 우선순위를 적용한다.
//
// 의존성: `cheerio` 패키지가 별도로 설치되어 있어야 한다 (PR 본문에서 사용자에게 별도 안내).
// 동적 import 를 사용해 프로덕션 빌드 시 패키지 미설치여도 라우트 자체가 오류 없이 빌드되도록 한다.

import type { ExtractedContent, UrlSourceType } from '@/types/url-analysis'

const FETCH_TIMEOUT_MS = 10_000
const MAX_BYTES = 2_000_000 // 2 MB
const MAX_CHARS = 12_000 // Claude 호출 직전 슬라이스 — 비용·토큰 보호
// 일반적인 모바일/데스크톱 브라우저 UA. 일부 SNS 가 서버 응답 시 봇을 차단하므로 위장.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export class UrlExtractError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'UrlExtractError'
    this.status = status
  }
}

interface SiteRule {
  match: (host: string) => boolean
  source_type: UrlSourceType
  /** 본문 후보 selector 를 우선순위 순으로 시도한다. */
  selectors: string[]
}

const SITE_RULES: SiteRule[] = [
  {
    match: h => h.includes('weibo.com') || h.includes('weibo.cn'),
    source_type: 'weibo',
    selectors: [
      'div.WB_text',
      'article .Feed_body_3R0rO',
      'article',
      'div[node-type="feed_list_content"]',
      'meta[name="description"]'
    ]
  },
  {
    match: h => h.includes('xiaohongshu.com') || h.includes('xhs.cn') || h.includes('xhscdn.com'),
    source_type: 'xiaohongshu',
    selectors: [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'div#detail-desc',
      'div.note-content',
      'div.desc'
    ]
  },
  {
    match: h => h.includes('xinhuanet.com') || h.includes('news.cn') || h.includes('xinhua-news'),
    source_type: 'news',
    selectors: ['div#detail', 'div.article', 'div.content', 'article']
  },
  {
    match: h =>
      h.includes('people.com.cn') ||
      h.includes('chinadaily.com.cn') ||
      h.includes('cctv.com') ||
      h.includes('thepaper.cn') ||
      h.includes('sina.com.cn') ||
      h.includes('sohu.com') ||
      h.includes('163.com') ||
      h.includes('qq.com') ||
      h.includes('ifeng.com'),
    source_type: 'news',
    selectors: ['article', 'div.article', 'div#content', 'div.content', 'div.post_text']
  }
]

/** URL 호스트로부터 source_type 을 추정. 매칭되는 규칙이 없으면 'other'. */
export function detectSourceType(url: string): UrlSourceType {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return 'other'
  }
  const rule = SITE_RULES.find(r => r.match(host))
  return rule?.source_type ?? 'other'
}

function getSelectorsFor(host: string): string[] {
  const rule = SITE_RULES.find(r => r.match(host))
  if (rule) return rule.selectors
  // 일반 페이지 fallback — 시맨틱 우선 → og:description.
  return [
    'article',
    'main',
    'div.article',
    'div#content',
    'div.content',
    'meta[property="og:description"]',
    'meta[name="description"]'
  ]
}

function normalizeWhitespace(s: string): string {
  return s
    .replace(/[\r\t\f\v]+/g, ' ')
    .replace(/ /g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,ko;q=0.8,en;q=0.7'
      },
      signal: controller.signal,
      redirect: 'follow'
    })
    if (!res.ok) {
      throw new UrlExtractError(`URL 요청 실패: HTTP ${res.status}`, 502)
    }
    const ct = res.headers.get('content-type') ?? ''
    if (!/text\/html|xml|application\/xhtml/.test(ct) && ct !== '') {
      throw new UrlExtractError(`HTML 이 아닌 응답: ${ct}`, 415)
    }
    const buf = await res.arrayBuffer()
    if (buf.byteLength > MAX_BYTES) {
      throw new UrlExtractError(`페이지가 너무 큽니다 (>${MAX_BYTES} bytes)`, 413)
    }
    // 중국어 페이지는 GB2312/GBK 가 흔하지만 modern fetch + Cheerio 는 UTF-8 우선.
    // charset 협상은 단순화: <meta charset> 까지 정확히 해석하려면 별도 라이브러리 필요.
    return new TextDecoder('utf-8', { fatal: false }).decode(buf)
  } catch (err) {
    if (err instanceof UrlExtractError) throw err
    if ((err as Error).name === 'AbortError') {
      throw new UrlExtractError('URL 요청이 시간 초과되었습니다', 504)
    }
    const msg = err instanceof Error ? err.message : String(err)
    throw new UrlExtractError(`URL 요청 중 오류: ${msg}`, 502)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 주어진 URL 의 본문 텍스트를 추출한다.
 * - http(s) 만 허용 (file://, data:, javascript: 차단)
 * - 호스트별 selector 우선순위 적용 → 가장 긴 텍스트 후보 채택
 * - 추출 실패 시 og:description / <body> 마지막 폴백
 */
export async function extractContent(rawUrl: string): Promise<ExtractedContent> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new UrlExtractError('유효한 URL 이 아닙니다', 400)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UrlExtractError('http(s) URL 만 지원합니다', 400)
  }

  const html = await fetchHtml(parsed.toString())

  // cheerio 는 옵션 의존성 — `npm install cheerio` 후 활성화. 미설치 시 친절한 에러로 변환.
  // ts-ignore 는 cheerio 가 설치되기 전 타입체크 통과를 위한 일시 우회. 설치 후 제거 가능.
  type CheerioNode = {
    length: number
    text: () => string
    attr: (name: string) => string | undefined
    first: () => CheerioNode
    remove: () => void
  }
  type CheerioRoot = (selector: string) => CheerioNode
  type CheerioModule = { load: (html: string) => CheerioRoot }
  let cheerio: CheerioModule
  try {
    // @ts-ignore -- cheerio 미설치 환경에서도 빌드되도록 모듈 해결을 우회한다
    cheerio = (await import('cheerio')) as unknown as CheerioModule
  } catch {
    throw new UrlExtractError(
      'cheerio 패키지가 설치되어 있지 않습니다. `npm install cheerio` 후 다시 시도해주세요.',
      500
    )
  }

  const $ = cheerio.load(html)
  // 잡음 제거.
  $('script, style, noscript, iframe, svg, nav, footer, header, aside').remove()

  const host = parsed.hostname.toLowerCase()
  const selectors = getSelectorsFor(host)

  let bestText = ''
  for (const sel of selectors) {
    const node = $(sel).first()
    if (!node || node.length === 0) continue
    let candidate = ''
    if (sel.startsWith('meta')) {
      candidate = (node.attr('content') ?? '').trim()
    } else {
      candidate = node.text().trim()
    }
    candidate = normalizeWhitespace(candidate)
    if (candidate.length > bestText.length) {
      bestText = candidate
    }
    // selector 우선순위가 높은 데서 충분히 길면 조기 종료.
    if (bestText.length >= 200) break
  }

  // 폴백: 그래도 빈약하면 body 전체.
  if (bestText.length < 80) {
    const bodyText = normalizeWhitespace($('body').text())
    if (bodyText.length > bestText.length) bestText = bodyText
  }

  if (!bestText) {
    throw new UrlExtractError('본문 텍스트를 추출하지 못했습니다', 422)
  }

  const sliced = bestText.slice(0, MAX_CHARS)
  const pageTitle = normalizeWhitespace($('title').first().text() || '')
  const source_type = detectSourceType(parsed.toString())

  return {
    url: parsed.toString(),
    source_type,
    page_title: pageTitle,
    content_text: sliced,
    char_count: sliced.length
  }
}
