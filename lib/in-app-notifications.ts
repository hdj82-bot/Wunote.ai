// Phase 4-B — 인앱 알림 (in_app_notifications) 발송/조회 헬퍼.
// [창] feat/phase4-weekly-report
//
// service-role(admin) 클라이언트에서 insert 한다. RLS 는 user 본인 select 만 허용.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import type { InAppNotification } from '@/types/weekly-reports'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<Database, any, any, any>

export interface CreateInAppNotificationInput {
  userId: string
  type: string
  title: string
  body?: string
  linkUrl?: string | null
  payload?: Record<string, unknown>
}

export async function createInAppNotification(
  supabase: Admin,
  input: CreateInAppNotificationInput
): Promise<string> {
  const { data, error } = await supabase
    .from('in_app_notifications')
    .insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? '',
      link_url: input.linkUrl ?? null,
      payload: (input.payload ?? {}) as unknown as Json
    })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`in_app_notifications 생성 실패: ${error?.message ?? 'no row'}`)
  }
  return (data as { id: string }).id
}

/** RLS 적용 클라이언트(=auth.uid 기반)에서 본인 알림 조회. */
export async function listInAppNotifications(
  supabase: SupabaseClient<Database>,
  userId: string,
  opts: { limit?: number; unreadOnly?: boolean } = {}
): Promise<InAppNotification[]> {
  let q = supabase
    .from('in_app_notifications')
    .select('id, user_id, type, title, body, link_url, payload, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 50)
  if (opts.unreadOnly) q = q.is('read_at', null)
  const { data, error } = await q
  if (error) throw new Error(`in_app_notifications 조회 실패: ${error.message}`)
  return ((data ?? []) as Array<{
    id: string
    user_id: string
    type: string
    title: string
    body: string
    link_url: string | null
    payload: Json
    read_at: string | null
    created_at: string
  }>).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    type: r.type,
    title: r.title,
    body: r.body,
    link_url: r.link_url,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    read_at: r.read_at,
    created_at: r.created_at
  }))
}

/** 본인 알림 읽음 처리. RLS 적용 클라이언트에서 호출. */
export async function markNotificationRead(
  supabase: SupabaseClient<Database>,
  notificationId: string
): Promise<void> {
  const { error } = await supabase
    .from('in_app_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
  if (error) throw new Error(`알림 읽음 처리 실패: ${error.message}`)
}
