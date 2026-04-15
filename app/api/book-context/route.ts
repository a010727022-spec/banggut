import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getApiUser, unauthorized, tooManyRequests } from "@/lib/supabase/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { normalizeKey } from "@/lib/normalize-key";

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
            // ignore
          }
        },
      },
    },
  );
}

// ── 한국어 → 로마자 변환 (Gemini) ──
async function romanizeForSearch(title: string, author: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

  const result = await model.generateContent(
    `Convert this Korean book title and author to romanized form for web search.
Title: "${title}"${author ? `\nAuthor: "${author}"` : ""}

Reply with ONLY the romanized search query, nothing else.
Example: "희망" by 양귀자 → "Huimang Hope Yang Gui-ja Korean novel"`,
  );
  return result.response.text().trim();
}

// ── Gemini Google Search Grounding 단일 검색 ──
async function geminiSearch(query: string, label: string): Promise<{
  text: string;
  grounded: boolean;
  sourceCount: number;
}> {
  const apiKey = process.env.GEMINI_API_KEY!;
  // ⚠️ 보안: API 키는 URL query가 아닌 x-goog-api-key 헤더로 전송
  // (URL은 서버 로그/Referer/CDN 캐시에 평문 기록되어 유출 위험)
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: query }] }],
      tools: [{ google_search: {} }],
    }),
  });

  if (!res.ok) {
    console.error(`[book-context] ${label} API error:`, res.status);
    return { text: "", grounded: false, sourceCount: 0 };
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const text = parts.map((p: { text?: string }) => p.text || "").join("\n");

  const grounding = candidate?.groundingMetadata;
  const chunks = grounding?.groundingChunks || [];

  console.log(`[book-context] ${label}: groundingChunks=${chunks.length}, text=${text.length}자`);
  if (chunks.length > 0) {
    chunks.slice(0, 3).forEach((c: { web?: { title?: string; uri?: string } }, i: number) => {
      console.log(`  [${i + 1}] ${c.web?.title || "?"}`);
    });
  }

  return { text, grounded: chunks.length > 0, sourceCount: chunks.length };
}

// ── Grok (xAI) — X/SNS 독자 반응 검색 ──
async function searchGrok(title: string, author: string): Promise<{
  reactions: { sentiment: string; summary: string; quote?: string }[];
  overall_sentiment: string | null;
  trending_topics: string[];
}> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.log("[book-context] Grok: XAI_API_KEY 없음, 스킵");
    return { reactions: [], overall_sentiment: null, trending_topics: [] };
  }

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-3",
        messages: [
          {
            role: "system",
            content: "You search X (Twitter) and social media for reader reactions to books. Always respond in valid JSON only.",
          },
          {
            role: "user",
            content: `"${title}"${author ? ` (${author})` : ""} 이 책에 대한 X(트위터), SNS 독자 반응을 검색해줘.

JSON으로만 응답:
{
  "reactions": [
    {"sentiment": "positive|negative|mixed", "summary": "반응 요약", "quote": "인용문(있으면)"}
  ],
  "overall_sentiment": "전반적 분위기 한 줄",
  "trending_topics": ["화제 키워드1", "키워드2"]
}

반응을 찾을 수 없으면: {"reactions": [], "overall_sentiment": null, "trending_topics": []}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[book-context] Grok API error:", res.status);
      return { reactions: [], overall_sentiment: null, trending_topics: [] };
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    console.log("[book-context] ═══ Grok 검색 결과 ═══");
    console.log("[book-context] Grok raw:", text.slice(0, 500));

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log("[book-context] Grok: JSON 파싱 실패");
      return { reactions: [], overall_sentiment: null, trending_topics: [] };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    console.log("[book-context] Grok 반응 수:", parsed.reactions?.length || 0);
    console.log("[book-context] Grok 내용:", JSON.stringify(parsed).slice(0, 500));

    return {
      reactions: parsed.reactions || [],
      overall_sentiment: parsed.overall_sentiment || null,
      trending_topics: parsed.trending_topics || [],
    };
  } catch (err) {
    console.error("[book-context] Grok error:", err);
    return { reactions: [], overall_sentiment: null, trending_topics: [] };
  }
}

// ── 4개 검색을 병렬로 실행 ──
async function searchAllWithGrounding(title: string, author: string): Promise<{
  combinedText: string;
  totalSources: number;
  results: { plot: boolean; characters: boolean; reviews: boolean };
  grokData: { reactions: { sentiment: string; summary: string; quote?: string }[]; overall_sentiment: string | null; trending_topics: string[] };
}> {
  const romanized = await romanizeForSearch(title, author);
  console.log("[book-context] romanized:", romanized);

  const authorPart = author ? ` ${author}` : "";

  // 4개 검색 병렬 실행 (Gemini 3개 + Grok 1개)
  const [plotResult, charsResult, reviewsResult, grokResult] = await Promise.all([
    geminiSearch(
      `Search the web for plot summary and synopsis of the Korean book "${title}"${authorPart}. Romanized: ${romanized}. Find detailed plot summary in Korean. Respond in Korean.`,
      "줄거리 검색",
    ),
    geminiSearch(
      `Search the web for main characters and character relationships in the Korean book "${title}"${authorPart}. Romanized: ${romanized}. Find character names, roles, personalities, and relationships. Respond in Korean.`,
      "등장인물 검색",
    ),
    geminiSearch(
      `Search the web for reader reviews, interpretations, themes, and discussion points about the Korean book "${title}"${authorPart}. Romanized: ${romanized}. Find book reviews, reader opinions, key themes. Respond in Korean.`,
      "서평/해석 검색",
    ),
    searchGrok(title, author),
  ]);

  const sections: string[] = [];
  if (plotResult.text) sections.push(`[줄거리 검색 결과]\n${plotResult.text}`);
  if (charsResult.text) sections.push(`[등장인물 검색 결과]\n${charsResult.text}`);
  if (reviewsResult.text) sections.push(`[서평/해석 검색 결과]\n${reviewsResult.text}`);

  return {
    combinedText: sections.join("\n\n---\n\n"),
    totalSources: plotResult.sourceCount + charsResult.sourceCount + reviewsResult.sourceCount,
    results: {
      plot: plotResult.grounded,
      characters: charsResult.grounded,
      reviews: reviewsResult.grounded,
    },
    grokData: grokResult,
  };
}

// ── Gemini로 검색 결과 → 구조화된 JSON ──
async function structureSearchResult(
  title: string,
  author: string,
  searchText: string,
): Promise<Record<string, unknown>> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro",
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = `아래는 "${title}"${author ? ` (${author})` : ""} 책에 대해 웹 검색으로 수집한 정보입니다.

⚠️ 절대 규칙:
- 아래 텍스트에 있는 정보만 정리하세요. 없는 정보를 만들어내지 마세요.
- 오직 "${title}" 한 권에 대한 정보만. 다른 책 혼동 금지.
- 텍스트에서 찾을 수 없는 항목은 null로.

검색 결과:
---
${searchText.slice(0, 15000)}
---

JSON 응답:
{
  "known": true,
  "high": {
    "author": "저자명 또는 null",
    "year": "출간년도 또는 null",
    "genre": "장르 또는 null",
    "author_note": "작가에 대한 한 줄 설명 또는 null"
  },
  "medium": {
    "characters": [
      {"name": "이름", "desc": "역할/성격", "relations": "다른 인물과의 관계"}
    ],
    "setting": "배경 시대/장소 또는 null",
    "narrative": "서술 시점, 문체 특징 또는 null"
  },
  "plot_summary": "줄거리 요약 (핵심 갈등 포함, 스포일러 최소화, 3-5문장) 또는 null",
  "themes": ["핵심 주제1", "주제2", "주제3"],
  "interpretations": ["독자들의 해석1", "해석2"],
  "key_scenes": ["인상적인 장면1", "장면2"],
  "discussion_hooks": ["토론 질문1", "질문2", "질문3"],
  "author_intent": "작가가 밝힌 집필 의도 또는 null"
}

이 책에 대한 정보를 전혀 찾을 수 없으면: {"known": false}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return JSON.parse(text);
}

// ── 품질 평가 ──
function assessQuality(data: Record<string, unknown>): {
  quality: "sufficient" | "partial" | "insufficient";
  found: { plot: boolean; characters: boolean; themes: boolean };
} {
  if (!data.known) {
    return { quality: "insufficient", found: { plot: false, characters: false, themes: false } };
  }

  const hasPlot = !!data.plot_summary;
  const medium = data.medium as { characters?: unknown[] } | undefined;
  const hasCharacters = Array.isArray(medium?.characters) && medium!.characters.length > 0;
  const hasThemes = Array.isArray(data.themes) && (data.themes as unknown[]).length > 0;

  const found = { plot: hasPlot, characters: hasCharacters, themes: hasThemes };
  const score = [hasPlot, hasCharacters, hasThemes].filter(Boolean).length;

  if (score >= 3) return { quality: "sufficient", found };
  if (score >= 1) return { quality: "partial", found };
  return { quality: "insufficient", found };
}

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();

  const { success } = rateLimit(`book-context:${user.id}`, 10);
  if (!success) return tooManyRequests();

  const { title, author, bookId, description } = await req.json();

  if (!title || !bookId) {
    return NextResponse.json({ error: "title and bookId required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const titleNorm = normalizeKey(title);
  const authorNorm = normalizeKey(author || "");

  // 1) 이 book row 자체 확인
  const { data: bookRow } = await supabase
    .from("books")
    .select("context_data, context_status")
    .eq("id", bookId)
    .single();

  if (bookRow?.context_status === "done" && bookRow.context_data) {
    return NextResponse.json({ context: bookRow.context_data, cached: true });
  }

  if (bookRow?.context_status === "fetching") {
    return NextResponse.json({ context: null, status: "already_fetching" });
  }

  // 2) book_contexts 글로벌 캐시 확인 (같은 책을 다른 유저가 이미 검색한 경우)
  const { data: cached } = await supabase
    .from("book_contexts")
    .select("context_data, fetch_status")
    .eq("title_normalized", titleNorm)
    .eq("author_normalized", authorNorm)
    .single();

  // topic-map 전용 row (context_data는 비어있고 topic_map만 있는 경우) 배제
  const hasRealContext =
    cached?.context_data &&
    typeof cached.context_data === "object" &&
    (cached.context_data as { known?: unknown }).known !== undefined;

  if (hasRealContext && cached?.fetch_status === "done") {
    console.log("[book-context] 글로벌 캐시 히트! title:", title, "(₩0, 즉시)");
    // books 테이블에 복사 + 히트 카운트 증가
    await Promise.all([
      supabase
        .from("books")
        .update({
          context_data: cached.context_data,
          context_status: "done",
          context_fetched_at: new Date().toISOString(),
        })
        .eq("id", bookId),
      supabase.rpc("increment_book_context_hits", {
        p_title: titleNorm,
        p_author: authorNorm,
      }).then(() => {}, () => {}),
    ]);
    return NextResponse.json({ context: cached.context_data, cached: true });
  }

  // 다른 유저가 이미 fetching 중이면 기다리지 않고 books row만 마킹
  if (cached?.fetch_status === "fetching") {
    console.log("[book-context] 다른 유저가 이미 fetching 중:", title);
    return NextResponse.json({ context: null, status: "already_fetching" });
  }

  // Lock: fetching 상태 (books + 글로벌 캐시 동시)
  await Promise.all([
    supabase
      .from("books")
      .update({
        context_status: "fetching",
        context_data: {
          steps: { plot: "pending", characters: "pending", reviews: "pending", grok: "pending", structure: "pending" },
        },
      })
      .eq("id", bookId),
    supabase
      .from("book_contexts")
      .upsert(
        {
          title_normalized: titleNorm,
          author_normalized: authorNorm,
          title_original: title,
          author_original: author || null,
          context_data: {},
          fetch_status: "fetching",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "title_normalized,author_normalized" },
      ),
  ]);

  try {
    // ═══ STEP 1: 4개 검색 병렬 실행 ═══
    console.log("[book-context] ═══ STEP 1: 4개 검색 병렬 실행 ═══");
    console.log("[book-context] title:", title, "author:", author, "bookId:", bookId);

    const searchResult = await searchAllWithGrounding(title, author || "");

    console.log("[book-context] 검색 결과 — plot:", searchResult.results.plot, "chars:", searchResult.results.characters, "reviews:", searchResult.results.reviews);
    console.log("[book-context] 합산 텍스트 길이:", searchResult.combinedText.length);
    console.log("[book-context] 총 소스 수:", searchResult.totalSources);

    // 중간 상태 업데이트
    await supabase
      .from("books")
      .update({
        context_data: {
          steps: {
            plot: searchResult.results.plot ? "success" : "warning",
            characters: searchResult.results.characters ? "success" : "warning",
            reviews: searchResult.results.reviews ? "success" : "warning",
            grok: searchResult.grokData.reactions.length > 0 ? "success" : "warning",
            structure: "pending",
          },
        },
      })
      .eq("id", bookId);

    // ═══ STEP 2: 검색 결과 → 구조화된 JSON ═══
    console.log("[book-context] ═══ STEP 2: 검색 결과 구조화 ═══");

    // 알라딘 소개글이 있으면 검색 결과에 추가
    let enrichedText = searchResult.combinedText;
    if (description) {
      enrichedText = `[알라딘 책 소개]\n${description}\n\n---\n\n${enrichedText}`;
      console.log("[book-context] 알라딘 소개글 추가:", description.slice(0, 100));
    }

    const contextData = await structureSearchResult(
      title,
      author || "",
      enrichedText,
    );

    // ═══ 상세 로그 ═══
    console.log("[book-context] known:", contextData.known);
    console.log("[book-context] plot_summary:", contextData.plot_summary);
    console.log("[book-context] plot_summary 길이:", typeof contextData.plot_summary === "string" ? contextData.plot_summary.length : 0);
    console.log("[book-context] characters:", JSON.stringify(contextData.medium));
    console.log("[book-context] themes:", contextData.themes);

    // ═══ STEP 3: 품질 평가 ═══
    const { quality, found } = assessQuality(contextData);
    console.log("[book-context] ═══ STEP 3: 품질 평가 ═══");
    console.log("[book-context] quality:", quality, "found:", found);

    // Grok 결과 로그
    console.log("[book-context] ═══ Grok 결과 요약 ═══");
    console.log("[book-context] Grok 반응 수:", searchResult.grokData.reactions.length);
    console.log("[book-context] Grok overall:", searchResult.grokData.overall_sentiment);
    console.log("[book-context] Grok topics:", searchResult.grokData.trending_topics);

    // 최종 데이터
    const finalData = {
      ...contextData,
      quality,
      found,
      // Grok 독자 반응 추가
      reader_voices: searchResult.grokData.reactions.length > 0 ? searchResult.grokData : undefined,
      steps: {
        plot: searchResult.results.plot ? "success" : "warning",
        characters: searchResult.results.characters ? "success" : "warning",
        reviews: searchResult.results.reviews ? "success" : "warning",
        grok: searchResult.grokData.reactions.length > 0 ? "success" : "warning",
        structure: "success",
      },
      _sourceCount: searchResult.totalSources,
    };

    const finalStatus = quality === "insufficient" ? "failed" : "done";

    // 글로벌 캐시 저장 (book_contexts 테이블)
    const cacheStatus = finalStatus === "done" ? "done" : "failed";
    const { error: cacheError } = await supabase
      .from("book_contexts")
      .upsert(
        {
          title_normalized: titleNorm,
          author_normalized: authorNorm,
          title_original: title,
          author_original: author || null,
          context_data: finalData,
          fetch_status: cacheStatus,
          hit_count: 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "title_normalized,author_normalized" },
      );
    console.log("[book-context] 글로벌 캐시 저장:", cacheError ? `실패 - ${cacheError.message}` : `성공 (${cacheStatus})`);

    // books 테이블 업데이트
    const { error: updateError } = await supabase
      .from("books")
      .update({
        context_data: finalData,
        context_status: finalStatus,
        context_fetched_at: new Date().toISOString(),
      })
      .eq("id", bookId);

    console.log("[book-context] ═══ STEP 4: DB 저장 ═══");
    console.log("[book-context] status:", finalStatus, "error:", updateError || "없음");

    return NextResponse.json({ context: finalData });
  } catch (err) {
    console.error("[book-context] Pipeline error:", err);

    const failedData = {
      steps: { plot: "failed", characters: "failed", reviews: "failed", grok: "failed", structure: "failed" },
      quality: "insufficient",
      found: { plot: false, characters: false, themes: false },
    };

    await Promise.all([
      supabase
        .from("books")
        .update({ context_status: "failed", context_data: failedData })
        .eq("id", bookId),
      supabase
        .from("book_contexts")
        .update({ fetch_status: "failed", updated_at: new Date().toISOString() })
        .eq("title_normalized", titleNorm)
        .eq("author_normalized", authorNorm),
    ]);

    return NextResponse.json({ context: null, error: "failed" }, { status: 500 });
  }
}
