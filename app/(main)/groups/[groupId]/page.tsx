"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  getGroup, getGroupMembers, getGroupBooks, getGroupSchedules,
  getGroupMemberProgress, getGroupScraps, getGroupDiscussions,
  createGroupDiscussion, getDiscussionReplies, createDiscussionReply,
  type GroupDiscussion, type GroupDiscussionReply,
} from "@/lib/supabase/queries";
import type { ReadingGroup, GroupMember, GroupBook, GroupSchedule } from "@/lib/types";
import { ArrowLeft, Plus, Flame, Activity, PenLine, MessageCircle, Calendar, Monitor, Heart, MapPin, X, Library, Share2 } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "sonner";
import InviteBottomSheet from "@/components/InviteBottomSheet";
import AppHeader from "@/components/shared/AppHeader";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { getBooks, getAllStreakDates } from "@/lib/supabase/queries";

type InnerTab = "progress" | "bonfire" | "scraps" | "discuss" | "schedule" | "portfolio";

const AV_GRADS = [
  "linear-gradient(135deg,#1e3d2e,var(--ac))",
  "linear-gradient(135deg,#2a3a5a,#4a7ab8)",
  "linear-gradient(135deg,#3a2a1a,#8a6030)",
  "linear-gradient(135deg,#2a1a3a,#7a4090)",
];

const INNER_TABS: { id: InnerTab; label: string; icon: React.ReactNode }[] = [
  { id: "progress", label: "진행률", icon: <Activity size={18} strokeWidth={2} /> },
  { id: "bonfire", label: "불씨", icon: <Flame size={18} strokeWidth={2} /> },
  { id: "scraps", label: "스크랩", icon: <PenLine size={18} strokeWidth={2} /> },
  { id: "discuss", label: "토론", icon: <MessageCircle size={18} strokeWidth={2} /> },
  { id: "schedule", label: "일정", icon: <Calendar size={18} strokeWidth={2} /> },
  { id: "portfolio", label: "포트폴리오", icon: <Monitor size={18} strokeWidth={2} /> },
];

/* ═══ SVG 프로그레스 링 ═══ */
function ProgressRing({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const sw = 3.5;
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

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { books: allBooks, setBooks } = useLibraryStore();
  const [group, setGroup] = useState<ReadingGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [groupBooks, setGroupBooks] = useState<GroupBook[]>([]);
  const [schedules, setSchedules] = useState<GroupSchedule[]>([]);
  const [memberProgress, setMemberProgress] = useState<{
    nickname: string; emoji: string; pct: number; page: number; total: number; lastActive: string;
    pacePerDay: number; daysToFinish: number | null; expectedFinishDate: Date | null;
    isMe: boolean;
  }[]>([]);
  const [streakDates, setStreakDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [innerTab, setInnerTab] = useState<InnerTab>("progress");
  const [showInvite, setShowInvite] = useState(false);
  // 불씨 토글 (멤버별 활성/비활성, 로컬 상태)
  const [bonfireActive, setBonfireActive] = useState<Record<string, boolean>>({});
  // 스크랩 피드
  const [groupScraps, setGroupScraps] = useState<Awaited<ReturnType<typeof getGroupScraps>>>([]);
  const [scrapFilter, setScrapFilter] = useState<"all" | "mine">("all");
  const [likedScraps, setLikedScraps] = useState<Record<string, boolean>>({});
  // 토론
  const [discussions, setDiscussions] = useState<GroupDiscussion[]>([]);
  const [openDiscussion, setOpenDiscussion] = useState<GroupDiscussion | null>(null);
  const [discussionReplies, setDiscussionReplies] = useState<GroupDiscussionReply[]>([]);
  const [showNewDiscussion, setShowNewDiscussion] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newReply, setNewReply] = useState("");
  const [busy, setBusy] = useState(false);

  const currentBook = groupBooks.find((b) => b.status === "reading") || null;

  const counts = {
    reading: allBooks.filter(b => b.reading_status === "reading").length,
    done: allBooks.filter(b => b.reading_status === "finished").length,
    want: allBooks.filter(b => b.reading_status === "want_to_read" || b.reading_status === "to_read").length,
  };

  const load = useCallback(async () => {
    if (!user || !groupId) return;
    const supabase = createClient();
    try {
      const [g, m, gb, gs, booksData, sd, dsc] = await Promise.all([
        getGroup(supabase, groupId),
        getGroupMembers(supabase, groupId),
        getGroupBooks(supabase, groupId),
        getGroupSchedules(supabase, groupId),
        getBooks(supabase, user.id),
        getAllStreakDates(supabase, user.id),
        getGroupDiscussions(supabase, groupId),
      ]);
      setGroup(g); setMembers(m); setGroupBooks(gb); setSchedules(gs);
      setBooks(booksData); setStreakDates(sd); setDiscussions(dsc);

      // 멤버 진행률
      const cb = gb.find((b) => b.status === "reading");
      if (cb) {
        try {
          const mp = await getGroupMemberProgress(supabase, cb.id);
          const now = Date.now();
          const mapped = mp.map((p) => {
            const total = p.total_pages || 0;
            const page = p.current_page || 0;
            const pct = total > 0 ? Math.round((page / total) * 100) : 0;
            // 읽은 일수 (started_at 기준, 최소 1일)
            const startMs = p.started_at ? new Date(p.started_at).getTime() : null;
            const daysReading = startMs ? Math.max(1, Math.ceil((now - startMs) / 86400000)) : 1;
            const pacePerDay = page > 0 ? page / daysReading : 0;
            // 완독까지 예상 일수
            const remaining = Math.max(0, total - page);
            const daysToFinish = pacePerDay > 0 && remaining > 0
              ? Math.ceil(remaining / pacePerDay)
              : (remaining === 0 && total > 0 ? 0 : null);
            const expectedFinishDate = daysToFinish != null
              ? new Date(now + daysToFinish * 86400000)
              : null;
            // 마지막 활동
            const lastMs = p.updated_at ? new Date(p.updated_at).getTime() : null;
            let lastActive = "—";
            if (lastMs) {
              const diff = Math.floor((now - lastMs) / 86400000);
              lastActive = diff === 0 ? "오늘" : diff === 1 ? "어제" : `${diff}일 전`;
            }
            return {
              nickname: p.profiles?.nickname || "멤버",
              emoji: p.profiles?.emoji || "",
              pct, page, total, lastActive,
              pacePerDay: Math.round(pacePerDay * 10) / 10,
              daysToFinish,
              expectedFinishDate,
              isMe: p.user_id === user.id,
            };
          });
          // 본인을 항상 맨 위로, 그 다음 진행률 내림차순
          mapped.sort((a, b) => {
            if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
            return b.pct - a.pct;
          });
          setMemberProgress(mapped);
          // 불씨 활성 멤버 초기화 (진행률 30 이상이면 자동 활성)
          const initActive: Record<string, boolean> = {};
          mapped.forEach((mm) => { initActive[mm.nickname] = mm.pct >= 30; });
          setBonfireActive(initActive);
        } catch {}
        // 그룹 스크랩 피드
        try {
          const sc = await getGroupScraps(supabase, cb.id);
          setGroupScraps(sc);
        } catch {}
      }
    } catch {} finally { setLoading(false); }
  }, [user, groupId, setBooks]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "28px 20px" }}>
      <div className="skeleton" style={{ height: 195, borderRadius: 16, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 80, borderRadius: 14 }} />
    </div>
  );

  if (!group) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--tm)" }}>모임을 찾을 수 없어요</p>
    </div>
  );

  const daysLeft = currentBook?.end_date
    ? Math.max(0, Math.ceil((new Date(currentBook.end_date).getTime() - Date.now()) / 86400000))
    : null;

  const nextSchedule = schedules.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).find(s => new Date(s.date) >= new Date());
  const nextDaysLeft = nextSchedule ? Math.max(0, Math.ceil((new Date(nextSchedule.date).getTime() - Date.now()) / 86400000)) : null;

  // 불씨 온도 계산 (TODO: UI에서 사용 예정)
  // const bonfireTemp = memberProgress.length > 0
  //   ? Math.round(memberProgress.reduce((s, m) => s + m.pct, 0) / memberProgress.length * 0.7 + 20)
  //   : 30;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 100, transition: "background 0.4s" }}>
      {/* 공통 헤더 */}
      <AppHeader streakDates={streakDates} counts={counts} />

      {/* ═══ 히어로 (책 커버 배경) ═══ */}
      {currentBook && (
        <div style={{ position: "relative", height: 195, overflow: "hidden", margin: "0 0 0" }}>
          {/* 커버 배경 블러 */}
          {currentBook.book_cover_url && (
            <img src={currentBook.book_cover_url} alt="" style={{ position: "absolute", inset: -20, width: "calc(100% + 40px)", height: "calc(100% + 40px)", objectFit: "cover", filter: "blur(30px) brightness(0.3)", opacity: 0.6 }} />
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0.5) 100%)" }} />

          {/* 뒤로가기 */}
          <button onClick={() => router.back()} style={{ position: "absolute", top: 14, left: 16, zIndex: 10, width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.38)", backdropFilter: "blur(12px)", border: "0.5px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <ArrowLeft size={16} color="rgba(255,255,255,0.85)" strokeWidth={2.2} />
          </button>

          {/* 공유하기 */}
          <button onClick={async () => {
            if (!group) return;
            const shareData = {
              title: `방긋 독서 모임: ${group.name}`,
              text: `함께 책을 읽어요! 초대 코드: ${group.invite_code}`,
              url: `${window.location.origin}/groups/join?code=${group.invite_code}`,
            };
            if (navigator.share) {
              try { await navigator.share(shareData); } catch { /* user cancelled */ }
            } else {
              try {
                await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
                toast("초대 링크를 복사했어요");
              } catch { toast.error("복사에 실패했어요"); }
            }
          }} style={{ position: "absolute", top: 14, right: 16, zIndex: 10, width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.38)", backdropFilter: "blur(12px)", border: "0.5px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Share2 size={15} color="rgba(255,255,255,0.85)" strokeWidth={2.2} />
          </button>

          {/* D-day 칩 */}
          <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 10, display: "flex", gap: 6 }}>
            {daysLeft != null && (
              <div style={{ background: "rgba(0,0,0,0.42)", backdropFilter: "blur(14px)", border: "0.5px solid rgba(255,255,255,0.18)", borderRadius: 100, padding: "5px 11px", display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: daysLeft <= 7 ? "#e86040" : "var(--ac2)" }} />
                완독 D-{daysLeft}
              </div>
            )}
            {nextDaysLeft != null && (
              <div style={{ background: "rgba(0,0,0,0.42)", backdropFilter: "blur(14px)", border: "0.5px solid rgba(255,255,255,0.18)", borderRadius: 100, padding: "5px 11px", display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ac2)" }} />
                모임 D-{nextDaysLeft}
              </div>
            )}
          </div>

          {/* 하단 정보 */}
          <div style={{ position: "absolute", bottom: 14, left: 18, right: 18, zIndex: 5 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.6)", marginBottom: 3 }}>{group.name}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.6px", lineHeight: 1.2, textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>{currentBook.book_title}</div>
            {currentBook.book_author && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>{currentBook.book_author}</div>}
          </div>
        </div>
      )}

      {/* ═══ 책 없을 때 그룹 헤더 + 공유 ═══ */}
      {!currentBook && group && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "0.5px solid var(--bd)", transition: "border-color 0.4s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => router.back()} style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--sf2)", border: "0.5px solid var(--bd2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <ArrowLeft size={15} color="var(--tp)" strokeWidth={2.2} />
            </button>
            <span style={{ fontSize: 16, fontWeight: 800, color: "var(--tp)", transition: "color 0.4s" }}>{group.name}</span>
          </div>
          <button onClick={async () => {
            const shareData = {
              title: `방긋 독서 모임: ${group.name}`,
              text: `함께 책을 읽어요! 초대 코드: ${group.invite_code}`,
              url: `${window.location.origin}/groups/join?code=${group.invite_code}`,
            };
            if (navigator.share) {
              try { await navigator.share(shareData); } catch { /* user cancelled */ }
            } else {
              try {
                await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
                toast("초대 링크를 복사했어요");
              } catch { toast.error("복사에 실패했어요"); }
            }
          }} style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--sf2)", border: "0.5px solid var(--bd2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <Share2 size={14} color="var(--tp)" strokeWidth={2.2} />
          </button>
        </div>
      )}

      {/* ═══ 멤버 스토리 링 ═══ */}
      {memberProgress.length > 0 && (
        <div style={{ padding: "14px 18px 12px", borderBottom: "0.5px solid var(--bd)", transition: "border-color 0.4s" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "var(--tm)", letterSpacing: "1px", textTransform: "uppercase", transition: "color 0.4s" }}>멤버 진행률</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: "var(--ac)", transition: "color 0.4s" }}>모임 평균 {memberProgress.length > 0 ? Math.round(memberProgress.reduce((s, m) => s + m.pct, 0) / memberProgress.length) : 0}%</span>
          </div>
          <div style={{ display: "flex", gap: 4, justifyContent: "space-around" }}>
            {memberProgress.slice(0, 4).map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: 1 }}>
                <div style={{ position: "relative", width: 56, height: 56 }}>
                  <ProgressRing pct={m.pct} color={AV_GRADS[i % 4].includes("#4a7ab8") ? "#4a7ab8" : i === 0 ? "var(--ac)" : AV_GRADS[i % 4].includes("#8a6030") ? "#8a6030" : "#7a4090"} />
                  <div style={{ position: "absolute", inset: 5, borderRadius: "50%", background: AV_GRADS[i % 4], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff" }}>
                    {m.nickname.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ position: "absolute", bottom: -3, right: -3, background: "var(--bg)", border: "1px solid var(--bd)", borderRadius: 100, padding: "1px 5px", fontSize: 8, fontWeight: 800, color: "var(--ac)", transition: "all 0.4s" }}>{m.pct}%</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: i === 0 ? 800 : 700, color: i === 0 ? "var(--tp)" : "var(--ts)", textAlign: "center", transition: "color 0.4s" }}>{i === 0 ? "나" : m.nickname}</span>
                <span style={{ fontSize: 9, color: "var(--tm)", textAlign: "center", transition: "color 0.4s" }}>{m.lastActive}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ 다음 모임 바 ═══ */}
      {nextSchedule && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", background: "color-mix(in srgb, var(--ac) 7%, var(--sf))", borderBottom: "0.5px solid var(--bd)", cursor: "pointer", transition: "all 0.2s, border-color 0.4s" }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "color-mix(in srgb, var(--ac) 18%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.4s" }}>
            <Calendar size={16} color="var(--ac)" strokeWidth={2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--tp)", transition: "color 0.4s" }}>
              {new Date(nextSchedule.date).toLocaleDateString("ko", { month: "long", day: "numeric", weekday: "short" })}
              {nextSchedule.time && ` ${nextSchedule.time.slice(0, 5)}`}
            </div>
            <div style={{ fontSize: 10, color: "var(--ts)", marginTop: 1, transition: "color 0.4s" }}>
              {nextSchedule.location || "장소 미정"}
            </div>
          </div>
          <div style={{ background: "var(--ac)", color: "var(--acc)", padding: "4px 10px", borderRadius: 100, fontSize: 10, fontWeight: 800, transition: "all 0.4s" }}>D-{nextDaysLeft}</div>
        </div>
      )}

      {/* ═══ 아이콘 탭 6개 ═══ */}
      <div style={{ display: "flex", borderBottom: "0.5px solid var(--bd)", padding: "0 4px", transition: "border-color 0.4s" }}>
        {INNER_TABS.map((t) => {
          const on = innerTab === t.id;
          return (
            <button key={t.id} onClick={() => setInnerTab(t.id)} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              padding: "10px 0 9px", cursor: "pointer", position: "relative",
              border: "none", background: "transparent",
            }}>
              <div style={{ color: on ? "var(--ac)" : "var(--tm)", transition: "color 0.25s" }}>{t.icon}</div>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: on ? "var(--ac)" : "var(--tm)", letterSpacing: "0.3px", transition: "color 0.25s" }}>{t.label}</span>
              {on && <div style={{ position: "absolute", bottom: -0.5, left: "10%", right: "10%", height: 2, background: "var(--ac)", borderRadius: "2px 2px 0 0", transition: "background 0.4s" }} />}
            </button>
          );
        })}
      </div>

      {/* ═══ 진행률 패널 ═══ */}
      {innerTab === "progress" && (() => {
        // 마감일 (currentBook.end_date)
        const deadlineMs = currentBook?.end_date ? new Date(currentBook.end_date).getTime() : null;
        const groupAvg = memberProgress.length > 0
          ? Math.round(memberProgress.reduce((s, m) => s + m.pct, 0) / memberProgress.length)
          : 0;

        // 멤버별 상태 계산
        const getStatus = (m: typeof memberProgress[number]) => {
          if (m.pct >= 100) return { key: "done", color: "#4ade80", bg: "rgba(74,222,128,0.1)", label: "완독", line: "수고했어요" };
          if (!deadlineMs || m.daysToFinish == null) {
            return { key: "neutral", color: "var(--tm)", bg: "var(--sf2)", label: "—", line: m.pacePerDay > 0 ? `하루 ${m.pacePerDay}p 페이스` : "아직 시작 전" };
          }
          const expectedMs = Date.now() + m.daysToFinish * 86400000;
          const slackMs = deadlineMs - expectedMs;
          const slackDays = Math.round(slackMs / 86400000);
          if (slackDays >= 2) return { key: "safe", color: "var(--ac)", bg: "color-mix(in srgb, var(--ac) 12%, transparent)", label: `+${slackDays}일 여유`, line: `이 페이스면 ${slackDays}일 일찍 끝나요` };
          if (slackDays >= 0) return { key: "tight", color: "#c8a030", bg: "rgba(200,160,48,0.13)", label: "딱 맞춤", line: "마감 아슬아슬, 페이스 유지!" };
          return { key: "behind", color: "#e86040", bg: "rgba(232,96,64,0.13)", label: `${-slackDays}일 늦어요`, line: `하루 ${Math.ceil((m.total - m.page) / Math.max(1, Math.ceil((deadlineMs - Date.now()) / 86400000)))}p 읽어야 따라잡아요` };
        };

        const deadlineDays = deadlineMs ? Math.max(0, Math.ceil((deadlineMs - Date.now()) / 86400000)) : null;
        const fmtDate = (d: Date | null) => d ? `${d.getMonth() + 1}/${d.getDate()}` : "—";

        if (memberProgress.length === 0) {
          return (
            <div style={{ padding: "40px 24px", textAlign: "center", animation: "pageIn 0.25s ease" }}>
              <Activity size={28} color="var(--tm)" strokeWidth={1.4} />
              <p style={{ fontSize: 13, color: "var(--ts)", marginTop: 12, fontWeight: 700 }}>아직 멤버가 책을 시작하지 않았어요</p>
              <p style={{ fontSize: 11, color: "var(--tm)", marginTop: 4 }}>누군가 첫 페이지를 넘기면 여기에 보여요</p>
            </div>
          );
        }

        return (
          <div style={{ animation: "pageIn 0.25s ease", padding: "14px 18px 4px" }}>

            {/* ── 모임 요약 카드 ── */}
            <div style={{
              borderRadius: 18,
              background: "linear-gradient(145deg, color-mix(in srgb, var(--ac) 9%, var(--sf)) 0%, var(--sf) 65%)",
              border: "0.5px solid var(--bd2)",
              padding: "16px 18px",
              marginBottom: 14,
              position: "relative",
              overflow: "hidden",
              transition: "all 0.4s",
            }}>
              {/* 데코 — 우상단 흐릿한 원 */}
              <div style={{ position: "absolute", top: -30, right: -30, width: 110, height: 110, borderRadius: "50%", background: "radial-gradient(circle, color-mix(in srgb, var(--ac) 22%, transparent), transparent 70%)", pointerEvents: "none" }} />

              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, position: "relative" }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "var(--tm)", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 6 }}>모임 평균</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 38, fontWeight: 800, color: "var(--tp)", letterSpacing: "-1.8px", lineHeight: 1, fontFeatureSettings: '"tnum"' }}>{groupAvg}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ts)" }}>%</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--ts)", marginTop: 6, fontWeight: 600 }}>{memberProgress.length}명 평균 · {memberProgress.filter(m => m.pct >= 100).length}명 완독</div>
                </div>

                {deadlineDays != null && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "var(--tm)", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 6 }}>마감까지</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 3, justifyContent: "flex-end" }}>
                      <span style={{ fontSize: 38, fontWeight: 800, color: deadlineDays <= 7 ? "#e86040" : "var(--ac)", letterSpacing: "-1.8px", lineHeight: 1, fontFeatureSettings: '"tnum"' }}>{deadlineDays}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ts)" }}>일</span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--ts)", marginTop: 6, fontWeight: 600 }}>{currentBook?.end_date && new Date(currentBook.end_date).toLocaleDateString("ko", { month: "long", day: "numeric" })}</div>
                  </div>
                )}
              </div>

              {/* 평균 진행 바 */}
              <div style={{ height: 5, background: "var(--sf3)", borderRadius: 3, overflow: "hidden", marginTop: 14, position: "relative" }}>
                <div style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg, var(--ac), var(--ac2))", width: `${groupAvg}%`, transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)" }} />
              </div>

              {/* 코칭 한 줄 */}
              {deadlineDays != null && (() => {
                const behind = memberProgress.filter(m => {
                  if (m.daysToFinish == null || m.pct >= 100) return false;
                  const expectedMs = Date.now() + m.daysToFinish * 86400000;
                  return expectedMs > deadlineMs!;
                }).length;
                const msg = behind === 0
                  ? `🎯 모두 페이스대로 가는 중이에요`
                  : behind === memberProgress.length
                  ? `⚠️ 모두 서두를 필요가 있어요`
                  : `${behind}명이 마감보다 느려요. 같이 페이스 올려봐요`;
                return (
                  <div style={{ marginTop: 12, fontSize: 11, color: behind === 0 ? "var(--ac2)" : "var(--ts)", fontWeight: 700, lineHeight: 1.5, position: "relative" }}>{msg}</div>
                );
              })()}
            </div>

            {/* ── 멤버 카드 리스트 ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {memberProgress.map((m, i) => {
                const st = getStatus(m);
                return (
                  <div key={i} style={{
                    background: m.isMe ? "color-mix(in srgb, var(--ac) 5%, var(--sf))" : "var(--sf)",
                    borderRadius: 14,
                    border: m.isMe ? "0.5px solid var(--bd2)" : "0.5px solid var(--bd)",
                    padding: "14px 14px 12px",
                    position: "relative",
                    overflow: "hidden",
                    transition: "all 0.3s",
                  }}>
                    {/* 본인 표시 — 좌측 액센트 라인 */}
                    {m.isMe && <div style={{ position: "absolute", left: 0, top: 14, bottom: 14, width: 2, borderRadius: "0 2px 2px 0", background: "var(--ac)" }} />}

                    {/* 헤더: 아바타 + 이름 + 상태 배지 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 11 }}>
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: AV_GRADS[i % 4], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                        {m.nickname.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--tp)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nickname}</span>
                          {m.isMe && <span style={{ fontSize: 9, fontWeight: 800, color: "var(--ac)", letterSpacing: "0.5px" }}>나</span>}
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: "var(--tm)", marginTop: 1, fontFeatureSettings: '"tnum"' }}>
                          {m.lastActive} · p.{m.page}{m.total > 0 ? ` / ${m.total}` : ""}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 9, fontWeight: 800, padding: "4px 9px", borderRadius: 100,
                        background: st.bg, color: st.color, whiteSpace: "nowrap", letterSpacing: "0.2px",
                      }}>{st.label}</div>
                    </div>

                    {/* 진행률 바 + 퍼센트 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                      <div style={{ flex: 1, height: 6, background: "var(--sf3)", borderRadius: 3, overflow: "hidden", position: "relative" }}>
                        <div style={{
                          height: "100%", borderRadius: 3,
                          background: st.key === "behind"
                            ? "linear-gradient(90deg, #e86040, #f08868)"
                            : st.key === "tight"
                            ? "linear-gradient(90deg, #c8a030, #dcb854)"
                            : st.key === "done"
                            ? "linear-gradient(90deg, #4ade80, #6df0a0)"
                            : "linear-gradient(90deg, var(--ac), var(--ac2))",
                          width: `${m.pct}%`,
                          transition: "width 0.7s cubic-bezier(0.22,1,0.36,1)",
                        }} />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: st.color, letterSpacing: "-0.4px", fontFeatureSettings: '"tnum"', minWidth: 36, textAlign: "right" }}>{m.pct}%</span>
                    </div>

                    {/* 메타: 페이스 + 예상 완독일 + 코칭 라인 */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 9, borderTop: "0.5px dashed var(--bd)" }}>
                      <div style={{ display: "flex", gap: 14 }}>
                        <div>
                          <div style={{ fontSize: 8, fontWeight: 800, color: "var(--tm)", letterSpacing: "0.6px", textTransform: "uppercase" }}>페이스</div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--tp)", marginTop: 1, fontFeatureSettings: '"tnum"' }}>{m.pacePerDay > 0 ? `${m.pacePerDay}p/일` : "—"}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 8, fontWeight: 800, color: "var(--tm)", letterSpacing: "0.6px", textTransform: "uppercase" }}>예상 완독</div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--tp)", marginTop: 1, fontFeatureSettings: '"tnum"' }}>
                            {m.pct >= 100 ? "완독함" : m.daysToFinish != null ? `${fmtDate(m.expectedFinishDate)} (${m.daysToFinish}일)` : "—"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 상태 메시지 (조용히, 풀폭) */}
                    {st.key !== "neutral" && (
                      <div style={{ marginTop: 9, fontSize: 10, color: st.color, fontWeight: 700, lineHeight: 1.5, opacity: 0.85 }}>
                        {st.line}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ height: 8 }} />
          </div>
        );
      })()}

      {/* ═══ 불씨 패널 ═══ */}
      {innerTab === "bonfire" && (() => {
        const activeMembers = memberProgress.filter((m) => bonfireActive[m.nickname]);
        const liveTemp = activeMembers.length > 0
          ? Math.round(activeMembers.reduce((s, m) => s + (m.pct * 0.7 + 20), 0) / activeMembers.length)
          : 18;
        const intensity = Math.max(0.15, Math.min(1, liveTemp / 100));
        const flameColor = liveTemp >= 70 ? "#e86040" : liveTemp >= 55 ? "#e88030" : liveTemp >= 35 ? "#c8a030" : "#4a7ab8";
        const message = activeMembers.length === 0
          ? "모임이 잠들었어요. 먼저 불씨를 피워볼까요?"
          : activeMembers.length === 1
          ? "혼자서 불씨를 지키고 있어요. 같이 읽어요"
          : activeMembers.length === memberProgress.length
          ? "모두가 함께 읽고 있어요. 불씨가 활활 타올라요!"
          : `${activeMembers.length}명이 함께 읽고 있어요. 불씨가 자라고 있어요`;

        // 불꽃 layer 개수 (온도 비례)
        const flameLayers = Math.max(2, Math.round(2 + intensity * 5));
        const flameH = 40 + intensity * 60;

        return (
          <div style={{ animation: "pageIn 0.25s ease", padding: "18px 18px 4px" }}>
            {/* ── 불씨 메인 스테이지 ── */}
            <div style={{
              position: "relative",
              borderRadius: 22,
              padding: "20px 18px 18px",
              background: `radial-gradient(ellipse at 50% 80%, color-mix(in srgb, ${flameColor} 18%, var(--sf)) 0%, var(--sf) 65%)`,
              border: "0.5px solid var(--bd2)",
              overflow: "hidden",
              transition: "all 0.6s",
            }}>
              {/* 별빛 데코 */}
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} style={{
                  position: "absolute",
                  top: `${10 + (i * 13) % 60}%`,
                  left: `${(i * 17 + 7) % 95}%`,
                  width: 2, height: 2, borderRadius: "50%",
                  background: "rgba(255,255,255,0.35)",
                  opacity: 0.4 + (i % 3) * 0.2,
                  pointerEvents: "none",
                }} />
              ))}

              <div style={{ fontSize: 9, fontWeight: 800, color: "var(--tm)", letterSpacing: "1.2px", textTransform: "uppercase", textAlign: "center", marginBottom: 14, position: "relative" }}>
                {group.name} 불씨
              </div>

              {/* SVG 불꽃 */}
              <div style={{ position: "relative", height: 140, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                <svg width="180" height="140" viewBox="0 0 180 140" style={{ overflow: "visible" }}>
                  {/* 불꽃 layer들 */}
                  {Array.from({ length: flameLayers }).map((_, i) => {
                    const cx = 90 + Math.sin(i * 1.3) * 6;
                    const w = 18 + i * 3.5 + intensity * 6;
                    const h = flameH - i * 5 + intensity * 8;
                    const cy = 110 - h / 2;
                    const colors = [flameColor, "#f0a050", "#ffd070", "#ffe8a0"];
                    const fc = colors[i % colors.length];
                    return (
                      <ellipse key={i} cx={cx} cy={cy} rx={w / 2} ry={h / 2} fill={fc}
                        opacity={0.55 + i * 0.08}
                        style={{
                          filter: `blur(${i === 0 ? 0.4 : 0}px)`,
                          transformOrigin: "center bottom",
                          animation: `flameDance${i % 3} ${2 + i * 0.3}s ease-in-out infinite`,
                        }}
                      />
                    );
                  })}
                  {/* 글로우 베이스 */}
                  <ellipse cx="90" cy="118" rx={48 + intensity * 12} ry="6"
                    fill={flameColor} opacity="0.35"
                    style={{ filter: "blur(8px)" }} />
                  {/* 장작 */}
                  <ellipse cx="90" cy="120" rx={45} ry="5" fill="#3a2a18" opacity="0.9" />
                  <rect x={45} y={117} width={90} height={7} rx={3.5} fill="#4a3520" opacity="0.95" />
                  <rect x={50} y={115} width={80} height={3} rx={1.5} fill="#5a4530" opacity="0.6" />
                </svg>

                <style>{`
                  @keyframes flameDance0 { 0%,100%{transform:scaleY(1) translateX(0);} 50%{transform:scaleY(1.08) translateX(-1px);} }
                  @keyframes flameDance1 { 0%,100%{transform:scaleY(1) translateX(0);} 50%{transform:scaleY(1.05) translateX(1.5px);} }
                  @keyframes flameDance2 { 0%,100%{transform:scaleY(1) translateX(0);} 50%{transform:scaleY(1.12) translateX(-0.5px);} }
                `}</style>
              </div>

              {/* 온도 + 메시지 */}
              <div style={{ textAlign: "center", marginTop: 10, position: "relative" }}>
                <div style={{ display: "inline-flex", alignItems: "baseline", gap: 3 }}>
                  <span style={{ fontSize: 44, fontWeight: 800, color: flameColor, letterSpacing: "-2px", lineHeight: 1, fontFeatureSettings: '"tnum"', textShadow: `0 0 24px ${flameColor}55` }}>{liveTemp}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: flameColor }}>°</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--ts)", fontStyle: "italic", marginTop: 6, fontWeight: 700 }}>{message}</div>
              </div>
            </div>

            {/* ── 멤버 토글 ── */}
            <div style={{ marginTop: 14, padding: "0 4px" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "var(--tm)", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 10, paddingLeft: 10 }}>모닥불 옆에 있는 사람</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                {memberProgress.map((m, i) => {
                  const on = bonfireActive[m.nickname];
                  const memberTemp = Math.round(m.pct * 0.7 + 20);
                  return (
                    <button
                      key={i}
                      onClick={() => setBonfireActive((prev) => ({ ...prev, [m.nickname]: !prev[m.nickname] }))}
                      style={{
                        background: "none", border: "none", cursor: "pointer", padding: 0,
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                        opacity: on ? 1 : 0.42,
                        transition: "opacity 0.2s",
                      }}
                    >
                      <div style={{
                        width: 38, height: 38, borderRadius: "50%",
                        background: AV_GRADS[i % 4],
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 800, color: "#fff",
                        border: on ? `2.5px solid ${flameColor}` : "2.5px solid var(--sf2)",
                        boxShadow: on ? `0 0 12px ${flameColor}55` : "none",
                        transition: "all 0.3s",
                      }}>{m.nickname.charAt(0).toUpperCase()}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: on ? flameColor : "var(--tm)", fontFeatureSettings: '"tnum"' }}>{memberTemp}°</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--tm)", maxWidth: 50, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.isMe ? "나" : m.nickname}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── 안내 ── */}
            <div style={{ marginTop: 16, padding: "12px 14px", background: "color-mix(in srgb, var(--ac) 6%, var(--sf2))", borderRadius: 12, fontSize: 11, color: "var(--ts)", lineHeight: 1.7, borderLeft: `2px solid ${flameColor}`, transition: "all 0.4s" }}>
              등수는 없어요. 모두가 모닥불 주변에 있어요. 많이 읽을수록 자기 온도가 올라가고, <strong style={{ color: "var(--tp)" }}>옆에 누가 있느냐가 모임 불씨를 결정해요.</strong>
            </div>
            <div style={{ height: 8 }} />
          </div>
        );
      })()}

      {/* ═══ 스크랩 패널 ═══ */}
      {innerTab === "scraps" && (() => {
        const filtered = scrapFilter === "mine"
          ? groupScraps.filter((s) => s.user_id === user?.id)
          : groupScraps;
        const fmtAgo = (iso: string) => {
          const diff = Date.now() - new Date(iso).getTime();
          const m = Math.floor(diff / 60000);
          if (m < 1) return "방금";
          if (m < 60) return `${m}분 전`;
          const h = Math.floor(m / 60);
          if (h < 24) return `${h}시간 전`;
          const d = Math.floor(h / 24);
          if (d < 30) return `${d}일 전`;
          return new Date(iso).toLocaleDateString("ko", { month: "long", day: "numeric" });
        };

        return (
          <div style={{ animation: "pageIn 0.25s ease", padding: "14px 18px 4px" }}>
            {/* 필터 칩 */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {([["all", "전체"], ["mine", "내 것만"]] as const).map(([k, label]) => {
                const on = scrapFilter === k;
                return (
                  <button key={k} onClick={() => setScrapFilter(k)} style={{
                    padding: "6px 14px", borderRadius: 100,
                    fontSize: 11, fontWeight: 800,
                    background: on ? "var(--ac)" : "transparent",
                    color: on ? "var(--acc)" : "var(--tm)",
                    border: on ? "0.5px solid var(--ac)" : "0.5px solid var(--bd2)",
                    cursor: "pointer", transition: "all 0.2s",
                  }}>{label}</button>
                );
              })}
              <div style={{ marginLeft: "auto", alignSelf: "center", fontSize: 10, fontWeight: 700, color: "var(--tm)" }}>{filtered.length}개</div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={PenLine}
                title="아직 그어진 문장이 없어요"
                description="책에서 마음에 드는 문장을 그어보세요"
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filtered.map((s) => {
                  const isMine = s.user_id === user?.id;
                  const liked = likedScraps[s.id];
                  const colorIdx = memberProgress.findIndex((m) => m.nickname === s.author_nickname);
                  const grad = AV_GRADS[Math.max(0, colorIdx) % 4];
                  return (
                    <div key={s.id} style={{
                      background: isMine ? "color-mix(in srgb, var(--ac) 5%, var(--sf))" : "var(--sf)",
                      borderRadius: 14,
                      border: "0.5px solid var(--bd)",
                      padding: "13px 14px 11px",
                      position: "relative",
                      overflow: "hidden",
                      transition: "all 0.3s",
                    }}>
                      {/* 좌측 액센트 */}
                      <div style={{ position: "absolute", left: 0, top: 13, bottom: 13, width: 2, borderRadius: "0 2px 2px 0", background: "var(--ac)", opacity: isMine ? 1 : 0.4 }} />

                      {/* 작성자 헤더 */}
                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10, paddingLeft: 6 }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff" }}>
                          {s.author_nickname.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--tp)" }}>
                            {s.author_nickname}{isMine && <span style={{ fontSize: 9, fontWeight: 800, color: "var(--ac)", marginLeft: 5 }}>나</span>}
                          </div>
                          <div style={{ fontSize: 9, fontWeight: 600, color: "var(--tm)", marginTop: 1 }}>
                            {fmtAgo(s.created_at)}{s.page_number ? ` · p.${s.page_number}` : ""}
                          </div>
                        </div>
                      </div>

                      {/* 인용 본문 */}
                      <div style={{ paddingLeft: 6, paddingRight: 4 }}>
                        <div style={{
                          fontSize: 13, color: "var(--tp)", lineHeight: 1.75, fontStyle: "italic",
                          fontFamily: '"Pretendard", serif',
                          letterSpacing: "-0.1px",
                        }}>
                          &ldquo;{s.text}&rdquo;
                        </div>
                        {s.memo && (
                          <div style={{ marginTop: 8, fontSize: 11, color: "var(--ts)", lineHeight: 1.6, paddingLeft: 10, borderLeft: "2px solid var(--bd2)" }}>
                            {s.memo}
                          </div>
                        )}
                      </div>

                      {/* 좋아요 */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginTop: 10, paddingTop: 9, borderTop: "0.5px dashed var(--bd)" }}>
                        <button
                          onClick={() => setLikedScraps((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: 11, fontWeight: 700,
                            color: liked ? "var(--ac)" : "var(--tm)",
                            transition: "color 0.15s",
                          }}
                        >
                          <Heart size={13} fill={liked ? "var(--ac)" : "none"} stroke={liked ? "var(--ac)" : "currentColor"} strokeWidth={2} />
                          <span style={{ fontFeatureSettings: '"tnum"' }}>{liked ? 1 : 0}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ height: 8 }} />
          </div>
        );
      })()}

      {/* ═══ 토론 패널 ═══ */}
      {innerTab === "discuss" && (() => {
        const fmtAgo = (iso: string) => {
          const diff = Date.now() - new Date(iso).getTime();
          const m = Math.floor(diff / 60000);
          if (m < 1) return "방금";
          if (m < 60) return `${m}분 전`;
          const h = Math.floor(m / 60);
          if (h < 24) return `${h}시간 전`;
          return `${Math.floor(h / 24)}일 전`;
        };

        const submitQuestion = async () => {
          if (!user || !group || !newQuestion.trim() || busy) return;
          setBusy(true);
          try {
            const supabase = createClient();
            await createGroupDiscussion(supabase, {
              group_id: group.id,
              group_book_id: currentBook?.id || null,
              author_id: user.id,
              question: newQuestion.trim(),
            });
            setNewQuestion("");
            setShowNewDiscussion(false);
            const dsc = await getGroupDiscussions(supabase, group.id);
            setDiscussions(dsc);
            toast.success("질문 카드를 던졌어요");
          } catch {
            toast.error("실패했어요");
          } finally { setBusy(false); }
        };

        return (
          <div style={{ animation: "pageIn 0.25s ease", padding: "14px 18px 4px" }}>
            {discussions.length === 0 && !showNewDiscussion ? (
              <div style={{ padding: "40px 24px", textAlign: "center" }}>
                <MessageCircle size={28} color="var(--tm)" strokeWidth={1.4} />
                <p style={{ fontSize: 13, color: "var(--ts)", marginTop: 12, fontWeight: 700 }}>첫 질문을 던져볼까요?</p>
                <p style={{ fontSize: 11, color: "var(--tm)", marginTop: 4 }}>책에서 떠오른 생각을 나눠봐요</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {discussions.map((d) => {
                  const colorIdx = memberProgress.findIndex((m) => m.nickname === d.author_nickname);
                  const grad = AV_GRADS[Math.max(0, colorIdx) % 4];
                  return (
                    <button
                      key={d.id}
                      onClick={async () => {
                        setOpenDiscussion(d);
                        const supabase = createClient();
                        const reps = await getDiscussionReplies(supabase, d.id);
                        setDiscussionReplies(reps);
                      }}
                      style={{
                        textAlign: "left",
                        background: "var(--sf)",
                        borderRadius: 16,
                        border: "0.5px solid var(--bd)",
                        padding: "16px 16px 13px",
                        cursor: "pointer",
                        position: "relative",
                        overflow: "hidden",
                        transition: "all 0.2s",
                      }}
                    >
                      {/* 인용부호 데코 */}
                      <div style={{ position: "absolute", top: 8, right: 14, fontSize: 56, fontFamily: "Georgia, serif", color: "var(--ac)", opacity: 0.08, fontWeight: 700, lineHeight: 1, pointerEvents: "none" }}>&ldquo;</div>

                      <div style={{ fontSize: 9, fontWeight: 800, color: "var(--ac)", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 8, position: "relative" }}>질문 카드</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tp)", lineHeight: 1.55, position: "relative", marginBottom: 12 }}>
                        {d.question}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 9, paddingTop: 11, borderTop: "0.5px dashed var(--bd)" }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff" }}>
                          {d.author_nickname?.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ts)" }}>{d.author_nickname}</span>
                        <span style={{ fontSize: 10, color: "var(--tm)" }}>· {fmtAgo(d.created_at)}</span>
                        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 800, color: "var(--ac)" }}>
                          <MessageCircle size={11} strokeWidth={2.5} />
                          답변 {d.reply_count || 0}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 새 질문 던지기 */}
            {showNewDiscussion ? (
              <div style={{ marginTop: 12, padding: 14, background: "var(--sf)", borderRadius: 16, border: "0.5px solid var(--bd2)" }}>
                <textarea
                  autoFocus
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="책을 읽다가 떠오른 질문을 적어보세요..."
                  style={{
                    width: "100%", minHeight: 84, resize: "none",
                    background: "transparent", border: "none", outline: "none",
                    fontSize: 13, color: "var(--tp)", lineHeight: 1.6,
                    fontFamily: "Pretendard, sans-serif",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--bd)" }}>
                  <button onClick={() => { setShowNewDiscussion(false); setNewQuestion(""); }} style={{
                    flex: 1, padding: "9px 0", borderRadius: 10, border: "0.5px solid var(--bd2)",
                    background: "transparent", color: "var(--ts)", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}>취소</button>
                  <button onClick={submitQuestion} disabled={!newQuestion.trim() || busy} style={{
                    flex: 2, padding: "9px 0", borderRadius: 10, border: "none",
                    background: "var(--ac)", color: "var(--acc)", fontSize: 12, fontWeight: 800, cursor: "pointer",
                    opacity: !newQuestion.trim() || busy ? 0.5 : 1,
                  }}>{busy ? "던지는 중..." : "질문 던지기"}</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewDiscussion(true)}
                style={{
                  width: "calc(100% - 0px)",
                  marginTop: 12, padding: 14,
                  background: "transparent",
                  border: "1px dashed color-mix(in srgb, var(--ac) 32%, transparent)",
                  borderRadius: 14,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <Plus size={16} color="var(--ac)" strokeWidth={2.2} />
                <span style={{ fontSize: 12, fontWeight: 800, color: "var(--ac)" }}>질문 카드 던지기</span>
              </button>
            )}
            <div style={{ height: 8 }} />
          </div>
        );
      })()}

      {/* 토론 상세 모달 */}
      {openDiscussion && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          animation: "fadeIn 0.2s ease",
        }} onClick={() => { setOpenDiscussion(null); setDiscussionReplies([]); setNewReply(""); }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: "100%", maxWidth: 393, maxHeight: "85vh",
            background: "var(--bg)", borderRadius: "24px 24px 0 0",
            border: "0.5px solid var(--bd2)", borderBottom: "none",
            display: "flex", flexDirection: "column",
            animation: "slideUp 0.3s cubic-bezier(0.22,1,0.36,1)",
          }}>
            <style>{`
              @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
              @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            `}</style>
            {/* 헤더 */}
            <div style={{ padding: "14px 18px", borderBottom: "0.5px solid var(--bd)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--ac)", letterSpacing: "1px", textTransform: "uppercase" }}>질문 카드</div>
              <button onClick={() => { setOpenDiscussion(null); setDiscussionReplies([]); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <X size={18} color="var(--tm)" />
              </button>
            </div>
            {/* 질문 본문 */}
            <div style={{ padding: "16px 18px", borderBottom: "0.5px solid var(--bd)" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--tp)", lineHeight: 1.5, marginBottom: 10 }}>
                {openDiscussion.question}
              </div>
              <div style={{ fontSize: 11, color: "var(--tm)", fontWeight: 600 }}>
                {openDiscussion.author_nickname} · {new Date(openDiscussion.created_at).toLocaleDateString("ko", { month: "long", day: "numeric" })}
              </div>
            </div>
            {/* 답변 리스트 */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {discussionReplies.length === 0 ? (
                <div style={{ padding: "30px 20px", textAlign: "center", fontSize: 12, color: "var(--tm)" }}>
                  첫 답변을 남겨보세요
                </div>
              ) : (
                discussionReplies.map((r) => {
                  const colorIdx = memberProgress.findIndex((m) => m.nickname === r.author_nickname);
                  const grad = AV_GRADS[Math.max(0, colorIdx) % 4];
                  return (
                    <div key={r.id} style={{ padding: "12px 18px", borderBottom: "0.5px solid var(--bd)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff" }}>
                          {r.author_nickname?.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--tp)" }}>{r.author_nickname}</span>
                        <span style={{ fontSize: 10, color: "var(--tm)", marginLeft: "auto" }}>{new Date(r.created_at).toLocaleDateString("ko", { month: "numeric", day: "numeric" })}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ts)", lineHeight: 1.65, paddingLeft: 32 }}>
                        {r.content}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {/* 답변 입력 */}
            <div style={{ padding: 12, borderTop: "0.5px solid var(--bd)", display: "flex", gap: 8 }}>
              <input
                type="text"
                value={newReply}
                onChange={(e) => setNewReply(e.target.value)}
                placeholder="답변 남기기..."
                style={{
                  flex: 1, padding: "10px 14px",
                  background: "var(--sf)", border: "0.5px solid var(--bd2)", borderRadius: 12,
                  fontSize: 13, color: "var(--tp)", outline: "none",
                  fontFamily: "Pretendard, sans-serif",
                }}
              />
              <button
                disabled={!newReply.trim() || busy}
                onClick={async () => {
                  if (!user || !openDiscussion || !newReply.trim()) return;
                  setBusy(true);
                  try {
                    const supabase = createClient();
                    await createDiscussionReply(supabase, {
                      discussion_id: openDiscussion.id,
                      author_id: user.id,
                      content: newReply.trim(),
                    });
                    setNewReply("");
                    const reps = await getDiscussionReplies(supabase, openDiscussion.id);
                    setDiscussionReplies(reps);
                    // 토론 목록의 reply_count 업데이트
                    setDiscussions((prev) => prev.map((d) => d.id === openDiscussion.id ? { ...d, reply_count: (d.reply_count || 0) + 1 } : d));
                  } catch { toast.error("실패했어요"); }
                  finally { setBusy(false); }
                }}
                style={{
                  padding: "10px 16px", borderRadius: 12, border: "none",
                  background: "var(--ac)", color: "var(--acc)",
                  fontSize: 12, fontWeight: 800, cursor: "pointer",
                  opacity: !newReply.trim() || busy ? 0.5 : 1,
                }}
              >보내기</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 일정 패널 ═══ */}
      {innerTab === "schedule" && (
        <div style={{ animation: "pageIn 0.2s ease", padding: "12px 18px 0" }}>
          {/* 독서 마감 */}
          {currentBook?.end_date && daysLeft != null && (
            <div style={{ background: "var(--sf)", borderRadius: 16, border: "0.5px solid var(--bd)", overflow: "hidden", marginBottom: 10, transition: "all 0.4s" }}>
              <div style={{ padding: "14px 16px 10px", background: "color-mix(in srgb, var(--ac) 8%, var(--sf))", display: "flex", alignItems: "flex-start", justifyContent: "space-between", transition: "background 0.4s" }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "var(--ac)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 4, transition: "color 0.4s" }}>독서 마감</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--tp)", transition: "color 0.4s" }}>{currentBook.book_title} 완독</div>
                  <div style={{ fontSize: 11, color: "var(--ts)", marginTop: 2, transition: "color 0.4s" }}>
                    {new Date(currentBook.end_date).toLocaleDateString("ko", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 34, fontWeight: 800, color: "var(--ac)", letterSpacing: "-1.5px", lineHeight: 1, transition: "color 0.4s" }}>{daysLeft}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", marginTop: 2, transition: "color 0.4s" }}>일 남음</div>
                </div>
              </div>
              <div style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)" }}>모임 평균</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ac)" }}>{memberProgress.length > 0 ? Math.round(memberProgress.reduce((s, m) => s + m.pct, 0) / memberProgress.length) : 0}%</span>
                </div>
                <div style={{ height: 5, background: "var(--sf3)", borderRadius: 3, overflow: "hidden", transition: "background 0.4s" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg, var(--ac), var(--ac2))", width: `${memberProgress.length > 0 ? Math.round(memberProgress.reduce((s, m) => s + m.pct, 0) / memberProgress.length) : 0}%`, transition: "width 0.5s" }} />
                </div>
              </div>
            </div>
          )}

          {/* 다음 모임 */}
          {nextSchedule && (
            <div style={{ background: "var(--sf)", borderRadius: 16, border: "0.5px solid var(--bd)", overflow: "hidden", marginBottom: 10, transition: "all 0.4s" }}>
              <div style={{ padding: "14px 16px 10px", background: "color-mix(in srgb, var(--ac) 8%, var(--sf))", display: "flex", alignItems: "flex-start", justifyContent: "space-between", transition: "background 0.4s" }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "var(--ac)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 4, transition: "color 0.4s" }}>다음 모임</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--tp)", transition: "color 0.4s" }}>{nextSchedule.title || "정기 모임"}</div>
                  <div style={{ fontSize: 11, color: "var(--ts)", marginTop: 2, transition: "color 0.4s" }}>
                    {new Date(nextSchedule.date).toLocaleDateString("ko", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
                    {nextSchedule.time && ` ${nextSchedule.time.slice(0, 5)}`}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 34, fontWeight: 800, color: "var(--ac2)", letterSpacing: "-1.5px", lineHeight: 1, transition: "color 0.4s" }}>{nextDaysLeft}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", marginTop: 2, transition: "color 0.4s" }}>일 남음</div>
                </div>
              </div>
              {nextSchedule.location && (
                <div style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--sf2)", borderRadius: 100, padding: "5px 10px", fontSize: 10, fontWeight: 700, color: "var(--ts)", transition: "all 0.4s" }}>
                      <MapPin size={11} strokeWidth={2} /> {nextSchedule.location}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--sf2)", borderRadius: 100, padding: "5px 10px", fontSize: 10, fontWeight: 700, color: "var(--ts)", transition: "all 0.4s" }}>
                      {members.length}명 참석
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 지난 모임 */}
          {(() => {
            const past = schedules
              .filter((s) => new Date(s.date) < new Date())
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            if (past.length === 0) return null;
            return (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "var(--tm)", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 10, paddingLeft: 4 }}>지난 모임 {past.length}회</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {past.slice(0, 6).map((s) => (
                    <div key={s.id} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "11px 14px", background: "var(--sf)", borderRadius: 12,
                      border: "0.5px solid var(--bd)",
                    }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 10,
                        background: "var(--sf2)", display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "var(--tm)", letterSpacing: "0.4px" }}>
                          {new Date(s.date).getMonth() + 1}월
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ts)", lineHeight: 1, fontFeatureSettings: '"tnum"' }}>
                          {new Date(s.date).getDate()}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tp)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.title || "정기 모임"}
                        </div>
                        {s.location && (
                          <div style={{ fontSize: 10, color: "var(--tm)", marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}>
                            <MapPin size={9} strokeWidth={2} />
                            {s.location}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          <div style={{ height: 16 }} />
        </div>
      )}

      {/* ═══ 포트폴리오 패널 ═══ */}
      {innerTab === "portfolio" && (() => {
        // 연도별 그룹핑
        const byYear = new Map<number, GroupBook[]>();
        groupBooks.forEach((gb) => {
          const y = new Date(gb.created_at).getFullYear();
          if (!byYear.has(y)) byYear.set(y, []);
          byYear.get(y)!.push(gb);
        });
        const years = Array.from(byYear.keys()).sort((a, b) => b - a);

        return (
          <div style={{ animation: "pageIn 0.25s ease", padding: "14px 18px 4px" }}>
            {/* ── 통계 카드 ── */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[
                { val: groupBooks.length, unit: "권", label: "함께 읽음", color: "var(--ac)" },
                { val: schedules.filter((s) => new Date(s.date) < new Date()).length, unit: "회", label: "모임 횟수", color: "var(--ac2)" },
                { val: members.length, unit: "명", label: "멤버", color: "#c8a030" },
              ].map((s, i) => (
                <div key={i} style={{
                  flex: 1, background: "var(--sf)", borderRadius: 14,
                  border: "0.5px solid var(--bd)", padding: "13px 10px",
                  textAlign: "center", transition: "all 0.4s",
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: "-1px", lineHeight: 1, fontFeatureSettings: '"tnum"' }}>
                    {s.val}<span style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", marginLeft: 1 }}>{s.unit}</span>
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "var(--tm)", textTransform: "uppercase", letterSpacing: "0.7px", marginTop: 5 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* ── 연도별 책 ── */}
            {groupBooks.length === 0 ? (
              <EmptyState
                icon={Library}
                title="아직 함께 읽은 책이 없어요"
                description="첫 책을 골라서 모임을 시작해봐요"
              />
            ) : (
              years.map((year) => {
                const books = byYear.get(year)!;
                return (
                  <div key={year} style={{ marginBottom: 18 }}>
                    {/* 시즌 헤더 */}
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", paddingBottom: 10, marginBottom: 12, borderBottom: "0.5px solid var(--bd)" }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 800, color: "var(--ac)", letterSpacing: "1.2px", textTransform: "uppercase" }}>시즌</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--tp)", letterSpacing: "-0.8px", marginTop: 2, fontFeatureSettings: '"tnum"' }}>{year}</div>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--tm)" }}>{books.length}권</div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                      {books.map((gb) => (
                        <button
                          key={gb.id}
                          onClick={() => router.push(`/book/${gb.id}`)}
                          style={{
                            display: "flex", flexDirection: "column", gap: 6,
                            background: "none", border: "none", padding: 0, cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <div style={{
                            width: "100%", aspectRatio: "2/3", borderRadius: 9,
                            overflow: "hidden", position: "relative", background: "var(--sf2)",
                            boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
                          }}>
                            {gb.book_cover_url ? (
                              <img src={gb.book_cover_url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(150deg, var(--sf3), var(--ac))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>{gb.book_title.slice(0, 8)}</span>
                              </div>
                            )}
                            {gb.status === "reading" && (
                              <div style={{ position: "absolute", bottom: 5, right: 5, background: "rgba(107,158,138,0.92)", backdropFilter: "blur(6px)", borderRadius: 100, padding: "3px 7px", fontSize: 8, fontWeight: 800, color: "var(--acc)" }}>진행중</div>
                            )}
                            {gb.status === "completed" && (
                              <div style={{ position: "absolute", bottom: 5, right: 5, background: "rgba(74,222,128,0.85)", backdropFilter: "blur(6px)", borderRadius: 100, padding: "3px 7px", fontSize: 8, fontWeight: 800, color: "#02120a" }}>완독</div>
                            )}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--tp)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                            {gb.book_title}
                          </div>
                          {gb.book_author && (
                            <div style={{ fontSize: 9, color: "var(--tm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{gb.book_author}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
            <div style={{ height: 16 }} />
          </div>
        );
      })()}

      {/* ═══ 설정 + 초대 ═══ */}
      {showInvite && group && (
        <InviteBottomSheet
          group={{ id: group.id, name: group.name, invite_code: group.invite_code, memberCount: members.length }}
          currentBook={currentBook ? { title: currentBook.book_title, cover_url: currentBook.book_cover_url || undefined } : undefined}
          onClose={() => setShowInvite(false)}
        />
      )}
    </div>
  );
}
