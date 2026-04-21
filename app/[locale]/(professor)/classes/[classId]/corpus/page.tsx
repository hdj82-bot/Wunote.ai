import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createServerClient } from '@/lib/supabase'
import Card from '@/components/ui/Card'
import CorpusUploader from './CorpusUploader'

const MAX_DOCS_PER_CLASS = 20

interface ClassRow {
  id: string
  name: string
  semester: string
  professor_id: string
}

interface DocRow {
  id: string
  file_name: string
  file_type: 'pdf' | 'docx' | 'txt'
  is_public: boolean
  download_count: number
  created_at: string
}

async function loadClass(classId: string, userId: string): Promise<ClassRow | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('classes')
    .select('id, name, semester, professor_id')
    .eq('id', classId)
    .eq('professor_id', userId)
    .maybeSingle()
  return (data as ClassRow | null) ?? null
}

async function loadDocs(classId: string): Promise<DocRow[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('corpus_documents')
    .select('id, file_name, file_type, is_public, download_count, created_at')
    .eq('class_id', classId)
    .order('created_at', { ascending: false })
  return (data as DocRow[] | null) ?? []
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function CorpusPage({
  params,
}: {
  params: { classId: string }
}) {
  const t = await getTranslations('pages.professor.corpus')
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const classInfo = await loadClass(params.classId, user.id)
  if (!classInfo) notFound()

  const docs = await loadDocs(params.classId)
  const atLimit = docs.length >= MAX_DOCS_PER_CLASS

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs text-slate-500">
            <Link href="/dashboard" className="hover:underline">
              {t('breadcrumbDashboard')}
            </Link>{' '}
            › {t('breadcrumbCorpus')}
          </p>
          <h1 className="text-lg font-bold text-slate-900">
            {classInfo.name}{' '}
            <span className="text-sm font-normal text-slate-500">({classInfo.semester})</span>
          </h1>
        </div>
        <p className="text-xs text-slate-500">
          {t('docsCount', { count: docs.length, max: MAX_DOCS_PER_CLASS })}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">{t('sectionUpload')}</h2>
        <CorpusUploader
          classId={params.classId}
          disabled={atLimit}
          disabledReason={atLimit ? t('atLimit', { max: MAX_DOCS_PER_CLASS }) : undefined}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">{t('sectionDocs')}</h2>
        {docs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            {t('emptyDocs')}
          </p>
        ) : (
          <ul className="space-y-2">
            {docs.map(d => (
              <li key={d.id}>
                <Card className="flex items-center gap-3 p-3">
                  <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-600">
                    {d.file_type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{d.file_name}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(d.created_at)}
                      {d.is_public && (
                        <span className="ml-2 text-indigo-600">· {t('docPublic')}</span>
                      )}
                      {d.download_count > 0 && (
                        <span className="ml-2">
                          · {t('docDownloads', { count: d.download_count })}
                        </span>
                      )}
                    </p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
