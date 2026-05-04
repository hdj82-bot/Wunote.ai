import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import LanguageSwitcher from '@/components/LanguageSwitcher'

type NavKey =
  | 'dashboard'
  | 'classes'
  | 'live'
  | 'reports'
  | 'inbox'
  | 'marketplace'
  | 'dataExport'
  | 'apiKeys'

const NAV: Array<{ href: string; key: NavKey; fallback: string }> = [
  { href: '/dashboard', key: 'dashboard', fallback: '대시보드' },
  { href: '/classes', key: 'classes', fallback: '수업 관리' },
  { href: '/live', key: 'live', fallback: '실시간 수업' },
  { href: '/reports', key: 'reports', fallback: '리포트' },
  { href: '/notifications/inbox', key: 'inbox', fallback: '알림함' },
  { href: '/marketplace', key: 'marketplace', fallback: '마켓플레이스' },
  { href: '/reports/export', key: 'dataExport', fallback: '데이터 내보내기' },
  { href: '/settings/api-keys', key: 'apiKeys', fallback: 'API 키' },
]

// 교수자 네비에만 있는 apiKeys / dataExport 는 messages 에 professor.* 로만 존재 (또는 student.dataExport 재사용).
// 누락 키는 fallback 으로 한국어 표시.
function safeT(t: (k: string) => string, key: string, fallback: string): string {
  try {
    const v = t(key)
    return v === key ? fallback : v
  } catch {
    return fallback
  }
}

export default async function ProfessorLayout({ children }: { children: React.ReactNode }) {
  const [t, tMeta] = await Promise.all([
    getTranslations('nav.professor'),
    getTranslations('meta'),
  ])

  return (
    <div className="flex min-h-dvh flex-col bg-slate-100">
      <header className="flex items-center gap-3 border-b bg-white px-4 py-2">
        <Link href="/dashboard" className="text-sm font-bold text-indigo-600">
          {tMeta('appName')}
        </Link>
        <nav className="hidden gap-1 sm:flex" aria-label={tMeta('appName')}>
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {safeT(t, n.key, n.fallback)}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <LanguageSwitcher />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
