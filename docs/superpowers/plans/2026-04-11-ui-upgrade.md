# UI Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade banggut app's component patterns, empty states, and styling consistency while preserving existing 5-theme system and deployed layout.

**Architecture:** Layer-by-layer approach — infrastructure tokens first, then shared EmptyState component, then apply across all pages replacing emojis and inline empty states. Tailwind arbitrary values with CSS variable tokens for theme compatibility.

**Tech Stack:** Next.js 14, Tailwind CSS, lucide-react, CSS custom properties

---

## File Structure

### New Files
- `components/shared/EmptyState.tsx` — Reusable empty state with circle + icon + text + CTA
- `components/shared/SectionHeader.tsx` — Section label + title + action link

### Modified Files
- `tailwind.config.ts` — Add CSS variable color tokens, z-index scale
- `app/globals.css` — Add `.glass` utility, clean up duplicates
- `app/(main)/page.tsx` — Replace 4 inline empty states with EmptyState component
- `app/(main)/scrap/page.tsx` — Replace 1 empty state
- `app/(main)/book/[bookId]/page.tsx` — Replace 2 emojis + 1 empty state
- `app/(main)/groups/[groupId]/page.tsx` — Replace 2 empty states
- `app/(main)/review/[bookId]/page.tsx` — Replace 1 emoji
- `app/(main)/discuss/[bookId]/page.tsx` — Replace 2 emojis in chat text
- `components/providers/auth-guard.tsx` — Replace 1 emoji
- `components/CompletionFlow.tsx` — Replace 1 emoji

### Cleanup
- `app/preview-illustrations/page.tsx` — Delete after work is done
- `public/illustrations/` — Delete unused Storyset/OpenDoodles/Popsy downloads

---

## Task 1: Tailwind Infrastructure Tokens

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Add CSS variable color tokens**

In `tailwind.config.ts`, inside `theme.extend.colors`, add these entries before the existing `"dusty-blue"` line:

```typescript
// CSS variable theme tokens
"sf":  "var(--sf)",
"sf2": "var(--sf2)",
"sf3": "var(--sf3)",
"bg-page": "var(--bg)",
"tp": "var(--tp)",
"ts": "var(--ts)",
"tm": "var(--tm)",
"ac": "var(--ac)",
"ac2": "var(--ac2)",
"ac3": "var(--ac3)",
"acc": "var(--acc)",
"bd": "var(--bd)",
"bd2": "var(--bd2)",
```

- [ ] **Step 2: Add z-index scale**

In `tailwind.config.ts`, inside `theme.extend`, add after `letterSpacing`:

```typescript
zIndex: {
  nav: "40",
  header: "50",
  overlay: "60",
  sheet: "70",
  modal: "80",
  toast: "90",
  top: "100",
},
```

- [ ] **Step 3: Verify dev server still works**

Run: Refresh `http://localhost:3000` — should load with no errors.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: add CSS variable color tokens and z-index scale to tailwind config"
```

---

## Task 2: Globals CSS Cleanup

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add `.glass` utility class**

In `app/globals.css`, inside the existing `@layer utilities` block (after `.scrollbar-hide`), add:

```css
.glass {
  background: color-mix(in srgb, var(--sf) 60%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 0.5px solid var(--bd);
}
```

- [ ] **Step 2: Verify no visual regressions**

Refresh the app, check main page looks the same.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: add glass utility class to globals.css"
```

---

## Task 3: EmptyState Shared Component

**Files:**
- Create: `components/shared/EmptyState.tsx`

- [ ] **Step 1: Create the EmptyState component**

```tsx
"use client";

import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({ icon: Icon, title, description, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <div
      style={{
        borderRadius: 20,
        padding: "40px 24px 32px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
        background: "var(--sf)",
        border: "0.5px solid var(--bd)",
      }}
    >
      {/* Top accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background:
            "linear-gradient(90deg, transparent 10%, color-mix(in srgb, var(--ac) 15%, transparent) 50%, transparent 90%)",
        }}
      />

      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          top: -40,
          left: "50%",
          transform: "translateX(-50%)",
          width: 200,
          height: 160,
          background: "radial-gradient(ellipse, var(--ac), transparent 70%)",
          opacity: 0.04,
          pointerEvents: "none",
        }}
      />

      {/* Icon with circle */}
      <div
        style={{
          width: 64,
          height: 64,
          margin: "0 auto",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "1px solid var(--ac)",
            opacity: 0.12,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={30} strokeWidth={1.3} style={{ color: "var(--ac)", opacity: 0.55 }} />
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--tp)",
          marginTop: 20,
          position: "relative",
        }}
      >
        {title}
      </div>

      {/* Description */}
      {description && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 300,
            color: "var(--ts)",
            marginTop: 8,
            lineHeight: 1.8,
            position: "relative",
          }}
        >
          {description}
        </div>
      )}

      {/* CTA */}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          style={{
            marginTop: 22,
            background: "var(--ac)",
            color: "var(--acc)",
            padding: "10px 22px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 2px 16px color-mix(in srgb, var(--ac) 18%, transparent)",
            transition: "transform 0.15s",
          }}
          onMouseDown={(e) => ((e.target as HTMLElement).style.transform = "scale(0.96)")}
          onMouseUp={(e) => ((e.target as HTMLElement).style.transform = "scale(1)")}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify component renders**

Import and render in preview page or any test page to confirm it looks correct.

- [ ] **Step 3: Commit**

```bash
git add components/shared/EmptyState.tsx
git commit -m "feat: add EmptyState shared component with circle icon pattern"
```

---

## Task 4: Replace Empty States in Home Page

**Files:**
- Modify: `app/(main)/page.tsx:262-378`

- [ ] **Step 1: Add import**

At the top of `app/(main)/page.tsx`, add:

```tsx
import { EmptyState } from "@/components/shared/EmptyState";
import { BookOpen, Bookmark, PenLine } from "lucide-react";
```

(Remove any duplicate lucide imports that already exist.)

- [ ] **Step 2: Replace "읽는 중" tab empty state (around line 262-269)**

Replace the inline empty state div with:

```tsx
<EmptyState
  icon={BookOpen}
  title="아직 읽는 책이 없어요"
  description="첫 번째 책을 추가하고 독서 여정을 시작해보세요"
  ctaLabel="책 추가하기"
  onCta={() => router.push("/setup")}
/>
```

- [ ] **Step 3: Replace "완독" tab empty state (around line 324-328)**

```tsx
<EmptyState
  icon={BookOpen}
  title="아직 완독한 책이 없어요"
  description="한 권을 끝까지 읽으면 완독 서가에 꽂혀요"
/>
```

- [ ] **Step 4: Replace "위시" tab empty state (around line 351-358)**

```tsx
<EmptyState
  icon={Bookmark}
  title="위시리스트가 비어있어요"
  description="읽고 싶은 책을 저장해두면 잊지 않고 만날 수 있어요"
  ctaLabel="책 담기"
  onCta={() => router.push("/setup")}
/>
```

- [ ] **Step 5: Replace "스크랩" tab empty state (around line 373-378)**

```tsx
<EmptyState
  icon={PenLine}
  title="아직 그은 문장이 없어요"
  description="책을 읽으며 마음에 드는 문장을 스크랩해보세요"
/>
```

- [ ] **Step 6: Verify all 4 tabs show correct empty states**

Check each tab: 읽는 중, 완독, 위시, 스크랩 — all should show the new circle+icon pattern.

- [ ] **Step 7: Commit**

```bash
git add app/(main)/page.tsx
git commit -m "feat: replace home page empty states with EmptyState component"
```

---

## Task 5: Replace Empty States in Other Pages

**Files:**
- Modify: `app/(main)/scrap/page.tsx:95-99`
- Modify: `app/(main)/book/[bookId]/page.tsx:1955-1964`
- Modify: `app/(main)/groups/[groupId]/page.tsx:668-673, 1147-1152`

- [ ] **Step 1: scrap/page.tsx — replace review empty state**

Add import at top: `import { EmptyState } from "@/components/shared/EmptyState";`
Add: `import { BookOpen } from "lucide-react";`

Replace the inline empty state (lines ~95-99) with:

```tsx
<EmptyState
  icon={BookOpen}
  title="아직 서평이 없어요"
  description="책을 읽고 느낌을 남겨보세요"
/>
```

- [ ] **Step 2: book/[bookId]/page.tsx — replace scrap empty state**

Add import at top: `import { EmptyState } from "@/components/shared/EmptyState";`
(Highlighter may already be imported, if not add it.)

Replace the inline scrap empty state (lines ~1955-1964) with:

```tsx
<EmptyState
  icon={Highlighter}
  title="아직 글귀가 없어요"
  description="마음에 드는 문장을 기록해보세요"
/>
```

- [ ] **Step 3: groups/[groupId]/page.tsx — replace 2 empty states**

Add import at top: `import { EmptyState } from "@/components/shared/EmptyState";`
Add: `import { PenLine, Library } from "lucide-react";`

Replace scraps empty state (lines ~668-673):

```tsx
<EmptyState
  icon={PenLine}
  title="아직 그어진 문장이 없어요"
  description="책에서 마음에 드는 문장을 그어보세요"
/>
```

Replace books empty state (lines ~1147-1152):

```tsx
<EmptyState
  icon={Library}
  title="아직 함께 읽은 책이 없어요"
  description="첫 책을 골라서 모임을 시작해봐요"
/>
```

- [ ] **Step 4: Verify all pages**

Check: /scrap, /book/[any-id], /groups/[any-id] — empty states should show new pattern.

- [ ] **Step 5: Commit**

```bash
git add app/(main)/scrap/page.tsx app/(main)/book/[bookId]/page.tsx app/(main)/groups/[groupId]/page.tsx
git commit -m "feat: replace empty states in scrap, book detail, and group detail pages"
```

---

## Task 6: Replace All Emojis with Lucide Icons

**Files:**
- Modify: `components/providers/auth-guard.tsx:34`
- Modify: `components/CompletionFlow.tsx:350`
- Modify: `app/(main)/book/[bookId]/page.tsx:1683`
- Modify: `app/(main)/review/[bookId]/page.tsx:777`
- Modify: `app/(main)/discuss/[bookId]/page.tsx:407-408`

- [ ] **Step 1: auth-guard.tsx — replace loading emoji**

Replace line 34:
```tsx
<div className="text-3xl mb-3">📖</div>
```
With:
```tsx
<BookOpen size={32} strokeWidth={1.3} className="mb-3 mx-auto" style={{ color: "var(--ac)", opacity: 0.55 }} />
```

Add import at top: `import { BookOpen } from "lucide-react";`

- [ ] **Step 2: CompletionFlow.tsx — replace book emoji**

Replace line ~350 (the `📖` inside the 72x108 div):
```tsx
}}>📖</div>
```
With:
```tsx
}}><BookOpen size={32} strokeWidth={1.3} style={{ color: "var(--ac)", opacity: 0.6 }} /></div>
```

Add import at top: `import { BookOpen } from "lucide-react";`

- [ ] **Step 3: book/[bookId]/page.tsx — replace completion modal emoji**

Replace line 1683:
```tsx
<p className="text-3xl mb-3">📖</p>
```
With:
```tsx
<BookOpen size={32} strokeWidth={1.3} className="mb-3 mx-auto" style={{ color: "var(--ac)", opacity: 0.55 }} />
```

Ensure `BookOpen` is imported from lucide-react.

- [ ] **Step 4: review/[bookId]/page.tsx — replace essay tab emoji**

Replace line 777:
```tsx
📝 에세이형
```
With:
```tsx
에세이형
```

(Just remove the emoji, keep the text. Tab labels don't need icons.)

- [ ] **Step 5: discuss/[bookId]/page.tsx — replace chat emojis**

Replace lines 407-408, remove the 📖 from the greeting strings:

```tsx
const fallbackContent =
  mode === "resume"
    ? `다시 만나서 반가워요!\n'${bookData.title}' 이야기를 이어서 나눠볼까요? 그 뒤로 더 읽으셨나요?`
    : `'${bookData.title}' 이야기를 나눠볼까요?\n읽으면서 가장 먼저 떠오르는 장면이나 느낌이 있나요?`;
```

- [ ] **Step 6: Verify all emoji replacements**

Check: auth loading screen, completion flow, book detail modal, review page tabs, discussion page greeting.

- [ ] **Step 7: Commit**

```bash
git add components/providers/auth-guard.tsx components/CompletionFlow.tsx app/(main)/book/[bookId]/page.tsx app/(main)/review/[bookId]/page.tsx app/(main)/discuss/[bookId]/page.tsx
git commit -m "feat: replace all emojis with lucide icons across the app"
```

---

## Task 7: Cleanup

**Files:**
- Delete: `app/preview-illustrations/page.tsx`
- Delete: `public/illustrations/` (entire directory)

- [ ] **Step 1: Remove preview page and unused illustrations**

```bash
rm -rf app/preview-illustrations
rm -rf public/illustrations
```

- [ ] **Step 2: Verify app still works**

Refresh main pages. No broken references.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove preview page and unused illustration assets"
```

---

## Summary

| Task | What | Files |
|---|---|---|
| 1 | Tailwind tokens + z-index | tailwind.config.ts |
| 2 | Glass utility CSS | globals.css |
| 3 | EmptyState component | components/shared/EmptyState.tsx |
| 4 | Home page empty states (4) | app/(main)/page.tsx |
| 5 | Other pages empty states (4) | scrap, book, groups pages |
| 6 | Emoji → lucide icons (6) | auth-guard, CompletionFlow, book, review, discuss |
| 7 | Cleanup preview + assets | preview page, illustrations dir |
