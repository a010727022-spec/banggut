"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, X, Check } from "lucide-react";
import { toast } from "sonner";
import {
  useLibraryViewStore,
  type LibraryView,
} from "@/stores/useLibraryViewStore";

/* ═══════════════════════════════════════════
   서재 뷰 선택 페이지 (/settings/library-view)
   ═══════════════════════════════════════════
   - 선택: A(책꽂이) / B(큐레이션) / C(4스택)
   - 저장: useLibraryViewStore (localStorage) — DB 컬럼 없음
   - 저장 후 router.back() → /library 로 복귀
*/

interface OptionDef {
  id: LibraryView;
  name: string;
  tag: string;
  desc: string;
}

const OPTIONS: OptionDef[] = [
  {
    id: "A",
    name: "책꽂이",
    tag: "기본",
    desc: "쉘프 나무 바 아래 책등이 나열돼요. 지금 읽는 중만 정면 표지로 강조돼요.",
  },
  {
    id: "B",
    name: "큐레이션 보드",
    tag: "문장 중심",
    desc: "이달의 한 문장 + 2-col 표지 그리드. 쉘프가 잡지처럼 진열돼요.",
  },
  {
    id: "C",
    name: "4 스택",
    tag: "숫자 중심",
    desc: "읽는 중·완독·위시·대여를 2×2 무더기 카운트로 한눈에 볼 수 있어요.",
  },
];

/* ═══ Mini preview (추상 썸네일) ═══ */

function MiniShelfPreview() {
  // 쉘프 나무 바 아래 책등 5개 + 아래 curated 1줄
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
      {/* 정면 표지 + 라인 */}
      <div style={{ display: "flex", gap: 4 }}>
        <div
          style={{
            width: 16,
            height: 22,
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--ac) 70%, #000), color-mix(in srgb, var(--ac) 30%, #000))",
            borderRadius: "1px 2px 2px 1px",
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, paddingTop: 2 }}>
          <div style={{ height: 3, borderRadius: 100, background: "var(--sf3)", width: "70%" }} />
          <div style={{ height: 3, borderRadius: 100, background: "var(--sf3)", width: "40%" }} />
          <div style={{ height: 3, borderRadius: 100, background: "var(--ac)", width: "55%", marginTop: 2 }} />
        </div>
      </div>

      {/* 책등 행 + 쉘프 바 */}
      <div style={{ marginTop: 2 }}>
        <div style={{ display: "flex", gap: 1.5, alignItems: "flex-end", height: 28 }}>
          {[20, 24, 18, 26, 22, 20].map((h, i) => (
            <div
              key={i}
              style={{
                width: 5,
                height: h,
                background: [
                  "#84A98C",
                  "#EFE3C8",
                  "#8B3A4E",
                  "#A07B55",
                  "#1E2A33",
                  "#D98D62",
                ][i],
                borderRadius: "0.5px 0.5px 0 0",
              }}
            />
          ))}
        </div>
        <div
          style={{
            height: 1.5,
            marginTop: 0.5,
            background:
              "linear-gradient(180deg, rgba(130,96,54,0.6), rgba(80,55,25,0.7))",
            borderRadius: 0.5,
          }}
        />
      </div>

      {/* Curated 카드 */}
      <div
        style={{
          background: "var(--sf)",
          border: "0.5px solid var(--bd)",
          borderRadius: 3,
          padding: "3px 4px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <div style={{ height: 3, borderRadius: 100, background: "var(--sf3)", width: "55%" }} />
        <div style={{ height: 3, borderRadius: 100, background: "var(--sf3)", width: "30%" }} />
      </div>
    </div>
  );
}

function MiniBoardPreview() {
  // 이달의 한 문장 + 2-col 그리드
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
      }}
    >
      {/* Quote block */}
      <div
        style={{
          background: "var(--sf)",
          borderLeft: "2px solid var(--ac)",
          borderRadius: "0 3px 3px 0",
          padding: "3px 4px",
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        <div style={{ height: 2.5, borderRadius: 100, background: "var(--sf3)", width: "80%" }} />
        <div style={{ height: 2.5, borderRadius: 100, background: "var(--sf3)", width: "55%" }} />
      </div>

      {/* 2-col 그리드 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, flex: 1 }}>
        {[
          { from: "#A4C3A8", to: "#4F7A62" },
          { from: "#4C5D68", to: "#1E2A33" },
          { from: "#B25A70", to: "#6B2437" },
          { from: "#C79868", to: "#7C5A36" },
        ].map((g, i) => (
          <div
            key={i}
            style={{
              background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
              borderRadius: 2,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function MiniStacksPreview() {
  // 2×2 카운트 카드
  return (
    <div
      style={{
        width: 72,
        height: 104,
        borderRadius: 9,
        background: "var(--bg)",
        border: "0.5px solid var(--bd)",
        padding: "7px 6px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: 4,
        overflow: "hidden",
      }}
    >
      {[2, 14, 23, 3].map((n, i) => (
        <div
          key={i}
          style={{
            background: "var(--sf)",
            border: "0.5px solid var(--bd)",
            borderRadius: 3,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "var(--tp)",
              lineHeight: 1,
              fontFamily: "var(--font-playful)",
            }}
          >
            {n}
          </div>
          <div
            style={{ height: 2, borderRadius: 100, background: "var(--sf3)", width: "50%" }}
          />
        </div>
      ))}
    </div>
  );
}

const PREVIEWS: Record<LibraryView, React.FC> = {
  A: MiniShelfPreview,
  B: MiniBoardPreview,
  C: MiniStacksPreview,
};

/* ═══ 메인 ═══ */

export default function LibraryViewSettingsPage() {
  const router = useRouter();
  const currentView = useLibraryViewStore((s) => s.view);
  const setView = useLibraryViewStore((s) => s.setView);

  const [selected, setSelected] = useState<LibraryView>(currentView);
  const [saving, setSaving] = useState(false);

  const hasChanged = useMemo(
    () => selected !== currentView,
    [selected, currentView]
  );

  const handleApply = () => {
    if (saving) return;
    setSaving(true);
    try {
      setView(selected);
      const label = OPTIONS.find((o) => o.id === selected)?.name ?? "서재";
      toast.success(`서재 뷰를 ${label}로 바꿨어요`);
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
            transition: "background var(--duration-fast) var(--easing-default)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sf2)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
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
          서재 뷰
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
        {/* 히어로 */}
        <div style={{ padding: "22px 4px 20px", textAlign: "center" }}>
          <div
            style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}
          >
            <img
              src="/mascot-reading.png"
              alt="책 읽는 방긋이"
              style={{ width: 64, height: 64, objectFit: "contain" }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/mascot-happy.png";
              }}
            />
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
            서재를 어떻게
            <br />
            진열할까요?
          </h2>
          <p style={{ fontSize: 12.5, color: "var(--ts)", lineHeight: 1.5 }}>
            언제든 설정에서 다시 바꿀 수 있어요
          </p>
        </div>

        {/* 옵션 카드들 */}
        <div
          role="radiogroup"
          aria-label="서재 뷰 선택"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginBottom: 18,
          }}
        >
          {OPTIONS.map((opt) => {
            const on = selected === opt.id;
            const Preview = PREVIEWS[opt.id];
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
                  border: on ? "2px solid var(--ac)" : "2px solid var(--bd)",
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
                <Preview />
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
                      flexWrap: "wrap",
                    }}
                  >
                    {opt.name}
                    <span
                      style={{
                        fontFamily: "var(--font-playful)",
                        fontSize: 11,
                        fontWeight: 700,
                        background: on ? "var(--ac)" : "var(--sf3)",
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
          aria-label="서재 뷰 적용하기"
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
          {saving
            ? "저장 중…"
            : hasChanged
              ? "뷰 적용하기"
              : "현재 뷰예요"}
        </button>
        <div
          style={{
            textAlign: "center",
            fontSize: 10.5,
            color: "var(--tm)",
            lineHeight: 1.5,
          }}
        >
          MY &gt; 서재 뷰에서 다시 바꿀 수 있어요
        </div>
      </div>
    </div>
  );
}
