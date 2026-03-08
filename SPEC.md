# 방긋 — 방금 그은 문장

> "읽고, 긋고, 방긋."

AI와 1:1 독서토론을 하고, 나만의 서평을 완성하는 앱.

---

## 1. 브랜드

| 항목 | 값 |
|---|---|
| 이름 | 방긋 (banggut) |
| 뜻 | "방금 그은 문장" + 방긋(미소) |
| 로고 | ‿ (잉크그린 곡선 = 펼친 책 + 미소 + 밑줄) |
| 태그라인 | "읽고, 긋고, 방긋." |
| 서브카피 | "방금 그은 문장에서 대화가 시작돼요" |
| 타겟 | 한국 20-40대 직장인 독서가 |
| 톤 | 텍스트힙 — 종이 질감, 잉크 느낌, 독립서점 감성 |

---

## 2. 디자인 시스템

### 컬러 팔레트 (텍스트힙)

```
배경(Paper):     #F7F3ED  — 크림/한지색
카드(Warm White): #FFFDF8  — 따뜻한 흰색
메인(Ink Green):  #2B4C3F  — 잉크 그린 (버튼, 강조, 로고)
서브(Medium):     #3D6B5A  — 중간 그린
악센트(Old Gold): #C4A35A  — 올드 골드 (포인트, 뱃지)
워밍(Terracotta): #B86B4A  — 테라코타 (알림, 경고)
본문(Ink):        #2C2C2C  — 먹색
보조텍스트:       #8B7E74  — 웜 그레이
비활성:           #B5A99A  — 라이트 웜 그레이
희미한:           #C5B9AB  — 페이드 웜
```

### 타이포그래피
- 헤드라인: 'Noto Serif KR' (세리프, 무게감)
- 본문: 'Noto Serif KR' (가독성)
- 영문 폴백: Georgia, serif
- 채팅 본문 lineHeight: 1.8

### UI 스타일
- 카드 borderRadius: 12px (16px 아님 — 덜 앱스럽게)
- 버튼 borderRadius: 8px
- 그림자: 최소한 (0 1px 4px rgba(43,76,63,.04))
- 테두리: rgba(43,76,63, .06~.15) 범위
- 선택 하이라이트: rgba(196,163,90,.2) — 골드
- 그라데이션 사용 금지 — 단색 플랫

---

## 3. 기술 스택

```
프론트엔드:   Next.js 14 (App Router)
UI 라이브러리: shadcn/ui + Tailwind CSS (텍스트힙 테마 커스텀)
백엔드/DB:    Supabase (Auth + PostgreSQL + Realtime + Storage)
인증:         카카오 로그인 (Supabase OAuth) + 이메일
AI:           Anthropic Claude API (서버사이드 /api/chat)
              - 토론: claude-sonnet-4-20250514
              - 검색/OCR: claude-haiku-4-5-20251001
모바일:       Capacitor (iOS + Android 빌드)
배포:         Vercel (웹) + TestFlight/Play 내부테스트
도메인:       banggut.kr
```

---

## 4. 프로토타입 참조

`prototype/banggut-v3.jsx` — 1821줄 단일 React 파일.
모든 화면, 플로우, AI 프롬프트, 상태 관리가 포함되어 있음.
이 파일을 기능 명세서로 참고할 것.

---

## 5. 핵심 플로우

### 5-1. 온보딩
```
앱 진입 → 카카오/이메일 로그인 → 닉네임 + 아바타 선택 → 서재(홈)
```

### 5-2. 글귀 스크랩 (하단 탭 2번째 "✏️ 스크랩")
```
글귀 입력 (타이핑)
  또는
📸 사진 촬영 → Claude Vision OCR → 텍스트 추출 → 편집
  ↓
선택: 한마디 메모 + 책 제목 태깅
  ↓
저장 → 글귀 카드로 축적
```
- 책과 무관하게 언제든 수집 가능
- 밀리의서재 "하이라이트 → 독서노트" 패턴 참고

### 5-3. 새 책 등록 (Setup)
```
제목 + 저자 동시 입력 → "🔍 책 검색" 버튼 클릭
  ↓
Claude Haiku가 도서 정보 반환 → 드롭다운 표시
  ↓
선택 (또는 "직접 등록")
  ↓
[선택사항] "📥 스크랩에서 불러오기" → 바텀시트 모달
  → 기존 스크랩 중 최대 3개 선택
  ↓
"🎯 토론 시작하기" (글귀 있을 때)
"💬 바로 토론 시작" (글귀 없을 때)
```
- 글귀 0개도 OK. 강제 아님
- 선택된 글귀 = 토론의 줄기

### 5-4. AI 토론 (핵심 기능)
```
4단계 자동 진행 (메시지 수 기반):

🌱 탐색 (0-7턴): 첫인상, 감정, 기억에 남는 장면
🔍 심화 (8-15턴): 주제, 상징, 작가 의도, 구조
🔗 연결 (16-23턴): 내 삶, 사회, 다른 작품과의 연결
✍️ 서평 (24턴+): 총정리, 추천 여부, 핵심 메시지
```

AI 성격:
- 이름: "방긋"
- 2-4문장 짧게, 한국어 존댓말, 이모지 가끔
- 글귀가 있으면 자연스럽게 "이 문장에 왜 밑줄 치셨어요?" 식으로 연결
- 웹 검색으로 가져온 책 컨텍스트를 배경지식으로 활용

토론 방식 — AI 자동 전환 (유저 선택 없음):
AI가 대화 맥락을 분석해서 아래 6가지 방식을 자연스럽게 섞어 사용.
유저는 모드 존재를 모름. 그냥 똑똑한 토론 상대와 대화하는 느낌.

| 내부 모드 | 트리거 | AI 행동 |
|---|---|---|
| 소크라테스 | 유저가 의견을 말할 때 | "왜 그렇게 생각하세요?" 꼬리 질문 |
| 악마의 변호인 | 유저가 확신에 찬 해석을 할 때 | 반론 제기, 다른 가능성 제시 |
| 관점 역할극 | 인물/저자 언급 시 | "주인공이라면..." 캐릭터 시점 |
| 정리자 | 유저가 "정리가 안 돼" 혼란 시 | 논점 구조화, 지금까지 요약 |
| 하브루타 | 토론이 깊어질 때 | 질문→반박 교대로 논리 검증 |
| 감정 탐색 | 감정 표현 감지 시 | "어떤 감정이 올라왔나요?" |

시스템 프롬프트 핵심:
"대화 맥락에 따라 소크라테스/악마의변호인/역할극/정리자/하브루타/감정탐색 방식을 자연스럽게 섞어 사용하세요. 유저에게 모드를 알리지 마세요. 자연스러운 대화 흐름을 유지하세요."

토론 중 부가 기능:
- ✏️ 밑줄 추가 (토론 중에도 글귀 추가 가능)
- 🕸️ 온톨로지 그래프 (개념 관계도 — d3.js)
- 📋 여정 요약 (토론 흐름 정리)
- ✍️ 서평 쓰기 (AI 진단 → 듀얼 모드 서평)
- 🔍 AI 독서 진단 (5개 영역 레이더 차트)

토론 스마트 기능 (AI 내부 로직):
- **글귀 자동 소환**: 토론 중 유저 발언과 관련된 스크랩 글귀를 AI가 자동으로 연결. "아까 밑줄 치신 이 문장이 지금 이야기랑 연결되는 것 같아요"
- **토론 온도계**: AI가 대화 깊이를 실시간 판단. 얕으면 더 깊은 질문으로 밀고, 이미 깊으면 단계를 강제하지 않음. 턴 수가 아닌 실제 대화 품질 기반 단계 전환
- **하이라이트 리플레이**: 토론 종료 시 "오늘 토론 하이라이트" 3개 자동 추출 — 유저의 인상적 발언, 관점 전환 순간, 가장 깊은 대화. 공유 카드 이미지로 생성 가능

### 5-5. 서평 작성
```
토론 완료 → "서평 쓰기" 버튼
  ↓
AI가 토론 기반으로 독서 진단 (5개 영역 점수):
  - 감정적 몰입, 분석적 사고, 개인적 연결, 비판적 시각, 창의적 해석
  ↓
듀얼 모드 서평:
  📝 에세이형: 자유 형식 서평
  📋 구조형: 한줄평 + 키워드 + 추천대상 + 본문
  ↓
공개/비공개 선택 → 저장
```

### 5-6. 소셜
- 공개 서평 피드 (프로필에서 노출)
- 친구 요청/수락
- 다른 유저 프로필 → 서평 목록 열람

### 5-7. 모임 (그룹 토론)
```
모임 생성 (이름 + 책) → 코드 공유 → 참여
  ↓
그룹 채팅 + AI 모더레이터
AI가 토론 촉진: "다른 분은 어떻게 생각하세요?" 등
```

---

## 6. 하단 네비게이션

| 순서 | 아이콘 | 라벨 | 화면 |
|---|---|---|---|
| 1 | 📚 | 서재 | 내 책 목록 + 독서 캘린더 |
| 2 | ✏️ | 스크랩 | 글귀 수집 (타이핑/카메라) |
| 3 | 💬 | 모임 | 그룹 토론 목록 |
| 4 | 👤 | MY | 프로필 + 서평 + 친구 |

---

## 7. 데이터 모델

### users
```sql
id          UUID PRIMARY KEY
nickname    TEXT NOT NULL
emoji       TEXT DEFAULT '🦊'
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### books
```sql
id               UUID PRIMARY KEY
user_id          UUID REFERENCES users(id)
title       TEXT NOT NULL
author      TEXT
phase       INT DEFAULT 0  -- 0:탐색 1:심화 2:연결 3:서평
has_review  BOOLEAN DEFAULT FALSE
created_at       TIMESTAMPTZ DEFAULT NOW()
updated_at       TIMESTAMPTZ DEFAULT NOW()
```

### messages (토론 내역)
```sql
id          UUID PRIMARY KEY
book_id     UUID REFERENCES books(id)
role        TEXT CHECK (role IN ('user','assistant'))
content     TEXT NOT NULL
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### scraps (글귀 스크랩 — 전역)
```sql
id          UUID PRIMARY KEY
user_id     UUID REFERENCES users(id)
text        TEXT NOT NULL
memo        TEXT
book_title  TEXT
book_author TEXT
source      TEXT DEFAULT 'manual' -- manual | camera
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### underlines (책별 밑줄 — 토론용)
```sql
id          UUID PRIMARY KEY
book_id     UUID REFERENCES books(id)
scrap_id    UUID REFERENCES scraps(id) -- 스크랩에서 불러온 경우
text        TEXT NOT NULL
memo        TEXT
chapter     TEXT
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### reviews (서평)
```sql
id          UUID PRIMARY KEY
book_id     UUID REFERENCES books(id)
user_id     UUID REFERENCES users(id)
mode        TEXT CHECK (mode IN ('essay','structured'))
content     JSONB NOT NULL
diagnosis   JSONB  -- AI 진단 점수
is_public   BOOLEAN DEFAULT FALSE
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### friends
```sql
id          UUID PRIMARY KEY
from_id     UUID REFERENCES users(id)
to_id       UUID REFERENCES users(id)
status      TEXT CHECK (status IN ('pending','accepted'))
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### groups (모임)
```sql
id          UUID PRIMARY KEY
name        TEXT NOT NULL
book_title  TEXT NOT NULL
created_by  UUID REFERENCES users(id)
code        TEXT UNIQUE  -- 참여 코드
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### group_members
```sql
group_id    UUID REFERENCES groups(id)
user_id     UUID REFERENCES users(id)
joined_at   TIMESTAMPTZ DEFAULT NOW()
PRIMARY KEY (group_id, user_id)
```

### group_messages
```sql
id          UUID PRIMARY KEY
group_id    UUID REFERENCES groups(id)
user_id     UUID  -- NULL이면 AI 메시지
content     TEXT NOT NULL
created_at  TIMESTAMPTZ DEFAULT NOW()
```

---

## 8. API 라우트

### /api/chat (POST) — AI 토론
```json
{
  "bookInfo": "제목: 데미안, 저자: 헤르만 헤세",
  "messages": [...],
  "phase": 0,
  "underlines": [...],
  "bookContext": "..."
}
```
→ Claude Sonnet 스트리밍 응답
→ AI가 대화 맥락에 따라 토론 방식 자동 전환

### /api/search-book (POST) — 책 검색
```json
{ "query": "데미안 헤르만 헤세" }
```
→ Claude Haiku로 도서 정보 반환

### /api/search-context (POST) — 책 배경 정보 웹 검색
```json
{ "title": "데미안", "author": "헤르만 헤세" }
```
→ Claude Sonnet + 웹 검색으로 책 맥락 수집

### /api/ocr (POST) — 카메라 OCR
```json
{ "image": "base64..." }
```
→ Claude Haiku Vision으로 텍스트 추출

### /api/ontology (POST) — 온톨로지 생성
```json
{ "messages": [...], "bookInfo": "..." }
```
→ 개념 관계 그래프 JSON

### /api/summary (POST) — 여정 요약
```json
{ "messages": [...] }
```
→ 토론 흐름 마크다운

### /api/review (POST) — AI 서평 도우미
```json
{ "messages": [...], "style": "essay|structured" }
```
→ 서평 초안

### /api/diagnosis (POST) — AI 독서 진단
```json
{ "messages": [...] }
```
→ 5개 영역 점수 + 코멘트

---

## 9. 화면 목록

| 화면 | 경로 | 설명 |
|---|---|---|
| 온보딩 | /onboarding | 로그인 + 프로필 설정 |
| 서재 | / | 책 목록 + 독서 캘린더 히트맵 |
| 스크랩 | /scrap | 글귀 수집 (타이핑/카메라) |
| 새 책 등록 | /setup | 책 검색 + 스크랩 불러오기 |
| 토론 | /discuss/[bookId] | AI 채팅 + 단계 표시 + AI 자동 모드 전환 |
| 온톨로지 | /ontology/[bookId] | d3.js 개념 그래프 |
| 여정 요약 | /summary/[bookId] | 토론 흐름 정리 |
| 서평 작성 | /review/[bookId] | 에세이/구조 모드 |
| 밑줄 목록 | /underlines/[bookId] | 책별 밑줄+메모 |
| 모임 목록 | /groups | 그룹 리스트 |
| 모임 채팅 | /groups/[groupId] | 그룹 토론 |
| 프로필 | /profile | 내 정보 + 서평 + 친구 |
| 유저 프로필 | /user/[userId] | 타인 프로필 |
| 친구 요청 | /friends | 받은 요청 관리 |

---

## 10. 서재(홈) 상세

### 독서 캘린더 히트맵
- 월간 달력 그리드 (ref-emotion-calendar.png 참고)
- 활동일에 감정 이모지 표시 (토론 종료 시 선택)
- 이모지 없는 날은 색상 농도로 활동량 표시
- 좌우 월 이동
- 날짜 탭 → 그날 활동한 책 목록

### 책 카드 레이아웃 (ref-book-grid.png, ref-repov-card.png 참고)
- 쌓아보기 (그리드) / 리스트형 뷰 전환 토글
- 수집중 (토론 전): 아이콘 + 초록 그라데이션 뱃지 + "수집중"
- 토론중/완료: 단계 아이콘 + 단계 컬러 뱃지
- 정보: 저자명, 글귀 수, 메시지 수
- 클릭: 수집중 → Setup 화면, 토론중 → Discuss 화면
- 서평 카드: Repov 스타일 — 넉넉한 여백, 크림 배경, 별점 or 한줄평

### + 새 책 버튼
- 우하단 FAB 또는 목록 상단

---

## 11. MVP 범위

### 필수 (v1.0)
- 카카오 로그인
- 책 등록 (검색)
- 글귀 스크랩 (타이핑 + 카메라 OCR)
- 스크랩에서 불러와서 토론 줄기 잡기
- AI 1:1 토론 (4단계)
- 토론 방식 AI 자동 전환
- 서평 작성 (듀얼 모드)
- 서재 + 독서 캘린더
- PWA + Capacitor (iOS/Android)

### 후순위 (v1.1)
- 온톨로지 그래프
- AI 독서 진단
- 소셜 (친구, 공개 서평)
- 모임 (그룹 토론)
- 글귀 공유 카드
- 푸시 알림

---

## 12. 디자인 레퍼런스

스크린샷 파일: `references/` 폴더 참고

### ref-calendar-life-log.png — 캘린더 뷰
- 월간 그리드에 날짜별 썸네일 이미지 표시
- 상단 카테고리 필터 칩
- 각 날짜 셀에 콘텐츠 개수 뱃지
- **방긋 적용**: 독서 캘린더에 책 표지 썸네일 or 이모지 표시

### ref-repov-card.png — Repov 리뷰 카드
- 크림/밝은 배경 위 둥근 카드
- 사진 + 제목 + 별점 + 짧은 리뷰 텍스트
- 매우 깔끔하고 여백 넉넉한 타이포그래피
- **방긋 적용**: 서평 카드, 글귀 스크랩 카드 스타일

### ref-book-grid.png — 독서 기록 앱 서재
- 책 표지 3열 그리드 + 별점
- 쌓아보기 / 리스트형 보기 뷰 전환 토글
- **방긋 적용**: 서재 화면 레이아웃

### ref-emotion-calendar.png — 감정 캘린더 앱
- 월간 캘린더에 이모지로 감정 표시 (녹색 톤)
- **방긋 적용**: 독서 캘린더에 감정 이모지 연동

---

## 13. 프로젝트 구조 (권장)

```
banggut/
├── references/
├── prototype/
│   └── banggut-v3.jsx
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── onboarding/page.tsx
│   ├── setup/page.tsx
│   ├── scrap/page.tsx
│   ├── discuss/[bookId]/page.tsx
│   ├── review/[bookId]/page.tsx
│   ├── groups/page.tsx
│   ├── groups/[groupId]/page.tsx
│   ├── profile/page.tsx
│   └── api/
│       ├── chat/route.ts
│       ├── search-book/route.ts
│       ├── search-context/route.ts
│       ├── ocr/route.ts
│       ├── ontology/route.ts
│       ├── summary/route.ts
│       ├── review/route.ts
│       └── diagnosis/route.ts
├── components/
├── lib/
├── public/
│   └── manifest.json
├── capacitor.config.ts
└── package.json
```
