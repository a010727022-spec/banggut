# UI Upgrade Design Spec

## Summary
방긋 앱의 컴포넌트 패턴과 레이아웃을 전체적으로 업그레이드한다. 기존 배포된 디자인(5테마, 레이아웃)을 유지하면서 코드 품질과 시각적 세련미를 높인다.

## Decisions Made
- **Font**: Pretendard 유지, weight 다양하게 활용 (300~800)
- **Styling**: Tailwind arbitrary value + CSS 변수 토큰 (`bg-sf`, `text-tp` 등)
- **Empty states**: lucide-react 아이콘 (단일 원 + 아이콘, 사각 박스 없음)
- **Themes**: 5개 테마 전부 유지 (블러썸/밤숲 텍스트 색상 미세 조정)
- **Approach**: Layer-by-Layer (인프라 → 컴포넌트 → 페이지 → 폴리시)

## Layer 1: Infrastructure

### Tailwind CSS 변수 토큰 추가 (tailwind.config.ts)
```
colors:
  sf: "var(--sf)"       // surface
  sf2: "var(--sf2)"
  sf3: "var(--sf3)"
  bg-page: "var(--bg)"  // page background
  tp: "var(--tp)"       // text primary
  ts: "var(--ts)"       // text secondary
  tm: "var(--tm)"       // text muted
  ac: "var(--ac)"       // accent
  ac2: "var(--ac2)"
  ac3: "var(--ac3)"
  acc: "var(--acc)"     // accent contrast
  bd: "var(--bd)"       // border
  bd2: "var(--bd2)"
```

### z-index scale (tailwind.config.ts)
```
zIndex:
  nav: 40
  header: 50
  overlay: 60
  sheet: 70
  modal: 80
  toast: 90
  top: 100
```

### globals.css 정리
- 중복 키프레임 통합
- `.glass` 유틸리티 추가

## Layer 2: Shared Components

### EmptyState component
- Single circle (64px) + lucide icon (30px, strokeWidth 1.3, opacity 0.55)
- Circle: 1px border, accent color, opacity 0.12
- Float animation (4s ease-in-out infinite)
- Top edge highlight line on card
- Pulsing ambient glow behind icon
- Gradient CTA button with inner highlight + glow shadow

Icon mapping:
| 용도 | icon |
|---|---|
| 읽는 책 없음 | BookOpen |
| 완독 없음 | Library |
| 글귀/스크랩 없음 | Highlighter |
| 서평 없음 | PenLine |
| 대화 없음 | MessageCircle |
| 모임 없음 | Users |
| 위시 없음 | Bookmark |

### Other shared components to extract
- SectionHeader (label + title + action)
- ProgressBar (accent gradient + glow dot)
- StatusBadge (읽는중/완독/위시/중단)
- Skeleton (shimmer variants)
- StarRating (extract from book page)

## Layer 3: Page Updates
- Replace all emoji (📖📝💬) with lucide icons
- Replace inline empty state text with EmptyState component
- Convert inline styles → Tailwind with new tokens
- Large page splitting (book/[bookId] 2464 lines)

## Layer 4: Polish
- Page entrance animations (staggered fade-in)
- Card hover/active micro-interactions
- Theme transition smoothness
- Accessibility: touch targets 44px min, color contrast

## Files Changed
All files in app/(main)/, app/(auth)/, components/, globals.css, tailwind.config.ts

## Attribution
Empty state illustrations: lucide-react (ISC License)
Previously downloaded Storyset/OpenDoodles/Popsy — not used in final design.
