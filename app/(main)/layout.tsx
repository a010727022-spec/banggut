import { BottomNav } from "@/components/layout/bottom-nav";
import { AuthGuard } from "@/components/providers/auth-guard";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <main className="pb-16">{children}</main>
      <BottomNav />
    </AuthGuard>
  );
}
