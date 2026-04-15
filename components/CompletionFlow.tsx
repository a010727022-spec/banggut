"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Star, X, MessageCircle, PenTool, Share2, BookOpen } from "lucide-react";
import confetti from "canvas-confetti";
import { toPng } from "html-to-image";
import type { Book, Scrap } from "@/lib/types";

type Step = "celebrate" | "rate" | "next" | "card";

interface Props {
  book: Book;
  scraps: Scrap[];
  onClose: () => void;
  onSave: (updates: Partial<Book>) => void;
  onNavigate: (path: string) => void;
}

export default function CompletionFlow({ book, scraps, onClose, onSave, onNavigate }: Props) {
  const [step, setStep] = useState<Step>("celebrate");
  const [localRating, setLocalRating] = useState(book.rating ?? 0);
  const [localOneLiner, setLocalOneLiner] = useState(book.one_liner ?? "");
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const confettiFired = useRef(false);

  // 1단계: 컨페티
  useEffect(() => {
    if (step === "celebrate" && !confettiFired.current) {
      confettiFired.current = true;
      const duration = 2500;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ["#fbbf24", "#34d399", "#60a5fa", "#f472b6"],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ["#fbbf24", "#34d399", "#60a5fa", "#f472b6"],
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [step]);

  const readingDays = book.reading_days || (() => {
    if (!book.started_at) return null;
    const start = new Date(book.started_at);
    const end = book.finished_at ? new Date(book.finished_at) : new Date();
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  })();

  // 2단계: 별점 + 한줄평 저장
  const handleSaveRating = useCallback(() => {
    const updates: Partial<Book> = {};
    if (localRating > 0) updates.rating = localRating;
    if (localOneLiner.trim()) updates.one_liner = localOneLiner.trim();
    if (Object.keys(updates).length > 0) {
      setSaving(true);
      onSave(updates);
      setTimeout(() => {
        setSaving(false);
        setStep("next");
      }, 400);
    } else {
      setStep("next");
    }
  }, [localRating, localOneLiner, onSave]);

  // 4단계: 완독 카드 이미지 저장
  const handleSaveCard = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 3 });
      const link = document.createElement("a");
      link.download = `${book.title}_완독카드.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // 공유 API 폴백
      alert("이미지 저장에 실패했어요");
    }
  };

  const handleShareCard = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 3 });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${book.title}_완독카드.png`, { type: "image/png" });
      if (navigator.share) {
        await navigator.share({ files: [file], title: `${book.title} 완독!` });
      } else {
        handleSaveCard();
      }
    } catch {
      handleSaveCard();
    }
  };

  const bestScrap = scraps.length > 0 ? scraps[0] : null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "#fff", borderRadius: 24, width: "100%", maxWidth: 380,
        maxHeight: "85vh", overflowY: "auto",
        boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
        position: "relative",
      }}>
        {/* 닫기 */}
        <button onClick={onClose} style={{
          position: "absolute", top: 14, right: 14, zIndex: 10,
          width: 32, height: 32, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.06)",
        }}>
          <X size={16} color="#666" />
        </button>

        {/* ===== 1단계: 팡파레 ===== */}
        {step === "celebrate" && (
          <div style={{ padding: "48px 28px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111", marginBottom: 8 }}>
              완독을 축하해요!
            </h2>
            <p style={{ fontSize: 18, fontWeight: 700, color: "var(--theme-deep, #2B4C3F)", marginBottom: 6 }}>
              {book.title}
            </p>
            {readingDays && (
              <p style={{ fontSize: 14, color: "#888", marginBottom: 32 }}>
                {readingDays}일 만에 읽었어요
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => setStep("rate")}
                style={{
                  padding: "14px 0", borderRadius: 14, border: "none",
                  background: "var(--theme-deep, #2B4C3F)", color: "#fff",
                  fontSize: 15, fontWeight: 700, cursor: "pointer",
                }}
              >
                기록 남기기
              </button>
              <button
                onClick={() => setStep("next")}
                style={{
                  padding: "12px 0", borderRadius: 14, border: "none",
                  background: "transparent", color: "#aaa",
                  fontSize: 14, fontWeight: 500, cursor: "pointer",
                }}
              >
                건너뛰기
              </button>
            </div>
          </div>
        )}

        {/* ===== 2단계: 별점 + 한줄평 ===== */}
        {step === "rate" && (
          <div style={{ padding: "40px 28px 32px" }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111", textAlign: "center", marginBottom: 24 }}>
              이 책 어땠어요?
            </h3>

            {/* 별점 */}
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => setLocalRating(v === localRating ? 0 : v)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}
                >
                  <Star
                    size={36}
                    fill={v <= localRating ? "#fbbf24" : "none"}
                    stroke={v <= localRating ? "#fbbf24" : "#ddd"}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>

            {/* 한줄평 */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 12, color: "#aaa", marginBottom: 6 }}>한줄평 (선택)</p>
              <input
                type="text"
                value={localOneLiner}
                onChange={(e) => setLocalOneLiner(e.target.value)}
                placeholder="이 책을 한 문장으로 표현한다면?"
                maxLength={100}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 12,
                  border: "1px solid #e5e7eb", fontSize: 14,
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={handleSaveRating}
                disabled={saving}
                style={{
                  padding: "14px 0", borderRadius: 14, border: "none",
                  background: "var(--theme-deep, #2B4C3F)", color: "#fff",
                  fontSize: 15, fontWeight: 700, cursor: "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "저장 중" : "다음"}
              </button>
              <button
                onClick={() => setStep("next")}
                style={{
                  padding: "12px 0", borderRadius: 14, border: "none",
                  background: "transparent", color: "#aaa",
                  fontSize: 14, fontWeight: 500, cursor: "pointer",
                }}
              >
                건너뛰기
              </button>
            </div>
          </div>
        )}

        {/* ===== 3단계: 다음 행동 ===== */}
        {step === "next" && (
          <div style={{ padding: "40px 28px 32px" }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111", textAlign: "center", marginBottom: 8 }}>
              다음은 뭘 할까요?
            </h3>
            <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", marginBottom: 24 }}>
              아무거나 골라도, 안 골라도 괜찮아요
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { icon: <MessageCircle size={20} />, label: "토론하기", desc: "방긋이와 이 책에 대해 이야기해요", action: () => onNavigate(`/discuss/${book.id}`) },
                { icon: <PenTool size={20} />, label: "서평 쓰기", desc: "읽은 감상을 글로 남겨요", action: () => onNavigate(`/review/${book.id}`) },
                { icon: <Share2 size={20} />, label: "완독 카드 만들기", desc: "예쁜 카드로 기록하고 공유해요", action: () => setStep("card") },
                { icon: <BookOpen size={20} />, label: "다음 책 고르기", desc: "새로운 책을 서재에 추가해요", action: () => onNavigate("/setup") },
              ].map(({ icon, label, desc, action }) => (
                <button
                  key={label}
                  onClick={action}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 16px", borderRadius: 14,
                    border: "1px solid #f0f0f0", background: "#fafafa",
                    cursor: "pointer", textAlign: "left",
                    transition: "all 0.15s",
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
                  onMouseUp={(e) => (e.currentTarget.style.transform = "")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: "var(--theme-deep, #2B4C3F)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>{icon}</div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{label}</p>
                    <p style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              style={{
                width: "100%", marginTop: 16,
                padding: "12px 0", borderRadius: 14, border: "none",
                background: "transparent", color: "#aaa",
                fontSize: 14, fontWeight: 500, cursor: "pointer",
              }}
            >
              나중에 할게요
            </button>
          </div>
        )}

        {/* ===== 4단계: 완독 카드 ===== */}
        {step === "card" && (
          <div style={{ padding: "32px 20px 28px" }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111", textAlign: "center", marginBottom: 16 }}>
              완독 카드
            </h3>

            {/* 카드 미리보기 */}
            <div
              ref={cardRef}
              style={{
                background: "linear-gradient(145deg, var(--theme-deep, #2B4C3F) 0%, color-mix(in srgb, var(--theme-deep, #2B4C3F) 70%, #000) 100%)",
                borderRadius: 20, padding: "28px 24px", color: "#fff",
                position: "relative", overflow: "hidden",
              }}
            >
              {/* 배경 장식 */}
              <div style={{
                position: "absolute", top: -30, right: -30,
                width: 120, height: 120, borderRadius: "50%",
                background: "rgba(255,255,255,0.06)",
              }} />
              <div style={{
                position: "absolute", bottom: -20, left: -20,
                width: 80, height: 80, borderRadius: "50%",
                background: "rgba(255,255,255,0.04)",
              }} />

              {/* 상단: 방긋 로고 */}
              <p style={{ fontSize: 11, opacity: 0.5, marginBottom: 20, letterSpacing: 2 }}>방긋 BANGGUT</p>

              {/* 책 정보 */}
              <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
                {book.cover_url ? (
                  <img
                    src={book.cover_url}
                    alt=""
                    style={{ width: 72, height: 108, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div style={{
                    width: 72, height: 108, borderRadius: 8, flexShrink: 0,
                    background: "rgba(255,255,255,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 32,
                  }}><BookOpen size={32} strokeWidth={1.3} style={{ color: "var(--ac)", opacity: 0.6 }} /></div>
                )}
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <p style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.3, marginBottom: 4 }}>{book.title}</p>
                  {book.author && <p style={{ fontSize: 12, opacity: 0.6 }}>{book.author}</p>}
                  {/* 별점 */}
                  {(localRating > 0 || book.rating) && (
                    <div style={{ display: "flex", gap: 2, marginTop: 8 }}>
                      {[1, 2, 3, 4, 5].map((v) => (
                        <Star
                          key={v}
                          size={14}
                          fill={v <= (localRating || book.rating || 0) ? "#fbbf24" : "none"}
                          stroke={v <= (localRating || book.rating || 0) ? "#fbbf24" : "rgba(255,255,255,0.3)"}
                          strokeWidth={1.5}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 한줄평 또는 스크랩 명언 */}
              {(localOneLiner || book.one_liner || bestScrap) && (
                <div style={{
                  borderLeft: "2px solid rgba(255,255,255,0.2)",
                  paddingLeft: 12, marginBottom: 20,
                }}>
                  <p style={{ fontSize: 13, fontStyle: "italic", lineHeight: 1.6, opacity: 0.85 }}>
                    &ldquo;{localOneLiner || book.one_liner || bestScrap?.text}&rdquo;
                  </p>
                </div>
              )}

              {/* 하단: 읽은 기간 */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                borderTop: "1px solid rgba(255,255,255,0.1)",
                paddingTop: 14, marginTop: 4,
              }}>
                <div>
                  {readingDays && (
                    <p style={{ fontSize: 11, opacity: 0.5 }}>{readingDays}일간 읽었어요</p>
                  )}
                  {book.finished_at && (
                    <p style={{ fontSize: 11, opacity: 0.4, marginTop: 2 }}>
                      {book.finished_at.slice(0, 10).replace(/-/g, ".")} 완독
                    </p>
                  )}
                </div>
                <p style={{ fontSize: 24 }}>🎉</p>
              </div>
            </div>

            {/* 버튼들 */}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                onClick={handleSaveCard}
                style={{
                  flex: 1, padding: "13px 0", borderRadius: 14,
                  border: "1px solid #e5e7eb", background: "#fff",
                  fontSize: 14, fontWeight: 700, color: "#333", cursor: "pointer",
                }}
              >
                이미지 저장
              </button>
              <button
                onClick={handleShareCard}
                style={{
                  flex: 1, padding: "13px 0", borderRadius: 14,
                  border: "none", background: "var(--theme-deep, #2B4C3F)",
                  fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer",
                }}
              >
                공유하기
              </button>
            </div>

            <button
              onClick={onClose}
              style={{
                width: "100%", marginTop: 10,
                padding: "12px 0", borderRadius: 14, border: "none",
                background: "transparent", color: "#aaa",
                fontSize: 14, fontWeight: 500, cursor: "pointer",
              }}
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
