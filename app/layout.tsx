import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { SupabaseProvider } from "@/components/providers/supabase-provider";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "방긋 — 읽고, 긋고, 방긋.",
  description:
    "방금 그은 문장에서 대화가 시작돼요. AI와 1:1 토론을 하고 나만의 서평을 완성하세요.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0c0f0d",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* 테마 플래시 방지: hydrate 전에 localStorage에서 테마를 읽어 즉시 적용 */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var s = localStorage.getItem('banggut-theme');
              if (s) {
                var p = JSON.parse(s);
                var t = p && p.state && p.state.theme;
                if (t && ['dark','cream','navy','sepia','blossom'].indexOf(t) !== -1) {
                  document.documentElement.setAttribute('data-theme', t);
                }
              }
            } catch(e) {}
          })();
        `}} />
      </head>
      <body>
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
          strategy="afterInteractive"
        />
        <Script id="kakao-init" strategy="afterInteractive">
          {`if(window.Kakao&&!window.Kakao.isInitialized()){window.Kakao.init("${process.env.NEXT_PUBLIC_KAKAO_KEY||""}")}`}
        </Script>
        <PostHogProvider>
        <SupabaseProvider>
          <ThemeProvider />
          <div className="mx-auto max-w-lg min-h-screen" style={{ background: "var(--bg)", transition: "background 0.4s" }}>
            {children}
          </div>
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "var(--sf)",
                border: "0.5px solid var(--bd2)",
                color: "var(--tp)",
                fontFamily: "'Pretendard', sans-serif",
                borderRadius: "100px",
                fontSize: "12px",
                fontWeight: 700,
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                padding: "9px 18px",
              },
            }}
          />
        </SupabaseProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
