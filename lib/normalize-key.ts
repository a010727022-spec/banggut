/**
 * 캐시 키 생성용 문자열 정규화.
 * 공백/구두점/괄호 제거 + 소문자화.
 * "밝은 밤" = " 밝은 밤 " = "밝은-밤" 모두 같은 키로 매칭.
 */
export function normalizeKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[()（）[\]「」『』《》〈〉""'']/g, "")
    .replace(/\s*:\s*/g, " ")
    .replace(/[.,·\-–—_]/g, "")
    .trim();
}
