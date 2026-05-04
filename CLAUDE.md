# CLAUDE.md — Wunote.ai

AI-powered Chinese writing error correction PWA for Korean university students.
Students submit Chinese text → Claude API returns structured error cards → professors see aggregate dashboards.

> 공개용 프로젝트 소개는 [README.md](README.md), 전체 제품 명세는 [Wunote.md](Wunote.md) 참고. 이 문서는 개발자(특히 Claude Code) 대상 가이드입니다.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, `[locale]` route segment) |
| Styling | Tailwind CSS — slate/indigo palette |
| Auth + DB | Supabase (PostgreSQL, RLS, Realtime) |
| AI | Claude API via `@anthropic-ai/sdk` |
| i18n | next-intl — `messages/{ko,en,ja}.json` |
| Types | Handwritten `types/database.ts` (mirrors Supabase schema) |

---

## Local Dev Setup

```bash
cp .env.example .env.local   # fill in real values (see Env Vars below)
npm install
npm run dev                  # http://localhost:3000
```

Requires a Supabase project with migrations applied (see DB Migrations below).

---

## Env Vars

Copy `.env.example` to `.env.local` and fill in the values below.

### Required (app won't start without these)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser-safe, RLS applied) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — server only, bypasses RLS |
| `ANTHROPIC_API_KEY` | Claude API key — used in `lib/claude.ts` |

### Optional (features degrade gracefully without these)

| Variable | Feature |
|---|---|
| `RESEND_API_KEY` | Weekly card-news email delivery |
| `RESEND_FROM_EMAIL` | Sender address (default: `Wunote <noreply@wunote.ai>`) |
| `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` | Kakao notification OAuth |
| `NEXT_PUBLIC_KAKAO_REDIRECT_URI` | Kakao OAuth callback URL |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | PWA web push |
| `WEB_PUSH_SUBJECT` | Web push sender identity |
| `DEEPL_API_KEY` | DeepL translation comparison |
| `PAPAGO_CLIENT_ID` / `PAPAGO_CLIENT_SECRET` | Papago translation comparison |
| `OPENAI_API_KEY` / `OPENAI_TRANSLATE_MODEL` | GPT translation comparison |
| `NEXT_PUBLIC_APP_URL` | Public URL for email links (default: `http://localhost:3000`) |
| `CRON_SECRET` | Vercel Cron authentication secret |

---

## Directory Structure

```
app/
  [locale]/              # All UI under locale prefix (ko/en/ja)
    (professor)/         # Professor route group (RLS: role = 'professor')
      dashboard/         # Class overview, student error aggregates
      classes/[classId]/
        page.tsx         # Class detail — student table with fossilization data
        assignments/     # Assignment list + detail
        rubrics/         # Rubric management
        corpus/          # RAG file upload (PDF/DOCX/TXT, max 10 MB, 20 files/class)
        live/            # Realtime class mode — 5 s polling + Supabase Realtime
      marketplace/       # Professor corpus sharing marketplace
      reports/           # Weekly AI-generated professor reports
      settings/api-keys/ # LMS public API key management
    (student)/           # Student route group (RLS: role = 'student')
  api/                   # Route handlers — Claude calls must live here
lib/                     # Pure business logic — do NOT modify logic here
  supabase.ts            # createBrowserClient / createServerClient / createAdminClient
  claude.ts              # completeJSON / streamText wrappers
  analysis.ts            # Error card parsing
  fossilization.ts       # FOSSILIZATION_THRESHOLD = 3
  realtime.ts            # subscribeToClassErrorInserts / subscribeToLiveSession / createPollTicker
  prompts/               # Chapter-specific system prompts
components/
  ui/                    # Shared primitives (Button, Card, etc.) — do NOT modify
messages/
  ko.json / en.json / ja.json   # Translation strings
types/
  database.ts            # Handwritten Supabase DB types — update when adding migrations
supabase/
  migrations/            # SQL migration files — do NOT modify
  seed.sql
```

---

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run typecheck    # tsc --noEmit (no emit, type errors only)
npm run lint         # ESLint
npm test             # Run unit tests with Vitest (single run)
npm run test:watch   # Vitest watch mode
npm run db:types     # Regenerate types/database.ts from local Supabase
                     # Requires: Docker Desktop + Supabase CLI
npm run test:e2e     # Playwright E2E tests (requires dev server running)
npm run test:e2e:ui  # Playwright interactive UI mode
```

Unit tests live alongside lib files: `lib/*.test.ts` (analysis, error-cards, fossilization, gamification).

E2E tests live in `e2e/`. Required env vars for E2E:
- `TEST_STUDENT_EMAIL` / `TEST_STUDENT_PASSWORD` — test student account
- `TEST_PROFESSOR_EMAIL` / `TEST_PROFESSOR_PASSWORD` — test professor account

---

## DB Migrations

Migrations are in `supabase/migrations/` as timestamped SQL files. **Never edit existing migration files.**

To apply all migrations to a local Supabase instance:

```bash
supabase start          # start local Supabase (Docker required)
supabase db reset       # drop + recreate schema, replay all migrations + seed.sql
```

After adding a new migration, regenerate types:

```bash
npm run db:types        # overwrites types/database.ts in place
```

The type file is handwritten until Docker Desktop is available; keep `types/database.ts` in sync with new migrations by hand if `npm run db:types` cannot run.

---

## i18n Conventions

- **Server components**: `import { getTranslations } from 'next-intl/server'` → `const t = await getTranslations('pages.professor.<section>')`
- **Client components** (`'use client'`): `import { useTranslations } from 'next-intl'` → `const t = useTranslations('pages.professor.<section>')`
- Add new keys to all three files (`ko.json`, `en.json`, `ja.json`) simultaneously.
- Namespace convention: `pages.professor.<page>` / `pages.student.<page>` / `components.<component>`

---

## Key Constraints

- **`lib/`** — change types/imports only; never alter function logic
- **`supabase/migrations/`** — append-only; never edit existing files
- **`app/api/`** — business logic lives here; treat as a boundary
- **`components/ui/`** — shared primitives; do not modify
- Claude API calls must only be made from `app/api/` route handlers, never from Client Components
- `types/database.ts` is the single source of Supabase table types; all `supabase.from('table')` calls are typed through it
