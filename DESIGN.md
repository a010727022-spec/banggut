# 방긋 (Banggut) Design System Reference

> 이 문서는 UI 작업 시 참고할 디자인 규격을 정리한 것입니다.
> 원본 참고: [awesome-design-systems](https://github.com/alexpate/awesome-design-systems)

---

## 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + CSS Variables
- **Components**: shadcn/ui + custom components
- **Font**: Pretendard (CDN)
- **Icons**: lucide-react
- **Animation**: framer-motion, tailwindcss-animate

---

## 참고 디자인 시스템

프로젝트와 유사한 스택/철학의 디자인 시스템:

| 디자인 시스템 | URL | 참고 포인트 |
|---|---|---|
| **Shadcn/ui** | https://ui.shadcn.com/ | 컴포넌트 구조, CSS Variable 패턴 |
| **Vercel Geist** | https://vercel.com/geist | 미니멀 타이포그래피, 다크모드 |
| **Radix** | https://radix.modulz.app/ | 접근성, 프리미티브 컴포넌트 |
| **Mantine** | https://mantine.dev/ | 모바일 반응형, 테마 시스템 |
| **GitHub Primer** | https://primer.style/ | 색상 시스템, 토큰 구조 |
| **Chakra UI** | https://chakra-ui.com/ | 시맨틱 토큰, 다크모드 전환 |

---

## 테마 시스템

5개 테마를 CSS 변수로 관리. `data-theme` 속성으로 전환.

| 테마 | 속성값 | 배경(--bg) | 액센트(--ac) | 성격 |
|---|---|---|---|---|
| 밤숲 (기본) | `dark` | `#0c0f0d` | `#5FA88E` | 다크, 자연 |
| 크림 | `cream` | `#F7F3ED` | `#4d8a72` | 라이트, 따뜻함 |
| 네이비 (심야 독서) | `navy` | `#080c18` | `#c4a060` | 다크, 심야 서재 |
| 세피아 | `sepia` | `#191410` | `#c8903a` | 다크, 빈티지 |
| 로제 (구 블러썸) | `blossom` | `#faf5f7` | `#c27090` | 라이트, 더스티 로즈 |

### CSS 변수 토큰

```
--bg   : 페이지 배경
--sf   : Surface 1 (카드 배경)
--sf2  : Surface 2 (약간 더 밝음)
--sf3  : Surface 3 (가장 밝은 surface)
--bd   : Border (얇은 경계)
--bd2  : Border 강조
--tp   : Text Primary
--ts   : Text Secondary
--tm   : Text Muted
--ac   : Accent (주요 액션)
--ac2  : Accent 보조
--ac3  : Accent 연한
--acc  : Accent 위 텍스트 색상
```

**규칙**: 하드코딩 색상 대신 반드시 CSS 변수를 사용할 것. 테마 전환 시 자동 적용됨.

---

## 타이포그래피

폰트: **Pretendard** (한/영 겸용)

| 토큰 | 크기 | Weight | Line-Height | 용도 |
|---|---|---|---|---|
| `display` | 22px | 700 | 1.2 | 페이지 제목 |
| `headline` | 16px | 500 | 1.35 | 섹션 제목 |
| `subhead` | 15px | 500 | 1.4 | 소제목, 강조 |
| `body` | 14px | 400 | 1.6 | 본문 |
| `button` | 14px | 600 | 1.2 | 버튼 텍스트 |
| `caption` | 12px | 400 | 1.5 | 보조 텍스트 |
| `badge` | 11px | 700 | 1.3 | 뱃지, 태그 |
| `micro` | 10px | — | 1.4 | 최소 텍스트 |

사용: `text-display`, `text-headline`, `text-body` 등 Tailwind 클래스.

---

## 간격 (Spacing)

| 토큰 | 값 | 용도 |
|---|---|---|
| `card-p` | 16px | 카드 내부 패딩 |
| `card-gap` | 12px | 카드 내 요소 간격 |
| `page-x` | 20px | 좌우 페이지 여백 |
| `section-gap` | 24px | 섹션 간 간격 |

---

## 둥글기 (Border Radius)

| 토큰 | 값 | 용도 |
|---|---|---|
| `rounded-card` | 14px | 카드 |
| `rounded-btn` | 12px | 버튼 |
| `rounded-badge` | 20px | 뱃지, 칩 |
| `rounded-avatar` | 50% | 프로필 이미지 |

---

## 그림자 (Box Shadow)

| 토큰 | 용도 |
|---|---|
| `shadow-card` | 카드 기본 그림자 |
| `shadow-soft` | 플로팅 요소 |
| `shadow-glow` | 민트/발광 효과 |
| `shadow-shelf` | 서가 UI |
| `shadow-card-hover` | 카드 호버 |

---

## 컴포넌트 클래스

### 버튼

| 클래스 | 용도 | 스타일 |
|---|---|---|
| `.btn-main` | 주요 CTA | 풀와이드, accent 배경, 14px, bold |
| `.btn-secondary` | 보조 액션 | 투명 배경, accent 보더 |
| `.btn-text` | 텍스트 버튼 | muted 색상, 12px |
| `.btn-danger` | 삭제/위험 | 빨간색 텍스트, 12px |

### 카드

- `.card-tap`: 탭 가능한 카드 (scale 0.98 on active, border 강조 on hover)

### 상태

- `.empty-state`: 빈 상태 UI (중앙정렬, 아이콘 + 텍스트)
- `.progress-premium`: 진행바 (accent 그라데이션)
- `.slbl`: 섹션 라벨 (대문자, tracking 넓음)

---

## 애니메이션

| 토큰 | Duration | Easing | 용도 |
|---|---|---|---|
| `animate-slide-up` | 0.3s | ease-out | 바텀시트, 모달 |
| `animate-fade-in` | 0.3s | ease-out | 요소 진입 |
| `animate-scale-in` | 0.2s | ease-out | 팝업, 드롭다운 |

**인터랙션 원칙**:
- active 시 `scale(0.96~0.98)` 적용
- 테마 전환: `transition 0.4s cubic-bezier(0.22,1,0.36,1)`
- 최소한의 모션, 자연스러운 반응

---

## 모바일 퍼스트

- Safe area inset 적용 (`env(safe-area-inset-*)`)
- `-webkit-tap-highlight-color: transparent`
- `touch-action: manipulation`
- 하단 네비게이션 기반 레이아웃

---

## UI 작업 체크리스트

1. 색상은 CSS 변수(`var(--ac)`, `var(--tp)` 등)만 사용
2. 타이포그래피는 정의된 토큰(`text-display`, `text-body` 등) 사용
3. 5개 테마 모두에서 정상 렌더링 확인
4. 모바일 퍼스트로 설계 (375px 기준)
5. 카드/버튼은 기존 컴포넌트 클래스 활용
6. 애니메이션은 정의된 키프레임 우선 사용
7. 접근성: 충분한 색상 대비, 터치 영역 최소 44px
