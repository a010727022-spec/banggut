import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getApiUser, unauthorized, tooManyRequests } from "@/lib/supabase/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { countMeaningfulTurns, REQUIRED_MEANINGFUL_TURNS } from "@/lib/meaningful-turns";

export async function POST(req: Request) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const user = await getApiUser(req);
  if (!user) return unauthorized();

  const { success } = rateLimit(`review:${user.id}`, 5);
  if (!success) return tooManyRequests();

  const { messages, style, bookInfo } = await req.json();

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) {
    return NextResponse.json({ error: "messages: 1~100개 필요" }, { status: 400 });
  }

  // 유의미한 턴 검증
  const meaningful = countMeaningfulTurns(messages);
  if (meaningful < REQUIRED_MEANINGFUL_TURNS) {
    return NextResponse.json(
      {
        error: "토론이 충분하지 않아요",
        meaningfulTurns: meaningful,
        required: REQUIRED_MEANINGFUL_TURNS,
      },
      { status: 422 },
    );
  }
  if (!style || !["essay", "structured"].includes(style)) {
    return NextResponse.json({ error: "Invalid style" }, { status: 400 });
  }

  const conversationSummary = messages
    .slice(-20)
    .map((m: { role: string; content: string }) => `${m.role === "user" ? "유저" : "방긋"}: ${m.content}`)
    .join("\n");

  const prompt =
    style === "essay"
      ? `아래 토론 내용을 바탕으로 에세이형 서평 초안을 작성해주세요.
책 정보: ${bookInfo}
토론 내용:
${conversationSummary}

자연스러운 에세이 형식으로, 개인적 감상과 분석을 섞어 작성해주세요. 800-1200자 정도.
순수 텍스트로만 응답하세요. JSON이나 마크다운 포맷 없이.`
      : `아래 토론 내용을 바탕으로 구조형 서평 초안을 작성해주세요.
책 정보: ${bookInfo}
토론 내용:
${conversationSummary}

아래 JSON 형식으로 응답:
{"oneliner":"한줄평","keywords":["키워드1","키워드2","키워드3"],"target":"추천 대상","body":"본문 서평 500-800자"}`;

  try {
    const isStructured = style === "structured";
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      ...(isStructured && {
        generationConfig: { responseMimeType: "application/json" },
      }),
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    if (isStructured) {
      const content = JSON.parse(text);
      return NextResponse.json({ content });
    }

    return NextResponse.json({ content: { body: text } });
  } catch (error) {
    console.error("Review error:", error);
    return NextResponse.json({ error: "Review generation failed" }, { status: 500 });
  }
}
