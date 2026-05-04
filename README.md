# Wunote.ai

> 한국 대학교 중국어 전공 학부생을 위한 AI 기반 중국어 오류 교정 PWA.
> Students submit Chinese text → Claude API returns structured error cards → professors see aggregate dashboards.

<!-- TODO: 메인 학습 화면 / 교수자 대시보드 / 모바일 PWA 스크린샷 추가 -->

---

## ✨ 주요 기능

- **2분할 학습 화면** — Word형 에디터 + 인라인 오류 하이라이트 + AI 과외 채팅
- **오류 카드 (4필드 + CoT 추론)** — 강병규(2025) 논문 표8 기반 구조화된 피드백
- **교수자 코퍼스 업로드 (RAG)** — PDF/DOCX/TXT 자료를 수업 시스템 프롬프트에 즉시 반영
- **실시간 수업 모드** — Supabase Realtime으로 전체 수강생 오류 5초 단위 집계
- **주간 카드뉴스** — 4장 고정 (통계·개선점·액션·다음 주 방향), 이메일·웹 푸시·카카오 알림 발송
- **게이미피케이션** — 4단계 레벨, 배지, 스트릭, Howler.js 효과음
- **PWA + 오프라인 모드** — IndexedDB 큐 기반 오프라인 작성, 복귀 시 자동 동기화
- **다국어 UI** — next-intl (ko / en / ja)
- **LMS Public API** — `/api/lms/*` + Swagger UI (`/api/docs`)

---

## 🛠 기술 스택

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, `[locale]` segment) |
| Styling | Tailwind CSS |
| Auth + DB | Supabase (PostgreSQL, RLS, Realtime) |
| AI | Claude API via `@anthropic-ai/sdk` |
| i18n | next-intl — `messages/{ko,en,ja}.json` |
| Testing | Vitest (unit) + Playwright (e2e) |
| Deploy | Vercel + Supabase |

---

## 🚀 빠른 시작

```bash
cp .env.example .env.local   # 실제 키 입력 (자세한 설명은 CLAUDE.md 참고)
npm install
npm run dev                  # http://localhost:3000
```

Supabase 프로젝트를 먼저 생성하고 `supabase/migrations/`의 SQL 파일을 적용해야 합니다.

### 자주 쓰는 커맨드

```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm run typecheck    # 타입 체크
npm run lint         # ESLint
npm test             # Vitest 단위 테스트
npm run test:e2e     # Playwright e2e
```

---

## 📚 문서

- **[Wunote.md](Wunote.md)** — 전체 제품 명세 (DB 스키마, 라우트, Phase별 진행도)
- **[CLAUDE.md](CLAUDE.md)** — 개발자 가이드 (디렉토리 구조, env vars, 코딩 규칙)

---

## 📄 라이선스 / 저자

Maintainer: [@hdj82-bot](https://github.com/hdj82-bot)
