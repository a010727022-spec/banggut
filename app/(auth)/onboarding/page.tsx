"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { upsertProfile } from "@/lib/supabase/queries";
import { useRouter, useSearchParams } from "next/navigation";
import { AVATAR_IMAGES, EMOJI_AVATARS, getAvatarSrc } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Suspense } from "react";

type Step = "login" | "profile";
type AuthMode = "login" | "signup";

function OnboardingContent() {
  const searchParams = useSearchParams();
  const initialStep = searchParams.get("step") === "profile" ? "profile" : "login";
  const [step, setStep] = useState<Step>(initialStep);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [emoji, setEmoji] = useState("hemingway");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // 이미 로그인된 유저가 프로필 없이 온보딩에 있으면 profile 단계로 전환
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && step === "login") {
        setStep("profile");
      }
    });
  }, [supabase, step]);

  const handleKakaoLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast.error("카카오 로그인에 실패했어요");
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password) return;
    setLoading(true);

    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        toast.error(error.message === "User already registered" ? "이미 가입된 이메일이에요" : `회원가입 실패: ${error.message}`);
      } else {
        toast.success("가입 완료! 프로필을 설정해주세요");
        setStep("profile");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        toast.error("이메일 또는 비밀번호가 맞지 않아요");
      } else {
        router.push("/");
        router.refresh();
      }
    }
    setLoading(false);
  };

  const handleProfileSetup = async () => {
    if (!nickname.trim()) {
      toast.error("닉네임을 입력해주세요");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인 필요");
      await upsertProfile(supabase, {
        id: user.id,
        nickname: nickname.trim(),
        emoji,
      });
      router.push("/");
      router.refresh();
    } catch {
      toast.error("프로필 저장에 실패했어요");
    }
    setLoading(false);
  };

  if (step === "profile") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6">
        <div className="mb-5">
          {(() => {
            const src = getAvatarSrc(emoji);
            return src ? (
              <img src={src} alt="" className="w-20 h-20 rounded-full mx-auto object-cover" />
            ) : (
              <div className="text-6xl text-center">{emoji}</div>
            );
          })()}
        </div>
        <h1 className="text-2xl font-black text-ink-green mb-2">프로필 설정</h1>
        <p className="text-warmgray text-sm mb-5">나를 표현할 아바타와 닉네임을 골라주세요</p>

        {/* 작가 아바타 */}
        <p className="text-xs font-semibold text-warmgray mb-2">작가 아바타</p>
        <div className="grid grid-cols-3 gap-2.5 mb-5 max-w-[280px]">
          {AVATAR_IMAGES.map((av) => (
            <button
              key={av.id}
              onClick={() => setEmoji(av.id)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${
                emoji === av.id
                  ? "bg-ink-green/10 ring-2 ring-ink-green scale-105"
                  : "bg-warm hover:bg-warmgray-dim"
              }`}
            >
              <img src={av.src} alt={av.label} className="w-14 h-14 rounded-full object-cover" />
              <span className="text-[10px] font-medium text-warmgray">{av.label}</span>
            </button>
          ))}
        </div>

        {/* 이모지 */}
        <p className="text-xs font-semibold text-warmgray mb-2">이모지</p>
        <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-[280px]">
          {EMOJI_AVATARS.map((em) => (
            <button
              key={em}
              onClick={() => setEmoji(em)}
              className={`text-2xl w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                emoji === em
                  ? "bg-ink-green/10 ring-2 ring-ink-green scale-110"
                  : "bg-warm hover:bg-warmgray-dim"
              }`}
            >
              {em}
            </button>
          ))}
        </div>

        <Input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임"
          maxLength={12}
          className="mb-4 w-full max-w-xs text-center bg-warm border-[var(--bd2)] rounded-btn focus:border-ink-green"
        />

        <Button
          onClick={handleProfileSetup}
          disabled={loading || !nickname.trim()}
          className="w-full max-w-xs bg-ink-green text-paper hover:bg-ink-medium rounded-btn h-12 text-base font-semibold"
        >
          {loading ? "저장 중..." : "시작하기"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="mb-2">
        <span className="text-5xl text-gold font-black">‿</span>
      </div>
      <h1 className="text-3xl font-black text-ink-green mb-1">방긋</h1>
      <p className="text-warmgray text-sm mb-2">읽고, 긋고, 방긋.</p>
      <p className="text-warmgray-light text-xs mb-12">
        방금 그은 문장에서 대화가 시작돼요
      </p>

      <Button
        onClick={handleKakaoLogin}
        disabled={loading}
        className="w-full max-w-xs bg-[#FEE500] text-[#191919] hover:bg-[#FDD835] rounded-btn h-12 text-base font-semibold mb-3"
      >
        카카오로 시작하기
      </Button>

      <div className="flex items-center gap-3 w-full max-w-xs my-4">
        <div className="flex-1 h-px bg-warmgray-dim" />
        <span className="text-xs text-warmgray-light">또는</span>
        <div className="flex-1 h-px bg-warmgray-dim" />
      </div>

      <div className="w-full max-w-xs space-y-3">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일 주소"
          className="bg-warm border-[var(--bd2)] rounded-btn focus:border-ink-green"
        />
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 (6자 이상)"
          className="bg-warm border-[var(--bd2)] rounded-btn focus:border-ink-green"
        />
        <Button
          onClick={handleEmailAuth}
          disabled={loading || !email || !password}
          variant="outline"
          className="w-full rounded-btn h-12 text-base font-semibold border-ink-green text-ink-green hover:bg-ink-green/5"
        >
          {authMode === "login" ? "로그인" : "회원가입"}
        </Button>
        <button
          onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
          className="w-full text-center text-sm text-warmgray hover:text-ink-green transition-colors"
        >
          {authMode === "login" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
        </button>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-warmgray">로딩 중...</div>}>
      <OnboardingContent />
    </Suspense>
  );
}
