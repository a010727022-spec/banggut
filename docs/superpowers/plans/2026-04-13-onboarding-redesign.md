# Onboarding Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the onboarding flow to achieve "90 seconds from signup to first AI conversation" with reading taste personalization.

**Architecture:** Add a 3-question taste survey (genre/frequency/style) to the existing onboarding page as a new step, store preferences in profiles table, pass reading status to the chat API so AI adapts its greeting based on whether user hasn't read, is reading, or has finished the book.

**Tech Stack:** Next.js 14 App Router, Supabase (PostgreSQL), TypeScript, Tailwind CSS, Lucide icons, CSS variables (5-theme system)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `lib/types.ts` | Add taste preference types + reading status to User interface |
| Create | `supabase/add-taste-preferences.sql` | DB migration for profiles columns |
| Modify | `app/(auth)/onboarding/page.tsx` | Add taste survey step (3 questions) between login and profile |
| Modify | `app/(main)/setup/page.tsx` | Add onboarding banner + reading status selector + redirect to discuss |
| Modify | `app/(main)/discuss/[bookId]/page.tsx` | Add welcome badge + guide tooltip for first-time visitors |
| Modify | `app/api/chat/route.ts` | Accept readingStatus param, inject taste data into system prompt |
| Modify | `lib/supabase/queries.ts` | Update upsertProfile to handle new fields |

---

### Task 1: Database Migration + Types

**Files:**
- Create: `supabase/add-taste-preferences.sql`
- Modify: `lib/types.ts`

- [ ] **Step 1: Create the SQL migration file**

```sql
-- supabase/add-taste-preferences.sql
-- Add reading taste preferences to profiles for onboarding personalization

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_genres TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reading_frequency TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discussion_style TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
```

- [ ] **Step 2: Run migration against Supabase**

Run in Supabase SQL Editor or via CLI:
```bash
# Copy-paste the SQL into Supabase Dashboard > SQL Editor > Run
```

- [ ] **Step 3: Update the User type in lib/types.ts**

Add the new fields after `created_at`:

```typescript
export interface User {
  id: string;
  nickname: string;
  emoji: string;
  created_at: string;
  preferred_genres?: string[];
  reading_frequency?: string;
  discussion_style?: string;
  onboarding_completed?: boolean;
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/add-taste-preferences.sql lib/types.ts
git commit -m "feat: add taste preference columns to profiles table"
```

---

### Task 2: Onboarding Taste Survey UI

**Files:**
- Modify: `app/(auth)/onboarding/page.tsx`

This is the largest task. The onboarding page gets a new `taste` step with 3 sub-questions shown one at a time. The flow becomes: login → taste (Q1→Q2→Q3) → profile → redirect to /setup.

- [ ] **Step 1: Add taste step type and state**

In `app/(auth)/onboarding/page.tsx`, update the Step type and add taste state:

```typescript
type Step = "login" | "taste" | "profile";
type TasteStep = 1 | 2 | 3;
```

Add state variables inside `OnboardingContent`:

```typescript
const [tasteStep, setTasteStep] = useState<TasteStep>(1);
const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
const [readingFrequency, setReadingFrequency] = useState<string>("");
const [discussionStyle, setDiscussionStyle] = useState<string>("");
```

Update the `initialStep` logic to also handle `taste`:

```typescript
const initialStep = searchParams.get("step") === "profile"
  ? "profile"
  : searchParams.get("step") === "taste"
  ? "taste"
  : "login";
```

Update the `useEffect` that checks if user is already logged in — if user exists and step is "login", go to "taste" instead of "profile":

```typescript
useEffect(() => {
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (user && step === "login") {
      setStep("taste");
    }
  });
}, [supabase, step]);
```

- [ ] **Step 2: Define genre, frequency, and style options as constants**

Add before the component:

```typescript
const GENRE_OPTIONS = [
  { id: "novel", label: "소설", desc: "이야기에 빠져들기", icon: "BookOpen" },
  { id: "essay", label: "에세이", desc: "누군가의 일상과 생각", icon: "PenLine" },
  { id: "humanities", label: "인문학", desc: "세상을 이해하는 렌즈", icon: "CircleCheck" },
  { id: "selfhelp", label: "자기계발", desc: "더 나은 내일을 위해", icon: "Sunrise" },
  { id: "poetry", label: "시 · 산문", desc: "한 줄의 여운", icon: "Feather" },
  { id: "sf", label: "SF · 판타지", desc: "상상의 세계로", icon: "Diamond" },
] as const;

const FREQUENCY_OPTIONS = [
  { id: "daily", label: "거의 매일", desc: "책 없이는 하루가 안 끝나요", icon: "BookOpen" },
  { id: "weekly", label: "주 2~3회", desc: "틈틈이 꾸준히 읽어요", icon: "Book" },
  { id: "monthly", label: "월 1~2권 정도", desc: "한 권을 천천히 음미해요", icon: "Moon" },
  { id: "beginner", label: "다시 시작하는 중", desc: "독서 습관을 만들고 싶어요", icon: "Sprout" },
] as const;

const STYLE_OPTIONS = [
  { id: "casual", label: "편하게 감상 나누기", sample: "이 장면에서 나도 모르게 눈물이 났어. 너는 어떤 느낌이었어?", icon: "MessageCircle" },
  { id: "analytical", label: "깊이 있는 분석과 토론", sample: "이 상징이 작가의 전작과 어떻게 연결되는지, 함께 분석해볼까요?", icon: "Search" },
  { id: "socratic", label: "생각을 자극하는 질문", sample: "만약 당신이 주인공이었다면, 그 순간 어떤 선택을 했을까요?", icon: "HelpCircle" },
] as const;
```

- [ ] **Step 3: Build the taste survey UI**

Add the taste step rendering. This replaces the section between login and profile. Each sub-question has a progress bar (3 segments), a question in 22px/900 with line break, and option cards. All using CSS variables (`var(--ac)`, `var(--sf)`, etc.) for theme compatibility.

Insert this before `if (step === "profile")`:

```typescript
if (step === "taste") {
  const handleTasteNext = () => {
    if (tasteStep === 1 && selectedGenres.length === 0) {
      toast.error("하나 이상 골라주세요");
      return;
    }
    if (tasteStep === 2 && !readingFrequency) {
      toast.error("하나를 골라주세요");
      return;
    }
    if (tasteStep < 3) {
      setTasteStep((s) => (s + 1) as TasteStep);
    } else {
      // Save taste and move to profile
      setStep("profile");
    }
  };

  const toggleGenre = (id: string) => {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", transition: "background 0.4s" }}>
      <div style={{ maxWidth: 400, margin: "0 auto", padding: "48px 24px 40px" }}>
        {/* Progress bar */}
        <div style={{ display: "flex", gap: 5, marginBottom: 28 }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{
              height: 3, flex: 1, borderRadius: 2,
              background: n <= tasteStep
                ? "linear-gradient(90deg, var(--ac), var(--ac2))"
                : "var(--sf3)",
              transition: "background 0.3s",
            }} />
          ))}
        </div>

        {/* Q1: Genre */}
        {tasteStep === 1 && (
          <div style={{ animation: "fadeIn 0.3s ease-out" }}>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: "var(--tp)", letterSpacing: "-0.5px", lineHeight: 1.35, marginBottom: 6 }}>
              어떤 책에<br />끌리세요?
            </h2>
            <p style={{ fontSize: 12, color: "var(--tm)", marginBottom: 24 }}>여러 개 골라도 좋아요</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {GENRE_OPTIONS.map((g) => {
                const on = selectedGenres.includes(g.id);
                return (
                  <button key={g.id} onClick={() => toggleGenre(g.id)} style={{
                    padding: "14px 12px", borderRadius: 14, textAlign: "center",
                    border: `1.5px solid ${on ? "var(--ac)" : "var(--bd2)"}`,
                    background: on ? "color-mix(in srgb, var(--ac) 10%, var(--sf))" : "var(--sf)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, margin: "0 auto 6px",
                      background: on ? "color-mix(in srgb, var(--ac) 18%, transparent)" : "var(--sf2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "background 0.3s",
                    }}>
                      <BookOpen size={16} style={{ color: on ? "var(--ac)" : "var(--ts)", transition: "color 0.3s" }} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tp)", marginBottom: 2 }}>{g.label}</div>
                    <div style={{ fontSize: 10, color: "var(--tm)" }}>{g.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Q2: Frequency */}
        {tasteStep === 2 && (
          <div style={{ animation: "fadeIn 0.3s ease-out" }}>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: "var(--tp)", letterSpacing: "-0.5px", lineHeight: 1.35, marginBottom: 6 }}>
              얼마나 자주<br />읽으세요?
            </h2>
            <p style={{ fontSize: 12, color: "var(--tm)", marginBottom: 24 }}>부담 없이 골라주세요</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {FREQUENCY_OPTIONS.map((f) => {
                const on = readingFrequency === f.id;
                return (
                  <button key={f.id} onClick={() => setReadingFrequency(f.id)} style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 16px", borderRadius: 14, textAlign: "left",
                    border: `1.5px solid ${on ? "var(--ac)" : "var(--bd2)"}`,
                    background: on ? "color-mix(in srgb, var(--ac) 10%, var(--sf))" : "var(--sf)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      background: on ? "color-mix(in srgb, var(--ac) 18%, transparent)" : "var(--sf2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <BookOpen size={18} style={{ color: on ? "var(--ac)" : "var(--ts)" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tp)" }}>{f.label}</div>
                      <div style={{ fontSize: 11, color: "var(--tm)", marginTop: 2 }}>{f.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Q3: Discussion Style */}
        {tasteStep === 3 && (
          <div style={{ animation: "fadeIn 0.3s ease-out" }}>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: "var(--tp)", letterSpacing: "-0.5px", lineHeight: 1.35, marginBottom: 6 }}>
              어떤 대화를<br />나누고 싶으세요?
            </h2>
            <p style={{ fontSize: 12, color: "var(--tm)", marginBottom: 24 }}>AI가 대화 스타일을 맞춰드려요</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {STYLE_OPTIONS.map((s) => {
                const on = discussionStyle === s.id;
                return (
                  <button key={s.id} onClick={() => setDiscussionStyle(s.id)} style={{
                    padding: 16, borderRadius: 14, textAlign: "left",
                    border: `1.5px solid ${on ? "var(--ac)" : "var(--bd2)"}`,
                    background: on ? "color-mix(in srgb, var(--ac) 10%, var(--sf))" : "var(--sf)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                    <div style={{
                      fontSize: 13, color: on ? "var(--tp)" : "var(--ts)",
                      fontStyle: "italic", lineHeight: 1.7, marginBottom: 10,
                      paddingLeft: 12, borderLeft: `2px solid ${on ? "var(--ac)" : "var(--bd2)"}`,
                      transition: "all 0.3s",
                    }}>
                      &ldquo;{s.sample}&rdquo;
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--tp)" }}>
                      <Search size={14} style={{ color: "var(--ac)" }} />
                      {s.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Next button */}
        <button onClick={handleTasteNext} disabled={
          (tasteStep === 1 && selectedGenres.length === 0) ||
          (tasteStep === 2 && !readingFrequency) ||
          (tasteStep === 3 && !discussionStyle)
        } style={{
          width: "100%", padding: 14, borderRadius: 12, marginTop: 24,
          background: "var(--ac)", color: "var(--acc)",
          fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer",
          opacity: (tasteStep === 1 && selectedGenres.length === 0) ||
            (tasteStep === 2 && !readingFrequency) ||
            (tasteStep === 3 && !discussionStyle) ? 0.4 : 1,
          transition: "all 0.15s",
        }}>
          {tasteStep === 3 ? "완료" : "다음"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update profile setup to save taste data and redirect to /setup**

Modify `handleProfileSetup` to also save taste preferences and redirect to `/setup?onboarding=true` instead of `/`:

```typescript
const handleProfileSetup = async () => {
  if (!nickname.trim()) {
    toast.error("닉네임을 입력해주세요");
    return;
  }
  setLoading(true);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인 필요");
    await upsertProfile(supabase, {
      id: user.id,
      nickname: nickname.trim(),
      emoji,
      preferred_genres: selectedGenres,
      reading_frequency: readingFrequency || null,
      discussion_style: discussionStyle || null,
      onboarding_completed: true,
    });
    router.push("/setup?onboarding=true");
    router.refresh();
  } catch {
    toast.error("프로필 저장에 실패했어요");
  }
  setLoading(false);
};
```

Also update the profile step CTA text from "시작하기" to "첫 번째 책 추가하기 →".

- [ ] **Step 5: Add necessary Lucide icon imports**

At the top of the file, add the icons used in the taste survey:

```typescript
import { BookOpen, Search, PenLine, Moon, Sprout, Feather, Diamond, MessageCircle, HelpCircle, CircleCheck, Sunrise } from "lucide-react";
```

Note: Not all icons need to be unique per option — use `BookOpen` as a shared icon for the genre grid, and specific icons for frequency/style options where differentiation matters.

- [ ] **Step 6: Build and verify no errors**

```bash
npx next build
```

Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add app/(auth)/onboarding/page.tsx
git commit -m "feat: add 3-question taste survey to onboarding flow"
```

---

### Task 3: Setup Page — Onboarding Banner + Reading Status

**Files:**
- Modify: `app/(main)/setup/page.tsx`

- [ ] **Step 1: Add reading status selector after book selection**

When `searchParams.get("onboarding") === "true"` and a book is selected, show a reading status question before the "서재에 추가" button.

Add state:

```typescript
const isOnboarding = searchParams.get("onboarding") === "true";
const [readingStatus, setReadingStatus] = useState<string>("reading");
```

- [ ] **Step 2: Add onboarding banner at the top**

After the Header div, add:

```typescript
{isOnboarding && (
  <div style={{
    background: "color-mix(in srgb, var(--ac) 8%, transparent)",
    borderRadius: 12, padding: "12px 14px", marginBottom: 16,
    borderLeft: "3px solid var(--ac)", transition: "all 0.4s",
  }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tp)", marginBottom: 4 }}>
      지금 읽고 있는 책을 알려주세요
    </div>
    <div style={{ fontSize: 11, color: "var(--ts)" }}>
      추가하면 바로 AI와 이 책에 대해 이야기할 수 있어요
    </div>
  </div>
)}
```

- [ ] **Step 3: Add reading status chips after book selection**

Inside the selected book card section (after the book info display, before the add button), add:

```typescript
{isOnboarding && selected && (
  <div style={{ marginTop: 12 }}>
    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--tp)", marginBottom: 8 }}>
      이 책, 어디까지 읽으셨어요?
    </p>
    <div style={{ display: "flex", gap: 8 }}>
      {[
        { id: "want_to_read", label: "아직 안 읽었어요" },
        { id: "reading", label: "읽고 있는 중" },
        { id: "finished", label: "다 읽었어요" },
      ].map((opt) => (
        <button key={opt.id} onClick={() => setReadingStatus(opt.id)} style={{
          flex: 1, padding: "8px 4px", borderRadius: 10, fontSize: 11, fontWeight: 700,
          border: `1.5px solid ${readingStatus === opt.id ? "var(--ac)" : "var(--bd2)"}`,
          background: readingStatus === opt.id ? "color-mix(in srgb, var(--ac) 10%, var(--sf))" : "var(--sf)",
          color: readingStatus === opt.id ? "var(--ac)" : "var(--tm)",
          cursor: "pointer", transition: "all 0.15s",
        }}>
          {opt.label}
        </button>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 4: Update handleAddToLibrary for onboarding redirect + reading status**

Change the book creation to use the selected readingStatus, and redirect to discuss page when onboarding:

```typescript
const book = await createBook(supabase, {
  user_id: user.id,
  title: selected.title,
  author: selected.author || null,
  genre: selected.category || null,
  reading_status: isOnboarding ? readingStatus as any : "reading",
  ...(selected.cover ? { cover_url: selected.cover } : {}),
  ...(selected.pageCount ? { total_pages: selected.pageCount } : {}),
});
```

Change the redirect at the end:

```typescript
toast.success("서재에 추가했어요!");
if (isOnboarding) {
  router.push(`/discuss/${book.id}?welcome=true&readingStatus=${readingStatus}`);
} else {
  router.push(`/book/${book.id}`);
}
```

- [ ] **Step 5: Build and verify**

```bash
npx next build
```

- [ ] **Step 6: Commit**

```bash
git add app/(main)/setup/page.tsx
git commit -m "feat: add onboarding banner and reading status to setup page"
```

---

### Task 4: Discuss Page — Welcome Badge + Guide Tooltip

**Files:**
- Modify: `app/(main)/discuss/[bookId]/page.tsx`

- [ ] **Step 1: Detect welcome mode from URL params**

Add near the top of the component where searchParams is used:

```typescript
const isWelcome = searchParams.get("welcome") === "true";
const welcomeReadingStatus = searchParams.get("readingStatus") || "reading";
const [showGuide, setShowGuide] = useState(false);
```

In the useEffect that loads the book, add guide tooltip logic:

```typescript
useEffect(() => {
  if (isWelcome && !localStorage.getItem("onboarding-guide-shown")) {
    setShowGuide(true);
  }
}, [isWelcome]);
```

- [ ] **Step 2: Add welcome badge above messages**

After the branch tracker section and before the messages list, add:

```typescript
{isWelcome && messages.length <= 1 && (
  <div style={{ textAlign: "center", marginBottom: 16, animation: "fadeIn 0.3s ease-out" }}>
    <span style={{
      display: "inline-block", fontSize: 9, fontWeight: 800,
      color: "var(--ac)", letterSpacing: 2, textTransform: "uppercase",
      padding: "4px 12px", border: "1px solid var(--bd2)",
      borderRadius: 100, transition: "all 0.4s",
    }}>
      첫 번째 대화
    </span>
  </div>
)}
```

- [ ] **Step 3: Add guide tooltip above input area**

Before the textarea input section, add:

```typescript
{showGuide && (
  <div style={{
    background: "color-mix(in srgb, var(--ac) 6%, transparent)",
    border: "1px solid color-mix(in srgb, var(--ac) 15%, transparent)",
    borderRadius: 12, padding: "12px 14px", margin: "0 16px 12px",
    animation: "fadeIn 0.3s ease-out", transition: "all 0.4s",
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--ac)" }}>
        <Lightbulb size={12} />
        이렇게 대화해보세요
      </div>
      <button onClick={() => {
        setShowGuide(false);
        localStorage.setItem("onboarding-guide-shown", "1");
      }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
        <X size={12} style={{ color: "var(--tm)" }} />
      </button>
    </div>
    <div style={{ fontSize: 11, color: "var(--ts)", lineHeight: 1.7 }}>
      인상 깊었던 장면이나 느낌을 자유롭게 이야기해주세요.
      정답은 없어요 — 솔직한 감상이 최고의 대화예요.
    </div>
  </div>
)}
```

Add `Lightbulb` to the Lucide imports at the top of the file.

- [ ] **Step 4: Pass readingStatus to the AI greeting**

In the `sendAIGreeting` call and the `handleSend` function, pass readingStatus to the chat API. Find the `fetchWithAuth("/api/chat", ...)` calls and add `readingStatus: welcomeReadingStatus` to the body:

```typescript
body: JSON.stringify({
  bookInfo: `제목: ${bookData.title}, 저자: ${bookData.author || "미상"}`,
  messages: ...,
  underlines: ulTexts,
  scraps: scrapData || [],
  topicMap: bookData.topic_map,
  greeting: mode,
  bookContextData: ctxData || null,
  readingStatus: welcomeReadingStatus,  // NEW
}),
```

- [ ] **Step 5: Build and verify**

```bash
npx next build
```

- [ ] **Step 6: Commit**

```bash
git add app/(main)/discuss/[bookId]/page.tsx
git commit -m "feat: add welcome badge and guide tooltip for onboarding visitors"
```

---

### Task 5: Chat API — Reading Status Aware Greeting

**Files:**
- Modify: `app/api/chat/route.ts`

- [ ] **Step 1: Extract readingStatus from request body**

In the POST handler, add `readingStatus` to the destructured body:

```typescript
const { bookInfo, messages, underlines, scraps, bookContext, topicMap, greeting, bookContextData, branchHint, otherReadingBooks, readingStatus } = body;
```

- [ ] **Step 2: Add reading-status-aware greeting instructions**

In the greeting mode section (around line 641), replace the greeting instruction logic to account for `readingStatus`. After the existing `if (greeting === "start") {` block, modify the greeting instruction selection:

```typescript
if (greeting === "start") {
  const hasQuotes = underlines?.length > 0;
  const hasContext = bookKnown && bookContextData?.medium?.characters?.length > 0;
  let greetingInstruction: string;

  // Reading status determines greeting mode
  if (readingStatus === "want_to_read") {
    // Pre-reading mode: haven't started the book yet
    greetingInstruction = `\n\n[첫 인사 — 읽기 전 모드]
유저는 이 책을 아직 읽지 않았습니다. 읽기 전 대화를 진행하세요.
구조: 1줄 책이름+환영, 2줄 선택한 이유 질문, 3줄 기대감 열린 질문

예시 톤:
"『[책제목]』을 고르셨군요! 📖
이 책을 왜 골랐는지 궁금해요.
제목에서 어떤 이야기를 기대하세요?"

핵심 규칙:
- 줄거리, 인물, 결말 등 어떤 내용도 절대 언급하지 마세요
- 선택 이유, 기대감, 제목/표지 인상 중심으로 대화하세요
- "읽기 시작하면 다시 이야기 나눠요!"로 리텐션 유도 가능
금지: 스포일러, 내용 언급, 줄거리 요약, 인물 이름`;
  } else if (readingStatus === "finished") {
    // Post-reading mode: finished the book
    greetingInstruction = `\n\n[첫 인사 — 완독 모드]
유저는 이 책을 다 읽었습니다. 전체 내용에 대해 자유롭게 토론할 수 있습니다.
구조: 1줄 책이름+환영, 2줄 완독 축하+감정 질문, 3줄 열린 질문

예시 톤:
"『[책제목]』을 다 읽으셨군요! 📖
책을 덮은 순간, 가장 먼저 떠오른 생각이나 감정이 있었어요?"

핵심 규칙:
- 결말, 반전 등 자유롭게 이야기할 수 있습니다
- 전체 구조 분석, 작가 의도, 다른 작품과 비교 가능
- 깊이 있는 토론으로 바로 들어가도 됩니다
금지: "안녕하세요! 반갑습니다!" (로봇)`;
  } else if (hasQuotes) {
    // Existing: has underlines
    greetingInstruction = `\n\n[첫 인사 — 지금 바로 실행]
구조: 1줄 책이름+환영, 2줄 글귀 연결, 3줄 열린 질문
독자가 밑줄 친 첫 번째 글귀: "${underlines[0].text}"

예시 톤:
"『[책제목]』 함께 이야기할 수 있어서 좋아요. 📖
밑줄 치신 문장 중에 '[글귀]'가 눈에 띄네요.
이 문장에 밑줄 친 순간, 어떤 마음이었어요?"

금지: "안녕하세요! 반갑습니다!" (로봇), 줄거리 요약, "이 책의 주제가 뭐라고 생각하세요?" (시험)`;
  } else if (hasContext) {
    // Existing: has book context
    greetingInstruction = `\n\n[첫 인사 — 지금 바로 실행]
[책 정보]에 있는 구체적 인물이나 장면을 언급하며 시작하세요. 뻔한 질문 금지.
구조: 1줄 책이름+환영, 2줄 [책 정보]에서 가져온 구체적 인물/장면 언급, 3줄 열린 질문

⚠️ 반드시 [책 정보]에 있는 실제 인물명/장소명을 사용하세요. 없는 정보를 지어내지 마세요.
금지: "안녕하세요! 반갑습니다!" (로봇), 줄거리 요약, "이 책의 주제가 뭐라고 생각하세요?" (시험)`;
  } else {
    // Existing: no context
    greetingInstruction = `\n\n[첫 인사 — 지금 바로 실행]
이 책에 대한 정보가 부족합니다. 솔직히 많이 파악하지 못했다고 밝히고, 유저의 이야기를 중심으로 진행하겠다고 하세요.

예시 톤:
"『[책제목]』 함께 이야기해봐요. 📖
솔직히 이 책에 대해 아직 많이 파악하지 못했어요.
대신 당신이 직접 읽은 사람이니까, 당신의 이야기를 중심으로 깊이 파고들어볼게요.
이 책을 한마디로 표현하면 어떤 책이에요?"

금지: "안녕하세요! 반갑습니다!" (로봇), 줄거리 요약, 아는 척하기, 정보 지어내기`;
  }

  systemPrompt += greetingInstruction;
  chatMessages = [{ role: "user", content: "토론을 시작합니다." }];
}
```

- [ ] **Step 3: Build and verify**

```bash
npx next build
```

- [ ] **Step 4: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: add reading-status-aware AI greeting for onboarding"
```

---

### Task 6: Update Spec + Final Verification

**Files:**
- Modify: `docs/superpowers/specs/2026-04-13-onboarding-and-theme-redesign.md`

- [ ] **Step 1: Update spec with reading status feature**

Add to section 2, Step 4:

```markdown
### Reading Status Question (Step 4 추가)
책 선택 후 "이 책, 어디까지 읽으셨어요?" 질문:
- 아직 안 읽었어요 → want_to_read → AI 읽기 전 대화 모드
- 읽고 있는 중 → reading → AI 읽는 중 대화 모드 (기존)
- 다 읽었어요 → finished → AI 완독 대화 모드 (스포일러 자유)
```

- [ ] **Step 2: Full build verification**

```bash
npx next build
```

Expected: Clean build, no errors.

- [ ] **Step 3: Manual test flow**

1. Open app → should redirect to /onboarding
2. Login → taste survey appears (3 questions with progress bar)
3. Select genres → next → select frequency → next → select style → complete
4. Profile page with "첫 번째 책 추가하기 →" button
5. Setup page with onboarding banner
6. Search and add a book → reading status chips appear
7. Select reading status → add book → redirect to /discuss/[bookId]?welcome=true
8. Discuss page shows "첫 번째 대화" badge + guide tooltip
9. AI greeting matches reading status (pre-read/reading/finished)
10. Guide tooltip dismisses on X click and doesn't reappear

- [ ] **Step 4: Commit spec update**

```bash
git add docs/superpowers/specs/2026-04-13-onboarding-and-theme-redesign.md
git commit -m "docs: update spec with reading status feature"
```
