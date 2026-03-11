/**
 * 인메모리 Rate Limiter (sliding window)
 * Vercel serverless/edge 환경에서 인스턴스당 동작.
 * 프로덕션에서 더 정밀한 제한이 필요하면 Upstash Redis로 교체.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// 5분마다 만료된 항목 정리
setInterval(() => {
  const now = Date.now();
  store.forEach((entry, key) => {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 60_000);
    if (entry.timestamps.length === 0) store.delete(key);
  });
}, 300_000);

/**
 * @param key 유저 식별자 (userId 또는 IP)
 * @param limit 윈도우당 최대 요청 수
 * @param windowMs 윈도우 크기 (ms), 기본 60초
 * @returns { success, remaining, resetMs }
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs = 60_000
): { success: boolean; remaining: number } {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // 윈도우 밖 타임스탬프 제거
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.timestamps.push(now);
  return { success: true, remaining: limit - entry.timestamps.length };
}
