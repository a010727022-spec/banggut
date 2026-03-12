import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getApiUser, unauthorized, tooManyRequests } from "@/lib/supabase/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();

  const { success } = rateLimit(`book-context:${user.id}`, 10);
  if (!success) return tooManyRequests();

  const { title, author, bookId } = await req.json();

  if (!title || !bookId) {
    return NextResponse.json({ error: "title and bookId required" }, { status: 400 });
  }

  const supabase = getSupabase();

  // 캐시 확인: 이미 완료된 컨텍스트가 있으면 바로 반환
  const { data: existing } = await supabase
    .from("books")
    .select("context_data, context_status")
    .eq("id", bookId)
    .single();

  if (existing?.context_status === "done" && existing.context_data) {
    return NextResponse.json({ context: existing.context_data, cached: true });
  }

  // 중복 방지: 이미 fetching 중이면 스킵
  if (existing?.context_status === "fetching") {
    return NextResponse.json({ context: null, status: "already_fetching" });
  }

  // Lock: fetching 상태로 전환
  await supabase
    .from("books")
    .update({ context_status: "fetching" })
    .eq("id", bookId);

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const searchQuery = `${title} ${author || ""} 줄거리 등장인물`;

    const result = await model.generateContent(
      `다음 검색어로 웹을 검색하여 이 책의 정보를 정리해주세요: "${searchQuery}"

대상 책: "${title}"${author ? ` — ${author}` : ""}

⚠️ 매우 중요:
- 오직 "${title}" 한 권에 대한 정보만. 다른 책 혼동 금지.
- 같은 작가의 다른 작품 정보를 섞지 마세요.
- 확실하지 않으면 해당 필드를 null로.

JSON 응답:
{
  "known": true,
  "high": {
    "author": "저자명",
    "year": "출간년도",
    "genre": "장르",
    "author_note": "작가에 대한 한 줄 설명"
  },
  "medium": {
    "characters": [
      {"name": "이름", "desc": "역할/성격", "relations": "다른 인물과의 관계"}
    ],
    "setting": "배경 시대/장소",
    "narrative": "서술 시점, 문체 특징"
  },
  "plot_summary": "줄거리 요약 (핵심 갈등 포함, 스포일러 최소화, 3-5문장)",
  "themes": ["핵심 주제1", "주제2", "주제3"],
  "interpretations": ["독자들의 해석1", "해석2", "해석3"],
  "key_scenes": ["인상적인 장면1", "장면2"],
  "discussion_hooks": ["토론 질문1", "질문2", "질문3"],
  "author_intent": "작가가 밝힌 집필 의도 (없으면 null)"
}

이 책을 전혀 모르면: {"known": false}`,
    );

    const text = result.response.text();
    const contextData = JSON.parse(text);

    // DB 저장
    await supabase
      .from("books")
      .update({
        context_data: contextData,
        context_status: contextData.known ? "done" : "failed",
        context_fetched_at: new Date().toISOString(),
      })
      .eq("id", bookId);

    return NextResponse.json({ context: contextData });
  } catch (err) {
    console.error("[book-context] Gemini error:", err);

    // 실패 상태 저장
    await supabase
      .from("books")
      .update({ context_status: "failed" })
      .eq("id", bookId);

    return NextResponse.json({ context: null, error: "failed" }, { status: 500 });
  }
}
