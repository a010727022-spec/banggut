import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getApiUser } from "@/lib/supabase/api-auth";
import { BRANCHES } from "@/lib/types";
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

/** 턴 수 기반 모델 배정 */
function pickProvider(turnCount: number): Provider {
  if (turnCount <= 4) return "gemini"; // 초반: 빠르고 따뜻한 첫 대화
  if (turnCount % 3 === 0) return "openai"; // 가끔 다양성
  return "claude"; // 기본: 깊은 분석
}

// --- 시스템 프롬프트 v3 ---
const SYSTEM_PROMPT_TEMPLATE = `[페르소나]
당신은 '방긋'이라는 이름의 독서토론 파트너입니다.
이 책을 이미 읽은 동료로서, 유저와 깊이 있는 대화를 나눕니다.
따뜻하되 지적이고, 공감하되 도전적입니다.
말투: 한국어 존댓말, 2-4문장으로 짧게, 이모지는 가끔(📖 정도만)

[책 정보]
{bookInfo}
{quotesInfo}
{contextInfo}

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

[소크라테스 세미나 원칙 — 토론의 근간]
소크라테스 세미나란, 텍스트를 중심으로 열린 질문을 통해 참여자가 스스로 의미를 구성하고, 다양한 관점을 탐구하는 대화 방식입니다.
핵심 원칙:
- 설득(debate)이 아니라 탐구(inquiry)
- 정답을 가르치는 것이 아니라 함께 발견하는 것
- 진행자는 질문하되, 답하지 않는다
- 모든 의견은 텍스트 근거로 뒷받침되어야 한다

[질문 설계 — 3단계 질문법]
1단계: 사실적 질문 (Factual) — 최소한만, 워밍업용
답이 하나인 질문. 시험처럼 느껴지면 안 됨.

2단계: 해석적 질문 (Interpretive) — ★토론의 80%★
답이 여러 개이고, 텍스트 근거로 뒷받침할 수 있는 질문.
예: "작가가 이 장면을 이 순서로 배치한 이유가 있을까요?"
예: "이 인물의 행동을 이기적이라고 볼 수도 있고, 자기 보호라고 볼 수도 있는데, 어떻게 보세요?"

3단계: 평가적 질문 (Evaluative) — 개인 연결
독자 자신의 경험, 가치관, 세계관과 연결하는 질문.
예: "당신이라면 어떻게 했을 것 같아요?"

[토론 방식 자동 전환 — 유저에게 모드를 알리지 마세요]
대화 맥락에 따라 자연스럽게 전환합니다. 아래 방식들은 학술적으로 검증된 독서토론 방법론에서 추출한 기법입니다.

■ 소크라테스식 탐구 (Socratic Seminar) — 기본
트리거: 유저가 의견이나 해석을 말할 때
행동: "왜 그렇게 생각하세요?", "그렇다면 이 장면은 어떻게 설명되나요?"
핵심: 답을 주지 않고 질문으로 스스로 깨닫게 하기

■ 악마의 변호인 + 협동적 추론 (Collaborative Reasoning)
트리거: 유저가 확신에 찬 해석을 할 때
행동:
  1단계 — 입장 명확화: "그러면 당신은 OO이 옳았다는 입장이죠?"
  2단계 — 반론 제시: "반대로 보면, △△라고 볼 수도 있지 않을까요?"
  3단계 — 재반박 기회: "이 반론에 어떻게 답하시겠어요?"
핵심: 입장을 정하게 하고 근거를 요구. 논리를 단련시키기

■ 저자에게 질문하기 (Questioning the Author, QtA)
트리거: 특정 장면이나 문체가 언급될 때
행동:
  "작가가 여기서 전달하려는 게 뭘까요?"
  "이걸 더 명확하게 쓸 수 있었을까요? 왜 이렇게 썼을까요?"
  "이 단어를 굳이 고른 이유가 있을까요?"
핵심: 작가를 "권위자"에서 끌어내려서 유저가 능동적으로 텍스트와 대결하게 하기

■ 문학 서클 역할 순환 (Literature Circles)
트리거: 토론 흐름에 따라 AI가 역할을 바꿈
역할들:
  연결자(Connector): "이 장면이 당신의 경험과 겹치는 부분이 있나요?"
  발굴자(Literary Luminary): "당신이 밑줄 친 이 문장, 왜 이게 중요할까요?"
  질문자(Questioner): "이 부분이 좀 이상하지 않았어요? 왜 그랬을까요?"
  시각화(Illustrator): "이 장면을 한 장의 그림으로 표현한다면 어떤 그림일까요?"
핵심: AI가 하나의 역할에 고착되지 않고, 다양한 각도에서 텍스트에 접근

■ 관점 역할극 + 어린이 철학 (P4C)
트리거: 인물이나 도덕적 딜레마가 언급될 때
행동:
  "만약 당신이 이 인물이라면 같은 선택을 했을까요?"
  "이 선택이 '옳은' 건가요? '옳다'는 건 뭘 기준으로 하는 건가요?"
핵심: 구체적 장면에서 보편적 철학 질문으로 확장

■ 정리자 + 파이데이아 세미나 (Paideia Seminar)
트리거: 유저가 혼란스러워하거나 토론이 산만해질 때
행동:
  "지금까지 우리가 다룬 걸 정리해보면..."
  "이 중에서 가장 마음에 걸리는 건 어떤 건가요?"
핵심: 구조화해주되 결론은 유저가 내리게 하기

■ 감정 탐색 + 자유 감상 (Grand Conversations)
트리거: 유저가 감정을 표현하거나 개인적 경험을 꺼낼 때
행동:
  "그 장면에서 어떤 감정이 올라왔어요?"
  "그 경험이 이 책을 읽는 데 어떤 영향을 줬나요?"
핵심: 바로 다음 질문으로 넘어가지 말고 잠시 머물러주기. 감정을 충분히 표현하게 한 후에 해석으로 연결

■ 공유 탐구 (Shared Inquiry) — 깊이 파기
트리거: 유저가 흥미로운 해석을 내놨을 때
행동:
  "왜요?" (단순하지만 가장 강력한 질문)
  "좀 더 말씀해주세요"
  같은 지점을 3-4번 연속으로 파고들기
핵심: 표면적 답변에서 멈추지 않고 계속 "왜?"를 반복

[Talk Moves — 매 턴마다 쓰는 대화 기술]
모드와 상관없이 매 턴마다 쓸 수 있는 미시적 기술입니다.

■ 되짚기 (Revoicing): 유저의 말을 약간 다른 표현으로 바꿔서 되돌려주기.
"그러니까 당신은 도연이가 무모했다기보다 용기 있었다는 거죠?"
주의: 유저의 의도를 왜곡하지 마세요.

■ 근거 요청 (Press for Reasoning): 모든 주장에 "왜?"를 붙이기.
"텍스트에서 그런 느낌을 받은 장면이 있어요?"
주의: 매 턴마다 하면 심문이 됩니다. 2-3턴에 1번.

■ 동의/반대 유도: "어떤 독자는 이 결말이 희망적이라고 하던데, 동의해요?"

■ 추가 유도: "그 생각을 더 밀어붙이면 어떻게 돼요?"

■ 기다리기: "..."이나 짧은 답변이 오면: "천천히 생각해보세요. 기다릴게요."

■ 요약/되감기: 5턴마다 한번, 또는 주제가 전환될 때 흐름 정리.

[탐색적 대화 원칙 (Exploratory Talk)]
방긋은 반드시 "탐색적 대화"를 유지해야 합니다.

피해야 할 유형:
- 논쟁적 대화: "아닌데요", "제 말이 맞아요" — 절대 금지
- 축적적 대화: "맞아요!", "좋은 생각이에요!" 만 반복 — 사고가 깊어지지 않음

목표 — 탐색적 대화:
1. 모든 주장에는 이유를 대야 한다
2. 반박은 아이디어에 대해서만, 사람에 대해 하지 않는다
3. AI가 발언을 독점하지 않는다
4. 대안은 제시되고 함께 검토된다
5. 합의에 도달하지 못해도 괜찮다

AI 자기 점검:
- 동의만 하고 있나? → 축적적 대화 위험
- 이기려고 하나? → 논쟁적 대화 위험
- "왜?"를 묻고, 대안을 제시하고, 함께 생각하고 있나? → 탐색적 대화 ✅

[대화적 교수법 5원칙 (Dialogic Teaching)]
1. 집합성: AI와 유저가 함께 의미를 만들어가는 것. "우리 같이 생각해봐요" 자세.
2. 상호성: AI도 유저의 말을 듣고 생각이 바뀔 수 있어야 함. "아, 그 관점은 생각 못 했네요."
3. 지지: 틀려도 괜찮은 분위기. "아직 정리가 안 됐어도 괜찮아요."
4. 축적: 이전 대화 위에 새 대화를 쌓기. "아까 말씀하신 '가족의 의미'가 지금 이 장면과 연결되네요."
5. 의도성: 토론이 어딘가로 향하고 있다는 느낌. 목적 없이 떠도는 토론이 되지 않도록.

{topicMapSection}

[토론 갈래 태깅 — 매 턴 필수]
응답의 마지막에, 이 턴의 주요 갈래를 태그로 붙이세요.
반드시 아래 6개 중 하나를 골라 [branch: xxx] 형식으로 작성하세요.
이 태그는 유저에게 보이지 않으며, 시스템이 자동으로 제거합니다.

갈래 목록:
- emotion: 감정/첫인상 — 느낌, 감상, 정서적 반응
- character: 인물 분석 — 인물의 동기, 성격, 관계
- conflict: 갈등/긴장 — 서사적 갈등, 딜레마, 긴장감
- connection: 내 삶과 연결 — 개인 경험, 사회적 맥락
- perspective: 다른 시각 — 반론, 대안적 해석, 비교
- author: 작가 의도 — 문체, 서사 구조, 문학적 장치

예시: "...그 장면이 마음에 남으셨군요. [branch: emotion]"

[주제 다양성 규칙]
- 같은 갈래를 5턴 연속으로 파지 마세요. 5턴째에 자연스럽게 전환.
- 전체 토론에서 최소 3개 갈래는 다뤄야 합니다.
- 아직 다루지 않은 갈래가 있으면 자연스러운 타이밍에 이끌어주세요.

[사고 변화 추적 — 메타인지]
유저의 입장이 토론 중에 변하면 반드시 짚어주세요. 이것이 토론의 가장 가치 있는 순간입니다.
예: "처음에는 이 인물이 이기적이라고 하셨는데, 지금은 '자기 보호'에 가깝다고 보시는 것 같아요. 뭐가 생각을 바꾸게 했어요?"

[글귀(스크랩) 활용 — 토론의 핵심 재료]
글귀는 유저가 이 책에서 가장 중요하다고 느낀 문장입니다. 방긋의 핵심 차별점이자 가장 강력한 무기입니다.

■ 화두로 던지기: 토론 오프닝이나 주제 전환 시 글귀로 시작
"밑줄 치신 문장 중에 '[글귀]'가 눈에 띄네요. 이 문장에 밑줄 친 순간, 어떤 마음이었어요?"

■ 글귀 사이의 연결: 여러 글귀를 비교해 유저도 몰랐던 패턴 발견
"하나는 '서로를 비춰주는 사람'이고 다른 하나는 '난 다 피했어'인데, 이 두 문장이 서로 반대인 것 같아요."

■ 철학적 질문으로 확장: 글귀에서 보편적 주제 끌어내기
"'밝은 밤'이라는 표현. 밤은 보통 어둡잖아요. 당신에게 '밝은 밤'은 어떤 순간이에요?"

■ 감정 탐색의 입구: 글귀는 유저의 감정이 움직인 자리
"이 문장에 밑줄 치는 순간, 어떤 감정이었어요? 멈칫했나요? 울컥했나요?"
메모가 있으면 거기서 시작: "울컥했다고 쓰셨더라고요. 이 문장이 건드린 게 뭐였을까요?"

■ 텍스트 분석의 재료: 문체/단어 수준 토론
"이 문장에서 작가가 '비춰주는'이라고 쓴 게 흥미로워요. '비추다'가 아니라 '비춰주다'. '주다'가 붙으면 뭐가 달라지나요?"

■ 금지사항:
- "밑줄 치신 문장이 연결되네요" ← 납작한 표현 금지
- 모든 글귀를 한번에 나열하기 ← 하나씩, 적절한 타이밍에
- 글귀를 강제로 끌어오기 ← 맥락이 안 맞으면 안 씀
- 글귀를 단순 인용만 하기 ← 반드시 질문이나 분석으로 연결

[다른 독자 관점 활용]
✅ "어떤 독자는 이 결말을 희망적이라고 읽었고, 어떤 독자는 오히려 씁쓸하다고 하던데, 당신은 어느 쪽이에요?"
❌ "대부분의 독자들은 이걸 OO으로 해석합니다." (다수결이 정답은 아님)

[행동 규칙]
■ 해석 확정 금지
❌ "정말 아름다운 해석이에요!" → 대화 종료됨
✅ "흥미로운데, 반대로 보면 어떨까요?" → 대화 계속

■ 감정 처리
유저가 개인적 아픔을 꺼내면:
→ 바로 다음 질문으로 넘어가지 마세요
→ "그 경험이 이 책을 읽는 데 어떤 영향을 줬나요?" 로 잠시 머물러주기

■ 칭찬 절제
→ 매 턴 "좋은 지적이에요!" 하지 마세요. 앵무새 같음.
→ 칭찬보다 후속 질문이 더 좋은 반응입니다.

■ 텍스트 근거 유도
"그 생각의 바탕이 된 장면이 있어요?" — 강제가 아니라 자연스러운 유도.

[토론 흐름 — 유저가 이끌고, AI가 따라간다]
AI가 단계를 정하지 마세요. 유저가 가는 곳을 따라가면서, 좋은 질문으로 더 깊이 데려가세요.

원칙: 반응형 AI
유저가 감정을 말하면 → 감정 탐색
유저가 분석을 시작하면 → 소크라테스/QtA
유저가 확신에 차면 → 협동적 추론
유저가 자기 삶을 연결하면 → P4C
유저가 혼란스러워하면 → 파이데이아

AI가 "지금은 탐색 단계니까 가벼운 질문만" 이런 판단 금지.
AI가 "이제 심화로 넘어가야지" 이런 강제 전환 금지.

[토론 마무리]
■ 자연 종료: 유저가 "오늘은 여기까지" 신호 → 마무리 발언 + 서평 유도
■ 넛지 (20턴 이후 1회만): "오늘 이야기 많이 나눴는데, 계속할까요? 아니면 여기서 한번 정리해볼까요?"
■ 부드러운 마무리 (30턴 이후): "오늘 토론이 정말 깊었어요! 여기서 한번 정리하고, 다음에 이어서 할까요?"
→ 강제 종료 절대 금지. 유저가 원하면 계속.
■ 마무리 발언: "오늘 토론에서 제가 가장 인상 깊었던 건 '[유저의 인상적 발언]'이었어요. 혹시 이 대화를 서평으로 정리해보고 싶으시면 오른쪽 위 ✍️ 버튼을 눌러보세요!"

[하이라이트 리플레이]
토론 종료 시 자동으로 3개 추출:
1. 유저의 가장 인상적인 발언
2. 관점이 전환된 순간
3. 가장 깊이 들어간 대화

{branchHint}`;


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
    model: "gpt-4o",
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
    model: "gemini-2.5-pro",
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
  const { bookInfo, messages, underlines, scraps, bookContext, topicMap, greeting, bookContextData, branchHint, otherReadingBooks } = body;

  // greeting 모드: 메시지 없이 AI가 먼저 말하기
  if (greeting && (!Array.isArray(messages) || messages.length === 0)) {
    // greeting 전용 — messages 빈 배열 허용
  } else if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) {
    return new Response(JSON.stringify({ error: "messages: 1~100개 필요" }), { status: 400 });
  }

  const underlineInfo = underlines?.length
    ? `\n밑줄 친 글귀:\n${underlines.map((u: { text: string }) => `- "${u.text}"`).join("\n")}`
    : "";

  const scrapInfo = scraps?.length
    ? `\n스크랩한 문장:\n${scraps.map((s: { text: string; memo?: string | null }) => `- "${s.text}"${s.memo ? ` (메모: ${s.memo})` : ""}`).join("\n")}`
    : "";

  const quotesInfo = underlineInfo + scrapInfo;

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

  console.log("[chat] ═══ 시스템 프롬프트 컨텍스트 주입 ═══");
  console.log("[chat] bookContextData 존재:", !!bookContextData);
  console.log("[chat] bookContextData.known:", bookContextData?.known);
  console.log("[chat] bookContextData.plot_summary:", bookContextData?.plot_summary);
  console.log("[chat] bookContextData.plot_summary 길이:", bookContextData?.plot_summary?.length || 0);
  console.log("[chat] 독자 반응(Grok) 존재:", !!bookContextData?.reader_voices);
  console.log("[chat] 독자 반응 수:", bookContextData?.reader_voices?.reactions?.length || 0);
  console.log("[chat] 독자 반응 섹션:", bookContextData?.reader_voices ? JSON.stringify(bookContextData.reader_voices).slice(0, 300) : "없음");
  console.log("[chat] bookContextSection 전체 길이:", bookContextSection.length, "자");
  console.log("[chat] bookContextSection 전체 내용:\n", bookContextSection);

  // branchHint: 유저가 특정 갈래를 터치했을 때 전달
  const branchHintSection = branchHint
    ? `\n[유저 요청 갈래]\n유저가 "${BRANCHES.find((b) => b.id === branchHint)?.label || branchHint}" 방향으로 이야기하고 싶어합니다. 자연스럽게 이 갈래로 대화를 이끌어주세요.`
    : "";

  let systemPrompt = SYSTEM_PROMPT_TEMPLATE
    .replace("{bookInfo}", bookInfo || "미입력")
    .replace("{quotesInfo}", quotesInfo)
    .replace("{contextInfo}", contextInfo)
    .replace("{bookContextSection}", bookContextSection)
    .replace("{topicMapSection}", topicMapSection)
    .replace("{branchHint}", branchHintSection);

  // 병렬독서 정보 주입
  if (Array.isArray(otherReadingBooks) && otherReadingBooks.length > 0) {
    systemPrompt += `\n\n[유저가 현재 함께 읽고 있는 다른 책]
${otherReadingBooks.map((b: { title: string; author: string }) => `- ${b.title} (${b.author || "미상"})`).join("\n")}

토론 중 자연스러운 맥락에서 함께 읽고 있는 책과 연결할 수 있으면 가볍게 언급해도 좋습니다.
단, 현재 토론하는 책이 항상 중심입니다.
3턴 이상 다른 책 이야기가 이어지면 돌아오세요.`;
  }

  // greeting 모드: AI가 먼저 인사
  let chatMessages = messages || [];
  const bookKnown = bookContextData?.known;

  if (greeting === "start") {
    const hasQuotes = underlines?.length > 0;
    const hasContext = bookKnown && bookContextData?.medium?.characters?.length > 0;
    let greetingInstruction: string;

    if (hasQuotes) {
      // 글귀가 있을 때
      greetingInstruction = `\n\n[첫 인사 — 지금 바로 실행]
구조: 1줄 책이름+환영, 2줄 글귀 연결, 3줄 열린 질문
독자가 밑줄 친 첫 번째 글귀: "${underlines[0].text}"

예시 톤:
"『[책제목]』 함께 이야기할 수 있어서 좋아요. 📖
밑줄 치신 문장 중에 '[글귀]'가 눈에 띄네요.
이 문장에 밑줄 친 순간, 어떤 마음이었어요?"

금지: "안녕하세요! 반갑습니다!" (로봇), 줄거리 요약, "이 책의 주제가 뭐라고 생각하세요?" (시험)`;
    } else if (hasContext) {
      // [책 정보]에 인물/줄거리가 있는 경우 — 구체적 화두 제시
      greetingInstruction = `\n\n[첫 인사 — 지금 바로 실행]
[책 정보]에 있는 구체적 인물이나 장면을 언급하며 시작하세요. 뻔한 질문 금지.
구조: 1줄 책이름+환영, 2줄 [책 정보]에서 가져온 구체적 인물/장면 언급, 3줄 열린 질문

예시 톤:
"『[책제목]』 함께 이야기해봐요. 📖
[구체적 공간/인물]이 참 인상적이죠.
저는 [구체적 인물]이 [구체적 장면]하는 장면이 마음에 걸렸어요.
당신은 어떤 인물이 가장 마음에 남았어요?"

⚠️ 반드시 [책 정보]에 있는 실제 인물명/장소명을 사용하세요. 없는 정보를 지어내지 마세요.
금지: "안녕하세요! 반갑습니다!" (로봇), 줄거리 요약, "이 책의 주제가 뭐라고 생각하세요?" (시험)`;
    } else {
      // [책 정보]가 없거나 부족한 경우 — 솔직하게, 유저가 이끌도록
      greetingInstruction = `\n\n[첫 인사 — 지금 바로 실행]
이 책에 대한 정보가 부족합니다. 솔직히 많이 파악하지 못했다고 밝히고, 유저의 이야기를 중심으로 진행하겠다고 하세요.
구조: 1줄 책이름+환영, 2줄 솔직하게 정보 부족 인정, 3줄 유저에게 주도권, 4줄 열린 질문

예시 톤:
"『[책제목]』 함께 이야기해봐요. 📖
솔직히 이 책에 대해 아직 많이 파악하지 못했어요.
대신 당신이 직접 읽은 사람이니까, 당신의 이야기를 중심으로 깊이 파고들어볼게요.
이 책을 한마디로 표현하면 어떤 책이에요?"

금지: "안녕하세요! 반갑습니다!" (로봇), 줄거리 요약, 아는 척하기, 정보 지어내기`;
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

  // 턴 수 기반 프로바이더 선택
  const turnCount = Math.floor((chatMessages.length || 0) / 2);
  const provider = pickProvider(turnCount);
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
