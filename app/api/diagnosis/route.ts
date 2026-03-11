import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getApiUser, unauthorized, tooManyRequests } from "@/lib/supabase/api-auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const user = await getApiUser(req);
  if (!user) return unauthorized();

  const { success } = rateLimit(`diagnosis:${user.id}`, 5);
  if (!success) return tooManyRequests();

  const { messages } = await req.json();

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) {
    return NextResponse.json({ error: "messages: 1~100개 필요" }, { status: 400 });
  }

  const conversationSummary = messages
    .map((m: { role: string; content: string }) => `${m.role === "user" ? "유저" : "방긋"}: ${m.content}`)
    .join("\n");

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(
      `아래 독서토론 내용을 분석하여 독서 역량을 진단해주세요.

토론 내용:
${conversationSummary}

아래 5개 영역 각각에 대해 1-5점 점수와 한줄 코멘트를 JSON으로 응답:
{
  "dimensions": [
    {"id":"emotional","label":"감정적 몰입","score":4,"comment":"..."},
    {"id":"analytical","label":"분석적 사고","score":3,"comment":"..."},
    {"id":"personal","label":"개인적 연결","score":4,"comment":"..."},
    {"id":"critical","label":"비판적 시각","score":2,"comment":"..."},
    {"id":"creative","label":"창의적 해석","score":3,"comment":"..."}
  ],
  "summary":"전체 종합 코멘트 2-3문장"
}`
    );

    const text = result.response.text();
    const diagnosis = JSON.parse(text);

    return NextResponse.json({ diagnosis });
  } catch (error) {
    console.error("Diagnosis error:", error);
    return NextResponse.json({ error: "Diagnosis failed" }, { status: 500 });
  }
}
