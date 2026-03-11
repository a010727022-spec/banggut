import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getApiUser, unauthorized, tooManyRequests } from "@/lib/supabase/api-auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const user = await getApiUser(req);
  if (!user) return unauthorized();

  const { success } = rateLimit(`ocr:${user.id}`, 10);
  if (!success) return tooManyRequests();

  const { image } = await req.json();

  if (!image || typeof image !== "string" || image.length > 10_000_000) {
    return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: image,
        },
      },
      "이 이미지에 있는 텍스트를 정확하게 읽어서 그대로 출력하세요. 설명, 해석, 요약 없이 원문 텍스트만 출력하세요. 줄바꿈은 원본과 동일하게 유지하세요.",
    ]);

    const text = result.response.text();
    return NextResponse.json({ text: text.trim() });
  } catch (error) {
    console.error("OCR error:", error);
    return NextResponse.json({ text: "", error: "OCR failed" }, { status: 500 });
  }
}
