"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);

    setOffline(!navigator.onLine);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div style={{
      margin: "0 16px 8px",
      padding: "10px 14px",
      background: "color-mix(in srgb, var(--ac) 8%, var(--sf))",
      border: "1px solid color-mix(in srgb, var(--ac) 20%, var(--bd))",
      borderRadius: 12,
      display: "flex",
      alignItems: "center",
      gap: 10,
      transition: "all 0.4s",
    }}>
      <WifiOff size={16} color="var(--tm)" strokeWidth={2} style={{ flexShrink: 0 }} />
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ts)", margin: 0 }}>
        인터넷 연결을 확인해주세요
      </p>
    </div>
  );
}
