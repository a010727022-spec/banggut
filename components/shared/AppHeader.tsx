"use client";

import { useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Flame, Search, Share2 } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { getAvatarSrc } from "@/lib/types";
import { calcStreak, calcTemp, getTempSeason, getWeekBars } from "@/lib/reading-utils";
import { format } from "date-fns";

/* ═══ 유틸 (공유 모듈에서 import) ═══ */
// calcStreak, calcTemp, getTempSeason, getWeekBars → @/lib/reading-utils
/* ═══ Hero Canvas ═══ */
function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<{ x: number; y: number; r: number; a: number; sp: number }[]>([]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.offsetWidth || 393; const H = 180;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (starsRef.current.length === 0) {
      starsRef.current = Array.from({ length: 180 }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.4 + 0.15, a: Math.random() * 0.55 + 0.08,
        sp: Math.random() * 0.0025 + 0.0008,
      }));
    }
    let raf: number;
    function draw(t: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      for (const [cx, cy, r, col] of [[W*0.28,H*0.39,W*0.33,"rgba(25,75,50,0.35)"],[W*0.74,H*0.69,W*0.25,"rgba(15,45,85,0.28)"]] as [number,number,number,string][]) {
        const rg = ctx.createRadialGradient(cx,cy,2,cx,cy,r);
        rg.addColorStop(0,col); rg.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle = rg; ctx.fillRect(0,0,W,H);
      }
      const time = t / 1000;
      for (const s of starsRef.current) {
        const alpha = s.a + Math.sin(time * s.sp * 1000) * 0.18;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(185,225,205,${Math.max(0,alpha)})`; ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div style={{ position: "relative", height: 180, overflow: "hidden", background: "var(--bg)", transition: "background 0.4s" }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 100, background: "linear-gradient(to top, var(--bg), transparent)", transition: "background 0.4s" }} />
    </div>
  );
}

/* ═══ 체온 위젯 ═══ */
function TempWidget({ temp, streakDates }: { temp: number; streakDates: string[] }) {
  const season = getTempSeason(temp);
  const weekBars = getWeekBars(streakDates);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const readYest = new Set(streakDates).has(format(yesterday, "yyyy-MM-dd"));
  const prevTemp = Math.max(0, temp - (readYest ? 5 : 12));
  const diff = temp - prevTemp;
  const barHeights = useMemo(() => weekBars.map((bar) =>
    bar.active ? (bar.isToday ? 24 : 10 + ((bar.label.charCodeAt(0) * 7) % 14)) : 3
  ), [weekBars]);

  return (
    <div style={{ margin: "0 -20px", padding: "12px 20px 14px", borderTop: "0.5px solid var(--bd)", borderBottom: "0.5px solid var(--bd)", background: "var(--sf)", cursor: "pointer", transition: "all 0.4s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ position: "relative", width: 28, height: 72, flexShrink: 0 }}>
          <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 8, width: 14, height: 56, background: "var(--sf3)", borderRadius: 7, overflow: "hidden", border: "0.5px solid var(--bd2)", transition: "background 0.4s, border-color 0.4s" }}>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${temp}%`, borderRadius: 7, background: `linear-gradient(to top, ${season.color}, ${season.color}88)`, transition: "height 1.2s cubic-bezier(0.22,1,0.36,1)" }} />
          </div>
          <div style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", width: 18, height: 18, borderRadius: "50%", background: season.color, border: "0.5px solid var(--bd2)", transition: "all 0.4s" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: "var(--tp)", letterSpacing: "-1.5px", lineHeight: 1, transition: "color 0.4s" }}>{temp}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ts)", transition: "color 0.4s" }}>°</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 100, background: season.bg, color: season.color, transition: "all 0.4s" }}>{season.name}</span>
          </div>
          <p style={{ fontSize: 10, color: "var(--tm)", lineHeight: 1.4, transition: "color 0.4s" }}>
            {temp >= 60 ? "최근 7일 중 가장 뜨거운 날이에요." : temp >= 36 ? "꾸준히 읽어내고 있어요." : "작은 불씨를 다시 피워봐요."}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 100, color: diff >= 0 ? "#4ade80" : "#e05028", background: diff >= 0 ? "rgba(74,222,128,0.12)" : "rgba(224,80,40,0.1)" }}>{diff >= 0 ? "↑" : "↓"} {Math.abs(diff)}°</span>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 24 }}>
            {weekBars.map((bar, i) => (
              <div key={i} style={{ width: 6, borderRadius: 2, flex: 1, height: barHeights[i], background: bar.isToday ? "var(--ac)" : "var(--sf3)", opacity: bar.isToday ? 1 : bar.active ? 0.6 : 0.3, transition: "background 0.4s" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ AppHeader 메인 ═══ */
export default function AppHeader({
  streakDates,
  counts,
}: {
  streakDates: string[];
  counts: { reading: number; done: number; want: number };
}) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const streak = calcStreak(streakDates);
  const temp = calcTemp(streak, streakDates);

  return (
    <>
      <HeroCanvas />
      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: -30, marginBottom: 12, position: "relative", zIndex: 2 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ width: 76, height: 76, borderRadius: "50%", background: "linear-gradient(135deg, #1e3d2e, #355c45, var(--ac))", display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid var(--bg)", overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.4)", transition: "border-color 0.4s" }}>
              {(() => {
                const src = getAvatarSrc(user?.emoji);
                return src
                  ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="14" r="8" fill="rgba(200,230,215,0.9)" /><path d="M4 40c0-7.7 6.3-14 14-14s14 6.3 14 14" fill="rgba(200,230,215,0.7)" /></svg>;
              })()}
            </div>
            {streak > 0 && (
              <div style={{ position: "absolute", bottom: -4, right: -6, background: "linear-gradient(135deg, #c8a030, #e8c040)", borderRadius: 100, padding: "3px 8px", fontSize: 10, fontWeight: 800, color: "#1a1000", border: "2.5px solid var(--bg)", transition: "border-color 0.4s", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                <Flame size={10} strokeWidth={2.5} style={{ display: "inline", verticalAlign: "middle", marginRight: 2 }} />{streak}일
              </div>
            )}
          </div>
          <div style={{ flex: 1, paddingBottom: 2 }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: "var(--tp)", letterSpacing: "-0.6px", transition: "color 0.4s" }}>{user?.nickname || "독서가"}</div>
            <div style={{ fontSize: 11, color: "var(--tm)", marginTop: 3, transition: "color 0.4s" }}>읽고, 긋고, 방긋.</div>
            <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
              {[
                { n: counts.done, l: "완독" },
                { n: counts.reading, l: "읽는 중" },
                { n: counts.want, l: "위시" },
              ].map(({ n, l }) => (
                <div key={l}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "var(--tp)", transition: "color 0.4s" }}>{n}</span>
                  <span style={{ fontWeight: 400, color: "var(--tm)", fontSize: 11, marginLeft: 2, transition: "color 0.4s" }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={() => router.push("/profile")} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "0.5px solid var(--bd2)", background: "var(--sf)", color: "var(--ac2)", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>프로필 편집</button>
          <button onClick={() => router.push("/setup")} style={{ width: 40, flexShrink: 0, borderRadius: 10, border: "0.5px solid var(--bd2)", background: "var(--sf)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 9, transition: "all 0.2s" }}>
            <Search size={15} stroke="var(--ac2)" strokeWidth={2.2} />
          </button>
          <button style={{ width: 40, flexShrink: 0, borderRadius: 10, border: "0.5px solid var(--bd2)", background: "var(--sf)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 9, transition: "all 0.2s" }}>
            <Share2 size={15} stroke="var(--ac2)" strokeWidth={2.2} />
          </button>
        </div>
        <TempWidget temp={temp} streakDates={streakDates} />
      </div>
    </>
  );
}
