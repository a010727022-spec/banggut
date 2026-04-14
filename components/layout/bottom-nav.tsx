"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Users, PenLine, User } from "lucide-react";

const NAV_ITEMS = [
  { id: "library", label: "서재",  icon: BookOpen, route: "/",        ariaLabel: "내 서재로 이동" },
  { id: "groups",  label: "모임",  icon: Users,    route: "/groups",  ariaLabel: "독서 모임으로 이동" },
  { id: "reviews", label: "서평",  icon: PenLine,  route: "/scrap",   ariaLabel: "스크랩 서평으로 이동" },
  { id: "profile", label: "MY",    icon: User,     route: "/profile", ariaLabel: "내 프로필로 이동" },
];

export function BottomNav() {
  const pathname = usePathname();

  if (
    pathname.startsWith("/discuss/") ||
    pathname.startsWith("/review/") ||
    pathname.startsWith("/book/")
  ) return null;

  return (
    <nav aria-label="하단 내비게이션" className="fixed bottom-0 left-0 right-0 z-50" style={{
      borderTop: "0.5px solid var(--bd)",
      background: "color-mix(in srgb, var(--bg) 92%, transparent)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      transition: "all 0.4s",
    }}>
      <div className="mx-auto max-w-lg flex items-center justify-around"
        style={{ paddingTop: 10, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.route === "/" ? pathname === "/" : pathname.startsWith(item.route);
          const Icon = item.icon;
          return (
            <Link key={item.id} href={item.route}
              aria-label={item.ariaLabel}
              className="flex flex-col items-center gap-1"
              style={{ cursor: "pointer", padding: "4px 0", minWidth: 56 }}>
              <Icon style={{
                width: 22, height: 22,
                stroke: isActive ? "var(--ac)" : "var(--tm)",
                strokeWidth: isActive ? 2 : 1.8,
                transition: "stroke 0.4s",
              }} />
              <span style={{
                fontSize: 9, fontWeight: 700,
                color: isActive ? "var(--ac)" : "var(--tm)",
                letterSpacing: "0.8px", textTransform: "uppercase",
                transition: "color 0.4s",
              }}>{item.label}</span>
              <div style={{
                width: 4, height: 4, borderRadius: "50%",
                background: "var(--ac)",
                opacity: isActive ? 1 : 0,
                transition: "opacity 0.2s, background 0.4s",
              }} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
