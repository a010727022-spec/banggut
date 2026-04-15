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

export async function POST(req: Request) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const user = await getApiUser(req);
  if (!user) return unauthorized();

  const { success } = rateLimit(`topicmap:${user.id}`, 10);
  if (!success) return tooManyRequests();

  const { title, author } = await req.json();

  if (!title || typeof title !== "string" || title.length > 200) {
    return NextResponse.json({ error: "Invalid title" }, { status: 400 });
  }

  const supabase = getSupabase();
  const titleNorm = normalizeKey(title);
  const authorNorm = normalizeKey(author || "");

  // ═══ 글로벌 캐시 확인 (book_contexts.topic_map) ═══
  const { data: cached } = await supabase
    .from("book_contexts")
    .select("topic_map")
    .eq("title_normalized", titleNorm)
    .eq("author_normalized", authorNorm)
    .single();

  if (cached?.topic_map) {
    console.log("[topic-map] 글로벌 캐시 히트:", title);
    return NextResponse.json({ ...cached.topic_map, cached: true });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    const prompt = `당신은 토론 전문가입니다. 아래 책의 핵심 토론 주제를 추출해주세요.

책: 「${title}」 ${author ? `— ${author}` : ""}

[규칙]
- 이 책을 알고 있다면 confidence를 "high"로, 잘 모르거나 불확실하면 "low"로 표시
- confidence가 high일 때만 topics를 5-7개 추출
- confidence가 low이면 topics를 빈 배열로 반환
- 각 주제는 해석이나 결론을 포함하지 마세요
- "이 책의 메시지는 X이다" 식의 단정 금지
- 주제만 제시하고 방향은 열어두세요

좋은 예: "모녀 관계의 갈등과 화해"
나쁜 예: "엄마의 회피는 가부장제의 산물이다"

좋은 예: "신분/계급 문제"
나쁜 예: "백정 차별이 여성 억압의 근원이다"

[응답 형식 — JSON만, 다른 텍스트 없이]
{"confidence":"high","topics":["주제1","주제2",...]}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    const topicMap = {
      confidence: parsed?.confidence || "low",
      topics: Array.isArray(parsed?.topics) ? parsed.topics.slice(0, 7) : [],
    };

    // ═══ 캐시 저장 (confidence가 high일 때만) ═══
    // low면 다음 호출에서 재시도 기회를 남기기 위해 저장 안 함
    if (topicMap.confidence === "high" && topicMap.topics.length > 0) {
      await supabase
        .from("book_contexts")
        .upsert(
          {
            title_normalized: titleNorm,
            author_normalized: authorNorm,
            title_original: title,
            author_original: author || null,
            topic_map: topicMap,
            topic_map_fetched_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "title_normalized,author_normalized" },
        );
      console.log("[topic-map] 캐시 저장:", title);
    }

    return NextResponse.json(topicMap);
  } catch (error) {
    console.error("Topic map error:", error);
    return NextResponse.json({ confidence: "low", topics: [] }, { status: 500 });
  }
}
