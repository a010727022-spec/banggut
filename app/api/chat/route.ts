import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getApiUser } from "@/lib/supabase/api-auth";
import { PHASES } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "edge";

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}
function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
}
function getGenAI() {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
}

// --- 정보 요청 감지 ---

const INFO_REQUEST_PATTERNS = [
  /줄거리/,
  /등장인물|등장 인물|인물 누구|캐릭터/,
  /누가.*(나와|나오|등장)/,
  /내용이? ?(뭐|어때|어떤|무슨)/,
  /이 ?책 ?(뭐|어때|무슨|내용)/,
  /알려 ?줘|알려줘|설명해|설명 ?해/,
  /그 ?장면이? ?(뭐|어떤|무슨)/,
  /누구한테|뭐라고 했/,
  /배경이? ?(어디|언제|뭐)/,
  /작가가? ?(누구|어떤|뭐)/,
  /결말|끝|엔딩/,
  /요약해|정리해/,
  /주인공이? ?(누구|이름|뭐)/,
  /어떤 ?(이야기|책|소설)/,
];

function detectInfoRequest(lastUserMsg: string): { isInfoRequest: boolean; keywords: string[] } {
  const matched = INFO_REQUEST_PATTERNS.some((p) => p.test(lastUserMsg));
  if (!matched) return { isInfoRequest: false, keywords: [] };

  // 핵심 키워드 추출
  const keywords: string[] = [];
  if (/줄거리|내용|이야기|요약/.test(lastUserMsg)) keywords.push("줄거리");
  if (/등장인물|인물|캐릭터|주인공|누가|누구/.test(lastUserMsg)) keywords.push("등장인물");
  if (/배경|어디|언제|시대/.test(lastUserMsg)) keywords.push("배경");
  if (/결말|끝|엔딩/.test(lastUserMsg)) keywords.push("결말");
  if (/작가|저자/.test(lastUserMsg)) keywords.push("작가");
  if (/장면/.test(lastUserMsg)) keywords.push("장면");
  if (keywords.length === 0) keywords.push("상세정보");

  return { isInfoRequest: true, keywords };
}

// --- Gemini 실시간 검색 ---

async function liveSearchGemini(
  title: string,
  author: string | undefined,
  keywords: string[],
): Promise<string | null> {
  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const searchQuery = `${title} ${author || ""} ${keywords.join(" ")}`;
    const result = await model.generateContent(
      `"${title}"${author ? ` (${author})` : ""} 이 책에 대해 아래 정보를 검색해서 정리해주세요.

요청된 정보: ${keywords.join(", ")}
검색어: ${searchQuery}

⚠️ 오직 "${title}" 한 권에 대한 정보만.
⚠️ 확실하지 않으면 작성하지 마세요.
⚠️ 결말 스포일러 최소화.

자연스러운 한국어 문장으로 정리해주세요. 번호 매기지 말고, 독서토론에서 바로 활용할 수 있는 형태로.`,
    );

    return result.response.text() || null;
  } catch (err) {
    console.error("[chat] Live search Gemini error:", err);
    return null;
  }
}

// --- 프로바이더 설정 ---
const PROVIDERS = ["claude", "gemini", "openai"] as const;
type Provider = (typeof PROVIDERS)[number];

/**
 * 단계별 최적 모델 배정
 * - 탐색: Gemini — 빠르고 따뜻한 첫 대화, 한국어 자연스러움
 * - 심화: Claude — 깊은 문학 분석, 뉘앙스, 텍스트 정밀 읽기
 * - 연결: OpenAI — 개인 경험 연결, 사회적 맥락 확장
 * - 서평: Claude — 정리/요약, 서평 가이드
 */
function pickProvider(phase: string): Provider {
  switch (phase) {
    case "탐색": return "gemini";
    case "심화": return "claude";
    case "연결": return "openai";
    case "서평": return "claude";
    default: return "claude";
  }
}

// --- 시스템 프롬프트 v2 ---
const SYSTEM_PROMPT_TEMPLATE = `[페르소나]
당신은 '방긋'이라는 이름의 독서토론 파트너입니다.
이 책을 이미 읽은 동료로서, 유저와 깊이 있는 대화를 나눕니다.
따뜻하되 지적이고, 공감하되 도전적입니다.
말투: 한국어 존댓말, 2-4문장으로 짧게, 이모지는 가끔(📖 정도만)

책 정보: {bookInfo}
{quotesInfo}
{contextInfo}

[소크라테스 세미나 원칙 — 토론의 근간]
이 토론은 소크라테스 세미나 방법론을 따릅니다.
- 설득(debate)이 아니라 탐구(inquiry)
- 정답을 가르치는 것이 아니라 함께 발견하는 것
- 진행자는 질문하되, 답하지 않는다
- 모든 의견은 텍스트 근거로 뒷받침되어야 한다

[질문 설계 — 3단계 질문법]
토론의 깊이를 만드는 핵심은 질문의 종류입니다. 아래 순서로 자연스럽게 깊어지세요.

1단계: 사실적 질문 (Factual) — 최소한만, 워밍업용
답이 하나인 질문. 시험처럼 느껴지면 안 됨. 자연스러운 대화 속에서만.
예: "이 장면이 어디서 일어났죠?"

2단계: 해석적 질문 (Interpretive) — ★토론의 80%★
답이 여러 개이고, 텍스트 근거로 뒷받침할 수 있는 질문.
예: "진진이가 그런 선택을 한 이유가 뭘까요?"
예: "작가가 이 장면을 이 순서로 배치한 이유가 있을까요?"
예: "이 인물의 행동을 이기적이라고 볼 수도 있고, 자기 보호라고 볼 수도 있는데, 어떻게 보세요?"

3단계: 평가적 질문 (Evaluative) — 개인 연결
독자 자신의 경험, 가치관, 세계관과 연결하는 질문.
예: "당신이라면 어떻게 했을 것 같아요?"
예: "이 이야기가 지금 우리 사회와 닮은 부분이 있나요?"
예: "이 책을 읽고 나서 달라진 생각이 있어요?"

[이 책에 대한 내 지식]
{bookContextSection}

[정보 오염 방지 — 최우선 규칙]
현재 토론 책: {bookInfo}
이 책의 정보만 사용하세요.
- 같은 작가의 다른 작품 정보를 이 책인 것처럼 말하지 마세요.
- 확실하지 않으면 유저가 말한 내용을 기반으로 대화하세요.
- 제목에서 유추해서 내용을 지어내지 마세요.

[책 정보 사용 규칙]
★ 유저가 물어보면 → 아는 것 총동원해서 알려줘
★ 유저가 안 물어보면 → 먼저 꺼내지 마

■ 유저가 줄거리/인물/배경 등을 물어볼 때:
→ [이 책에 대한 내 지식]에 있으면 자신있게 정리해서 알려주세요.
→ 내 지식에 없어도 웹 서평/독자 반응에 있으면 그걸 기반으로 알려주세요.
→ 절대 "모른다", "확인이 어렵다", "당신이 먼저 말해주세요" 금지.
→ 유저가 다르게 말하면 즉시 유저를 따르세요. "아 맞다!" 한마디로 자연스럽게 수정.
→ 유저가 실제로 읽은 사람이므로 유저의 사실 정보가 항상 우선합니다.

■ 유저가 요청하지 않았을 때:
→ 줄거리를 먼저 요약하지 마세요.
→ 결말을 스포일러하지 마세요.
→ 인물 이름은 유저가 먼저 꺼낸 후에 사용하세요.
→ 유저가 모호하게 말하면 → "혹시 XX가 YY하는 장면 말씀이세요?" 식으로 짚어주는 건 OK.

[토론 방식 자동 전환 — 유저에게 모드를 알리지 마세요]

■ 소크라테스 (기본)
트리거: 유저가 의견이나 해석을 말할 때
행동: "왜 그렇게 생각하세요?", "그렇다면 이 장면은 어떻게 설명되나요?"
핵심: 답을 주지 않고 질문으로 스스로 깨닫게 하기

■ 악마의 변호인
트리거: 유저가 확신에 찬 해석을 할 때
행동: "흥미로운데, 반대로 보면 어떨까요?", "다른 독자는 이걸 OO로 읽기도 하던데요"
핵심: 정중하지만 날카롭게. 유저의 논리를 단련시키기

■ 관점 역할극
트리거: 특정 인물이나 저자가 언급될 때
행동: "만약 이 인물의 입장이라면...", "작가가 이 장면을 쓸 때 어떤 마음이었을까요?"
핵심: 다른 시점을 경험하게 하기

■ 정리자
트리거: 유저가 혼란스러워하거나 생각이 흩어질 때
행동: "지금까지 말씀하신 걸 정리해보면, 크게 세 가지 관점이 있네요..."
핵심: 구조화해주되, 결론은 유저가 내리게 하기

■ 하브루타
트리거: 토론이 깊어지고 논리적 검증이 필요할 때
행동: 유저의 주장에 질문 → 유저 답변에 반박 → 다시 유저에게 반박 기회
핵심: 서로의 논리를 날카롭게 검증하되 존중 유지

■ 감정 탐색
트리거: 유저가 감정을 표현하거나, 개인적 경험을 꺼낼 때
행동: "그 장면에서 어떤 감정이 올라왔어요?", "그 경험이 이 책을 읽는 데 어떤 영향을 줬나요?"
핵심: 바로 다음 질문으로 넘어가지 말고 잠시 머물러주기. 감정을 충분히 표현하게 한 후에 해석으로 연결

{topicMapSection}

[대화 층위 체크리스트 — 내부 추적용]
대화하면서 아래 층위들을 내부적으로 추적하세요. 자연스러운 타이밍에 안 다룬 층위로 이끌어주세요.
⬜ 감정/첫인상 — "어떤 감정이 들었어요?"
⬜ 인물 분석 — "어떤 인물이 가장 기억에 남아요?"
⬜ 인물 간 관계 — "두 사람의 관계를 어떻게 봤어요?"
⬜ 갈등/긴장 — "가장 긴장되는 부분은 어디였어요?"
⬜ 사회적 맥락 — "이 이야기의 배경이 왜 중요할까요?"
⬜ 개인 연결 — "본인 경험과 겹치는 부분이 있었나요?"
⬜ 작가 의도/문학적 장치 — "작가가 왜 이렇게 썼을까요?"
⬜ 반론/다른 시각 — "반대로 보면 어떨까요?"

[주제 다양성 규칙]
- 같은 주제를 5턴 연속으로 파지 마세요. 5턴째에 자연스럽게 전환: "그런데 이 책에서 OO 부분은 어떻게 읽으셨어요?"
- 전체 토론에서 최소 3개 주제는 다뤄야 합니다.
- 주제 지도와 대화 층위를 참고해서, 안 다룬 갈래가 있으면 자연스러운 타이밍에 분기하세요.

[사고 변화 추적 — 메타인지]
유저의 입장이 토론 중에 변하면 반드시 짚어주세요. 이것이 토론의 가장 가치 있는 순간입니다.
예: "처음에는 이 인물이 이기적이라고 하셨는데, 지금은 '자기 보호'에 가깝다고 보시는 것 같아요. 뭐가 생각을 바꾸게 했어요?"

[글귀(스크랩) 활용]
밑줄 친 글귀가 있으면 토론 중 자연스러운 타이밍에 연결하세요.
예: "아까 밑줄 치신 '서로를 비춰주는 사람'이라는 문장이 지금 이야기랑 연결되는 것 같아요."
- 글귀를 강제로 끌어오지 마세요. 맥락이 맞을 때만.
- "이 문장에 왜 밑줄 치셨어요?"는 매우 좋은 해석적 질문입니다.

[다른 독자 관점 활용]
X(트위터)나 서평에서 수집한 다른 독자들의 반응이 있으면 활용하세요.
✅ "어떤 독자는 이 결말을 희망적이라고 읽었고, 어떤 독자는 오히려 씁쓸하다고 하던데, 당신은 어느 쪽이에요?"
❌ "대부분의 독자들은 이걸 OO으로 해석합니다." (다수결이 정답은 아님)

[행동 규칙]
■ 해석 확정 금지
❌ "정말 아름다운 해석이에요!" → 대화 종료됨
❌ "이전 세대는 어쩔 수 없이 맺어진 연대였다면..." → 단정
✅ "흥미로운데, 반대로 보면 어떨까요?" → 대화 계속
✅ "그렇게 볼 수도 있겠네요. 그러면 이 장면은?" → 깊어짐

■ 감정 처리
유저가 개인적 아픔을 꺼내면 (이혼, 가족, 트라우마):
→ 바로 다음 질문으로 넘어가지 마세요
→ "그 경험이 이 책을 읽는 데 어떤 영향을 줬나요?" 로 잠시 머물러주기
→ 충분히 표현한 후에 다시 텍스트로 돌아가기

■ 칭찬 절제
→ 매 턴 "좋은 지적이에요!" 하지 마세요. 앵무새 같음.
→ 진짜 인상적인 순간에만 짧게: "와, 그건 생각 못 했네요."
→ 칭찬보다 후속 질문이 더 좋은 반응입니다.

■ 텍스트 근거 유도
유저가 의견만 말하고 근거가 없으면:
"그 생각의 바탕이 된 장면이 있어요? 어떤 부분에서 그렇게 느끼셨어요?"
강제가 아니라 자연스러운 유도.

[토론 마무리]
- 유저가 "오늘은 여기까지" 같은 신호를 보내면 정리 모드로 전환.
- 20턴 넘어가면: "오늘 이야기 많이 나눴는데, 한번 정리해볼까요?"
- 강제 종료 금지. 유저가 더 하고 싶으면 계속.
- 마무리 발언: "오늘 토론에서 제가 가장 인상 깊었던 건 '[유저의 인상적 발언]'이었어요. 혹시 이 대화를 서평으로 정리해보고 싶으시면 오른쪽 위 ✍️ 버튼을 눌러보세요!"

현재 단계: {phase}

{phaseInstruction}`;


// --- 프로바이더별 스트리밍 ---

async function streamClaude(
  systemPrompt: string,
  msgs: { role: string; content: string }[],
): Promise<ReadableStream> {
  const stream = await getAnthropic().messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages: msgs.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

async function streamOpenAI(
  systemPrompt: string,
  msgs: { role: string; content: string }[],
): Promise<ReadableStream> {
  const stream = await getOpenAI().chat.completions.create({
    model: "gpt-5.2",
    max_tokens: 1024,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      ...msgs.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
  });

  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

async function streamGemini(
  systemPrompt: string,
  msgs: { role: string; content: string }[],
): Promise<ReadableStream> {
  const model = getGenAI().getGenerativeModel({
    model: "gemini-3.0-flash",
    systemInstruction: systemPrompt,
  });

  // Gemini 형식: user/model 번갈아
  const history = msgs.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const lastMsg = msgs[msgs.length - 1].content;

  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(lastMsg);

  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

// --- 메인 핸들러 ---

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { success } = rateLimit(`chat:${user.id}`, 15);
  if (!success) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  const body = await req.json();
  const { bookInfo, messages, phase, underlines, bookContext, topicMap, greeting, bookContextData } = body;

  // greeting 모드: 메시지 없이 AI가 먼저 말하기
  if (greeting && (!Array.isArray(messages) || messages.length === 0)) {
    // greeting 전용 — messages 빈 배열 허용
  } else if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) {
    return new Response(JSON.stringify({ error: "messages: 1~100개 필요" }), { status: 400 });
  }

  const quotesInfo = underlines?.length
    ? `\n밑줄 친 글귀:\n${underlines.map((u: { text: string }) => `- "${u.text}"`).join("\n")}`
    : "";

  const contextInfo = bookContext
    ? `\n책 배경 정보:\n${bookContext}`
    : "";

  let topicMapSection = "";
  if (topicMap?.confidence === "high" && topicMap.topics?.length > 0) {
    const topicList = topicMap.topics.map((t: string) => `- ⬜ ${t}`).join("\n");
    topicMapSection = `[이 책의 주제 지도 — 내부 추적용]\n아래는 이 책에서 다룰 수 있는 핵심 주제들입니다. 대화하면서 어떤 주제를 다뤘는지 내부적으로 추적하고, 아직 안 다룬 주제가 있으면 자연스러운 타이밍에 꺼내세요.\n${topicList}`;
  } else {
    topicMapSection = `[주제 지도 없음]\n이 책의 사전 주제 지도가 없습니다. 유저와의 대화를 통해 주제를 발견해나가세요. 대화 층위 체크리스트를 적극 활용하세요.`;
  }

  // bookContextData: 신뢰도별 책 정보
  let bookContextSection = "(이 책에 대한 사전 정보가 없습니다. 유저의 설명을 바탕으로 대화하세요. 모르는 척하지 말되, 내용을 지어내지도 마세요.)";
  if (bookContextData?.known) {
    const h = bookContextData.high || {};
    const m = bookContextData.medium || {};
    const interps = bookContextData.interpretations || [];
    const scenes = bookContextData.key_scenes || [];
    const hooks = bookContextData.discussion_hooks || [];
    const authorIntent = bookContextData.author_intent;
    const parts: string[] = [];

    // 기본 정보
    if (h.author || h.year || h.genre) {
      let line = `저자: ${h.author || "?"}, 출간: ${h.year || "?"}, 장르: ${h.genre || "?"}`;
      if (h.publisher) line += `, 출판사: ${h.publisher}`;
      if (h.awards) line += `\n수상: ${h.awards}`;
      if (h.author_note) line += `\n작가: ${h.author_note}`;
      parts.push(`[기본 정보 — 자유롭게 사용]\n${line}`);
    }

    // 등장인물 & 배경
    if (m.characters?.length || m.setting) {
      const charLines = (m.characters || []).map((c: { name: string; desc: string; relations?: string } | string) => {
        if (typeof c === "string") return `- ${c}`;
        return `- ${c.name}: ${c.desc}${c.relations ? ` (${c.relations})` : ""}`;
      }).join("\n");
      let section = `[등장인물 & 배경 — 자신있게 사용, 유저가 다르게 말하면 즉시 수정]`;
      if (charLines) section += `\n${charLines}`;
      if (m.setting) section += `\n배경: ${m.setting}`;
      if (m.narrative) section += `\n서술: ${m.narrative}`;
      parts.push(section);
    }

    // 다양한 해석 (서평 기반)
    if (interps.length > 0) {
      parts.push(`[독자들의 다양한 해석 — 관점으로 활용, 정답처럼 말하지 않기]\n${interps.map((i: string) => `- ${i}`).join("\n")}`);
    }

    // 인상적인 장면
    if (scenes.length > 0) {
      parts.push(`[독자들이 자주 언급하는 장면 — 유저가 관련 이야기를 하면 활용]\n${scenes.map((s: string) => `- ${s}`).join("\n")}`);
    }

    // 토론 질문
    if (hooks.length > 0) {
      parts.push(`[토론 질문 후보 — 자연스러운 타이밍에 활용]\n${hooks.map((q: string) => `- ${q}`).join("\n")}`);
    }

    // 작가 의도
    if (authorIntent) {
      parts.push(`[작가의 말 — 참고용, 유저에게 강요하지 않기]\n${authorIntent}`);
    }

    // 웹 서평 요약 (Gemini 웹 검색 결과)
    const webReviews = bookContextData.web_reviews;
    if (webReviews?.summary) {
      const webParts: string[] = [`서평 요약: ${webReviews.summary}`];
      if (webReviews.controversial_points?.length) {
        webParts.push(`의견이 갈리는 포인트:\n${webReviews.controversial_points.map((p: string) => `- ${p}`).join("\n")}`);
      }
      if (webReviews.recommended_for) {
        webParts.push(`추천 독자층: ${webReviews.recommended_for}`);
      }
      if (webReviews.similar_books?.length) {
        webParts.push(`비교되는 작품: ${webReviews.similar_books.join(", ")}`);
      }
      parts.push(`[웹 서평 — "다른 서평에서는~" 식으로 자연스럽게 활용]\n${webParts.join("\n")}`);
    }

    // X(트위터) 독자 반응 (Grok 결과)
    const readerVoices = bookContextData.reader_voices;
    if (readerVoices?.reactions?.length) {
      const reactionLines = readerVoices.reactions
        .slice(0, 5)
        .map((r: { sentiment: string; summary: string; quote?: string }) => {
          const emoji = r.sentiment === "positive" ? "👍" : r.sentiment === "negative" ? "👎" : "🤔";
          return `${emoji} ${r.summary}${r.quote ? ` — "${r.quote}"` : ""}`;
        })
        .join("\n");
      const voiceParts: string[] = [reactionLines];
      if (readerVoices.overall_sentiment) {
        voiceParts.push(`전반적 반응: ${readerVoices.overall_sentiment}`);
      }
      if (readerVoices.trending_topics?.length) {
        voiceParts.push(`화제 키워드: ${readerVoices.trending_topics.join(", ")}`);
      }
      parts.push(`[실제 독자들의 목소리 (X/SNS) — "SNS에서 이런 반응도 있던데~" 식으로 대화 소재로 활용]\n${voiceParts.join("\n")}`);
    }

    bookContextSection = parts.join("\n\n");
  }

  const currentPhase = PHASES.find((p) => p.label === phase) || PHASES[0];
  let systemPrompt = SYSTEM_PROMPT_TEMPLATE
    .replace("{bookInfo}", bookInfo || "미입력")
    .replace("{quotesInfo}", quotesInfo)
    .replace("{contextInfo}", contextInfo)
    .replace("{bookContextSection}", bookContextSection)
    .replace("{topicMapSection}", topicMapSection)
    .replace("{phase}", `${currentPhase.icon} ${currentPhase.label} — ${currentPhase.description}`)
    .replace("{phaseInstruction}", currentPhase.guide);

  // greeting 모드: AI가 먼저 인사
  let chatMessages = messages || [];
  const bookKnown = bookContextData?.known;

  if (greeting === "start") {
    const hasQuotes = underlines?.length > 0;
    let greetingInstruction: string;

    if (hasQuotes) {
      // 글귀가 있을 때
      greetingInstruction = `\n\n[첫 인사 — 지금 바로 실행]
구조: 1줄 책이름+환영, 2줄 글귀 연결, 3줄 열린 질문
독자가 밑줄 친 첫 번째 글귀: "${underlines[0].text}"

예시 톤:
"[책제목] 함께 이야기할 수 있어서 좋아요. 📖
밑줄 치신 문장 중에 '[글귀]'가 눈에 띄네요.
이 문장에 밑줄 친 순간, 어떤 마음이었어요?"

금지: "안녕하세요! 반갑습니다!" (로봇), 줄거리 요약, "이 책의 주제가 뭐라고 생각하세요?" (시험)`;
    } else if (!bookKnown) {
      // 잘 모르는 책
      greetingInstruction = `\n\n[첫 인사 — 지금 바로 실행]
구조: 1줄 책이름+환영, 2줄 읽게 된 계기 질문, 3줄 대안 질문

예시 톤:
"[책제목]을 선택하셨군요! 📖
이 책을 읽게 된 계기가 있었나요?
아니면 바로 첫인상부터 이야기해볼까요?"

금지: "안녕하세요! 반갑습니다!" (로봇), 줄거리 요약, "이 책의 주제가 뭐라고 생각하세요?" (시험)`;
    } else {
      // 글귀 없이 시작 (책은 아는 경우)
      greetingInstruction = `\n\n[첫 인사 — 지금 바로 실행]
구조: 1줄 책이름+환영, 2줄 읽기 상태 질문, 3줄 부담 없는 감정/장면 질문

예시 톤:
"[책제목] 함께 이야기해봐요. 📖
어디까지 읽으셨어요? 다 읽으셨든, 읽는 중이든 상관없이
지금 머릿속에 남아있는 장면이나 느낌부터 들려주세요."

금지: "안녕하세요! 반갑습니다!" (로봇), 줄거리 요약, "이 책의 주제가 뭐라고 생각하세요?" (시험)`;
    }

    systemPrompt += greetingInstruction;
    chatMessages = [{ role: "user", content: "토론을 시작합니다." }];
  } else if (greeting === "resume") {
    const lastUserMsg = [...(messages || [])].reverse().find((m: { role: string }) => m.role === "user");
    const lastTopic = lastUserMsg ? `지난 대화의 마지막 유저 메시지: "${(lastUserMsg as { content: string }).content}"` : "";
    systemPrompt += `\n\n[이어서 토론 — 지금 바로 실행]
${lastTopic}

예시 톤:
"다시 만나서 반가워요! 📖
지난번에 [이전 토론 마지막 주제] 이야기를 하다 멈췄었는데,
그 뒤로 더 읽으셨나요? 아니면 그 주제를 더 파볼까요?"

금지: "안녕하세요! 반갑습니다!" (로봇), 줄거리 요약`;
    chatMessages = [...(messages || []), { role: "user", content: "이어서 토론합니다." }];
  }

  // --- 실시간 정보 요청 감지 ---
  const lastUserMessage = !greeting && chatMessages.length > 0
    ? chatMessages[chatMessages.length - 1]?.content || ""
    : "";
  const { isInfoRequest, keywords } = !greeting
    ? detectInfoRequest(lastUserMessage)
    : { isInfoRequest: false, keywords: [] as string[] };

  // bookInfo에서 title/author 추출
  const titleMatch = (bookInfo || "").match(/제목:\s*(.+?)(?:,|$)/);
  const authorMatch = (bookInfo || "").match(/저자:\s*(.+?)(?:,|$)/);
  const bookTitle = titleMatch?.[1]?.trim() || "";
  const bookAuthor = authorMatch?.[1]?.trim();

  // 실시간 검색이 필요한 3가지 경우:
  // 1. 유저가 정보를 명시적으로 요청 (줄거리, 등장인물 등)
  // 2. 컨텍스트가 아예 없는 상태에서 토론 진행
  // 3. 컨텍스트는 있지만 유저 질문에 관련된 세부 정보가 부족할 수 있을 때
  const hasContext = !!bookContextData?.known;
  const contextIsThin = hasContext && !(bookContextData.medium?.characters?.length > 0);
  const needsLiveSearch = bookTitle && (
    (isInfoRequest) ||                     // 정보 명시 요청 → 항상 검색
    (!hasContext && !greeting) ||           // 컨텍스트 없이 토론 진행
    (contextIsThin && !greeting)            // 컨텍스트 얕으면 보강 검색
  );

  // 단계별 최적 프로바이더 선택
  const provider = pickProvider(phase);
  // 정보 요청 or 컨텍스트 부족 시 Claude 고정
  const effectiveProvider = (isInfoRequest || !hasContext) ? "claude" as Provider : provider;

  const encoder = new TextEncoder();

  // SSE 연결을 즉시 열고, 스트림 안에서 검색 → AI 응답 순서로 처리
  const readable = new ReadableStream({
    async start(controller) {
      try {
        let finalSystemPrompt = systemPrompt;

        // --- 실시간 검색 (SSE 안에서 실행) ---
        if (needsLiveSearch) {
          // 1. 즉시 "검색 중" 알림 → 유저가 바로 "잠깐, 정리해볼게요..." 볼 수 있음
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ searching: true })}\n\n`));

          // 2. Gemini 검색 (2-3초)
          const searchKeywords = isInfoRequest ? keywords : ["줄거리", "등장인물", "주제"];
          const liveResult = await liveSearchGemini(bookTitle, bookAuthor, searchKeywords);

          // 3. 검색 완료 알림
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ searching: false })}\n\n`));

          // 4. 검색 결과를 시스템 프롬프트에 주입
          if (liveResult) {
            if (isInfoRequest) {
              finalSystemPrompt += `\n\n[실시간 검색 결과 — 방금 검색한 정보]
유저가 "${searchKeywords.join(", ")}"에 대해 물어봤습니다.
아래 정보를 활용해 자신있게 답변하세요. 절대 "모른다"고 하지 마세요.
자연스러운 독서토론 파트너답게 정리해서 알려주세요.

${liveResult}`;
            } else {
              finalSystemPrompt += `\n\n[보충 검색 결과 — 배경 지식으로 활용]
아래 정보가 이 책에 대해 검색된 내용입니다. 유저가 물어보면 활용하되, 먼저 꺼내지는 마세요.

${liveResult}`;
            }
          }
        } else if (isInfoRequest) {
          // 검색 불필요하지만 정보 요청 → 컨텍스트 총동원 강조
          finalSystemPrompt += `\n\n[정보 요청 감지]
유저가 "${keywords.join(", ")}"에 대해 물어보고 있습니다.
위 [이 책에 대한 내 지식]의 정보를 총동원해서 자신있게 답변하세요.
절대 "모른다", "확인이 어렵다"라고 하지 마세요.
자연스럽게: "제가 기억하기론..." 식으로 시작해도 OK.`;
        }

        // --- AI 스트리밍 (프로바이더 폴백) ---
        const streamFns: Record<Provider, () => Promise<ReadableStream>> = {
          claude: () => streamClaude(finalSystemPrompt, chatMessages),
          openai: () => streamOpenAI(finalSystemPrompt, chatMessages),
          gemini: () => streamGemini(finalSystemPrompt, chatMessages),
        };

        const order = [effectiveProvider, ...PROVIDERS.filter((p) => p !== effectiveProvider)];
        let aiStream: ReadableStream | null = null;

        for (const p of order) {
          try {
            aiStream = await streamFns[p]();
            break;
          } catch (err) {
            console.error(`[chat] ${p} failed:`, err);
          }
        }

        if (!aiStream) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "모든 AI 서비스에 연결할 수 없습니다" })}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        // AI 스트림을 SSE로 전달
        const reader = aiStream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (err) {
        console.error("[chat] Stream error:", err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "스트림 오류" })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
