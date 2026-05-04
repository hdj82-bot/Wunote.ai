// Phase 4-B — 학생 인앱 알림 인박스.
// [창] feat/phase4-weekly-report
// NAV 노출은 PR #21 머지 후 별도 PR. 그 전엔 /notifications/inbox 직접 URL 접근.

import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getAuthContext } from '@/lib/auth'
import NotificationInbox from '@/components/NotificationInbox'

export const dynamic = 'force-dynamic'

export default async function StudentNotificationsInboxPage() {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')

  const t = await getTranslations('pages.student.notifications.inbox')

  return (
    <NotificationInbox
      labels={{
        title: t('title'),
        subtitle: t('subtitle'),
        empty: t('empty'),
        emptyUnread: t('emptyUnread'),
        loading: t('loading'),
        refresh: t('refresh'),
        markAll: t('markAll'),
        marking: t('marking'),
        filterAll: t('filterAll'),
        filterUnread: t('filterUnread'),
        open: t('open'),
        unread: t('unread'),
        loadError: t('loadError')
      }}
    />
  )
}
