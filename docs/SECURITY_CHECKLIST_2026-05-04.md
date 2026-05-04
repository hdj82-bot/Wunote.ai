# Wunote.ai — 2026-05-04 보안 점검 체크리스트

본 문서는 PR a/b/c 의 변경 범위와 후속 운영 작업, 발견된 정책 갭을 정리한다.

---

## 1. 변경 범위 — PR a/b/c

### PR a · Kakao OAuth 토큰 암호화
브랜치: `security/kakao-encrypt-tokens`

| 항목 | 변경 |
|---|---|
| `notification_settings.kakao_access_token` (text) | **drop** |
| `notification_settings.kakao_refresh_token` (text) | **drop** |
| `notification_settings.kakao_access_token_enc` (bytea) | 신규 |
| `notification_settings.kakao_refresh_token_enc` (bytea) | 신규 |
| RPC `kakao_set_tokens / kakao_get_tokens / kakao_clear_tokens` | 신규 (security definer, service_role 전용) |
| 환경변수 `KAKAO_TOKEN_ENCRYPTION_KEY` | 신규 (16자 이상 권장) |
| 마이그레이션 | `supabase/migrations/20260504000001_encrypt_kakao_tokens.sql` |

**적용 시 운영 절차:**
1. 운영 DB 에 마이그레이션 적용 전, 동일 트랜잭션 안에서 GUC 를 설정해야 기존 평문이 백필된다:
   ```sql
   begin;
     select set_config('app.kakao_token_key', '<KAKAO_TOKEN_ENCRYPTION_KEY>', false);
     -- 그 다음 마이그레이션 SQL 적용
   commit;
   ```
   GUC 미설정으로 적용하면 기존 평문이 폐기되고 사용자 전원 카카오 재연동이 필요하다 (NOTICE 출력).
2. Vercel/배포 환경에 `KAKAO_TOKEN_ENCRYPTION_KEY` 환경변수 등록.
3. 키가 바뀌면 모든 사용자가 재연동 필요 — 일종의 "마스터 키"이므로 key rotation 시 사전 공지 필요.

### PR b · RLS E2E 시나리오
브랜치: `security/rls-e2e`

| 시나리오 | 검증 대상 정책 |
|---|---|
| 학생 A 가 학생 B 의 `sessions / error_cards / student_weekly_reports / in_app_notifications / live_typing_consents` 를 못 본다 | `*_student_self_*` 류, `live_typing_consents_self_select`, `student_weekly_reports_self_select`, `in_app_notifications_self_select` |
| 학생 A 가 본인 `sessions` 를 정상적으로 본다 | sanity (false-positive 검출) |
| 교수 P 가 본인 강의 학생 A 의 데이터를 본다 | `*_professor_select` (live, weekly_reports), `sessions_professor_select` |
| 교수 P 가 다른 강의(P2 소유) 데이터는 못 본다 | `owns_class()` / 강의별 격리 |
| 익명이 모든 사적 테이블 차단 | RLS default-deny |
| 익명이 marketplace 공개 글만 본다 | `corpus_public_marketplace_select` ⚠ 갭 (아래 4번) |

실행: `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 가 설정된 dev/staging DB 에서만. 운영 DB 에는 절대 실행하지 말 것.

### PR c · LMS 공개 API 강화
브랜치: `security/lms-api-hardening`

| 항목 | 변경 |
|---|---|
| 키 회전 엔드포인트 | `POST /api/lms/keys/[id]/rotate` — id 유지, hash/window 갱신 |
| 미들웨어 | `lib/lms-middleware.ts` — auth + rate-limit (per-key, 슬라이딩 1분) + 감사 로그를 한 wrapper 에서 처리 |
| 401/429 분리 | 기존 `validateApiKey` 가 둘 다 null → 미들웨어가 status code + Retry-After 헤더로 구분 |
| 응답 헤더 | `X-RateLimit-Limit` / `X-RateLimit-Remaining` |
| 감사 로그 테이블 | `lms_api_requests` (RLS: 교수자 본인 키 요청만 select) |
| 키별 한도 | `api_keys.rate_limit_per_minute` (NULL 이면 글로벌 100/분) |
| stdout 보안 로그 | `ANTHROPIC_LOG_USAGE=1` 시 `lms_api_request` / `lms_api_key` 이벤트 JSON |

기존 `lib/api-key.ts` 는 그대로 — `generateApiKey` 만 회전 라우트에서 재사용.

---

## 2. ANTHROPIC_LOG_USAGE 컨벤션 적용

`lib/ai/observability.ts` 의 패턴(`process.env.ANTHROPIC_LOG_USAGE === '1'` 일 때 한 줄 JSON 출력)을 다음에도 적용:

| 이벤트 | tag | 위치 |
|---|---|---|
| Kakao OAuth connect / refresh / disconnect / oauth_error / connect_failed | `kakao_token` | `app/api/notifications/kakao/connect/route.ts`, `lib/kakao.ts`, `lib/weekly-report-notify.ts` |
| LMS API 모든 요청 (성공/실패) | `lms_api_request` | `lib/lms-middleware.ts` |
| LMS API 키 회전 | `lms_api_key` | `app/api/lms/keys/[id]/rotate/route.ts` |

운영 환경에서 stdout 은 Vercel/Cloud logs 가 자동 수집한다. 별도 sink 없이 grep 가능.

---

## 3. 운영 적용 순서

1. **PR a 머지 + 키 등록**
   - `KAKAO_TOKEN_ENCRYPTION_KEY` 를 Vercel 환경변수로 등록 (production / preview / development 모두).
   - DB 마이그레이션을 위에 명시한 트랜잭션 + GUC 패턴으로 적용.
2. **PR c 머지**
   - 마이그레이션 적용 → `lms_api_requests` 테이블 / `api_keys.rate_limit_per_minute` 컬럼 추가.
   - 기존 발급 키들은 그대로 유효. 회전 UI 가 별도로 추가될 때까지 회전은 API 직접 호출.
3. **PR b 머지**
   - 코드만 들어가고 정책은 변경되지 않음. CI 에서는 env 미설정 시 자동 skip.
   - dev/staging DB 에 대해 수동 실행: `npx playwright test --project=rls`.

---

## 4. 발견된 정책 갭 (후속 처리 필요)

### 4.1 `corpus_public_marketplace_select` — 익명에게는 항상 차단됨
정의:
```sql
create policy "corpus_public_marketplace_select"
  on public.corpus_documents for select
  using (is_public = true and public.is_professor());
```
`is_professor()` 가 `auth.uid()` 의 profile.role 을 보므로, 익명(`auth.uid() IS NULL`) 에 대해 항상 false. 사용자 스펙 ("익명도 marketplace 공개 글은 읽는다") 과 충돌.

**권장 fix (별도 마이그레이션 필요):**
```sql
drop policy "corpus_public_marketplace_select" on public.corpus_documents;
create policy "corpus_public_marketplace_select"
  on public.corpus_documents for select
  using (is_public = true);
```
PR b 의 `익명은 marketplace 공개 글만 읽는다` 케이스가 이 fix 가 적용되기 전까지는 fail 한다 — 이 fail 자체가 정책 갭의 신호로 본다.

### 4.2 `student_weekly_reports` / `in_app_notifications` insert 차단
두 테이블 모두 insert RLS 정책이 없어 service-role(cron) 만 insert 가능. 의도된 설계지만, 향후 학생/교수자가 알림을 직접 생성하는 기능이 추가되면 RLS 정책을 명시적으로 추가해야 한다 (오히려 RLS bypass 를 service-role 로 우회하는 핫픽스가 들어가지 않도록 주의).

### 4.3 `notification_settings` insert/update 가 client-side 에서 가능 (PR a 후속)
`notification_settings_self_*` 정책상 학생 본인이 anon-key 로 직접 row 를 update 할 수 있다. PR a 이후로는 평문 토큰 컬럼이 없으니 토큰 유출 위험은 사라졌지만, 학생이 임의로 `enabled_events` 외 컬럼을 갱신하지 못하도록 column-level grant 또는 트리거 가드를 추가하는 것이 바람직 (현재는 굳이 막지 않아도 보안 영향 X).

---

## 5. 미해결 / 후속 PR (PR d)

### 5.1 `npm audit` moderate 3건
환경에 `npm` 미설치로 본 세션에서 audit 재실행 불가. 사용자가 다음 명령 출력을 공유해 주면 패치 PR 진행 가능:
```bash
npm audit --json --production
npm audit --json
```
upstream 패치가 이미 있는 경우 `npm audit fix` 또는 `package.json` 의 `overrides` 절을 갱신.

### 5.2 키 회전 UI
현재 회전은 `POST /api/lms/keys/[id]/rotate` 를 직접 호출해야 한다. Settings → API Keys 페이지에 "회전" 버튼 추가 필요.

### 5.3 Realtime broadcast 인증
`live_typing_consents` 는 broadcast 동의 audit 만 기록한다. Supabase Realtime 채널 자체의 publish/subscribe 권한은 RLS 가 아니라 채널 토큰 레벨에서 검사되므로, 별도 공유 문서가 필요.

---

## 6. 체크 (운영 적용 후 직접 확인)

- [ ] `KAKAO_TOKEN_ENCRYPTION_KEY` 가 Vercel 환경변수에 등록되었다 (preview/production 모두)
- [ ] `select count(*) from notification_settings where kakao_access_token_enc is not null;` 이 0 이상 (재연동 후) 또는 사용자 전원 재연동 안내 발송 완료
- [ ] `SELECT * FROM information_schema.columns WHERE table_name='notification_settings' AND column_name LIKE 'kakao_access_token%';` 결과에 `kakao_access_token_enc` 만 있고 평문 컬럼 없음
- [ ] `npx playwright test --project=rls` 가 staging DB 에서 PASS (4.1 fix 후)
- [ ] LMS API 첫 호출 후 `select * from lms_api_requests order by created_at desc limit 5;` 에 행이 쌓인다
- [ ] 잘못된 Bearer 로 LMS 호출 시 401 + 로그에 status=401 기록됨
- [ ] 100회/분 초과 호출 시 429 + Retry-After 헤더 + 로그에 status=429 기록됨
- [ ] 키 회전 후 이전 raw 키로 호출 시 401 응답
