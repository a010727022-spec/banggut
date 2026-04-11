import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // 테마 CSS 변수
        "theme-bg":   "var(--theme-bg)",
        "theme-deep": "var(--theme-deep)",
        "theme-soft": "var(--theme-soft)",
        "theme-gold": "var(--theme-gold)",

        // CSS variable theme tokens
        "sf":  "var(--sf)",
        "sf2": "var(--sf2)",
        "sf3": "var(--sf3)",
        "bg-page": "var(--bg)",
        "tp": "var(--tp)",
        "ts": "var(--ts)",
        "tm": "var(--tm)",
        "ac": "var(--ac)",
        "ac2": "var(--ac2)",
        "ac3": "var(--ac3)",
        "acc": "var(--acc)",
        "bd": "var(--bd)",
        "bd2": "var(--bd2)",

        // ── 10색 팔레트 ──
        "dusty-blue":  "#B5C7D8",
        "pale-sage":   "#D4DDD0",
        blush:         "#E8DFDA",
        coral:         "#E88B7A",
        olive:         "#8B9A3A",

        paper: "var(--theme-page-bg, #E8DFDA)",
        warm: "var(--theme-card-bg, #FFFFFF)",
        cream: "#E8DFDA",

        sage: {
          DEFAULT: "#C1D4C1",
          light: "#D8E6D8",
          dark: "#A4BEA4",
        },
        sky: {
          DEFAULT: "#B5C7D8",
          light: "#CDDAE6",
          pale: "#E4ECF2",
        },
        forest: {
          DEFAULT: "#6B9E8A",
          light: "#72946F",
          dark: "#466A4B",
        },
        peach: {
          DEFAULT: "#F0C8BC",
          light: "#F5D8D0",
          dark: "#E88B7A",
        },
        periwinkle: {
          DEFAULT: "#B8C8E0",
          light: "#CDDAE8",
        },

        ink: {
          DEFAULT: "#2D3A35",
          green: "var(--theme-deep, #6B9E8A)",
          medium: "var(--theme-soft, #C1D4C1)",
          light: "#72946F",
          muted: "#8B8B80",
          dark: "#1A2A38",
        },
        gold: "#8B9A3A",
        terra: "#E88B7A",
        brown: "#8B6F5C",
        warmgray: {
          DEFAULT: "#8B8B80",
          light: "#A8A89E",
          fade: "#C8C8BE",
          dim: "#E0E0DA",
        },
        mint: {
          DEFAULT: "#C1D4C1",
          light: "#D8E6D8",
          dark: "#A4BEA4",
          pale: "#EBF2EB",
        },
        pink: {
          DEFAULT: "#F0C8BC",
          light: "#F5D8D0",
        },

        // shadcn
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        card: "14px",
        btn: "12px",
        avatar: "50%",
        badge: "20px",
      },
      boxShadow: {
        card: "0 1px 6px rgba(44,62,80,0.04)",
        soft: "0 4px 18px rgba(44,62,80,0.05)",
        glow: "0 0 18px rgba(193,212,193,0.18)",
        shelf: "0 1px 3px rgba(44,62,80,0.03)",
        "card-hover": "0 4px 14px rgba(44,62,80,0.07)",
      },
      fontFamily: {
        sans: ["'Pretendard'", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display": ["22px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline": ["16px", { lineHeight: "1.35", letterSpacing: "-0.01em", fontWeight: "500" }],
        "subhead": ["15px", { lineHeight: "1.4", letterSpacing: "-0.005em", fontWeight: "500" }],
        "body": ["14px", { lineHeight: "1.6", fontWeight: "400" }],
        "button": ["14px", { lineHeight: "1.2", fontWeight: "600" }],
        "caption": ["12px", { lineHeight: "1.5", letterSpacing: "0.01em", fontWeight: "400" }],
        "badge": ["11px", { lineHeight: "1.3", fontWeight: "700" }],
        "micro": ["10px", { lineHeight: "1.4", letterSpacing: "0.02em" }],
      },
      lineHeight: {
        chat: "1.8",
        body: "1.7",
        tight: "1.2",
        editorial: "1.15",
        quote: "1.9",
      },
      letterSpacing: {
        tighter: "-0.02em",
        editorial: "-0.01em",
        wide: "0.02em",
        wider: "0.04em",
        widest: "0.08em",
      },
      zIndex: {
        nav: "40",
        header: "50",
        overlay: "60",
        sheet: "70",
        modal: "80",
        toast: "90",
        top: "100",
      },
      spacing: {
        "card-p": "16px",
        "card-gap": "12px",
        "page-x": "20px",
        "section-gap": "24px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "slide-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(5px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
