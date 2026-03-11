import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/queries";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const profile = await getProfile(supabase, user.id);
        if (!profile) {
          // 신규 유저 → 프로필 설정으로
          return NextResponse.redirect(`${origin}/onboarding?step=profile`);
        }
      }
      return NextResponse.redirect(origin);
    }
  }

  return NextResponse.redirect(`${origin}/onboarding`);
}
