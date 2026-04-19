import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'
import { generateApiKey } from '@/lib/api-key'
import type { LMSApiKeyRecord } from '@/types/lms'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function authenticate() {
  try {
    return await requireAuth('professor')
  } catch (err) {
    if (err instanceof AuthError) throw err
    throw new AuthError('인증 확인 실패', 500)
  }
}

export async function GET() {
  let auth
  try { auth = await authenticate() } catch (err) {
    const e = err as AuthError
    return NextResponse.json({ error: e.message }, { status: e.status })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_hash, scopes, last_used_at, created_at, is_active')
    .eq('professor_id', auth.userId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 })

  const keys: LMSApiKeyRecord[] = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    key_prefix: (row.key_hash as string).slice(0, 8) + '...',
    scopes: row.scopes ?? [],
    last_used_at: row.last_used_at,
    created_at: row.created_at,
    is_active: row.is_active,
  }))

  return NextResponse.json({ keys })
}

export async function POST(req: Request) {
  let auth
  try { auth = await authenticate() } catch (err) {
    const e = err as AuthError
    return NextResponse.json({ error: e.message }, { status: e.status })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: '잘못된 요청 본문' }, { status: 400 })
  }

  const obj = body as Record<string, unknown>
  const name = typeof obj.name === 'string' ? obj.name.trim() : ''
  const scopes = Array.isArray(obj.scopes)
    ? (obj.scopes as unknown[]).filter((s): s is string => typeof s === 'string')
    : []

  if (!name) return NextResponse.json({ error: 'name 은 필수입니다' }, { status: 400 })

  const { raw, hash } = generateApiKey()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('api_keys')
    .insert({ professor_id: auth.userId, key_hash: hash, name, scopes })
    .select('id, name, scopes, created_at, is_active')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create key' }, { status: 500 })

  return NextResponse.json({
    key: raw,
    record: {
      id: data.id,
      name: data.name,
      key_prefix: hash.slice(0, 8) + '...',
      scopes: data.scopes ?? [],
      last_used_at: null,
      created_at: data.created_at,
      is_active: data.is_active,
    } satisfies LMSApiKeyRecord,
  }, { status: 201 })
}

export async function DELETE(req: Request) {
  let auth
  try { auth = await authenticate() } catch (err) {
    const e = err as AuthError
    return NextResponse.json({ error: e.message }, { status: e.status })
  }

  const url = new URL(req.url)
  const id = url.searchParams.get('id') ?? ''
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'id 가 필요합니다' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', id)
    .eq('professor_id', auth.userId)

  if (error) return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 })
  return NextResponse.json({ success: true })
}
