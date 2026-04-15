import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getApiUser, unauthorized, tooManyRequests } from "@/lib/supabase/api-auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const user = await getApiUser(req);
  if (!user) return unauthorized();

  const { success } = rateLimit(`summary:${user.id}`, 10);
  if (!success) return tooManyRequests();

  const { messages } = await req.json();

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) {
    return NextResponse.json({ error: "messages: 1~100개 필요" }, { status: 400 });
  }

  const conversationSummary = messages
    .map((m: { role: string; content: string }) => `${m.role === "user" ? "유저" : "방긋"}: ${m.content}`)
    .join("\n");

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    const result = await model.generateContent(
      `아래 토론 내용을 여정 요약으로 정리해주세요.

토론 내용:
${conversationSummary}

마크다운 형식으로:
1. 주요 논점 3-5개
2. 인상적인 발언 2-3개 (인용)
3. 관점 변화 순간
4. 핵심 인사이트`
    );

    const text = result.response.text();
    return NextResponse.json({ summary: text });
  } catch (error) {
    console.error("Summary error:", error);
    return NextResponse.json({ error: "Summary failed" }, { status: 500 });
  }
}
