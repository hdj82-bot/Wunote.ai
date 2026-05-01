/**
 * 학생 NAV 도메인 그룹 정의 — 17개 항목을 4개 도메인으로 묶는다.
 * layout.tsx 가 이 정의를 읽어 i18n 라벨을 입혀 모바일/데스크탑 NAV 컴포넌트로 전달한다.
 */
export type StudentNavKey =
  | 'learn'
  | 'errors'
  | 'vocabulary'
  | 'bookmarks'
  | 'progress'
  | 'cardnews'
  | 'assignments'
  | 'badges'
  | 'goals'
  | 'peerReview'
  | 'translate'
  | 'urlAnalyze'
  | 'pronunciation'
  | 'portfolio'
  | 'notifications'
  | 'dataExport'
  | 'settings'

export type StudentNavGroupKey = 'study' | 'assignments' | 'tools' | 'account'

export interface StudentNavGroupDef {
  key: StudentNavGroupKey
  items: Array<{ href: string; key: StudentNavKey }>
}

export const STUDENT_NAV_GROUPS: ReadonlyArray<StudentNavGroupDef> = [
  {
    key: 'study',
    items: [
      { href: '/learn/1', key: 'learn' },
      { href: '/errors', key: 'errors' },
      { href: '/vocabulary', key: 'vocabulary' },
      { href: '/bookmarks', key: 'bookmarks' },
      { href: '/progress', key: 'progress' },
      { href: '/cardnews', key: 'cardnews' }
    ]
  },
  {
    key: 'assignments',
    items: [
      { href: '/assignments', key: 'assignments' },
      { href: '/badges', key: 'badges' },
      { href: '/goals', key: 'goals' },
      { href: '/peer-review', key: 'peerReview' }
    ]
  },
  {
    key: 'tools',
    items: [
      { href: '/translate', key: 'translate' },
      { href: '/analyze-url', key: 'urlAnalyze' },
      { href: '/pronunciation', key: 'pronunciation' },
      { href: '/portfolio', key: 'portfolio' }
    ]
  },
  {
    key: 'account',
    items: [
      { href: '/notifications', key: 'notifications' },
      { href: '/data-export', key: 'dataExport' },
      { href: '/settings', key: 'settings' }
    ]
  }
]

/**
 * 활성 라우트 판정.
 * - usePathname() 은 next-intl 환경에서도 locale 프리픽스 없이 반환되므로 (RoutingLocaleAdapter)
 *   별도 strip 없이 비교 가능.
 * - `/learn/1` 처럼 정적 챕터를 가리키는 항목은 `/learn` 으로 시작하는 모든 경로를 활성으로 본다.
 * - 그 외 항목은 정확 일치 또는 하위 경로(`href + '/'`)일 때 활성.
 */
export function isStudentNavActive(pathname: string, href: string): boolean {
  const target = href.startsWith('/learn/') ? '/learn' : href
  if (pathname === target) return true
  if (pathname.startsWith(target + '/')) return true
  return false
}
