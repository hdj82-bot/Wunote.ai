import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { assembleProfessorExport, serializeToCSV, buildDownloadResponse } from '@/lib/export'
import type { ResearchExportOptions } from '@/types/export'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('professor')

    const body = (await req.json()) as Partial<ResearchExportOptions>

    if (!body.classId) {
      return NextResponse.json({ error: 'classId is required' }, { status: 400 })
    }

    const options: ResearchExportOptions = {
      classId: body.classId,
      startDate: body.startDate,
      endDate: body.endDate,
      format: body.format ?? 'csv',
      anonymizationLevel: body.anonymizationLevel ?? 'partial',
    }

    const payload = await assembleProfessorExport(auth.userId, options)

    const date = new Date().toISOString().slice(0, 10)
    const filename = `research-${options.classId.slice(0, 8)}-${date}.${options.format}`

    if (options.format === 'csv') {
      const rows = payload.errors.map(e => ({
        student_hash: e.studentHash,
        session_id: e.sessionId,
        chapter: e.chapter,
        error_type: e.errorType,
        error_subtype: e.errorSubtype,
        error_span: e.errorSpan,
        correction: e.correction,
        hsk_level: e.hskLevel ?? '',
        fossilization_count: e.fossilizationCount,
        created_at: e.createdAt,
      }))
      const csv = serializeToCSV(rows)
      return buildDownloadResponse(csv, 'csv', filename)
    }

    return buildDownloadResponse(JSON.stringify(payload, null, 2), 'json', filename)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[export/research]', err)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
