"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  getMyGroups, getGroupByInviteCode, createGroup, joinGroup,
  getGroupBooks, getMemberCount, getGroupLiveReaders, getGroupMemberProgress,
} from "@/lib/supabase/queries";
import type { ReadingGroup, MeetingCycle } from "@/lib/types";
import type { LiveReader } from "@/lib/supabase/queries";
import { Plus, ChevronRight, Search, ArrowRight, Hash, BookOpen, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import AppHeader from "@/components/shared/AppHeader";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { getBooks, getAllStreakDates } from "@/lib/supabase/queries";

type GroupWithMeta = ReadingGroup & {
  myRole: string;
  memberCount?: number;
  currentBook?: {
    id: string;
    book_title: string;
    book_author: string | null;
    book_cover_url: string | null;
    end_date: string | null;
    start_date: string | null;
    num_weeks: number | null;
  } | null;
  weekNumber?: number;
  progressPercent?: number;
  liveReaders?: LiveReader[];
  memberProgress?: { nickname: string; emoji: string; pct: number }[];
};

const CYCLE_LABELS: Record<MeetingCycle, string> = { weekly: "매주", biweekly: "격주", monthly: "매월", custom: "자유" };
const DAY_LABELS = ["일","월","화","수","목","금","토"];
const AV_GRADS = [
  "linear-gradient(135deg,#1e3d2e,var(--ac))",
  "linear-gradient(135deg,#2a3a5a,#4a7ab8)",
  "linear-gradient(135deg,#3a2a1a,#8a6030)",
  "linear-gradient(135deg,#2a1a3a,#7a4090)",
];

/* ═══ SVG 프로그레스 링 ═══ */
function ProgressRing({ pct, color, size = 50, sw = 3.5 }: { pct: number; color: string; size?: number; sw?: number }) {
  const r = (size - sw * 2) / 2;
  const c = Math.PI * 2 * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--sf3)" strokeWidth={sw} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s" }} />
    </svg>
  );
}

/* ═══ 리딩 펄스 (HTML .pulse-strip) ═══ */
function ReadingPulse({ group }: { group: GroupWithMeta }) {
  const liveReaders = group.liveReaders || [];
  const progress = group.memberProgress || [];
  if (!group.currentBook) return null;

  return (
    <div style={{
      margin: "8px 20px 10px", background: "var(--sf)", borderRadius: 14,
      border: "0.5px solid var(--bd)", overflow: "hidden", transition: "all 0.4s",
    }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 8px" }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: "var(--tm)", letterSpacing: "1px", textTransform: "uppercase", transition: "color 0.4s" }}>
          {group.name} 리딩 펄스
        </span>
        {liveReaders.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 800, color: "#4ade80" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", animation: "pulseDot 1.4s infinite" }} />
            LIVE
          </div>
        )}
      </div>

      {/* 멤버 링 */}
      <div style={{ display: "flex", gap: 10, padding: "0 14px 12px", overflowX: "auto" }} className="scrollbar-hide">
        {progress.map((m, i) => {
          const isLive = liveReaders.some(l => l.profiles?.nickname === m.nickname);
          const color = isLive ? "#4ade80" : m.pct > 50 ? "var(--ac)" : "var(--sf3)";
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0 }}>
              <div style={{ position: "relative", width: 50, height: 50 }}>
                <ProgressRing pct={m.pct} color={color} />
                <div style={{
                  position: "absolute", inset: 5, borderRadius: "50%",
                  background: AV_GRADS[i % 4],
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 800, color: "#fff",
                }}>
                  {m.nickname.charAt(0).toUpperCase()}
                </div>
                <div style={{
                  position: "absolute", bottom: -2, right: -2,
                  background: "var(--bg)", border: "1px solid var(--bd)",
                  borderRadius: 100, padding: "1px 5px",
                  fontSize: 8, fontWeight: 800, color: isLive ? "#4ade80" : "var(--ac)",
                  transition: "all 0.4s",
                }}>{m.pct}%</div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: i === 0 ? 800 : 700,
                color: i === 0 ? "var(--tp)" : "var(--ts)",
                transition: "color 0.4s",
              }}>{i === 0 ? "나" : m.nickname}</span>
              <span style={{
                fontSize: 9, fontWeight: 700,
                color: isLive ? "#4ade80" : "var(--tm)",
              }}>{isLive ? "읽는 중" : `${m.pct > 0 ? "읽는 중" : "시작 전"}`}</span>
            </div>
          );
        })}
      </div>

      {/* 하단 */}
      {liveReaders.length > 0 && (
        <div style={{
          borderTop: "0.5px solid var(--bd)", padding: "9px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          transition: "border-color 0.4s",
        }}>
          <span style={{ fontSize: 11, color: "var(--ts)", fontStyle: "italic", transition: "color 0.4s" }}>
            <strong style={{ color: "var(--tp)", fontStyle: "normal" }}>{liveReaders[0].profiles?.nickname}</strong>
            {liveReaders.length > 1 ? ` 외 ${liveReaders.length - 1}명이` : "이"} 지금 읽고 있어요
          </span>
          <span style={{
            fontSize: 10, fontWeight: 800, color: "var(--acc)",
            background: "var(--ac)", padding: "5px 12px", borderRadius: 100,
            cursor: "pointer", transition: "all 0.4s",
          }}>나도 읽기</span>
        </div>
      )}
    </div>
  );
}

/* ═══ 모임 카드 (HTML .mc) ═══ */
function GroupCard({ group, onClick }: { group: GroupWithMeta; onClick: () => void }) {
  const hasBook = !!group.currentBook;
  const weekNum = group.weekNumber || 1;
  const progress = group.memberProgress || [];

  return (
    <div onClick={onClick} style={{
      margin: "0 20px 10px", background: "var(--sf)",
      borderRadius: 16, border: "0.5px solid var(--bd)",
      overflow: "hidden", cursor: "pointer",
      transition: "all 0.2s, background 0.4s, border-color 0.4s",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--bd2)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--bd)"; e.currentTarget.style.transform = ""; }}
    >
      <div style={{ padding: "14px 14px 10px", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12,
          background: "color-mix(in srgb, var(--ac) 15%, var(--sf2))",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, transition: "background 0.4s",
        }}>
          <BookOpen size={22} color="var(--ac)" strokeWidth={1.5} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--tp)", transition: "color 0.4s" }}>{group.name}</span>
            <span style={{
              fontSize: 8, fontWeight: 800, padding: "2px 8px", borderRadius: 100,
              color: hasBook ? "var(--ac)" : "var(--tm)",
              background: hasBook ? "color-mix(in srgb, var(--ac) 12%, transparent)" : "var(--sf2)",
              transition: "all 0.4s",
            }}>{hasBook ? "진행 중" : "책 선정 중"}</span>
          </div>
          {hasBook && (
            <div style={{ fontSize: 11, color: "var(--ts)", marginTop: 2, transition: "color 0.4s" }}>
              {group.currentBook!.book_title} · {weekNum}주차
            </div>
          )}
          <div style={{ display: "flex", marginTop: 8, alignItems: "center" }}>
            {Array.from({ length: Math.min(group.memberCount || 1, 4) }).map((_, i) => (
              <div key={i} style={{
                width: 22, height: 22, borderRadius: "50%",
                background: AV_GRADS[i % 4],
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 8, fontWeight: 800, color: "#fff",
                border: "2px solid var(--sf)", marginLeft: i > 0 ? -5 : 0,
                transition: "border-color 0.4s",
              }}>{String.fromCharCode(65 + i)}</div>
            ))}
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", marginLeft: 7, transition: "color 0.4s" }}>{group.memberCount || 0}명</span>
          </div>
        </div>
      </div>

      {/* 멤버별 진행률 바 */}
      {hasBook && progress.length > 0 && (
        <div style={{ padding: "10px 14px", borderTop: "0.5px solid var(--bd)", background: "var(--sf2)", transition: "all 0.4s" }}>
          {progress.slice(0, 4).map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < Math.min(progress.length, 4) - 1 ? 6 : 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ts)", width: 42, flexShrink: 0, transition: "color 0.4s" }}>{m.nickname}</span>
              <div style={{ flex: 1, height: 4, background: "var(--sf3)", borderRadius: 2, overflow: "hidden", transition: "background 0.4s" }}>
                <div style={{ height: "100%", borderRadius: 2, background: "var(--ac)", width: `${m.pct}%`, transition: "width 0.5s, background 0.4s" }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, color: "var(--ac)", width: 28, textAlign: "right", transition: "color 0.4s" }}>{m.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ 모임 만들기 시트 ═══ */
function CreateGroupSheet({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cycle, setCycle] = useState<MeetingCycle>("monthly");
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const group = await createGroup(supabase, {
        name: name.trim(), description: description.trim() || null,
        created_by: user.id, meeting_cycle: cycle, meeting_day_of_week: dayOfWeek,
      });
      await joinGroup(supabase, group.id, user.id, "admin");
      toast.success("모임이 만들어졌어요");
      onCreated();
    } catch { toast.error("모임 만들기에 실패했어요"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "var(--bg)", animation: "slideUp 0.3s ease-out", transition: "background 0.4s" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: 52, borderBottom: "0.5px solid var(--bd)" }}>
        <button onClick={onClose} style={{ fontSize: 14, fontWeight: 600, color: "var(--ts)" }}>닫기</button>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--tp)" }}>새 모임 만들기</span>
        <div style={{ width: 32 }} />
      </div>
      <div style={{ padding: "24px 20px", overflowY: "auto" }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--ts)", display: "block", marginBottom: 6 }}>모임 이름</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="수요 독서 모임" maxLength={30}
          style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: "0.5px solid var(--bd)", background: "var(--sf)", fontSize: 15, color: "var(--tp)", outline: "none" }} />
        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--ts)", display: "block", marginBottom: 6, marginTop: 20 }}>소개 (선택)</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="매달 한 권, 수요일 저녁" maxLength={60}
          style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: "0.5px solid var(--bd)", background: "var(--sf)", fontSize: 15, color: "var(--tp)", outline: "none" }} />
        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--ts)", display: "block", marginBottom: 8, marginTop: 20 }}>모임 주기</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["weekly","biweekly","monthly","custom"] as MeetingCycle[]).map((c) => (
            <button key={c} onClick={() => setCycle(c)} style={{
              padding: "10px 18px", borderRadius: 20, fontSize: 13,
              fontWeight: cycle === c ? 700 : 500,
              background: cycle === c ? "var(--ac)" : "var(--sf)",
              color: cycle === c ? "var(--acc)" : "var(--tp)",
              border: `1.5px solid ${cycle === c ? "transparent" : "var(--bd)"}`,
              transition: "all 0.2s",
            }}>{CYCLE_LABELS[c]}</button>
          ))}
        </div>
        {cycle !== "custom" && (
          <>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--ts)", display: "block", marginBottom: 8, marginTop: 20 }}>요일</label>
            <div style={{ display: "flex", gap: 6 }}>
              {DAY_LABELS.map((d, i) => (
                <button key={i} onClick={() => setDayOfWeek(dayOfWeek === i ? null : i)} style={{
                  width: 40, height: 40, borderRadius: "50%", fontSize: 13,
                  fontWeight: dayOfWeek === i ? 700 : 500,
                  background: dayOfWeek === i ? "var(--ac)" : "var(--sf)",
                  color: dayOfWeek === i ? "var(--acc)" : i === 0 ? "#ef4444" : i === 6 ? "#3b82f6" : "var(--tp)",
                  border: `1.5px solid ${dayOfWeek === i ? "transparent" : "var(--bd)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s",
                }}>{d}</button>
              ))}
            </div>
          </>
        )}
        <button onClick={handleCreate} disabled={!name.trim() || saving} className="btn-main" style={{ marginTop: 32, opacity: !name.trim() || saving ? 0.5 : 1 }}>
          {saving ? "만드는 중..." : "모임 만들기"}
        </button>
      </div>
    </div>
  );
}

/* ═══ 초대 코드 참여 ═══ */
function JoinGroupSheet({ onClose, onJoined }: { onClose: () => void; onJoined: () => void }) {
  const user = useAuthStore((s) => s.user);
  const [code, setCode] = useState("");
  const [found, setFound] = useState<ReadingGroup | null>(null);
  const [searching, setSearching] = useState(false);
  const [joining, setJoining] = useState(false);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "var(--bg)", animation: "slideUp 0.3s ease-out", transition: "background 0.4s" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: 52, borderBottom: "0.5px solid var(--bd)" }}>
        <button onClick={onClose} style={{ fontSize: 14, fontWeight: 600, color: "var(--ts)" }}>닫기</button>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--tp)" }}>모임 참여하기</span>
        <div style={{ width: 32 }} />
      </div>
      <div style={{ padding: "48px 20px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "color-mix(in srgb, var(--ac) 8%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Hash size={24} color="var(--ac)" strokeWidth={1.5} />
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--tp)", marginBottom: 24 }}>초대 코드를 입력하세요</p>
        <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setFound(null); }}
          onKeyDown={async (e) => {
            if (e.key !== "Enter" || !code.trim()) return;
            setSearching(true);
            try { const s = createClient(); const g = await getGroupByInviteCode(s, code.trim()); setFound(g); if (!g) toast.error("모임을 찾을 수 없어요"); } catch { toast.error("검색에 실패했어요"); } finally { setSearching(false); }
          }}
          placeholder="BG-XXXX" maxLength={10}
          style={{ width: "100%", maxWidth: 240, padding: "16px 20px", borderRadius: 14, textAlign: "center", border: "1.5px solid var(--bd)", background: "var(--sf)", fontSize: 20, fontWeight: 700, color: "var(--tp)", letterSpacing: "2px", outline: "none" }} />
        <button onClick={async () => {
          if (!code.trim()) return;
          setSearching(true);
          try { const s = createClient(); const g = await getGroupByInviteCode(s, code.trim()); setFound(g); if (!g) toast.error("모임을 찾을 수 없어요"); } catch { toast.error("검색에 실패했어요"); } finally { setSearching(false); }
        }} disabled={!code.trim() || searching} className="btn-main" style={{ maxWidth: 240, margin: "16px auto 0", display: "block", opacity: !code.trim() || searching ? 0.5 : 1 }}>
          {searching ? "검색 중..." : "검색"}
        </button>
        {found && (
          <div style={{ marginTop: 24, padding: 20, borderRadius: 14, background: "var(--sf)", border: "0.5px solid var(--bd)", textAlign: "left" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--tp)" }}>{found.name}</h3>
            {found.description && <p style={{ fontSize: 12, color: "var(--ts)", marginTop: 4 }}>{found.description}</p>}
            <button onClick={async () => {
              if (!user || !found) return;
              setJoining(true);
              try { const s = createClient(); await joinGroup(s, found.id, user.id); toast.success("참여 완료!"); onJoined(); } catch { toast.error("참여에 실패했어요"); } finally { setJoining(false); }
            }} disabled={joining} className="btn-main" style={{ marginTop: 14, opacity: joining ? 0.6 : 1 }}>
              {joining ? "참여 중..." : "이 모임에 참여하기"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ 메인 ═══ */
export default function GroupsPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { books, setBooks } = useLibraryStore();
  const [groups, setGroups] = useState<GroupWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showFab, setShowFab] = useState(false);
  const [streakDates, setStreakDates] = useState<string[]>([]);

  const counts = {
    reading: books.filter(b => b.reading_status === "reading").length,
    done: books.filter(b => b.reading_status === "finished").length,
    want: books.filter(b => b.reading_status === "want_to_read" || b.reading_status === "to_read").length,
  };

  const loadGroups = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    setLoadError(false);
    try {
      // 공통 데이터 (books, streaks)
      const [booksData, streakData] = await Promise.all([
        getBooks(supabase, user.id),
        getAllStreakDates(supabase, user.id),
      ]);
      setBooks(booksData);
      setStreakDates(streakData);

      const raw = await getMyGroups(supabase, user.id);
      const enriched = await Promise.all(raw.map(async (g) => {
        const [count, books] = await Promise.all([getMemberCount(supabase, g.id), getGroupBooks(supabase, g.id)]);
        const cb = books.find((b) => b.status === "reading") || null;

        let weekNumber = 1, progressPercent = 0;
        let liveReaders: LiveReader[] = [];
        let memberProgress: { nickname: string; emoji: string; pct: number }[] = [];

        if (cb?.start_date && cb?.num_weeks) {
          const start = new Date(cb.start_date);
          weekNumber = Math.max(1, Math.min(cb.num_weeks, Math.ceil((Date.now() - start.getTime()) / (7 * 86400000))));
          progressPercent = Math.round((weekNumber / cb.num_weeks) * 100);
        }

        // 라이브 리더 + 멤버 진행률
        if (cb) {
          try {
            const [live, mp] = await Promise.all([
              getGroupLiveReaders(supabase, g.id),
              getGroupMemberProgress(supabase, cb.id),
            ]);
            liveReaders = live;
            memberProgress = mp.map((m) => ({
              nickname: m.profiles?.nickname || "?",
              emoji: m.profiles?.emoji || "",
              pct: m.total_pages && m.current_page ? Math.round((m.current_page / m.total_pages) * 100) : 0,
            })).sort((a, b) => b.pct - a.pct);
          } catch {}
        }

        return {
          ...g,
          memberCount: count,
          weekNumber,
          progressPercent,
          liveReaders,
          memberProgress,
          currentBook: cb ? {
            id: cb.id,
            book_title: cb.book_title,
            book_author: cb.book_author,
            book_cover_url: cb.book_cover_url,
            end_date: cb.end_date,
            start_date: cb.start_date,
            num_weeks: cb.num_weeks,
          } : null,
        };
      }));
      setGroups(enriched);
    } catch (e) {
      console.error("[Groups] load failed:", e);
      setLoadError(true);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  // Supabase Realtime 구독
  useEffect(() => {
    if (!user || groups.length === 0) return;
    const supabase = createClient();
    const groupIds = groups.map(g => g.id);
    const channel = supabase.channel("live-readers")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "reading_live",
        filter: `group_id=in.(${groupIds.join(",")})`,
      }, () => {
        // 라이브 변경 시 그룹 리로드
        loadGroups();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, groups.length, loadGroups]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 100, transition: "background 0.4s" }}>
      {/* 공통 헤더 (Hero + 프로필 + 체온) */}
      <AppHeader streakDates={streakDates} counts={counts} />

      {loading ? (
        <div style={{ padding: "0 20px" }}>
          <div className="skeleton" style={{ height: 140, borderRadius: 14, marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 120, borderRadius: 16, marginBottom: 10 }} />
        </div>
      ) : loadError ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "60px 20px", gap: 14,
        }}>
          <AlertTriangle size={36} color="var(--tm)" strokeWidth={1.5} />
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--tp)", textAlign: "center" }}>
            모임을 불러올 수 없어요
          </p>
          <p style={{ fontSize: 12, color: "var(--ts)", textAlign: "center" }}>
            네트워크 상태를 확인하고 다시 시도해 주세요
          </p>
          <button
            onClick={() => { setLoading(true); loadGroups(); }}
            style={{
              marginTop: 4, fontSize: 13, fontWeight: 700,
              color: "var(--acc)", background: "var(--ac)",
              border: "none", borderRadius: 100, padding: "10px 28px",
              cursor: "pointer", transition: "opacity 0.2s",
            }}
          >
            다시 시도
          </button>
        </div>
      ) : groups.length === 0 ? (
        <>
          {/* ═══ 고스트 피드 (HTML ghost-wrap) ═══ */}
          <div style={{ position: "relative" }}>
            {/* 스크림 오버레이 */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 0%, color-mix(in srgb, var(--bg) 50%, transparent) 40%, color-mix(in srgb, var(--bg) 90%, transparent) 68%, var(--bg) 100%)", zIndex: 2, pointerEvents: "none" }} />

            {/* 리딩 펄스 미리보기 */}
            <div style={{ display: "flex", gap: 11, padding: "11px 20px", borderBottom: "0.5px solid var(--bd)", alignItems: "center" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", flexShrink: 0, animation: "pulseDot 1.6s infinite" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "var(--ts)" }}><strong style={{ color: "var(--tp)", fontWeight: 800 }}>지현</strong>이 지금 읽고 있어요</div>
                <div style={{ fontSize: 10, color: "var(--tm)", marginTop: 1 }}>이기적 유전자 · 수요모르</div>
              </div>
            </div>

            {/* 고스트 피드 아이템들 */}
            {[
              { initial: "J", grad: "linear-gradient(135deg,#2a3a5a,#4a7ab8)", name: "jihyun_reads", time: "3시간 전", text: "\"이기적 유전자는 타인의 이타적 행동을 착취하도록 프로그램되어 있다.\"", book: "이기적 유전자 · p.289", likes: 14, comments: 3, opacity: 1 },
              { initial: "M", grad: "linear-gradient(135deg,#3a2a1a,#8a6030)", name: "minjun.book", time: "어제", text: "\"우리는 유전자 기계다. 유전자라는 이기적 존재를 보존하기 위해 맹목적으로 프로그래밍된 로봇이다.\"", book: "이기적 유전자 · p.3", likes: 8, comments: 0, opacity: 0.52 },
              { initial: "S", grad: "linear-gradient(135deg,#2a1a3a,#7a4090)", name: "suyeon_r", time: "5일 전", text: "\"자연의 핵심 가장 낮은 수준에서, 즉 유전자의 수준에서 작동한다.\"", book: "이기적 유전자 · p.11", likes: 0, comments: 0, opacity: 0.22 },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 11, padding: "13px 20px", borderBottom: "0.5px solid var(--bd)", opacity: item.opacity }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: item.grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.75)" }}>{item.initial}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ts)", marginBottom: 6 }}>{item.name} <span style={{ color: "var(--tm)", fontWeight: 400 }}>· {item.time}</span></div>
                  <div style={{ padding: "9px 11px", background: "var(--sf)", borderRadius: 9, borderLeft: "2px solid var(--sf3)", marginBottom: 7 }}>
                    <div style={{ fontSize: 11, color: "var(--ts)", fontStyle: "italic", lineHeight: 1.65, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.text}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "var(--tm)", marginTop: 4, letterSpacing: "0.5px" }}>{item.book}</div>
                  </div>
                  {(item.likes > 0 || item.comments > 0) && (
                    <div style={{ display: "flex", gap: 14 }}>
                      {item.likes > 0 && <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "var(--tm)" }}>
                        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        {item.likes}
                      </span>}
                      {item.comments > 0 && <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "var(--tm)" }}>
                        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        댓글 {item.comments}
                      </span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ═══ 메인 카드 (HTML .main-card) ═══ */}
          <div style={{ position: "relative", zIndex: 3, margin: "0 18px", background: "var(--sf)", borderRadius: 20, border: "0.5px solid var(--bd2)", overflow: "hidden", transition: "border-color 0.4s" }}>
            {/* 지금 읽는 책 */}
            {(() => {
              const readingBook = books.find(b => b.reading_status === "reading");
              if (!readingBook) return null;
              const pct = readingBook.total_pages && readingBook.current_page ? Math.round((readingBook.current_page / readingBook.total_pages) * 100) : 0;
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "16px 16px 13px" }}>
                    <div style={{ width: 46, height: 64, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "var(--sf2)", boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}>
                      {readingBook.cover_url ? <img src={readingBook.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: "var(--ac)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 4, transition: "color 0.4s" }}>지금 읽는 중</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--tp)", letterSpacing: "-0.3px", lineHeight: 1.25, marginBottom: 2, transition: "color 0.4s" }}>{readingBook.title}</div>
                      <div style={{ fontSize: 10, color: "var(--tm)", transition: "color 0.4s" }}>{readingBook.author}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ac)", letterSpacing: "-0.8px", lineHeight: 1, transition: "color 0.4s" }}>{pct}%</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--tm)", textAlign: "right", transition: "color 0.4s" }}>p.{readingBook.current_page || 0} / {readingBook.total_pages || "?"}</div>
                    </div>
                  </div>
                  <div style={{ height: 2, background: "var(--sf3)", margin: "0 16px 14px", borderRadius: 1, overflow: "hidden", transition: "background 0.4s" }}>
                    <div style={{ height: "100%", borderRadius: 1, background: "var(--ac)", width: `${pct}%`, transition: "width 0.5s, background 0.4s" }} />
                  </div>
                </>
              );
            })()}

            <div style={{ padding: "0 16px 16px" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--tp)", letterSpacing: "-0.4px", lineHeight: 1.4, marginBottom: 5, transition: "color 0.4s" }}>같이 읽을 사람이<br />있나요?</div>
              <div style={{ fontSize: 12, color: "var(--ts)", lineHeight: 1.65, marginBottom: 16, transition: "color 0.4s" }}>이 책으로 모임을 만들면<br />친구들의 그은 문장이 여기 쌓여요.</div>

              <button onClick={() => setShowCreate(true)} style={{ width: "100%", padding: 13, borderRadius: 13, background: "var(--ac)", color: "var(--acc)", fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 8, transition: "opacity 0.15s, background 0.4s" }}>
                <Plus size={14} strokeWidth={2.5} />
                이 책으로 모임 만들기
              </button>

              <div style={{ display: "flex", gap: 7 }}>
                <button onClick={() => setShowJoin(true)} style={{ flex: 1, padding: 10, borderRadius: 11, background: "transparent", color: "var(--ts)", fontSize: 11, fontWeight: 700, border: "0.5px solid var(--bd2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, transition: "all 0.15s, border-color 0.4s" }}>
                  <Hash size={12} strokeWidth={2.5} />
                  초대 코드 입력
                </button>
                <button style={{ flex: 1, padding: 10, borderRadius: 11, background: "transparent", color: "var(--tm)", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", textAlign: "center", transition: "color 0.15s" }}>
                  다른 책 선택
                </button>
              </div>
            </div>

            <div style={{ height: 0.5, background: "var(--bd)", margin: "0 16px", transition: "background 0.4s" }} />

            {/* 카카오 힌트 */}
            <div onClick={() => toast("카카오 링크 열기")} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 16px", cursor: "pointer", transition: "background 0.15s" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "color-mix(in srgb, #c8a030 10%, var(--sf2))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.4s" }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#a08010" strokeWidth={2}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tp)", transition: "color 0.4s" }}>카카오로 초대받았나요?</div>
                <div style={{ fontSize: 10, color: "var(--tm)", marginTop: 1, transition: "color 0.4s" }}>링크를 열면 바로 참가할 수 있어요</div>
              </div>
              <ChevronRight size={13} color="var(--tm)" strokeWidth={2} />
            </div>
          </div>
          <div style={{ height: 20 }} />
        </>
      ) : (
        <>
          {/* 리딩 펄스 (첫 번째 진행 중 모임) */}
          {groups.filter(g => g.currentBook).slice(0, 1).map(g => (
            <div key={`pulse-${g.id}`}>
              <div style={{ padding: "8px 20px 0", fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "1.2px", textTransform: "uppercase", transition: "color 0.4s" }}>
                지금 읽고 있는 멤버
              </div>
              <ReadingPulse group={g} />
            </div>
          ))}

          {/* 모임 목록 */}
          <div style={{ padding: "4px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "1.2px", textTransform: "uppercase", transition: "color 0.4s" }}>
              내 모임 {groups.length}개
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ac)", cursor: "pointer", transition: "color 0.4s" }}>+ 친구 초대</span>
          </div>
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} onClick={() => router.push(`/groups/${g.id}`)} />
          ))}

          {/* 새 모임 만들기 */}
          <div onClick={() => setShowCreate(true)} style={{
            margin: "4px 20px 16px", padding: 13,
            background: "transparent", border: "1px dashed color-mix(in srgb, var(--ac) 28%, transparent)",
            borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            cursor: "pointer", transition: "all 0.2s",
          }}>
            <Plus size={16} color="var(--tm)" strokeWidth={2} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tm)", transition: "color 0.4s" }}>새 모임 만들기</span>
          </div>

          {/* 둘러보기 */}
          <div style={{ padding: "0 20px" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--tp)", marginBottom: 12, transition: "color 0.4s" }}>둘러보기</h2>
            {[
              { icon: <Search size={16} color="var(--ac)" strokeWidth={1.5} />, title: "다른 독서 모임 찾아보기", sub: "같은 책 읽는 사람들과 만나보세요", onClick: () => toast("준비 중이에요", { duration: 1500 }) },
              { icon: <ArrowRight size={16} color="var(--ac)" strokeWidth={1.5} />, title: "초대 코드로 참여하기", sub: "친구에게 받은 코드가 있나요?", onClick: () => setShowJoin(true) },
            ].map((item, i) => (
              <button key={i} onClick={item.onClick} className="card-tap" style={{
                width: "100%", padding: "16px 18px", borderRadius: 14, marginBottom: 8,
                background: "var(--sf)", border: "0.5px solid var(--bd)",
                display: "flex", alignItems: "center", gap: 14, textAlign: "left",
                transition: "all 0.2s, background 0.4s, border-color 0.4s",
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "color-mix(in srgb, var(--ac) 8%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.4s" }}>{item.icon}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--tp)", transition: "color 0.4s" }}>{item.title}</p>
                  <p style={{ fontSize: 10, color: "var(--tm)", marginTop: 2, transition: "color 0.4s" }}>{item.sub}</p>
                </div>
                <ChevronRight size={14} color="var(--tm)" strokeWidth={1.5} />
              </button>
            ))}
          </div>
        </>
      )}

      {/* FAB */}
      {groups.length > 0 && (
        <button onClick={() => setShowFab(!showFab)} style={{
          position: "fixed", bottom: 80, right: 20, zIndex: 80,
          width: 52, height: 52, borderRadius: 16,
          background: "var(--ac)", color: "var(--acc)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 16px var(--bd2)", border: "none", cursor: "pointer",
          transition: "transform 0.15s, background 0.4s",
          transform: showFab ? "rotate(45deg)" : "none",
        }}>
          <Plus size={22} strokeWidth={1.5} />
        </button>
      )}

      {showFab && (
        <>
          <div onClick={() => setShowFab(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.2)", zIndex: 90 }} />
          <div style={{ position: "fixed", bottom: 140, right: 20, zIndex: 91, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            {[
              { id: "create", icon: <BookOpen size={14} color="var(--ac)" strokeWidth={1.5} />, label: "모임 만들기" },
              { id: "join", icon: <Hash size={14} color="var(--ac)" strokeWidth={1.5} />, label: "코드로 참여" },
            ].map((item) => (
              <button key={item.id} onClick={() => { setShowFab(false); if (item.id === "create") setShowCreate(true); else setShowJoin(true); }}
                className="card-tap" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 14, background: "var(--sf)", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", border: "0.5px solid var(--bd)", transition: "all 0.2s, background 0.4s" }}>
                {item.icon}
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--tp)", transition: "color 0.4s" }}>{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {showCreate && <CreateGroupSheet onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadGroups(); }} />}
      {showJoin && <JoinGroupSheet onClose={() => setShowJoin(false)} onJoined={() => { setShowJoin(false); loadGroups(); }} />}
    </div>
  );
}
