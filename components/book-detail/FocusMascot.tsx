"use client";

import Image from "next/image";

/**
 * FocusMascot — 집중 세션 상태별 방긋이 포즈 + 애니메이션.
 *
 * 매핑 (v6 mockup · `public/mockup-focus-hero-v6-refined.html`):
 *   idle    → mascot-morning.png · bob   3.2s  (갓 일어나 두근두근)
 *   running → mascot-read.png    · breath 4.2s (호흡처럼 스케일 1→1.035)
 *   done    → mascot-happy.png   · cheer  2.4s (점프하며 축하)
 *
 * @param state 집중 세션 상태
 * @param size  정사각 픽셀 (기본 68). 목업 idle 68, running/done 128 권장.
 * @param priority Next <Image> priority 플래그 (상단 노출 시 true)
 */

type FocusMascotState = "idle" | "running" | "done";

interface FocusMascotProps {
  state: FocusMascotState;
  size?: number;
  priority?: boolean;
}

const MASCOT_MAP: Record<
  FocusMascotState,
  { src: string; alt: string; anim: string; duration: string }
> = {
  idle: {
    src: "/mascot-morning.png",
    alt: "방긋이 아침 인사",
    anim: "fs-mascot-bob",
    duration: "3.2s",
  },
  running: {
    src: "/mascot-read.png",
    alt: "방긋이 독서 중",
    anim: "fs-mascot-breath",
    duration: "4.2s",
  },
  done: {
    src: "/mascot-happy.png",
    alt: "방긋이 완료 축하",
    anim: "fs-mascot-cheer",
    duration: "2.4s",
  },
};

export default function FocusMascot({
  state,
  size = 68,
  priority = false,
}: FocusMascotProps) {
  const meta = MASCOT_MAP[state];

  return (
    <>
      <style>{`
        @keyframes fs-mascot-bob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50%      { transform: translateY(-5px) rotate(-2deg); }
        }
        @keyframes fs-mascot-breath {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.035); }
        }
        @keyframes fs-mascot-cheer {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          30%      { transform: translateY(-8px) rotate(4deg); }
          60%      { transform: translateY(-4px) rotate(-3deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .fs-mascot-img { animation: none !important; }
        }
      `}</style>
      <div
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <Image
          className="fs-mascot-img"
          src={meta.src}
          alt={meta.alt}
          width={size}
          height={size}
          priority={priority}
          style={{
            objectFit: "contain",
            filter: "drop-shadow(2px 3px 0 rgba(43,36,32,.1))",
            animation: `${meta.anim} ${meta.duration} ease-in-out infinite`,
          }}
        />
      </div>
    </>
  );
}
