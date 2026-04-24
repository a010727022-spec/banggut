import type { Book, FocusSession } from "@/lib/types";

/**
 * reading-pace — 집중 세션 로그로부터 읽기 속도·ETA 추정.
 *
 * 순수 함수. 인자 외 사이드 이펙트 없음.
 *
 * 공식 (Emily / Dan · v6 refined):
 *   pagesPerMinute   = Σ(pages_read_delta of valid sessions) / Σ(duration_minutes of valid sessions)
 *   avgMinutesPerDay = Σ(duration_minutes in last N days) / (unique days with any session in last N days)
 *   minutesNeeded    = remaining_pages / pagesPerMinute
 *   daysRemaining    = minutesNeeded / avgMinutesPerDay  (올림, 최소 1)
 *   estimatedDate    = today + daysRemaining (일 단위)
 *
 * "valid session" = duration_seconds ≥ 60 AND pages_read_delta > 0
 * 최근 N일(기본 14일) 윈도우만 사용 — 과거 패턴은 무시.
 *
 * 예측 불가 조건 (모두 null 리턴):
 * - 최근 윈도우 내 valid 세션 0개 (쪽수 기록이 없음)
 * - 책에 total_pages 없음 (ebook progress_percent 전용) → 페이지 기반 ETA 불가
 * - current_page >= total_pages (이미 완독)
 * - pagesPerMinute <= 0
 */

export interface ReadingPaceResult {
  /** 분당 읽는 쪽수. null = 최근 기록 부족 */
  pagesPerMinute: number | null;
  /** 최근 윈도우 안에서 세션이 있던 날의 평균 분. null = 최근 활동 없음 */
  avgMinutesPerDay: number | null;
  /** 남은 쪽수. total_pages 없으면 null */
  remainingPages: number | null;
  /** 완독까지 남은 일수 (올림, 최소 1). 예측 불가 시 null */
  daysRemaining: number | null;
  /** 완독 예상일. 예측 불가 시 null */
  estimatedCompletionDate: Date | null;
  /** 윈도우 안에서 집계된 유효 세션 수 (샘플 크기 지표) */
  validSessionCount: number;
}

const DEFAULT_WINDOW_DAYS = 14;

/**
 * 최근 N일 윈도우 안에서 pages_read_delta / duration 비율과 평균 몰입 시간으로
 * 완독까지 몇 일 남았는지 계산해요.
 *
 * @param book      대상 책 (current_page · total_pages 사용)
 * @param sessions  이 책의 focus_sessions (최근 것 포함). 내부에서 windowDays로 필터.
 * @param now       기준 시각 (테스트 주입용). 기본 현재 시각.
 * @param windowDays 최근 몇 일을 볼지. 기본 14일.
 */
export function computeReadingPace(
  book: Pick<Book, "current_page" | "total_pages">,
  sessions: FocusSession[],
  now: Date = new Date(),
  windowDays: number = DEFAULT_WINDOW_DAYS,
): ReadingPaceResult {
  const empty: ReadingPaceResult = {
    pagesPerMinute: null,
    avgMinutesPerDay: null,
    remainingPages: null,
    daysRemaining: null,
    estimatedCompletionDate: null,
    validSessionCount: 0,
  };

  // 1) 남은 쪽수 계산 (total_pages 없으면 페이지 기반 ETA 불가)
  const total = book.total_pages ?? null;
  const current = book.current_page ?? 0;
  const remaining = total != null ? Math.max(0, total - current) : null;

  // 2) 최근 N일 윈도우 필터
  const windowStartMs = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  const recent = sessions.filter((s) => {
    if (!s.started_at) return false;
    return new Date(s.started_at).getTime() >= windowStartMs;
  });

  // 3) 유효 세션 = 1분 이상 + 쪽수 기록 존재 (속도 계산용)
  const validForPace = recent.filter(
    (s) => s.duration_seconds >= 60 && s.pages_read_delta > 0,
  );

  // 4) 평균 분/일 = 윈도우 내 세션이 있던 날만 카운트 (쪽수 없어도 포함)
  const minutesByDay = new Map<string, number>();
  for (const s of recent) {
    if (s.duration_seconds < 60) continue;
    const dayKey = new Date(s.started_at).toISOString().slice(0, 10);
    const prev = minutesByDay.get(dayKey) ?? 0;
    minutesByDay.set(dayKey, prev + s.duration_seconds / 60);
  }

  const totalMinutesInWindow = Array.from(minutesByDay.values()).reduce(
    (sum, m) => sum + m,
    0,
  );
  const activeDaysInWindow = minutesByDay.size;
  const avgMinutesPerDay =
    activeDaysInWindow > 0 ? totalMinutesInWindow / activeDaysInWindow : null;

  // 5) pages per minute = 유효 세션 합 쪽수 / 유효 세션 합 분
  const totalPagesPace = validForPace.reduce(
    (sum, s) => sum + s.pages_read_delta,
    0,
  );
  const totalMinutesPace = validForPace.reduce(
    (sum, s) => sum + s.duration_seconds / 60,
    0,
  );
  const pagesPerMinute =
    totalMinutesPace > 0 && totalPagesPace > 0
      ? totalPagesPace / totalMinutesPace
      : null;

  // 6) ETA 계산 — 필요한 값 모두 있고, 남은 쪽수 > 0 일 때만
  let daysRemaining: number | null = null;
  let estimatedCompletionDate: Date | null = null;

  if (
    remaining != null &&
    remaining > 0 &&
    pagesPerMinute != null &&
    pagesPerMinute > 0 &&
    avgMinutesPerDay != null &&
    avgMinutesPerDay > 0
  ) {
    const minutesNeeded = remaining / pagesPerMinute;
    daysRemaining = Math.max(1, Math.ceil(minutesNeeded / avgMinutesPerDay));
    const eta = new Date(now);
    eta.setHours(0, 0, 0, 0);
    eta.setDate(eta.getDate() + daysRemaining);
    estimatedCompletionDate = eta;
  }

  return {
    pagesPerMinute,
    avgMinutesPerDay,
    remainingPages: remaining,
    daysRemaining,
    estimatedCompletionDate,
    validSessionCount: validForPace.length,
  };
}

/**
 * 이번 주(월 ~ 일) 오전 0시 기준 시작일을 ISO 날짜(YYYY-MM-DD)로 반환.
 *
 * 주의: 브라우저/서버 타임존 차이 방지를 위해 `now` 주입 권장.
 */
export function startOfWeekISO(now: Date = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + mondayOffset);
  return d.toISOString().slice(0, 10);
}

/**
 * 오늘(로컬 날짜) ISO 문자열 (YYYY-MM-DD).
 */
export function todayISO(now: Date = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * 세션 배열을 기준 시각 기준 "시간 범위별 집계 분"으로 접어서 반환.
 *
 * - todayMinutes       : 오늘 (로컬) 합
 * - weekMinutes        : 이번 주 (월 시작) 합
 * - totalMinutes       : 주어진 세션 배열 전체 합 (호출자가 전체를 넘겼을 때만 의미 있음)
 * - daysReadThisWeek   : 이번 주에 1분 이상 기록된 고유 날짜 수
 * - readDatesThisWeek  : 이번 주 읽은 날짜 ISO 문자열 집합 (캘린더 도장용)
 *
 * "1분 이상" 필터를 걸어서 실수로 눌렀다 바로 종료한 초단기 세션은 제외해요.
 */
export interface FocusStatsBreakdown {
  todayMinutes: number;
  weekMinutes: number;
  totalMinutes: number;
  daysReadThisWeek: number;
  readDatesThisWeek: Set<string>;
}

export function computeFocusStats(
  sessions: FocusSession[],
  now: Date = new Date(),
): FocusStatsBreakdown {
  const today = todayISO(now);
  const weekStart = startOfWeekISO(now);

  let todayMinutes = 0;
  let weekMinutes = 0;
  let totalMinutes = 0;
  const readDatesThisWeek = new Set<string>();

  for (const s of sessions) {
    if (!s.started_at) continue;
    if (s.duration_seconds < 60) continue;
    const mins = s.duration_seconds / 60;
    totalMinutes += mins;

    const iso = new Date(s.started_at).toISOString().slice(0, 10);
    if (iso === today) todayMinutes += mins;
    if (iso >= weekStart) {
      weekMinutes += mins;
      readDatesThisWeek.add(iso);
    }
  }

  return {
    todayMinutes: Math.round(todayMinutes),
    weekMinutes: Math.round(weekMinutes),
    totalMinutes: Math.round(totalMinutes),
    daysReadThisWeek: readDatesThisWeek.size,
    readDatesThisWeek,
  };
}

/**
 * 분 수치를 사람 친화적 문자열로 포맷.
 *   142  → "142분"
 *   392  → "6시간 32분"
 *   0    → "0분"
 */
export function formatMinutesHuman(min: number): string {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/**
 * ETA Date → "5월 11일" 형식.
 */
export function formatEtaDate(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
