# DB Security Audit — errornote.ai (Wunote.ai)

- **스캔 대상**: `supabase/migrations/*.sql` 9개 + `types/database.ts`
- **기준 시점**: 2026-05-04 (최신 마이그레이션 `20260505000002`)
- **브랜치**: `chore/db-security-audit-report` — 변경 사항 없음, 보고서만 보존

---

## 1. 토큰/시크릿/키 컬럼 인벤토리

`token | secret | key | password | credential` 정규식으로 전수 grep한 결과:

| 테이블 | 컬럼 | 타입 | 보호 방식 | 판정 |
|---|---|---|---|---|
| `notification_settings` | `kakao_access_token_enc` | bytea | pgcrypto `pgp_sym_encrypt` + SECURITY DEFINER RPC 게이트 | ✅ 안전 |
| `notification_settings` | `kakao_refresh_token_enc` | bytea | pgcrypto `pgp_sym_encrypt` + SECURITY DEFINER RPC 게이트 | ✅ 안전 |
| `notification_settings` | `kakao_user_id` | text | 평문 | ✅ 식별자(시크릿 아님) |
| `api_keys` | `key_hash` | varchar(64) | 단방향 해시 (앱 측 SHA-256, 64 hex) | ✅ 안전 — 원본 키는 DB에 미저장 |
| `profiles` | `kakao_id` | text | 평문 | ✅ 카카오 OpenID — 시크릿 아님 |
| `classes` | `invite_code` | text | 평문 | ✅ 의도적(학생이 입력해 가입) |
| `push_subscriptions` | `subscription` (jsonb), `endpoint` (text) | 평문 | RLS만 (`student_self_all`) | ⚠️ 후술 |

---

## 2. PR #35 처리 검증 — `20260504000001_encrypt_kakao_tokens.sql`

PR #35의 마이그레이션을 라인 단위로 검증한 결과:

1. ✅ pgcrypto 확장 `create extension if not exists` (`20260504000001:18`)
2. ✅ bytea 신컬럼 추가 → 백필 → 평문 컬럼 drop (`20260504000001:69-71`) — 평문 잔존 가능성 차단
3. ✅ `kakao_set_tokens` / `kakao_get_tokens` / `kakao_clear_tokens` 모두 SECURITY DEFINER + `search_path = public` 고정 (`20260504000001:88,132,160`)
4. ✅ `revoke all from public, anon, authenticated` + `grant execute … to service_role` (`20260504000001:174-180`) — anon 키나 RLS 우회로 직접 호출 불가
5. ✅ 키는 DB가 아닌 앱이 매 호출 시 `p_key`로 주입 (`process.env.KAKAO_TOKEN_ENCRYPTION_KEY`) — DB 덤프 단독으로는 복호화 불가

### 결론 1 — 평문 시크릿 컬럼 누락 없음

PR #35 외에 pgcrypto 암호화가 누락된 평문 token/secret/password/credential 컬럼은 존재하지 않습니다. `key_hash`는 단방향 해시, `kakao_*_enc`는 대칭 암호화로 처리됨.

---

## 2-bis. `push_subscriptions.subscription` 관찰사항 (취약점 아님, 하드닝 옵션)

`20260421000002_core_tables.sql:272-279`의 `push_subscriptions.subscription` jsonb는 Web Push API의 `keys.p256dh` + `keys.auth`를 평문으로 저장합니다. 이 값으로 해당 구독에 푸시를 발송할 수 있어 민감하지만:

- Web Push 표준 구현은 거의 모두 평문 저장
- 단일 브라우저-서비스워커 페어 한정, 사용자가 언제든 재구독 가능
- RLS `push_subscriptions_self_all`로 본인만 select 가능
- 컬럼명이 `key/token/secret`을 포함하지 않아 grep 기준에 걸리지 않음

**판정**: 보안 취약점이 아닌 하드닝 후보. 사용자 지시("명확한 보안 취약점이 있을 때만 코드 변경")에 따라 **변경하지 않습니다**. 향후 보강하려면 `subscription`을 RPC 뒤로 숨기고 `endpoint`만 일반 select에 노출하는 것이 표준 패턴입니다. → 별도 GitHub Issue로 제안.

---

## 3. `types/database.ts` 동기화 점검

마이그레이션 → 타입 매핑 결과(전수 비교):

### 테이블 (32개 — 전부 일치)

`profiles`, `classes`, `enrollments`, `corpus_documents`, `chapter_prompts`, `sessions`, `error_cards`, `bookmarks`, `vocabulary`, `quiz_results`, `translation_logs`, `url_analysis_logs`, `push_subscriptions`, `pronunciation_sessions`, `notification_settings`, `portfolios`, `rubrics`, `assignments`, `rubric_evaluations`, `weekly_cardnews`, `professor_reports`, `live_sessions`, `corpus_ratings`, `peer_review_requests`, `peer_reviews`, `api_keys`, `badges`, `gamification_stats`, `learning_goals`, `live_typing_consents`, `student_weekly_reports`, `in_app_notifications` ✅

특히 확인:

- `notification_settings` Row가 `kakao_access_token` / `kakao_refresh_token`(평문) 미포함, `kakao_*_enc`만 포함 → PR #35 반영됨 (`types/database.ts:855-883`)
- `live_typing_consents` (`types/database.ts:972-998`) — `20260505000001` 반영됨
- `student_weekly_reports` (`types/database.ts:999-1028`) — `20260505000002` 반영됨
- `in_app_notifications` (`types/database.ts:1029-1064`) — `20260505000002` 반영됨

### 뷰 (1개)

- `professor_reports_latest` (`types/database.ts:1067`) — `20260421000004:90` 일치 ✅

### Functions (RPC, 13개 — 전부 일치)

`is_professor`, `is_enrolled`, `owns_class`, `owns_session_class`, `corpus_class_id`, `compute_level`, `add_xp`, `touch_streak`, `refresh_corpus_rating_stats`, `increment_corpus_download`, `kakao_set_tokens`, `kakao_get_tokens`, `kakao_clear_tokens` ✅

(`handle_new_user`, `learning_goals_touch`, `trg_corpus_ratings_*`는 트리거 전용 함수로 RPC 노출 대상이 아님 — 의도적 제외)

### 결론 2 — 타입 누락/드리프트 없음

`types/database.ts`는 최신 마이그레이션 `20260505000002`까지 100% 반영되어 있습니다. 수동 보정 PR이 필요하지 않습니다.

---

## 4. 최종 액션 아이템

| 항목 | 조치 |
|---|---|
| 평문 시크릿 컬럼 누락 | 없음 — 조치 불요 |
| `types/database.ts` 드리프트 | 없음 — 조치 불요 |
| 코드 변경 PR | 생성하지 않음 (변경할 코드 없음) |
| 본 보고서 보존 | 이 PR로 `docs/audits/`에 커밋 |
| `push_subscriptions` 하드닝 | 별건 GitHub Issue로 분리 |

DB 보안 측면에서 main 브랜치는 클린 상태입니다.
