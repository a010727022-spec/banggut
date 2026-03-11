import { createClient } from "@/lib/supabase/client";

/**
 * 401 응답 시 세션을 갱신하고 한 번 재시도하는 fetch 래퍼.
 * 캐시된 페이지에서 만료된 토큰으로 API 호출 시 자동 복구.
 */
export async function fetchWithAuth(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const res = await fetch(url, options);

  if (res.status === 401) {
    // 세션 갱신 시도
    const supabase = createClient();
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      // 갱신 실패 → 원래 401 반환
      return res;
    }
    // 갱신 성공 → 재시도 (새 쿠키가 자동으로 포함됨)
    return fetch(url, options);
  }

  return res;
}
