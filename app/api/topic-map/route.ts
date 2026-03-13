import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getApiUser, unauthorized, tooManyRequests } from "@/lib/supabase/api-auth";
import { rateLimit } from "@/lib/rate-limit";

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

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    const prompt = `당신은 독서토론 전문가입니다. 아래 책의 핵심 토론 주제를 추출해주세요.

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

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return NextResponse.json({
        confidence: parsed.confidence || "low",
        topics: Array.isArray(parsed.topics) ? parsed.topics.slice(0, 7) : [],
      });
    }

    return NextResponse.json({ confidence: "low", topics: [] });
  } catch (error) {
    console.error("Topic map error:", error);
    return NextResponse.json({ confidence: "low", topics: [] }, { status: 500 });
  }
}
