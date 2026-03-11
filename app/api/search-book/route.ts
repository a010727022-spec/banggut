import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getApiUser, unauthorized, tooManyRequests } from "@/lib/supabase/api-auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const user = await getApiUser(req);
  if (!user) return unauthorized();

  const { success } = rateLimit(`search:${user.id}`, 20);
  if (!success) return tooManyRequests();

  const { query } = await req.json();

  if (!query || typeof query !== "string" || query.length > 200) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(
      `도서 검색 요청: '${query}'. 제목과 저자가 포함되어 있습니다. 이 검색어와 가장 일치하는 실제 도서 1-5권을 찾아주세요. JSON 배열로만 응답하세요. 다른 텍스트 없이 JSON만: [{"title":"...","author":"...","publisher":"...","year":2024}]`
    );

    const text = result.response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const books = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return NextResponse.json({ books });
  } catch (error) {
    console.error("Book search error:", error);
    return NextResponse.json({ books: [] }, { status: 500 });
  }
}
