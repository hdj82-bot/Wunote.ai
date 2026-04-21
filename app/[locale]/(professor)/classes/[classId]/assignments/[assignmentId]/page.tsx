import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createServerClient } from '@/lib/supabase'
import { getAssignment, getRubric, listSubmissions } from '@/lib/assignments'
import SubmissionsClient from './SubmissionsClient'

interface ClassRow {
  id: string
  name: string
}

async function loadClass(classId: string, userId: string): Promise<ClassRow | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('classes')
    .select('id, name')
    .eq('id', classId)
    .eq('professor_id', userId)
    .maybeSingle()
  return (data as ClassRow | null) ?? null
}

export default async function AssignmentDetailPage({
  params,
}: {
  params: { classId: string; assignmentId: string }
}) {
  const t = await getTranslations('pages.professor.assignmentDetail')
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const classInfo = await loadClass(params.classId, user.id)
  if (!classInfo) notFound()

  const assignment = await getAssignment(params.assignmentId)
  if (!assignment || assignment.class_id !== params.classId) notFound()

  const [rubric, submissions] = await Promise.all([
    assignment.rubric_id ? getRubric(assignment.rubric_id) : Promise.resolve(null),
    listSubmissions(assignment.id),
  ])

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <div>
        <p className="text-xs text-slate-500">
          <Link href="/dashboard" className="hover:underline">
            {t('breadcrumbDashboard')}
          </Link>{' '}
          ›{' '}
          <Link href={`/classes/${classInfo.id}/assignments`} className="hover:underline">
            {classInfo.name}
          </Link>{' '}
          › {t('breadcrumbAssignments')}
        </p>
        <h1 className="text-lg font-bold text-slate-900">{assignment.title}</h1>
        {assignment.due_date && (
          <p className="text-xs text-slate-500">
            {t('due', {
              datetime: new Date(assignment.due_date).toLocaleString(),
            })}
          </p>
        )}
        <details className="mt-2 rounded border bg-white p-2 text-xs text-slate-700">
          <summary className="cursor-pointer text-slate-500">{t('promptToggle')}</summary>
          <p className="mt-2 whitespace-pre-wrap">{assignment.prompt_text}</p>
        </details>
      </div>

      <SubmissionsClient
        assignment={assignment}
        rubric={rubric}
        initialSubmissions={submissions}
      />
    </main>
  )
}
