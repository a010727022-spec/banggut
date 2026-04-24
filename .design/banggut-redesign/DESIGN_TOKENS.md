# Design Tokens: 방긋

**철학: Playful / Toy-like** — 캐릭터 중심의 따뜻한 기록 앱. 날씨돌이·북적북적 계열.

기존 `app/globals.css`의 5개 테마 시스템을 **유지**하되 cream 테마를 기준(default)으로 **확장·정리**. 제거: Fraunces. 추가: 스페이싱 스케일, 모션 토큰, 컴포넌트별 시맨틱 토큰, 방긋이 전용 토큰.

---

## 1. Color Tokens (cream 테마 기준, light mode)

### 시맨틱 배경
| 토큰 | 값 | 용도 |
|---|---|---|
| `--bg` | `#F7F3ED` | 페이지 배경 (크림) |
| `--sf` | `#EDE7DF` | 카드 배경 1단계 |
| `--sf2` | `#E0D9D0` | 카드 배경 2단계 (입력·웰) |
| `--sf3` | `#D0C8BC` | 트랙·프로그레스 배경 |
| `--sf-tinted` | **🆕** `color-mix(in srgb, var(--ac) 6%, var(--sf))` | 방긋이 카드 등 살짝 초록 스민 배경 |
| `--overlay` | **🆕** `rgba(28,32,29,0.45)` | 모달 백드롭 |

### 시맨틱 텍스트
| 토큰 | 값 | 용도 |
|---|---|---|
| `--tp` | `#1c201d` | 본문·제목 (primary) |
| `--ts` | `#4a5550` | 서브텍스트 (secondary) |
| `--tm` | `#7a8b7e` | 희미한 텍스트 (muted) — 레이블·캡션 |
| `--tf` | **🆕** `rgba(28,32,29,0.35)` | 가장 흐린 텍스트 (placeholder) |
| `--acc` | `#f7f3ed` | 액센트 배경 위의 텍스트 (inverse) |

### 시맨틱 보더
| 토큰 | 값 | 용도 |
|---|---|---|
| `--bd` | `rgba(95,164,142,0.14)` | 기본 보더 (은은한 세이지) |
| `--bd2` | `rgba(95,164,142,0.28)` | 강조 보더 (포커스·선택) |
| `--bd-focus` | **🆕** `var(--ac)` | 포커스 링 |

### 액센트 (Primary = 세이지)
| 토큰 | 값 | 용도 |
|---|---|---|
| `--ac` | `#5FA48E` | **주 액센트** — 버튼·링크·활성 탭 |
| `--ac2` | `#7ABBA4` | 그라디언트 보조·호버 |
| `--ac3` | `#A4D4C0` | 파스텔 민트 (빈 상태·장식) |
| `--ac-deep` | **🆕** `#3A6B56` (기존 `--theme-deep` 승격) | 진한 세이지 — 히어로 카드 배경 |

### 특별 액센트 (희소 사용)
| 토큰 | 값 | 용도 | 노출 원칙 |
|---|---|---|---|
| `--milestone` | `#B79556` (기존) | 골드 — **스트릭·완독 축하 전용** | 하루 1-2회만 |
| `--warm` | **🆕** `#E07856` | 따뜻한 경고·넛지 ("오늘 못 읽었어요") | 드물게 |
| `--success` | **🆕** `var(--ac)` | 성공 (별칭) | — |
| `--error` | **🆕** `#C05A48` | 오류·삭제 확인 | 드물게 |

### 방긋이 전용 🆕
| 토큰 | 값 | 용도 |
|---|---|---|
| `--mascot-body` | `#C8D9CE` | 방긋이 몸통 색 (SVG 폴백) |
| `--mascot-speech-bg` | `#FFFFFF` | 말풍선 배경 |
| `--mascot-speech-border` | `var(--bd2)` | 말풍선 보더 |
| `--mascot-glow` | `color-mix(in srgb, var(--ac) 20%, transparent)` | 방긋이 주변 빛무리 |

---

## 2. Spacing Scale (4px base)

북적북적·날씨돌이 계열은 적당히 여백 있는 scale이 맞음. 4px 기본, 일부 non-linear.

| 토큰 | 값 | 용도 |
|---|---|---|
| `--space-0` | `0` | — |
| `--space-1` | `2px` | 아이콘 내부 패딩 |
| `--space-2` | `4px` | 배지 내부 |
| `--space-3` | `8px` | 작은 간격 |
| `--space-4` | `12px` | 텍스트 ↔ 아이콘 |
| `--space-5` | `16px` | **기본** 카드 내부 패딩 |
| `--space-6` | `20px` | 좌우 페이지 마진 (고정) |
| `--space-7` | `24px` | 섹션 내부 |
| `--space-8` | `32px` | 섹션 간 |
| `--space-9` | `48px` | 큰 여백 (히어로 상단) |
| `--space-10` | `64px` | 헤로 단위 |

**규칙**: 좌우 페이지 마진은 항상 `var(--space-6)` = 20px. 카드 내부 패딩은 14-16px 범위(`--space-5`).

---

## 3. Typography

### Font Family (2개만)
| 토큰 | 값 | 용도 |
|---|---|---|
| `--font-body` | `"Pretendard Variable", -apple-system, sans-serif` | UI·본문·숫자 |
| `--font-playful` | `"Gaegu", "Pretendard Variable", cursive` | 방긋이 대사·감성 카피·격려 문구 |

**⚠️ 폐기**: `Fraunces` (에디토리얼 유발). 숫자는 `Pretendard Variable`의 `font-variant-numeric: tabular-nums` 활용.

### Font Size Scale
| 토큰 | 값 | 용도 |
|---|---|---|
| `--text-xs` | `10px` | 레이블 (대문자) |
| `--text-sm` | `11.5px` | 캡션·메타 |
| `--text-base` | `13px` | 본문 기본 |
| `--text-md` | `14px` | 리스트 아이템 제목 |
| `--text-lg` | `16px` | 카드 제목 |
| `--text-xl` | `18px` | 섹션 제목 |
| `--text-2xl` | `22px` | 히어로 제목 |
| `--text-3xl` | `28px` | 큰 숫자 (스트릭) |
| `--text-4xl` | `36px` | 더 큰 숫자 (완독 카운트) |

### Font Weight
| 토큰 | 값 |
|---|---|
| `--fw-normal` | `400` |
| `--fw-medium` | `500` |
| `--fw-semibold` | `600` |
| `--fw-bold` | `700` |
| `--fw-extrabold` | `800` (기존 코드 유지) |

### Line Height
| 토큰 | 값 | 용도 |
|---|---|---|
| `--lh-tight` | `1.2` | 제목 |
| `--lh-snug` | `1.35` | 카드 제목 |
| `--lh-normal` | `1.5` | 본문 |
| `--lh-relaxed` | `1.7` | 긴 글·글귀 |

### Letter Spacing
| 토큰 | 값 | 용도 |
|---|---|---|
| `--ls-tight` | `-0.3px` | 큰 숫자·히어로 |
| `--ls-normal` | `0` | 본문 |
| `--ls-gaegu` | `0.02em` | Gaegu 폰트 전용 (자연스러운 공기감) |
| `--ls-wide` | `0.8px` | 대문자 레이블 |

### 타이포 패턴
```css
/* 감성 카피 — Gaegu */
.copy-playful {
  font-family: var(--font-playful);
  font-size: var(--text-lg);
  letter-spacing: var(--ls-gaegu);
  color: var(--tp);
}

/* 대문자 레이블 */
.label-caps {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: var(--fw-bold);
  letter-spacing: var(--ls-wide);
  text-transform: uppercase;
  color: var(--tm);
}

/* 숫자 강조 (스트릭 등) */
.numeric-display {
  font-family: var(--font-body);
  font-variant-numeric: tabular-nums;
  font-weight: var(--fw-extrabold);
  letter-spacing: var(--ls-tight);
}
```

---

## 4. Radius

Playful/Toy-like는 카드가 **둥글둥글**. 날씨돌이·북적북적 모두 14-20px 범위.

| 토큰 | 값 | 용도 |
|---|---|---|
| `--r-xs` | `4px` | 작은 배지 |
| `--r-sm` | `8px` | 인라인 아이콘 박스 |
| `--r-md` | `14px` | **기본 카드** |
| `--r-lg` | `18px` | 히어로 카드 |
| `--r-xl` | `24px` | 바텀시트 상단 |
| `--r-pill` | `100px` | 버튼·칩·태그 |
| `--r-circle` | `50%` | 아바타·도트 |

---

## 5. Shadow

**드물게 사용**. 톤 유지하려면 그림자는 은은하게.

| 토큰 | 값 | 용도 |
|---|---|---|
| `--shadow-none` | `none` | 기본 카드 (보더만) |
| `--shadow-sm` | `0 2px 8px rgba(0,0,0,0.04)` | 살짝 떠있음 |
| `--shadow-md` | `0 6px 18px color-mix(in srgb, var(--ac) 15%, rgba(0,0,0,0.08))` | 버튼 프레스 |
| `--shadow-lg` | `0 12px 32px rgba(0,0,0,0.12)` | 바텀시트·모달 |
| `--shadow-focus` | `0 0 0 3px color-mix(in srgb, var(--ac) 30%, transparent)` | 포커스 링 |
| `--shadow-mascot` | **🆕** `0 8px 24px color-mix(in srgb, var(--ac) 20%, transparent)` | 방긋이 히어로 글로우 |

---

## 6. Motion

Playful = 살짝 통통 튀지만 과하지 않음. `bounce` 이징을 방긋이 인터랙션에만 제한적으로.

| 토큰 | 값 | 용도 |
|---|---|---|
| `--duration-instant` | `100ms` | 즉시 피드백 (탭) |
| `--duration-fast` | `180ms` | 색 변경·호버 |
| `--duration-normal` | `260ms` | 카드 등장 |
| `--duration-slow` | `400ms` | 테마 전환·페이지 전환 |
| `--duration-slower` | `600ms` | 진행률 바 애니메이션 |
| `--easing-default` | `cubic-bezier(0.22, 1, 0.36, 1)` | 기본 (부드러운 out) |
| `--easing-in` | `cubic-bezier(0.4, 0, 1, 1)` | 사라짐 |
| `--easing-out` | `cubic-bezier(0, 0, 0.2, 1)` | 등장 |
| `--easing-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | **방긋이 탭·완독 축하만** |

`prefers-reduced-motion: reduce` 시 모든 duration을 `0ms`로 덮어쓰기 (globals.css에 추가).

---

## 7. Layout

| 토큰 | 값 | 용도 |
|---|---|---|
| `--max-w-page` | `512px` (`max-w-lg`) | 중앙 정렬된 모바일 앱 영역 |
| `--page-gutter` | `20px` | 좌우 패딩 |
| `--nav-height` | **🆕** `60px` | 하단 네비 (기존 94px → 축소) |
| `--nav-safe-bottom` | `env(safe-area-inset-bottom, 0px)` | iOS 노치 |
| `--header-height` | `64px` | 상단 헤더 (아바타+인사+벨) |

---

## 8. Component Tokens (Semantic)

상위 토큰을 조합한 컴포넌트별 별칭. 컴포넌트 변경 시 한 곳만 수정.

### Button
| 토큰 | 값 |
|---|---|
| `--btn-primary-bg` | `linear-gradient(135deg, var(--ac), var(--ac2))` |
| `--btn-primary-fg` | `var(--acc)` |
| `--btn-primary-radius` | `var(--r-pill)` |
| `--btn-primary-shadow` | `var(--shadow-md)` |
| `--btn-secondary-bg` | `var(--sf)` |
| `--btn-secondary-fg` | `var(--tp)` |
| `--btn-ghost-fg` | `var(--ac)` |

### Card
| 토큰 | 값 |
|---|---|
| `--card-bg` | `var(--sf)` |
| `--card-border` | `0.5px solid var(--bd)` |
| `--card-radius` | `var(--r-md)` |
| `--card-padding` | `var(--space-5)` |
| `--card-gap` | `var(--space-3)` |

### Hero (방긋이 히어로)
| 토큰 | 값 |
|---|---|
| `--hero-bg` | `linear-gradient(135deg, var(--sf-tinted), var(--sf))` |
| `--hero-radius` | `var(--r-lg)` |
| `--hero-padding` | `var(--space-6)` |
| `--hero-mascot-size` | `72px` |
| `--hero-mascot-size-lg` | `96px` |

### Bottom Nav
| 토큰 | 값 |
|---|---|
| `--nav-bg` | `color-mix(in srgb, var(--bg) 92%, transparent)` |
| `--nav-blur` | `blur(20px)` |
| `--nav-border` | `0.5px solid var(--bd)` |
| `--nav-icon-size` | `22px` |
| `--nav-label-size` | `var(--text-xs)` |
| `--nav-item-gap` | `var(--space-2)` |

---

## 9. Dark Mode

기존 5테마 시스템 **유지**. `[data-theme="dark"]` / `navy` / `sepia`가 어두운 variant. 사용자 선택 우선이므로 `prefers-color-scheme: dark`는 **미적용** (수동 선택만). 단 `prefers-reduced-motion`은 자동 반영.

---

## 10. 제안: `app/globals.css` cream 섹션 수정

현재 cream 블록(line 34-50) 위에 추가:

```css
/* ── 공용 토큰 (테마 불변) ── */
:root {
  /* Spacing */
  --space-0: 0; --space-1: 2px; --space-2: 4px; --space-3: 8px;
  --space-4: 12px; --space-5: 16px; --space-6: 20px; --space-7: 24px;
  --space-8: 32px; --space-9: 48px; --space-10: 64px;

  /* Typography */
  --font-body: "Pretendard Variable", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-playful: "Gaegu", "Pretendard Variable", cursive;

  --text-xs: 10px; --text-sm: 11.5px; --text-base: 13px; --text-md: 14px;
  --text-lg: 16px; --text-xl: 18px; --text-2xl: 22px; --text-3xl: 28px; --text-4xl: 36px;

  --fw-normal: 400; --fw-medium: 500; --fw-semibold: 600; --fw-bold: 700; --fw-extrabold: 800;

  --lh-tight: 1.2; --lh-snug: 1.35; --lh-normal: 1.5; --lh-relaxed: 1.7;
  --ls-tight: -0.3px; --ls-normal: 0; --ls-gaegu: 0.02em; --ls-wide: 0.8px;

  /* Radius */
  --r-xs: 4px; --r-sm: 8px; --r-md: 14px; --r-lg: 18px; --r-xl: 24px;
  --r-pill: 100px; --r-circle: 50%;

  /* Motion */
  --duration-instant: 100ms; --duration-fast: 180ms; --duration-normal: 260ms;
  --duration-slow: 400ms; --duration-slower: 600ms;
  --easing-default: cubic-bezier(0.22, 1, 0.36, 1);
  --easing-in: cubic-bezier(0.4, 0, 1, 1);
  --easing-out: cubic-bezier(0, 0, 0.2, 1);
  --easing-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Layout */
  --max-w-page: 512px;
  --page-gutter: 20px;
  --nav-height: 60px;
  --header-height: 64px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

그리고 `[data-theme="cream"]` 블록 **아래에 추가**:

```css
[data-theme="cream"] {
  /* 기존 유지 */
  --bg: #F7F3ED;
  --sf: #EDE7DF;
  /* ... 기존 ... */

  /* 🆕 확장 */
  --sf-tinted: color-mix(in srgb, var(--ac) 6%, var(--sf));
  --overlay: rgba(28,32,29,0.45);
  --tf: rgba(28,32,29,0.35);
  --bd-focus: var(--ac);
  --ac-deep: #3A6B56;  /* --theme-deep 개명, 기존도 유지해 하위호환 */
  --warm: #E07856;
  --success: var(--ac);
  --error: #C05A48;

  /* 방긋이 전용 */
  --mascot-body: #C8D9CE;
  --mascot-speech-bg: #FFFFFF;
  --mascot-speech-border: var(--bd2);
  --mascot-glow: color-mix(in srgb, var(--ac) 20%, transparent);

  /* Shadows */
  --shadow-sm: 0 2px 8px rgba(0,0,0,0.04);
  --shadow-md: 0 6px 18px color-mix(in srgb, var(--ac) 15%, rgba(0,0,0,0.08));
  --shadow-lg: 0 12px 32px rgba(0,0,0,0.12);
  --shadow-focus: 0 0 0 3px color-mix(in srgb, var(--ac) 30%, transparent);
  --shadow-mascot: 0 8px 24px color-mix(in srgb, var(--ac) 20%, transparent);
}
```

다른 테마(dark/navy/sepia/blossom)에도 동일한 확장 토큰을 추가해야 함 (값은 각 테마 톤에 맞게 조정). 우선순위:
1. cream 먼저 완성 → 목업·홈 재설계 진행
2. 다른 테마는 컴포넌트 안정화 이후 일괄 확장

---

## 11. 폰트 로딩 변경

`app/layout.tsx`에서 `Fraunces` import 제거:
```tsx
// ❌ 제거
<link href="https://fonts.googleapis.com/css2?family=Fraunces:..." />

// ✅ 유지
<link href=".../pretendardvariable-dynamic-subset.css" />
<link href="https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&display=swap" />
```

Fraunces 참조된 컴포넌트(있다면 StatsWidget, 이미 제거됨 / CalendarWidget 리팩토링 필요) 일괄 교체:
- Fraunces → `var(--font-body)` + `font-variant-numeric: tabular-nums`

---

## 12. 사용 가이드

### 컴포넌트를 새로 만들 때
1. **색**: 절대 하드코딩 금지. `var(--ac)` / `var(--sf)` / `var(--tp)`만 사용.
2. **간격**: `var(--space-N)` 사용. `margin: 12px` 대신 `margin: var(--space-4)`.
3. **라운드**: `var(--r-md)` 기본, 카드 14-18px 범위.
4. **폰트**: UI는 `var(--font-body)` (기본), 방긋이 대사/격려는 `var(--font-playful)`.
5. **애니메이션**: `transition: var(--duration-normal) var(--easing-default)`.

### 방긋이 관련 컴포넌트
- 항상 `var(--mascot-*)` 토큰 활용
- 글로우는 `box-shadow: var(--shadow-mascot)`
- 탭 애니메이션은 `var(--easing-bounce)` 허용 (예외적으로)

### 골드(`--milestone`) 사용 규칙
- **스트릭 7일/30일 달성**, **책 완독 순간**에만
- 일상 UI (버튼·카드)에 사용 금지
- "특별한 순간" 시그널로서 희소성 유지
