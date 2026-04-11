/**
 * 유의미한 턴 판별
 * - 유저 메시지 중 실질적 토론 기여만 카운트
 * - AI 응답 품질도 체크하여 쌍으로 제외
 */

interface TurnMessage {
  role: "user" | "assistant";
  content: string;
}

const TRIVIAL_PATTERN =
  /^(네|응|ㅇㅇ|ㅋ+|ㅎ+|ok|ㅇㅋ|맞아|그래|음|흠|아|오|그렇구나|ㄴㄴ|ㄱㄱ|ㅇ|넹|넵|예|yes|yeah|yep|sure|right|그렇네|맞네|좋아|알겠어|그래서|아하|오호|헐)$/i;

const AI_ERROR_PATTERN =
  /^(죄송|sorry|오류|에러|error|다시 시도|잠시 후|문제가 발생|응답을 생성할 수 없|I apologize|I'm sorry)/i;

const MIN_USER_LENGTH = 5;

export const REQUIRED_MEANINGFUL_TURNS = 10;

export function countMeaningfulTurns(messages: TurnMessage[]): number {
  let count = 0;
  let prevUserContent = "";

  // AI 응답 중 문제가 있는 인덱스 수집
  const badAIIndices = new Set<number>();
  const seenAIContents = new Map<string, number>(); // content -> first index

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;

    const trimmed = msg.content.trim();

    // AI 에러 응답
    if (AI_ERROR_PATTERN.test(trimmed)) {
      badAIIndices.add(i);
      continue;
    }

    // AI 같은 응답 반복 (앞 30자로 비교)
    const key = trimmed.slice(0, 30);
    if (seenAIContents.has(key)) {
      badAIIndices.add(i);
    } else {
      seenAIContents.set(key, i);
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "user") continue;

    const trimmed = msg.content.trim();

    // 너무 짧은 메시지
    if (trimmed.length < MIN_USER_LENGTH) continue;

    // 단답/무의미 패턴
    if (TRIVIAL_PATTERN.test(trimmed)) continue;

    // 같은 말 반복
    if (trimmed === prevUserContent) continue;

    // 바로 다음 AI 응답이 불량이면 이 턴도 제외
    const nextAI = messages[i + 1];
    if (nextAI && nextAI.role === "assistant" && badAIIndices.has(i + 1)) {
      prevUserContent = trimmed;
      continue;
    }

    count++;
    prevUserContent = trimmed;
  }

  return count;
}
