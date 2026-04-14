"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { getBooks, upsertProfile, getAllStreakDates } from "@/lib/supabase/queries";
import { useRouter } from "next/navigation";
// types moved — reviews/groups no longer fetched here
import { Settings, Users, ChevronRight, Flame, LogOut, Check, MapPin, Clock, AlertTriangle, User, RefreshCw } from "lucide-react";
import { useThemeStore } from "@/stores/useThemeStore";
import { AVATAR_IMAGES, EMOJI_AVATARS, getAvatarSrc } from "@/lib/types";
import { toast } from "sonner";
import { format } from "date-fns";
import { calcStreak, calcTemp, getTempSeason, getWeekBars } from "@/lib/reading-utils";

/* 유틸은 @/lib/reading-utils에서 import */
export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { setBooks } = useLibraryStore();
  // reviews, messages, groups — 현재 MY 페이지에서 미사용, fetch 제거
  const [streakDates, setStreakDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editNickname, setEditNickname] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const router = useRouter();
  const { theme, setTheme } = useThemeStore();

  const streak = calcStreak(streakDates);
  const temp = calcTemp(streak, streakDates);
  const season = getTempSeason(temp);
  const weekBars = getWeekBars(streakDates);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const readYest = new Set(streakDates).has(format(yesterday, "yyyy-MM-dd"));
  const prevTemp = Math.max(0, temp - (readYest ? 5 : 12));
  const diff = temp - prevTemp;

  useEffect(() => {
    if (!user) return;
    setLoadError(false);
    const supabase = createClient();
    Promise.all([
      getBooks(supabase, user.id).then(setBooks),
      getAllStreakDates(supabase, user.id).then(setStreakDates),
    ]).catch(() => {
      setLoadError(true);
    }).finally(() => setLoading(false));
  }, [user, setBooks, retryCount]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/onboarding");
  };

  const saveProfile = async () => {
    if (!user || !editNickname.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const updated = await upsertProfile(supabase, { id: user.id, nickname: editNickname.trim(), emoji: editEmoji });
      setUser(updated);
      setEditMode(false);
      toast.success("프로필을 수정했어요");
    } catch { toast.error("수정에 실패했어요"); }
    setSaving(false);
  };

  if (loading) return (
    <div style={{ padding: "28px 20px" }}>
      <div className="skeleton" style={{ height: 50, width: 50, borderRadius: "50%", marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 18, width: 120, marginBottom: 8 }} />
    </div>
  );

  if (loadError) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", transition: "background 0.4s" }}>
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "80px 20px", textAlign: "center",
      }}>
        <AlertTriangle size={40} color="var(--ts)" strokeWidth={1.5} style={{ marginBottom: 16 }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--tp)", marginBottom: 6 }}>
          프로필을 불러올 수 없어요
        </div>
        <div style={{ fontSize: 13, color: "var(--ts)", marginBottom: 20 }}>
          네트워크 연결을 확인해주세요
        </div>
        <button
          onClick={() => { setLoadError(false); setLoading(true); setRetryCount((c) => c + 1); }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "10px 20px", borderRadius: 100,
            background: "var(--ac)", color: "var(--acc)",
            fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
            transition: "opacity 0.2s",
          }}
        >
          <RefreshCw size={14} strokeWidth={2.5} />
          다시 시도
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 100, transition: "background 0.4s" }}>

      {/* ═══ 미니 프로필 (HTML .my-mini) ═══ */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14, padding: 14,
        margin: "10px 20px", background: "var(--sf)", borderRadius: 14,
        border: "0.5px solid var(--bd)", transition: "all 0.4s",
      }}>
        <div style={{
          width: 50, height: 50, borderRadius: "50%",
          background: "linear-gradient(135deg, #1e3d2e, var(--ac))",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          {(() => {
            const src = getAvatarSrc(user?.emoji);
            return src ? <img src={src} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              : <User size={24} color="rgba(200,230,215,0.85)" />;
          })()}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--tp)", transition: "color 0.4s" }}>{user?.nickname || "독서가"}</div>
          <div style={{ fontSize: 11, color: "var(--tm)", marginTop: 2, transition: "color 0.4s" }}>
            읽고, 긋고, 방긋.{streak > 0 && <span style={{ marginLeft: 6 }}>
              <Flame size={10} strokeWidth={2.5} style={{ display: "inline", verticalAlign: "middle", marginRight: 1 }} color="var(--ac)" />
              <span style={{ fontWeight: 800, color: "var(--ac)" }}>{streak}일 연속</span>
            </span>}
          </div>
        </div>
      </div>

      {/* ═══ 체온 상세 (HTML MY 체온 카드) ═══ */}
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "0.8px", textTransform: "uppercase", padding: "4px 20px 0", transition: "color 0.4s" }}>오늘 독서 체온</div>
      <div style={{ margin: "8px 20px 14px", background: "var(--sf)", borderRadius: 14, border: "0.5px solid var(--bd)", overflow: "hidden", transition: "all 0.4s" }}>
        <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "flex-end", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "var(--tm)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 4, transition: "color 0.4s" }}>독서 체온 상세</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 44, fontWeight: 800, color: "var(--tp)", letterSpacing: "-2px", lineHeight: 1, transition: "color 0.4s" }}>{temp}</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: "var(--ts)", transition: "color 0.4s" }}>°</span>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 11px", borderRadius: 100, background: season.bg, color: season.color, fontSize: 11, fontWeight: 800, transition: "all 0.4s" }}>{season.name}</div>
            <div style={{ fontSize: 10, color: "var(--ts)", marginTop: 6, lineHeight: 1.5, transition: "color 0.4s" }}>
              {temp >= 85 ? "독서 습관이 완전히 자리잡았어요!" : temp >= 60 ? `최근 7일 중 가장 뜨거운 날이에요.\n수확 독자까지 ${85 - temp}° 남았어요!` : temp >= 36 ? "습관이 자리잡고 있어요." : "작은 불씨를 다시 피워봐요."}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tm)", marginBottom: 4, transition: "color 0.4s" }}>어제 대비</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: diff >= 0 ? "color-mix(in srgb, var(--ac) 80%, #4ade80)" : "color-mix(in srgb, var(--ac) 30%, #e05028)", transition: "color 0.4s" }}>{diff >= 0 ? "↑" : "↓"} {Math.abs(diff)}°</div>
          </div>
        </div>
        {/* 프로그레스 바 */}
        <div style={{ height: 5, background: "var(--sf3)", margin: "0 16px", borderRadius: 3, overflow: "hidden", transition: "background 0.4s" }}>
          <div style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg, var(--ac), var(--ac2))", width: `${temp}%`, transition: "width 1s cubic-bezier(0.22,1,0.36,1), background 0.4s" }} />
        </div>
        {/* 3칸 그리드 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "0.5px solid var(--bd)", marginTop: 10, transition: "border-color 0.4s" }}>
          {[
            { val: "42", unit: "p", label: "오늘" },
            { val: String(streak), unit: "일", label: "연속" },
            { val: "87", unit: "p", label: "일평균" },
          ].map((s, i) => (
            <div key={i} style={{ padding: "10px 0", textAlign: "center", borderRight: i < 2 ? "0.5px solid var(--bd)" : "none", transition: "border-color 0.4s" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--tp)", letterSpacing: "-0.6px", transition: "color 0.4s" }}>{s.val}<span style={{ fontSize: 10, fontWeight: 500, color: "var(--tm)" }}>{s.unit}</span></div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--tm)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 2, transition: "color 0.4s" }}>{s.label}</div>
            </div>
          ))}
        </div>
        {/* 주간 바 차트 */}
        <div style={{ padding: "12px 16px", borderTop: "0.5px solid var(--bd)", transition: "border-color 0.4s" }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "var(--tm)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 9, transition: "color 0.4s" }}>이번 주 체온</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 40 }}>
            {weekBars.map((bar, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ flex: 1, width: "100%", background: bar.isToday ? "var(--ac)" : bar.active ? "var(--sf3)" : "var(--sf3)", borderRadius: 3, minHeight: 3, height: `${bar.active ? (bar.isToday ? 100 : 30 + (bar.label.charCodeAt(0) * 7) % 60) : 8}%`, opacity: bar.isToday ? 1 : bar.active ? 0.6 : 0.2, transition: "background 0.4s" }} />
                <div style={{ fontSize: 8, fontWeight: 700, color: bar.isToday ? "var(--ac)" : "var(--tm)", letterSpacing: "0.3px", transition: "color 0.4s" }}>{bar.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ 독서 계절 (HTML 2x2 그리드) ═══ */}
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "0.8px", textTransform: "uppercase", padding: "0 20px 8px", transition: "color 0.4s" }}>독서 계절</div>
      <div style={{ margin: "0 20px 14px", background: "var(--sf)", borderRadius: 14, border: "0.5px solid var(--bd)", padding: 14, transition: "all 0.4s" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { name: "겨울 독자", range: "0 – 35°", color: "#6090c8", bg: "color-mix(in srgb, #4a7ab8 7%, var(--sf))", active: temp < 36 },
            { name: "봄 독자", range: "36 – 59°", color: "#4ade80", bg: "color-mix(in srgb, #4ade80 6%, var(--sf))", active: temp >= 36 && temp < 60 },
            { name: "여름 독자", range: `60 – 84°${temp >= 60 && temp < 85 ? " · 지금 여기" : ""}`, color: "var(--ac)", bg: "color-mix(in srgb, var(--ac) 10%, var(--sf))", active: temp >= 60 && temp < 85 },
            { name: "수확 독자", range: `85 – 100°${temp >= 85 ? " · 지금 여기" : temp >= 60 ? ` · ${85 - temp}° 남음` : ""}`, color: "#c8a030", bg: "color-mix(in srgb, #c8a030 7%, var(--sf))", active: temp >= 85 },
          ].map((s, i) => (
            <div key={i} style={{
              borderRadius: 12, padding: 12, transition: "all 0.4s",
              border: s.active ? `2px solid ${s.color === "var(--ac)" ? "var(--ac)" : s.color}` : "0.5px solid var(--bd)",
              background: s.bg,
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--tp)", transition: "color 0.4s" }}>{s.name}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: s.color, marginTop: 2, transition: "color 0.4s" }}>{s.range}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ 테마 피커 (HTML .th-grid) ═══ */}
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "0.8px", textTransform: "uppercase", padding: "0 20px 12px", transition: "color 0.4s" }}>테마</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, padding: "0 20px", marginBottom: 20 }}>
        {([
          { id: "dark" as const, label: "밤숲", bg: "linear-gradient(135deg, #0c0f0d, #1a2e22)" },
          { id: "cream" as const, label: "크림", bg: "linear-gradient(135deg, #F4EFE8, #DDD6CC)" },
          { id: "navy" as const, label: "네이비", bg: "linear-gradient(135deg, #080c18, #162030)" },
          { id: "sepia" as const, label: "세피아", bg: "linear-gradient(135deg, #191410, #302518)" },
          { id: "blossom" as const, label: "블러썸", bg: "linear-gradient(135deg, #fdf0f5, #ead1e6)" },
        ]).map((t) => {
          const sel = theme === t.id;
          return (
            <button key={t.id} onClick={() => setTheme(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, cursor: "pointer", background: "none", border: "none", padding: 0 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, background: t.bg,
                border: sel ? "2.5px solid var(--ac)" : "2.5px solid transparent",
                position: "relative", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.25)", transition: "border-color 0.2s",
              }}>
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.15), transparent 60%)" }} />
                {sel && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={18} color="rgba(255,255,255,0.9)" strokeWidth={2.5} /></div>}
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: sel ? "var(--ac)" : "var(--tm)", letterSpacing: "0.5px", transition: "color 0.4s" }}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══ 독서 루틴 설정 (HTML .rtn-card) ═══ */}
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "0.8px", textTransform: "uppercase", padding: "0 20px 8px", transition: "color 0.4s" }}>독서 루틴 설정</div>
      <div style={{ margin: "0 20px 14px", background: "var(--sf)", borderRadius: 14, border: "0.5px solid var(--bd)", overflow: "hidden", transition: "all 0.4s" }}>
        <div style={{ padding: "12px 14px", borderBottom: "0.5px solid var(--bd)", transition: "border-color 0.4s" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--tp)", transition: "color 0.4s" }}>스마트 독서 알림</div>
          <div style={{ fontSize: 10, color: "var(--tm)", marginTop: 2, transition: "color 0.4s" }}>위치·시간·소셜 트리거를 설정하세요</div>
        </div>
        {[
          { icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#4a7ab8" strokeWidth={2}><rect x={1} y={3} width={15} height={13} rx={2}/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx={5.5} cy={18.5} r={2.5}/><circle cx={18.5} cy={18.5} r={2.5}/></svg>, bg: "rgba(74,122,184,0.15)", title: "지하철 탑승 감지", sub: "이동 중 조용한 알림", tag: "위치·모션", tagBg: "rgba(74,122,184,0.12)", tagColor: "#4a7ab8" },
          { icon: <MapPin size={18} color="var(--ac)" strokeWidth={2} />, bg: "rgba(107,158,138,0.15)", title: "카페 도착 감지", sub: "즐겨찾기 장소 150m 이내", tag: "장소", tagBg: "color-mix(in srgb, var(--ac) 12%, transparent)", tagColor: "var(--ac)" },
          { icon: <Clock size={18} color="var(--ac)" strokeWidth={2} />, bg: "rgba(200,160,48,0.1)", title: "취침 전 독서", sub: "매일 밤 10시", tag: "시간", tagBg: "rgba(200,160,48,0.1)", tagColor: "#c8a030" },
          { icon: <Users size={18} color="#4ade80" strokeWidth={2} />, bg: "rgba(74,222,128,0.1)", title: "모임원 읽기 시작", sub: "리딩 펄스 연동", tag: "소셜", tagBg: "rgba(74,222,128,0.1)", tagColor: "#4ade80" },
          { icon: <AlertTriangle size={18} color="#e05028" strokeWidth={2} />, bg: "rgba(224,80,40,0.1)", title: "체온 하락 경보", sub: "3일 이상 미독서 시", tag: "체온 연동", tagBg: "rgba(224,80,40,0.1)", tagColor: "#e05028" },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: "0.5px solid var(--bd)", transition: "border-color 0.4s" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tp)", transition: "color 0.4s" }}>{item.title}</div>
              <div style={{ fontSize: 10, color: "var(--tm)", marginTop: 2, transition: "color 0.4s" }}>{item.sub}</div>
              <span style={{ display: "inline-block", fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 100, marginTop: 5, background: item.tagBg, color: item.tagColor, transition: "all 0.4s" }}>{item.tag}</span>
            </div>
            {/* 토글 */}
            <div style={{ width: 38, height: 22, borderRadius: 100, background: "var(--ac)", position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}>
              <div style={{ position: "absolute", top: 3, right: 3, width: 16, height: 16, borderRadius: "50%", background: "var(--acc)", transition: "all 0.2s, background 0.4s" }} />
            </div>
          </div>
        ))}
      </div>

      {/* ═══ 설정 ═══ */}
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "0.8px", textTransform: "uppercase", padding: "0 20px 8px", marginTop: 8, transition: "color 0.4s" }}>설정</div>
      <div style={{ padding: "0 20px", display: "flex", flexDirection: "column" }}>
        {[
          { title: "프로필 편집", sub: user?.nickname, onClick: () => { setEditNickname(user?.nickname || ""); setEditEmoji(user?.emoji || "hemingway"); setEditMode(true); } },
          { title: "독서 알림", sub: "루틴 설정에서 관리" },
          { title: "서재 공개 범위", sub: "팔로워만", value: "팔로워만 →" },
        ].map((item, i) => (
          <div key={i} onClick={item.onClick}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderBottom: "0.5px solid var(--bd)", cursor: item.onClick ? "pointer" : "default", transition: "border-color 0.4s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--sf2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.4s" }}>
                <Settings size={15} color="var(--ac)" strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tp)", transition: "color 0.4s" }}>{item.title}</div>
                {item.sub && <div style={{ fontSize: 10, color: "var(--tm)", marginTop: 1, transition: "color 0.4s" }}>{item.sub}</div>}
              </div>
            </div>
            {item.value ? <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ac)", transition: "color 0.4s" }}>{item.value}</span> : <ChevronRight size={14} color="var(--tm)" strokeWidth={1.5} />}
          </div>
        ))}
        {/* 로그아웃 */}
        <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--sf2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.4s" }}>
            <LogOut size={15} color="var(--tm)" strokeWidth={2} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--tm)", transition: "color 0.4s" }}>로그아웃</span>
        </button>
      </div>

      <div style={{ height: 20 }} />

      {/* ═══ 프로필 편집 오버레이 ═══ */}
      {editMode && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "var(--bg)", animation: "slideUp 0.3s ease-out", overflowY: "auto", transition: "background 0.4s" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: 52, borderBottom: "0.5px solid var(--bd)" }}>
            <button onClick={() => setEditMode(false)} style={{ fontSize: 14, fontWeight: 600, color: "var(--ts)" }}>닫기</button>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--tp)" }}>프로필 편집</span>
            <button onClick={saveProfile} disabled={saving || !editNickname.trim()} style={{ fontSize: 14, fontWeight: 700, color: "var(--ac)", opacity: saving ? 0.5 : 1 }}>{saving ? "저장 중..." : "저장"}</button>
          </div>
          <div style={{ padding: "24px 20px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--ts)", marginBottom: 8 }}>작가 아바타</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
              {AVATAR_IMAGES.map(av => (
                <button key={av.id} onClick={() => setEditEmoji(av.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 6, borderRadius: 12, background: editEmoji === av.id ? "color-mix(in srgb, var(--ac) 12%, transparent)" : "transparent", border: editEmoji === av.id ? "2px solid var(--ac)" : "2px solid transparent" }}>
                  <img src={av.src} alt={av.label} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
                  <span style={{ fontSize: 9, color: "var(--ts)" }}>{av.label}</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--ts)", marginBottom: 8 }}>이모지</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {EMOJI_AVATARS.map(em => (
                <button key={em} onClick={() => setEditEmoji(em)} style={{ width: 40, height: 40, borderRadius: "50%", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", background: editEmoji === em ? "color-mix(in srgb, var(--ac) 12%, transparent)" : "transparent", border: editEmoji === em ? "2px solid var(--ac)" : "2px solid transparent" }}>{em}</button>
              ))}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--ts)", marginBottom: 8 }}>닉네임</div>
            <input value={editNickname} onChange={e => setEditNickname(e.target.value)} maxLength={20} placeholder="닉네임" style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: "0.5px solid var(--bd)", background: "var(--sf)", fontSize: 15, fontWeight: 700, color: "var(--tp)", outline: "none" }} />
          </div>
        </div>
      )}
    </div>
  );
}
