"use client";

import { useState } from "react";
import { Link2, QrCode, Image, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { shareKakaoInvite, copyInviteText, copyInviteLink, copyInviteCode } from "@/lib/share";
import { toast } from "sonner";

interface InviteBottomSheetProps {
  group: {
    id: string;
    name: string;
    invite_code: string;
    memberCount: number;
  };
  currentBook?: {
    title: string;
    cover_url?: string;
  };
  onClose: () => void;
}

export default function InviteBottomSheet({ group, currentBook, onClose }: InviteBottomSheetProps) {
  const [showQR, setShowQR] = useState(false);
  const domain = typeof window !== "undefined" ? window.location.origin : "";
  const joinUrl = `${domain}/groups/join?code=${group.invite_code}`;

  const shareButtons = [
    {
      label: "카카오톡",
      bg: "#FEE500",
      icon: (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="#3C1E1E">
          <path d="M12 3C6.48 3 2 6.58 2 10.9c0 2.78 1.8 5.22 4.5 6.6-.2.74-.72 2.68-.82 3.1-.13.52.19.51.4.37.17-.11 2.63-1.78 3.7-2.5.7.1 1.45.16 2.22.16 5.52 0 10-3.58 10-7.9S17.52 3 12 3z"/>
        </svg>
      ),
      onClick: () => shareKakaoInvite(group, currentBook),
    },
    {
      label: "링크 복사",
      bg: "#F7F3EE",
      icon: <Link2 size={18} color="#6B9E8A" strokeWidth={1.5} />,
      onClick: async () => {
        await copyInviteText(group, currentBook);
        toast.success("초대 메시지가 복사됐어요");
      },
    },
    {
      label: "QR코드",
      bg: "#F7F3EE",
      icon: <QrCode size={18} color="#6B9E8A" strokeWidth={1.5} />,
      onClick: () => setShowQR(true),
    },
    {
      label: "공유",
      bg: "#F7F3EE",
      icon: <Image size={18} color="#6B9E8A" strokeWidth={1.5} />,
      onClick: async () => {
        try {
          await navigator.share?.({
            title: `${group.name} 초대`,
            text: currentBook ? `같이 ${currentBook.title} 읽자!` : `${group.name}에서 같이 책 읽자!`,
            url: joinUrl,
          });
        } catch {
          await copyInviteLink(group.invite_code);
          toast.success("링크가 복사됐어요");
        }
      },
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 100 }} />

      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 101,
        background: "var(--sf)", borderRadius: "20px 20px 0 0",
        padding: "20px 24px calc(env(safe-area-inset-bottom, 0px) + 24px)",
        maxHeight: "80vh", overflowY: "auto",
        boxShadow: "0 -8px 30px rgba(0,0,0,0.12)",
        animation: "slideUp 0.3s ease-out",
      }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#E8E4DE" }} />
        </div>

        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#2D3A35" }}>멤버 초대</h3>
          <p style={{ fontSize: 12, color: "#A8A095", marginTop: 4 }}>{group.name}</p>
        </div>

        {/* QR Modal */}
        {showQR ? (
          <div style={{ textAlign: "center", padding: "16px 0 24px" }}>
            <div style={{ display: "inline-block", padding: 16, background: "var(--sf)", borderRadius: 16, border: "1px solid rgba(0,0,0,0.06)" }}>
              <QRCodeSVG value={joinUrl} size={180} fgColor="#2D3A35" bgColor="#fff" />
            </div>
            <p style={{ fontSize: 11, color: "#A8A095", marginTop: 12 }}>QR코드를 스캔하면 모임에 참여할 수 있어요</p>
            <button onClick={() => setShowQR(false)}
              style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: "#6B9E8A", background: "none", border: "none", cursor: "pointer" }}>
              돌아가기
            </button>
          </div>
        ) : (
          <>
            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 0.5, background: "rgba(0,0,0,0.06)" }} />
              <span style={{ fontSize: 11, color: "#A8A095" }}>링크로 초대</span>
              <div style={{ flex: 1, height: 0.5, background: "rgba(0,0,0,0.06)" }} />
            </div>

            {/* Share buttons */}
            <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 24 }}>
              {shareButtons.map((btn) => (
                <button key={btn.label} onClick={btn.onClick}
                  className="card-tap"
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer" }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%", background: btn.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: btn.bg === "#FEE500" ? "0 2px 8px rgba(254,229,0,0.3)" : "0 1px 4px rgba(0,0,0,0.05)",
                  }}>
                    {btn.icon}
                  </div>
                  <span style={{ fontSize: 9, color: "#8B9990", fontWeight: 500 }}>{btn.label}</span>
                </button>
              ))}
            </div>

            {/* Invite code */}
            <div style={{
              padding: "14px 16px", borderRadius: 14,
              background: "#F7F3EE", border: "0.5px solid rgba(0,0,0,0.04)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <span style={{ fontSize: 10, color: "#A8A095" }}>초대 코드</span>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#2D3A35", letterSpacing: "1px", marginTop: 2 }}>{group.invite_code}</p>
              </div>
              <button
                onClick={async () => {
                  await copyInviteCode(group.invite_code);
                  toast.success("코드가 복사됐어요");
                }}
                style={{
                  padding: "8px 14px", borderRadius: 8,
                  background: "#6B9E8A", color: "#fff",
                  fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                <Copy size={12} strokeWidth={1.5} />
                복사
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
