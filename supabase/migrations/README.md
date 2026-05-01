## Wunote.ai — Migrations Guide

이 디렉토리는 **append-only**다. 한 번 머지된 마이그레이션 파일은 절대 수정·삭제하지 않는다 (CLAUDE.md "Key Constraints" 참조).

---

### 정본 (canonical) 파일 — 6개

| 파일 | 내용 |
|---|---|
| `20260421000001_extensions.sql` | `pgcrypto` 확장 |
| `20260421000002_core_tables.sql` | RLS helper 함수, profiles + `handle_new_user` 트리거, classes, enrollments, corpus_documents, chapter_prompts, sessions(+deferred FK), error_cards, bookmarks, vocabulary, quiz_results, translation_logs, url_analysis_logs, push_subscriptions, pronunciation_sessions, notification_settings, portfolios |
| `20260421000003_gamification.sql` | badges, gamification_stats, learning_goals(+`learning_goals_touch` 트리거), `compute_level` / `add_xp` / `touch_streak` RPC + grants |
| `20260421000004_professor_tools.sql` | rubrics, assignments(+ sessions FK 연결), rubric_evaluations, weekly_cardnews, professor_reports(+ `metrics` 컬럼 + `professor_reports_latest` view), live_sessions(+active unique index), corpus_ratings(+ refresh fns + triggers + `increment_corpus_download`), peer_review_requests, peer_reviews, api_keys, Storage `corpus` 버킷 + 5개 storage policy |
| `20260421000005_rls_policies.sql` | 모든 테이블 RLS enable + 정책 (Phase 1~3 전부 포괄) |
| `20260421000006_indexes.sql` | FK + composite + partial 인덱스, Realtime publication (classes/error_cards/sessions/live_sessions) + REPLICA IDENTITY FULL |

---

### Deprecated 파일 (대응표)

이전 형식의 `0001_init.sql ~ 0007_gamification_fns.sql`은 origin/main에서 이미 제거됐다. **로컬 worktree나 클론에 stale로 남아있을 수 있으니** 발견 시 삭제하고 위 6개만 유지한다. 옛 파일이 가졌던 모든 정의는 다음과 같이 새 set에 흡수됐다:

| 옛 파일 | 새 위치 | 비고 |
|---|---|---|
| `0001_init.sql` | `*_extensions.sql`, `*_core_tables.sql`, `*_gamification.sql`, `*_professor_tools.sql` | 새 set은 추가로 `corpus_documents.title/description/avg_rating/rating_count`, `learning_goals.updated_at/achieved_at`, `professor_reports.metrics` 컬럼을 포함 |
| `0002_rls.sql` | `*_core_tables.sql` (helper 함수), `*_rls_policies.sql` (정책) | 새 set은 Phase 3 테이블(push, pronunciation, notifications, portfolios, live_sessions, corpus_ratings, peer_review_*, api_keys) RLS까지 포함 |
| `0003_indexes.sql` | `*_indexes.sql` | 동등 |
| `0004_realtime.sql` | `*_indexes.sql` 말미 | `live_sessions`도 publication에 추가됨 |
| `0005_storage.sql` | `*_core_tables.sql` (`corpus_class_id` helper), `*_professor_tools.sql` (버킷 + 정책) | 동등 |
| `0006_indexes_phase2.sql` | `*_indexes.sql` (composite + partial 인덱스) | 동등 |
| `0007_gamification_fns.sql` | `*_gamification.sql` | 동등 |

---

### 새 마이그레이션 추가 규칙

1. **파일명**: `YYYYMMDDHHMMSS_<도메인>.sql` 형식. 도메인은 단일 기능 단위로 좁게.
2. **병렬 작업(여러 worktree)**: 도메인별 접미사를 다르게 하면 충돌 없이 동시에 작업 가능. PR 머지 순서는 사용자가 조정.
3. **idempotency**: 가능한 경우 `create table if not exists`, `drop policy if exists` + `create policy`, `on conflict do update` 사용.
4. **types/database.ts 동기화**: 새 마이그 추가 시 같은 PR에서 `types/database.ts`를 손으로 갱신 (Docker Desktop 가능 시 `npm run db:types`).
5. **seed.sql**: 스키마 호환성 깨면 같은 PR에서 함께 수정.
6. **옛 마이그 파일 절대 수정 금지**. 컬럼 추가/제약 변경이 필요하면 새 `*_alter_<도메인>.sql`을 작성.

---

### 적용 방법

```bash
# 로컬 Supabase
supabase start
supabase db reset      # 모든 마이그+seed 재실행

# 마이그레이션만
supabase db push
```

새 마이그 추가 후:
```bash
npm run db:types       # Docker Desktop 필요. 없으면 types/database.ts 손으로 동기화
npm run typecheck
npm test
```
