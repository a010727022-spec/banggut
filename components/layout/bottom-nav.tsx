"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, PenLine, MessageCircle, User } from "lucide-react";

const NAV_ITEMS = [
  { id: "library", label: "서재", icon: BookOpen, route: "/" },
  { id: "scrap", label: "스크랩", icon: PenLine, route: "/scrap" },
  { id: "groups", label: "모임", icon: MessageCircle, route: "/groups" },
  { id: "profile", label: "MY", icon: User, route: "/profile" },
];

export function BottomNav() {
  const pathname = usePathname();

  // 토론/서평 페이지에서는 자체 레이아웃을 사용하므로 하단 네비 숨김
  if (pathname.startsWith("/discuss") || pathname.startsWith("/review") || pathname.startsWith("/book/")) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-warm border-t border-[rgba(43,76,63,0.08)]">
      <div className="mx-auto max-w-lg flex items-center justify-around h-14 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.route === "/"
              ? pathname === "/"
              : pathname.startsWith(item.route);
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.route}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[44px] px-3 py-1 transition-colors ${
                isActive
                  ? "text-ink-green"
                  : "text-warmgray-light hover:text-warmgray"
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.6} />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
