import { NextResponse } from 'next/server'
import { AuthError, requireAuth } from '@/lib/auth'
import { downloadMarketplaceDoc } from '@/lib/marketplace'

export const runtime = 'nodejs'

const CONTENT_TYPE: Record<string, string> = {
  pdf: 'text/plain; charset=utf-8', // 원본 파일이 아니라 파싱된 텍스트만 배포한다
  docx: 'text/plain; charset=utf-8',
  txt: 'text/plain; charset=utf-8'
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth('professor')
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: '인증 확인 중 오류가 발생했습니다' }, { status: 500 })
  }

  let result
  try {
    result = await downloadMarketplaceDoc(params.id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '다운로드 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  if (!result) {
    return NextResponse.json({ error: '존재하지 않거나 비공개 자료입니다' }, { status: 404 })
  }

  // 파싱된 텍스트를 .txt 로 내려보낸다. 원본 바이너리 재분배는 저작권 이슈가 있을 수 있어 제외.
  const safeName = result.fileName.replace(/[^\w.\-]+/g, '_')
  const headers = new Headers()
  headers.set('Content-Type', CONTENT_TYPE[result.fileType] ?? 'text/plain; charset=utf-8')
  headers.set(
    'Content-Disposition',
    `attachment; filename="${safeName}.txt"; filename*=UTF-8''${encodeURIComponent(result.fileName)}.txt`
  )
  headers.set('X-Download-Count', String(result.newCount))

  return new Response(result.content, { status: 200, headers })
}
