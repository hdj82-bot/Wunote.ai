# CLAUDE.md — Wunote (AI 중국어 오류 교정 플랫폼)

## 프로젝트 개요

한국 대학교 중국어 전공 학부생을 위한 AI 기반 중국어 오류 교정 PWA.
학습자가 직접 작성한 중국어 텍스트를 Claude API가 분석하여 오류 카드 형태로 피드백을 제공하고,
학습 데이터가 누적되면서 개인화된 성장 리포트와 주간 카드뉴스를 자동 생성한다.
교수자는 수강생 전체 현황을 파악하고 AI가 생성한 다음 수업 제안 리포트를 받는다.
학습자 경험이 쌓일수록 개인 DB가 구축되어 피드백 품질이 향상되는 선순환 구조를 갖는다.

---

## 기술 스택

| 영역 | 기술 | 비고 |
|---|---|---|
| 프레임워크 | Next.js 14 (App Router) | PWA 지원 |
| 스타일 | Tailwind CSS | 반응형 필수 |
| 인증 | Supabase Auth | 이메일/역할 구분 |
| DB | Supabase (PostgreSQL) | 실시간 구독 포함 |
| AI | Claude API (claude-opus-4-7) | 오류 분석·리포트·채팅 |
| 배포 | Vercel | 자동 CI/CD |
| 이메일 | Resend | 주간 카드뉴스 발송 |
| 푸시 알림 | Web Push API (PWA) | next-pwa 라이브러리 |
| 카카오 알림 | 카카오 알림톡 API | Phase 2 |
| 차트 | Recharts | 오류 통계 시각화 |
| PDF | react-pdf | 포트폴리오 내보내기 |
| 효과음 | Howler.js | 게이미피케이션 사운드 |
| 파일 파싱 | pdf-parse, mammoth | 교수자 코퍼스 업로드 |
| 웹 크롤링 | Cheerio | SNS·뉴스 URL 분석 |

---

## 디렉토리 구조

```
/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── signup/
│   ├── (professor)/
│   │   ├── dashboard/         # 수강생 현황 대시보드
│   │   ├── classes/
│   │   │   ├── [classId]/
│   │   │   │   ├── students/  # 수강생 목록·개인 오류 열람
│   │   │   │   ├── report/    # 다음 수업 AI 제안 리포트
│   │   │   │   ├── prompt/    # 챕터별 프롬프트 편집
│   │   │   │   ├── corpus/    # 코퍼스 업로드·관리
│   │   │   │   ├── assignment/# 과제 출제·제출 관리
│   │   │   │   ├── rubric/    # 루브릭 평가 설정
│   │   │   │   └── live/      # 수업 중 실시간 모드
│   │   └── marketplace/       # 교수자 간 자료 공유
│   ├── (student)/
│   │   ├── learn/             # 메인 학습 화면 (2분할)
│   │   │   └── [chapterId]/
│   │   ├── errors/            # 오류 기록 카드 목록
│   │   ├── vocabulary/        # 단어장·플래시카드
│   │   ├── bookmarks/         # 예문 북마크
│   │   ├── quiz/              # 오류 유형 퀴즈
│   │   ├── translate/         # 번역 역방향 비교
│   │   ├── analyze-url/       # SNS·뉴스 URL 분석
│   │   ├── progress/          # 성장 대시보드 (학기 간 비교 포함)
│   │   ├── goals/             # 학습 목표 설정·추적
│   │   ├── badges/            # 배지·레벨·스트릭
│   │   ├── portfolio/         # 포트폴리오 PDF 생성
│   │   └── cardnews/          # 주간 카드뉴스 보관함
│   ├── api/
│   │   ├── analyze/           # Claude API 오류 분석
│   │   ├── chat/              # AI 개인 과외 채팅
│   │   ├── report/            # 주간 리포트 생성 (cron)
│   │   ├── cardnews/          # 카드뉴스 생성 (cron)
│   │   ├── translate-compare/ # 번역 도구 비교
│   │   ├── analyze-url/       # URL 텍스트 분석
│   │   ├── corpus/            # 코퍼스 업로드·파싱
│   │   ├── rubric/            # 루브릭 자동 평가
│   │   ├── export/            # 연구 데이터 익스포트
│   │   ├── push/              # 웹 푸시 발송
│   │   └── email/             # Resend 이메일 발송
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── learn/
│   │   ├── DocumentEditor.tsx   # 왼쪽: Word형 문서 입력
│   │   ├── AnnotatedText.tsx    # 인라인 오류 하이라이트
│   │   ├── ErrorPanel.tsx       # 오른쪽 상단: 오류 카드 패널
│   │   ├── TutorChat.tsx        # 오른쪽 하단: AI 과외 채팅
│   │   ├── ErrorCard.tsx        # 오류 카드 (4필드 + CoT)
│   │   ├── ChapterSelector.tsx
│   │   └── RevisionInput.tsx
│   ├── gamification/
│   │   ├── BadgeDisplay.tsx     # 배지 진열장
│   │   ├── LevelBar.tsx         # 레벨 진행바
│   │   ├── StreakCounter.tsx     # 연속 학습 스트릭
│   │   ├── RankingBoard.tsx     # 수업 내 익명 랭킹
│   │   └── SoundManager.tsx     # 효과음 제어 (Howler.js)
│   ├── cardnews/
│   │   ├── CardNewsViewer.tsx
│   │   ├── Card1Summary.tsx
│   │   ├── Card2Improved.tsx
│   │   ├── Card3Action.tsx
│   │   └── Card4Next.tsx
│   ├── professor/
│   │   ├── ClassCard.tsx
│   │   ├── QRCodeModal.tsx
│   │   ├── StudentTable.tsx
│   │   ├── ErrorHeatmap.tsx
│   │   ├── NextClassReport.tsx
│   │   ├── CorpusUploader.tsx   # 코퍼스 업로드 UI
│   │   ├── AssignmentCreator.tsx
│   │   ├── RubricEditor.tsx
│   │   └── LiveClassView.tsx    # 실시간 수업 모드
│   ├── charts/
│   │   ├── ErrorTrendChart.tsx
│   │   ├── ErrorTypeDonut.tsx
│   │   ├── ChapterProgressBar.tsx
│   │   └── SemesterCompare.tsx  # 학기 간 성장 비교
│   └── ui/
├── lib/
│   ├── claude.ts
│   ├── supabase.ts
│   ├── prompts/
│   │   ├── base.ts
│   │   ├── chapter0.ts ~ chapter7.ts
│   │   ├── tutor.ts             # AI 과외 채팅 프롬프트
│   │   ├── rubric.ts            # 루브릭 평가 프롬프트
│   │   ├── url-analyze.ts       # URL 텍스트 분석 프롬프트
│   │   └── report.ts
│   ├── parser.ts
│   ├── corpus-parser.ts         # PDF·DOCX·TXT 파싱
│   ├── analysis.ts
│   ├── gamification.ts          # 배지·레벨·스트릭 로직
│   ├── fossilization.ts         # 화석화 감지 로직
│   └── push.ts
├── types/
│   └── index.ts
├── public/
│   ├── manifest.json
│   ├── sw.js
│   └── sounds/                  # 효과음 파일
│       ├── correct.mp3
│       ├── badge.mp3
│       ├── error-found.mp3
│       ├── streak.mp3
│       └── level-up.mp3
└── supabase/
    └── migrations/
```

---

## DB 스키마 (Supabase PostgreSQL)

```sql
-- 사용자
profiles (
  id uuid PK,
  name text,
  role text,                  -- 'professor' | 'student'
  student_id text,
  language text DEFAULT 'ko', -- 'ko' | 'en' | 'ja' (다국어 UI)
  email_notify boolean,
  push_notify boolean,
  kakao_id text,
  created_at timestamptz
)

-- 수업
classes (
  id uuid PK,
  professor_id uuid FK,
  name text,
  semester text,              -- '2026-1'
  invite_code text UNIQUE,
  is_active boolean,
  current_grammar_focus text, -- 당주 문법 포인트 (수업 자료 연동)
  created_at timestamptz
)

-- 수강 등록
enrollments (
  id uuid PK,
  class_id uuid FK,
  student_id uuid FK,
  enrolled_at timestamptz
)

-- 교수자 코퍼스 (RAG 지식 기반)
corpus_documents (
  id uuid PK,
  class_id uuid FK,
  professor_id uuid FK,
  file_name text,
  file_type text,             -- 'pdf' | 'txt' | 'docx'
  content text,               -- 파싱된 텍스트
  is_public boolean,          -- 마켓플레이스 공개 여부
  download_count int DEFAULT 0,
  created_at timestamptz
)

-- 챕터별 프롬프트
chapter_prompts (
  id uuid PK,
  class_id uuid FK,
  chapter_number int,
  system_prompt text,
  icl_examples jsonb,
  updated_at timestamptz
)

-- 학습 세션
sessions (
  id uuid PK,
  student_id uuid FK,
  class_id uuid FK,
  chapter_number int,
  draft_text text,
  revision_text text,
  draft_error_count int,
  revision_error_count int,
  assignment_id uuid FK,      -- 과제 제출 시 연결
  created_at timestamptz
)

-- 오류 카드 (핵심 개인 DB)
error_cards (
  id uuid PK,
  session_id uuid FK,
  student_id uuid FK,
  chapter_number int,
  error_span text,            -- 오류 범위 (Error Span)
  error_type text,            -- 'vocab' | 'grammar'
  error_subtype text,         -- '错词' | '缺词' | '어순' | '把자문' 등
  correction text,            -- 수정안 (Suggested Correction)
  explanation text,           -- 설명 (Explanation)
  cot_reasoning jsonb,        -- CoT 단계적 추론 [{step, content}]
  similar_example text,
  hsk_level int,              -- HSK 급수 태그 (1~6)
  is_resolved boolean,
  fossilization_count int DEFAULT 0, -- 동일 오류 반복 횟수
  created_at timestamptz
)

-- 예문 북마크
bookmarks (
  id uuid PK,
  student_id uuid FK,
  error_card_id uuid FK,
  sentence text,              -- 북마크한 예문
  note text,
  created_at timestamptz
)

-- 단어장
vocabulary (
  id uuid PK,
  student_id uuid FK,
  chinese text,
  pinyin text,
  korean text,
  source_error_id uuid FK,
  review_count int DEFAULT 0,
  next_review_at timestamptz,
  created_at timestamptz
)

-- 퀴즈 결과
quiz_results (
  id uuid PK,
  student_id uuid FK,
  error_card_id uuid FK,
  is_correct boolean,
  answered_at timestamptz
)

-- 번역 비교 기록
translation_logs (
  id uuid PK,
  student_id uuid FK,
  original_text text,
  deepl_result text,
  papago_result text,
  gpt_result text,
  claude_analysis text,
  created_at timestamptz
)

-- URL 분석 기록
url_analysis_logs (
  id uuid PK,
  student_id uuid FK,
  url text,
  source_type text,           -- 'news' | 'weibo' | 'xiaohongshu' | 'other'
  content_text text,
  analysis_result jsonb,      -- 어휘·문체 분석 결과
  created_at timestamptz
)

-- 게이미피케이션 — 배지
badges (
  id uuid PK,
  student_id uuid FK,
  badge_type text,            -- 'zero_error' | 'streak_7' | 'vocab_100' 등
  badge_name text,
  badge_icon text,            -- 아이콘 파일명
  earned_at timestamptz
)

-- 게이미피케이션 — 레벨·스트릭
gamification_stats (
  id uuid PK,
  student_id uuid FK,
  level int DEFAULT 1,        -- 1:初学者 2:进步中 3:优秀生 4:汉语达人
  xp int DEFAULT 0,
  streak_days int DEFAULT 0,
  last_active_date date,
  updated_at timestamptz
)

-- 학습 목표
learning_goals (
  id uuid PK,
  student_id uuid FK,
  class_id uuid FK,
  goal_type text,             -- 'error_type' | 'error_count' | 'vocab_count'
  target_value text,
  current_value int DEFAULT 0,
  deadline date,
  is_achieved boolean DEFAULT false,
  created_at timestamptz
)

-- 과제
assignments (
  id uuid PK,
  class_id uuid FK,
  professor_id uuid FK,
  title text,
  prompt_text text,           -- 작성 지시문
  due_date timestamptz,
  rubric_id uuid FK,
  created_at timestamptz
)

-- 루브릭
rubrics (
  id uuid PK,
  professor_id uuid FK,
  name text,
  criteria jsonb,             -- [{name, weight, description}]
  created_at timestamptz
)

-- 루브릭 평가 결과
rubric_evaluations (
  id uuid PK,
  session_id uuid FK,
  rubric_id uuid FK,
  scores jsonb,               -- [{criterion, score, feedback}]
  total_score numeric,
  ai_feedback text,
  created_at timestamptz
)

-- 주간 카드뉴스
weekly_cardnews (
  id uuid PK,
  student_id uuid FK,
  class_id uuid FK,
  week_start date,
  card1_data jsonb,
  card2_data jsonb,
  card3_data jsonb,
  card4_data jsonb,
  goal_progress jsonb,        -- 학습 목표 달성률 포함
  is_sent boolean,
  created_at timestamptz
)

-- 교수자 주간 리포트
professor_reports (
  id uuid PK,
  professor_id uuid FK,
  class_id uuid FK,
  week_start date,
  focus_points jsonb,
  praise_students jsonb,
  care_students jsonb,
  fossilization_alerts jsonb, -- 화석화 위험 학습자
  next_class_suggestion text,
  created_at timestamptz
)
```

---

## 오류 카드 구조 (강병규 2025 논문 표8 기반)

### 4개 필드 + CoT 단계적 추론

모든 오류 카드는 다음 5개 구성 요소로 표시된다.

```
┌─────────────────────────────────────────────┐
│ 🔴 문법 오류 — 어순 (HSK 4급)               │
├─────────────────────────────────────────────┤
│ 오류 범위   我[两个小时睡了]                 │
│ 수정안      我睡了两个小时                   │
│ 설명        시량보어는 반드시 동사 뒤에       │
│             위치해야 합니다.                 │
├─────────────────────────────────────────────┤
│ 📋 판단 근거 (단계적 추론)                   │
│ ▷ 문장 분석 → '两个小时'가 시량보어임 확인   │
│ ▷ 규칙 검토 → 시량보어는 동사 후치 필수     │
│ ▷ 의미 판단 → 현재 위치는 통사 규칙 위반    │
│ ▷ 수정 제시 → 我睡了两个小时으로 교정       │
│ ▷ 유형 분류 → 문법 — 어순 오류              │
├─────────────────────────────────────────────┤
│ 유사 예시   我等了你一个小时                  │
│ [북마크 ☆]  [단어장 추가 +]  [퀴즈 출제 🎯] │
└─────────────────────────────────────────────┘
```

### Claude API 응답 JSON 형식

```json
{
  "error_count": 2,
  "annotated_text": "我<ERR id=0>两个小时睡了</ERR>，觉得很累。",
  "errors": [
    {
      "id": 0,
      "error_span": "两个小时睡了",
      "error_type": "grammar",
      "error_subtype": "어순 오류",
      "correction": "睡了两个小时",
      "explanation": "시량보어(时量补语)는 동작이 지속된 시간을 나타내며 반드시 동사 뒤에 위치해야 합니다.",
      "cot_reasoning": [
        { "step": "문장 분석", "content": "'两个小时'가 시량보어임을 식별합니다." },
        { "step": "규칙 검토", "content": "시량보어는 동사 뒤에 위치해야 한다는 통사 규칙을 확인합니다." },
        { "step": "의미 판단", "content": "현재 위치(동사 앞)는 통사 규칙을 위반합니다." },
        { "step": "수정 제시", "content": "'我睡了两个小时'로 교정합니다." },
        { "step": "유형 분류", "content": "문법 — 어순 오류로 분류합니다." }
      ],
      "similar_example": "我等了你一个小时",
      "hsk_level": 4
    }
  ],
  "overall_feedback": "어순 오류가 반복되고 있습니다. 시량보어 위치 규칙을 집중 복습하세요.",
  "fluency_suggestion": "문법적으로는 맞지만 '觉得很累' 대신 '感到疲惫'가 더 격식 있는 표현입니다."
}
```

### 파싱 규칙 (lib/parser.ts)
- JSON 파싱 실패 시 재시도 1회 후 에러 처리
- `error_type`은 반드시 `vocab | grammar` 중 하나로 정규화
- `annotated_text`의 `<ERR id=N>` 태그로 인라인 하이라이트 렌더링
- `error_count`가 0이면 "오류가 발견되지 않았습니다 ✅" UI 표시
- `fossilization_count` 3 이상이면 화석화 경고 UI 표시

---

## 2분할 학습 화면 (핵심 UI)

```
┌──────────────────────────┬──────────────────────────────┐
│ [챕터 선택 ▾]  제3장     │                              │
├──────────────────────────┤   오른쪽 상단: 오류 패널     │
│                          │                              │
│  왼쪽: Word형 문서 입력  │  오류 카드 1 (빨간 하이라이트│
│                          │  클릭 시 상세 카드 펼침)     │
│  오류 부분 → 빨간 밑줄   │                              │
│  마우스 오버 → 툴팁 미리보기│  오류 카드 2               │
│  클릭 → 우측 오류 카드   │                              │
│         포커스 이동      │  화석화 경고 ⚠️              │
│                          │  "이 오류 3회 반복됩니다"    │
│                          │                              │
│                          │  [수정고 재진단 →]           │
│                          ├──────────────────────────────┤
│                          │   오른쪽 하단: AI 과외 채팅  │
│                          │                              │
│                          │  🤖 把자문 목적어 규칙을     │
│                          │     설명해드릴게요...        │
│                          │                              │
│                          │  [질문 입력창...]  [전송]    │
└──────────────────────────┴──────────────────────────────┘
```

- **왼쪽 패널**: Word형 리치 텍스트 에디터 (contentEditable 또는 TipTap)
- **오른쪽 상단**: 오류 카드 목록 (4필드 + CoT 추론)
- **오른쪽 하단**: AI 과외 채팅 — 오류 추가 질문, 문법 자유 질문, 웹 검색 연동
- 오류 카드 클릭 → 채팅창에 해당 오류 컨텍스트 자동 주입
- 모바일: 문서 탭 / 오류 탭 / 채팅 탭 3탭 전환

---

## 챕터별 프롬프트 원칙

각 챕터 프롬프트는 다음 3가지 구조를 반드시 포함한다.

1. **RAG (규범 근거)**: 교수자 업로드 코퍼스 + 실용현대한어문법 기반 문법 규칙 요약
2. **ICL (오류 예시)**: 챕터별 전형적 오류 예시 5~10개 (입력→오류유형→수정안→설명→CoT)
3. **CoT (추론 지시)**: "오류를 발견한 근거를 문장 분석→규칙 검토→의미 판단→수정 제시→유형 분류의 5단계로 추론하라"

**제7장 (AI 검증 모드)**: AI 피드백 결과를 입력받아 타당성 검증 역할로 전환

---

## 교수자 코퍼스 업로드 (RAG 지식 기반 구축)

### 업로드 흐름
```
교수자가 파일 업로드 (PDF·TXT·DOCX)
      ↓
서버에서 텍스트 파싱 (corpus-parser.ts)
      ↓
corpus_documents 테이블에 저장
      ↓
해당 수업의 Claude API 시스템 프롬프트에 자동 삽입
      ↓
학습자 오류 분석 시 업로드 자료 기반으로 피드백 생성
```

### 초반 성능 문제 해결 전략
- 학습자 데이터 0개 상태에서도 교수자 업로드 자료로 피드백 품질 확보
- 기본 내장 코퍼스: HSK 작문 코퍼스 오류 예시 200개 (전체 수업 공통)
- 교수자 업로드 자료가 추가될수록 해당 수업 맞춤형 피드백으로 고도화
- 마켓플레이스에서 다른 교수자 공개 자료 즉시 가져오기 가능

### 지원 파일 형식
- PDF: pdf-parse로 텍스트 추출
- DOCX: mammoth으로 텍스트 추출
- TXT: 직접 읽기
- 최대 파일 크기: 10MB / 수업당 최대 20개 파일

---

## 게이미피케이션 시스템

### 레벨 체계
| 레벨 | 명칭 | 조건 | 아이콘 |
|---|---|---|---|
| 1 | 初学者 초학자 | 시작 | 🐣 |
| 2 | 进步中 진보중 | XP 500 | 🐼 |
| 3 | 优秀生 우수생 | XP 2000 | 🐉 |
| 4 | 汉语达人 한어달인 | XP 5000 | 🏆 |

### 배지 종류
| 배지 | 조건 | 아이콘 |
|---|---|---|
| 완벽 교정 | 수정고 오류 0개 | ⭐ |
| 연속 학습 7일 | 7일 스트릭 | 🔥 |
| 단어장 100개 | 단어 100개 저장 | 📚 |
| 把자문 마스터 | 把자문 오류 0개 3회 연속 | 🥋 |
| 탐구자 | AI 채팅 질문 50회 | 🔍 |
| 퀴즈왕 | 퀴즈 연속 10개 정답 | 🎯 |

### 효과음 (Howler.js)
- `correct.mp3`: 오류 0개 수정고 제출 시 — 경쾌한 띵동
- `badge.mp3`: 배지 획득 시 — 짧은 팡파레
- `error-found.mp3`: 오류 카드 생성 시 — 부드러운 알림음
- `streak.mp3`: 스트릭 갱신 시 — 불꽃 효과음
- `level-up.mp3`: 레벨업 시 — 축하 사운드
- 효과음 ON/OFF 설정 가능 (학습자 환경설정)

### XP 획득 기준
- 초고 제출: +10 XP
- 수정고 제출: +20 XP
- 오류 0개 수정고: +50 XP
- 퀴즈 정답: +5 XP
- 단어장 추가: +3 XP
- 7일 스트릭 달성: +100 XP

---

## 오류 화석화 감지 (lib/fossilization.ts)

```typescript
// 동일 error_subtype이 3회 이상 반복 시 화석화 감지
async function checkFossilization(studentId: string, errorSubtype: string) {
  const count = await getRepeatCount(studentId, errorSubtype)
  if (count >= 3) {
    return {
      isFossilized: true,
      warningMessage: `⚠️ '${errorSubtype}' 오류가 ${count}회 반복되고 있습니다. 화석화 위험이 있어요.`,
      remedialContent: await generateRemedialContent(errorSubtype)
    }
  }
}
```

- 화석화 감지 시 오류 카드에 주황색 경고 배너 표시
- 교수자 주간 리포트의 `fossilization_alerts`에 자동 포함
- 집중 교정 콘텐츠 (관련 퀴즈 3개 + 예문 5개) 자동 생성

---

## 교수자 수업 운영 기능

### 수업 중 실시간 모드
- 교수자가 "수업 시작" 버튼 → Supabase 실시간 구독 활성화
- 전체 수강생 오류 유형 실시간 집계 화면 (5초 단위 갱신)
- 현재 가장 많이 발생하는 오류 TOP 3 즉석 표시
- 수업 종료 시 자동으로 세션 데이터 저장

### 과제 출제
```
교수자: 제목·지시문·마감일·루브릭 설정 → 과제 생성
       ↓
학습자: 과제 탭에서 확인 → 텍스트 작성 → 제출
       ↓
자동: 오류 분석 + 루브릭 평가 동시 실행
       ↓
교수자: 제출 현황·점수·오류 통계 일괄 확인
```

### 루브릭 기반 자동 평가
- 평가 기준 예시: 문법 정확성 40% / 어휘 다양성 30% / 유창성 30%
- Claude API가 루브릭 기준에 맞춰 점수 + 근거 피드백 자동 생성
- 교수자가 최종 점수 수정 가능 (AI 제안 → 교수자 확정)

### 수업 자료 연동
- 교수자가 "이번 주 문법 포인트: 把자문" 설정
- 해당 주 학습자 오류 분석 시 把자문 집중 탐지 모드 자동 전환
- 관련 ICL 예시 자동 우선 적용

---

## 콘텐츠 확장 기능

### 중국어 뉴스·SNS URL 분석
```
학습자가 URL 입력 (웨이보·샤오홍수·신화사 등)
      ↓
Cheerio로 텍스트 추출
      ↓
Claude API로 어휘·문체 분석
      ↓
"이 표현은 격식체", "이 단어는 인터넷 신조어",
"이 문형은 HSK 5급 수준" 등 맥락 정보 표시
```
- 선생님의 C-POP·숏폼 콘텐츠·샤오홍수 강의와 직접 연계
- 분석 결과를 오류 카드와 동일한 형식으로 저장 가능

### HSK 급수별 오류 태그
- 모든 오류 카드에 HSK 1~6급 태그 자동 부착
- 내 오류가 어느 수준의 문법 문제인지 객관적 파악
- "HSK 4급 오류만 보기" 필터 제공

---

## 기술·인프라

### 교수자 간 자료 공유 마켓플레이스
- 교수자가 코퍼스·ICL 예시 세트를 공개 설정
- 다른 교수자가 검색·다운로드·즉시 적용
- 다운로드 수·평점 표시
- 전국 중문과 교수자 네트워크 효과 형성

### API 공개 (Phase 3)
- Wunote 오류 분석 기능을 외부 LMS(Canvas·Moodle)에서 API 호출
- 인증: API Key 발급 방식
- 문서: /api/docs 자동 생성 (Swagger)

### 학습자 데이터 이동권
- 전체 오류 기록·단어장·포트폴리오 JSON 내보내기
- 졸업 후에도 데이터 소유 보장
- 개인정보 완전 삭제 요청 기능 포함

### 다국어 UI
- next-intl 라이브러리 사용
- 지원 언어: 한국어(기본) / 영어 / 일본어
- Phase 2 목표

### 오프라인 모드
- 서비스 워커로 오류 카드·단어장 캐싱
- 인터넷 없이도 복습 가능
- 온라인 복귀 시 자동 동기화

---

## 주간 카드뉴스

### 구성 (4장 고정, 스와이프)
| 카드 | 제목 | 핵심 원칙 |
|---|---|---|
| 1장 | 이번 주 나의 오류 | 막대 그래프, 숫자 중심, 5초 안에 읽힘 |
| 2장 | 가장 많이 개선됨 | 반드시 칭찬, 개선 없어도 긍정 프레이밍 |
| 3장 | 지금 당장 할 것 | 제안 1개만, 학습 목표 달성률 포함 |
| 4장 | 다음 주 학습 방향 | 챕터 예고 + 예습 포인트 |

### 전달 방법
1. 앱 내 알림 + 카드뉴스 보관함 (Phase 1)
2. 이메일 Resend (Phase 1)
3. 웹 푸시 PWA (Phase 1)
4. 카카오 알림톡 (Phase 2)

---

## 개발 단계

### Phase 1 (MVP)
- [x] 인증·역할 구분
- [x] 수업 개설·QR 초대
- [x] 2분할 학습 화면 (문서 입력 + 오류 패널 + AI 채팅)
- [x] 오류 카드 (4필드 + CoT) 생성·저장
- [x] 인라인 오류 하이라이트 + 호버·클릭 인터랙션
- [x] 챕터별 프롬프트 자동 적용
- [x] 교수자 코퍼스 업로드 (RAG)
- [x] 수정고 재진단·비교
- [x] 오류 기록 카드 목록
- [x] 교수자 수강생 현황 대시보드
- [x] 게이미피케이션 기초 (배지·레벨·스트릭·효과음)
- [x] 화석화 감지

### Phase 2
- [ ] 주간 카드뉴스 자동 생성·발송
- [ ] 교수자 다음 수업 AI 제안 리포트
- [ ] 과제 출제·루브릭 평가
- [ ] 수업 중 실시간 모드
- [ ] 수업 자료 연동 (당주 문법 포인트)
- [ ] 단어장·플래시카드 (스페이스드 리피티션)
- [ ] 오류 유형 퀴즈 (게이미피케이션 연동)
- [ ] 예문 북마크
- [ ] 학습 목표 설정·추적
- [ ] 번역 역방향 비교 (DeepL·Papago·GPT)
- [ ] URL 분석 모드 (뉴스·SNS)
- [ ] HSK 급수 태그
- [ ] 개인 성장 대시보드·학기 간 비교
- [ ] 교수자 간 마켓플레이스
- [ ] 다국어 UI (영어·일본어)
- [ ] 웹 푸시·이메일 발송

### Phase 3
- [x] 포트폴리오 PDF 자동 생성 (/portfolio)
- [x] 피어 리뷰 기능 (/peer-review)
- [x] 카카오 알림 연동 (/notifications)
- [x] 발음 연습 + 억양 오류 감지 (/pronunciation)
- [x] 연구 데이터 내보내기 + 학습자 데이터 이식성 (/api/export/*, /data-export)
- [x] LMS Public API + API Key 인증 + Swagger (/api/lms/*, /api/docs)
- [x] 오프라인 모드 Service Worker (public/sw.js)

### Phase 3 신규 라우트 참조

| 구분 | 라우트 | 설명 |
|---|---|---|
| 학생 | `/portfolio` | 포트폴리오 PDF 생성 |
| 학생 | `/peer-review` | 피어 리뷰 |
| 학생 | `/pronunciation` | 발음 연습·억양 오류 감지 |
| 학생 | `/notifications` | 카카오 알림 설정 |
| 학생 | `/data-export` | 학습자 데이터 내보내기 |
| 교수 | `/reports/export` | 연구 데이터 익스포트 |
| 교수 | `/settings/api-keys` | LMS API 키 관리 |
| 공개 API | `/api/lms/classes` | 교수자 수업 목록 |
| 공개 API | `/api/lms/classes/[id]/students` | 수강생 명단 |
| 공개 API | `/api/lms/classes/[id]/assignments` | 과제 목록 |
| 공개 API | `/api/lms/classes/[id]/grades` | 성적 내보내기 |
| 문서 | `/api/docs` | Swagger UI |
| 문서 | `/api/docs/openapi.json` | OpenAPI 3.0 스펙 |

**신규 마이그레이션**: `0014` ~ `0018`

---

## PWA 설정

```json
{
  "name": "Wunote — AI 중국어 오류 교정",
  "short_name": "Wunote",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4F46E5",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 환경변수

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Claude API
ANTHROPIC_API_KEY=

# Resend
RESEND_API_KEY=

# Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# 번역 API (Phase 2)
DEEPL_API_KEY=
PAPAGO_CLIENT_ID=
PAPAGO_CLIENT_SECRET=
OPENAI_API_KEY=

# 카카오 (Phase 2)
KAKAO_API_KEY=
```

---

## 코딩 규칙

- TypeScript strict 모드
- 컴포넌트는 함수형 + React Server Component 우선
- 클라이언트 컴포넌트는 `'use client'` 명시, 최소화
- Supabase 쿼리는 `lib/supabase.ts`에서만 호출
- Claude API 호출은 반드시 `app/api/` 서버 라우트에서만
- 오류 처리: try-catch + 사용자 친화적 에러 메시지
- 중국어 텍스트 관련 타입은 `types/index.ts`에 명시
- 효과음은 사용자 인터랙션 이후에만 재생 (브라우저 정책)

---

## 참고 자료

- 강병규 (2025). 「중국어 학습자 코퍼스 오류 유형 분석과 자동 피드백 모델 연구 — ChatGPT와 Claude를 중심으로」. 중한연구학간, 38, 1-33.
  - 표8: 오류 주석 4필드 구조 (p.20)
  - 19~21p: 어휘·문법 영역 자동 주석 단계
  - 23p: RAG 지식 기반 구축 (실용현대한어문법 등 업로드)
  - 24~25p: CoT 단계적 추론 구조
- HSK 동적 작문 코퍼스 오류 분류 체계
- 실용현대한어문법 (刘月华 等著) — RAG 참조 문헌
- 대외한어교학문법 (齐沪扬 编著) — RAG 참조 문헌

---

## Phase 4 (계획)

- 모바일 앱 (React Native)
- LTI 1.3 표준 연동
- 다국어 UI
- AI 튜터 고도화
