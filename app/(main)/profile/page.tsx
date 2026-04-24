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
import { useHomeLayoutStore, type HomeLayout } from "@/stores/useHomeLayoutStore";
import { useLibraryViewStore } from "@/stores/useLibraryViewStore";
import { AVATAR_IMAGES, EMOJI_AVATARS, getAvatarSrc } from "@/lib/types";
import { toast } from "sonner";
import { format } from "date-fns";
import { calcStreak, calcTemp, getTempSeason, getWeekBars } from "@/lib/reading-utils";

/* ── 알림 설정 타입 ── */
type NotifKey = "subway" | "cafe" | "bedtime" | "social" | "tempDrop";
interface NotifSettings {
  subway: boolean;
  cafe: boolean;
  bedtime: boolean;
  social: boolean;
  tempDrop: boolean;
  bedtimeTime: string;
}
const defaultNotif: NotifSettings = { subway: false, cafe: false, bedtime: false, social: false, tempDrop: false, bedtimeTime: "22:00" };

/* 유틸은 @/lib/reading-utils에서 import */
export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { books: libraryBooks, setBooks } = useLibraryStore();
  // reviews, messages, groups — 현재 MY 페이지에서 미사용, fetch 제거
  const [streakDates, setStreakDates] = useState<string[]>([]);
  const [favoriteLibrary, setFavoriteLibrary] = useState<{ code: string | null; name: string | null }>({ code: null, name: null });
  const [showLibrarySheet, setShowLibrarySheet] = useState(false);
  const [statsWidget, setStatsWidget] = useState<"today_goal" | "yearly_ring">("today_goal");
  const homeLayout = useHomeLayoutStore((s) => s.layout);
  const setHomeLayoutStore = useHomeLayoutStore((s) => s.setLayout);
  const libraryView = useLibraryViewStore((s) => s.view);
  const [yearlyGoal, setYearlyGoal] = useState<number | null>(null);
  const [dailyPageGoal, setDailyPageGoal] = useState<number | null>(null);
  const [goalsEditing, setGoalsEditing] = useState(false);
  const [yearlyInput, setYearlyInput] = useState("");
  const [pageInput, setPageInput] = useState("");
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [librarySearchResults, setLibrarySearchResults] = useState<Array<{ libCode: string; libName: string; address: string }>>([]);
  const [librarySearching, setLibrarySearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editNickname, setEditNickname] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const router = useRouter();
  const { theme, setTheme } = useThemeStore();

  /* ── 알림 설정 상태 ── */
  const [notifSettings, setNotifSettings] = useState<NotifSettings>(defaultNotif);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("banggut-notification-settings");
      if (raw) setNotifSettings({ ...defaultNotif, ...JSON.parse(raw) });
    } catch { /* ignore */ }
  }, []);

  const toggleNotif = (key: NotifKey) => {
    setNotifSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("banggut-notification-settings", JSON.stringify(next));
      return next;
    });
  };

  const setBedtimeTime = (time: string) => {
    setNotifSettings((prev) => {
      const next = { ...prev, bedtimeTime: time };
      localStorage.setItem("banggut-notification-settings", JSON.stringify(next));
      return next;
    });
  };

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
      supabase.from("profiles").select("favorite_library_code, favorite_library_name, stats_widget, yearly_goal, daily_page_goal, home_layout").eq("id", user.id).maybeSingle().then(({ data }) => {
        if (data) {
          setFavoriteLibrary({ code: data.favorite_library_code, name: data.favorite_library_name });
          setStatsWidget((data.stats_widget as "today_goal" | "yearly_ring") || "today_goal");
          setYearlyGoal(data.yearly_goal ?? null);
          setDailyPageGoal(data.daily_page_goal ?? null);
          setYearlyInput(data.yearly_goal ? String(data.yearly_goal) : "");
          setPageInput(data.daily_page_goal ? String(data.daily_page_goal) : "");
          // DB 값이 "hero" | "calendar"이면 store에 동기화
          const dbLayout = data.home_layout as string | null;
          if (dbLayout === "hero" || dbLayout === "calendar") {
            setHomeLayoutStore(dbLayout as HomeLayout);
          }
        }
      }),
    ]).catch(() => {
      setLoadError(true);
    }).finally(() => setLoading(false));
  }, [user, setBooks, retryCount]);

  // 도서관 검색 (지역 + 키워드)
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [apiError, setApiError] = useState<string>("");

  const searchLibraries = async (q: string, region: string) => {
    if (!q.trim() && !region) {
      setLibrarySearchResults([]);
      return;
    }
    setLibrarySearching(true);
    setApiError("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (region) params.set("region", region);
      const res = await fetch(`/api/library-search?${params.toString()}`);
      const data = await res.json();
      if (data.error === "api_key_missing") {
        setApiError(data.message || "API 키가 없어 검색할 수 없어요");
      } else if (data.error === "api_not_approved") {
        setApiError(data.message || "API 승인 대기 중입니다");
      } else if (data.error === "api_error") {
        setApiError(data.message || "도서관 조회에 실패했어요");
      } else {
        setApiError("");
      }
      setLibrarySearchResults(data.libraries || []);
    } catch {
      setLibrarySearchResults([]);
    }
    setLibrarySearching(false);
  };

  const setStatsWidgetHandler = async (variant: "today_goal" | "yearly_ring") => {
    if (!user) return;
    const sb = createClient();
    await sb.from("profiles").update({ stats_widget: variant }).eq("id", user.id);
    setStatsWidget(variant);
    toast.success(variant === "today_goal" ? "오늘 목표 바로 바꿨어요" : "연간 챌린지 링으로 바꿨어요");
  };

  const saveGoals = async () => {
    if (!user) return;
    const yearly = yearlyInput.trim() ? parseInt(yearlyInput.trim(), 10) : null;
    const page = pageInput.trim() ? parseInt(pageInput.trim(), 10) : null;
    if (yearly !== null && (isNaN(yearly) || yearly < 1 || yearly > 999)) {
      toast.error("연간 목표는 1~999권 사이여야 해요");
      return;
    }
    if (page !== null && (isNaN(page) || page < 1 || page > 999)) {
      toast.error("하루 목표는 1~999쪽 사이여야 해요");
      return;
    }
    const sb = createClient();
    await sb.from("profiles").update({ yearly_goal: yearly, daily_page_goal: page }).eq("id", user.id);
    setYearlyGoal(yearly);
    setDailyPageGoal(page);
    setGoalsEditing(false);
    toast.success("목표를 저장했어요");
  };

  const setFavoriteLibraryHandler = async (code: string, name: string) => {
    if (!user) return;
    try {
      const supabase = createClient();
      await supabase.from("profiles").update({ favorite_library_code: code, favorite_library_name: name }).eq("id", user.id);
      setFavoriteLibrary({ code, name });
      setShowLibrarySheet(false);
      setLibrarySearchQuery("");
      setLibrarySearchResults([]);
      toast.success(`${name} 설정했어요`);
    } catch {
      toast.error("설정에 실패했어요");
    }
  };

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

      {/* ═══ 홈 화면 테마 (선택 스크린으로 연결) ═══ */}
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "0.8px", textTransform: "uppercase", padding: "0 20px 8px", transition: "color 0.4s" }}>🏠 홈 화면</div>
      <div style={{ margin: "0 20px 14px" }}>
        <button
          onClick={() => router.push("/settings/home-theme")}
          aria-label="홈 화면 테마 설정으로 이동"
          style={{
            width: "100%",
            background: "var(--sf)",
            borderRadius: 14,
            border: "0.5px solid var(--bd)",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.4s",
          }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "color-mix(in srgb, var(--ac) 15%, var(--bg))",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--ac)", fontSize: 20, flexShrink: 0,
          }}>
            🏠
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tp)", lineHeight: 1.3 }}>
              홈 화면 테마
            </div>
            <div style={{ fontSize: 11, color: "var(--tm)", marginTop: 2 }}>
              현재: {homeLayout === "hero" ? "이어 읽기 HERO" : "캘린더 First"}
            </div>
          </div>
          <ChevronRight size={16} color="var(--tm)" />
        </button>
      </div>

      {/* ═══ 서재 뷰 (선택 스크린으로 연결) ═══ */}
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "0.8px", textTransform: "uppercase", padding: "0 20px 8px", transition: "color 0.4s" }}>📚 서재</div>
      <div style={{ margin: "0 20px 14px" }}>
        <button
          onClick={() => router.push("/settings/library-view")}
          aria-label="서재 뷰 설정으로 이동"
          style={{
            width: "100%",
            background: "var(--sf)",
            borderRadius: 14,
            border: "0.5px solid var(--bd)",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.4s",
          }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "color-mix(in srgb, var(--ac) 15%, var(--bg))",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--ac)", fontSize: 20, flexShrink: 0,
          }}>
            📚
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tp)", lineHeight: 1.3 }}>
              서재 뷰
            </div>
            <div style={{ fontSize: 11, color: "var(--tm)", marginTop: 2 }}>
              현재: {libraryView === "A" ? "책꽂이" : libraryView === "B" ? "큐레이션 보드" : "4 스택"}
            </div>
          </div>
          <ChevronRight size={16} color="var(--tm)" />
        </button>
      </div>

      {/* ═══ 독서 목표 ═══ */}
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "0.8px", textTransform: "uppercase", padding: "0 20px 8px", transition: "color 0.4s" }}>🎯 독서 목표</div>
      <div style={{ margin: "0 20px 14px", background: "var(--sf)", borderRadius: 14, border: "0.5px solid var(--bd)", padding: 16, transition: "all 0.4s" }}>
        {/* 위젯 선택 */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tp)", marginBottom: 10 }}>홈 화면 위젯</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {([
            { id: "today_goal", label: "오늘 목표 바", emoji: "🎯", desc: "매일 페이지 목표" },
            { id: "yearly_ring", label: "연간 챌린지 링", emoji: "🏆", desc: "연간 권수 진행률" },
          ] as const).map((opt) => {
            const active = statsWidget === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setStatsWidgetHandler(opt.id)}
                style={{
                  padding: "12px 10px",
                  borderRadius: 12,
                  border: `1.5px solid ${active ? "var(--ac)" : "var(--bd2)"}`,
                  background: active ? "color-mix(in srgb, var(--ac) 9%, var(--bg))" : "var(--bg)",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.emoji}</div>
                <div style={{ fontFamily: "'Gaegu', cursive", fontSize: 13, fontWeight: 700, color: active ? "var(--ac)" : "var(--tp)", letterSpacing: "0.02em", marginBottom: 2 }}>{opt.label}</div>
                <div style={{ fontSize: 10, color: "var(--tm)", lineHeight: 1.3 }}>{opt.desc}</div>
              </button>
            );
          })}
        </div>

        {/* 목표 수치 */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tp)", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          목표 수치
          {!goalsEditing ? (
            <button
              onClick={() => setGoalsEditing(true)}
              style={{ fontSize: 11, color: "var(--ac)", fontWeight: 700, background: "transparent", border: "none", cursor: "pointer" }}
            >
              편집
            </button>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => { setGoalsEditing(false); setYearlyInput(yearlyGoal ? String(yearlyGoal) : ""); setPageInput(dailyPageGoal ? String(dailyPageGoal) : ""); }}
                style={{ fontSize: 11, color: "var(--tm)", fontWeight: 600, background: "transparent", border: "none", cursor: "pointer" }}
              >취소</button>
              <button
                onClick={saveGoals}
                style={{ fontSize: 11, color: "var(--ac)", fontWeight: 800, background: "transparent", border: "none", cursor: "pointer" }}
              >저장</button>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "var(--tm)", marginBottom: 4, fontWeight: 600 }}>연간 목표</div>
            {goalsEditing ? (
              <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--bg)", border: "0.5px solid var(--bd2)", borderRadius: 10, padding: "8px 12px" }}>
                <input
                  type="number"
                  value={yearlyInput}
                  onChange={(e) => setYearlyInput(e.target.value)}
                  placeholder="24"
                  min={1}
                  max={999}
                  style={{ flex: 1, border: "none", background: "transparent", fontSize: 15, fontWeight: 800, color: "var(--tp)", outline: "none", width: 40 }}
                />
                <span style={{ fontSize: 11, color: "var(--tm)", fontWeight: 600 }}>권</span>
              </div>
            ) : (
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--tp)", padding: "8px 0" }}>
                {yearlyGoal ? `${yearlyGoal}권` : <span style={{ color: "var(--tm)", fontWeight: 500 }}>설정 안 함</span>}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "var(--tm)", marginBottom: 4, fontWeight: 600 }}>하루 목표</div>
            {goalsEditing ? (
              <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--bg)", border: "0.5px solid var(--bd2)", borderRadius: 10, padding: "8px 12px" }}>
                <input
                  type="number"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  placeholder="30"
                  min={1}
                  max={999}
                  style={{ flex: 1, border: "none", background: "transparent", fontSize: 15, fontWeight: 800, color: "var(--tp)", outline: "none", width: 40 }}
                />
                <span style={{ fontSize: 11, color: "var(--tm)", fontWeight: 600 }}>쪽</span>
              </div>
            ) : (
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--tp)", padding: "8px 0" }}>
                {dailyPageGoal ? `${dailyPageGoal}쪽` : <span style={{ color: "var(--tm)", fontWeight: 500 }}>30쪽 (기본)</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ 인생책 (하트 담은 책) ═══ */}
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "0.8px", textTransform: "uppercase", padding: "0 20px 8px", transition: "color 0.4s" }}>❤ 인생책</div>
      <div style={{ margin: "0 20px 14px", background: "var(--sf)", borderRadius: 14, border: "0.5px solid var(--bd)", padding: 14, transition: "all 0.4s" }}>
        {(() => {
          const faves = libraryBooks.filter((b) => b.is_favorite);
          if (faves.length === 0) {
            return (
              <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
                <div style={{ fontSize: 12, color: "var(--tm)", lineHeight: 1.6 }}>
                  아직 인생책이 없어요<br />
                  책 상세에서 <span style={{ color: "var(--ac)", fontWeight: 700 }}>♥</span> 눌러 담아보세요
                </div>
              </div>
            );
          }
          return (
            <div style={{ display: "flex", gap: 10, overflowX: "auto", margin: "0 -14px", padding: "0 14px 2px", scrollbarWidth: "none" }}>
              {faves.slice(0, 12).map((b) => (
                <button
                  key={b.id}
                  onClick={() => router.push(`/book/${b.id}`)}
                  style={{ flexShrink: 0, width: 72, textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                >
                  <div style={{ width: 72, height: 104, borderRadius: 6, overflow: "hidden", border: "0.5px solid var(--bd)", marginBottom: 6, background: "var(--sf2)" }}>
                    {b.cover_url ? (
                      <img src={b.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tm)", fontSize: 20 }}>♥</div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--tp)", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{b.title}</div>
                </button>
              ))}
            </div>
          );
        })()}
      </div>

      {/* ═══ 자주 가는 도서관 ═══ */}
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "0.8px", textTransform: "uppercase", padding: "0 20px 8px", transition: "color 0.4s" }}>🏛 자주 가는 도서관</div>
      <div style={{ margin: "0 20px 14px" }}>
        {favoriteLibrary.code ? (
          <div
            onClick={() => setShowLibrarySheet(true)}
            style={{ background: "var(--sf)", borderRadius: 14, border: "0.5px solid var(--bd)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", transition: "all 0.2s" }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "color-mix(in srgb, var(--ac) 15%, var(--bg))", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ac)", fontSize: 20, flexShrink: 0 }}>🏛</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tp)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{favoriteLibrary.name}</div>
              <div style={{ fontSize: 11, color: "var(--tm)", marginTop: 2 }}>책 상세에서 바로 소장 조회할 수 있어요</div>
            </div>
            <ChevronRight size={16} color="var(--tm)" />
          </div>
        ) : (
          <button
            onClick={() => setShowLibrarySheet(true)}
            style={{ width: "100%", padding: "16px", borderRadius: 14, border: "1.5px dashed color-mix(in srgb, var(--ac) 35%, transparent)", background: "color-mix(in srgb, var(--ac) 4%, var(--bg))", color: "var(--tp)", cursor: "pointer", textAlign: "center", fontSize: 13, fontWeight: 600, transition: "all 0.2s" }}
          >
            🏛 자주 가는 도서관 설정하기
            <div style={{ fontSize: 11, color: "var(--tm)", fontWeight: 400, marginTop: 4 }}>설정하면 책 상세에서 바로 소장 여부를 볼 수 있어요</div>
          </button>
        )}
      </div>

      {/* 도서관 검색 바텀시트 */}
      {showLibrarySheet && (
        <>
          <div
            onClick={() => setShowLibrarySheet(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100 }}
          />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 110, background: "var(--bg)", borderRadius: "24px 24px 0 0", maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 -8px 24px rgba(0,0,0,0.15)" }}>
            <div style={{ width: 36, height: 4, background: "var(--bd2)", borderRadius: 100, margin: "10px auto 6px" }} />
            <div style={{ padding: "12px 20px 14px", borderBottom: "0.5px solid var(--bd)" }}>
              <div style={{ fontFamily: "'Gaegu', cursive", fontSize: 18, fontWeight: 700, color: "var(--tp)", letterSpacing: "0.02em", marginBottom: 4, textAlign: "center" }}>
                자주 가는 도서관 찾기
              </div>
              <div style={{ fontSize: 11, color: "var(--tm)", textAlign: "center", marginBottom: 12 }}>지역을 고르고 이름을 검색해 주세요</div>

              {/* 지역 칩 */}
              <div style={{ display: "flex", gap: 6, overflowX: "auto", margin: "0 -20px 10px", padding: "0 20px 4px", scrollbarWidth: "none" }}>
                {[
                  { code: "", label: "전체" },
                  { code: "11", label: "서울" },
                  { code: "41", label: "경기" },
                  { code: "28", label: "인천" },
                  { code: "26", label: "부산" },
                  { code: "27", label: "대구" },
                  { code: "29", label: "광주" },
                  { code: "30", label: "대전" },
                  { code: "31", label: "울산" },
                  { code: "36", label: "세종" },
                  { code: "42", label: "강원" },
                  { code: "43", label: "충북" },
                  { code: "44", label: "충남" },
                  { code: "45", label: "전북" },
                  { code: "46", label: "전남" },
                  { code: "47", label: "경북" },
                  { code: "48", label: "경남" },
                  { code: "50", label: "제주" },
                ].map((r) => {
                  const on = selectedRegion === r.code;
                  return (
                    <button
                      key={r.code || "all"}
                      onClick={() => {
                        setSelectedRegion(r.code);
                        searchLibraries(librarySearchQuery, r.code);
                      }}
                      style={{
                        flexShrink: 0,
                        padding: "6px 14px",
                        borderRadius: 100,
                        fontSize: 12,
                        fontWeight: 700,
                        border: `1px solid ${on ? "var(--ac)" : "var(--bd2)"}`,
                        background: on ? "color-mix(in srgb, var(--ac) 12%, var(--bg))" : "var(--sf)",
                        color: on ? "var(--ac)" : "var(--ts)",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                placeholder="도서관 이름 (예: 양천도서관)"
                value={librarySearchQuery}
                onChange={(e) => {
                  setLibrarySearchQuery(e.target.value);
                  searchLibraries(e.target.value, selectedRegion);
                }}
                style={{
                  width: "100%",
                  height: 46,
                  padding: "0 18px",
                  borderRadius: 100,
                  border: "1px solid var(--bd2)",
                  background: "var(--sf)",
                  color: "var(--tp)",
                  fontSize: 14,
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
              {apiError && (
                <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "color-mix(in srgb, #e88b7a 10%, var(--bg))", border: "0.5px solid color-mix(in srgb, #e88b7a 35%, transparent)", fontSize: 11, color: "#c05a48", lineHeight: 1.5 }}>
                  ⚠️ {apiError}
                </div>
              )}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {librarySearching ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--tm)", fontSize: 13 }}>검색 중...</div>
              ) : librarySearchResults.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--tm)", fontSize: 13 }}>
                  {librarySearchQuery ? "검색 결과가 없어요" : "도서관 이름을 입력해 주세요"}
                </div>
              ) : (
                librarySearchResults.map((lib) => (
                  <button
                    key={lib.libCode}
                    onClick={() => setFavoriteLibraryHandler(lib.libCode, lib.libName)}
                    style={{ width: "100%", padding: "14px 20px", borderBottom: "0.5px solid var(--bd)", background: "transparent", border: "none", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "color-mix(in srgb, var(--ac) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🏛</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tp)", marginBottom: 2 }}>{lib.libName}</div>
                      <div style={{ fontSize: 11, color: "var(--tm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lib.address}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div style={{ padding: 16, borderTop: "0.5px solid var(--bd)" }}>
              <button
                onClick={() => setShowLibrarySheet(false)}
                style={{ width: "100%", height: 44, borderRadius: 100, background: "var(--sf)", border: "0.5px solid var(--bd)", color: "var(--tm)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                닫기
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══ 테마 피커 — v6: 민트 / 프라다 2-카드 ═══ */}
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "0.8px", textTransform: "uppercase", padding: "0 20px 12px", transition: "color 0.4s" }}>테마</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 20px", marginBottom: 20 }}>
        {([
          {
            id: "mint" as const,
            name: "산뜻한 민트",
            sub: "FRESH MINT",
            swatches: ["#F7F3ED", "#5FA48E", "#CDE4DB"],
          },
          {
            id: "prada" as const,
            name: "시크한 프라다",
            sub: "CHIC SAFFIANO",
            swatches: ["#FBF5E0", "#0F0E0C", "#8A6B42"],
          },
        ]).map((t) => {
          const sel = theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              aria-label={`${t.name} 테마로 전환`}
              aria-pressed={sel}
              style={{
                position: "relative",
                padding: "14px 14px 12px",
                borderRadius: 14,
                background: sel ? "color-mix(in srgb, var(--ac) 8%, var(--sf))" : "var(--sf)",
                border: sel ? "1.5px solid var(--ac)" : "0.5px solid var(--bd)",
                textAlign: "left",
                cursor: "pointer",
                transition: "background var(--duration-normal) var(--easing-default), border-color var(--duration-normal) var(--easing-default)",
                fontFamily: "inherit",
              }}
            >
              {/* Swatches */}
              <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
                {t.swatches.map((c, i) => (
                  <span key={i} style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: c,
                    border: "1px solid rgba(15,14,12,0.08)",
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)",
                    display: "block",
                  }} />
                ))}
              </div>
              {/* Name */}
              <div style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--tp)",
                letterSpacing: "-0.01em",
                marginBottom: 2,
              }}>{t.name}</div>
              {/* Sub */}
              <div style={{
                fontSize: 9,
                fontWeight: 600,
                color: "var(--tm)",
                letterSpacing: "0.18em",
                fontVariantNumeric: "tabular-nums",
              }}>{t.sub}</div>
              {/* Check mark when selected */}
              {sel && (
                <div style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "var(--ac)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }} aria-hidden>
                  <Check size={11} color="var(--acc)" strokeWidth={3} />
                </div>
              )}
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
        {([
          { key: "subway" as NotifKey, icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#4a7ab8" strokeWidth={2}><rect x={1} y={3} width={15} height={13} rx={2}/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx={5.5} cy={18.5} r={2.5}/><circle cx={18.5} cy={18.5} r={2.5}/></svg>, bg: "rgba(74,122,184,0.15)", title: "지하철 탑승 감지", sub: "이동 중 조용한 알림", tag: "위치·모션", tagBg: "rgba(74,122,184,0.12)", tagColor: "#4a7ab8", disabled: true },
          { key: "cafe" as NotifKey, icon: <MapPin size={18} color="var(--ac)" strokeWidth={2} />, bg: "rgba(107,158,138,0.15)", title: "카페 도착 감지", sub: "즐겨찾기 장소 150m 이내", tag: "장소", tagBg: "color-mix(in srgb, var(--ac) 12%, transparent)", tagColor: "var(--ac)", disabled: true },
          { key: "bedtime" as NotifKey, icon: <Clock size={18} color="var(--ac)" strokeWidth={2} />, bg: "rgba(200,160,48,0.1)", title: "취침 전 독서", sub: notifSettings.bedtime ? `매일 밤 ${notifSettings.bedtimeTime}` : "매일 밤 10시", tag: "시간", tagBg: "rgba(200,160,48,0.1)", tagColor: "#c8a030", disabled: false },
          { key: "social" as NotifKey, icon: <Users size={18} color="#4ade80" strokeWidth={2} />, bg: "rgba(74,222,128,0.1)", title: "모임원 읽기 시작", sub: "리딩 펄스 연동", tag: "소셜", tagBg: "rgba(74,222,128,0.1)", tagColor: "#4ade80", disabled: false },
          { key: "tempDrop" as NotifKey, icon: <AlertTriangle size={18} color="#e05028" strokeWidth={2} />, bg: "rgba(224,80,40,0.1)", title: "체온 하락 경보", sub: "3일 이상 미독서 시", tag: "체온 연동", tagBg: "rgba(224,80,40,0.1)", tagColor: "#e05028", disabled: false },
        ]).map((item, i) => {
          const isOn = !item.disabled && notifSettings[item.key];
          return (
            <div key={i}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: item.key === "bedtime" && isOn ? "none" : "0.5px solid var(--bd)", transition: "border-color 0.4s" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: item.disabled ? 0.5 : 1 }}>{item.icon}</div>
                <div style={{ flex: 1, opacity: item.disabled ? 0.5 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--tp)", transition: "color 0.4s" }}>{item.title}</span>
                    {item.disabled && <span style={{ fontSize: 9, fontWeight: 600, color: "var(--tm)", transition: "color 0.4s" }}>(앱 출시 후 지원)</span>}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--tm)", marginTop: 2, transition: "color 0.4s" }}>{item.sub}</div>
                  <span style={{ display: "inline-block", fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 100, marginTop: 5, background: item.tagBg, color: item.tagColor, transition: "all 0.4s" }}>{item.tag}</span>
                </div>
                {/* 토글 */}
                <div
                  onClick={item.disabled ? undefined : () => toggleNotif(item.key)}
                  style={{
                    width: 38, height: 22, borderRadius: 100,
                    background: item.disabled ? "var(--tm)" : isOn ? "var(--ac)" : "var(--tm)",
                    position: "relative",
                    cursor: item.disabled ? "not-allowed" : "pointer",
                    flexShrink: 0,
                    opacity: item.disabled ? 0.4 : 1,
                    transition: "background 0.2s",
                  }}
                >
                  <div style={{
                    position: "absolute", top: 3,
                    ...(isOn ? { right: 3 } : { left: 3 }),
                    width: 16, height: 16, borderRadius: "50%",
                    background: "var(--acc)",
                    transition: "all 0.2s, background 0.4s",
                  }} />
                </div>
              </div>
              {/* 취침 전 독서 시간 선택 */}
              {item.key === "bedtime" && isOn && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 14px 12px 62px",
                  borderBottom: "0.5px solid var(--bd)",
                  transition: "border-color 0.4s",
                }}>
                  <Clock size={13} color="var(--tm)" strokeWidth={2} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ts)", transition: "color 0.4s" }}>알림 시간</span>
                  <input
                    type="time"
                    value={notifSettings.bedtimeTime}
                    onChange={(e) => setBedtimeTime(e.target.value)}
                    style={{
                      padding: "4px 8px", borderRadius: 8,
                      border: "0.5px solid var(--bd)", background: "var(--sf)",
                      fontSize: 12, fontWeight: 700, color: "var(--tp)",
                      outline: "none", cursor: "pointer",
                      transition: "all 0.4s",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
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
            <button onClick={saveProfile} disabled={saving || !editNickname.trim()} style={{ fontSize: 14, fontWeight: 700, color: "var(--ac)", opacity: saving ? 0.5 : 1 }}>{saving ? "저장 중" : "저장"}</button>
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
