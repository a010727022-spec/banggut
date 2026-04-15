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

  const { image, mode } = await req.json();

  if (!image || typeof image !== "string" || image.length > 10_000_000) {
    return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
  }

  const prompt = mode === "highlight"
    ? `이 이미지는 전자책(e-book) 캡처 화면입니다.
밑줄(형광펜, 색상 강조 등 모든 강조 표시 포함)이 되어 있는 문장만 정확하게 추출하세요.
밑줄이 없는 일반 텍스트는 무시하세요.
밑줄 친 문장이 여러 개면 줄바꿈으로 구분하세요.
설명, 해석, 요약 없이 밑줄 친 원문 텍스트만 출력하세요.
만약 밑줄이 없으면 이미지의 전체 텍스트를 출력하세요.`
    : "이 이미지에 있는 텍스트를 정확하게 읽어서 그대로 출력하세요. 설명, 해석, 요약 없이 원문 텍스트만 출력하세요. 줄바꿈은 원본과 동일하게 유지하세요.";

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: image,
        },
      },
      prompt,
    ]);

    const text = result.response.text();
    return NextResponse.json({ text: text.trim() });
  } catch (error) {
    console.error("OCR error:", error);
    return NextResponse.json({ text: "", error: "OCR failed" }, { status: 500 });
  }
}
