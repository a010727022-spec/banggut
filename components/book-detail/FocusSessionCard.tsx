"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Play, Pause, Square, Timer, Hourglass } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createFocusSession,
  getFocusSessionsSince,
} from "@/lib/supabase/queries";
import type { Book, FocusMode, FocusSession } from "@/lib/types";
import { coverPalette } from "@/lib/reading-utils";
import {
  computeFocusStats,
  computeReadingPace,
  formatEtaDate,
  formatMinutesHuman,
} from "@/lib/reading-pace";
import FocusMascot from "@/components/book-detail/FocusMascot";
import FocusStatsRow from "@/components/book-detail/FocusStatsRow";
import BookFocusCalendar from "@/components/book-detail/BookFocusCalendar";
import { toast } from "sonner";

/**
 * FocusSessionCard — 집중 읽기 카드 (v10 · 방긋이 리파인).
 *
 * v9에서 상태 머신·타이머·DB 저장 로직은 그대로 유지하면서,
 * v6 refined 목업(`public/mockup-focus-hero-v6-refined.html`)의 톤에 맞춰 UI만 재배치:
 *
 *   idle   → 책 레일 · 모드 토글 · 방긋이 인사 · 스탯 카드 · 주간 캘린더 · ETA · 시작 CTA
 *   running → 책 레일 · PomodoroRing/StopwatchPulse · 상태 텍스트 · 일시정지/종료
 *   done   → 책 레일 · 축하 hero (mascot-happy) · 리워드 카드 · 캘린더(fresh) · ETA Δ · 액션
 *
 * 구현 메모:
 * - 타이머 베이스: `performance.now()` startedAt ref + setInterval(1000)
 * - 모드 세그먼트: idle에서만 변경 가능 (뽀모도로 25분 / 스톱워치 자유)
 * - localStorage: 세션 스냅샷 + 모드 preference
 * - 완료 시 focus_sessions INSERT + 로컬 state 낙관적 업데이트 (통계 즉시 반영)
 * - 통계: 이 책 최근 60일 focus_sessions 기준 (마운트 시 한 번 fetch)
 * - ETA: `lib/reading-pace.ts` · 샘플이 부족하면 안내 메시지로 폴백
 *
 * Props:
 *   book    — 대상 책 객체 (current_page · total_pages · title · id 사용)
 *   userId  — 현재 로그인 사용자 UUID
 */

const FOCUS_DURATION_SECONDS = 25 * 60;
const MODE_PREF_KEY = "banggut-focus-mode-preference";
const MIN_RECORD_SECONDS = 30;
const STATS_WINDOW_DAYS = 60; // 마운트 시 가져올 세션 범위

type FocusStatus = "idle" | "running" | "paused" | "done";

type FocusState = {
  mode: FocusMode;
  status: FocusStatus;
  startedAt: number | null;
  pausedAt: number | null;
  pausedOffset: number;
  elapsedMs: number;
};

type FocusAction =
  | { type: "setMode"; mode: FocusMode }
  | { type: "start"; now: number }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number }
  | { type: "abort" }
  | { type: "complete"; now: number }
  | { type: "tick"; now: number }
  | { type: "restore"; snapshot: PersistedSnapshot };

type PersistedSnapshot = {
  mode: FocusMode;
  status: FocusStatus;
  startedAtEpochMs: number;
  pausedOffsetMs: number;
  pausedAtEpochMs: number | null;
};

function loadModePreference(): FocusMode {
  if (typeof window === "undefined") return "pomodoro";
  try {
    const v = window.localStorage.getItem(MODE_PREF_KEY);
    return v === "stopwatch" ? "stopwatch" : "pomodoro";
  } catch {
    return "pomodoro";
  }
}

function saveModePreference(mode: FocusMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MODE_PREF_KEY, mode);
  } catch {
    // localStorage 차단 시 무시
  }
}

const makeInitialState = (mode: FocusMode): FocusState => ({
  mode,
  status: "idle",
  startedAt: null,
  pausedAt: null,
  pausedOffset: 0,
  elapsedMs: 0,
});

function reducer(state: FocusState, action: FocusAction): FocusState {
  switch (action.type) {
    case "setMode":
      if (state.status !== "idle") return state;
      return { ...state, mode: action.mode };
    case "start":
      return {
        mode: state.mode,
        status: "running",
        startedAt: action.now,
        pausedAt: null,
        pausedOffset: 0,
        elapsedMs: 0,
      };
    case "pause":
      if (state.status !== "running" || state.startedAt == null) return state;
      return { ...state, status: "paused", pausedAt: action.now };
    case "resume":
      if (state.status !== "paused" || state.pausedAt == null) return state;
      return {
        ...state,
        status: "running",
        pausedOffset: state.pausedOffset + (action.now - state.pausedAt),
        pausedAt: null,
      };
    case "abort":
      return makeInitialState(state.mode);
    case "complete": {
      if (state.status !== "running" && state.status !== "paused") return state;
      const startedAt = state.startedAt ?? action.now;
      const finalElapsed =
        state.status === "paused" && state.pausedAt != null
          ? state.pausedAt - startedAt - state.pausedOffset
          : action.now - startedAt - state.pausedOffset;
      return {
        ...state,
        status: "done",
        elapsedMs: Math.max(0, finalElapsed),
      };
    }
    case "tick": {
      if (state.status !== "running" || state.startedAt == null) return state;
      const elapsed = action.now - state.startedAt - state.pausedOffset;
      if (state.mode === "pomodoro" && elapsed >= FOCUS_DURATION_SECONDS * 1000) {
        return {
          ...state,
          status: "done",
          elapsedMs: FOCUS_DURATION_SECONDS * 1000,
        };
      }
      return { ...state, elapsedMs: elapsed };
    }
    case "restore": {
      const nowPerf = performance.now();
      const nowEpoch = Date.now();
      const startedPerf = nowPerf - (nowEpoch - action.snapshot.startedAtEpochMs);
      const pausedPerf =
        action.snapshot.pausedAtEpochMs != null
          ? nowPerf - (nowEpoch - action.snapshot.pausedAtEpochMs)
          : null;
      const elapsed = nowPerf - startedPerf - action.snapshot.pausedOffsetMs;
      const mode = action.snapshot.mode || "pomodoro";

      if (mode === "pomodoro" && elapsed >= FOCUS_DURATION_SECONDS * 1000) {
        return {
          mode,
          status: "done",
          startedAt: startedPerf,
          pausedAt: null,
          pausedOffset: action.snapshot.pausedOffsetMs,
          elapsedMs: FOCUS_DURATION_SECONDS * 1000,
        };
      }
      return {
        mode,
        status: action.snapshot.status,
        startedAt: startedPerf,
        pausedAt: pausedPerf,
        pausedOffset: action.snapshot.pausedOffsetMs,
        elapsedMs: Math.max(0, elapsed),
      };
    }
  }
}

function storageKey(bookId: string) {
  return `banggut-focus-session-${bookId}`;
}

function loadSnapshot(bookId: string): PersistedSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(bookId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSnapshot>;
    if (!parsed.startedAtEpochMs || !parsed.status) return null;
    return {
      mode: parsed.mode === "stopwatch" ? "stopwatch" : "pomodoro",
      status: parsed.status,
      startedAtEpochMs: parsed.startedAtEpochMs,
      pausedOffsetMs: parsed.pausedOffsetMs ?? 0,
      pausedAtEpochMs: parsed.pausedAtEpochMs ?? null,
    };
  } catch {
    return null;
  }
}

function saveSnapshot(bookId: string, state: FocusState) {
  if (typeof window === "undefined") return;
  if (state.status !== "running" && state.status !== "paused") {
    window.localStorage.removeItem(storageKey(bookId));
    return;
  }
  if (state.startedAt == null) return;
  const nowPerf = performance.now();
  const nowEpoch = Date.now();
  const snapshot: PersistedSnapshot = {
    mode: state.mode,
    status: state.status,
    startedAtEpochMs: nowEpoch - (nowPerf - state.startedAt),
    pausedOffsetMs: state.pausedOffset,
    pausedAtEpochMs:
      state.pausedAt != null ? nowEpoch - (nowPerf - state.pausedAt) : null,
  };
  window.localStorage.setItem(storageKey(bookId), JSON.stringify(snapshot));
}

function formatMMSS(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function elapsedMinutes(ms: number) {
  return Math.max(1, Math.round(ms / 60000));
}

/**
 * 시간대별 인사 문구.
 *   05~11  → "좋은 아침이에요"
 *   11~14  → "점심 잘 드셨어요?"
 *   14~18  → "오후 한 모금"
 *   18~22  → "오늘 저녁은 어때요?"
 *   그 외  → "깊은 밤, 고요한 책"
 */
function greetingByHour(hour: number): string {
  if (hour >= 5 && hour < 11) return "좋은 아침이에요";
  if (hour >= 11 && hour < 14) return "점심 잘 드셨어요?";
  if (hour >= 14 && hour < 18) return "오후 한 모금";
  if (hour >= 18 && hour < 22) return "오늘 저녁은 어때요?";
  return "깊은 밤, 고요한 책";
}

export default function FocusSessionCard({
  book,
  userId,
}: {
  book: Book;
  userId: string;
}) {
  const bookId = book.id;

  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => makeInitialState(loadModePreference()),
  );
  const startedAtEpochRef = useRef<number | null>(null);
  const completedHandledRef = useRef(false);

  // 통계·캘린더·ETA에 쓰이는 최근 세션 배열
  const [sessions, setSessions] = useState<FocusSession[]>([]);

  // 마운트 시 localStorage 스냅샷 복원
  useEffect(() => {
    const snap = loadSnapshot(bookId);
    if (snap) {
      startedAtEpochRef.current = snap.startedAtEpochMs;
      dispatch({ type: "restore", snapshot: snap });
    }
  }, [bookId]);

  // 마운트 시 최근 세션 fetch
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const sinceIso = new Date(
      Date.now() - STATS_WINDOW_DAYS * 86400 * 1000,
    ).toISOString();
    getFocusSessionsSince(supabase, bookId, sinceIso)
      .then((data) => {
        if (!cancelled) setSessions(data);
      })
      .catch((err) => {
        console.error("[FocusSessionCard] load sessions:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  // 매초 tick — running 상태에서만
  useEffect(() => {
    if (state.status !== "running") return;
    const id = window.setInterval(() => {
      dispatch({ type: "tick", now: performance.now() });
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.status]);

  // 상태 변화 시 localStorage 영속화
  useEffect(() => {
    saveSnapshot(bookId, state);
  }, [state, bookId]);

  // done 진입 시 DB INSERT + 낙관적 로컬 반영
  useEffect(() => {
    if (state.status !== "done") {
      completedHandledRef.current = false;
      return;
    }
    if (completedHandledRef.current) return;
    completedHandledRef.current = true;

    const supabase = createClient();
    const endedAt = new Date();
    const startedAtEpoch =
      startedAtEpochRef.current ?? endedAt.getTime() - state.elapsedMs;
    const rawSec = Math.round(state.elapsedMs / 1000);
    const durationSec =
      state.mode === "pomodoro"
        ? Math.min(FOCUS_DURATION_SECONDS, rawSec)
        : rawSec;

    const payload = {
      book_id: bookId,
      user_id: userId,
      mode: state.mode,
      started_at: new Date(startedAtEpoch).toISOString(),
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSec,
      pages_read_delta: 0,
      completed: true,
    };

    // 즉시 UI 반영을 위해 로컬 state에 선반영
    setSessions((prev) => [
      {
        id: `__optimistic-${endedAt.getTime()}`,
        created_at: endedAt.toISOString(),
        ...payload,
      } as FocusSession,
      ...prev,
    ]);

    createFocusSession(supabase, payload).catch((err) => {
      console.error("[FocusSessionCard] failed to save focus session:", err);
    });
  }, [state.status, state.mode, state.elapsedMs, bookId, userId]);

  const handleSetMode = useCallback((mode: FocusMode) => {
    saveModePreference(mode);
    dispatch({ type: "setMode", mode });
  }, []);

  const handleStart = useCallback(() => {
    startedAtEpochRef.current = Date.now();
    dispatch({ type: "start", now: performance.now() });
  }, []);

  const handlePause = useCallback(() => {
    dispatch({ type: "pause", now: performance.now() });
  }, []);

  const handleResume = useCallback(() => {
    dispatch({ type: "resume", now: performance.now() });
  }, []);

  const handleComplete = useCallback(() => {
    dispatch({ type: "complete", now: performance.now() });
  }, []);

  const handleAbort = useCallback(async () => {
    if (state.startedAt == null || startedAtEpochRef.current == null) {
      dispatch({ type: "abort" });
      return;
    }
    const supabase = createClient();
    const endedAt = new Date();
    const durationSec = Math.round(state.elapsedMs / 1000);
    if (durationSec > MIN_RECORD_SECONDS) {
      try {
        await createFocusSession(supabase, {
          book_id: bookId,
          user_id: userId,
          mode: state.mode,
          started_at: new Date(startedAtEpochRef.current).toISOString(),
          ended_at: endedAt.toISOString(),
          duration_seconds: durationSec,
          pages_read_delta: 0,
          completed: false,
        });
        setSessions((prev) => [
          {
            id: `__optimistic-abort-${endedAt.getTime()}`,
            created_at: endedAt.toISOString(),
            book_id: bookId,
            user_id: userId,
            mode: state.mode,
            started_at: new Date(startedAtEpochRef.current!).toISOString(),
            ended_at: endedAt.toISOString(),
            duration_seconds: durationSec,
            pages_read_delta: 0,
            completed: false,
          } as FocusSession,
          ...prev,
        ]);
      } catch (err) {
        console.error(
          "[FocusSessionCard] failed to save aborted session:",
          err,
        );
      }
    }
    dispatch({ type: "abort" });
    toast("집중 시간 중단했어요", {
      description:
        durationSec > MIN_RECORD_SECONDS
          ? `${elapsedMinutes(state.elapsedMs)}분 읽었어요`
          : undefined,
    });
  }, [state.startedAt, state.elapsedMs, state.mode, bookId, userId]);

  const handleDismiss = useCallback(() => {
    dispatch({ type: "abort" });
  }, []);

  // ── 파생값 (통계·ETA·표지 팔레트·인사말) ───────────────────
  const stats = useMemo(() => computeFocusStats(sessions), [sessions]);
  const pace = useMemo(
    () => computeReadingPace(book, sessions),
    [book, sessions],
  );
  const cover = useMemo(() => coverPalette(book.title ?? ""), [book.title]);
  const greetingHead = useMemo(
    () => greetingByHour(new Date().getHours()),
    // 분 단위로만 바뀜 — 한번 계산하고 유지
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const isPomodoro = state.mode === "pomodoro";
  const accentVar = isPomodoro ? "var(--ac)" : "var(--honey)";
  const accentVar2 = isPomodoro ? "var(--ac2)" : "var(--honey2)";

  // 카드 공통 래퍼 스타일
  const cardWrap: React.CSSProperties = {
    margin: "4px 18px 12px",
    background: "var(--sf)",
    border: "0.5px solid var(--bd)",
    borderRadius: 18,
    overflow: "hidden",
  };

  // ═══════════════════════════════════════════
  //  IDLE
  // ═══════════════════════════════════════════
  if (state.status === "idle") {
    const progressPct = computeProgressPct(book);
    const pagesLabel =
      book.total_pages != null && book.current_page != null
        ? `${book.current_page} / ${book.total_pages}쪽`
        : book.progress_percent != null
          ? `${book.progress_percent}%`
          : "페이지 미설정";

    return (
      <div style={cardWrap}>
        {/* 1) 책 레일 */}
        <BookRail
          title={book.title ?? "무제"}
          subtitle={pagesLabel}
          percent={progressPct}
          palette={cover}
        />

        {/* 2) 모드 세그먼트 토글 */}
        <div
          role="tablist"
          aria-label="집중 모드 선택"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            padding: 6,
            gap: 4,
            background: "var(--sf2)",
            margin: "0 14px",
            borderRadius: 12,
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={isPomodoro}
            onClick={() => handleSetMode("pomodoro")}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "none",
              background: isPomodoro ? "var(--sf)" : "transparent",
              color: isPomodoro ? "var(--ac)" : "var(--tm)",
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: "-0.2px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              boxShadow: isPomodoro
                ? "0 1px 3px rgba(15,14,12,0.06)"
                : "none",
              transition: "background 180ms ease, color 180ms ease",
            }}
          >
            <Hourglass size={11} strokeWidth={2.5} />
            25분 집중
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isPomodoro}
            onClick={() => handleSetMode("stopwatch")}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "none",
              background: !isPomodoro ? "var(--sf)" : "transparent",
              color: !isPomodoro ? "var(--honey)" : "var(--tm)",
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: "-0.2px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              boxShadow: !isPomodoro
                ? "0 1px 3px rgba(15,14,12,0.06)"
                : "none",
              transition: "background 180ms ease, color 180ms ease",
            }}
          >
            <Timer size={11} strokeWidth={2.5} />
            읽는 만큼
          </button>
        </div>

        {/* 3) 인사말 + 방긋이 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 14px 4px",
          }}
        >
          <FocusMascot state="idle" size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--tm)",
                fontWeight: 500,
                marginBottom: 2,
              }}
            >
              {greetingHead}
            </div>
            <div
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 17,
                fontWeight: 700,
                color: "var(--tp)",
                letterSpacing: "-0.015em",
                lineHeight: 1.25,
              }}
            >
              오늘도 한 모금,
              <br />
              읽어볼까요?
            </div>
          </div>
        </div>

        {/* 4) 스탯 카드 */}
        <div style={{ padding: "10px 14px 0" }}>
          <FocusStatsRow
            rows={[
              { label: "오늘", value: stats.todayMinutes, unit: "분" },
              {
                label: "이번 주",
                value: stats.weekMinutes,
                unit: "분",
                tone: "primary",
              },
              {
                label: "전체 몰입",
                value: formatMinutesHuman(stats.totalMinutes),
                tone: "muted",
              },
            ]}
          />
        </div>

        {/* 5) 주간 캘린더 */}
        <div style={{ padding: "10px 14px 0" }}>
          <BookFocusCalendar
            readDates={stats.readDatesThisWeek}
            weekCount={stats.daysReadThisWeek}
          />
        </div>

        {/* 6) ETA 한 줄 */}
        <div style={{ padding: "10px 14px 0" }}>
          <EtaRow pace={pace} />
        </div>

        {/* 7) 시작 CTA */}
        <div style={{ padding: "14px 14px 14px" }}>
          <button
            type="button"
            onClick={handleStart}
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 14,
              border: "none",
              background: `linear-gradient(135deg, ${accentVar}, ${accentVar2})`,
              color: "var(--acc)",
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: `0 4px 14px color-mix(in srgb, ${accentVar} 28%, transparent)`,
            }}
            aria-label={
              isPomodoro ? "25분 집중 읽기 시작" : "스톱워치로 읽기 시작"
            }
          >
            <Play size={13} strokeWidth={3} fill="currentColor" />
            {isPomodoro ? "25분 집중 시작" : "읽는 만큼 시작"}
          </button>
          <div
            style={{
              marginTop: 8,
              textAlign: "center",
              fontSize: 11.5,
              color: "var(--tm)",
            }}
          >
            {isPomodoro
              ? "방해 없이 책과 둘만의 시간"
              : "원할 때 종료해요 · 몇 분 읽었는지 기록"}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  //  RUNNING / PAUSED
  // ═══════════════════════════════════════════
  if (state.status === "running" || state.status === "paused") {
    const isRunning = state.status === "running";
    const progressPct = computeProgressPct(book);

    return (
      <div
        style={{
          ...cardWrap,
          background: `linear-gradient(155deg, color-mix(in srgb, ${accentVar} 7%, var(--sf)) 0%, var(--sf) 70%)`,
          border: "0.5px solid var(--bd2)",
          boxShadow: `0 6px 22px color-mix(in srgb, ${accentVar} 12%, transparent)`,
        }}
      >
        {/* 상단 accent bar */}
        <div
          style={{
            height: 3,
            background: `linear-gradient(90deg, ${accentVar}, ${accentVar2})`,
          }}
        />

        <BookRail
          title={book.title ?? "무제"}
          subtitle={`현재 ${book.current_page ?? "-"}쪽`}
          percent={progressPct}
          palette={cover}
        />

        {/* 타이머 + 방긋이 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "6px 18px 14px",
          }}
        >
          {isPomodoro ? (
            <PomodoroRing
              bookId={bookId}
              elapsedMs={state.elapsedMs}
              status={state.status}
            />
          ) : (
            <StopwatchPulse
              elapsedMs={state.elapsedMs}
              status={state.status}
            />
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <FocusMascot state="running" size={40} />
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 800,
                  color: "var(--tp)",
                  letterSpacing: "-0.3px",
                }}
              >
                {isPomodoro ? "25분 집중 읽기" : "읽는 만큼"}
              </div>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--tm)",
                lineHeight: 1.45,
                marginBottom: 10,
              }}
            >
              {isRunning ? (
                isPomodoro ? (
                  <>
                    끝나면 <b style={{ color: "var(--tp)" }}>몇 쪽</b> 읽었는지
                    <br />
                    방긋이가 물어볼게요
                  </>
                ) : (
                  <>
                    다 읽으면 <b style={{ color: "var(--honey)" }}>종료</b>를
                    눌러주세요
                    <br />몇 쪽 읽었는지 물어볼게요
                  </>
                )
              ) : (
                <>
                  잠시 멈췄어요
                  <br />
                  다시 시작할 수 있어요
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {isPomodoro ? (
                <>
                  {isRunning ? (
                    <button
                      type="button"
                      onClick={handlePause}
                      style={btnSecondary}
                    >
                      <Pause size={11} strokeWidth={2.5} fill="currentColor" />
                      일시정지
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResume}
                      style={{ ...btnPrimary, background: accentVar }}
                    >
                      <Play size={11} strokeWidth={3} fill="currentColor" />
                      재개
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAbort}
                    style={btnGhost}
                    aria-label="집중 중단"
                  >
                    <Square size={10} strokeWidth={2.5} fill="currentColor" />
                    중단
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleComplete}
                    style={{
                      ...btnPrimary,
                      background: `linear-gradient(135deg, var(--honey), var(--honey2))`,
                      color: "#FFFFFF",
                    }}
                    aria-label="스톱워치 종료"
                  >
                    <Square size={11} strokeWidth={3} fill="currentColor" />
                    종료
                  </button>
                  <button
                    type="button"
                    onClick={handleAbort}
                    style={btnGhost}
                    aria-label="집중 중단"
                  >
                    <Square size={10} strokeWidth={2.5} fill="currentColor" />
                    중단
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  //  DONE
  // ═══════════════════════════════════════════
  const minutes = elapsedMinutes(state.elapsedMs);
  const progressPct = computeProgressPct(book);
  const weekTotal = stats.weekMinutes;
  const paceDelta = pace.daysRemaining; // 방금 완료 후 남은 일수

  return (
    <div
      style={{
        ...cardWrap,
        background: `linear-gradient(155deg, color-mix(in srgb, ${accentVar} 18%, var(--sf)) 0%, var(--sf) 80%)`,
        border: `1px solid color-mix(in srgb, ${accentVar} 40%, var(--bd2))`,
        boxShadow: `0 8px 28px color-mix(in srgb, ${accentVar} 16%, transparent)`,
        animation: "focus-pop 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      role="status"
      aria-live="polite"
    >
      <style>{`
        @keyframes focus-pop {
          0% { transform: scale(0.96); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [role="status"] { animation: none !important; }
        }
      `}</style>

      <BookRail
        title={book.title ?? "무제"}
        subtitle={`현재 ${book.current_page ?? "-"}쪽`}
        percent={progressPct}
        palette={cover}
      />

      {/* Hero */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "6px 14px 14px",
        }}
      >
        <FocusMascot state="done" size={88} />
        <div
          style={{
            fontFamily: "'Fraunces', serif",
            fontWeight: 900,
            fontSize: 44,
            lineHeight: 1,
            color: "var(--ac)",
            letterSpacing: "-0.03em",
            margin: "8px 0 4px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          +{minutes}
          <span style={{ fontSize: 22, marginLeft: 2, color: "var(--ac)" }}>
            분
          </span>
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--tm)",
            fontWeight: 500,
            textAlign: "center",
          }}
        >
          이번 주 몰입{" "}
          <b
            style={{
              fontFamily: "'Fraunces', serif",
              color: "var(--ac)",
              fontWeight: 700,
            }}
          >
            {weekTotal}
          </b>
          분으로 올라왔어요
        </div>
      </div>

      {/* 리워드 (honey 단독 등장) */}
      <div style={{ padding: "0 14px 12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "10px 14px",
            background: "color-mix(in srgb, var(--honey) 14%, var(--sf))",
            border: "0.5px solid color-mix(in srgb, var(--honey) 40%, var(--bd2))",
            borderRadius: 14,
            transform: "rotate(-0.8deg)",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "var(--sf)",
              border: "1px solid var(--bd)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
              transform: "rotate(6deg)",
            }}
          >
            🫘
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "'Gaegu', cursive",
                fontSize: 11.5,
                color: "var(--honey)",
                fontWeight: 700,
                letterSpacing: "0.02em",
                marginBottom: 1,
              }}
            >
              오늘의 콩
            </div>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--tp)",
                letterSpacing: "-0.005em",
              }}
            >
              연속{" "}
              <em
                style={{
                  fontStyle: "normal",
                  fontFamily: "'Fraunces', serif",
                  color: "var(--ac)",
                }}
              >
                {stats.daysReadThisWeek}
              </em>
              일째 · 방긋이가 도장을 찍었어요
            </div>
          </div>
          <div
            style={{
              fontFamily: "'Fraunces', serif",
              fontWeight: 900,
              fontSize: 20,
              color: "var(--ac)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            +1
          </div>
        </div>
      </div>

      {/* 캘린더 (오늘 fresh stamp) */}
      <div style={{ padding: "0 14px 12px" }}>
        <BookFocusCalendar
          readDates={stats.readDatesThisWeek}
          weekCount={stats.daysReadThisWeek}
          todayFresh
        />
      </div>

      {/* ETA 델타 */}
      {paceDelta != null && pace.estimatedCompletionDate != null && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            padding: "0 14px 14px",
            fontSize: 12.5,
            color: "var(--ts)",
            fontWeight: 500,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span>
            완독 예정{" "}
            <b
              style={{
                fontFamily: "'Fraunces', serif",
                color: "var(--ac)",
                fontWeight: 700,
              }}
            >
              {formatEtaDate(pace.estimatedCompletionDate)}
            </b>
          </span>
          <span
            aria-hidden
            style={{
              width: 3,
              height: 3,
              borderRadius: "50%",
              background: "var(--bd2)",
            }}
          />
          <span>
            약{" "}
            <b
              style={{
                fontFamily: "'Fraunces', serif",
                color: "var(--ac)",
                fontWeight: 700,
              }}
            >
              {paceDelta}
            </b>
            일 남음
          </span>
        </div>
      )}

      {/* 액션 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.7fr",
          gap: 10,
          padding: "0 14px 14px",
        }}
      >
        <button
          type="button"
          onClick={handleStart}
          style={{
            background: "var(--sf)",
            border: "0.5px solid var(--bd2)",
            color: "var(--tp)",
            padding: "12px 10px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          한 번 더
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          style={{
            background: "var(--tp)",
            color: "var(--sf)",
            border: "none",
            padding: "12px 14px",
            borderRadius: 12,
            fontSize: 13.5,
            fontWeight: 800,
            cursor: "pointer",
            letterSpacing: "-0.005em",
            boxShadow: "0 2px 8px rgba(15,14,12,0.12)",
          }}
        >
          저장하고 닫기
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  BookRail — 카드 상단 책 요약
// ═══════════════════════════════════════════
function BookRail({
  title,
  subtitle,
  percent,
  palette,
}: {
  title: string;
  subtitle: string;
  percent: number;
  palette: [string, string];
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderBottom: "0.5px solid var(--bd)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 50,
          background: `linear-gradient(152deg, ${palette[0]} 0%, ${palette[1]} 100%)`,
          borderRadius: 3,
          flexShrink: 0,
          position: "relative",
          boxShadow: "inset -1.5px 0 0 rgba(0,0,0,0.06)",
        }}
        aria-hidden
      >
        <div
          style={{
            position: "absolute",
            left: 3,
            top: 4,
            bottom: 4,
            width: 1,
            background: "rgba(255,255,255,0.18)",
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: "var(--tp)",
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--tm)",
            marginTop: 2,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {subtitle}
        </div>
      </div>
      <div
        style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 16,
          fontWeight: 700,
          color: "var(--ac)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {percent}%
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  EtaRow — 예측 가능 / 폴백 메시지 분기
// ═══════════════════════════════════════════
function EtaRow({
  pace,
}: {
  pace: ReturnType<typeof computeReadingPace>;
}) {
  // 예측 가능: 완독 예정일 + 남은 일수 둘 다 있음
  if (pace.estimatedCompletionDate != null && pace.daysRemaining != null) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "11px 14px",
          background: "var(--sf)",
          border: "0.5px solid var(--bd)",
          borderRadius: 14,
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--ac) 14%, var(--sf))",
            border: "0.5px solid color-mix(in srgb, var(--ac) 40%, var(--bd))",
            color: "var(--ac)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
          }}
          aria-hidden
        >
          ✦
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--tm)",
              fontWeight: 500,
              marginBottom: 1,
            }}
          >
            이 속도로 읽으면
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: "var(--tp)",
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <em
              style={{
                fontStyle: "normal",
                fontFamily: "'Fraunces', serif",
                color: "var(--ac)",
              }}
            >
              {formatEtaDate(pace.estimatedCompletionDate)}
            </em>
            쯤 완독 · 약{" "}
            <em
              style={{
                fontStyle: "normal",
                fontFamily: "'Fraunces', serif",
                color: "var(--ac)",
              }}
            >
              {pace.daysRemaining}
            </em>
            일 남음
          </div>
        </div>
      </div>
    );
  }

  // 폴백: 쪽수 기록이 부족해서 ETA를 못 내는 경우
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 14px",
        background: "var(--sf2)",
        border: "0.5px dashed var(--bd)",
        borderRadius: 14,
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "var(--sf)",
          border: "0.5px solid var(--bd)",
          color: "var(--tm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}
        aria-hidden
      >
        ◌
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--tp)",
            fontWeight: 700,
            marginBottom: 1,
          }}
        >
          완독 예정일
        </div>
        <div style={{ fontSize: 11, color: "var(--tm)", lineHeight: 1.4 }}>
          한두 번 더 집중 기록을 쌓으면 예측해 드릴게요
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  진행률 계산 (현재 쪽 / 전체 또는 progress_percent)
// ═══════════════════════════════════════════
function computeProgressPct(book: Book): number {
  if (book.total_pages != null && book.total_pages > 0 && book.current_page != null) {
    return Math.max(0, Math.min(100, Math.round((book.current_page / book.total_pages) * 100)));
  }
  if (book.progress_percent != null) {
    return Math.max(0, Math.min(100, Math.round(book.progress_percent)));
  }
  return 0;
}

// ═══════════════════════════════════════════
//  Pomodoro Ring (기존 유지)
// ═══════════════════════════════════════════
function PomodoroRing({
  bookId,
  elapsedMs,
  status,
}: {
  bookId: string;
  elapsedMs: number;
  status: FocusStatus;
}) {
  const remainingMs = FOCUS_DURATION_SECONDS * 1000 - elapsedMs;
  const progress = Math.min(1, elapsedMs / (FOCUS_DURATION_SECONDS * 1000));
  const circumference = 2 * Math.PI * 44;
  const dashOffset = circumference * (1 - progress);

  return (
    <div
      style={{
        position: "relative",
        width: 94,
        height: 94,
        flexShrink: 0,
      }}
    >
      <svg width={94} height={94} viewBox="0 0 100 100">
        <defs>
          <linearGradient
            id={`focus-grad-${bookId}`}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop offset="0%" stopColor="var(--ac)" />
            <stop offset="100%" stopColor="var(--ac2)" />
          </linearGradient>
        </defs>
        <circle
          cx={50}
          cy={50}
          r={44}
          fill="none"
          stroke="var(--bd)"
          strokeWidth={6}
        />
        <circle
          cx={50}
          cy={50}
          r={44}
          fill="none"
          stroke={`url(#focus-grad-${bookId})`}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 50 50)"
          style={{
            transition:
              status === "running"
                ? "stroke-dashoffset 1s linear"
                : "stroke-dashoffset 0.2s ease",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 22,
            fontWeight: 900,
            color: "var(--tp)",
            letterSpacing: "-0.8px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatMMSS(remainingMs)}
        </div>
        <div
          style={{
            fontSize: 8.5,
            fontWeight: 800,
            color: "var(--ac)",
            letterSpacing: "1px",
            textTransform: "uppercase",
          }}
        >
          {status === "running" ? "집중 중" : "일시정지"}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  Stopwatch Pulse (기존 유지)
// ═══════════════════════════════════════════
function StopwatchPulse({
  elapsedMs,
  status,
}: {
  elapsedMs: number;
  status: FocusStatus;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: 94,
        height: 94,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-label={`경과 시간 ${formatMMSS(elapsedMs)}`}
    >
      <style>{`
        @keyframes sw-pulse {
          0%, 100% { box-shadow: inset 0 0 0 0 color-mix(in srgb, var(--honey) 45%, transparent); }
          50%      { box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--honey) 45%, transparent); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sw-pulse-ring { animation: none !important; }
        }
      `}</style>
      <div
        className="sw-pulse-ring"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "1px solid color-mix(in srgb, var(--honey) 25%, transparent)",
          animation:
            status === "running"
              ? "sw-pulse 2s ease-in-out infinite"
              : "none",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        <div
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 22,
            fontWeight: 900,
            color: "var(--honey)",
            letterSpacing: "-0.8px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatMMSS(elapsedMs)}
        </div>
        <div
          style={{
            fontSize: 8.5,
            fontWeight: 800,
            color: "var(--honey)",
            letterSpacing: "1px",
            textTransform: "uppercase",
          }}
        >
          {status === "running" ? "경과" : "일시정지"}
        </div>
      </div>
    </div>
  );
}

// 공통 버튼 스타일 (기존 유지)
const btnPrimary: React.CSSProperties = {
  flex: 1,
  padding: "7px 10px",
  borderRadius: 100,
  border: "none",
  fontSize: 11,
  fontWeight: 800,
  color: "var(--acc)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
};

const btnSecondary: React.CSSProperties = {
  flex: 1,
  padding: "7px 10px",
  borderRadius: 100,
  background: "var(--sf2)",
  border: "0.5px solid var(--bd2)",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--tp)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
};

const btnGhost: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: 100,
  background: "transparent",
  border: "0.5px solid var(--bd2)",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--tm)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
};
