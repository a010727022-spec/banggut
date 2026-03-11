import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getApiUser, unauthorized, tooManyRequests } from "@/lib/supabase/api-auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const user = await getApiUser(req);
  if (!user) return unauthorized();

  const { success } = rateLimit(`review:${user.id}`, 5);
  if (!success) return tooManyRequests();

  const { messages, style, bookInfo } = await req.json();

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) {
    return NextResponse.json({ error: "messages: 1~100개 필요" }, { status: 400 });
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
      ? `아래 독서토론 내용을 바탕으로 에세이형 서평 초안을 작성해주세요.
책 정보: ${bookInfo}
토론 내용:
${conversationSummary}

자연스러운 에세이 형식으로, 개인적 감상과 분석을 섞어 작성해주세요. 800-1200자 정도.`
      : `아래 독서토론 내용을 바탕으로 구조형 서평 초안을 작성해주세요.
책 정보: ${bookInfo}
토론 내용:
${conversationSummary}

아래 JSON 형식으로 응답:
{"oneliner":"한줄평","keywords":["키워드1","키워드2","키워드3"],"target":"추천 대상","body":"본문 서평 500-800자"}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.choices[0]?.message?.content || "";

    if (style === "structured") {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const content = jsonMatch ? JSON.parse(jsonMatch[0]) : { body: text };
      return NextResponse.json({ content });
    }

    return NextResponse.json({ content: { body: text } });
  } catch (error) {
    console.error("Review error:", error);
    return NextResponse.json({ error: "Review generation failed" }, { status: 500 });
  }
}
