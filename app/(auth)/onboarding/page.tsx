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
import { BookOpen, Search, MessageCircle, HelpCircle } from "lucide-react";
import { track, identifyUser, EVENTS } from "@/lib/analytics";

type Step = "login" | "taste" | "profile";
type AuthMode = "login" | "signup";
type TasteStep = 1 | 2 | 3;

const GENRE_OPTIONS = [
  { id: "novel", label: "소설", desc: "이야기에 빠져들기" },
  { id: "essay", label: "에세이", desc: "누군가의 일상과 생각" },
  { id: "humanities", label: "인문학", desc: "세상을 이해하는 렌즈" },
  { id: "selfhelp", label: "자기계발", desc: "더 나은 내일을 위해" },
  { id: "poetry", label: "시 · 산문", desc: "한 줄의 여운" },
  { id: "sf", label: "SF · 판타지", desc: "상상의 세계로" },
] as const;

const FREQUENCY_OPTIONS = [
  { id: "daily", label: "거의 매일", desc: "책 없이는 하루가 안 끝나요" },
  { id: "weekly", label: "주 2~3회", desc: "틈틈이 꾸준히 읽어요" },
  { id: "monthly", label: "월 1~2권 정도", desc: "한 권을 천천히 음미해요" },
  { id: "beginner", label: "다시 시작하는 중", desc: "독서 습관을 만들고 싶어요" },
] as const;

const STYLE_OPTIONS = [
  { id: "casual", label: "편하게 감상 나누기", sample: "이 장면에서 나도 모르게 눈물이 났어. 너는 어떤 느낌이었어?" },
  { id: "analytical", label: "깊이 있는 분석과 토론", sample: "이 상징이 작가의 전작과 어떻게 연결되는지, 함께 분석해볼까요?" },
  { id: "socratic", label: "생각을 자극하는 질문", sample: "만약 당신이 주인공이었다면, 그 순간 어떤 선택을 했을까요?" },
] as const;

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
  const [tasteStep, setTasteStep] = useState<TasteStep>(1);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [readingFrequency, setReadingFrequency] = useState<string>("");
  const [discussionStyle, setDiscussionStyle] = useState<string>("");
  const router = useRouter();
  const supabase = createClient();

  // 이미 로그인된 유저가 프로필 없이 온보딩에 있으면 taste 단계로 전환
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && step === "login") {
        setStep("taste");
      }
    });
  }, [supabase, step]);

  const handleKakaoLogin = async () => {
    setLoading(true);
    track(EVENTS.SIGNUP_STARTED, { method: "kakao" });
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
      track(EVENTS.SIGNUP_STARTED, { method: "email" });
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        toast.error(error.message === "User already registered" ? "이미 가입된 이메일이에요" : `회원가입 실패: ${error.message}`);
      } else {
        track(EVENTS.SIGNUP_COMPLETED, { method: "email" });
        toast.success("가입 완료! 취향을 알려주세요");
        setStep("taste");
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
        preferred_genres: selectedGenres,
        reading_frequency: readingFrequency || undefined,
        discussion_style: discussionStyle || undefined,
        onboarding_completed: true,
      });
      identifyUser(user.id, {
        nickname: nickname.trim(),
        emoji,
        preferred_genres: selectedGenres,
        reading_frequency: readingFrequency || undefined,
        discussion_style: discussionStyle || undefined,
      });
      track(EVENTS.ONBOARDING_PROFILE_DONE, {
        avatar_type: emoji.length > 2 ? "author" : "emoji",
        genre_count: selectedGenres.length,
      });
      router.push("/setup?onboarding=true");
      router.refresh();
    } catch {
      toast.error("프로필 저장에 실패했어요");
    }
    setLoading(false);
  };

  const toggleGenre = (id: string) => {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleTasteNext = () => {
    if (tasteStep === 1) {
      track(EVENTS.ONBOARDING_TASTE_Q1, { genres: selectedGenres, count: selectedGenres.length });
    } else if (tasteStep === 2) {
      track(EVENTS.ONBOARDING_TASTE_Q2, { frequency: readingFrequency });
    } else if (tasteStep === 3) {
      track(EVENTS.ONBOARDING_TASTE_Q3, { style: discussionStyle });
    }

    if (tasteStep < 3) {
      setTasteStep((prev) => (prev + 1) as TasteStep);
    } else {
      setStep("profile");
    }
  };

  const isTasteNextDisabled =
    (tasteStep === 1 && selectedGenres.length === 0) ||
    (tasteStep === 2 && !readingFrequency) ||
    (tasteStep === 3 && !discussionStyle);

  const getStyleIcon = (id: string) => {
    if (id === "casual") return <MessageCircle size={18} />;
    if (id === "analytical") return <Search size={18} />;
    return <HelpCircle size={18} />;
  };

  if (step === "taste") {
    const progressSegments = [1, 2, 3] as const;

    const questions = [
      { q: "어떤 장르의\n책을 즐기시나요?", hint: "여러 개 선택할 수 있어요" },
      { q: "평소 독서를\n얼마나 자주 하시나요?", hint: "가장 가까운 것을 골라주세요" },
      { q: "어떤 방식으로\n이야기를 나누고 싶으신가요?", hint: "AI와의 토론 스타일을 정해요" },
    ];

    const current = questions[tasteStep - 1];

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          padding: "48px 24px 32px",
          animation: "fadeIn 0.3s ease-out",
        }}
      >
        {/* Progress bar */}
        <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
          {progressSegments.map((seg) => (
            <div
              key={seg}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background:
                  seg <= tasteStep
                    ? "linear-gradient(90deg, var(--ac), var(--ac2))"
                    : "var(--sf3)",
                transition: "background 0.3s ease",
              }}
            />
          ))}
        </div>

        {/* Question */}
        <div style={{ marginBottom: 8 }}>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "var(--tp)",
              lineHeight: 1.4,
              whiteSpace: "pre-line",
              fontFamily: "Pretendard, sans-serif",
            }}
          >
            {current.q}
          </h2>
        </div>
        <p style={{ fontSize: 12, color: "var(--tm)", marginBottom: 28 }}>
          {current.hint}
        </p>

        {/* Q1: Genre grid */}
        {tasteStep === 1 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              flex: 1,
            }}
          >
            {GENRE_OPTIONS.map((g) => {
              const selected = selectedGenres.includes(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => toggleGenre(g.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1.5px solid ${selected ? "var(--ac)" : "var(--bd2)"}`,
                    background: selected
                      ? "color-mix(in srgb, var(--ac) 12%, var(--bg))"
                      : "var(--sf)",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: selected
                        ? "color-mix(in srgb, var(--ac) 18%, var(--sf2))"
                        : "var(--sf2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: selected ? "var(--ac)" : "var(--ts)",
                      flexShrink: 0,
                    }}
                  >
                    <BookOpen size={16} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: selected ? "var(--ac)" : "var(--tp)",
                        lineHeight: 1.2,
                      }}
                    >
                      {g.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--tm)",
                        marginTop: 2,
                        lineHeight: 1.3,
                      }}
                    >
                      {g.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Q2: Frequency list */}
        {tasteStep === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
            {FREQUENCY_OPTIONS.map((f) => {
              const selected = readingFrequency === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setReadingFrequency(f.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: `1.5px solid ${selected ? "var(--ac)" : "var(--bd2)"}`,
                    background: selected
                      ? "color-mix(in srgb, var(--ac) 12%, var(--bg))"
                      : "var(--sf)",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: selected
                        ? "color-mix(in srgb, var(--ac) 18%, var(--sf2))"
                        : "var(--sf2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: selected ? "var(--ac)" : "var(--ts)",
                      flexShrink: 0,
                    }}
                  >
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: selected ? "var(--ac)" : "var(--tp)",
                        lineHeight: 1.2,
                      }}
                    >
                      {f.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--tm)",
                        marginTop: 3,
                      }}
                    >
                      {f.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Q3: Style list */}
        {tasteStep === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
            {STYLE_OPTIONS.map((s) => {
              const selected = discussionStyle === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setDiscussionStyle(s.id)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: `1.5px solid ${selected ? "var(--ac)" : "var(--bd2)"}`,
                    background: selected
                      ? "color-mix(in srgb, var(--ac) 12%, var(--bg))"
                      : "var(--sf)",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 9,
                        background: selected
                          ? "color-mix(in srgb, var(--ac) 18%, var(--sf2))"
                          : "var(--sf2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: selected ? "var(--ac)" : "var(--ts)",
                        flexShrink: 0,
                      }}
                    >
                      {getStyleIcon(s.id)}
                    </div>
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: selected ? "var(--ac)" : "var(--tp)",
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                  <div
                    style={{
                      borderLeft: `2px solid ${selected ? "var(--ac)" : "var(--bd2)"}`,
                      paddingLeft: 12,
                      fontStyle: "italic",
                      fontSize: 12,
                      color: "var(--tm)",
                      lineHeight: 1.5,
                      transition: "border-color 0.18s ease",
                    }}
                  >
                    {s.sample}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Next button */}
        <button
          onClick={handleTasteNext}
          disabled={isTasteNextDisabled}
          style={{
            marginTop: 28,
            width: "100%",
            height: 52,
            borderRadius: 12,
            background: "var(--ac)",
            color: "var(--acc)",
            fontSize: 16,
            fontWeight: 700,
            border: "none",
            cursor: isTasteNextDisabled ? "not-allowed" : "pointer",
            opacity: isTasteNextDisabled ? 0.4 : 1,
            transition: "opacity 0.2s ease",
            fontFamily: "Pretendard, sans-serif",
          }}
        >
          {tasteStep === 3 ? "완료" : "다음"}
        </button>
      </div>
    );
  }

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
          {loading ? "저장 중" : "첫 번째 책 추가하기 →"}
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
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-warmgray">로딩 중</div>}>
      <OnboardingContent />
    </Suspense>
  );
}
