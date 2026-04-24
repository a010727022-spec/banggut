import { BottomNav } from "@/components/layout/bottom-nav";
import { AuthGuard } from "@/components/providers/auth-guard";
import { OfflineBanner } from "@/components/shared/OfflineBanner";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <OfflineBanner />
      <main className="pb-14">{children}</main>
      <BottomNav />
    </AuthGuard>
  );
}
