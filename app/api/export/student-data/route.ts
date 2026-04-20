import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { assembleStudentExport, buildDownloadResponse } from '@/lib/export'

export async function GET() {
  try {
    const auth = await requireAuth('student')

    const payload = await assembleStudentExport(auth.userId)

    const date = new Date().toISOString().slice(0, 10)
    const filename = `my-data-${date}.json`

    return buildDownloadResponse(JSON.stringify(payload, null, 2), 'json', filename)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[export/student-data]', err)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
