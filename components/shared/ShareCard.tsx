"use client";

import { forwardRef } from "react";
import { BookOpen, Star, Quote, User } from "lucide-react";

export interface ShareCardProps {
  bookTitle: string;
  bookAuthor: string | null;
  oneliner: string;
  rating: number | null;
  nickname: string;
  /** "essay" | "structured" */
  mode: "essay" | "structured";
}

/**
 * Instagram-friendly (1080x1350) shareable review card.
 * Rendered as a styled div so html-to-image can capture it.
 * All colors use CSS variables for multi-theme support.
 */
const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  ({ bookTitle, bookAuthor, oneliner, rating, nickname, mode }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: 1350,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "var(--bg)",
          fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          color: "var(--tp)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative background accent circle */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background: "var(--ac)",
            opacity: 0.06,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -80,
            left: -80,
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: "var(--ac2)",
            opacity: 0.04,
          }}
        />

        {/* Top section: mode badge */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              borderRadius: 100,
              background: "var(--sf)",
              border: "1px solid var(--bd2)",
              fontSize: 24,
              fontWeight: 600,
              color: "var(--ts)",
              marginBottom: 60,
            }}
          >
            <BookOpen size={24} strokeWidth={2} />
            {mode === "essay" ? "에세이 서평" : "한줄 서평"}
          </div>
        </div>

        {/* Center section: book info + review */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Book title */}
          <h1
            style={{
              fontSize: bookTitle.length > 20 ? 52 : 64,
              fontWeight: 800,
              color: "var(--tp)",
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
              marginBottom: 16,
              wordBreak: "keep-all",
            }}
          >
            {bookTitle}
          </h1>

          {/* Author */}
          {bookAuthor && (
            <p
              style={{
                fontSize: 28,
                fontWeight: 500,
                color: "var(--ts)",
                marginBottom: 48,
              }}
            >
              {bookAuthor}
            </p>
          )}

          {/* Divider */}
          <div
            style={{
              width: 60,
              height: 3,
              background: "var(--ac)",
              borderRadius: 2,
              marginBottom: 48,
            }}
          />

          {/* Rating stars */}
          {rating !== null && rating > 0 && (
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 32,
              }}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={32}
                  fill={i < rating ? "var(--ac)" : "transparent"}
                  stroke={i < rating ? "var(--ac)" : "var(--tm)"}
                  strokeWidth={1.5}
                />
              ))}
            </div>
          )}

          {/* One-liner / review quote */}
          {oneliner && (
            <div
              style={{
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              <Quote
                size={36}
                strokeWidth={1.5}
                style={{
                  color: "var(--ac)",
                  flexShrink: 0,
                  marginTop: 4,
                }}
              />
              <p
                style={{
                  fontSize: oneliner.length > 60 ? 28 : 34,
                  fontWeight: 500,
                  color: "var(--tp)",
                  lineHeight: 1.6,
                  wordBreak: "keep-all",
                }}
              >
                {oneliner}
              </p>
            </div>
          )}
        </div>

        {/* Bottom section: user + branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            zIndex: 1,
            borderTop: "1px solid var(--bd)",
            paddingTop: 40,
          }}
        >
          {/* User info */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "var(--ac)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <User size={24} strokeWidth={2} style={{ color: "var(--acc)" }} />
            </div>
            <span
              style={{
                fontSize: 26,
                fontWeight: 600,
                color: "var(--ts)",
              }}
            >
              {nickname}
            </span>
          </div>

          {/* App branding */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 22,
              fontWeight: 700,
              color: "var(--tm)",
              letterSpacing: "-0.01em",
            }}
          >
            <BookOpen size={22} strokeWidth={2} style={{ color: "var(--ac)" }} />
            방긋
          </div>
        </div>
      </div>
    );
  }
);

ShareCard.displayName = "ShareCard";

export default ShareCard;
