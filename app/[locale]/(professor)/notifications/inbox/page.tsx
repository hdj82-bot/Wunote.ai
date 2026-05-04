// Phase 4-B — 교수자 인앱 알림 인박스.
// [창] feat/phase4-weekly-report

import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getAuthContext } from '@/lib/auth'
import NotificationInbox from '@/components/NotificationInbox'

export const dynamic = 'force-dynamic'

export default async function ProfessorNotificationsInboxPage() {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')

  const t = await getTranslations('pages.professor.notifications.inbox')

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
