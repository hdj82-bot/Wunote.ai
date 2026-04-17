import type { CorpusParseResult, CorpusFileType } from '@/types'

export const MAX_CORPUS_FILE_BYTES = 10 * 1024 * 1024 // 10MB

function normalizeText(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function detectFileType(fileName: string): CorpusFileType {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'txt' || ext === 'text' || ext === 'md') return 'txt'
  throw new Error(`지원하지 않는 파일 형식: .${ext} (pdf, docx, txt만 허용됩니다)`)
}

async function parsePdf(buf: Buffer): Promise<string> {
  // pdf-parse 는 CommonJS 모듈이며, index.js 가 테스트 파일을 읽으려 시도해 서버리스에서
  // 에러가 나는 경우가 있어 내부 구현 파일을 직접 로드한다.
  const mod: unknown = await import('pdf-parse/lib/pdf-parse.js')
  const candidate = (mod as { default?: unknown }).default ?? mod
  if (typeof candidate !== 'function') {
    throw new Error('pdf-parse 모듈을 로드할 수 없습니다')
  }
  const pdfParse = candidate as (data: Buffer) => Promise<{ text: string }>
  const result = await pdfParse(buf)
  return normalizeText(result.text)
}

async function parseDocx(buf: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer: buf })
  return normalizeText(result.value)
}

function toBuffer(input: ArrayBuffer | Uint8Array | Buffer): Buffer {
  if (Buffer.isBuffer(input)) return input
  if (input instanceof Uint8Array) return Buffer.from(input)
  return Buffer.from(new Uint8Array(input))
}

export async function parseCorpusFile(
  data: ArrayBuffer | Uint8Array | Buffer,
  fileName: string
): Promise<CorpusParseResult> {
  const buf = toBuffer(data)
  if (buf.byteLength > MAX_CORPUS_FILE_BYTES) {
    const sizeMb = (buf.byteLength / 1024 / 1024).toFixed(1)
    throw new Error(`파일 크기가 10MB를 초과합니다 (${sizeMb}MB)`)
  }

  const fileType = detectFileType(fileName)
  let text: string
  if (fileType === 'pdf') {
    text = await parsePdf(buf)
  } else if (fileType === 'docx') {
    text = await parseDocx(buf)
  } else {
    text = normalizeText(buf.toString('utf8'))
  }

  if (!text.trim()) {
    throw new Error('파일에서 텍스트를 추출하지 못했습니다 (빈 내용이거나 스캔 이미지일 수 있습니다)')
  }

  return {
    text,
    fileType,
    byteLength: buf.byteLength,
    charLength: text.length
  }
}
