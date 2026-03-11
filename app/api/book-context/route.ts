import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { NextResponse } from "next/server";
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
    console.error("[book-context] Claude knowledge error:", err);
    return null;
  }
}

// --- Step 2a: Gemini 웹 검색 (줄거리 + 등장인물 심층) ---

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function fetchGeminiDeepSearch(bookLabel: string, title: string, _author: string | undefined) {
  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(
      `당신은 독서토론 앱의 웹 검색 엔진입니다.
아래 책에 대한 상세 정보를 웹에서 검색해 정리해주세요.

검색 대상: ${bookLabel}

⚠️ 오직 "${title}" 한 권에 대한 정보만. 다른 책 혼동 금지.
확실하지 않으면 해당 필드를 null로.

JSON 응답:
{
  "found": true,
  "basic": {
    "author": "저자명",
    "year": "출간년도",
    "publisher": "출판사",
    "genre": "장르",
    "awards": "수상 이력 (없으면 null)",
    "author_note": "작가 한 줄 설명"
  },
  "characters": [
    {"name": "이름", "desc": "역할/성격 설명", "relations": "다른 인물과의 관계"}
  ],
  "plot_summary": "스포일러 없는 줄거리 요약 (3-5문장)",
  "setting": "배경 시대/장소",
  "narrative": "서술 시점, 문체 특징",
  "themes": ["핵심 주제1", "주제2", "주제3"],
  "reviews_summary": ["서평에서 자주 등장하는 관점1", "관점2", "관점3"],
  "controversial_points": ["독자들 사이 의견이 갈리는 포인트1", "포인트2"],
  "key_scenes": ["인상적인 장면1 (스포일러 최소화)", "장면2"],
  "discussion_hooks": ["토론 질문1", "질문2", "질문3"],
  "recommended_for": "이 책을 좋아할 독자 유형",
  "similar_books": ["비교되는 작품1", "비교되는 작품2"],
  "author_intent": "작가 인터뷰에서 밝힌 집필 의도 (없으면 null)"
}

모르는 책이면 {"found": false}`,
    );

    const text = result.response.text();
    return JSON.parse(text);
  } catch (err) {
    console.error("[book-context] Gemini deep search error:", err);
    return null;
  }
}

// --- Step 2b: Gemini 서평만 검색 (Claude 지식이 충분할 때) ---

async function fetchGeminiReviewsOnly(bookLabel: string, title: string) {
  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(
      `"${title}" 이 책에 대한 웹상의 서평/리뷰 정보를 정리해주세요.
대상 책: ${bookLabel}

JSON 응답:
{
  "found": true,
  "reviews_summary": ["서평 관점1", "관점2", "관점3"],
  "controversial_points": ["의견 갈리는 포인트1", "포인트2"],
  "recommended_for": "추천 독자층",
  "similar_books": ["비교 작품1", "비교 작품2"]
}

모르면 {"found": false}`,
    );

    const text = result.response.text();
    return JSON.parse(text);
  } catch (err) {
    console.error("[book-context] Gemini reviews error:", err);
    return null;
  }
}

// --- Grok: X(트위터) 독자 반응 ---

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
    console.error("[book-context] Grok X search error:", err);
    return null;
  }
}

// --- Step 3: Haiku 검증 + 통합 ---

async function verifyAndMerge(
  bookLabel: string,
  title: string,
  claudeKnowledge: Record<string, unknown> | null,
  geminiData: Record<string, unknown> | null,
  grokData: Record<string, unknown> | null,
  _isDeepSearch: boolean,
) {
  try {
    const claude = getClaude();
    const res = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: `당신은 정보 검증 및 통합 엔진입니다.

대상 책: ${bookLabel}

3개 소스에서 수집한 정보를 검증하고 하나로 통합하세요.

[소스 1: Claude 자체 지식]
${claudeKnowledge ? JSON.stringify(claudeKnowledge, null, 2) : "(없음)"}

[소스 2: Gemini 웹 검색]
${geminiData ? JSON.stringify(geminiData, null, 2) : "(없음)"}

[소스 3: Grok X 독자 반응]
${grokData ? JSON.stringify(grokData, null, 2) : "(없음)"}

검증 규칙:
1. 모든 정보가 "${title}" 한 권에 대한 것인지 확인. 다른 작품 정보 제거.
2. 소스 간 모순 시 더 상세한 쪽 채택.
3. 확실하지 않은 항목은 제거.
4. X 독자 반응은 reader_voices 섹션으로 분리 보존.

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
    "characters": [{"name": "이름", "desc": "역할", "relations": "관계"}],
    "setting": "배경",
    "narrative": "서술 특징"
  },
  "interpretations": ["해석1", "해석2", "해석3"],
  "key_scenes": ["장면1", "장면2"],
  "discussion_hooks": ["질문1", "질문2", "질문3"],
  "author_intent": "작가 의도 (없으면 null)",
  "web_reviews": {
    "summary": "웹 서평 요약",
    "controversial_points": ["의견 갈리는 포인트"],
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
    console.error("[book-context] Verify/merge error:", err);
    // 검증 실패 시 원본 데이터라도 반환
    if (claudeKnowledge && (claudeKnowledge as { known?: boolean }).known) {
      return claudeKnowledge;
    }
    return null;
  }
}

// --- 메인 핸들러 ---

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();

  const { success } = rateLimit(`book-context:${user.id}`, 10);
  if (!success) return tooManyRequests();

  const { title, author, bookId } = await req.json();

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  // --- 캐시 확인 ---
  if (bookId) {
    try {
      const supabase = getSupabase();
      const { data: bookData } = await supabase
        .from("books")
        .select("context_data, context_fetched_at")
        .eq("id", bookId)
        .single();

      if (bookData?.context_data && bookData.context_fetched_at) {
        const fetchedAt = new Date(bookData.context_fetched_at).getTime();
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;
        // 24시간 이내 캐시 유효
        if (now - fetchedAt < ONE_DAY) {
          return NextResponse.json({ context: bookData.context_data, cached: true });
        }
      }
    } catch {
      // 캐시 조회 실패해도 계속 진행
    }
  }

  const bookLabel = `"${title}"${author ? ` — ${author}` : ""}`;

  try {
    // --- Step 1: Claude Haiku 자체 지식 확인 ---
    const claudeResult = await fetchClaudeKnowledge(bookLabel, title);
    const claudeKnown = claudeResult?.known;
    const claudeConfidence = claudeResult?.confidence;

    let geminiResult = null;
    let grokResult = null;
    let isDeepSearch = false;

    if (claudeKnown && claudeConfidence === "high") {
      // --- Step 2b: 자체 지식 충분 → 서평 + X 반응만 ---
      [geminiResult, grokResult] = await Promise.all([
        fetchGeminiReviewsOnly(bookLabel, title),
        fetchGrokXReactions(title, author),
      ]);
    } else {
      // --- Step 2a: 자체 지식 부족 → 풀 서치 ---
      isDeepSearch = true;
      [geminiResult, grokResult] = await Promise.all([
        fetchGeminiDeepSearch(bookLabel, title, author),
        fetchGrokXReactions(title, author),
      ]);
    }

    // 모두 실패
    const geminiFound = geminiResult?.found;
    const grokFound = grokResult?.found;
    if (!claudeKnown && !geminiFound && !grokFound) {
      return NextResponse.json({ context: { known: false } });
    }

    // --- Step 3: Haiku 검증 + 통합 ---
    const merged = await verifyAndMerge(
      bookLabel,
      title,
      claudeKnown ? claudeResult : null,
      geminiFound ? geminiResult : null,
      grokFound ? grokResult : null,
      isDeepSearch,
    );

    const finalContext = merged || { known: false };

    // --- 캐시 저장 ---
    if (bookId && finalContext.known) {
      try {
        const supabase = getSupabase();
        await supabase
          .from("books")
          .update({
            context_data: finalContext,
            context_fetched_at: new Date().toISOString(),
          })
          .eq("id", bookId);
      } catch {
        // 캐시 저장 실패해도 무시
      }
    }

    return NextResponse.json({ context: finalContext });
  } catch (error) {
    console.error("Book context error:", error);
    return NextResponse.json({ context: null });
  }
}
