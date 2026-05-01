'use client'

import { Link, usePathname } from '@/i18n/routing'
import {
  STUDENT_NAV_GROUPS,
  isStudentNavActive,
  type StudentNavKey,
  type StudentNavGroupKey
} from './studentNavGroups'

interface Props {
  /** 모든 항목과 그룹의 i18n 라벨을 서버에서 미리 풀어 전달한다. */
  labels: Record<StudentNavKey, string>
  groupLabels: Record<StudentNavGroupKey, string>
  ariaLabel: string
}

/**
 * 데스크탑(sm 이상) 인라인 NAV.
 *
 * 17개 항목을 한 줄에 평면 배치하되, 그룹 순서대로 정렬하고 그룹 사이에는
 * 얇은 vertical divider (1px slate-200) 를 삽입해 시각적으로 구분한다.
 * 그룹 라벨 텍스트는 데스크탑 헤더 폭이 부족해질 수 있어 hover/aria 로만 노출.
 */
export default function StudentDesktopNav({ labels, groupLabels, ariaLabel }: Props) {
  const pathname = usePathname()

  return (
    <nav className="hidden items-center gap-1 sm:flex" aria-label={ariaLabel}>
      {STUDENT_NAV_GROUPS.map((group, groupIdx) => (
        <div
          key={group.key}
          role="group"
          aria-label={groupLabels[group.key]}
          className="flex items-center gap-1"
        >
          {groupIdx > 0 && <span aria-hidden className="mx-1 h-4 w-px bg-slate-200" />}
          {group.items.map((item) => {
            const active = isStudentNavActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  active
                    ? 'bg-indigo-50 font-semibold text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {labels[item.key]}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
