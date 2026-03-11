import type { Metadata, Viewport } from "next";
import { Noto_Serif_KR } from "next/font/google";
import "./globals.css";
import { SupabaseProvider } from "@/components/providers/supabase-provider";
import { Toaster } from "sonner";

const notoSerifKR = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["400", "600", "900"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "방긋 — 읽고, 긋고, 방긋.",
  description: "방금 그은 문장에서 대화가 시작돼요. AI와 1:1 독서토론을 하고 나만의 서평을 완성하세요.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#2B4C3F",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={notoSerifKR.variable}>
      <body className="font-serif antialiased">
        <SupabaseProvider>
          <div className="mx-auto max-w-lg min-h-screen bg-paper">
            {children}
          </div>
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "#FFFDF8",
                border: "1px solid rgba(43,76,63,0.08)",
                color: "#2C2C2C",
                fontFamily: "'Noto Serif KR', Georgia, serif",
              },
            }}
          />
        </SupabaseProvider>
      </body>
    </html>
  );
}
