"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, X, Check } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  useHomeLayoutStore,
  type HomeLayout,
} from "@/stores/useHomeLayoutStore";

/* ═══════════════════════════════════════════
   홈 화면 테마 선택 페이지 (/settings/home-theme)
   ═══════════════════════════════════════════
   - 선택: hero (이어 읽기 HERO) / calendar (캘린더 First)
   - 저장: Supabase profiles.home_layout + useHomeLayoutStore
   - 저장 후 router.back() (홈으로 즉시 반영)
*/

interface OptionDef {
  id: HomeLayout;
  name: string;
  tag: string;
  desc: string;
}

const OPTIONS: OptionDef[] = [
  {
    id: "hero",
    name: "이어 읽기 HERO",
    tag: "책 중심",
    desc: "어제 멈춘 곳·마지막 문장을 크게. 캘린더·커뮤니티는 탭으로 전환.",
  },
  {
    id: "calendar",
    name: "캘린더 First",
    tag: "일정 중심",
    desc: "오늘 일정부터 한눈에. 이어 읽기는 진행률로 담백하게.",
  },
];

/* ═══ Mini preview (추상 썸네일) ═══ */

function MiniHeroPreview() {
  // 민트 HERO + 세그먼트 2개 + 라인 2개
  return (
    <div
      style={{
        width: 72,
        height: 104,
        borderRadius: 9,
        background: "var(--bg)",
        border: "0.5px solid var(--bd)",
        padding: "7px 6px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* HERO */}
      <div
        style={{
          flex: 1.6,
          background:
            "linear-gradient(155deg, var(--ac), color-mix(in srgb, var(--ac) 70%, #000))",
          borderRadius: 5,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 6,
            bottom: 5,
            right: 6,
            height: 7,
            background: "var(--sf)",
            borderRadius: 2,
            opacity: 0.92,
          }}
        />
      </div>
      {/* 세그먼트 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 2,
          background: "var(--sf3)",
          padding: 2,
          borderRadius: 3,
          minHeight: 10,
        }}
      >
        <div style={{ background: "var(--sf)", borderRadius: 2 }} />
        <div style={{ background: "transparent" }} />
      </div>
      {/* 라인 */}
      <div
        style={{ height: 4, borderRadius: 100, background: "var(--sf3)", width: "60%" }}
      />
      <div
        style={{ height: 4, borderRadius: 100, background: "var(--sf3)", width: "36%" }}
      />
    </div>
  );
}

function MiniCalendarPreview() {
  // 캘린더 도트 + 컴팩트 이어 읽기 + CTA
  return (
    <div
      style={{
        width: 72,
        height: 104,
        borderRadius: 9,
        background: "var(--bg)",
        border: "0.5px solid var(--bd)",
        padding: "7px 6px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* 캘린더 */}
      <div
        style={{
          flex: 1.2,
          background: "var(--sf)",
          border: "0.5px solid var(--bd)",
          borderRadius: 5,
          padding: 4,
          display: "flex",
          flexDirection: "column",
          gap: 3,
          justifyContent: "space-around",
        }}
      >
        <div style={{ display: "flex", gap: 2, justifyContent: "space-between" }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: i === 6 ? "transparent" : "var(--ac)",
                border: i === 6 ? "1px solid var(--ac)" : "none",
                boxSizing: "border-box",
              }}
            />
          ))}
        </div>
        <div
          style={{ height: 4, borderRadius: 100, background: "var(--sf3)", width: "60%" }}
        />
        <div
          style={{ height: 4, borderRadius: 100, background: "var(--sf3)", width: "36%" }}
        />
      </div>
      {/* 컴팩트 CC */}
      <div
        style={{
          background: "var(--sf)",
          border: "0.5px solid var(--bd)",
          borderRadius: 4,
          padding: "3px 4px",
          display: "flex",
          gap: 3,
          alignItems: "center",
          minHeight: 20,
        }}
      >
        <div
          style={{
            width: 9,
            height: 13,
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--ac) 60%, #000), color-mix(in srgb, var(--ac) 30%, #000))",
            borderRadius: 1,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <div
            style={{
              height: 4,
              borderRadius: 100,
              background: "var(--sf3)",
              width: "60%",
            }}
          />
          <div
            style={{
              height: 4,
              borderRadius: 100,
              background: "var(--sf3)",
              width: "36%",
            }}
          />
        </div>
      </div>
      {/* CTA */}
      <div
        style={{
          height: 8,
          borderRadius: 3,
          background: "var(--ac)",
          marginTop: 1,
        }}
      />
    </div>
  );
}

/* ═══ 메인 ═══ */

export default function HomeThemeSettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const currentLayout = useHomeLayoutStore((s) => s.layout);
  const setLayout = useHomeLayoutStore((s) => s.setLayout);

  const [selected, setSelected] = useState<HomeLayout>(currentLayout);
  const [saving, setSaving] = useState(false);

  // 마운트 시 현재 DB 값으로 동기화 (스토어가 아직 hydrate되지 않은 경우 대비)
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("home_layout")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const v = data?.home_layout as HomeLayout | undefined;
        if (v === "hero" || v === "calendar") {
          setSelected(v);
          if (v !== currentLayout) setLayout(v);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const hasChanged = useMemo(
    () => selected !== currentLayout,
    [selected, currentLayout]
  );

  const handleApply = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ home_layout: selected })
        .eq("id", user.id);
      if (error) throw error;
      setLayout(selected);
      const label =
        selected === "hero" ? "이어 읽기 HERO" : "캘린더 First";
      toast.success(`홈을 ${label}으로 바꿨어요`);
      router.back();
    } catch {
      toast.error("저장에 실패했어요. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        paddingBottom: 40,
        transition: "background var(--duration-slow) var(--easing-default)",
      }}
    >
      {/* 모달 헤더 */}
      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "0.5px solid var(--bd)",
          position: "sticky",
          top: 0,
          background: "color-mix(in srgb, var(--bg) 92%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          zIndex: 10,
        }}
      >
        <button
          onClick={() => router.back()}
          type="button"
          aria-label="뒤로 가기"
          style={{
            width: 40,
            height: 40,
            minWidth: 40,
            borderRadius: "50%",
            background: "transparent",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--tp)",
            transition:
              "background var(--duration-fast) var(--easing-default)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--sf2)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <ArrowLeft size={20} strokeWidth={2.2} />
        </button>
        <div
          style={{
            flex: 1,
            fontSize: 16,
            fontWeight: 700,
            color: "var(--tp)",
            letterSpacing: "-0.02em",
            textAlign: "center",
          }}
        >
          홈 화면 테마
        </div>
        <button
          onClick={() => router.back()}
          type="button"
          aria-label="닫기"
          style={{
            width: 40,
            height: 40,
            minWidth: 40,
            borderRadius: "50%",
            background: "var(--sf)",
            border: "0.5px solid var(--bd)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--ts)",
          }}
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>

      <div style={{ padding: "0 20px", maxWidth: 512, margin: "0 auto" }}>
        {/* 히어로 영역 */}
        <div style={{ padding: "22px 4px 20px", textAlign: "center" }}>
          <div
            style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}
          >
            <div
              style={{
                width: 68,
                height: 68,
                minWidth: 68,
                borderRadius: "50%",
                background: "color-mix(in srgb, var(--ac) 14%, var(--sf))",
                border:
                  "1px solid color-mix(in srgb, var(--ac) 18%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <img
                src="/mascot-happy.png"
                alt="웃고 있는 방긋이"
                style={{ width: 60, height: 60, objectFit: "contain" }}
              />
            </div>
          </div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "var(--tp)",
              lineHeight: 1.3,
              letterSpacing: "-0.02em",
              marginBottom: 8,
            }}
          >
            나에게 맞는 홈을
            <br />
            골라보세요
          </h2>
          <p style={{ fontSize: 12.5, color: "var(--ts)", lineHeight: 1.5 }}>
            언제든 설정에서 다시 바꿀 수 있어요
          </p>
        </div>

        {/* 옵션 카드들 */}
        <div
          role="radiogroup"
          aria-label="홈 화면 테마 선택"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginBottom: 18,
          }}
        >
          {OPTIONS.map((opt) => {
            const on = selected === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSelected(opt.id)}
                style={{
                  background: on
                    ? "color-mix(in srgb, var(--ac) 10%, var(--sf))"
                    : "var(--sf)",
                  border: on
                    ? "2px solid var(--ac)"
                    : "2px solid var(--bd)",
                  borderRadius: 16,
                  padding: 14,
                  display: "grid",
                  gridTemplateColumns: "72px 1fr 22px",
                  gap: 14,
                  alignItems: "center",
                  cursor: "pointer",
                  transition: "all var(--duration-fast) var(--easing-default)",
                  fontFamily: "inherit",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                {opt.id === "hero" ? <MiniHeroPreview /> : <MiniCalendarPreview />}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--tp)",
                      letterSpacing: "-0.015em",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {opt.name}
                    <span
                      style={{
                        fontFamily: "var(--font-playful)",
                        fontSize: 11,
                        fontWeight: 700,
                        background: on
                          ? "var(--ac)"
                          : "var(--sf3)",
                        color: on ? "var(--acc)" : "var(--ts)",
                        padding: "2px 8px",
                        borderRadius: 100,
                        transition:
                          "all var(--duration-fast) var(--easing-default)",
                        lineHeight: 1.4,
                      }}
                    >
                      {opt.tag}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--ts)",
                      lineHeight: 1.5,
                    }}
                  >
                    {opt.desc}
                  </div>
                </div>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: on ? "2px solid var(--ac)" : "2px solid var(--bd2)",
                    background: on ? "var(--ac)" : "var(--sf)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition:
                      "all var(--duration-fast) var(--easing-default)",
                    color: "var(--acc)",
                  }}
                >
                  {on && <Check size={12} strokeWidth={3} />}
                </div>
              </button>
            );
          })}
        </div>

        {/* 적용 버튼 */}
        <button
          type="button"
          onClick={handleApply}
          disabled={!hasChanged || saving}
          aria-label="테마 적용하기"
          style={{
            width: "100%",
            padding: 15,
            borderRadius: 14,
            background: hasChanged
              ? "var(--ac)"
              : "color-mix(in srgb, var(--ac) 45%, var(--sf3))",
            color: "var(--acc)",
            border: "none",
            fontSize: 15,
            fontWeight: 700,
            cursor: hasChanged && !saving ? "pointer" : "not-allowed",
            opacity: saving ? 0.7 : 1,
            fontFamily: "inherit",
            minHeight: 48,
            transition:
              "background var(--duration-fast) var(--easing-default), transform var(--duration-fast) var(--easing-default)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            marginBottom: 6,
          }}
          onMouseDown={(e) => {
            if (hasChanged && !saving)
              e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseUp={(e) => (e.currentTarget.style.transform = "")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
        >
          <Check size={16} strokeWidth={2.5} />
          {saving ? "저장 중…" : hasChanged ? "테마 적용하기" : "현재 테마예요"}
        </button>
        <div
          style={{
            textAlign: "center",
            fontSize: 10.5,
            color: "var(--tm)",
            lineHeight: 1.5,
          }}
        >
          MY &gt; 홈 화면 테마에서 다시 바꿀 수 있어요
        </div>
      </div>
    </div>
  );
}
