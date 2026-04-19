import Link from 'next/link'

const NAV = [
  { href: '/dashboard',         label: '대시보드' },
  { href: '/classes',           label: '수업 관리' },
  { href: '/reports',           label: '리포트' },
  { href: '/marketplace',       label: '마켓플레이스' },
  { href: '/reports/export',    label: '데이터 내보내기' },
  { href: '/settings/api-keys', label: 'API 키' },
]

export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-100">
      <header className="flex items-center gap-3 border-b bg-white px-4 py-2">
        <Link href="/dashboard" className="text-sm font-bold text-indigo-600">
          Wunote
        </Link>
        <nav className="hidden gap-1 sm:flex" aria-label="주요 탐색">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
