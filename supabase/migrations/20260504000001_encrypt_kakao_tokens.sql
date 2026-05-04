-- Wunote.ai — Kakao OAuth 토큰 평문 → pgcrypto 대칭 암호화로 전환.
-- 기존 plaintext 컬럼(kakao_access_token / kakao_refresh_token) 을 bytea 로 옮기고
-- 앱 코드에서는 SECURITY DEFINER RPC 를 통해서만 read/write 한다.
--
-- 키 관리:
--   앱 측이 매 호출 시 process.env.KAKAO_TOKEN_ENCRYPTION_KEY 를 p_key 로 전달한다.
--   DB 에는 키를 저장하지 않는다. service_role 만 RPC 실행 가능.
--
-- 백필:
--   기존 데이터가 평문으로 남아 있을 수 있으므로, 마이그레이션 실행 시점에
--   세션 GUC `app.kakao_token_key` 가 설정되어 있으면 암호화하여 옮긴다.
--   미설정이면 NOTICE 후 평문 컬럼을 그냥 drop — 사용자는 카카오 재연동이 필요하다.
--
--   설정 예 (Supabase SQL Editor):
--     select set_config('app.kakao_token_key', '<KAKAO_TOKEN_ENCRYPTION_KEY>', false);
--     -- 이 트랜잭션 내에서 본 마이그레이션을 실행.

create extension if not exists "pgcrypto";

-- ============================================================
-- 1. 새 암호화 컬럼 추가
-- ============================================================
alter table public.notification_settings
  add column if not exists kakao_access_token_enc  bytea,
  add column if not exists kakao_refresh_token_enc bytea;

-- ============================================================
-- 2. 백필 — 기존 평문이 있으면 암호화하여 옮긴다
-- ============================================================
do $$
declare
  v_key text := nullif(current_setting('app.kakao_token_key', true), '');
  v_count int;
begin
  select count(*) into v_count
    from public.notification_settings
    where kakao_access_token is not null or kakao_refresh_token is not null;

  if v_count = 0 then
    raise notice '[encrypt_kakao_tokens] 기존 평문 토큰 없음 — 백필 스킵';
    return;
  end if;

  if v_key is null then
    raise notice
      '[encrypt_kakao_tokens] app.kakao_token_key 미설정 — % 행의 평문 토큰을 암호화 없이 폐기. 사용자는 카카오 재연동 필요.',
      v_count;
    return;
  end if;

  update public.notification_settings
     set kakao_access_token_enc =
           case when kakao_access_token is not null
                then pgp_sym_encrypt(kakao_access_token, v_key)
                else null end,
         kakao_refresh_token_enc =
           case when kakao_refresh_token is not null
                then pgp_sym_encrypt(kakao_refresh_token, v_key)
                else null end
   where kakao_access_token is not null
      or kakao_refresh_token is not null;

  raise notice '[encrypt_kakao_tokens] % 행 백필 완료', v_count;
end $$;

-- ============================================================
-- 3. 평문 컬럼 제거 (이후 어떤 경로로도 평문 저장 불가)
-- ============================================================
alter table public.notification_settings
  drop column if exists kakao_access_token,
  drop column if exists kakao_refresh_token;

-- ============================================================
-- 4. RPC: 토큰 set / get / clear
-- ============================================================

-- 평문 access/refresh 토큰을 받아 즉시 암호화하여 저장한다.
-- 호출 측은 service_role 컨텍스트여야 한다 (RLS 우회 + grant 매트릭스).
create or replace function public.kakao_set_tokens(
  p_user_id        uuid,
  p_access         text,
  p_refresh        text,
  p_kakao_user_id  text,
  p_key            text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key is null or length(p_key) = 0 then
    raise exception 'kakao_set_tokens: p_key required';
  end if;

  insert into public.notification_settings (
    user_id,
    kakao_access_token_enc,
    kakao_refresh_token_enc,
    kakao_user_id
  ) values (
    p_user_id,
    case when p_access  is not null then pgp_sym_encrypt(p_access,  p_key) else null end,
    case when p_refresh is not null then pgp_sym_encrypt(p_refresh, p_key) else null end,
    p_kakao_user_id
  )
  on conflict (user_id) do update
    set kakao_access_token_enc =
          case when excluded.kakao_access_token_enc is not null
               then excluded.kakao_access_token_enc
               else public.notification_settings.kakao_access_token_enc end,
        kakao_refresh_token_enc =
          case when excluded.kakao_refresh_token_enc is not null
               then excluded.kakao_refresh_token_enc
               else public.notification_settings.kakao_refresh_token_enc end,
        kakao_user_id = coalesce(excluded.kakao_user_id, public.notification_settings.kakao_user_id);
end;
$$;

-- 복호화된 토큰 + kakao_user_id + enabled_events 를 반환한다.
-- 키가 다르면 pgp_sym_decrypt 가 raise — 호출 측이 catch 한다.
create or replace function public.kakao_get_tokens(
  p_user_id uuid,
  p_key     text
) returns table (
  access_token   text,
  refresh_token  text,
  kakao_user_id  text,
  enabled_events jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key is null or length(p_key) = 0 then
    raise exception 'kakao_get_tokens: p_key required';
  end if;

  return query
  select
    case when ns.kakao_access_token_enc is not null
         then pgp_sym_decrypt(ns.kakao_access_token_enc, p_key)
         else null end,
    case when ns.kakao_refresh_token_enc is not null
         then pgp_sym_decrypt(ns.kakao_refresh_token_enc, p_key)
         else null end,
    ns.kakao_user_id,
    ns.enabled_events
  from public.notification_settings ns
  where ns.user_id = p_user_id;
end;
$$;

-- 카카오 연동 해제 — 토큰 + user id 만 비운다. enabled_events 등은 보존.
create or replace function public.kakao_clear_tokens(
  p_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_settings
     set kakao_access_token_enc  = null,
         kakao_refresh_token_enc = null,
         kakao_user_id           = null
   where user_id = p_user_id;
end;
$$;

-- ============================================================
-- 5. 권한 — service_role 만 실행. authenticated/anon 은 직접 호출 금지.
-- ============================================================
revoke all on function public.kakao_set_tokens(uuid, text, text, text, text)  from public, anon, authenticated;
revoke all on function public.kakao_get_tokens(uuid, text)                    from public, anon, authenticated;
revoke all on function public.kakao_clear_tokens(uuid)                        from public, anon, authenticated;

grant execute on function public.kakao_set_tokens(uuid, text, text, text, text) to service_role;
grant execute on function public.kakao_get_tokens(uuid, text)                   to service_role;
grant execute on function public.kakao_clear_tokens(uuid)                       to service_role;
