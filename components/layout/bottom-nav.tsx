"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, Users, PenLine, User } from "lucide-react";

const NAV_ITEMS = [
  { id: "home",    label: "홈",     icon: Home,     route: "/",        ariaLabel: "홈 대시보드로 이동" },
  { id: "library", label: "서재",   icon: Library,  route: "/library", ariaLabel: "내 서재로 이동" },
  { id: "groups",  label: "모임",   icon: Users,    route: "/groups",  ariaLabel: "독서 모임으로 이동" },
  { id: "reviews", label: "서평",   icon: PenLine,  route: "/scrap",   ariaLabel: "스크랩 서평으로 이동" },
  { id: "profile", label: "내정보", icon: User,     route: "/profile", ariaLabel: "내 정보로 이동" },
];

export function BottomNav() {
  const pathname = usePathname();

  if (
    pathname.startsWith("/discuss/") ||
    pathname.startsWith("/review/") ||
    pathname.startsWith("/book/") ||
    pathname.startsWith("/settings/")
  ) return null;

  return (
    <nav aria-label="하단 내비게이션" className="fixed bottom-0 left-0 right-0 z-50" style={{
      borderTop: "0.5px solid var(--bd)",
      background: "color-mix(in srgb, var(--bg) 92%, transparent)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      transition: "background var(--duration-slow) var(--easing-default), border-color var(--duration-slow)",
    }}>
      <div className="mx-auto max-w-lg flex items-center justify-around"
        style={{
          height: "var(--nav-height)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.route === "/" ? pathname === "/" : pathname.startsWith(item.route);
          const Icon = item.icon;
          return (
            <Link key={item.id} href={item.route}
              aria-label={item.ariaLabel}
              className="flex flex-col items-center justify-center"
              style={{
                cursor: "pointer",
                minWidth: 56,
                height: "100%",
                gap: 3,
                position: "relative",
              }}>
              <Icon style={{
                width: 20, height: 20,
                stroke: isActive ? "var(--ac)" : "var(--tm)",
                strokeWidth: isActive ? 2 : 1.75,
                transition: "stroke var(--duration-fast) var(--easing-default)",
              }} />
              <span style={{
                fontSize: 10,
                fontFamily: isActive ? "var(--font-playful)" : "var(--font-body)",
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--ac)" : "var(--tm)",
                letterSpacing: isActive ? "var(--ls-gaegu)" : "0.2px",
                transition: "color var(--duration-fast) var(--easing-default)",
                lineHeight: 1,
              }}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
