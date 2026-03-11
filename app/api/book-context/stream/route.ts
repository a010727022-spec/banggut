import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { getApiUser, unauthorized, tooManyRequests } from "@/lib/supabase/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// --- 클라이언트 팩토리 ---

function getClaude() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

function getGenAI() {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
}

function getGrok() {
  return new OpenAI({
    apiKey: process.env.XAI_API_KEY!,
    baseURL: "https://api.x.ai/v1",
  });
}

function getSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          return (await cookieStore).getAll();
        },
        async setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              (await cookieStore).set(name, value, options);
            }
          } catch {
            // Edge Runtime에서 무시
          }
        },
      },
    },
  );
}

// --- SSE 헬퍼 ---

function sseEvent(
  encoder: TextEncoder,
  data: { step: string; label: string; progress: number; total: number },
) {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

// --- Step 1: Claude Haiku 자체 지식 확인 ---

async function fetchClaudeKnowledge(bookLabel: string, title: string) {
  try {
    const claude = getClaude();
    const res = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `당신은 독서토론 앱의 배경지식 엔진입니다.
아래 책에 대해 "이 책을 이미 읽은 토론 동료"가 알고 있을 법한 정보를 정리해주세요.

대상 책: ${bookLabel}

⚠️ 정보 오염 방지 — 매우 중요:
- 오직 "${title}" 한 권에 대한 정보만 응답하세요.
- 같은 작가의 다른 작품 정보를 이 책인 것처럼 섞지 마세요.
- 확실하지 않은 정보는 절대 포함하지 마세요.
- 이 책을 모르면 {"known": false}로만 응답하세요.

JSON으로만 응답:
{
  "known": true,
  "confidence": "high|low",
  "high": {
    "author": "저자명",
    "year": "출간년도",
    "publisher": "출판사",
    "genre": "장르",
    "awards": "수상 이력 (없으면 null)",
    "author_note": "작가에 대한 한 줄 설명"
  },
  "medium": {
    "characters": [{"name": "이름", "desc": "역할/성격", "relations": "관계"}],
    "setting": "배경 시대/장소",
    "narrative": "서술 시점, 문체 특징"
  },
  "interpretations": ["해석1", "해석2", "해석3"],
  "key_scenes": ["장면1", "장면2"],
  "discussion_hooks": ["토론 질문1", "토론 질문2", "토론 질문3"],
  "author_intent": "작가 인터뷰에서 밝힌 집필 의도 (없으면 null)"
}

confidence 기준:
- "high": 등장인물 3명 이상, 줄거리 핵심 갈등, 주요 주제를 확실히 알고 있음
- "low": 작가/장르 정도만 알고 있고, 세부 내용은 불확실`,
        },
      ],
    });

    const text = res.content[0].type === "text" ? res.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return null;
  } catch (err) {
    console.error("[book-context-stream] Claude knowledge error:", err);
    return null;
  }
}

// --- Step 2a: Gemini 나무위키/줄거리/등장인물 ---

async function fetchGeminiNamuwiki(bookLabel: string, title: string) {
  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(
      `"${title}" 책의 상세 줄거리, 등장인물, 인물 관계도를 정리해주세요.
검색 대상: ${bookLabel}

나무위키, 위키백과 등 상세 정보를 참고하세요.

⚠️ 오직 "${title}" 한 권에 대한 정보만. 다른 책 혼동 금지.

JSON 응답:
{
  "found": true,
  "characters": [
    {"name": "이름", "desc": "역할/성격 상세", "relations": "다른 인물과의 관계"}
  ],
  "plot_summary": "줄거리 요약 (핵심 갈등 포함, 5-8문장)",
  "setting": "배경 시대/장소",
  "narrative": "서술 시점, 문체 특징",
  "themes": ["핵심 주제1", "주제2", "주제3"],
  "key_scenes": ["인상적인 장면1", "장면2", "장면3"],
  "literary_devices": ["문학 장치1 (상징, 복선 등)", "장치2"]
}

모르는 책이면 {"found": false}`,
    );

    const text = result.response.text();
    return JSON.parse(text);
  } catch (err) {
    console.error("[book-context-stream] Gemini namuwiki error:", err);
    return null;
  }
}

// --- Step 2b: Gemini 서평/독자 해석 ---

async function fetchGeminiReviews(bookLabel: string, title: string) {
  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(
      `"${title}" 책에 대한 서평, 독자 반응, 비평을 정리해주세요.
대상 책: ${bookLabel}

블로그, 서평 사이트, 독서 커뮤니티 등의 다양한 독자 의견을 참고하세요.

JSON 응답:
{
  "found": true,
  "reviews_summary": ["자주 등장하는 서평 관점1", "관점2", "관점3"],
  "controversial_points": ["독자들 사이 의견이 갈리는 포인트1", "포인트2"],
  "emotional_responses": ["독자들이 자주 느끼는 감정1", "감정2"],
  "recommended_for": "이 책을 좋아할 독자 유형",
  "similar_books": ["비교되는 작품1", "비교되는 작품2"]
}

서평 정보를 찾을 수 없으면 {"found": false}`,
    );

    const text = result.response.text();
    return JSON.parse(text);
  } catch (err) {
    console.error("[book-context-stream] Gemini reviews error:", err);
    return null;
  }
}

// --- Step 2c: Gemini 작가 인터뷰 ---

async function fetchGeminiAuthorInterview(
  bookLabel: string,
  title: string,
  author: string | undefined,
) {
  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const authorQuery = author ? `${author} 작가` : "작가";

    const result = await model.generateContent(
      `"${title}" 책에 대한 ${authorQuery} 인터뷰, 집필 배경, 창작 의도를 찾아주세요.
대상 책: ${bookLabel}

작가 인터뷰, 강연, 에세이, 출판사 서문 등을 참고하세요.

JSON 응답:
{
  "found": true,
  "author_intent": "작가가 밝힌 집필 의도/동기",
  "writing_background": "집필 당시 상황, 영감",
  "author_comments": ["작가의 주요 발언1", "발언2"],
  "behind_the_scenes": "제목 유래, 캐릭터 모델, 삭제된 에피소드 등"
}

인터뷰 정보를 찾을 수 없으면 {"found": false}`,
    );

    const text = result.response.text();
    return JSON.parse(text);
  } catch (err) {
    console.error("[book-context-stream] Gemini author interview error:", err);
    return null;
  }
}

// --- Step 3: Grok X 독자 반응 ---

async function fetchGrokXReactions(title: string, author: string | undefined) {
  try {
    const grok = getGrok();

    const res = await grok.chat.completions.create({
      model: "grok-4.1",
      messages: [
        {
          role: "system",
          content: `당신은 X(트위터)의 독서 반응을 수집하는 엔진입니다.
"${title}" 책에 대한 X 사용자들의 실제 반응, 감상, 인상적인 멘트를 정리하세요.

규칙:
- 실제 독자들의 생생한 반응 위주로
- 스포일러 주의 — 결말 언급 금지
- 오직 "${title}" 한 권에 대한 반응만
- 반응이 없으면 빈 배열

JSON으로만 응답:
{
  "found": true,
  "reactions": [
    {"sentiment": "positive|negative|mixed", "summary": "반응 요약", "quote": "인상적인 멘트"}
  ],
  "trending_topics": ["화제 키워드"],
  "reader_demographics": "주로 어떤 독자층이 읽는지",
  "overall_sentiment": "전반적 반응 요약 한 줄"
}

반응이 없으면: {"found": false}`,
        },
        {
          role: "user",
          content: `"${title}" ${author ? `(${author})` : ""} 이 책에 대한 X 사용자들의 독서 반응을 정리해주세요.`,
        },
      ],
      temperature: 0.3,
    });

    const text = res.choices[0]?.message?.content || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return null;
  } catch (err) {
    console.error("[book-context-stream] Grok X search error:", err);
    return null;
  }
}

// --- Step 4: Haiku 검증 + 5소스 통합 ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = Record<string, any> | null;

async function verifyAndMerge(
  bookLabel: string,
  title: string,
  claudeKnowledge: AnyData,
  geminiNamuwiki: AnyData,
  geminiReviews: AnyData,
  geminiInterview: AnyData,
  grokData: AnyData,
) {
  try {
    const claude = getClaude();
    const res = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `당신은 정보 검증 및 통합 엔진입니다.

대상 책: ${bookLabel}

5개 소스에서 수집한 정보를 검증하고 하나로 통합하세요.

[소스 1: Claude 자체 지식]
${claudeKnowledge ? JSON.stringify(claudeKnowledge, null, 2) : "(없음)"}

[소스 2: 나무위키/줄거리/등장인물]
${geminiNamuwiki ? JSON.stringify(geminiNamuwiki, null, 2) : "(없음)"}

[소스 3: 서평/독자 해석]
${geminiReviews ? JSON.stringify(geminiReviews, null, 2) : "(없음)"}

[소스 4: 작가 인터뷰/집필 배경]
${geminiInterview ? JSON.stringify(geminiInterview, null, 2) : "(없음)"}

[소스 5: X 독자 반응]
${grokData ? JSON.stringify(grokData, null, 2) : "(없음)"}

검증 규칙:
1. 모든 정보가 "${title}" 한 권에 대한 것인지 확인. 다른 작품 정보 제거.
2. 소스 간 모순 시 더 상세한 쪽 채택.
3. 확실하지 않은 항목은 제거.
4. 등장인물은 최대한 상세히 (관계도 포함).
5. X 독자 반응은 reader_voices 섹션으로 분리 보존.

JSON으로만 응답:
{
  "known": true,
  "high": {
    "author": "저자명",
    "year": "출간년도",
    "publisher": "출판사",
    "genre": "장르",
    "awards": "수상 (없으면 null)",
    "author_note": "작가 한 줄 설명"
  },
  "medium": {
    "characters": [{"name": "이름", "desc": "역할/성격 상세", "relations": "관계"}],
    "setting": "배경",
    "narrative": "서술 특징"
  },
  "plot_summary": "줄거리 요약 (핵심 갈등 포함)",
  "themes": ["주제1", "주제2", "주제3"],
  "interpretations": ["해석1", "해석2", "해석3"],
  "key_scenes": ["장면1", "장면2"],
  "literary_devices": ["문학 장치1", "장치2"],
  "discussion_hooks": ["질문1", "질문2", "질문3"],
  "author_intent": "작가 의도 (없으면 null)",
  "writing_background": "집필 배경 (없으면 null)",
  "web_reviews": {
    "summary": "웹 서평 요약",
    "controversial_points": ["의견 갈리는 포인트"],
    "emotional_responses": ["독자 감정 반응"],
    "recommended_for": "추천 독자층",
    "similar_books": ["비교 작품"]
  },
  "reader_voices": {
    "reactions": [{"sentiment": "positive|negative|mixed", "summary": "요약", "quote": "멘트"}],
    "trending_topics": ["화제 키워드"],
    "overall_sentiment": "전반적 반응 한 줄"
  }
}

모든 소스 실패면: {"known": false}`,
        },
      ],
    });

    const text = res.content[0].type === "text" ? res.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return null;
  } catch (err) {
    console.error("[book-context-stream] Verify/merge error:", err);
    if (claudeKnowledge && claudeKnowledge.known) return claudeKnowledge;
    return null;
  }
}

// --- 메인 SSE 핸들러 ---

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();

  const { success } = rateLimit(`book-context-stream:${user.id}`, 5);
  if (!success) return tooManyRequests();

  const { title, author, bookId } = await req.json();

  if (!title || typeof title !== "string" || !bookId) {
    return new Response(JSON.stringify({ error: "title and bookId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabase();

  // --- 캐시 확인 ---
  const { data: bookData } = await supabase
    .from("books")
    .select("context_data, context_fetched_at, context_status")
    .eq("id", bookId)
    .single();

  if (bookData?.context_data && bookData.context_status === "done") {
    const fetchedAt = new Date(bookData.context_fetched_at).getTime();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (Date.now() - fetchedAt < ONE_DAY) {
      // 이미 캐시됨 - 즉시 완료 이벤트 전송
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ step: "done", context: bookData.context_data })}\n\n`,
            ),
          );
          controller.close();
        },
      });
      return new Response(body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }
  }

  // --- 중복 fetch 방지: atomic lock ---
  if (bookData?.context_status === "fetching") {
    // 2분 이내면 이미 진행 중
    const updatedAt = bookData.context_fetched_at
      ? new Date(bookData.context_fetched_at).getTime()
      : 0;
    if (Date.now() - updatedAt < 120000) {
      // 이미 진행 중 - 폴링 스트림
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        async start(controller) {
          controller.enqueue(
            sseEvent(encoder, {
              step: "waiting",
              label: "방긋이 이미 읽고 있어요...",
              progress: 0,
              total: 6,
            }),
          );

          // 2초 간격으로 DB 체크
          for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            const { data: check } = await supabase
              .from("books")
              .select("context_data, context_status")
              .eq("id", bookId)
              .single();

            if (check?.context_status === "done" && check.context_data) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ step: "done", context: check.context_data })}\n\n`,
                ),
              );
              controller.close();
              return;
            }
            if (check?.context_status === "failed" || check?.context_status === null) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ step: "failed" })}\n\n`),
              );
              controller.close();
              return;
            }
          }
          // 타임아웃
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ step: "failed" })}\n\n`),
          );
          controller.close();
        },
      });
      return new Response(body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }
  }

  // --- Lock 획득 ---
  await supabase
    .from("books")
    .update({
      context_status: "fetching",
      context_fetched_at: new Date().toISOString(),
    })
    .eq("id", bookId);

  const bookLabel = `"${title}"${author ? ` — ${author}` : ""}`;
  const encoder = new TextEncoder();
  const TOTAL = 6;

  const body = new ReadableStream({
    async start(controller) {
      try {
        // ═══ Step 1: Claude Haiku 자체 지식 ═══
        controller.enqueue(
          sseEvent(encoder, {
            step: "claude",
            label: "방긋이 기억을 떠올리고 있어요...",
            progress: 1,
            total: TOTAL,
          }),
        );

        const claudeResult = await fetchClaudeKnowledge(bookLabel, title);

        // ═══ Step 2-3-4-5: Gemini x3 + Grok 병렬 ═══
        controller.enqueue(
          sseEvent(encoder, {
            step: "gemini_namuwiki",
            label: "줄거리와 등장인물을 파악하고 있어요...",
            progress: 2,
            total: TOTAL,
          }),
        );

        // 4개 병렬 실행, 각각 완료 시 progress 전송
        const promises = [
          fetchGeminiNamuwiki(bookLabel, title).then((r) => {
            controller.enqueue(
              sseEvent(encoder, {
                step: "gemini_reviews",
                label: "서평을 읽고 있어요...",
                progress: 3,
                total: TOTAL,
              }),
            );
            return r;
          }),
          fetchGeminiReviews(bookLabel, title),
          fetchGeminiAuthorInterview(bookLabel, title, author).then((r) => {
            controller.enqueue(
              sseEvent(encoder, {
                step: "gemini_interview",
                label: "작가 인터뷰를 찾고 있어요...",
                progress: 4,
                total: TOTAL,
              }),
            );
            return r;
          }),
          fetchGrokXReactions(title, author).then((r) => {
            controller.enqueue(
              sseEvent(encoder, {
                step: "grok",
                label: "X에서 독자 반응을 모으고 있어요...",
                progress: 5,
                total: TOTAL,
              }),
            );
            return r;
          }),
        ];

        const [namuwikiResult, reviewsResult, interviewResult, grokResult] =
          await Promise.allSettled(promises).then((results) =>
            results.map((r) => (r.status === "fulfilled" ? r.value : null)),
          );

        // ═══ Step 6: Haiku 검증 + 통합 ═══
        controller.enqueue(
          sseEvent(encoder, {
            step: "merge",
            label: "정보를 정리하고 있어요...",
            progress: 6,
            total: TOTAL,
          }),
        );

        const claudeKnown = claudeResult?.known;
        const merged = await verifyAndMerge(
          bookLabel,
          title,
          claudeKnown ? claudeResult : null,
          namuwikiResult?.found ? namuwikiResult : null,
          reviewsResult?.found ? reviewsResult : null,
          interviewResult?.found ? interviewResult : null,
          grokResult?.found ? grokResult : null,
        );

        const finalContext = merged || { known: false };

        // ═══ DB 저장 ═══
        await supabase
          .from("books")
          .update({
            context_data: finalContext,
            context_status: finalContext.known ? "done" : "failed",
            context_fetched_at: new Date().toISOString(),
          })
          .eq("id", bookId);

        // ═══ 완료 이벤트 ═══
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ step: "done", context: finalContext })}\n\n`,
          ),
        );
      } catch (err) {
        console.error("[book-context-stream] Pipeline error:", err);

        // 실패 상태 저장
        try {
          await supabase
            .from("books")
            .update({ context_status: "failed" })
            .eq("id", bookId);
        } catch {
          // 무시
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ step: "failed" })}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
