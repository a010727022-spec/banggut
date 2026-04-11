"use client";

import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({ icon: Icon, title, description, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <div
      style={{
        borderRadius: 20,
        padding: "40px 24px 32px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
        background: "var(--sf)",
        border: "0.5px solid var(--bd)",
      }}
    >
      {/* Top accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background:
            "linear-gradient(90deg, transparent 10%, color-mix(in srgb, var(--ac) 15%, transparent) 50%, transparent 90%)",
        }}
      />

      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          top: -40,
          left: "50%",
          transform: "translateX(-50%)",
          width: 200,
          height: 160,
          background: "radial-gradient(ellipse, var(--ac), transparent 70%)",
          opacity: 0.04,
          pointerEvents: "none",
        }}
      />

      {/* Icon with circle */}
      <div
        style={{
          width: 64,
          height: 64,
          margin: "0 auto",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "1px solid var(--ac)",
            opacity: 0.12,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={30} strokeWidth={1.3} style={{ color: "var(--ac)", opacity: 0.55 }} />
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--tp)",
          marginTop: 20,
          position: "relative",
        }}
      >
        {title}
      </div>

      {/* Description */}
      {description && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 300,
            color: "var(--ts)",
            marginTop: 8,
            lineHeight: 1.8,
            position: "relative",
          }}
        >
          {description}
        </div>
      )}

      {/* CTA */}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          style={{
            marginTop: 22,
            background: "var(--ac)",
            color: "var(--acc)",
            padding: "10px 22px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 2px 16px color-mix(in srgb, var(--ac) 18%, transparent)",
            transition: "transform 0.15s",
          }}
          onMouseDown={(e) => ((e.target as HTMLElement).style.transform = "scale(0.96)")}
          onMouseUp={(e) => ((e.target as HTMLElement).style.transform = "scale(1)")}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
