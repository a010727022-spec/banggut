"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { upsertProfile, isNicknameAvailable } from "@/lib/supabase/queries";
import { useRouter, useSearchParams } from "next/navigation";
import { AVATAR_IMAGES, EMOJI_AVATARS, getAvatarSrc } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Suspense } from "react";
import { track, identifyUser, EVENTS } from "@/lib/analytics";

type Step = "login" | "taste" | "profile";
type AuthMode = "login" | "signup";
type TasteStep = 1 | 2 | 3;

const GENRE_OPTIONS = [
  { id: "novel", label: "소설", desc: "이야기 속으로", emoji: "📖" },
  { id: "essay", label: "에세이", desc: "일상의 사색", emoji: "🌙" },
  { id: "humanities", label: "인문·사회", desc: "세상 읽기", emoji: "📚" },
  { id: "selfhelp", label: "자기계발", desc: "성장 여정", emoji: "🌱" },
  { id: "science", label: "과학", desc: "우주와 생명", emoji: "🔬" },
  { id: "history", label: "역사", desc: "시간 여행", emoji: "🏛" },
  { id: "webnovel", label: "웹소설", desc: "요즘 핫한 것", emoji: "✨" },
  { id: "fantasy", label: "판타지·SF", desc: "상상의 세계", emoji: "🔮" },
  { id: "mystery", label: "추리·스릴러", desc: "쫄깃한 전개", emoji: "🕵" },
  { id: "romance", label: "로맨스", desc: "설레는 만남", emoji: "💘" },
  { id: "business", label: "경제·경영", desc: "돈과 일", emoji: "💼" },
  { id: "art", label: "예술·시", desc: "감각의 언어", emoji: "🎨" },
] as const;

const FREQUENCY_OPTIONS = [
  { id: "daily", label: "매일", desc: "하루를 책으로 시작하고 끝내요", emoji: "🌅" },
  { id: "weekly", label: "주 2~3회", desc: "꾸준히 읽는 편이에요", emoji: "📚" },
  { id: "monthly", label: "가끔", desc: "여유 있을 때 손에 잡아요", emoji: "🌙" },
  { id: "beginner", label: "이제 시작", desc: "습관을 만들어가는 중이에요", emoji: "🌱" },
] as const;

const STYLE_OPTIONS = [
  {
    id: "socratic",
    label: "소크라테스식",
    subtitle: "질문으로 생각을 끌어내요",
    sample: "그렇게 느낀 이유를 조금 더 들여다볼까요? 당신의 말 속에 답이 있을지도 몰라요.",
    emoji: "🏛",
  },
  {
    id: "empathetic",
    label: "공감식",
    subtitle: "감정과 경험을 나눠요",
    sample: "저도 그 장면에서 숨이 막혔어요. 어떤 순간이 떠오르셨어요?",
    emoji: "💗",
  },
  {
    id: "analytical",
    label: "분석식",
    subtitle: "작가의 의도와 구조를 뜯어봐요",
    sample: "작가가 왜 이 시점에 이 장면을 배치했다고 생각하세요?",
    emoji: "🔬",
  },
  {
    id: "free",
    label: "자유식",
    subtitle: "떠오르는 대로 편하게",
    sample: "이 부분 어떠셨어요? 저도 저만의 생각이 있는데 들어보실래요?",
    emoji: "🌿",
  },
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
  const [discussionStyles, setDiscussionStyles] = useState<string[]>([]);
  const toggleDiscussionStyle = (id: string) =>
    setDiscussionStyles((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  const [nicknameError, setNicknameError] = useState<string>("");
  const [nicknameChecking, setNicknameChecking] = useState(false);
  const [nicknameAvailable, setNicknameAvailable] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // 닉네임 입력 시 debounce 중복 체크
  useEffect(() => {
    const trimmed = nickname.trim();
    setNicknameAvailable(false);
    if (!trimmed || trimmed.length < 2) {
      setNicknameChecking(false);
      return;
    }
    setNicknameChecking(true);
    const timer = setTimeout(async () => {
      const available = await isNicknameAvailable(supabase, trimmed);
      setNicknameChecking(false);
      if (!available) {
        setNicknameError("이미 사용 중인 닉네임이에요");
        setNicknameAvailable(false);
      } else {
        setNicknameError("");
        setNicknameAvailable(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [nickname, supabase]);

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
        const returnTo = searchParams.get("returnTo");
        router.push(returnTo || "/");
        router.refresh();
      }
    }
    setLoading(false);
  };

  const handleProfileSetup = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      toast.error("닉네임을 입력해주세요");
      return;
    }
    if (trimmed.length < 2) {
      setNicknameError("두 글자 이상 입력해주세요");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인 필요");
      // 저장 직전 최종 중복 체크 (동시 가입 경쟁 상태 방지)
      const available = await isNicknameAvailable(supabase, trimmed, user.id);
      if (!available) {
        setNicknameError("이미 사용 중인 닉네임이에요");
        setLoading(false);
        return;
      }
      await upsertProfile(supabase, {
        id: user.id,
        nickname: nickname.trim(),
        emoji,
        preferred_genres: selectedGenres,
        reading_frequency: readingFrequency || undefined,
        discussion_styles: discussionStyles.length ? discussionStyles : undefined,
        onboarding_completed: true,
      });
      identifyUser(user.id, {
        nickname: nickname.trim(),
        emoji,
        preferred_genres: selectedGenres,
        reading_frequency: readingFrequency || undefined,
        discussion_styles: discussionStyles.length ? discussionStyles : undefined,
      });
      track(EVENTS.ONBOARDING_PROFILE_DONE, {
        avatar_type: emoji.length > 2 ? "author" : "emoji",
        genre_count: selectedGenres.length,
      });
      // returnTo 파라미터 있으면 거기로, 없으면 기본 flow
      const returnTo = searchParams.get("returnTo");
      if (returnTo) {
        router.push(returnTo);
      } else {
        router.push("/setup?onboarding=true");
      }
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
      track(EVENTS.ONBOARDING_TASTE_Q3, { styles: discussionStyles, count: discussionStyles.length });
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
    (tasteStep === 3 && discussionStyles.length === 0);

  if (step === "taste") {
    const progressSegments = [1, 2, 3] as const;
    const questions = [
      { q: "어떤 책을\n좋아하세요?", hint: "여러 개 선택 가능해요" },
      { q: "얼마나 자주\n읽으세요?", hint: "가까운 것 하나만 골라주세요" },
      { q: "어떤 방식으로\n이야기할까요?", hint: "여러 스타일을 함께 고를 수 있어요" },
    ];
    const current = questions[tasteStep - 1];
    const mascotPosition = tasteStep === 1 ? "33%" : tasteStep === 2 ? "66%" : "100%";

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          padding: "40px 20px 28px",
          animation: "fadeIn 0.3s ease-out",
          wordBreak: "keep-all",
        }}
      >
        {/* 진행 바 + 걸어가는 방긋이 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, position: "relative" }}>
          {progressSegments.map((seg) => (
            <div
              key={seg}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 100,
                background:
                  seg <= tasteStep
                    ? "linear-gradient(90deg, var(--ac), var(--ac2))"
                    : "color-mix(in srgb, var(--tm) 20%, transparent)",
                boxShadow: seg <= tasteStep ? "0 2px 8px color-mix(in srgb, var(--ac) 25%, transparent)" : "none",
                transition: "all 0.4s ease",
              }}
            />
          ))}
          <div
            style={{
              position: "absolute",
              top: -32,
              left: `calc(${mascotPosition} - 16px)`,
              width: 32,
              height: 32,
              transition: "left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
              filter: "drop-shadow(0 4px 8px rgba(107,158,138,0.3))",
            }}
          >
            <img src="/logo-banggut.svg" alt="" width={32} height={32} />
          </div>
        </div>

        {/* 질문 영역 */}
        <div
          style={{
            marginTop: 16,
            marginBottom: 24,
            display: "flex",
            gap: 14,
            alignItems: "center",
          }}
        >
          <div style={{ width: 84, height: 84, flexShrink: 0, animation: "bounceSoft 2.5s ease-in-out infinite" }}>
            <img src="/logo-banggut.svg" alt="방긋이" width={84} height={84} />
          </div>
          <div style={{ flex: 1 }}>
            <span
              style={{
                display: "inline-block",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--ac)",
                letterSpacing: "0.8px",
                marginBottom: 6,
                background: "color-mix(in srgb, var(--ac) 12%, var(--bg))",
                padding: "3px 10px",
                borderRadius: 100,
              }}
            >
              {tasteStep} / 3
            </span>
            <h2
              style={{
                fontFamily: "'Gaegu', cursive",
                fontSize: 22,
                fontWeight: 700,
                color: "var(--tp)",
                lineHeight: 1.35,
                letterSpacing: "0.01em",
                whiteSpace: "pre-line",
              }}
            >
              {current.q}
            </h2>
            <p style={{ fontSize: 12, color: "var(--tm)", marginTop: 8, lineHeight: 1.5 }}>
              {current.hint}
            </p>
          </div>
        </div>

        {/* 옵션 스크롤 영역 */}
        <div style={{ flex: 1, overflowY: "auto", margin: "0 -4px", padding: "0 4px" }}>
          {/* Q1: 12 genres */}
          {tasteStep === 1 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingBottom: 8 }}>
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
                      padding: "14px",
                      borderRadius: 20,
                      border: `1.5px solid ${selected ? "var(--ac)" : "color-mix(in srgb, var(--tm) 20%, transparent)"}`,
                      background: selected
                        ? "color-mix(in srgb, var(--ac) 9%, var(--bg))"
                        : "var(--sf)",
                      cursor: "pointer",
                      transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      textAlign: "left",
                      minHeight: 58,
                      boxShadow: selected
                        ? "0 4px 14px color-mix(in srgb, var(--ac) 15%, transparent)"
                        : "0 2px 6px rgba(45,58,53,0.03)",
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 14,
                        background: selected
                          ? "color-mix(in srgb, var(--ac) 18%, var(--sf2))"
                          : "var(--sf2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        flexShrink: 0,
                        transform: selected ? "rotate(-5deg) scale(1.05)" : "none",
                        transition: "all 0.2s",
                      }}
                    >
                      {g.emoji}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: selected ? 700 : 500,
                          color: selected ? "var(--ac)" : "var(--tp)",
                          lineHeight: 1.2,
                          letterSpacing: "-0.01em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {g.label}
                      </div>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: "var(--tm)",
                          marginTop: 2,
                          lineHeight: 1.3,
                          whiteSpace: "nowrap",
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

          {/* Q2: Frequency */}
          {tasteStep === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 8 }}>
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
                      padding: "16px 18px",
                      borderRadius: 22,
                      border: `1.5px solid ${selected ? "var(--ac)" : "color-mix(in srgb, var(--tm) 20%, transparent)"}`,
                      background: selected
                        ? "color-mix(in srgb, var(--ac) 9%, var(--bg))"
                        : "var(--sf)",
                      cursor: "pointer",
                      transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      textAlign: "left",
                      boxShadow: selected
                        ? "0 4px 14px color-mix(in srgb, var(--ac) 15%, transparent)"
                        : "0 2px 6px rgba(45,58,53,0.03)",
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 18,
                        background: selected
                          ? "color-mix(in srgb, var(--ac) 18%, var(--sf2))"
                          : "var(--sf2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                        flexShrink: 0,
                        transform: selected ? "rotate(-5deg) scale(1.05)" : "none",
                        transition: "all 0.2s",
                      }}
                    >
                      {f.emoji}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: selected ? 700 : 500,
                          color: selected ? "var(--ac)" : "var(--tp)",
                          lineHeight: 1.2,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {f.label}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--tm)", marginTop: 4, lineHeight: 1.4 }}>
                        {f.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Q3: Discussion styles (multi-select) */}
          {tasteStep === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 8 }}>
              {STYLE_OPTIONS.map((s) => {
                const selected = discussionStyles.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleDiscussionStyle(s.id)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      padding: "16px 18px",
                      borderRadius: 22,
                      border: `1.5px solid ${selected ? "var(--ac)" : "color-mix(in srgb, var(--tm) 20%, transparent)"}`,
                      background: selected
                        ? "color-mix(in srgb, var(--ac) 9%, var(--bg))"
                        : "var(--sf)",
                      cursor: "pointer",
                      transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      textAlign: "left",
                      boxShadow: selected
                        ? "0 4px 14px color-mix(in srgb, var(--ac) 15%, transparent)"
                        : "0 2px 6px rgba(45,58,53,0.03)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 16,
                          background: selected
                            ? "color-mix(in srgb, var(--ac) 18%, var(--sf2))"
                            : "var(--sf2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 18,
                          flexShrink: 0,
                          transform: selected ? "rotate(-5deg) scale(1.05)" : "none",
                          transition: "all 0.2s",
                        }}
                      >
                        {s.emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: selected ? "var(--ac)" : "var(--tp)",
                            lineHeight: 1.2,
                            marginBottom: 2,
                          }}
                        >
                          {s.label}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--tm)", fontWeight: 400, lineHeight: 1.3 }}>
                          {s.subtitle}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        borderLeft: `2.5px solid ${selected ? "var(--ac)" : "color-mix(in srgb, var(--tm) 20%, transparent)"}`,
                        paddingLeft: 14,
                        fontStyle: "italic",
                        fontSize: 12,
                        color: "var(--tm)",
                        lineHeight: 1.6,
                        transition: "border-color 0.2s",
                      }}
                    >
                      {s.sample}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 다음 버튼 */}
        <button
          onClick={handleTasteNext}
          disabled={isTasteNextDisabled}
          style={{
            marginTop: 16,
            width: "100%",
            height: 54,
            borderRadius: 100,
            background: "linear-gradient(135deg, var(--ac), var(--ac2))",
            color: "var(--acc)",
            fontFamily: "'Gaegu', cursive",
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: "0.04em",
            border: "none",
            cursor: isTasteNextDisabled ? "not-allowed" : "pointer",
            opacity: isTasteNextDisabled ? 0.4 : 1,
            boxShadow: isTasteNextDisabled
              ? "none"
              : "0 6px 18px color-mix(in srgb, var(--ac) 30%, transparent)",
            transition: "all 0.25s",
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
        {/* 선택된 아바타 프리뷰 (꽉 차게) */}
        <div className="mb-5">
          {(() => {
            const src = getAvatarSrc(emoji);
            return src ? (
              <div className="w-24 h-24 rounded-full mx-auto overflow-hidden ring-4 ring-ink-green/15">
                <img
                  src={src}
                  alt=""
                  className="w-full h-full object-cover scale-150"
                />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full mx-auto flex items-center justify-center bg-ink-green/10 text-5xl ring-4 ring-ink-green/15">
                {emoji}
              </div>
            );
          })()}
        </div>
        <h1
          className="text-[28px] text-ink-green mb-2 leading-none"
          style={{ fontFamily: "'Gaegu', cursive", fontWeight: 700, letterSpacing: "0.03em" }}
        >
          프로필 설정
        </h1>
        <p className="text-warmgray text-sm mb-6">나를 표현할 아바타와 닉네임을 골라주세요</p>

        {/* 작가 아바타 */}
        <p className="text-xs font-semibold text-warmgray mb-3">작가 아바타</p>
        <div className="grid grid-cols-3 gap-2.5 mb-6 max-w-[280px]">
          {AVATAR_IMAGES.map((av) => (
            <button
              key={av.id}
              onClick={() => setEmoji(av.id)}
              className={`flex flex-col items-center gap-2 p-2.5 rounded-[20px] transition-all ${
                emoji === av.id
                  ? "bg-ink-green/10 ring-2 ring-ink-green scale-105 shadow-lg"
                  : "bg-warm hover:bg-warmgray-dim"
              }`}
            >
              <div className="w-14 h-14 rounded-full overflow-hidden">
                <img
                  src={av.src}
                  alt={av.label}
                  className="w-full h-full object-cover scale-150"
                />
              </div>
              <span className="text-[10px] font-medium text-warmgray">{av.label}</span>
            </button>
          ))}
        </div>

        {/* 이모지 */}
        <p className="text-xs font-semibold text-warmgray mb-3">이모지</p>
        <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-[280px]">
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

        <div className="w-full max-w-xs mb-1">
          <Input
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setNicknameError("");
            }}
            placeholder="닉네임"
            maxLength={12}
            className="w-full h-12 text-center bg-warm border-[var(--bd2)] rounded-2xl focus:border-ink-green px-5"
          />
          {nicknameError && (
            <p className="text-xs text-terra mt-2 text-center font-medium">{nicknameError}</p>
          )}
          {!nicknameError && nickname.trim() && nicknameChecking && (
            <p className="text-xs text-warmgray-light mt-2 text-center">확인 중...</p>
          )}
          {!nicknameError && nickname.trim() && !nicknameChecking && nicknameAvailable && (
            <p className="text-xs text-ink-green mt-2 text-center font-medium">✓ 사용 가능한 닉네임이에요</p>
          )}
        </div>
        <div className="mb-3"></div>

        <Button
          onClick={handleProfileSetup}
          disabled={loading || !nickname.trim() || !!nicknameError || nicknameChecking}
          className="w-full max-w-xs bg-ink-green text-paper hover:bg-ink-medium rounded-full h-13 text-base font-semibold shadow-lg shadow-ink-green/25"
          style={{ height: 52 }}
        >
          {loading ? "저장 중" : "첫 번째 책 추가하기 →"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      {/* 심볼 */}
      <img
        src="/logo-banggut.svg"
        alt="방긋"
        className="w-28 h-28 mb-3"
      />
      {/* 워드마크 — 개구체 */}
      <h1
        className="text-[44px] text-ink-green mb-4 leading-none"
        style={{
          fontFamily: "'Gaegu', cursive",
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        방긋
      </h1>
      {/* 스토리 카피 — 긋는 애니메이션 */}
      <p
        className="text-ink-green mb-2 text-[17px] relative inline-block pb-1"
        style={{
          fontFamily: "'Gaegu', cursive",
          fontWeight: 400,
          letterSpacing: "0.02em",
        }}
      >
        방금 그은 문장에서
        <span className="absolute left-0 right-0 bottom-0 h-[3px] bg-gold rounded-full origin-left animate-draw-line" />
      </p>
      <p
        className="text-ink-green mb-12 text-[17px]"
        style={{
          fontFamily: "'Gaegu', cursive",
          fontWeight: 400,
          letterSpacing: "0.02em",
        }}
      >
        대화가 시작돼요
      </p>

      <Button
        onClick={handleKakaoLogin}
        disabled={loading}
        className="w-full max-w-xs bg-[#FEE500] text-[#191919] hover:bg-[#FDD835] rounded-full h-13 text-base font-semibold mb-3 shadow-lg shadow-yellow-500/15"
        style={{ height: 52 }}
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
          className="bg-warm border-[var(--bd2)] rounded-full h-12 px-5 focus:border-ink-green"
        />
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 (6자 이상)"
          className="bg-warm border-[var(--bd2)] rounded-full h-12 px-5 focus:border-ink-green"
        />
        <Button
          onClick={handleEmailAuth}
          disabled={loading || !email || !password}
          variant="outline"
          className="w-full rounded-full h-12 text-base font-semibold border-ink-green text-ink-green hover:bg-ink-green/5"
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
