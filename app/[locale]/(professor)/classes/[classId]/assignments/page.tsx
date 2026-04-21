import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createServerClient } from '@/lib/supabase'
import { listAssignmentsForClass, listMyRubrics } from '@/lib/assignments'
import AssignmentList from './AssignmentList'

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

export default async function AssignmentsPage({
  params,
}: {
  params: { classId: string }
}) {
  const t = await getTranslations('pages.professor.assignments')
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const classInfo = await loadClass(params.classId, user.id)
  if (!classInfo) notFound()

  const [assignments, rubrics] = await Promise.all([
    listAssignmentsForClass(params.classId),
    listMyRubrics(user.id),
  ])

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs text-slate-500">
            <Link href="/dashboard" className="hover:underline">
              {t('breadcrumbDashboard')}
            </Link>{' '}
            › {t('breadcrumbAssignments')}
          </p>
          <h1 className="text-lg font-bold text-slate-900">
            {classInfo.name}{' '}
            <span className="text-sm font-normal text-slate-500">({classInfo.semester})</span>
          </h1>
        </div>
        <Link
          href={`/classes/${classInfo.id}/rubrics`}
          className="text-xs text-indigo-600 hover:underline"
        >
          {t('rubricsLink')}
        </Link>
      </div>

      <AssignmentList
        classId={params.classId}
        initialAssignments={assignments}
        rubrics={rubrics}
      />
    </main>
  )
}
