/**
 * 방긋 Analytics — PostHog 이벤트 트래킹 유틸
 * Sophie(데이터) 설계, Dave(백엔드) 구현
 *
 * 핵심 퍼널:
 *   가입 → 온보딩 취향 → 프로필 → 첫 책 추가 → 첫 토론 → 서평 완성 → 공유
 */

import posthog from "posthog-js";

/* ── 이벤트 이름 상수 ── */
export const EVENTS = {
  // 온보딩
  SIGNUP_STARTED: "signup_started",
  SIGNUP_COMPLETED: "signup_completed",
  ONBOARDING_TASTE_Q1: "onboarding_taste_genre",
  ONBOARDING_TASTE_Q2: "onboarding_taste_frequency",
  ONBOARDING_TASTE_Q3: "onboarding_taste_style",
  ONBOARDING_PROFILE_DONE: "onboarding_profile_completed",

  // 핵심 액션
  BOOK_SEARCHED: "book_searched",
  BOOK_ADDED: "book_added",
  DISCUSSION_MESSAGE_SENT: "discussion_message_sent",
  DISCUSSION_STARTED: "discussion_started",
  UNDERLINE_ADDED: "underline_added",
  SCRAP_SAVED: "scrap_saved",

  // 서평
  REVIEW_SAVED: "review_saved",
  REVIEW_SHARED: "review_shared",

  // 리텐션
  APP_OPENED: "app_opened",
  THEME_CHANGED: "theme_changed",
  GROUP_JOINED: "group_joined",
} as const;

/* ── 안전한 캡처 래퍼 (PostHog 미초기화 시 무시) ── */
export function track(
  event: string,
  properties?: Record<string, unknown>,
) {
  try {
    if (typeof window !== "undefined" && posthog.__loaded) {
      posthog.capture(event, properties);
    }
  } catch {
    // 분석 실패가 앱을 깨뜨리면 안 됨
  }
}

/* ── 유저 식별 ── */
export function identifyUser(
  userId: string,
  traits?: Record<string, unknown>,
) {
  try {
    if (typeof window !== "undefined" && posthog.__loaded) {
      posthog.identify(userId, traits);
    }
  } catch {
    // silent
  }
}

/* ── 유저 리셋 (로그아웃) ── */
export function resetAnalytics() {
  try {
    if (typeof window !== "undefined" && posthog.__loaded) {
      posthog.reset();
    }
  } catch {
    // silent
  }
}
