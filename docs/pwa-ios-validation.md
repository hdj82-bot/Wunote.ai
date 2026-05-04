# iOS Add-to-Home-Screen 검증 — Wunote PWA

PR #26 (`feat(pwa): iOS splash + tablet (md/lg) layout polish`) 이후 실 디바이스에서
PWA 설치 → 스플래시 → 매니페스트 → 오프라인 큐 동작을 확인한 결과를 기록한다.

검증은 두 단계로 나뉜다.

1. **정적 검증 (static)** — `npm run pwa:check` 한 줄로 manifest, layout meta, sw.js
   상태를 파일 시스템 단위로 확인. CI에서도 같은 스크립트가 돌도록 `lighthouse.yml`
   다음 이터레이션에 묶을 수 있음.
2. **실 디바이스 검증 (manual)** — 아래 체크리스트를 실제 iPhone/iPad Safari 에서
   진행하고 결과를 표에 기록.

## 1. 정적 검증 결과

`npm run pwa:check` 의 산출물. 본 문서 작성 시점 (main `3110c55`) 기준.

| 항목 | 값 / 상태 |
| --- | --- |
| `manifest.name` | `Wunote — AI 중국어 오류 교정` |
| `manifest.short_name` | `Wunote` |
| `manifest.display` | `standalone` ✓ |
| `manifest.theme_color` | `#4F46E5` ✓ |
| `manifest.background_color` | `#ffffff` ✓ |
| `manifest.start_url` / `scope` | `/` / `/` ✓ |
| `purpose:any` 192×192 PNG | `/icons/icon-192.png` (9 214 B) ✓ |
| `purpose:any` 512×512 PNG | `/icons/icon-512.png` (40 282 B) ✓ |
| `purpose:maskable` 192×192 PNG | `/icons/icon-192-maskable.png` (8 266 B) ✓ |
| `purpose:maskable` 512×512 PNG | `/icons/icon-512-maskable.png` (38 930 B) ✓ |
| `appleWebApp.capable` | `true` ✓ |
| `appleWebApp.statusBarStyle` | `default` ✓ (인디고 테마 컬러 위 흰색 상태바 글자) |
| `appleWebApp.title` | `Wunote` ✓ |
| `appleWebApp.startupImage[]` | 4개 (iPad Pro 12.9 / iPad Pro 11 / iPhone Pro Max / iPhone Pro) ✓ |
| Splash 파일 디스크 존재 | 4/4 (188 991 ~ 221 636 B) ✓ |
| `viewport.width` | `device-width` ✓ |
| `viewport.viewportFit` | `cover` ✓ (notched iPhone safe-area 대응) |
| `sw.js` install/fetch handler | ✓ / ✓ |
| `sw.js` `/offline.html` fallback | ✓ |

전 항목 PASS. CLI 출력은 `npm run pwa:check` 로 재현 가능.

## 2. 실 디바이스 검증 — 체크리스트

각 항목은 실제 디바이스에서 확인 후 PR description 또는 본 문서에 결과를 기록한다.

### 2.1 테스트 디바이스 / 환경

| 필드 | 기록 |
| --- | --- |
| 디바이스 | _(예: iPhone 14 Pro)_ |
| iOS 버전 | _(예: 17.4.1)_ |
| Safari 버전 | _(설정 → 일반 → 정보)_ |
| 네트워크 | _(Wi-Fi / LTE / 5G)_ |
| 검증 일자 | _(YYYY-MM-DD)_ |
| 검증자 | _(handle)_ |
| 빌드 / 커밋 | `git rev-parse HEAD` |

### 2.2 Add-to-Home-Screen

1. Safari 에서 `https://<env-url>/ko/login` 접속
2. 공유 시트 → "홈 화면에 추가"
3. 설치 다이얼로그 확인

| 항목 | 기대 값 | 결과 |
| --- | --- | --- |
| 다이얼로그 아이콘 | 인디고 그라디언트 + 흰색 W + 앰버 밑줄 | ☐ PASS / ☐ FAIL |
| 다이얼로그 타이틀 | `Wunote` | ☐ PASS / ☐ FAIL |
| URL preview | start_url 미리보기 노출 | ☐ PASS / ☐ FAIL |
| 추가 후 홈 화면 아이콘 | 둥근 사각형으로 마스킹된 indigo 아이콘 (잘리지 않음) | ☐ PASS / ☐ FAIL |
| 홈 화면 라벨 | `Wunote` (잘리지 않음) | ☐ PASS / ☐ FAIL |

> **마스킹 잘림 발견 시:** `icon-192-maskable.png` / `icon-512-maskable.png` 의 safe-zone (10%) 이 부족한 것이다. `scripts/generate-icons.ps1` 의 `pad = $Size * 0.10` 을 `0.12` 로 늘려 재생성.

### 2.3 Cold Launch 스플래시

1. 홈 화면 아이콘 탭 → 앱이 standalone 모드로 cold-start
2. 첫 1~2초 동안 노출되는 splash 이미지 관찰

| 항목 | 기대 값 | 결과 |
| --- | --- | --- |
| Splash 배경 | 인디고 그라디언트 풀-블리드 (흰 가장자리 X) | ☐ PASS / ☐ FAIL |
| Splash 로고 | 화면 중앙, 잘리지 않음 | ☐ PASS / ☐ FAIL |
| Splash → 첫 페이지 전환 | 흰색 깜빡임 없음 | ☐ PASS / ☐ FAIL |
| 가로 모드 | landscape splash 가 정의되지 않음 — 흰 splash 가 잠깐 노출되어도 OK (의도된 동작) | ☐ PASS / ☐ N/A |

> **흰 화면이 길게 보이면:** 디바이스 width × pixel-ratio 가 4개 splash media query 에 모두 매치되지 않는 모델일 가능성. 디바이스 모델/해상도를 기록하고 `app/layout.tsx`의 `startupImage` 배열에 `(device-width: …) and (-webkit-device-pixel-ratio: …)` 항목 추가.

### 2.4 Standalone 런타임 매니페스트

홈 화면 아이콘으로 진입한 standalone 인스턴스에서 다음을 확인:

| 항목 | 기대 값 | 결과 |
| --- | --- | --- |
| 상단 Safari 주소창 | 비표시 (display:standalone) | ☐ PASS / ☐ FAIL |
| 상태바 시간 / 배터리 컬러 | 검정 (statusBarStyle:default) — 인디고 헤더 위에서도 가독성 OK | ☐ PASS / ☐ FAIL |
| 노치 좌우 콘텐츠 | viewportFit:cover 로 풀 너비 렌더 (안전 영역 내부) | ☐ PASS / ☐ FAIL |
| pinch-zoom | 가능 (WCAG 1.4.4 — `maximumScale` 미설정으로 의도) | ☐ PASS / ☐ FAIL |
| 외부 링크 클릭 | Safari in-app browser 가 아니라 Safari 본 앱으로 이동 | ☐ PASS / ☐ FAIL |

### 2.5 오프라인 → 큐 → 재전송 (PR #25 회귀 검증)

1. 학습 화면 (`/ko/learn/<chapter>`) 진입 후 임의 중국어 텍스트 작성
2. 설정 → 비행기 모드 ON
3. "재진단" 버튼 탭

| 항목 | 기대 값 | 결과 |
| --- | --- | --- |
| 즉시 토스트 | "오프라인 — 1건 대기 중. 연결되면 자동 전송됩니다." | ☐ PASS / ☐ FAIL |
| `OfflineIndicator` 배너 | 화면 하단에 "오프라인" 표시 | ☐ PASS / ☐ FAIL |
| 페이지 새로고침 | `/offline.html` (📡 + 다시 시도 버튼) | ☐ PASS / ☐ FAIL |

4. 비행기 모드 OFF → 약 1~2초 대기

| 항목 | 기대 값 | 결과 |
| --- | --- | --- |
| 자동 flush 토스트 | "대기 중인 요청을 전송 중…" → "1건이 성공적으로 전송되었습니다." | ☐ PASS / ☐ FAIL |
| 분석 결과 | 오류 카드 표시 | ☐ PASS / ☐ FAIL |
| IDB 큐 길이 | 0 (Safari 개발자 도구 → Storage → IndexedDB → wunote-offline → queue) | ☐ PASS / ☐ FAIL |

> **iOS 의 SW Background Sync:** iOS Safari 는 `sync` 이벤트를 구현하지 않는다. PR #25 의 큐 flush 는 `online` 이벤트 + 페이지 활성화 시점에 동작하며, 백그라운드에서 자동 flush 되지 않는다. 비행기 모드 해제 후 사용자가 앱으로 돌아와야 큐가 비워진다 — 이는 의도된 동작 (Safari 정책 한계).

### 2.6 Lighthouse on-device (옵션)

가능하면 Mac 의 Safari 개발자 도구 → 디바이스 → Audit 으로 Lighthouse 를 한 번 더 돌리고 카테고리 점수를 기록한다.

| 카테고리 | 데스크톱 (CI, PR #29) | iOS 디바이스 |
| --- | --- | --- |
| PWA | _(CI 결과)_ | _(기록)_ |
| Performance | _(CI 결과)_ | _(기록)_ |
| Accessibility | _(CI 결과)_ | _(기록)_ |
| Best Practices | _(CI 결과)_ | _(기록)_ |

## 3. 알려진 제약 / 비-목표

- **iPad / iPhone 가로 모드 splash** 미지원. 4개 splash 모두 portrait media query.
  iOS 는 가로 모드일 때 흰 splash 로 폴백하며, 콜드 스타트가 짧아 UX 영향이 거의 없음.
  필요해지면 동일 스크립트(`scripts/generate-ios-splash.ps1`)에 landscape 차원 추가.
- **iPhone SE / 8 등 4.7" 모델** 의 splash 미지원. 동일 이유, 필요 시 추가.
- **Background Sync 미동작 (iOS).** PR #25 commit msg 에 명시. Android 에서는 SW
  `sync` 이벤트로 자동 flush 되지만 iOS 는 `online` 이벤트 의존.
- **Add to Home Screen 다이얼로그 자동 노출 안됨** (iOS 는 BeforeInstallPromptEvent
  미지원). 사용자가 직접 공유 시트에서 "홈 화면에 추가" 를 선택해야 함 — 정상.

## 4. 재검증 트리거

다음 변경이 들어가면 본 문서 §2 를 재실행해야 한다:

- `app/layout.tsx` 의 `viewport` / `appleWebApp` / `icons` 필드 변경
- `public/manifest.json` 변경
- `public/sw.js` 의 navigation / install / activate 핸들러 변경
- `lib/offline-queue.ts` 의 enqueue / flush 동작 변경
- 새 splash 해상도 추가 (`scripts/generate-ios-splash.ps1`)
