'use client'

import type { LiveStudentTotals } from '@/types/live'

interface Props {
  students: LiveStudentTotals[]
  /** 선택된 학생 id — 상세 링크에 사용 가능하도록 콜백으로 위임한다. */
  onSelect?: (studentId: string) => void
}

/**
 * 수업 중 학생별 제출/오류 요약 리스트. 오류 많은 순으로 정렬되어 들어온다.
 */
export default function StudentList({ students, onSelect }: Props) {
  if (students.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
        아직 제출한 학생이 없습니다.
      </div>
    )
  }

  const maxErrors = students.reduce((m, s) => (s.errors > m ? s.errors : m), 0)

  return (
    <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {students.map(s => {
        const ratio = maxErrors > 0 ? (s.errors / maxErrors) * 100 : 0
        return (
          <li key={s.student_id}>
            <button
              type="button"
              onClick={() => onSelect?.(s.student_id)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <div className="min-w-[6rem] truncate font-medium text-slate-800">
                {s.name ?? '(이름 없음)'}
              </div>
              <div className="flex-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-rose-400"
                    style={{ width: `${ratio.toFixed(1)}%` }}
                  />
                </div>
              </div>
              <div className="flex shrink-0 gap-2 text-xs text-slate-600">
                <span title="제출 수">📝 {s.submissions}</span>
                <span className="font-semibold text-rose-600" title="오류 수">
                  ⚠ {s.errors}
                </span>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
