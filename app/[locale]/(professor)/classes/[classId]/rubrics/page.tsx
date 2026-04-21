import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createServerClient } from '@/lib/supabase'
import { listMyRubrics } from '@/lib/assignments'
import RubricManager from './RubricManager'

interface ClassRow {
  id: string
  name: string
  semester: string
}

async function loadClass(classId: string, userId: string): Promise<ClassRow | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('classes')
    .select('id, name, semester')
    .eq('id', classId)
    .eq('professor_id', userId)
    .maybeSingle()
  return (data as ClassRow | null) ?? null
}

export default async function RubricsPage({ params }: { params: { classId: string } }) {
  const t = await getTranslations('pages.professor.rubrics')
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const classInfo = await loadClass(params.classId, user.id)
  if (!classInfo) notFound()

  const rubrics = await listMyRubrics(user.id)

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4">
      <div>
        <p className="text-xs text-slate-500">
          <Link href="/dashboard" className="hover:underline">
            {t('breadcrumbDashboard')}
          </Link>{' '}
          ›{' '}
          <Link href={`/classes/${classInfo.id}/assignments`} className="hover:underline">
            {classInfo.name}
          </Link>{' '}
          › {t('breadcrumbRubrics')}
        </p>
        <h1 className="text-lg font-bold text-slate-900">
          {t('title')}{' '}
          <span className="text-sm font-normal text-slate-500">({classInfo.semester})</span>
        </h1>
        <p className="mt-1 text-xs text-slate-500">{t('description')}</p>
      </div>

      <RubricManager initialRubrics={rubrics} />
    </main>
  )
}
