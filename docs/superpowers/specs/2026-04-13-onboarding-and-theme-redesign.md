# 방긋 온보딩 개선 + 테마 색상 리디자인 스펙

> 2026-04-13 | Team: Amy(기획) + Tasha(MZ 마케팅) + Gail Bichler(디자인)

---

## 1. 목표

**"가입부터 첫 AI 대화까지 90초"** — Aha moment 최단 경로 전략.

현재 문제:
- 로그인 → 프로필 → 빈 라이브러리 → 사용자가 알아서 책 추가 → 토론 페이지 직접 찾기
- 핵심 가치(AI 독서 토론)를 체험하기 전 3~4단계 필요
- 콜드 스타트: 프로필 설정 직후 텅 빈 화면

---

## 2. 새 온보딩 플로우 (5단계)

### Step 1: 로그인 (기존 유지)
- 카카오 OAuth + 이메일 대체
- 변경 없음

### Step 2: 독서 성향 질문 (신규)
3문항, 총 ~30초 소요. 각 문항은 별도 화면 (페이드 전환).

**Q1: 장르 선택 (멀티셀렉트)**
- 소설, 에세이, 인문학, 자기계발, 시/산문, SF/판타지, 경영/경제, 사회과학
- UI: 2컬럼 그리드, Lucide 아이콘 + 이름 + 한줄 설명
- 질문: "어떤 책에 / 끌리세요?" (줄바꿈으로 시적 호흡)

**Q2: 독서 빈도 (싱글셀렉트)**
- 거의 매일 / 주 2~3회 / 월 1~2권 / 다시 시작하는 중
- UI: 카드형 리스트, 아이콘 + 메인텍스트 + 부연설명

**Q3: 토론 스타일 (싱글셀렉트)**
- 편하게 감상 나누기 / 깊이 있는 분석과 토론 / 생각을 자극하는 질문
- UI: 카드 안에 실제 AI 대화 샘플을 인용문 형태로 표시
- 선택 시 왼쪽 보더가 accent로 전환

**데이터 저장**: profiles 테이블에 신규 컬럼
- `preferred_genres: text[]` — 장르 멀티셀렉트
- `reading_frequency: text` — 독서 빈도 (daily/weekly/monthly/beginner)
- `discussion_style: text` — 토론 스타일 (casual/analytical/socratic)
- `onboarding_completed: boolean` — 온보딩 완료 여부

**AI 활용**: discussion_style에 따라 AI 모드 가중치 조절
- casual → Emotional Explorer / Grand Conversations 우선
- analytical → Devil's Advocate / QtA 우선
- socratic → Socratic Seminar / Shared Inquiry 우선

### Step 3: 프로필 설정 (기존 간소화)
- 기존 아바타 + 닉네임 UI 유지
- CTA 버튼 문구 변경: "시작하기" → "첫 번째 책 추가하기 →"

### Step 4: 첫 책 추가 (기존 + 안내 배너 + 읽기 상태)
- 기존 /setup 페이지 재활용
- 상단에 안내 배너 추가: "지금 읽고 있는 책을 알려주세요 — 추가하면 바로 AI와 이야기할 수 있어요"
- 책 선택 후 읽기 상태 질문: "이 책, 어디까지 읽으셨어요?"
  - 아직 안 읽었어요 → `want_to_read` → AI 읽기 전 대화 (스포일러 완전 차단)
  - 읽고 있는 중 → `reading` → AI 읽는 중 대화 (현재 감상 중심)
  - 다 읽었어요 → `finished` → AI 완독 대화 (스포일러 자유, 전체 분석)
- 온보딩 플래그(query param `onboarding=true`) 시 책 추가 완료 후 `/discuss/[bookId]?welcome=true&readingStatus=...`로 리다이렉트

### Step 5: AI 첫 대화 (Aha Moment)
- 기존 /discuss/[bookId] 페이지 재활용
- `?welcome=true` 시 첫 방문 전용 요소 표시:
  - "첫 번째 대화" 뱃지 (accent 보더 pill)
  - 가이드 툴팁: "인상 깊었던 장면이나 느낌을 자유롭게 이야기해주세요. 정답은 없어요 — 솔직한 감상이 최고의 대화예요."
  - 아이콘: Lightbulb (Lucide), accent 색상
  - localStorage `onboarding-guide-shown` 플래그로 1회만 표시
- AI 인사에 성향 데이터 반영 (discussion_style에 따른 톤 조절)

---

## 3. 라우팅 변경

```
AS-IS:
/onboarding → 로그인/프로필 → / (빈 라이브러리)

TO-BE:
/onboarding → 로그인 → /onboarding?step=taste (성향 Q1~Q3)
→ /onboarding?step=profile (프로필)
→ /setup?onboarding=true (책 추가)
→ /discuss/[bookId]?welcome=true (AI 첫 대화)
```

---

## 4. 테마 색상 리디자인

Gail(기술 색상 품질) + Tasha(MZ 트렌드 감성) 공동 리뷰 기반.

### 밤숲 (dark) — TWEAK
| 토큰 | Before | After | 이유 |
|------|--------|-------|------|
| --sf | #131916 | #151d18 | bg와 레이어 간격 확대 |
| --sf2 | #1a1f1c | #1e2822 | sf와 간격 +4 |
| --sf3 | #242a26 | #28332c | 전체 레이어 간격 정규화 |
| --ac | #6B9E8A | #5FA88E | 채도 +8%, CTA 행동유도력 강화 |
| --ac2 | #8FB8A4 | #82BEA4 | ac에 맞춰 조정 |

### 크림 (cream) — TWEAK
| 토큰 | Before | After | 이유 |
|------|--------|-------|------|
| --bg | #F4EFE8 | #F7F3ED | 탁함 제거, 고급 양장본 내지 느낌 |
| --sf | #EAE4DC | #EDE7DF | bg와 간격 유지 + 따뜻한 톤 |
| --sf2 | #DDD6CC | #E0D9D0 | 톤 통일 |
| --acc | #f4eee8 | #f7f3ed | bg 변경에 맞춰 |

### 네이비 (navy) — RETHINK "심야 독서"
| 토큰 | Before | After | 이유 |
|------|--------|-------|------|
| --bd | rgba(80,130,200,0.12) | rgba(180,150,80,0.10) | 앰버 톤 보더 |
| --bd2 | rgba(80,130,200,0.26) | rgba(180,150,80,0.22) | 앰버 톤 보더 |
| --tp | #e4eaf8 | #e4e0d8 | 차가운 블루→따뜻한 아이보리 |
| --ts | #6080a8 | #7a8898 | 읽기 편한 보조 텍스트 |
| --tm | #2e4060 | #4a5878 | WCAG AA 충족 |
| --ac | #5b9bd5 | #c4a060 | 블루→앰버 골드 "독서등" |
| --ac2 | #7ab5e8 | #d4b478 | ac에 맞춰 |
| --ac3 | #a0ccf0 | #e8cc98 | ac에 맞춰 |
| --acc | #080c18 | #0a0806 | 골드 위 다크 텍스트 |

### 세피아 (sepia) — KEEP
| 토큰 | Before | After | 이유 |
|------|--------|-------|------|
| --acc | #1a1008 | #130c06 | CTA 텍스트 대비 강화 |

### 로제 (구 블러썸, blossom) — RETHINK "더스티 로즈"
| 토큰 | Before | After | 이유 |
|------|--------|-------|------|
| --bg | #fdf0f5 | #faf5f7 | 핑크 줄이고 뉴트럴 가까이 |
| --sf | #f5e3ee | #f5eff2 | 라일락 제거, 깨끗한 톤 |
| --sf2 | #ead1e6 | #ecdce5 | 탁함 제거 |
| --sf3 | #debfda | #e0cdd8 | 톤 통일 |
| --bd | rgba(180,80,130,0.1) | rgba(160,100,130,0.10) | 더스티 로즈 톤 |
| --bd2 | rgba(180,80,130,0.24) | rgba(160,100,130,0.22) | 더스티 로즈 톤 |
| --tp | #1a0f16 | #2a1820 | 약간 밝혀서 부드러움 |
| --ts | #7a3860 | #8a5070 | 무거움 완화 |
| --tm | #c090b0 | #a08898 | 가독성 확보 (WCAG AA) |
| --ac | #b84880 | #c27090 | 핫핑크→더스티 로즈 |
| --ac2 | #d068a0 | #d488a8 | ac에 맞춰 |
| --ac3 | #e090bc | #e8a8c0 | ac에 맞춰 |
| --acc | #fdf0f5 | #faf5f7 | bg에 맞춰 |

---

## 5. 디자인 원칙 (Gail Bichler)

1. **여백 40%** — 각 화면의 40% 이상은 비워둠. 독서앱답게 호흡.
2. **타이포 줄바꿈** — 질문은 22px/900 Pretendard, 줄바꿈으로 시적 호흡.
3. **톤 전환** — Step 1~4 현재 테마 → Step 5 다크 토론 UI. "이제 진짜 시작" 무대 전환 효과.
4. **페이드 전환** — 슬라이드가 아닌 페이드(0.3s ease-out). 책장을 넘기듯.
5. **이모지 프리** — 모든 아이콘은 Lucide SVG. AI 티 나는 이모지 사용 금지.
6. **5테마 호환** — 모든 새 UI는 CSS 변수만 사용. 하드코딩 색상 금지.

---

## 6. 구현 범위

### 신규 개발
- 성향 질문 UI (3문항 스텝 폼) — `/onboarding` 내 step=taste
- profiles 테이블 마이그레이션 (4개 컬럼 추가)
- AI 시스템 프롬프트에 성향 데이터 주입 로직

### 수정
- `/onboarding/page.tsx` — 로그인 → 성향 → 프로필 플로우 연결
- `/setup/page.tsx` — 온보딩 배너 + 리다이렉트 로직
- `/discuss/[bookId]/page.tsx` — welcome 뱃지 + 가이드 툴팁
- `/api/chat/route.ts` — 성향 데이터 읽기 + 프롬프트 주입
- `globals.css` — 5테마 색상 토큰 업데이트 (완료)
- `DESIGN.md` — 테마 테이블 업데이트 (완료)

### 미포함 (다음 PR)
- AI 토론 읽는 중/완독 모드 분리
- 스포일러 가드
- 시스템 프롬프트 "모른다 금지" 규칙 수정
- 메타인지 회고 기능
- 데일리 습관 루프
