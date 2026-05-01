'use client'

import { useEffect, useState } from 'react'
import { Link, usePathname } from '@/i18n/routing'
import {
  STUDENT_NAV_GROUPS,
  isStudentNavActive,
  type StudentNavKey,
  type StudentNavGroupKey
} from './nav/studentNavGroups'

interface Props {
  labels: Record<StudentNavKey, string>
  groupLabels: Record<StudentNavGroupKey, string>
  openLabel: string
  closeLabel: string
}

export default function StudentMobileNav({
  labels,
  groupLabels,
  openLabel,
  closeLabel
}: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="student-mobile-nav-drawer"
        aria-label={open ? closeLabel : openLabel}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded text-slate-700 hover:bg-slate-100"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          {open ? (
            <path
              d="M5 5l10 10M15 5L5 15"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          ) : (
            <>
              <path d="M3 5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M3 10h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </>
          )}
        </svg>
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 top-[49px] z-30 bg-slate-900/30"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <nav
            id="student-mobile-nav-drawer"
            aria-label={openLabel}
            className="fixed inset-x-0 top-[49px] z-40 max-h-[calc(100dvh-49px)] overflow-y-auto border-b bg-white shadow-md"
          >
            {STUDENT_NAV_GROUPS.map((group, groupIdx) => (
              <section
                key={group.key}
                aria-labelledby={`student-nav-group-${group.key}`}
                className={groupIdx > 0 ? 'border-t border-slate-100' : ''}
              >
                <h2
                  id={`student-nav-group-${group.key}`}
                  className="sticky top-0 z-10 bg-white/95 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur-sm"
                >
                  {groupLabels[group.key]}
                </h2>
                <ul className="flex flex-col py-1">
                  {group.items.map((item) => {
                    const active = isStudentNavActive(pathname, item.href)
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={`block px-4 py-2 text-sm transition-colors ${
                            active
                              ? 'bg-indigo-50 font-semibold text-indigo-700'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {labels[item.key]}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </nav>
        </>
      )}
    </div>
  )
}
